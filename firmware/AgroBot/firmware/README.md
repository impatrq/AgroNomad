# AgroNomad - Ejemplo de Firmware

Esta carpeta contiene dos modos de prueba: un simulador que envía JSON por TCP al backend y un firmware ESP-IDF para la placa AgroBot que recibe paquetes LoRa del AgroNeck.

Este código no es todavía el firmware final de los AgroNeck. Los valores utilizados son fijos y representan los datos que, en una implementación real, deberían obtenerse desde los sensores y el receptor de comunicación del dispositivo.

## Información enviada

Cada mensaje representa una lectura de un AgroNeck e incluye:

- `ID`: identificador único del dispositivo.
- `FIRMWARE_VERS`: versión del firmware.
- `HARDWARE_VERS`: versión del hardware.
- `LAT`: latitud GPS.
- `LONG`: longitud GPS.
- `TEMP`: temperatura registrada.

Ejemplo del formato esperado:

```json
{
  "ID": "COLLAR-01",
  "FIRMWARE_VERS": "1.0",
  "HARDWARE_VERS": "1.0",
  "LAT": -34.707652,
  "LONG": -58.242300,
  "TEMP": "38.4"
}
```

## Simulador TCP de escritorio

La compilación GCC habitual conserva el comportamiento de simulación: se conecta al backend por TCP, envía JSON de ejemplo cada cinco segundos e intenta reconectarse si falla.

## Funciones principales

| Función | Responsabilidad |
|---|---|
| `tcp_connect()` | Crea el socket y establece la conexión con el servidor TCP. |
| `tcp_send()` | Garantiza el envío de todos los bytes del mensaje. |
| `send_collar_data()` | Construye el mensaje JSON con los datos del AgroNeck y lo envía. |
| `main()` | Coordina la conexión, los envíos periódicos y la reconexión. |

## Configuración

En `main.c` se encuentran los valores de conexión:

```c
#define SERVER_IP   "127.0.0.1"
#define SERVER_PORT 4001
```

`SERVER_IP` debe apuntar al equipo donde se ejecuta el servidor y `SERVER_PORT` debe coincidir con el puerto TCP configurado en el backend. Para una prueba local, `127.0.0.1:4001` es la configuración predeterminada.

## Receptor LoRa ESP32

El proyecto ESP-IDF está en `esp-idf/`. Su `main.c` inicializa el SX1278 en recepción continua a 915 MHz, espera paquetes y decodifica la estructura binaria definida por el AgroNeck:

- `uint16_t id_collar`
- `float temperatura`
- `int32_t latitud`, escalada por 1.000.000
- `int32_t longitud`, escalada por 1.000.000

Para compilar y ejecutar en la placa ESP32 de AgroBot:

```bash
cd firmware/AgroBot/firmware_example/esp-idf
idf.py set-target esp32
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

El receptor actualmente imprime por consola serie la trama recibida; todavía no la reenvía al backend. El AgroNeck y AgroBot deben usar la misma frecuencia y configuración LoRa.

## Compilación y ejecución

Para compilar el simulador TCP en Linux:

```bash
gcc main.c -o agro-neck-example
./agro-neck-example
```

Antes de ejecutarlo, el servidor backend debe estar iniciado y escuchando en el puerto TCP configurado.

## Limitaciones actuales

- El simulador sigue usando datos GPS y temperatura de prueba.
- El receptor LoRa decodifica e imprime; todavía no convierte la trama a JSON ni la envía al backend.
- Quedan pendientes los problemas conocidos del emisor AgroNeck antes de validar una recepción real de extremo a extremo.
