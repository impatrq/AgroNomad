#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"

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

/* ============================================================
 *  sensor_task  — lee todos los sensores y empuja un paquete
 * ============================================================ */
static void sensor_task(void *pvParameters)
{
    TickType_t last_wake = xTaskGetTickCount();
    const TickType_t period = pdMS_TO_TICKS(SENSOR_PERIOD_MS);

    while (1) {
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

        // No bloqueante: descarta la muestra si la cola está llena
        // en lugar de detener el bucle de adquisición
        if (xQueueSend(lora_queue, &msg, pdMS_TO_TICKS(50)) != pdTRUE) {
            ESP_LOGW("SENSOR", "Cola llena, muestra descartada");
        }

        vTaskDelayUntil(&last_wake, period);   // muestreo periódico sin deriva
    }
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
        }
    }
}

/* ============================================================
 *  power_task  — temporizador independiente de mosfet / switch de batería
 * ============================================================ */
static void power_task(void *pvParameters)
{
    while (1) {
        ESP_LOGI("POWER", "Evaluando switch de baterías...");
        hora_actual();                     // bloquea ~1 s si hay switch
        vTaskDelay(pdMS_TO_TICKS(POWER_PERIOD_MS));
    }
}

/* ============================================================
 *  app_main — inicializa hardware una vez, luego crea las tareas
 * ============================================================ */
void app_main(void)
{
    ESP_LOGI("MAIN", "Inicializando hardware...");
    gps_starting();
    init_i2c();
    mpu6050_init(I2C_NUM_0);
    lm35_init();
    init_mosfet_gpios();
    lora_init();

    lora_queue = xQueueCreate(LORA_QUEUE_LEN, sizeof(lora_msg_t));
    configASSERT(lora_queue);

    xTaskCreate(sensor_task, "sensor", 4096, NULL, 5, NULL);
    xTaskCreate(lora_task,   "lora",   4096, NULL, 4, NULL);
    xTaskCreate(power_task,  "power",  2048, NULL, 2, NULL);
}