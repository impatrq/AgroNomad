// RTOS VERSION
// !! DEPENDENCIAS !!
#include <sys/time.h>
#include <stdbool.h>
#include <stdint.h>
#include "esp_log.h"
#include "esp_sleep.h"
#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"

// COMPONENTES
#include "lora.h"       // Librería para el módulo LoRa
#include "neo6m.h"      // Librería para el módulo GPS NEO-6MV2
#include "mpumlx.h"     // Librería para el sensor de movimiento MPU6050
#include "lm35.h"       // Librería para el sensor de temperatura LM35

// !! PARAMETROS Y VARIABLES RTOS !!
#define SENSOR_PERIOD_MS   5000   // cada cuánto muestrear
#define POWER_PERIOD_MS    60000  // cada cuánto revisar el temporizador del mosfet
#define LORA_QUEUE_LEN     4      // paquetes en buffer

static QueueHandle_t lora_queue = NULL;

// !! PARAMETROS AJUSTABLES Y DEFINICIONES DE MAIN !!
// MODO SLEEP
#define WAKEUP_GPIO     27 // GPIO que despierta del modo sleep 
#define WAKEUP_LEVEL    1  // Activarse con nivel alto/flanco ascendente

// CONTROL DE ALIMENTACIÓN - C1+C4 o C2+C3
#define MOSFET1 25 // GPIO del MOSFET CONTROL3
#define MOSFET2 26 // GPIO del MOSFET CONTROL4
#define MOSFET3 32 // GPIO del MOSFET CONTROL1
#define MOSFET4 33 // GPIO del MOSFET CONTROL2

// Mascara de manejo de los 4 pines
#define GPIO_MOSFET_MASK ((1ULL<<MOSFET1) | (1ULL<<MOSFET2) | (1ULL<<MOSFET3) | (1ULL<<MOSFET4))

// Conmutación de baterías
#define TIEMPO_CAMBIO_BATS 300

// Sensores temperatura
#define Vout_LM35       34 
#define H_COEFICIENTE   0.10f 

// Variables guardadas en memoria RTC (sobreviven al Deep Sleep)
RTC_DATA_ATTR bool estado_mosfet = true; // true = estado inicial (2+3), false = estado secundario (1+4)
RTC_DATA_ATTR uint64_t tiempo_switch = 0;
RTC_DATA_ATTR bool sistema_inicializado = false;

// VARIABLES DE DATOS
double latitude; 
double longitude; 
char lat_hemisphere; 
char lon_hemisphere; 
float velocidad; 
double lat_signed;
double lon_signed;

// Variables de temperatura
float lm_amb_temp;  
float temp_interna; 

mlx90614_data_t mlx_data; 

// Declara los estados de los MOSFETs
#define MOSFET_SWITCH_ENABLED 1

// !! FUNCIONES !!

// !! MOSFETS !!
// Inicialización de Salida de MOSFETs
void init_mosfet_gpios() {
    gpio_hold_dis(MOSFET1);
    gpio_hold_dis(MOSFET2);
    gpio_hold_dis(MOSFET3);
    gpio_hold_dis(MOSFET4);

    gpio_config_t io_config = {
        .intr_type = GPIO_INTR_DISABLE,
        .mode = GPIO_MODE_OUTPUT,
        .pin_bit_mask = GPIO_MOSFET_MASK,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .pull_up_en = GPIO_PULLUP_DISABLE,
    };
    
    gpio_config(&io_config);
}

void aplica_estado_mosfet() {
    ESP_LOGI("MOSFETS","Aplicando estado %d...", estado_mosfet);
    gpio_set_level(MOSFET1, 1);
    gpio_set_level(MOSFET4, 1);
    vTaskDelay(pdMS_TO_TICKS(10));
    gpio_set_level(MOSFET2, 0);
    gpio_set_level(MOSFET3, 0);
    
    // mantener estado al entrar en deep sleep
    // gpio_hold_en(MOSFET1);
    // gpio_hold_en(MOSFET2);
    // gpio_hold_en(MOSFET3);
    // gpio_hold_en(MOSFET4);
    // gpio_deep_sleep_hold_en();  
}

// !! TEMPERATURA !!
void read_lm35() {
    ESP_LOGI("read_lm35","Intentando leer LM35...");
    lm35_data_t data;
    esp_err_t ret = lm35_read(&data);
    if (ret == ESP_OK) {
        lm_amb_temp = data.lm_amb_temp;
        ESP_LOGI("LM35","Temperatura: %.2f °C", lm_amb_temp);
    } else {
        ESP_LOGE("LM35","Error leyendo LM35: %s", esp_err_to_name(ret));
    }
}

void read_mlx90614() {
    ESP_LOGI("MLX90614","Intentando leer MLX90614...");
    esp_err_t ret = mlx90614_read(&mlx_data, I2C_NUM_0);
    if (ret == ESP_OK) {
        ESP_LOGI("MLX90614","Temperatura objeto: %.2f °C", mlx_data.mlx_object_temp);
    } else {
        ESP_LOGE("MLX90614","Error leyendo datos: %s", esp_err_to_name(ret));
    }
}

void internal_temp() {
    ESP_LOGI("Temp.Calc","Calculando temperatura interna...");
    temp_interna = (mlx_data.mlx_object_temp-15) + (mlx_data.mlx_object_temp-15 - (lm_amb_temp)) * H_COEFICIENTE;
    ESP_LOGI("Temp.Calc","Temperatura interna estimada: %.2f °C", temp_interna); 
}

// !! GPS !!
void read_gps() {
    ESP_LOGI("GPS","Intentando leer GPS...");
    raw_nmea(&latitude, &longitude, &lat_hemisphere, &lon_hemisphere, &velocidad);
    ESP_LOGI("GPS","Latitud: %f %c, Longitud: %f %c", latitude, lat_hemisphere, longitude, lon_hemisphere);
    if (lat_hemisphere == 'S') {
        lat_signed = -latitude;
    } else {
        lat_signed = latitude;
    }
    if (lon_hemisphere == 'W') {
        lon_signed = -longitude;
    } else {
        lon_signed = longitude;
    }
}


/*
FUNCIONAMIENTO RTOS

static void nombre_funcion(void *pvParameters){
funcion
}

void app_main(void)
{
    inits();

    lora_queue = xQueueCreate(LORA_QUEUE_LEN, sizeof(lora_msg_t));
    configASSERT(lora_queue);

    xTaskCreate(nombre_funcion, "nombre", 4096, NULL, 5, NULL);    
}
*/