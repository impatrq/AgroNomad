#define _DEFAULT_SOURCE

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <linux/gpio.h>
#include <linux/spi/spidev.h>
#include <netinet/in.h>
#include <poll.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <unistd.h>

#define SPI_DEVICE "/dev/spidev0.0"
#define GPIO_CHIP_DEVICE "/dev/gpiochip0"
#define GPIO_LORA_RESET 25
#define GPIO_LORA_DIO0 24
#define SPI_SPEED_HZ 5000000U
#define LORA_PACKET_SIZE 14
#define BACKEND_IP "127.0.0.1"
#define BACKEND_PORT 4001

typedef struct __attribute__((packed)) {
    uint16_t id_collar;
    float temperatura;
    int32_t latitud;
    int32_t longitud;
} agro_neck_payload_t;

_Static_assert(sizeof(agro_neck_payload_t) == LORA_PACKET_SIZE,
               "AgroNeck LoRa payload layout changed");

static int spi_fd = -1;
static int reset_line_fd = -1;
static int dio0_event_fd = -1;

static int request_gpio_lines(void)
{
    int chip_fd = open(GPIO_CHIP_DEVICE, O_RDONLY | O_CLOEXEC);
    if (chip_fd < 0) {
        perror("open GPIO chip");
        return -1;
    }

    struct gpiohandle_request reset_request = { 0 };
    reset_request.lineoffsets[0] = GPIO_LORA_RESET;
    reset_request.flags = GPIOHANDLE_REQUEST_OUTPUT;
    reset_request.default_values[0] = 1;
    reset_request.lines = 1;
    snprintf(reset_request.consumer_label, sizeof(reset_request.consumer_label), "agrobot-lora-reset");

    if (ioctl(chip_fd, GPIO_GET_LINEHANDLE_IOCTL, &reset_request) < 0) {
        perror("request LoRa reset GPIO");
        close(chip_fd);
        return -1;
    }
    reset_line_fd = reset_request.fd;

    struct gpioevent_request dio0_request = { 0 };
    dio0_request.lineoffset = GPIO_LORA_DIO0;
    dio0_request.handleflags = GPIOHANDLE_REQUEST_INPUT;
    dio0_request.eventflags = GPIOEVENT_REQUEST_RISING_EDGE;
    snprintf(dio0_request.consumer_label, sizeof(dio0_request.consumer_label), "agrobot-lora-dio0");

    if (ioctl(chip_fd, GPIO_GET_LINEEVENT_IOCTL, &dio0_request) < 0) {
        perror("request LoRa DIO0 GPIO event");
        close(reset_line_fd);
        reset_line_fd = -1;
        close(chip_fd);
        return -1;
    }
    dio0_event_fd = dio0_request.fd;

    close(chip_fd);
    return 0;
}

static int set_reset_gpio(int value)
{
    struct gpiohandle_data data = { 0 };
    data.values[0] = (uint8_t)value;
    return ioctl(reset_line_fd, GPIOHANDLE_SET_LINE_VALUES_IOCTL, &data);
}

static int spi_transfer(const uint8_t *tx_data, uint8_t *rx_data, size_t length)
{
    struct spi_ioc_transfer transfer = {
        .tx_buf = (uintptr_t)tx_data,
        .rx_buf = (uintptr_t)rx_data,
        .len = (uint32_t)length,
        .speed_hz = SPI_SPEED_HZ,
        .bits_per_word = 8,
    };

    int result = ioctl(spi_fd, SPI_IOC_MESSAGE(1), &transfer);
    if (result != (int)length) {
        if (result >= 0) {
            errno = EIO;
        }
        return -1;
    }
    return 0;
}

static int lora_read_register(uint8_t reg, uint8_t *value)
{
    uint8_t tx_data[2] = { (uint8_t)(reg & 0x7F), 0 };
    uint8_t rx_data[2] = { 0 };

    if (spi_transfer(tx_data, rx_data, sizeof(tx_data)) < 0) {
        return -1;
    }
    *value = rx_data[1];
    return 0;
}

