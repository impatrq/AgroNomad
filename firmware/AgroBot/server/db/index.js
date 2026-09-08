import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEMO_EMAIL = 'demo@agronomad.app'

let pool
let initialized = false

function escapeSqlLiteral(value) {
  if (value === null || typeof value === 'undefined') return 'NULL'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return `'${String(value).replace(/'/g, "''")}'`
}

function splitSqlStatements(sql) {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function getSslConfig() {
  const sslMode = process.env.PGSSLMODE || process.env.PGSSL || ''

  if (!sslMode) return false
  if (sslMode === 'disable') return false

  return { rejectUnauthorized: false }
}

/*

  getPoolConfig() -> Looks for a database URL in the environment variables.(process.env) 
  If found, it uses that URL to configure the connection pool. 
  Otherwise, it falls back to individual environment variables for host, port, database name, user, and password.

*/

function getPoolConfig() {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: getSslConfig(),
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000),
    }
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'agronomad',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    ssl: getSslConfig(),
    max: Number(process.env.PGPOOL_MAX || 10),//Maximum number of clients in the pool
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),//Wait for 30 before closing idle clients
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000),//Wait for 10 seconds in connecting
  }
}


/*

  getDb() -> Returns the database connection pool. If the pool hasn't been created yet, it initializes it using getPoolConfig().

*/

export function getDb() {
  if (!pool) {
    pool = new Pool(getPoolConfig())
  }
  return pool
}

/*

  testConnection() -> Tests the database connection by executing a simple query (SELECT NOW()) and returns the current timestamp from the database.

*/

export async function testConnection() {
  const client = await getDb().connect()
  try {
    const result = await client.query('SELECT NOW() as now')
    return result.rows[0]
  } finally {
    client.release()
  }
}

/*

  initializeDatabase() -> Initializes the database by executing SQL statements from a schema.sql file. 
  It ensures that the schema is set up correctly before any operations are performed.

*/

