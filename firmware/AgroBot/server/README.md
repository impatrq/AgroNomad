# AgroNomad - Backend

El backend de AgroNomad recibe la telemetría enviada por los dispositivos de los animales, la guarda en PostgreSQL con PostGIS y expone una API HTTP para que el frontend consulte la información.

## Funciones principales

- Recibe mensajes de telemetría mediante una conexión TCP.
- Extrae y procesa objetos JSON, incluso cuando llegan varios mensajes juntos.
- Normaliza el ID, nombre, posición GPS y temperatura de cada animal.
- Crea o actualiza animales, dispositivos y posiciones en la base de datos.
- Expone endpoints HTTP para consultar animales, campos y el estado del sistema.
- Permite cambiar el nombre de un animal.
- Inicializa el esquema y crea datos de demostración al iniciar.

## Servicios y archivos principales

| Archivo | Función |
|---|---|
| `server.js` | Inicializa la base de datos y arranca los servidores HTTP y TCP. |
| `app.js` | Configura Express, CORS, el parseo JSON y las rutas de la API. |
| `services/telemetryServer.js` | Mantiene el servidor TCP que recibe la telemetría. |
| `services/telemetryParser.js` | Extrae JSON, valida los datos y guarda cada lectura recibida. |
| `controllers/` | Implementa la lógica de las respuestas de animales, campos y estado. |
| `routes/` | Define las rutas HTTP disponibles para el frontend. |
| `db/index.js` | Gestiona la conexión a PostgreSQL y las consultas principales. |
| `db/schema.sql` | Define las tablas, relaciones e índices de PostgreSQL/PostGIS. |

## Flujo de datos

1. Un dispositivo envía un JSON al puerto TCP.
2. El servidor separa los mensajes completos del buffer recibido.
3. El parser normaliza el payload y valida el ID y las coordenadas.
4. La lectura se guarda junto con el animal, el dispositivo y la temperatura.
5. El frontend consulta la API HTTP para mostrar los datos actualizados.

Ejemplo de payload aceptado:

```json
{
  "ID": "COLLAR-01",
  "NAME": "Animal 1",
  "LAT": -34.707652,
  "LONG": -58.242300,
  "TEMP": "38.4"
}
```

## API HTTP

| Método y ruta | Función |
|---|---|
| `GET /api/animals` | Devuelve los animales con su última posición y temperatura. |
| `POST /api/animals/rename` | Cambia el nombre de un animal usando `id` y `name`. |
| `GET /api/yards` | Devuelve los límites de los campos en formato de coordenadas. |
| `GET /api/status` | Devuelve el estado del servidor y la cantidad de animales. |

## Base de datos

El backend utiliza PostgreSQL y la extensión PostGIS. El esquema incluye usuarios, campos, animales, dispositivos, relaciones entre animales y dispositivos, posiciones GPS y estadísticas diarias.

La conexión puede configurarse con `DATABASE_URL` o con las variables `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`.

## Ejecución

Desde esta carpeta:

```bash
npm install
npm run dev
```

Para ejecutar el servidor sin modo de desarrollo:

```bash
npm start
```

Por defecto, la API HTTP utiliza el puerto `4000` y el servidor TCP de telemetría el puerto `4001`. Se pueden cambiar con `PORT` y `TCP_PORT`.