static int lora_write_register(uint8_t reg, uint8_t value)
{
    uint8_t tx_data[2] = { (uint8_t)(reg | 0x80), value };
    return spi_transfer(tx_data, NULL, sizeof(tx_data));
}

static int lora_read_fifo(uint8_t *data, size_t length)
{
    uint8_t tx_data[LORA_PACKET_SIZE + 1] = { 0 };
    uint8_t rx_data[LORA_PACKET_SIZE + 1] = { 0 };

    if (length == 0 || length > LORA_PACKET_SIZE) {
        errno = EMSGSIZE;
        return -1;
    }

    if (spi_transfer(tx_data, rx_data, length + 1) < 0) {
        return -1;
    }
    memcpy(data, &rx_data[1], length);
    return 0;
}

static int lora_initialize(void)
{
    spi_fd = open(SPI_DEVICE, O_RDWR | O_CLOEXEC);
    if (spi_fd < 0) {
        perror("open SPI device");
        return -1;
    }

    uint8_t mode = SPI_MODE_0;
    uint8_t bits_per_word = 8;
    uint32_t speed_hz = SPI_SPEED_HZ;
    if (ioctl(spi_fd, SPI_IOC_WR_MODE, &mode) < 0 ||
        ioctl(spi_fd, SPI_IOC_WR_BITS_PER_WORD, &bits_per_word) < 0 ||
        ioctl(spi_fd, SPI_IOC_WR_MAX_SPEED_HZ, &speed_hz) < 0) {
        perror("configure SPI device");
        return -1;
    }

    if (request_gpio_lines() < 0) {
        return -1;
    }
    if (set_reset_gpio(0) < 0) {
        perror("reset SX1278");
        return -1;
    }
    usleep(10000);
    if (set_reset_gpio(1) < 0) {
        perror("release SX1278 reset");
        return -1;
    }
    usleep(10000);

    uint8_t version = 0;
    if (lora_read_register(0x42, &version) < 0) {
        perror("read SX1278 version");
        return -1;
    }
    printf("SX1278 version: 0x%02X\n", version);

    if (lora_write_register(0x01, 0x80) < 0) return -1;
    usleep(10000);
    if (lora_write_register(0x01, 0x81) < 0) return -1;
    if (lora_write_register(0x06, 0xE4) < 0) return -1;
    if (lora_write_register(0x07, 0xC0) < 0) return -1;
    if (lora_write_register(0x08, 0x00) < 0) return -1;
    if (lora_write_register(0x1D, 0x72) < 0) return -1;
    if (lora_write_register(0x1E, 0x70) < 0) return -1;
    if (lora_write_register(0x26, 0x04) < 0) return -1;
    if (lora_write_register(0x39, 0x12) < 0) return -1;
    if (lora_write_register(0x0E, 0x00) < 0) return -1;
    if (lora_write_register(0x0F, 0x00) < 0) return -1;
    if (lora_write_register(0x40, 0x00) < 0) return -1;
    if (lora_write_register(0x12, 0xFF) < 0) return -1;
    if (lora_write_register(0x01, 0x85) < 0) return -1;

    printf("Listening for AgroNeck LoRa packets at 915 MHz\n");
    return 0;
}

