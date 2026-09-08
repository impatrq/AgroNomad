# AgroBotApp

## 1. Objetivo

El código del AgroBot recibe datos desde los AgroNeck, los guarda en PostgreSQL con PostGIS y los muestra en un dashboard web. Este código tiene implementado la recepción de posiciones, el almacenamiento de animales y campos, la visualización en un mapa y el cambio de nombre de los animales. Algunas funciones descriptas en el todavía están planificadas, pero no implementadas.

## 2. Arquitectura general

```text
Collar / main.c
    |
    | JSON por TCP, puerto 4001
    v
server/server.js
    |
    | upsertAnimalSnapshot()
    v
PostgreSQL + PostGIS
    |
    | API HTTP, puerto 4000
    v
Frontend React + Leaflet
```

### Componentes principales

|Componente|Responsabilidad|
|---|---|
| `firmware_example/main.c`| Simula un collar que envia datos por TCP.|
| `server/server.js`| Recibe TCP, procesa mensajes y expone la API HTTP.|
| `server/db/index.js`| Conecta con PostgreSQL y ejecuta las operaciones de base de datos.|
| `server/db/schema.sql`| Define tablas, relaciones e indices de PostgreSQL/PostGIS.|
| `server/utils/utils.js`| Normaliza payloads y extrae objetos JSON recibidos por TCP.|
| `client/src/App.jsx`| Controla la navegacion basica del frontend.|
| `client/src/pages/Home.jsx`| Muestra el mapa, los animales y los limites de los campos.|
| `client/src/pages/Login.jsx`| Muestra un formulario de login, actualmente incompleto.|
| `client/src/pages/userConfig.jsx`| Pantalla de configuracion de usuario.|

## 3. Flujo completo de datos

1. `main.c` se conecta a `127.0.0.1:4001`.
2. El collar envia un JSON con ID, posicion, temperatura, frecuencia cardiaca y bateria.
3. `createTcpServer()` en `server.js` recibe los bytes.
4. `handleIncomingData()` extrae y parsea los objetos JSON.
5. `normalizeAnimalPayload()` valida y normaliza los nombres de los campos.
6. `upsertAnimalSnapshot()` busca o crea el animal y su dispositivo.
7. La posicion se guarda en `gps_positions` como un punto PostGIS.
8. El frontend consulta `/api/animals` y `/api/yards` por HTTP.
9. `Home.jsx` convierte los datos a marcadores y polilineas de Leaflet.

## 4. Firmware: `firmware_example/main.c`

Este archivo no es todavia el firmware real del collar: es un cliente de prueba que simula el envio de datos.

### Constantes

- `SERVER_IP`: IP del backend TCP, actualmente `127.0.0.1`.
- `SERVER_PORT`: puerto TCP, actualmente `4001`.
- `BUFFER_SIZE`: capacidad del buffer usado para construir el JSON.

### Funciones

#### `tcp_connect()`

Crea un socket IPv4, configura la IP y el puerto del servidor y ejecuta `connect()`. Devuelve el descriptor del socket si tiene exito o `-1` si falla.

#### `tcp_send(sock, data)`

Envia todos los bytes de una cadena. Repite `send()` hasta transmitir el mensaje completo, porque una llamada individual puede enviar solo una parte.

#### `send_collar_data(...)`

Construye un JSON con los datos del collar y lo envia usando `tcp_send()`.

Payload que genera:

```json
{
  "ID": "COLLAR-01",
  "FIRMWARE_VERS": "1.0",
  "HARDWARE_VERS": "1.0",
  "LAT": -34.707652,
  "LONG": -58.242300,
  "BATTERY_LEVEL": 67,
  "TEMP": "38.4",
  "HB": "72"
}
```

El salto de linea al final permite separar mensajes consecutivos.

#### `main()`

1. Abre la conexion TCP.
2. Envia datos iniciales de `COLLAR-01` y `COLLAR-02`.
3. Cada cinco segundos vuelve a enviar datos de `COLLAR-01`.
4. Si el envio falla, cierra el socket e intenta reconectarse.

