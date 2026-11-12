// DEPENDENCIAS
#include <stdio.h>
#include <sys/time.h>
#include <stdbool.h>
#include <stdint.h>
#include "esp_log.h"    
#include "esp_system.h"
#include "esp_sleep.h"
#include "esp_timer.h"               
#include "esp_private/esp_clk.h"     
#include "esp_adc/adc_oneshot.h" 
#include "driver/gpio.h"
#include "driver/rtc_io.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"

#include "lora.h"       // Librería para el módulo LoRa
#include "neo6m.h"      // Librería para el módulo GPS NEO-6MV2
#include "mpumlx.h"     // Librería para el sensor de movimiento MPU6050
#include "lm35.h"       // Librería para el sensor de temperatura LM35

// MODO SLEEP
#define WAKEUP_GPIO     27 // GPIO que despierta del modo sleep 
#define WAKEUP_LEVEL    1  // Activarse con nivel alto/flanco ascendente

// Select the runtime independently from the transmission policy.
#define FREERTOS_IMPLEMENTATION 1
#define SEND_EVERYTIME 1

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
// DIAGNÓSTICO: 0 = no tocar los MOSFETs (prueba de causa raíz)
#define MOSFET_SWITCH_ENABLED 1

void aplica_estado_mosfet() {
    ESP_LOGI("MOSFETS","Aplicando estado %d...", estado_mosfet);
#if !MOSFET_SWITCH_ENABLED
    ESP_LOGW("MOSFETS","[DIAG] Switch de MOSFETs DESHABILITADO: no se toca la alimentacion");
    return;
#endif
    if (estado_mosfet) { // Estado inicial: 2+3
        gpio_set_level(MOSFET1, 1);
        gpio_set_level(MOSFET4, 1);
        vTaskDelay(pdMS_TO_TICKS(10));
        gpio_set_level(MOSFET2, 0);
        gpio_set_level(MOSFET3, 0);
    } else { // Estado secundario: 1+4
        gpio_set_level(MOSFET2, 1);
        gpio_set_level(MOSFET3, 1);
        vTaskDelay(pdMS_TO_TICKS(10));
        gpio_set_level(MOSFET1, 0);
        gpio_set_level(MOSFET4, 0);
    }
}

