#include "lora.h"
#include <assert.h>
#include <string.h>
#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

/*

    TRANSMISOR LORA 
    AGRONECK

    *** VERSION DE DIAGNOSTICO ***
    - Loguea los registros del SX1278 antes/despues de cada TX.
    - Timeout real (ya no depende de pdMS_TO_TICKS(1) == 0 ticks).
    - Si el TX falla: resetea la radio, la reconfigura y reintenta una vez.

*/

static const char *TAG = "LoRa";

spi_device_handle_t lora_spi;

static void lora_spi_init() {
    // configuracion básica
    spi_bus_config_t buscfg = {
        .mosi_io_num = LORA_MOSI,  // GPIO 23
        .miso_io_num = LORA_MISO,  // GPIO 19
        .sclk_io_num = LORA_CLK,   // GPIO 18
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 4096,
    };

    ESP_ERROR_CHECK(spi_bus_initialize(SPI2_HOST, &buscfg, SPI_DMA_CH_AUTO));

    spi_device_interface_config_t devcfg = {
        .clock_speed_hz = 5*1000*1000,
        .mode = 0,
        .spics_io_num = LORA_CS,
        .queue_size = 7,
    };
    
    ESP_ERROR_CHECK(spi_bus_add_device(SPI2_HOST, &devcfg, &lora_spi));
}

// Función para reiniciar el módulo
static void lora_reset(void) {
    gpio_set_level(LORA_RESET, 0);
    vTaskDelay(pdMS_TO_TICKS(10));
    gpio_set_level(LORA_RESET, 1);
    vTaskDelay(pdMS_TO_TICKS(10));
}

static uint8_t lora_read_register(uint8_t reg) {
    uint8_t tx_data[2] = { reg & 0x7F, 0x00 };
    uint8_t rx_data[2] = {0};
    spi_transaction_t t = {
        .length = 2 * 8,
        .tx_buffer = tx_data,
        .rx_buffer = rx_data
    };

    spi_device_polling_transmit(lora_spi, &t);
    return rx_data[1];
}

// Funcion de escritura registros fifo LoRa( MSB + adress // payload )
static void lora_write_register(uint8_t address, uint8_t payload){
    uint8_t tx_data[2] = { address | 0x80, payload }; 
    spi_transaction_t t = {
        .length = 2 * 8,
        .tx_buffer = tx_data,
        .rx_buffer = NULL
    };
    
    esp_err_t ret = spi_device_polling_transmit(lora_spi, &t);
    assert(ret == ESP_OK);
}

// Diagnostico: estado observable de la radio segun el SPI
static void lora_dump(const char *when) {
    uint8_t ver   = lora_read_register(0x42);
    uint8_t op    = lora_read_register(0x01);
    uint8_t irq   = lora_read_register(0x12);
    uint8_t frf_m = lora_read_register(0x06);
    uint8_t frf_l = lora_read_register(0x08);
    uint8_t mcfg1 = lora_read_register(0x1D);
    ESP_LOGW(TAG, "[%s] ver=0x%02X opmode=0x%02X irq=0x%02X frf=0x%02X..0x%02X mcfg1=0x%02X",
             when, ver, op, irq, frf_m, frf_l, mcfg1);
}

// Configuracion de la radio (sin tocar el bus SPI ni el pin de reset)
static void lora_apply_config(void) {
    lora_write_register(0x01, 0x80); // RegOpMode: LoRa + Sleep
    vTaskDelay(pdMS_TO_TICKS(10));
    lora_write_register(0x01, 0x81); // RegOpMode: LoRa + standby
    vTaskDelay(pdMS_TO_TICKS(2));    // dejar asentar el oscilador

    // Frecuencia 433 MHz (para SX1278)
    lora_write_register(0x06, 0x6C);
    lora_write_register(0x07, 0x40);
    lora_write_register(0x08, 0x00);

    lora_write_register(0x1D, 0x72);
    lora_write_register(0x1E, 0x74);
    lora_write_register(0x26, 0x00);
    lora_write_register(0x39, 0x34);

    lora_write_register(0x1D, 0x72);
    lora_write_register(0x1E, 0x74); 
    lora_write_register(0x26, 0x00);

    // Potencia de transmisión
    //0x80 // 2 dBm
    //0x83 // 5 dBm
    //0x8F // 17 dBm
    lora_write_register(0x09, 0x80); // Potencia supuestamente "ideal"
}

