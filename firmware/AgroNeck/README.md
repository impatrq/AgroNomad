> AgroNomad 2026

# AgroNeckCode

Código del AgroNeck para la ESP32. Incluye librerías para:

- SX1278 - NEO6M - MPU6050 - MLX90614 - LM35

## Funcionando:

- Comunicacion con MPU6050(Aceletometro y giroscopo) y MLX90614(Sensor Temp. Interna).

- Lectura Sensor LM35

- Comunicacion GPS.

- Comunicacion LoRA.

- Switcheo de Mosfets entre carga y alimentacion.


## Pendientes:

- Probar Implementacion del FreeRtos tanto en modo de envio de datos constante como en envio por wakeup due to movement(interrupt).

- Buscar un metodo de encriptacion para enviar la informacion de forma segura.

- Implementar otro metodo de `wakeup` del deep-sleep por temporizador(timer).

### Implementacion de FreeRtos

- Crear 3 tareas sensor_handle(sensor_task), lora_handle(), power_handle para medir stack.

- `sensor_task:` lee todos los sensores y empuja un paquete a la cola.

- `lora_task:` espera en la cola y transmite cuando llega un paquete.

- `power_task:` evalúa y aplica el switch de baterías de forma independiente

### Implementacion de deep sleep ilimitado

- En el ESP32, cada vez que se llama a esp_deep_sleep_start(), el chip se apaga casi por completo y, al despertar, el programa 
se reinicia desde el principio (como un reset). Por lo tanto, no existe un contador de ciclos que se agote.

1. Añadir el temporizador como fuente de despertar

```
// Dentro de sensar_enviar(), antes de dormir:
const uint64_t SLEEP_INTERVAL_US = 10ULL * 60ULL * 1000000ULL; // 10 minutos
esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);

```

2. Unificar la ruta de ejecución en app_main

- Actualmente, app_main distingue entre “primer arranque” y “despertar por EXT0”. Para un ciclo ilimitado, elimina esa distinción y haz que siempre se cree la tarea sensar_enviar, sin importar la causa del despertar. La propia tarea se encargará de sensar, enviar y volver a dormir.

```
void app_main(void)
{
#if !SEND_EVERYTIME
    // En modo campo, siempre ejecutamos el ciclo de sensado + envío + sleep
    ESP_LOGI("MAIN", "Iniciando ciclo de sensado y envío...");
    xTaskCreate(sensar_enviar, "sensar_enviar_task", 4096, NULL, 5, NULL);
    // (La tarea nunca retorna; termina en esp_deep_sleep_start)
#endif

#if SEND_EVERYTIME
    // ... (modo test sin deep-sleep, sin cambios)
#endif
}

```

3. Asegurar que esp_deep_sleep_start() se llama siempre

- Tu función sensar_enviar ya termina con esp_deep_sleep_start(), así que mientras se ejecute esa tarea, el ciclo se cerrará correctamente. Solo debes verificar que no haya rutas de retorno anticipado (por ejemplo, si transmitir_datos falla y decides no dormir). En el código actual no las hay, pero es buena práctica añadir un bloque finally lógico: pase lo que pase en el sensado, siempre se debe llegar a esp_deep_sleep_start().

### FreeRTOS con Wake-On-Motion

`FREERTOS_IMPLEMENTATION` selecciona la ruta de ejecución y `SEND_EVERYTIME` selecciona el ciclo de envío:

- `FREERTOS_IMPLEMENTATION=1`, `SEND_EVERYTIME=1`: tareas periódicas de sensores, LoRa y energía; no entra en deep sleep.
- `FREERTOS_IMPLEMENTATION=1`, `SEND_EVERYTIME=0`: mide una vez, encola el paquete, espera a que LoRa lo transmita y luego configura el MPU6050 y EXT0 antes de entrar en deep sleep. Un arranque normal o por movimiento ejecuta el mismo ciclo; después del deep sleep el ESP32 reinicia y las tareas se crean de nuevo.
- `FREERTOS_IMPLEMENTATION=0`: conserva la ruta anterior sin FreeRTOS.

En el modo Wake-On-Motion, GPIO27 debe estar conectado a INT del MPU6050 y ser un pin RTC válido para el modelo de ESP32. El MPU debe permanecer alimentado durante el deep sleep. La configuración de `PWR_MGMT_2` mantiene activos los acelerómetros y deja en standby únicamente los giroscopios.
