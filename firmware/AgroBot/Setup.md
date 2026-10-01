# AgroBot: instalación y prueba completa

Esta guía cubre la Raspberry Pi Zero 2 W, la placa AgroBot con SX1278, el backend, la base PostgreSQL/PostGIS, el frontend y el AgroNeck transmisor.

## Antes de empezar

- Raspberry Pi OS Lite de 64 bits con acceso a la red local.
- Node.js 24 o superior y npm instalados en la Pi.
- PostgreSQL con PostGIS, CMake y GCC instalados en la Pi.
- ESP-IDF configurado en la computadora que se use para compilar y flashear el AgroNeck.

Para preparar por primera vez el sistema operativo, Node.js y PostgreSQL, seguí también [RequirementsPI.md](RequirementsPI.md). El receptor del AgroBot es un programa Linux y no necesita ESP-IDF; los comandos `idf.py` de esta guía son solo para el AgroNeck.

## 1. Habilitar SPI en Raspberry Pi OS

Ejecutá:

```bash
sudo raspi-config
```

Seleccioná **Interface Options → SPI → Enable** y reiniciá:

```bash
sudo reboot
```

Después del reinicio, comprobá que estén presentes los dispositivos de SPI y GPIO:

```bash
ls -l /dev/spidev0.0 /dev/gpiochip0
```

Si falta `/dev/spidev0.0`, volvé a habilitar SPI y reiniciá antes de continuar.

## 2. Preparar PostgreSQL y PostGIS

PostgreSQL y la extensión PostGIS deben estar instalados. Iniciá PostgreSQL:

```bash
sudo systemctl enable --now postgresql
```

Si la base y el usuario todavía no existen, crealos una sola vez:

```bash
sudo -u postgres createuser --pwprompt agronomad
sudo -u postgres createdb --owner=agronomad agronomad
sudo -u postgres psql -d agronomad -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
```

Editá `firmware/AgroBot/server/.env` para que la conexión apunte a `localhost:5432`, base `agronomad`, usuario `agronomad` y la contraseña configurada. El código prioriza `DATABASE_URL` si está definido; actualizá ese valor, o quitálo para usar las variables `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`. No publiques credenciales.

Comprobá PostGIS:

```bash
sudo -u postgres psql -d agronomad -c 'SELECT PostGIS_Version();'
```

## 3. Compilar los programas de AgroBot

Desde la raíz del repositorio:

```bash
cd firmware/AgroBot/firmware
cmake -S . -B build
cmake --build build -j2
```

Se generan dos ejecutables: `build/agrobot-lora-receiver`, para recibir LoRa en la Raspberry, y `build/agro-neck-client`, el simulador TCP para pruebas sin radio.

Si actualizaste el código en otra computadora, copiá esos cambios a la Raspberry antes de compilar. Podés confirmar la configuración del receptor con:

```bash
grep -nE '0x06|0x07|Listening for' lora_receiver.c
```

Para 433 MHz debe mostrar `0x6C`, `0x40` y `433 MHz`. Después recompilá:

```bash
cmake --build build --clean-first -j2
```

## 4. Arrancar el backend

En una terminal de la Raspberry:

```bash
cd firmware/AgroBot/server
npm install
npm run dev
```

El backend inicializa el esquema y carga datos de demostración al conectarse a la base. Esperá los mensajes:

```text
HTTP server listening on port 4000
TCP telemetry server listening on port 4001
```

En otra terminal, probá la API:

```bash
curl -fsS http://127.0.0.1:4000/api/status
```

La respuesta debe indicar `"status":"ok"`. Dejá el backend corriendo.

## 5. Arrancar el receptor LoRa

En otra terminal, con la placa conectada y el backend activo:

```bash
cd firmware/AgroBot/firmware
sudo ./build/agrobot-lora-receiver
```

Debería mostrar la versión del SX1278 y luego:

```text
Listening for AgroNeck LoRa packets at 433 MHz
```

Dejá el receptor corriendo antes de encender o despertar el AgroNeck. `sudo` permite abrir `/dev/spidev0.0` y solicitar las líneas GPIO.

## 6. Flashear y despertar el AgroNeck

En una computadora con ESP-IDF configurado y la ESP32 del collar conectada por USB:

```bash
cd firmware/AgroNeck
idf.py set-target esp32
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

Reemplazá `/dev/ttyUSB0` por el puerto serie real. El primer arranque del firmware configura la interrupción de movimiento y entra en deep sleep. Con el receptor LoRa ya corriendo, mové el collar para despertarlo y provocar la lectura/transmisión. La radio se inicializa antes de transmitir; ambos módulos están configurados para 433 MHz.

Al recibir una trama, la terminal del receptor debe mostrar `collar=122`, temperatura y coordenadas. La terminal del backend debe indicar que procesó el payload. El receptor decodifica los 14 bytes, los convierte a JSON y los envía por TCP a `127.0.0.1:4001`.

## 7. Abrir el frontend

Obtené la IP de la Raspberry:

```bash
hostname -I
```

En una nueva terminal de la Pi:

```bash
cd firmware/AgroBot/client
npm install
export VITE_API_BASE_URL=http://192.168.1.50:4000
npm run dev -- --host 0.0.0.0
```

Reemplazá `192.168.1.50` por la IP real de la Pi. Abrí desde un dispositivo conectado a la misma red la URL que muestre Vite, normalmente `http://192.168.1.50:5173`. El frontend usa esa dirección para la API y el WebSocket.

Después de la primera trama, el backend crea o actualiza el animal asociado al collar y el frontend debe mostrar su posición en el mapa.

## Orden de arranque

1. Habilitar SPI y confirmar `/dev/spidev0.0`.
2. Iniciar PostgreSQL y comprobar `.env`.
3. Compilar los ejecutables de AgroBot.
4. Arrancar el backend y comprobar `/api/status`.
5. Arrancar `agrobot-lora-receiver`.
6. Flashear o despertar el AgroNeck y comprobar la trama en las terminales.
7. Arrancar Vite y abrir el frontend desde la red local.

Para probar solo backend y frontend sin radio, ejecutá `sudo ./build/agro-neck-client` en lugar del receptor LoRa; ese cliente envía ubicaciones ficticias.