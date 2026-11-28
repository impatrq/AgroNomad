# Firmware

Esta carpeta contiene el software utilizado por los dos dispositivos principales de AgroNomad:

- **AgroNeck:** collar inteligente montado sobre el animal.
- **AgroBot:** estación fija que recibe, procesa, almacena y muestra la telemetría.

El firmware está dividido según el entorno de ejecución de cada dispositivo. El AgroNeck usa un ESP32 con ESP-IDF, mientras que el AgroBot usa una Raspberry Pi con Linux, programas C para LoRa, un backend Node.js, PostgreSQL/PostGIS y una interfaz React.

```text
firmware/
├── AgroNeck/                  # Firmware del collar
└── AgroBot/                   # Receptor, backend y frontend
```

## Flujo general

```text
Sensores del AgroNeck
        |
        v
ESP32 + buses I2C/UART/SPI
        |
        v
SX1278 por LoRa a 433 MHz
        |
        v
AgroBot: SX1278 recibido por SPI
        |
        v
JSON por TCP
        |
        v
Node.js + PostgreSQL/PostGIS
        |
        v
API REST + WebSocket + React/Leaflet
```

El collar crea un paquete binario fijo de 14 bytes. Contiene el identificador del collar, la temperatura como `float` y la latitud/longitud como enteros con seis decimales. El receptor LoRa de la Raspberry convierte ese paquete a JSON y lo entrega al backend TCP.

---

# AgroNeck

El firmware de [`AgroNeck/`](AgroNeck/) se compila para el ESP32 con el entorno ESP-IDF. Está organizado en componentes independientes para facilitar el mantenimiento de sensores, GPS y radio.

```text
AgroNeck/
├── main/
│   ├── main.c                 # Inicialización, tareas y modos de ejecución
│   └── MAIN_CODE_GUIDE.md     # Guía detallada del programa principal
├── components/
│   ├── gps/                   # Lectura del módulo GPS NEO-6MV2
│   ├── lm35/                  # Lectura del sensor LM35
│   ├── lora/                  # Control directo del SX1278
│   └── mpumlx/                # MPU6050 y MLX90614
└── CMakeLists.txt
```

## Tecnologías utilizadas

| Tecnología | Uso y motivo |
|---|---|
| **ESP-IDF** | Framework oficial de Espressif para construir, configurar y ejecutar el firmware del ESP32. |
| **C** | Permite controlar periféricos y recursos del microcontrolador con bajo consumo. |
| **FreeRTOS** | Separa la lectura de sensores, la transmisión LoRa y la administración de energía. |
| **I2C** | Conecta sensores como MPU6050 y MLX90614 mediante dos líneas compartidas. |
| **UART** | Recibe las tramas NMEA emitidas por el módulo GPS NEO-6MV2. |
| **SPI** | Comunica el ESP32 con el módulo LoRa SX1278. |
| **LoRa / SX1278** | Envía telemetría a larga distancia con bajo consumo. El sistema está configurado para 433 MHz. |
| **Deep sleep** | Reduce el consumo de energía cuando el collar no necesita transmitir continuamente. |
| **Wake-on-Motion** | Permite despertar el ESP32 desde el MPU6050 ante movimiento detectado. |
| **RTC_DATA_ATTR** | Conserva variables de conmutación de baterías mientras el ESP32 permanece en deep sleep. |

## Sensores y periféricos

### GPS NEO-6MV2

El componente [`components/gps/`](AgroNeck/components/gps/) inicializa y lee datos de posición mediante NMEA. El firmware obtiene latitud, longitud y velocidad y convierte los hemisferios norte/sur y este/oeste a valores con signo para el payload.

### MPU6050

El componente [`components/mpumlx/`](AgroNeck/components/mpumlx/) incluye el acceso al acelerómetro y giroscopio. Sus principales usos son:

- Leer aceleración y movimiento.
- Detectar actividad mediante wake-on-motion.
- Generar una interrupción hacia el GPIO27 del ESP32 para salir del deep sleep.
- Mantener el evento de movimiento operativo mientras se controla el modo de bajo consumo.

### MLX90614

El MLX90614 mide la temperatura infrarroja del objetivo mediante I2C. El firmware registra su temperatura de objeto y la utiliza junto con el LM35 para estimar la temperatura interna.

### LM35

El componente [`components/lm35/`](AgroNeck/components/lm35/) lee una tensión analógica desde el GPIO34 y la transforma en temperatura ambiental. Esta lectura ayuda a calcular una estimación de temperatura interna junto con el MLX90614.

## Procesamiento de datos

En cada ciclo se realizan estos pasos:

1. Inicializar los buses I2C, UART y SPI.
2. Leer latitud y longitud.
3. Leer aceleración y movimiento.
4. Leer las temperaturas MLX90614 y LM35.
5. Calcular la temperatura interna estimada.
6. Escalar las coordenadas multiplicándolas por `1.000.000`.
7. Construir el payload de 14 bytes.
8. Transmitir el payload mediante el SX1278.