// Inicialización de Salida de MOSFETs
void init_mosfet_gpios() {
    gpio_deep_sleep_hold_dis();

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

// Switcheo de MOSFETs (alternar entre baterías)
void switch_mosfet() {
    ESP_LOGI("MOSFETS","Switcheando mosfets...");
    estado_mosfet = !estado_mosfet; 
    aplica_estado_mosfet();
}

uint64_t tiempo_medido(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (uint64_t)tv.tv_sec;
}

void hora_actual() {
    uint64_t tiempo_actual = tiempo_medido();

    // Si es el primer encendido físico del equipo
    if (!sistema_inicializado) {
        tiempo_switch = tiempo_actual;
        sistema_inicializado = true;
        aplica_estado_mosfet();
        ESP_LOGI("MAIN", "Tiempo base inicializado: %llu s", tiempo_switch);
        return;
    }

    uint64_t transcurrido = (tiempo_actual >= tiempo_switch) ? (tiempo_actual - tiempo_switch) : 0;
    ESP_LOGI("MOSFETS", "Tiempo actual: %llu s | Ultimo switch: %llu s | Transcurrido: %llu s", 
             tiempo_actual, tiempo_switch, transcurrido);

    // Evalúa si ya pasó el tiempo necesario para cambiar de batería
    if (transcurrido >= TIEMPO_CAMBIO_BATS) {
        switch_mosfet();
        lora_reinit();
        tiempo_switch = tiempo_actual; // Se actualiza el tiempo base con la hora actual
    } 
}







// ============================================================
// FUNCIONES DE LECTURA DE SENSORES
// ============================================================

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

void read_mpu6050() {
    ESP_LOGI("MPU6050","Intentando leer MPU6050...");
    mpu6050_data_t data;
    esp_err_t ret = mpu6050_read(&data, I2C_NUM_0);
    if (ret == ESP_OK) {
        ESP_LOGI("MPU6050","Aceleración - X: %d, Y: %d, Z: %d", data.ax, data.ay, data.az);
        ESP_LOGI("MPU6050","Giroscopio - X: %d, Y: %d, Z: %d", data.gx, data.gy, data.gz);
    } else {
        ESP_LOGE("MPU6050","Error leyendo datos: %s", esp_err_to_name(ret));
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






// ============================================================
// FUNCIONES DE CÁLCULO Y PROCESAMIENTO DE DATOS
// ============================================================
void internal_temp() {
    ESP_LOGI("Temp.Calc","Calculando temperatura interna...");
    temp_interna = (mlx_data.mlx_object_temp-15) + (mlx_data.mlx_object_temp-15 - (lm_amb_temp)) * H_COEFICIENTE;
    ESP_LOGI("Temp.Calc","Temperatura interna estimada: %.2f °C", temp_interna); 
}

void sensar_enviar(void *pvParameters){ 
    ESP_LOGI("func_sensar_enviar","Iniciando buses y perifericos.");
    gps_starting();
    init_i2c();
    mpu6050_init(I2C_NUM_0);
    lm35_init();
    init_mosfet_gpios();
    lora_init();

    ESP_LOGI("func_sensar_enviar","Leyendo todos los sensores...");
    read_gps();
    read_mpu6050();
    read_mlx90614();
    read_lm35();
    internal_temp();

    ESP_LOGI("func_sensar_enviar","Empaquetando y enviando...");
    payload_t paquete;
    paquete.id_collar = 122;
    paquete.temperatura = temp_interna;
    paquete.latitud = (int32_t)(lat_signed * 1000000.0);
    paquete.longitud = (int32_t)(lon_signed * 1000000.0);

    transmitir_datos(&paquete);

    // Evalúa y aplica el cambio de batería
    hora_actual();
    // Congelar estado de pines para Deep Sleep
    ESP_LOGI("func_sensar_enviar","Congelando MOSFETs...");
    gpio_hold_en(MOSFET1);
    gpio_hold_en(MOSFET2);
    gpio_hold_en(MOSFET3);
    gpio_hold_en(MOSFET4);
    gpio_deep_sleep_hold_en(); 

    mpu6050_enable_wom(I2C_NUM_0, MPU6050_THRESHOLD);

    ESP_LOGI("func_sensar_enviar","Limpiando INT MPU.");
    mpu6050_clear_int(I2C_NUM_0); 

    ESP_LOGI("func_sensar_enviar","Preparando interrupción antes de ir a dormir...");
    esp_sleep_enable_ext0_wakeup(WAKEUP_GPIO, WAKEUP_LEVEL);

    ESP_LOGI("func_sensar_enviar","Entrando en deep sleep...");
    vTaskDelay(pdMS_TO_TICKS(100));

    esp_deep_sleep_start();

    vTaskDelete(NULL);
}

// ============================================================
// TAREAS Y COLA DEL FREERTOS
// ============================================================
#if FREERTOS_IMPLEMENTATION

/*
Funcionamiento RTOS:

-- Senso y envio al mismo tiempo --

1. cuando senso, meto los datos en una cola
2. cuando hay algo en la cola, envio esos datos x lora

*/

/* ---------- Parámetros ajustables ---------- */
#define SENSOR_PERIOD_MS   5000   // cada cuánto muestrear
#define POWER_PERIOD_MS    60000  // cada cuánto revisar el temporizador del mosfet
#define LORA_QUEUE_LEN     4      // paquetes en buffer

/* ---------- Tipo de mensaje que se pasa por la cola ---------- */
typedef struct {
    int32_t id_collar;
    float   temperatura;
    int32_t latitud;
    int32_t longitud;
} lora_msg_t;

static QueueHandle_t lora_queue = NULL;

#if !SEND_EVERYTIME
static void enter_motion_deep_sleep(void)
{
    ESP_LOGI("SLEEP", "Preparando MPU6050 para wake-on-motion...");
    ESP_ERROR_CHECK(mpu6050_enable_wom(I2C_NUM_0, MPU6050_THRESHOLD));
    ESP_ERROR_CHECK(rtc_gpio_init((gpio_num_t)WAKEUP_GPIO));
    ESP_ERROR_CHECK(rtc_gpio_set_direction((gpio_num_t)WAKEUP_GPIO, RTC_GPIO_MODE_INPUT_ONLY));
    ESP_ERROR_CHECK(rtc_gpio_pulldown_en((gpio_num_t)WAKEUP_GPIO));
    ESP_ERROR_CHECK(rtc_gpio_pullup_dis((gpio_num_t)WAKEUP_GPIO));
    ESP_ERROR_CHECK(mpu6050_clear_int(I2C_NUM_0));

    if (rtc_gpio_get_level((gpio_num_t)WAKEUP_GPIO) == WAKEUP_LEVEL) {
        ESP_LOGI("SLEEP", "Esperando que la interrupcion del MPU6050 se desactive...");
        while (rtc_gpio_get_level((gpio_num_t)WAKEUP_GPIO) == WAKEUP_LEVEL) {
            ESP_ERROR_CHECK(mpu6050_clear_int(I2C_NUM_0));
            vTaskDelay(pdMS_TO_TICKS(20));
        }
    }

    ESP_ERROR_CHECK(gpio_hold_en(MOSFET1));
    ESP_ERROR_CHECK(gpio_hold_en(MOSFET2));
    ESP_ERROR_CHECK(gpio_hold_en(MOSFET3));
    ESP_ERROR_CHECK(gpio_hold_en(MOSFET4));
    gpio_deep_sleep_hold_en();

    ESP_ERROR_CHECK(esp_sleep_enable_ext0_wakeup((gpio_num_t)WAKEUP_GPIO, WAKEUP_LEVEL));
    ESP_LOGI("SLEEP", "Entrando en deep sleep; GPIO%d despertara por movimiento.", WAKEUP_GPIO);
    vTaskDelay(pdMS_TO_TICKS(100));
    esp_deep_sleep_start();
}
#endif

/* ============================================================
 *  sensor_task  — lee todos los sensores y empuja un paquete a la cola
 * ============================================================ */
static void sensor_task(void *pvParameters)
{
#if SEND_EVERYTIME
    TickType_t last_wake = xTaskGetTickCount();
    const TickType_t period = pdMS_TO_TICKS(SENSOR_PERIOD_MS);
#endif

    do {
        ESP_LOGI("SENSOR", "Leyendo todos los sensores...");
        read_gps();
        read_mpu6050();
        read_mlx90614();
        read_lm35();

        internal_temp();

        lora_msg_t msg = {
            .id_collar   = 122,
            .temperatura = temp_interna,
            .latitud     = (int32_t)(lat_signed * 1000000.0),
            .longitud    = (int32_t)(lon_signed * 1000000.0),
        };

        TickType_t queue_wait =
#if SEND_EVERYTIME
            pdMS_TO_TICKS(50);
#else
            portMAX_DELAY;
#endif
        if (xQueueSend(lora_queue, &msg, queue_wait) != pdTRUE) {
            ESP_LOGW("SENSOR", "Cola llena, muestra descartada");
        }

#if SEND_EVERYTIME
        vTaskDelayUntil(&last_wake, period);   // muestreo periódico sin deriva
#endif
    } while (SEND_EVERYTIME);

#if !SEND_EVERYTIME
    vTaskDelete(NULL);
#endif
}

/* ============================================================
 *  lora_task  — se bloquea en la cola, transmite cuando llega dato
 * ============================================================ */
static void lora_task(void *pvParameters)
{
    lora_msg_t msg;
    while (1) {
        if (xQueueReceive(lora_queue, &msg, portMAX_DELAY) == pdTRUE) {
            payload_t paquete = {
                .id_collar   = msg.id_collar,
                .temperatura = msg.temperatura,
                .latitud     = msg.latitud,
                .longitud    = msg.longitud,
            };
            ESP_LOGI("LORA", "Transmitiendo paquete...");
            transmitir_datos(&paquete);
#if !SEND_EVERYTIME
            enter_motion_deep_sleep();
#endif
        }
    }
}

/* ============================================================
 *  power_task  — temporizador independiente de mosfet / switch de batería
 * ============================================================ */
#if SEND_EVERYTIME
static void power_task(void *pvParameters)
{
    while (1) {
        ESP_LOGI("POWER", "Evaluando switch de baterías...");
        hora_actual();                     // bloquea ~1 s si hay switch
        vTaskDelay(pdMS_TO_TICKS(POWER_PERIOD_MS));
    }
}
#endif

/* ============================================================
 *  freertos_init — inicializa hardware una vez, luego crea las tareas
 * ============================================================ */
void freertos_init(void)
{
    ESP_LOGI("MAIN", "Inicializando hardware...");
    
    init_mosfet_gpios();
    aplica_estado_mosfet();
    gps_starting();
    init_i2c();
    ESP_ERROR_CHECK(mpu6050_init(I2C_NUM_0));
    lm35_init();
    lora_init();
    hora_actual();

    ESP_LOGI("MAIN", "Inicializando FREERTOS TASK AND QUEUE...");
    lora_queue = xQueueCreate(LORA_QUEUE_LEN, sizeof(lora_msg_t));
    ESP_ERROR_CHECK(lora_queue != NULL ? ESP_OK : ESP_ERR_NO_MEM);

    BaseType_t task_status = xTaskCreate(sensor_task, "sensor", 4096, NULL, 5, NULL);
    ESP_ERROR_CHECK(task_status == pdPASS ? ESP_OK : ESP_ERR_NO_MEM);
    task_status = xTaskCreate(lora_task, "lora", 4096, NULL, 4, NULL);
    ESP_ERROR_CHECK(task_status == pdPASS ? ESP_OK : ESP_ERR_NO_MEM);
#if SEND_EVERYTIME
    task_status = xTaskCreate(power_task, "power", 2048, NULL, 2, NULL);
    ESP_ERROR_CHECK(task_status == pdPASS ? ESP_OK : ESP_ERR_NO_MEM);
#endif
}
#endif

// MAIN
void app_main(void)
{   

    #if FREERTOS_IMPLEMENTATION
        #if !SEND_EVERYTIME
        ESP_LOGI("MAIN", "Wake-up cause: %d", esp_sleep_get_wakeup_cause());
        #endif
        freertos_init();
        while(1) {
            vTaskDelay(pdMS_TO_TICKS(1000));
        }
#else

    #if !SEND_EVERYTIME
    ESP_LOGI("MAIN","Comenzando los procesos principales");
    esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();

    // Despierto por razones que no son Wake-On-Motion (Primer arranque / Reset)
    if (cause != ESP_SLEEP_WAKEUP_EXT0) { 
        ESP_LOGI("MAIN_fwu","Primer arranque, inicializando buses.");
        init_i2c(); 
        mpu6050_init(I2C_NUM_0);
        mpu6050_enable_wom(I2C_NUM_0, MPU6050_THRESHOLD); 
        mpu6050_clear_int(I2C_NUM_0);

        ESP_LOGI("MAIN_fwu","Inicio y congelo los mosfets.");
        init_mosfet_gpios();
        hora_actual();
        
        gpio_hold_en(MOSFET1);
        gpio_hold_en(MOSFET2);
        gpio_hold_en(MOSFET3);
        gpio_hold_en(MOSFET4);
        gpio_deep_sleep_hold_en(); // <--- OBLIGATORIO PARA DEEP SLEEP

        while(gpio_get_level(WAKEUP_GPIO) == 1) {
            vTaskDelay(pdMS_TO_TICKS(10));
        }
        
        ESP_LOGI("MAIN_fwu","Preparo interrupción.");
        esp_sleep_enable_ext0_wakeup(WAKEUP_GPIO, WAKEUP_LEVEL); 
        
        ESP_LOGI("MAIN_fwu","Entrando en deep sleep...");
        vTaskDelay(pdMS_TO_TICKS(100));
        
        esp_deep_sleep_start(); 
        return;
    }
  
    // Despierto de Deep Sleep por movimiento (EXT0)
    xTaskCreate(sensar_enviar, "sensar_enviar_task", 4096, NULL, 5, NULL);    

    #endif
    #if SEND_EVERYTIME  

    //Función utilizada para probar el sistema sin Deep-Sleep
    ESP_LOGI("Inicializacion","Iniciando buses y perifericos.");
    init_mosfet_gpios();
    aplica_estado_mosfet();
    vTaskDelay(pdMS_TO_TICKS(50));

    gps_starting();
    init_i2c();
    mpu6050_init(I2C_NUM_0);
    lm35_init();
    lora_init();

    while(1) {

        ESP_LOGI("Lectura","Leyendo todos los sensores...");
        read_gps();
        read_mpu6050();
        read_mlx90614();
        read_lm35();
        internal_temp();

        ESP_LOGI("LoRa","Empaquetando y enviando...");
        payload_t paquete;
        paquete.id_collar = 122;
        paquete.temperatura = temp_interna;
        paquete.latitud = (int32_t)(lat_signed * 1000000.0);
        paquete.longitud = (int32_t)(lon_signed * 1000000.0);

        transmitir_datos(&paquete);

        vTaskDelay(pdMS_TO_TICKS(300));

        // Evalúa y aplica el cambio de batería
        ESP_LOGI("Energía","Analizando estado de switcheo.");
        hora_actual();

        // DIAGNÓSTICO: ¿la radio sigue viva después de switchear los MOSFETs?
        ESP_LOGW("LoRaDiag","Version 0x42 post-MOSFET: 0x%02X", lora_version());

        vTaskDelay(pdMS_TO_TICKS(5000));
    }
    #endif

#endif
}