### Limitacion actual

El programa usa datos fijos. No recibe aun datos reales de LoRa. Ademas, el backend actualmente guarda temperatura, frecuencia cardiaca y ubicacion, pero no usa correctamente `FIRMWARE_VERS`, `HARDWARE_VERS` ni `BATTERY_LEVEL` del payload.

## 5. Backend: `server/server.js`

El backend contiene dos servidores independientes:

- TCP para los collares: puerto `4001`.
- HTTP para el frontend: puerto `4000` por defecto.

### Estado en memoria

- `animals`: copia temporal de los animales obtenidos de la base.
- `limitsField`: copia temporal de los limites de los campos.

La base de datos es la fuente persistente. La memoria se refresca desde PostgreSQL.

### Funciones internas

#### `refreshYardState()`

Llama a `listYards()` y actualiza `limitsField`.

#### `refreshAnimalState()`

Llama a `listAnimals()` y actualiza `animals`.

#### `mergeAnimalData(newAnimal)`

Actualiza el animal existente que tenga el mismo ID o agrega uno nuevo a la lista en memoria.

#### `handleIncomingData(rawData)`

Procesa datos recibidos por TCP:

1. Convierte el buffer a texto.
2. Ignora mensajes vacios o que parecen solicitudes HTTP.
3. Extrae objetos JSON mediante `extractJsonObjects()`.
4. Convierte cada objeto con `JSON.parse()`.
5. Normaliza animales.
6. Guarda snapshots en PostgreSQL.
7. Refresca el estado de animales desde la base.

Tambien acepta un array de animales y payloads que contengan limites de campos.

#### `createTcpServer()`

Crea el servidor TCP. Registra conexiones, recibe datos, llama a `handleIncomingData()` y maneja eventos de desconexion y error.

#### `createHttpServer()`

Crea el servidor HTTP y atiende las rutas de la API.

#### `startServer()`

Inicializa todo en este orden:

1. `initializeDatabase()` crea las tablas.
2. `seedSampleData()` crea datos demo si faltan.
3. `refreshAnimalState()` carga animales.
4. `refreshYardState()` carga campos.
5. Inicia los servidores HTTP y TCP.

### API HTTP actual

| Metodo y ruta | Funcion |
|---|---|
| `GET /api/animals` | Refresca y devuelve los animales desde PostgreSQL. |
| `GET /api/yards` | Refresca y devuelve los limites de los campos. |
| `GET /api/status` | Devuelve `status: ok` y la cantidad de animales. |
| `POST /api/animals/rename` | Cambia el nombre de un animal. |

Todas las respuestas principales permiten CORS mediante `Access-Control-Allow-Origin: *`.

## 6. Utilidades: `server/utils/utils.js`

#### `normalizeAnimalPayload(raw)`

Acepta distintas variantes de nombres (`ID`, `id`, `LAT`, `lat`, etc.), valida ID y coordenadas y devuelve un formato comun:

```js
{
  id,
  name,
  lat,
  lng,
  temp,
  hb
}
```

Devuelve `null` si faltan ID, latitud o longitud validas.

#### `normalizeLimitsField(raw)`

Valida y normaliza grupos de limites. Convierte variantes de latitud y longitud a:

```js
{
  nombreDelCampo: {
    limit1: { lat, lng }
  }
}
```

#### `mergeLimitsField(newLimits)`

Combina nuevos limites con el objeto global de limites en memoria. Es una utilidad para datos recibidos, aunque los limites principales actualmente se cargan desde la base.

#### `extractJsonObjects(value)`

Recorre el texto recibido y separa objetos JSON completos usando el nivel de llaves y el estado de las cadenas de texto. Esto permite procesar varios JSON enviados juntos por TCP.

## 7. Base de datos: `server/db/index.js`

Este modulo es la capa de acceso a PostgreSQL.

