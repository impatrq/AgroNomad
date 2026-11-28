# AgroBot: instalación completa en Raspberry Pi

Esta guía permite instalar desde cero el AgroBot en una **Raspberry Pi con Raspberry Pi OS Lite de 64 bits**.

El sistema instalado incluye:

- receptor LoRa SX1278;
- backend HTTP y TCP de Node.js;
- PostgreSQL con la extensión PostGIS;
- dashboard React;
- servidor web Nginx;
- aplicación ESP32 AgroNeck, que se compila y flashea desde una computadora.

## Componentes de la instalación

| Componente | Puerto o servicio | Función |
|---|---:|---|
| Receptor LoRa | `/dev/spidev0.0` | Recibe paquetes del AgroNeck por 433 MHz. |
| Backend TCP | `4001` | Recibe telemetría normalizada desde el receptor. |
| Backend HTTP | `4000` | API REST y WebSocket. |
| PostgreSQL | `5432` | Base de datos geoespacial. |
| Nginx | `80` | Sirve el frontend y reenvía `/api` y `/ws`. |

## Requisitos

En la Raspberry:

- Raspberry Pi OS Lite de 64 bits;
- Raspberry Pi Zero 2 W u otra Raspberry compatible;
- acceso a Internet;
- usuario con permisos `sudo`;
- aproximadamente 4 GB libres para los paquetes y compilaciones;
- placa AgroBot con módulo SX1278;
- líneas SPI y GPIO accesibles;
- PostgreSQL y PostGIS;
- Node.js 24 o superior;
- CMake y GCC.

En la computadora usada para el AgroNeck:

- ESP-IDF instalado;
- un cable USB que permita transferencia de datos;
- ESP32 del collar configurada para el mismo firmware y frecuencia LoRa.

---

# 1. Preparar Raspberry Pi OS

Actualizar el sistema operativo e instalar las herramientas necesarias:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y git curl ca-certificates cmake gcc g++ nginx acl
```

Comprobar la arquitectura:

```bash
uname -m
```

Debe mostrar `aarch64`. Si no, reinstalar Raspberry Pi OS Lite de 64 bits.

Reiniciar si el sistema actualizó el kernel:

```bash
sudo reboot
```

---

# 2. Instalar Node.js

Esta guía utiliza NVM para instalar Node.js 24 sin modificar los paquetes del sistema.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24
nvm alias default 24
```

Comprobar las instalaciones:

```bash
node --version
npm --version
```

Ambos comandos deben funcionar sin anteponer `sudo`.

---

# 3. Instalar PostgreSQL y PostGIS

Instalar los paquetes:

```bash
sudo apt install -y postgresql postgresql-contrib postgis
sudo systemctl enable --now postgresql
```

Comprobar el servicio:

```bash
sudo systemctl status postgresql --no-pager
```

Crear el usuario y la base si todavía no existen:

```bash
sudo -u postgres createuser --pwprompt agronomad
sudo -u postgres createdb --owner=agronomad agronomad
sudo -u postgres psql -d agronomad -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
```

Anotar la contraseña elegida. No debe reemplazarse por un archivo ni publicarse en el repositorio.

Comprobar PostgreSQL y PostGIS:

```bash
sudo -u postgres psql -d agronomad -c 'SELECT PostGIS_Version();'
```

---

# 4. Obtener el proyecto

Como usuario normal, ubicar el repositorio en `/opt/agronomad`:

```bash
sudo mkdir -p /opt/agronomad
sudo chown -R "$USER:$USER" /opt/agronomad
cd /opt/agronomad
git clone https://github.com/impatrq/AgroNomad.git
cd AgroNomad
```

Si el repositorio ya está en la Raspberry, ingresar a su raíz y continuar desde allí:

```bash
cd /ruta/al/repositorio/AgroNomad
git pull
```

Las rutas utilizadas en esta guía continúan desde:

```text
/opt/agronomad/AgroNomad
```

---

