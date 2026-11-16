# Guía del código de `main.c`

Esta guía describe el flujo principal de la aplicación en [`main.c`](./main.c). Los enlaces indican las funciones o configuraciones relevantes de ese archivo.

## Modos de ejecución

Dos indicadores de compilación seleccionan la ruta de ejecución y el comportamiento de transmisión:

- [`FREERTOS_IMPLEMENTATION`](./main.c#L28) selecciona la ruta basada en tareas de FreeRTOS cuando vale `1`, o la ruta anterior dentro de `app_main()` cuando vale `0`.
- [`SEND_EVERYTIME`](./main.c#L29) selecciona el muestreo y la transmisión periódicos cuando vale `1`, o una sola medición y transmisión seguida de deep sleep con activación por movimiento cuando vale `0`.

Los valores actuales de ambos indicadores son `1`; por lo tanto, la configuración activa ejecuta tareas periódicas de FreeRTOS sin entrar en deep sleep. Para usar el ciclo de activación por movimiento con FreeRTOS, mantén `FREERTOS_IMPLEMENTATION` en `1` y cambia `SEND_EVERYTIME` a `0`.

## Lectura de sensores y cálculo de temperatura

Las funciones auxiliares [`read_gps()`](./main.c#L173), [`read_mpu6050()`](./main.c#L189), [`read_mlx90614()`](./main.c#L201) y [`read_lm35()`](./main.c#L161) leen los módulos conectados y registran sus resultados. `read_gps()` también aplica el signo correspondiente a los hemisferios de latitud y longitud.

[`internal_temp()`](./main.c#L219) calcula la temperatura interna estimada a partir de la temperatura del objeto medida por el MLX90614 y la lectura del LM35, utilizando `H_COEFICIENTE`.

## Flujo de tareas y cola de FreeRTOS

La implementación de FreeRTOS está dentro de la condición de compilación `FREERTOS_IMPLEMENTATION`. [`freertos_init()`](./main.c#L424) inicializa las salidas de los MOSFET y los sensores/radios, crea una cola e inicia las tareas.

- [`sensor_task()`](./main.c#L341) lee los sensores, calcula la temperatura, prepara un mensaje y lo coloca en la cola de LoRa. En modo periódico se repite cada `SENSOR_PERIOD_MS`; en modo de activación por movimiento envía un único mensaje y termina.
- [`lora_task()`](./main.c#L387) espera los mensajes de la cola, convierte cada mensaje al formato del paquete de radio y lo transmite.
- [`power_task()`](./main.c#L411) comprueba si corresponde cambiar el estado de la batería/MOSFET. Solo se crea en el modo periódico.

El mensaje de la cola contiene el ID del collar, la temperatura y la latitud/longitud como enteros escalados. La longitud de la cola y los intervalos de muestreo y alimentación están definidos cerca de las tareas en [`main.c`](./main.c#L292).

## Deep sleep con activación por movimiento

Cuando `SEND_EVERYTIME` vale `0`, la secuencia es:

1. Al iniciar, `app_main()` registra la causa de activación e inicia FreeRTOS ([`app_main()`](./main.c#L453)).
2. `sensor_task()` toma una muestra y la coloca en la cola.
3. `lora_task()` transmite el paquete y luego llama a [`enter_motion_deep_sleep()`](./main.c#L307).
4. La función de suspensión configura la activación por movimiento del MPU6050, configura `WAKEUP_GPIO` como entrada RTC, limpia la interrupción del MPU, espera a que se desactive si ya estaba activa, mantiene las salidas de los MOSFET y habilita la activación EXT0 antes de llamar a `esp_deep_sleep_start()`.
5. El movimiento detectado por el pin de interrupción del MPU6050 activa el ESP32. Al salir del deep sleep, la aplicación se reinicia; en el nuevo arranque se vuelven a crear las tareas de FreeRTOS y la cola.

[`WAKEUP_GPIO`](./main.c#L24) corresponde a GPIO27 y el nivel configurado para la activación es alto. Verifica que este pin admita RTC en el modelo de ESP32 utilizado, que la señal INT del MPU6050 esté conectada a él y que el MPU6050 permanezca alimentado durante el deep sleep.

## Estado y persistencia de los MOSFET

[`aplica_estado_mosfet()`](./main.c#L71) aplica una de las dos combinaciones de salidas de los MOSFET. [`hora_actual()`](./main.c#L127) compara la hora actual con la del último cambio de batería y alterna la combinación cuando transcurre `TIEMPO_CAMBIO_BATS`.

El estado de los MOSFET y los datos del último cambio utilizan variables `RTC_DATA_ATTR` ([`main.c`](./main.c#L48)), que conservan sus valores entre activaciones desde deep sleep. No persisten si se corta completamente la alimentación.

## Ruta anterior sin FreeRTOS

Cuando `FREERTOS_IMPLEMENTATION` vale `0`, `app_main()` utiliza el código situado debajo de la rama de FreeRTOS. En esa ruta, `SEND_EVERYTIME=1` ejecuta un ciclo continuo de lectura y transmisión; `SEND_EVERYTIME=0` utiliza el flujo anterior de inicio/activación y la tarea [`sensar_enviar()`](./main.c#L225). Esta ruta es independiente de la secuencia de activación por movimiento de FreeRTOS.