La estructura principal usa:

```c
typedef struct __attribute__((packed)) {
    uint16_t id_collar;
    float temperatura;
    int32_t latitud;
    int32_t longitud;
} payload_t;
```

El paquete está empaquetado sin relleno para que la longitud sea compatible con el receptor.

## Comunicación LoRa

El componente [`components/lora/`](AgroNeck/components/lora/) accede directamente a los registros del SX1278 mediante SPI.

Responsabilidades principales:

- Inicializar los pines CS y reset.
- Configurar el chip en modo LoRa.
- Seleccionar 433 MHz.
- Escribir el payload en la FIFO.
- Iniciar la transmisión.
- Esperar la interrupción `TxDone`.
- Leer la versión del chip y generar diagnósticos.
- Reconfigurar la radio si el primer intento falla y realizar un reintento.

Cada intento utiliza un timeout real para evitar quedarse esperando por una transmisión que no finaliza.

## FreeRTOS y modos de ejecución

El firmware posee dos flags independientes al inicio de [`main/main.c`](AgroNeck/main/main.c):

- `FREERTOS_IMPLEMENTATION`: habilita las tareas de FreeRTOS.
- `SEND_EVERYTIME`: habilita muestreo periódico o el ciclo de una lectura y deep sleep.

### Configuración periódica

Con `SEND_EVERYTIME=1`, el firmware ejecuta:

- **sensor_task:** lee sensores y calcula un paquete.
- **lora_task:** recibe paquetes desde una cola y los transmite.
- **power_task:** evalúa periódicamente la conmutación de baterías.

La cola desacopla la lectura de datos de la radio. Si la cola se llena, el nuevo muestreo puede descartarse sin bloquear por completo a los sensores.

### Configuración wake-on-motion

Con `SEND_EVERYTIME=0`, el collar realiza una sola lectura después de despertar por movimiento y luego vuelve a dormir. Esta versión busca reducir el consumo y transmitir únicamente ante actividad relevante.

El flujo configurado es:

1. Inicializar el hardware.
2. Leer sensores y transmitir una muestra.
3. Configurar el MPU6050 en wake-on-motion.
4. Limpiar su interrupción.
5. Configurar el GPIO27 como origen EXT0.
6. Entrar en deep sleep.
7. Reiniciar el ciclo al detectar movimiento.

El pin GPIO27 debe permanecer conectado a la salida INT del MPU6050 y ser compatible con el modo RTC para el modelo de ESP32 utilizado.

## Administración de energía

El código alterna dos combinaciones de MOSFET para cambiar la fuente de alimentación. El estado es persistente durante el deep sleep mediante variables `RTC_DATA_ATTR`; no persiste si se pierde por completo la alimentación.

`MOSFET_SWITCH_ENABLED` permite desactivar temporalmente la conmutación durante pruebas. Después de cambiar baterías, el firmware reinicializa la radio para restablecer su comunicación.

## Compilación del AgroNeck

Desde `firmware/AgroNeck`:

