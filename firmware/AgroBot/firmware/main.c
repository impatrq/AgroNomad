#ifdef ESP_PLATFORM

#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "esp_err.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define LORA_CS 5
#define LORA_RESET 14
#define LORA_CLK 18
#define LORA_MISO 19
#define LORA_MOSI 23
#define LORA_DIO0 26
#define LORA_FREQUENCY_MSB 0xE4
#define LORA_FREQUENCY_MID 0xC0
#define LORA_FREQUENCY_LSB 0x00
#define LORA_PACKET_SIZE 14

typedef struct __attribute__((packed)) {
    uint16_t id_collar;
    float temperatura;
    int32_t latitud;
    int32_t longitud;
} agro_neck_payload_t;

static const char *TAG = "AgroBot-LoRa";
static spi_device_handle_t lora_spi;

static uint8_t lora_read_register(uint8_t reg)
{
    uint8_t tx_data[2] = { (uint8_t)(reg & 0x7F), 0 };
    uint8_t rx_data[2] = { 0 };
    spi_transaction_t transaction = {
        .length = sizeof(tx_data) * 8,
        .tx_buffer = tx_data,
        .rx_buffer = rx_data,
    };

    ESP_ERROR_CHECK(spi_device_polling_transmit(lora_spi, &transaction));
    return rx_data[1];
}

static void lora_write_register(uint8_t reg, uint8_t value)
{
    uint8_t tx_data[2] = { (uint8_t)(reg | 0x80), value };
    spi_transaction_t transaction = {
        .length = sizeof(tx_data) * 8,
        .tx_buffer = tx_data,
    };

    ESP_ERROR_CHECK(spi_device_polling_transmit(lora_spi, &transaction));
}

static esp_err_t lora_read_fifo(uint8_t *data, size_t length)
{
    uint8_t tx_data[LORA_PACKET_SIZE + 1] = { 0 };
    uint8_t rx_data[LORA_PACKET_SIZE + 1] = { 0 };

    if (length == 0 || length > LORA_PACKET_SIZE) {
        return ESP_ERR_INVALID_SIZE;
    }

    spi_transaction_t transaction = {
        .length = (length + 1) * 8,
        .tx_buffer = tx_data,
        .rx_buffer = rx_data,
    };

    esp_err_t result = spi_device_polling_transmit(lora_spi, &transaction);
    if (result == ESP_OK) {
        memcpy(data, &rx_data[1], length);
    }
    return result;
}

static void lora_receiver_init(void)
{
    gpio_config_t reset_config = {
        .pin_bit_mask = 1ULL << LORA_RESET,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&reset_config));
    gpio_set_level(LORA_RESET, 0);
    vTaskDelay(pdMS_TO_TICKS(10));
    gpio_set_level(LORA_RESET, 1);
    vTaskDelay(pdMS_TO_TICKS(10));

    spi_bus_config_t bus_config = {
        .mosi_io_num = LORA_MOSI,
        .miso_io_num = LORA_MISO,
        .sclk_io_num = LORA_CLK,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = LORA_PACKET_SIZE + 1,
    };
    ESP_ERROR_CHECK(spi_bus_initialize(SPI2_HOST, &bus_config, SPI_DMA_CH_AUTO));

    spi_device_interface_config_t device_config = {
        .clock_speed_hz = 5 * 1000 * 1000,
        .mode = 0,
        .spics_io_num = LORA_CS,
        .queue_size = 1,
    };
    ESP_ERROR_CHECK(spi_bus_add_device(SPI2_HOST, &device_config, &lora_spi));

    uint8_t version = lora_read_register(0x42);
    ESP_LOGI(TAG, "SX1278 version: 0x%02X", version);

    lora_write_register(0x01, 0x80);
    vTaskDelay(pdMS_TO_TICKS(10));
    lora_write_register(0x01, 0x81);
    lora_write_register(0x06, LORA_FREQUENCY_MSB);
    lora_write_register(0x07, LORA_FREQUENCY_MID);
    lora_write_register(0x08, LORA_FREQUENCY_LSB);

    // Match the SX1278 reset-default LoRa settings used by the AgroNeck sender.
    lora_write_register(0x1D, 0x72);
    lora_write_register(0x1E, 0x70);
    lora_write_register(0x26, 0x04);
    lora_write_register(0x39, 0x12);
    lora_write_register(0x0E, 0x00);
    lora_write_register(0x0F, 0x00);
    lora_write_register(0x12, 0xFF);
    lora_write_register(0x01, 0x85);

    ESP_LOGI(TAG, "Listening for AgroNeck LoRa packets at 915 MHz");
}