# 5. Configurar el backend

Ingresar a la carpeta del backend:

```bash
cd /opt/agronomad/AgroNomad/firmware/AgroBot/server
npm install
```

Crear el archivo de entorno:

```bash
cp .env.example .env 2>/dev/null || true
nano .env
```

Si no existe `.env.example`, crear `.env` manualmente con este contenido:

```dotenv
DATABASE_URL=postgres://agronomad:CAMBIAR_CONTRASENA@127.0.0.1:5432/agronomad
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=agronomad
PGUSER=agronomad
PGPASSWORD=CAMBIAR_CONTRASENA
PGSSLMODE=disable

PORT=4000
TCP_PORT=4001
```

Reemplazar `CAMBIAR_CONTRASENA` por la contraseña creada en PostgreSQL.

El backend prioriza `DATABASE_URL`. Las variables `PG*` sirven como alternativa. No subir `.env` a Git ni compartirlo públicamente.

Protegerlo:

```bash
chmod 600 .env
```

Comprobar la configuración sin iniciar aún el servidor:

```bash
node -e "import('./db/index.js').then(m => m.testConnection()).then(console.log).catch(e => { console.error(e.message); process.exit(1) })"
```

Debe mostrar una fecha y hora de PostgreSQL.

---

# 6. Habilitar SPI y GPIO

Ejecutar la herramienta de configuración:

```bash
sudo raspi-config
```

Seleccionar:

```text
Interface Options
  -> SPI
  -> Enable
```

Reiniciar:

```bash
sudo reboot
```

Después del reinicio comprobar:

```bash
ls -l /dev/spidev0.0 /dev/gpiochip0
```

Ambos dispositivos deben existir. Si falta alguno, volver a habilitar SPI y reiniciar la Raspberry.

Verificar el modelo de PCB utilizado por el receptor:

- reset LoRa: GPIO25;
- DIO0 LoRa: GPIO24;
- SPI MOSI, MISO y SCLK: pines definidos por `/dev/spidev0.0`.

---

# 7. Compilar los programas C

Ingresar al directorio de firmware:

```bash
cd /opt/agronomad/AgroNomad/firmware/AgroBot/firmware
cmake -S . -B build
cmake --build build -j2
```

Comprobar los ejecutables:

```bash
ls -l build/agrobot-lora-receiver build/agro-neck-client build/agrobot-lora-simulator
```

Los ejecutables cumplen estas funciones:

| Ejecutable | Función |
|---|---|
| `agrobot-lora-receiver` | Recibe tramas reales del AgroNeck mediante SX1278. |
| `agro-neck-client` | Simula dos collares y envía JSON por TCP. |
| `agrobot-lora-simulator` | Genera lecturas LoRa simuladas para pruebas. |

Confirmar que el receptor esté configurado para 433 MHz:

```bash
grep -nE '0x6C|0x40|433 MHz' lora_receiver.c
```

Debe aparecer la configuración `0x6C`, `0x40` y el texto `433 MHz`.

---

# 8. Compilar el frontend

Instalar las dependencias y generar los archivos estáticos:

```bash
cd /opt/agronomad/AgroNomad/firmware/AgroBot/client
npm install
npm run build
```

La salida se crea en `client/dist`.

Comprobar:

```bash
test -f dist/index.html && echo "Frontend compilado correctamente"
```

Para la configuración por Nginx no hace falta establecer `VITE_API_BASE_URL`: el frontend debe usar el origen actual y el proxy `/api` y `/ws`.

---

# 9. Configurar Nginx

Instalar el backend y el receptor no requiere Nginx para usar la API directamente, pero sí para servir el dashboard desde el puerto 80.

Crear el directorio público:

```bash
sudo mkdir -p /var/www/agronomad
sudo rm -rf /var/www/agronomad/*
sudo cp -a /opt/agronomad/AgroNomad/firmware/AgroBot/client/dist/. /var/www/agronomad/
sudo chown -R root:www-data /var/www/agronomad
sudo find /var/www/agronomad -type d -exec chmod 755 {} +
sudo find /var/www/agronomad -type f -exec chmod 644 {} +
```

