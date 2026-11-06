// RTOS VERSION
// DEPENDENCIAS
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

// PARAMETROS RTOS
#define SENSOR_PERIOD_MS   5000   // cada cuánto muestrear
#define POWER_PERIOD_MS    60000  // cada cuánto revisar el temporizador del mosfet
#define LORA_QUEUE_LEN     4      // paquetes en buffer

static QueueHandle_t lora_queue = NULL;