static int lora_receive_packet(uint8_t *data, size_t capacity, size_t *length)
{
    struct pollfd event_fd = { .fd = dio0_event_fd, .events = POLLIN };

    for (;;) {
        int poll_result = poll(&event_fd, 1, -1);
        if (poll_result < 0) {
            if (errno == EINTR) continue;
            return -1;
        }

        struct gpioevent_data event;
        if (read(dio0_event_fd, &event, sizeof(event)) != sizeof(event)) {
            if (errno == EINTR) continue;
            return -1;
        }

        uint8_t irq_flags = 0;
        if (lora_read_register(0x12, &irq_flags) < 0) return -1;
        if ((irq_flags & 0x40) == 0) continue;

        if (irq_flags & 0x20) {
            if (lora_write_register(0x12, irq_flags) < 0) return -1;
            fprintf(stderr, "Discarded LoRa packet with CRC error\n");
            continue;
        }

        uint8_t packet_length = 0;
        uint8_t fifo_address = 0;
        if (lora_read_register(0x13, &packet_length) < 0 ||
            lora_read_register(0x10, &fifo_address) < 0) {
            return -1;
        }
        if (packet_length > capacity || packet_length > LORA_PACKET_SIZE) {
            if (lora_write_register(0x12, irq_flags) < 0) return -1;
            fprintf(stderr, "Discarded LoRa packet with unexpected length: %u\n", packet_length);
            continue;
        }

        if (lora_write_register(0x0D, fifo_address) < 0 ||
            lora_read_fifo(data, packet_length) < 0 ||
            lora_write_register(0x12, irq_flags) < 0) {
            return -1;
        }

        *length = packet_length;
        return 0;
    }
}

static int send_all(int sock, const char *message)
{
    size_t length = strlen(message);
    size_t sent = 0;

    while (sent < length) {
        ssize_t result = send(sock, message + sent, length - sent, MSG_NOSIGNAL);
        if (result < 0 && errno == EINTR) continue;
        if (result <= 0) return -1;
        sent += (size_t)result;
    }
    return 0;
}

static int forward_to_backend(const agro_neck_payload_t *payload)
{
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) {
        perror("create backend socket");
        return -1;
    }

    struct sockaddr_in backend_address = { 0 };
    backend_address.sin_family = AF_INET;
    backend_address.sin_port = htons(BACKEND_PORT);
    if (inet_pton(AF_INET, BACKEND_IP, &backend_address.sin_addr) != 1 ||
        connect(sock, (struct sockaddr *)&backend_address, sizeof(backend_address)) < 0) {
        perror("connect to telemetry backend");
        close(sock);
        return -1;
    }

    char json[192];
    snprintf(json, sizeof(json),
             "{\"ID\":\"COLLAR-%u\",\"LAT\":%.6f,\"LONG\":%.6f,\"TEMP\":\"%.2f\"}\n",
             (unsigned)payload->id_collar,
             payload->latitud / 1000000.0,
             payload->longitud / 1000000.0,
             payload->temperatura);

    int result = send_all(sock, json);
    if (result < 0) perror("send telemetry to backend");
    close(sock);
    return result;
}

static void close_receiver(void)
{
    if (dio0_event_fd >= 0) close(dio0_event_fd);
    if (reset_line_fd >= 0) close(reset_line_fd);
    if (spi_fd >= 0) close(spi_fd);
}

int main(void)
{
    uint8_t packet[LORA_PACKET_SIZE];
    size_t packet_length = 0;

    if (lora_initialize() < 0) {
        close_receiver();
        return EXIT_FAILURE;
    }

    for (;;) {
        if (lora_receive_packet(packet, sizeof(packet), &packet_length) < 0) {
            perror("receive LoRa packet");
            close_receiver();
            return EXIT_FAILURE;
        }
        if (packet_length != sizeof(agro_neck_payload_t)) {
            fprintf(stderr, "Expected %zu-byte payload, received %zu bytes\n",
                    sizeof(agro_neck_payload_t), packet_length);
            continue;
        }

        agro_neck_payload_t payload;
        memcpy(&payload, packet, sizeof(payload));
        printf("Received collar=%u temperature=%.2f C latitude=%.6f longitude=%.6f\n",
               (unsigned)payload.id_collar,
               payload.temperatura,
               payload.latitud / 1000000.0,
               payload.longitud / 1000000.0);

        forward_to_backend(&payload);
    }
}