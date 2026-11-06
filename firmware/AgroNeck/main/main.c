// RTOS VERSION
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

#include "lora.h"       // Librería para el módulo LoRa
#include "neo6m.h"      // Librería para el módulo GPS NEO-6MV2
#include "mpumlx.h"     // Librería para el sensor de movimiento MPU6050
#include "lm35.h"       // Librería para el sensor de temperatura LM35