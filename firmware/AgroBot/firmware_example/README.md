# AgroNomad - Ejemplo de Firmware

Esta carpeta contiene un ejemplo en C que simula el comportamiento de un AgroNeck conectado al backend. El programa crea una conexión TCP, arma mensajes con la información del collar y los envía al servidor de telemetría.

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

## Funcionamiento de `main.c`

1. Abre un socket TCP usando la IP y el puerto configurados.
2. Se conecta al servidor de telemetría del backend.
3. Envía datos de ejemplo de `COLLAR-01` y `COLLAR-02`.
4. Cada cinco segundos vuelve a enviar una lectura de `COLLAR-01`.
5. Si el envío falla, cierra el socket e intenta conectarse nuevamente.

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

## Integración con AgroNeck reales

En el firmware definitivo, los datos fijos de `main()` deberían reemplazarse por funciones que:

- Reciban los mensajes provenientes de LoRa u otro sistema de comunicación.
- Lean la temperatura desde el sensor correspondiente.
- Obtengan la ubicación desde el módulo GPS.
- Utilicen el ID único almacenado en el dispositivo.
- Informen las versiones reales del hardware y firmware.
- Envíen cada lectura con la frecuencia necesaria para el seguimiento.

El backend recibe estos datos por TCP en el puerto `4001`, los valida y los almacena en PostgreSQL/PostGIS. Luego el frontend puede consultar la última posición y temperatura de cada animal.

## Compilación y ejecución

El archivo `CMakeLists.txt` está reservado para configurar la compilación del ejemplo. Como alternativa, en un sistema Linux se puede compilar directamente con:

```bash
gcc main.c -o agro-neck-example
./agro-neck-example
```

Antes de ejecutarlo, el servidor backend debe estar iniciado y escuchando en el puerto TCP configurado.

## Limitaciones actuales

- Los datos GPS y la temperatura son valores de prueba.
- Solo se envía periódicamente la información de `COLLAR-01` después del envío inicial.
- No existe todavía una integración real con sensores, GPS o LoRa.
- El programa está pensado como referencia para desarrollar el firmware que utilizarán los AgroNeck.