### Configuracion y conexion

#### `escapeSqlLiteral(value)`

Convierte un valor a literal SQL escapado. Actualmente no participa en el flujo principal, porque las consultas usan parametros `$1`, `$2`, etc. Es candidata a eliminarse si no se reutiliza.

#### `splitSqlStatements(sql)`

Separa el contenido de `schema.sql` en sentencias para ejecutarlas durante la inicializacion.

#### `getSslConfig()`

Lee `PGSSLMODE` o `PGSSL` y decide si la conexion usa SSL.

#### `getPoolConfig()`

Construye la configuracion del pool de PostgreSQL usando `DATABASE_URL` o variables separadas como `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`.

#### `getDb()`

Crea el pool una sola vez y devuelve siempre la misma instancia.

#### `testConnection()`

Ejecuta `SELECT NOW()` para comprobar la conexion y libera el cliente al terminar.

#### `initializeDatabase()`

Lee `schema.sql`, abre una transaccion, ejecuta cada sentencia y confirma con `COMMIT`. Si una sentencia falla, ejecuta `ROLLBACK`. La variable `initialized` evita repetir la inicializacion en el mismo proceso.

### Campos y geometria

#### `polygonToLimitMap(name, polygonGeoJson)`

Convierte un poligono GeoJSON de PostGIS al formato de limites esperado por el frontend. Elimina el ultimo punto si repite el primero y transforma cada par `[longitud, latitud]` en `{ lat, lng }`.

#### `ensureDefaultYards(client, userId)`

Comprueba si existen los campos demo y crea `limitsField1` y `LimitsField2` si faltan. Es idempotente: no los duplica en reinicios posteriores.

#### `listYards()`

1. Inicializa la base.
2. Obtiene el usuario demo.
3. Asegura los campos por defecto.
4. Consulta sus poligonos.
5. Convierte cada poligono con `polygonToLimitMap()`.
6. Devuelve el objeto `limitsField`.

### Animales y dispositivos

#### `listAnimals()`

Obtiene los animales del usuario demo, el dispositivo asociado y la ultima posicion GPS. Devuelve para el frontend:

```js
{
  id,
  name,
  lat,
  lng,
  temp,
  hb
}
```

#### `upsertAnimalSnapshot(payload)`

Guarda una lectura del collar:

1. Normaliza ID, nombre, coordenadas, temperatura y frecuencia cardiaca.
2. Busca el dispositivo por `device_uid`.
3. Si no existe, crea animal, dispositivo y relacion entre ambos.
4. Actualiza el nombre del animal.
5. Inserta una posicion en `gps_positions`.
6. Devuelve el snapshot procesado.

Las coordenadas se insertan como `ST_MakePoint(longitud, latitud)` con SRID `4326`.

#### `renameAnimal(id, newName)`

Busca un animal por ID interno o por `device_uid`, actualiza su nombre y devuelve el resultado. Devuelve `null` si no lo encuentra.

#### `getDemoUserId(client)`

Busca el usuario `demo@agronomad.app` y lo crea si no existe.

#### `seedSampleData()`

Carga datos de demostracion:

- usuario demo;
- campos por defecto;
- `COLLAR-01`, `COLLAR-02` y `COLLAR-03`;
- posiciones GPS iniciales;
- estadisticas diarias aleatorias.

Si los animales ya existen, no los duplica.

## 8. Base de datos: `server/db/schema.sql`

Activa PostGIS y define estas tablas:

| Tabla | Contenido |
|---|---|
| `users` | Usuarios de la aplicacion. |
| `yards` | Campos y poligonos de sus limites. |
| `animals` | Animales, tipo, nombre y campo asignado. |
| `devices` | Collares, version, bateria y ultima conexion. |
| `animal_devices` | Relacion historica entre animales y dispositivos. |
| `gps_positions` | Historial de ubicaciones y sensores. |
| `animal_daily_statistics` | Distancia, movimiento y sueño por dia. |