export async function initializeDatabase() {
  if (initialized) return getDb()

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  const client = await getDb().connect()

    try {
    await client.query('BEGIN')
    for (const statement of splitSqlStatements(schemaSql)) {
      await client.query(statement)
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  initialized = true
  return getDb()
}




function polygonToLimitMap(name, polygonGeoJson) {
  if (!polygonGeoJson || typeof polygonGeoJson !== 'object' || !Array.isArray(polygonGeoJson.coordinates)) {
    return null
  }

  const ring = polygonGeoJson.coordinates[0]
  if (!Array.isArray(ring) || ring.length === 0) {
    return null
  }

  const compactRing =
    ring.length > 0 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring

  const points = {}

  compactRing.forEach(([lng, lat], index) => {
    const parsedLat = Number(lat)
    const parsedLng = Number(lng)

    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      return
    }

    points[`limit${index + 1}`] = { lat: parsedLat, lng: parsedLng }
  })

  if (Object.keys(points).length === 0) {
    return null
  }

  return { [name]: points }
}

async function ensureDefaultYards(client, userId) {
  const existing = await client.query(
    `SELECT name FROM yards WHERE user_id = $1`,
    [userId]
  )

  const existingNames = new Set(existing.rows.map((row) => row.name))

  const defaults = [
    {
      name: 'limitsField1',
      polygon: 'POLYGON((-58.253289 -34.712444, -58.237085 -34.707743, -58.245205 -34.701257, -58.253289 -34.706142, -58.253289 -34.712444))',
    },
    {
      name: 'LimitsField2',
      polygon: 'POLYGON((-58.256803 -34.702611, -58.249276 -34.698916, -58.245205 -34.701257, -58.253289 -34.706142, -58.256803 -34.702611))',
    },
  ]

  for (const yard of defaults) {
    if (!existingNames.has(yard.name)) {
      await client.query(
        `INSERT INTO yards (user_id, name, boundary)
         VALUES ($1, $2, ST_GeomFromText($3, 4326))`,
        [userId, yard.name, yard.polygon]
      )
    }
  }
}

export async function listYards() {
  await initializeDatabase()
  const client = await getDb().connect()

  try {
    const userId = await getDemoUserId(client)
    await ensureDefaultYards(client, userId)

    const result = await client.query(
      `
      SELECT
        id,
        user_id,
        name,
        ST_AsGeoJSON(boundary)::json AS boundary,
        created_at
      FROM yards
      WHERE user_id = $1
      ORDER BY created_at DESC;
      `,
      [userId]
    )

    const limitsField = {}

    for (const yard of result.rows) {
      const parsedBoundary =
        typeof yard.boundary === 'string' ? JSON.parse(yard.boundary) : yard.boundary

      const mapped = polygonToLimitMap(yard.name, parsedBoundary)
      if (mapped) {
        Object.assign(limitsField, mapped)
      }
    }

    return limitsField
  } finally {
    client.release()
  }
}

/*

  listAnimals() -> Retrieves a list of animals for the demo user, including their latest GPS positions and other relevant information.

*/

export async function listAnimals() {
  await initializeDatabase()
  const client = await getDb().connect()

  try {
    const userId = await getDemoUserId(client)
    const result = await client.query(
      `SELECT a.id, a.name, a.animal_type, d.device_uid
       FROM animals a
       LEFT JOIN animal_devices ad ON ad.animal_id = a.id AND ad.unassigned_at IS NULL
       LEFT JOIN devices d ON d.id = ad.device_id
       WHERE a.user_id = $1
       ORDER BY a.id`,
      [userId]
    )

    const animals = []
    for (const row of result.rows) {
      const latestGpsResult = await client.query(
        `SELECT ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude,
                temperature,
                heartbeat
         FROM gps_positions
         WHERE animal_id = $1
         ORDER BY timestamp DESC
         LIMIT 1`,
        [row.id]
      )
      const latest = latestGpsResult.rows[0] || {}

      animals.push({
        id: String(row.device_uid || row.id),
        name: row.name,
        lat: Number(latest.latitude ?? 0),
        lng: Number(latest.longitude ?? 0),
        temp: String(latest.temperature ?? ''),
        hb: String(latest.heartbeat ?? ''),
      })
    }

    return animals
  } finally {
    client.release()
  }
}




/*

  upsertAnimalSnapshot(payload) -> Inserts or updates an animal's snapshot data based on the provided payload. 
  It handles creating new animals and devices if they don't already exist.

  Payload structure: {
    userID: string,
    ID: string,
    NAME: string,
    LAT: number,
    LONG: number,
    TEMP: string,
    HB: string 
  }

*/

export async function upsertAnimalSnapshot(payload) {
  await initializeDatabase()
  const client = await getDb().connect()

  try {
    const userId = await getDemoUserId(client)
    
    //Normalize data
    const id = String(payload.ID ?? payload.id ?? payload.Id ?? '').trim()
    const name = String(payload.NAME ?? payload.name ?? payload.Name ?? `Animal ${id}`).trim()
    const lat = Number(payload.LAT ?? payload.lat ?? payload.latitude ?? payload.Latitude)
    const lng = Number(payload.LONG ?? payload.long ?? payload.longitude ?? payload.Longitude)
    const temp = Number(payload.TEMP ?? payload.temp ?? payload.temperature ?? payload.Temperature ?? 0)
    const hb = Number(payload.HB ?? payload.hb ?? payload.HeartBeat ?? payload.hbRate ?? payload.heartBeat ?? 0)

    if (!id || Number.isNaN(lat) || Number.isNaN(lng)) {
      return null
    }
    
    //check if the animal already exists for this user based on the device UID
    const animalLookup = await client.query(
      `SELECT a.id
       FROM animals a
       JOIN animal_devices ad ON ad.animal_id = a.id
       JOIN devices d ON d.id = ad.device_id
       WHERE a.user_id = $1 AND d.device_uid = $2
       LIMIT 1`,
      [userId, id]
    )

    let animalId
    let deviceId

    //if the animal exists, get its ID and the associated device ID; 
    // otherwise, insert new records into animals and devices tables
    if (animalLookup.rows.length > 0) {
      animalId = animalLookup.rows[0].id
      const deviceLookup = await client.query(
        'SELECT d.id FROM devices d WHERE d.device_uid = $1 LIMIT 1',
        [id]
      )
      deviceId = deviceLookup.rows[0]?.id
    } else {

      // Insert new animal and device records if they don't exist
      // Insert into animals table and get the animal ID
      // *************************REVISE************************************
      const insertedAnimal = await client.query(
        `INSERT INTO animals (user_id, yard_id, name, animal_type)
         VALUES ($1, (SELECT id FROM yards WHERE user_id = $1 LIMIT 1), $2, $3)
         RETURNING id`,
        [userId, name, 'cattle']
      )
      animalId = insertedAnimal.rows[0].id

      const insertedDevice = await client.query(
        `INSERT INTO devices (device_uid, hardware_version, firmware_version, last_battery_level, last_seen)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING id`,
        [id, 'v1.0', '1.2.3', 87]
      )
      deviceId = insertedDevice.rows[0].id

      await client.query(
        `INSERT INTO animal_devices (animal_id, device_id)
         VALUES ($1, $2)`,
        [animalId, deviceId]
      )
    }

    //Update the animal's name in the animals table if it has changed
    await client.query('UPDATE animals SET name = $1 WHERE id = $2', [name, animalId])

    // Insert the latest GPS position into the gps_positions table using a PostGIS POINT
    await client.query(
      `INSERT INTO gps_positions (animal_id, device_id, timestamp, location, temperature, heartbeat, speed, accuracy)
       VALUES ($1, $2, CURRENT_TIMESTAMP, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8)`,
      [animalId, deviceId, lng, lat, temp, hb, 1.1, 2.5]
    )

    return { id, name, lat, lng, temp: String(temp), hb: String(hb) }
  } finally {
    client.release()
  }
}


/*

  renameAnimal(id, newName) -> Renames an animal based on its ID or device UID. 
  It updates the animal's name in the database and returns the updated information.

  This function first checks if the animal exists for the demo user based on the provided ID or device UID.
  If the animal is found, it updates the name in the animals table and returns an object containing the ID and new name.
  If the animal is not found, it returns null.
*/

export async function renameAnimal(id, newName) {
  await initializeDatabase()
  const client = await getDb().connect()

  try {
    const userId = await getDemoUserId(client)
    const animalResult = await client.query(
      `SELECT a.id
       FROM animals a
       LEFT JOIN animal_devices ad ON ad.animal_id = a.id AND ad.unassigned_at IS NULL
       LEFT JOIN devices d ON d.id = ad.device_id
       WHERE a.user_id = $1 AND (a.id = $2 OR d.device_uid = $3)
       LIMIT 1`,
      [userId, Number(id), String(id)]
    )

    if (animalResult.rows.length === 0) {
      return null
    }

    await client.query('UPDATE animals SET name = $1 WHERE id = $2', [newName, animalResult.rows[0].id])
    return { id, name: newName }
  } finally {
    client.release()
  }
}
























/*
  -----------------------------------------------------------------------------
  getDemoUserId(client) -> Retrieves the ID of the demo user from the database. 
  If the demo user doesn't exist, it creates one and returns its ID.
  -----------------------------------------------------------------------------
*/

async function getDemoUserId(client) {
  const existingUser = await client.query(
    'SELECT id FROM users WHERE email = $1',
    [DEMO_EMAIL]
  )

  if (existingUser.rows.length > 0) {
    return existingUser.rows[0].id
  }

  //Inserting a demo user if it doesn't exist
  const insertedUser = await client.query(
    `INSERT INTO users (name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    ['Demo User', DEMO_EMAIL, '+54 11 5555 0000', 'hashed-demo-password']
  )

  return insertedUser.rows[0].id
}

/*

  seedSampleData() -> Seeds the database with sample data, including a demo user, a yard, and sample animals with associated devices and GPS positions.

*/

export async function seedSampleData() {
  await initializeDatabase()
  
  const client = await getDb().connect()

  try {
    const userId = await getDemoUserId(client)
    await ensureDefaultYards(client, userId)

    const existingYard = await client.query('SELECT id FROM yards WHERE user_id = $1 LIMIT 1', [userId])
    let yardId

    if (existingYard.rows.length > 0) {
      yardId = existingYard.rows[0].id
    } else {
      const yardInsert = await client.query(
        `INSERT INTO yards (user_id, name, boundary)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId, 'Campo Norte', 'POLYGON((-58.253289 -34.712444, -58.237085 -34.707743, -58.245205 -34.701257, -58.253289 -34.706142, -58.253289 -34.712444))']
      )
      yardId = yardInsert.rows[0].id
    }

    //sample animals to seed in DB
    const sampleAnimals = [
      { name: 'Lora', animalType: 'cattle', deviceUid: 'COLLAR-01', lat: -34.707652, lng: -58.242300, temp: '38.4', hb: '72' },
      { name: 'Lola', animalType: 'cattle', deviceUid: 'COLLAR-02', lat: -34.707546, lng: -58.239348, temp: '38.1', hb: '68' },
      { name: 'Luna', animalType: 'cattle', deviceUid: 'COLLAR-03', lat: -34.709948, lng: -58.242870, temp: '38.7', hb: '75' },
    ]

    // this loop checks if the sample animals already exist in the database and inserts them if they don't
    //  tables: animals, devices, animal_devices, gps_positions, animal_daily_statistics 
    for (const animal of sampleAnimals) {
      // Check if the animal already exists for this user
      const existingAnimal = await client.query(
        `SELECT a.id
         FROM animals a
         JOIN animal_devices ad ON ad.animal_id = a.id
         JOIN devices d ON d.id = ad.device_id
         WHERE a.user_id = $1 AND d.device_uid = $2
         LIMIT 1`,
        [userId, animal.deviceUid]
      )

      if (existingAnimal.rows.length > 0) {
        continue
      }

      // Insert the animal, device, and related records
      // get the animal id after inserting into animals table
      // ANIMALS TABLE
      const animalInsert = await client.query(
        `INSERT INTO animals (user_id, yard_id, name, animal_type)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId, yardId, animal.name, animal.animalType]
      )
      const animalId = animalInsert.rows[0].id
      
      //insert into devices table and get the device id
      const deviceInsert = await client.query(
        `INSERT INTO devices (device_uid, hardware_version, firmware_version, last_battery_level, last_seen)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING id`,
        [animal.deviceUid, 'v1.0', '1.2.3', 87/*battery level is integer*/]
      )
      const deviceId = deviceInsert.rows[0].id

      //insert into animal_devices table to link the animal and device
      await client.query(
        `INSERT INTO animal_devices (animal_id, device_id)
         VALUES ($1, $2)`,
        [animalId, deviceId]
      )

      // insert into gps_positions table using a PostGIS POINT in the `location` column
      await client.query(
        `INSERT INTO gps_positions (animal_id, device_id, timestamp, location, temperature, heartbeat, speed, accuracy)
         VALUES ($1, $2, CURRENT_TIMESTAMP, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8)`,
        [animalId, deviceId, animal.lng, animal.lat, Number(animal.temp), Number(animal.hb), 1.1, 2.5]
      )

      //insert into animal_daily_statistics table with random values for distance_travelled, movement_time, and sleep_time
      await client.query(
        `INSERT INTO animal_daily_statistics (animal_id, date, distance_travelled, movement_time, sleep_time)
         VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
        [animalId, 4 + Math.random() * 2, 6 + Math.random() * 3, 18 + Math.random() * 2]
      )
    }

    return { userId }
  } finally {
    client.release()
  }
}