La orden `rm -rf` anterior afecta únicamente al directorio específico `/var/www/agronomad`.

Crear la configuración:

```bash
sudo nano /etc/nginx/sites-available/agronomad
```

Usar:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/agronomad;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Activarla y comprobar Nginx:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/agronomad /etc/nginx/sites-enabled/agronomad
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

El archivo recomendado del repositorio también se encuentra en [`nginx/agronomad.conf`](nginx/agronomad.conf), pero debe copiarse y ajustarse a `/var/www/agronomad` como se indica arriba.

---

# 10. Crear servicios para iniciar automáticamente

Para mantener el backend activo después de reiniciar la Raspberry, crear un servicio de systemd.

```bash
sudo nano /etc/systemd/system/agronomad-backend.service
```

Usar las rutas reales del usuario que ejecutará el servicio. La configuración ejemplo utiliza el usuario `pi` y la ruta `/opt/agronomad/AgroNomad`.

```ini
[Unit]
Description=AgroNomad backend
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/agronomad/AgroNomad/firmware/AgroBot/server
ExecStart=/usr/local/bin/node server.js
Restart=always
RestartSec=5
User=pi
Environment=NODE_ENV=production
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
```

Para que systemd encuentre Node.js fuera del shell de NVM, crear un enlace:

```bash
sudo ln -sf "$(which node)" /usr/local/bin/node
```

Reemplazar también `pi` por el nombre real del usuario.

Activar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agronomad-backend
sudo systemctl status agronomad-backend --no-pager
```

Si el servicio falla, revisar:

```bash
sudo journalctl -u agronomad-backend -n 100 --no-pager
```

---

# 11. Arrancar el receptor LoRa

El receptor necesita permisos para abrir SPI y GPIO. Para una prueba manual:

```bash
cd /opt/agronomad/AgroNomad/firmware/AgroBot/firmware
sudo ./build/agrobot-lora-receiver
```

El resultado esperado comienza con:

```text
SX1278 version: 0x12
Listening for AgroNeck LoRa packets at 433 MHz
```

Mantener el receptor ejecutándose en una terminal durante las pruebas. Después puede ejecutarse como servicio de systemd, pero primero debe verificarse manualmente que la placa es recibida.

Para ejecutar una prueba sin el hardware LoRa:

```bash
cd /opt/agronomad/AgroNomad/firmware/AgroBot/firmware
./build/agro-neck-client
```

Este simulador envía lecturas ficticias por TCP al puerto `4001`.

---

# 12. Instalar y flashear el AgroNeck

Estas acciones se realizan desde una computadora con ESP-IDF configurado:

```bash
cd /ruta/al/repositorio/AgroNomad/firmware/AgroNeck
idf.py set-target esp32
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

Reemplazar `/dev/ttyUSB0` por el puerto serie real.

Antes de flashear confirmar:

- ambos módulos LoRa están configurados para 433 MHz;
- la SPI del collar coincide con su esquema;
- el módulo GPS está conectado;
- el MPU6050 está conectado al I2C y su INT está conectado a GPIO27;
- el sistema tiene alimentación estable.

Al despertar o mover el AgroNeck debe aparecer una trama en el receptor y el backend debe registrar una posición.

---

# 13. Comprobar el sistema completo

Comprobar el estado del backend:

```bash
curl -fsS http://127.0.0.1:4000/api/status
```

La respuesta debe indicar un estado correcto.

Comprobar los servicios:

```bash
sudo systemctl status agronomad-backend nginx postgresql --no-pager
```

Comprobar el dashboard desde otro dispositivo:

```text
http://IP-DE-LA-RASPBERRY/
```

Obtener la dirección IP:

```bash
hostname -I
```

Comprobar desde la Raspberry:

