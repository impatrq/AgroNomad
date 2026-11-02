# AgroNomad - Ejemplo de Firmware

Esta carpeta contiene un simulador TCP para pruebas de escritorio y un receptor LoRa para la Raspberry Pi Zero 2 W del AgroBot. El receptor usa el SX1278 de la placa y reenvía la telemetría recibida al backend local.

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

## Receptor LoRa en Raspberry Pi

El receptor inicializa el SX1278 en recepción continua a 915 MHz, detecta `DIO0`, decodifica la estructura binaria de 14 bytes del AgroNeck y envía el resultado como JSON al backend TCP en `127.0.0.1:4001`.

El mapeo del PCB al header de la Raspberry es:

| Señal SX1278 | GPIO BCM | Pin físico |
|---|---:|---:|
| `MOSI` | 10 | 19 |
| `MISO` | 9 | 21 |
| `SCLK` | 11 | 23 |
| `CS` | 8 | 24 |
| `RESET` | 25 | 22 |
| `DIO0` | 24 | 18 |

La imagen de montaje muestra la Raspberry invertida respecto a la orientación real; el mapeo anterior sigue las redes del PCB y no depende de cómo se vea la foto.

Habilitá SPI en Raspberry Pi OS y compilá ambos ejecutables con:

```bash
cd firmware/AgroBot/firmware
cmake -S . -B build
cmake --build build
sudo ./build/agrobot-lora-receiver
```

El backend debe estar levantado en la Raspberry antes del receptor. `sudo` permite acceder a `/dev/spidev0.0` y `/dev/gpiochip0`; también se pueden configurar los grupos/permisos del usuario para evitarlo. El AgroNeck y el AgroBot deben usar la misma frecuencia y configuración LoRa.

### Destinos de la telemetría

El receptor reenvía cada lectura, como una línea JSON por TCP, a todos los destinos de
`TELEMETRY_TARGETS` (hasta 4, separados por coma). Sin la variable usa `127.0.0.1:4001`,
el servidor AgroBot local. `GATEWAY_ID` (opcional) se agrega como `"GW"` para que MooPing
sepa qué gateway recibió el paquete:

```bash
sudo TELEMETRY_TARGETS=127.0.0.1:4001,192.168.1.50:4001 GATEWAY_ID=AGROBOT-01 \
  ./build/agrobot-lora-receiver
```

Si el backend exige clave (`TELEMETRY_API_KEY` en MooPing), pasala con `TELEMETRY_KEY=<clave>`:
viaja en cada JSON como `"KEY"` (solo letras, números, `-`, `_`, `.` o `~`; hasta 64).

`sudo` descarta las variables de entorno, por eso van después de `sudo`. Cada destino es
independiente: si uno no responde, el envío corta a los 2 s y sigue con el siguiente, sin
dejar de escuchar la radio. Además de `ID`, `LAT`, `LONG` y `TEMP`, el JSON lleva `RSSI` y
`SNR` del paquete recibido:

```json
{"ID":"COLLAR-84","LAT":-34.250000,"LONG":-59.430000,"TEMP":"38.60","RSSI":-97,"SNR":7.25,"GW":"AGROBOT-01"}
```

## Compilación y ejecución

Para compilar el simulador TCP:

```bash
gcc main.c -o agro-neck-example
./agro-neck-example
```

Antes de ejecutarlo, el servidor backend debe estar iniciado y escuchando en el puerto TCP configurado.