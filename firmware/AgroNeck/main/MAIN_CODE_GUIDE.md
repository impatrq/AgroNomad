# `main.c` Code Guide

This guide describes the main application flow in [`main.c`](./main.c). The referenced line links point to the relevant functions or configuration in that file.

## Runtime modes

Two compile-time flags select the execution path and transmission behavior:

- [`FREERTOS_IMPLEMENTATION`](./main.c#L28) selects the FreeRTOS task-based path when `1`, or the legacy path in `app_main()` when `0`.
- [`SEND_EVERYTIME`](./main.c#L29) selects periodic sampling/transmission when `1`, or one sample and transmission followed by motion-triggered deep sleep when `0`.

The current defaults are both `1`, so the active configuration runs periodic FreeRTOS tasks without deep sleep. To use the FreeRTOS motion-wake cycle, keep `FREERTOS_IMPLEMENTATION` at `1` and set `SEND_EVERYTIME` to `0`.

## Sensor readings and temperature estimate

The sensor helpers [`read_gps()`](./main.c#L173), [`read_mpu6050()`](./main.c#L189), [`read_mlx90614()`](./main.c#L201), and [`read_lm35()`](./main.c#L161) read the connected modules and log their results. `read_gps()` also applies the latitude and longitude hemisphere signs.

[`internal_temp()`](./main.c#L219) calculates the estimated internal temperature from the MLX90614 object temperature and LM35 reading, using `H_COEFICIENTE`.

## FreeRTOS task and queue flow

The FreeRTOS implementation is grouped under the `FREERTOS_IMPLEMENTATION` compile-time guard. [`freertos_init()`](./main.c#L424) initializes the MOSFET outputs and sensors/radios, creates a queue, and starts the tasks.

- [`sensor_task()`](./main.c#L341) reads the sensors, calculates the temperature, builds a message, and places it on the LoRa queue. In periodic mode it repeats at `SENSOR_PERIOD_MS`; in motion-wake mode it sends one message and exits.
- [`lora_task()`](./main.c#L387) waits for queued messages, converts each message to the radio payload, and transmits it.
- [`power_task()`](./main.c#L411) checks whether the battery/MOSFET state should change. It is created only in periodic mode.

The queue message contains the collar ID, temperature, and scaled integer latitude/longitude. The queue length and sampling/power intervals are defined near the task implementations at [`main.c`](./main.c#L292).

## Motion-triggered deep sleep

When `SEND_EVERYTIME` is `0`, the task sequence is:

1. On boot, `app_main()` logs the wake-up cause and starts FreeRTOS ([`app_main()`](./main.c#L453)).
2. `sensor_task()` takes one sample and queues it.
3. `lora_task()` transmits the queued data, then calls [`enter_motion_deep_sleep()`](./main.c#L307).
4. The sleep function configures MPU6050 wake-on-motion, configures `WAKEUP_GPIO` for RTC input, clears the MPU interrupt, waits for an already-active interrupt to clear, holds the MOSFET outputs, and enables EXT0 wake before calling `esp_deep_sleep_start()`.
5. Motion on the MPU6050 interrupt pin wakes the ESP32. Deep sleep restarts the application; FreeRTOS tasks and the queue are created again on the next boot.

[`WAKEUP_GPIO`](./main.c#L24) is GPIO27 and the configured wake level is high. Confirm this pin is RTC-capable for the target ESP32 variant, that the MPU6050 INT signal is connected to it, and that the MPU6050 remains powered during deep sleep.

## MOSFET state and persistence

[`aplica_estado_mosfet()`](./main.c#L71) applies one of two MOSFET output combinations. [`hora_actual()`](./main.c#L127) compares the current time with the last battery switch and changes the combination after `TIEMPO_CAMBIO_BATS`.

The MOSFET state and switch-time bookkeeping use `RTC_DATA_ATTR` variables ([`main.c`](./main.c#L48)), which retain their values across deep-sleep wake-ups. They do not persist across a full power loss.

## Legacy non-FreeRTOS path

When `FREERTOS_IMPLEMENTATION` is `0`, `app_main()` uses the code below the FreeRTOS branch. In that path, `SEND_EVERYTIME=1` runs a continuous sensor/transmission loop; `SEND_EVERYTIME=0` uses the older startup/wake flow and the [`sensar_enviar()`](./main.c#L225) task. This path is separate from the FreeRTOS motion-wake sequence.