// Un intento de TX. Devuelve true solo si se vio TxDone.
static bool lora_tx_attempt(const uint8_t *data, size_t length, uint32_t timeout_ms, const char *tag) {
    lora_dump(tag); // estado ANTES de transmitir

    // 1. Poner el chip en Standby para poder escribir la FIFO sin corrupción
    lora_write_register(0x01, 0x81); // O 0x89 si usas 433MHz

    // 2. Resetear el puntero de transmisión de la FIFO a la dirección base 0x00
    lora_write_register(0x0E, 0x00); // RegFifoTxBaseAddr
    lora_write_register(0x0D, 0x00); // RegFifoAddrPtr

    // 3. Definir el tamaño exacto del payload a enviar
    lora_write_register(0x22, length);

    // 4. Escribir los datos en la FIFO (Burst Write)
    uint8_t *spi_buf = heap_caps_malloc(length + 1, MALLOC_CAP_DMA);
    if (spi_buf == NULL) {
        ESP_LOGE(TAG, "Error: No se pudo asignar memoria buffer SPI");
        return false;
    }

    spi_buf[0] = 0x00 | 0x80; // Dirección FIFO (0x00) + Bit de escritura (0x80)
    memcpy(&spi_buf[1], data, length);

    spi_transaction_t t = {
        .length = (length + 1) * 8,
        .tx_buffer = spi_buf,
        .rx_buffer = NULL
    };

    spi_device_polling_transmit(lora_spi, &t);
    free(spi_buf);

    // 5. Limpiar BANDERAS de interrupción viejas antes de transmitir
    lora_write_register(0x12, 0xFF); // RegIrqFlags

    // 6. INICIAR TRANSMISIÓN (RegOpMode = LoRa + TX)
    lora_write_register(0x01, 0x83); // O 0x8B si usas 433MHz

    // 7. Esperar a que la radio termine de transmitir por el aire (TxDone)
    //    NOTA: vTaskDelay(pdMS_TO_TICKS(1)) == vTaskDelay(0) porque
    //    CONFIG_FREERTOS_HZ=100 => el "timeout" original no esperaba nada.
    uint32_t waited = 0;
    bool ok = false;
    uint8_t irq_flags = 0;
    while (waited < timeout_ms) {
        irq_flags = lora_read_register(0x12);
        if (irq_flags & 0x08) { // Bit 3 = TxDone
            ok = true;
            ESP_LOGI(TAG, "Paquete enviado con éxito (%d bytes) en %lu ms", length, (unsigned long)waited);
            break;
        }
        vTaskDelay(1); // 1 tick = 10 ms con CONFIG_FREERTOS_HZ=100
        waited += 10;
    }
    if (!ok) {
        ESP_LOGE(TAG, "%s: TIMEOUT tras %lu ms (irq=0x%02X, opmode=0x%02X)",
                 tag, (unsigned long)timeout_ms, lora_read_register(0x12), lora_read_register(0x01));
    }

    // 8. Limpiar la bandera TxDone para que no afecte la siguiente ráfaga
    lora_write_register(0x12, 0xFF);

    // 9. REINICIAR PUNTERO DE FIFO Y VOLVER A SLEEP/STANDBY
    lora_write_register(0x0D, 0x00);
    lora_write_register(0x01, 0x80); // O 0x88 si usas 433MHz

    return ok;
}

void lora_reinit(void) {
    lora_reset();
    vTaskDelay(pdMS_TO_TICKS(20));
    lora_apply_config();
}

uint8_t lora_version(void) {
    return lora_read_register(0x42);
}

void transmitir_datos(payload_t *paquete){
    const uint8_t *data = (const uint8_t *)paquete;
    size_t len = sizeof(*paquete);

    if (lora_tx_attempt(data, len, 300, "TX-1")) {
        return;
    }

    ESP_LOGE(TAG, "*** TX fallo: reseteo y reconfiguro la radio, reintento ***");
    lora_reinit();
    if (lora_tx_attempt(data, len, 600, "TX-2-reintento")) {
        ESP_LOGW(TAG, "*** REINTENTO OK: la radio estaba VIVA pero en mal estado ***");
    } else {
        ESP_LOGE(TAG, "*** REINTENTO FALLO: la radio NO responde (alimentacion/reset?) ***");
    }
}

void lora_init(void){
    // 2. AHORA configuramos el pin de reset y reiniciamos el módulo
    gpio_reset_pin(LORA_RESET);
    gpio_set_direction(LORA_RESET, GPIO_MODE_OUTPUT);
    gpio_reset_pin(LORA_CS);
    lora_reset();

    lora_spi_init();

    vTaskDelay(pdMS_TO_TICKS(15));

    uint8_t version = lora_read_register(0x42);
    ESP_LOGI(TAG, "LoRa version register: 0x%02X", version);

    lora_apply_config();
    lora_dump("init");
}
