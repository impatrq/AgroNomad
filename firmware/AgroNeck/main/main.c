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