```bash
idf.py set-target esp32
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

Reemplazar `/dev/ttyUSB0` por el puerto serie real de la ESP32.

---

# AgroBot

La carpeta [`AgroBot/`](AgroBot/) contiene la estación fija de recepción. Está formada por tres bloques:

| Bloque | Tecnología | Responsabilidad |
|---|---|---|
| `firmware/` | C y CMake | Recibir paquetes LoRa en Linux y enviarlos al backend. |
| `server/` | Node.js, Express, PostgreSQL, PostGIS y WebSocket | Procesar telemetría, exponer API y publicar actualizaciones. |
| `client/` | React, Vite, Tailwind CSS y Leaflet | Mostrar animales, campos y posiciones en un mapa. |

## Receptor LoRa

El ejecutable [`agrobot-lora-receiver`](AgroBot/firmware/lora_receiver.c) se ejecuta en la Raspberry Pi.

### Por qué utiliza Linux/SPI

La Raspberry no ejecuta ESP-IDF. El programa accede al SX1278 a través de los dispositivos estándar de Linux:

- `/dev/spidev0.0` para comunicación SPI.
- `/dev/gpiochip0` para reset y DIO0.
- GPIO24 como evento de recepción.
- GPIO25 como línea de reset.

La radio recibe interrupciones de nivel mediante `poll()`. Al ocurrir un `DIO0`, el receptor verifica RxDone, valida CRC y longitud, obtiene la FIFO y convierte los 14 bytes al payload estructurado.

### Conversión a JSON

Las coordenadas se almacenan en el collar como enteros con seis decimales. El receptor las divide por `1.000.000` y genera JSON, por ejemplo:

```json
{"ID":"COLLAR-122","LAT":-34.707652,"LONG":-58.242300,"TEMP":"38.40"}
```

El receptor puede agregar:

- `RSSI`: potencia recibida.
- `SNR`: relación señal/ruido.
- `GW`: identificador del gateway.
- `KEY`: clave de identificación configurada.

Las variables `TELEMETRY_TARGETS`, `GATEWAY_ID` y `TELEMETRY_KEY` permiten configurar destinos y metadatos sin modificar el código.

### Envío al backend

El receptor usa sockets TCP para evitar pérdida de datos ante desconexiones temporales. Puede reenviar una misma lectura a varios backends definidos en `TELEMETRY_TARGETS`; si un destino no responde, no interrumpe los demás.

## Simuladores

Dentro de [`AgroBot/firmware/`](AgroBot/firmware/) existen programas auxiliares:

- `lora_simulator.c`: genera lecturas o usa datos configurables sin necesidad de radio.
- `lora_receiver_all.c`: ejemplo alternativo de recepción.
- `main.c`: cliente TCP que permite probar backend y frontend sin hardware LoRa.

Estos programas permiten validar la comunicación y el dashboard antes de tener el collar o la estación montados físicamente.

## Backend

El backend de [`AgroBot/server/`](AgroBot/server/) usa Node.js y Express.

### Tecnologías

| Tecnología | Uso y motivo |
|---|---|
| **Node.js** | Ejecuta el servidor en la Raspberry y gestiona sockets, API y base de datos. |
| **TCP net** | Recibe telemetría directamente desde el receptor y otros clientes. |
| **Express** | Expone las rutas REST del sistema. |
| **PostgreSQL** | Conserva animales, dispositivos, campos e historial de posiciones. |
| **PostGIS** | Representa posiciones geográficas y polígonos con SRID 4326. |
| **WebSocket** | Envía lecturas nuevas al frontend sin refrescar la página. |
| **CORS** | Permite consultar la API desde el frontend de desarrollo. |

### Puerto y flujo

- Puerto `4001`: recibe JSON por TCP.
- Puerto `4000`: expone la API HTTP.
- Puerto configurado por Vite: sirve el dashboard React.

Al recibir una telemetría, el backend:

1. Extrae objetos JSON completos del buffer TCP.
2. Normaliza el identificador, coordenadas y temperatura.
3. Busca o crea el animal y su dispositivo.
4. Guarda una posición geográfica con PostGIS.
5. Actualiza la relación animal/dispositivo.
6. Notifica a los clientes WebSocket.

## Base de datos

El esquema de [`server/db/schema.sql`](AgroBot/server/db/schema.sql) utiliza tablas para usuarios, campos, animales, dispositivos, asociaciones, posiciones y estadísticas diarias.

Las principales relaciones son:

- Un usuario posee campos y animales.
- Un animal puede tener varios dispositivos asociados a lo largo del tiempo.
- Cada lectura genera una posición GPS vinculada al animal y al dispositivo.
- Las posiciones se guardan como puntos geográficos con longitud y latitud.
- Los límites de campo se guardan como polígonos PostGIS.

PostGIS permite trabajar con coordenadas reales y realizar futuras consultas espaciales como distancias, cercamientos o posiciones dentro de un campo.

## Frontend

El frontend de [`AgroBot/client/`](AgroBot/client/) presenta los datos recibidos.

| Tecnología | Uso |
|---|---|
| **React** | Componentes y estado del dashboard. |
| **Vite** | Desarrollo y compilación del cliente. |
| **Tailwind CSS** | Maquetación responsiva y estilos. |
| **React Leaflet** | Visualización de mapas y marcadores. |
| **Leaflet** | Dibujado de animales, polilíneas y límites. |
| **WebSocket** | Actualización en tiempo real de nuevas lecturas. |

Las vistas incluyen dashboard principal, configuración de campos, configuración de usuario e historial de animales. Las funciones reales disponibles deben verificarse contra el estado actual de cada componente, ya que algunas interfaces pueden encontrarse en desarrollo.

## Compilación del receptor

Desde `firmware/AgroBot/firmware`:

```bash
cmake -S . -B build
cmake --build build -j2
```

Ejecutables:

```text
agrobot-lora-receiver  Recibe telemetría real por SX1278/SPI.
agro-neck-client       Simula collares y envía JSON por TCP.
agrobot-lora-simulator Simula paquetes LoRa en Linux.
```

## Ejecución del sistema completo

En la Raspberry:

```bash
sudo systemctl enable --now postgresql

cd firmware/AgroBot/server
npm install
npm run dev

cd ../firmware
sudo ./build/agrobot-lora-receiver

cd ../client
npm install
npm run dev -- --host 0.0.0.0
```

Para detalles de instalación, variables de entorno y preparación de hardware, consultar [`AgroBot/Setup.md`](AgroBot/Setup.md).