```bash
curl -I http://127.0.0.1/
curl -fsS http://127.0.0.1/api/status
```

Después de recibir una trama LoRa:

1. el receptor debe mostrar temperatura y coordenadas;
2. el backend debe aceptar el JSON por TCP;
3. PostgreSQL debe crear o actualizar el animal;
4. el dashboard debe mostrar el nuevo marcador;
5. los cambios deben llegar por WebSocket a `/ws/animals`.

---

# 14. Prueba de extremo a extremo sin hardware

Si no hay radio disponible, iniciar en terminales separadas:

Backend:

```bash
cd /opt/agronomad/AgroNomad/firmware/AgroBot/server
npm run dev
```

Simulador TCP:

```bash
cd /opt/agronomad/AgroNomad/firmware/AgroBot/firmware
./build/agro-neck-client
```

Luego abrir:

```text
http://IP-DE-LA-RASPBERRY/
```

El simulador genera datos ficticios y permite verificar el backend, PostgreSQL y el dashboard sin necesitar el collar o el receptor.

---

# 15. Actualizar una instalación

Detener únicamente si es necesario modificar el backend o recompilarlo:

```bash
cd /opt/agronomad/AgroNomad
git pull

cd firmware/AgroBot/server
npm install

cd ../firmware
cmake -S . -B build
cmake --build build -j2

cd ../client
npm install
npm run build

sudo rm -rf /var/www/agronomad/*
sudo cp -a dist/. /var/www/agronomad/
sudo systemctl restart agronomad-backend
sudo systemctl reload nginx
```

---

# Solución de problemas

## El receptor no abre SPI

Comprobar que SPI esté habilitado y que los dispositivos existan:

```bash
sudo raspi-config
ls -l /dev/spidev0.0 /dev/gpiochip0
```

Si se ejecuta manualmente, usar `sudo`. Revisar que el SPI sea correcto y que la PCB utilice `/dev/spidev0.0`.

## El receptor no recibe paquetes

Comprobar:

- AgroNeck y AgroBot están en 433 MHz;
- reset y DIO0 están en GPIO25 y GPIO24;
- alimentación y masas están conectadas;
- el receptor quedó iniciado antes de activar el collar;
- no hay obstáculos o interferencias cercanas;
- el registro de recepción muestra el receptor activo.

## El backend no se conecta a PostgreSQL

Comprobar el servicio y las variables:

```bash
sudo systemctl status postgresql
cd /opt/agronomad/AgroNomad/firmware/AgroBot/server
cat .env
node -e "import('./db/index.js').then(m => m.testConnection()).then(console.log).catch(e => { console.error(e.message); process.exit(1) })"
```

Verificar que el usuario puede acceder a la base:

```bash
sudo -u postgres psql -d agronomad -c 'SELECT 1;'
psql -h 127.0.0.1 -U agronomad -d agronomad -c 'SELECT 1;'
```

## PostGIS no está disponible

Instalar o activar la extensión:

```bash
sudo apt install -y postgresql postgresql-contrib postgis
sudo -u postgres psql -d agronomad -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
sudo -u postgres psql -d agronomad -c 'SELECT PostGIS_Version();'
```

## Nginx responde con 404 o descarga de rutas

Comprobar que el frontend fue copiado:

```bash
ls -l /var/www/agronomad/index.html
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo journalctl -u nginx -n 100 --no-pager
```

Comprobar los proxies:

```bash
curl -fsS http://127.0.0.1/api/status
curl -i http://127.0.0.1/
```

## El WebSocket no funciona

Comprobar que Nginx incluye `location /ws/` con:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Después recargar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## El servicio backend no inicia

Revisar el nombre real del usuario y la ruta de Node.js:

```bash
which node
sudo systemctl status agronomad-backend --no-pager
sudo journalctl -u agronomad-backend -n 100 --no-pager
```

Debe corregirse `User=` y `ExecStart=` del servicio si fueron creados con otro usuario o versión.