static esp_err_t lora_receive_packet(uint8_t *data, size_t capacity, size_t *length)
{
    for (;;) {
        uint8_t irq_flags = lora_read_register(0x12);
        if ((irq_flags & 0x40) == 0) {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }

        lora_write_register(0x12, irq_flags);
        if (irq_flags & 0x20) {
            ESP_LOGW(TAG, "Received packet with CRC error");
            continue;
        }

        size_t packet_length = lora_read_register(0x13);
        if (packet_length > capacity || packet_length > LORA_PACKET_SIZE) {
            ESP_LOGW(TAG, "Discarding packet with unexpected length: %u", (unsigned)packet_length);
            continue;
        }

        lora_write_register(0x0D, lora_read_register(0x10));
        esp_err_t result = lora_read_fifo(data, packet_length);
        if (result != ESP_OK) {
            return result;
        }

        *length = packet_length;
        return ESP_OK;
    }
}

static void log_agro_neck_payload(const uint8_t *data, size_t length)
{
    if (length != sizeof(agro_neck_payload_t)) {
        ESP_LOGW(TAG, "Expected %u-byte AgroNeck payload, received %u bytes",
                 (unsigned)sizeof(agro_neck_payload_t), (unsigned)length);
        return;
    }

    agro_neck_payload_t payload;
    memcpy(&payload, data, sizeof(payload));

    ESP_LOGI(TAG,
             "AgroNeck received: collar=%u temperature=%.2f C latitude=%.6f longitude=%.6f",
             (unsigned)payload.id_collar,
             payload.temperatura,
             payload.latitud / 1000000.0,
             payload.longitud / 1000000.0);
}

void app_main(void)
{
    uint8_t packet[LORA_PACKET_SIZE];
    size_t packet_length;

    lora_receiver_init();
    for (;;) {
        ESP_ERROR_CHECK(lora_receive_packet(packet, sizeof(packet), &packet_length));
        log_agro_neck_payload(packet, packet_length);
    }
}

#else

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>

#define SERVER_IP "127.0.0.1"
#define SERVER_PORT 4001
#define SEND_INTERVAL_SECONDS 5

static int connect_to_backend(void)
{
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0)
    {
        perror("socket");
        return -1;
    }

    struct sockaddr_in server_addr;
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(SERVER_PORT);

    if (inet_pton(AF_INET, SERVER_IP, &server_addr.sin_addr) != 1)
    {
        fprintf(stderr, "Invalid backend IP address: %s\n", SERVER_IP);
        close(sock);
        return -1;
    }

    if (connect(sock, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0)
    {
        perror("connect");
        close(sock);
        return -1;
    }

    printf("Connected to AgroBot backend at %s:%d\n", SERVER_IP, SERVER_PORT);
    return sock;
}

static int send_collar_data(int sock, const char *payload)
{
    size_t length = strlen(payload);
    size_t sent = 0;

    while (sent < length)
    {
        ssize_t result = send(sock, payload + sent, length - sent, 0);
        if (result <= 0)
        {
            perror("send");
            return -1;
        }
        sent += (size_t)result;
    }

    printf("Sent telemetry: %s", payload);
    return 0;
}

int main(void)
{
    static const char *payloads[] = {
        "{\"ID\":\"COLLAR-01\",\"FIRMWARE_VERS\":\"1.0\",\"HARDWARE_VERS\":\"1.0\",\"LAT\":-34.707652,\"LONG\":-58.242300,\"TEMP\":\"38.4\"}\n",
        "{\"ID\":\"COLLAR-02\",\"FIRMWARE_VERS\":\"1.0\",\"HARDWARE_VERS\":\"1.0\",\"LAT\":-34.708100,\"LONG\":-58.243000,\"TEMP\":\"37.9\"}\n",
    };
    const size_t payload_count = sizeof(payloads) / sizeof(payloads[0]);
    size_t payload_index = 0;
    int sock = -1;

    for (;;)
    {
        if (sock < 0)
        {
            sock = connect_to_backend();
            if (sock < 0)
            {
                fprintf(stderr, "Retrying in %d seconds...\n", SEND_INTERVAL_SECONDS);
                sleep(SEND_INTERVAL_SECONDS);
                continue;
            }
        }

        if (send_collar_data(sock, payloads[payload_index]) < 0)
        {
            close(sock);
            sock = -1;
            continue;
        }

        payload_index = (payload_index + 1) % payload_count;
        sleep(SEND_INTERVAL_SECONDS);
    }

    close(sock);
    return EXIT_SUCCESS;
}

#endif