### Relaciones importantes

- Un usuario puede tener varios campos y animales.
- Un animal puede estar asociado a un dispositivo mediante `animal_devices`.
- Un dispositivo puede cambiar de animal sin perder su historial.
- Una posicion GPS pertenece a un animal y puede referenciar su dispositivo.
- `ON DELETE CASCADE` elimina datos dependientes cuando corresponde.

### Coordenadas

- `yards.boundary` guarda un poligono.
- `gps_positions.location` guarda un punto geografico.
- El SRID usado es `4326`.
- PostGIS espera los puntos como `(longitud, latitud)`.

### Indices

Los indices aceleran:

- busqueda de posiciones por animal;
- ordenamiento por fecha;
- consultas espaciales con GIST;
- busqueda de campos por usuario;
- busqueda de animales por campo o usuario;
- estadisticas por animal y fecha;
- asignaciones por dispositivo.

## 9. Frontend

### `client/src/App.jsx`

Implementa una navegacion simple basada en `window.location.pathname`:

- `/login` muestra `Login`.
- `/userconf` muestra `UserConfig`.
- cualquier otra ruta muestra `Home`.

El callback de login todavia es `null`, por lo que la autenticacion no esta conectada a una sesion real.

### `client/src/pages/Home.jsx`

Es el dashboard principal.

Funciones y responsabilidades:

- Consulta `/api/animals` al cargar y cada 15 segundos.
- Consulta datos de limites dentro del mismo flujo esperado por la vista.
- Conserva el animal seleccionado cuando se actualizan los datos.
- Calcula el centro del mapa.
- Muestra animales como `CircleMarker` de Leaflet.
- Muestra campos como `Polyline`.
- Permite seleccionar un animal y hacer zoom con `FlyToSelected`.
- Permite copiar coordenadas.
- Permite cambiar el nombre mediante `/api/animals/rename`.
- Incluye un enlace preparado para un futuro historial en `/history/:id`.

### `normalizeBoundaryGroups(payload)`

Convierte los limites recibidos a posiciones `[lat, lng]`, cierra el poligono y los prepara para `Polyline`.

### `FlyToSelected({ position })`

Usa la instancia del mapa para centrarlo suavemente en la posicion seleccionada.

### `client/src/pages/Login.jsx`

Muestra formulario de email y contraseña y envia `POST /api/login`. Sin embargo, el backend actual no implementa esa ruta ni una autenticacion real.

## 10. Resumen de lo implementado actualmente

- Recepcion TCP de payloads JSON.
- Persistencia de animales, dispositivos y posiciones GPS.
- Persistencia de limites de campos en PostgreSQL/PostGIS.
- Carga de datos demo idempotente.
- API para animales, campos, estado y renombrado.
- Dashboard con mapa, marcadores y limites.
- Actualizacion periodica de animales cada 15 segundos.
- Reconexion basica del cliente C cuando se pierde el socket.

## 11. Lista de pendientes

Estas funciones aparecen en los documentos de planificacion, pero no estan terminadas en el codigo actual:

1. Actualizar `devices.last_seen` en cada paquete recibido.
2. Guardar `BATTERY_LEVEL` en `devices.last_battery_level`.
3. Guardar `FIRMWARE_VERS` y `HARDWARE_VERS` enviados por el collar.
4. Implementar consultas y endpoints para el historial de posiciones.
5. Dibujar trayectos historicos con colores segun movimiento.
6. Detectar y marcar animales fuera de los limites del campo.
7. Implementar login, cookies/sesiones y proteccion de rutas.
8. Agregar la ruta frontend `/history/:id`.
9. Separar mejor datos demo de datos reales.
10. Reemplazar polling por WebSocket si se necesita tiempo real.
11. Agregar limites de tamaño y validacion mas robusta para mensajes TCP.
12. Revisar el manejo de errores de operaciones asincronas del socket.
13. Agregar backups automaticos y almacenamiento de telemetria si el volumen crece.