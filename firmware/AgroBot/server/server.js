import { createServer } from 'http'
import { createServer as createNetServer } from 'net'

import { initializeDatabase, listAnimals, listYards, renameAnimal, seedSampleData, upsertAnimalSnapshot } from './db/index.js'
import { normalizeAnimalPayload, normalizeLimitsField, mergeLimitsField, extractJsonObjects } from './utils/utils.js'

import 'dotenv/config'

const HTTP_PORT = process.env.PORT ? Number(process.env.PORT) : 4000
const TCP_PORT = process.env.TCP_PORT ? Number(process.env.TCP_PORT) : 4001

// Here is where the animal data is stored in memory, refreshed from the database on each request to /api/animals
let animals = []

// Yard limits are loaded from the database; no hardcoded sample data here.
let limitsField = {}

// Refresh the in-memory yard limits from the db
async function refreshYardState() {
  limitsField = await listYards()
}

// Refresh the in-memory animal state from the database
async function refreshAnimalState() {
  animals = await listAnimals()
}

// Merge new animal data into the in-memory state
function mergeAnimalData(newAnimal) {
  const existingIndex = animals.findIndex((animal) => animal.id === newAnimal.id)
  if (existingIndex >= 0) {
    animals[existingIndex] = { ...animals[existingIndex], ...newAnimal }
  } else {
    animals.push(newAnimal)
  }
}







// This function handles incoming raw data, extracts JSON objects, normalizes them, and updates the in-memory state and database accordingly.
async function handleIncomingData(rawData) {
  const text = rawData.toString('utf8')
  if (!text || (!text.includes('{') && !text.includes('['))) return
  if (/^(GET|POST|HEAD|PUT|DELETE|OPTIONS|CONNECT|TRACE)\s+/i.test(text)) return

  const chunks = extractJsonObjects(text)
  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const animal = normalizeAnimalPayload(item)
          if (animal) {
            await upsertAnimalSnapshot(item)
            mergeAnimalData(animal)
          }
        }
      } else {
        const animal = normalizeAnimalPayload(parsed)
        if (animal) {
          await upsertAnimalSnapshot(parsed)
          mergeAnimalData(animal)
        }

        if (parsed && typeof parsed === 'object' && parsed.limitsField) {
          const normalizedLimits = normalizeLimitsField(parsed.limitsField)
          if (normalizedLimits) {
            mergeLimitsField(normalizedLimits)
          }
        }
      }
    } catch (jsonError) {
      console.warn('Could not parse incoming payload:', chunk)
    }
  }

  await refreshAnimalState()
}
/**
 * TCP server to receive JSON data from Firmware running inside Raspberry Zero 2w.
 * IP: localhost, PORT: 4001.
 */


function createTcpServer() {
  const server = createNetServer((socket) => {
    console.log('TCP client connected from', `${socket.remoteAddress}:${socket.remotePort}`)
    socket.setEncoding('utf8')

    socket.on('data', async (data) => {
      const text = data.toString('utf8')
      if (!text.includes('{') && !text.includes('[')) {
        return
      }
      console.log('Received socket JSON data:', text.trim())
      await handleIncomingData(data)
    })

    socket.on('end', () => {
      console.log('TCP client disconnected')
    })

    socket.on('error', (err) => {
      console.error('TCP socket error:', err.message)
    })
  })

  server.on('error', (err) => {
    console.error('TCP server error:', err.message)
  })

  server.listen(TCP_PORT, () => {
    console.log(`TCP socket server listening on port ${TCP_PORT}`)
  })
}



































































/**
 * Web client <----> Web server.
*/


function createHttpServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)

    /*
    
    1. The server listens for GET requests to the /api/animals endpoint.
    2. When a request is received, it calls the refreshAnimalState function to update the in-memory animal state from the database.
    3. If the refresh is successful, it responds with a JSON object containing the list of animals and the limitsField data.
    4. If there is an error during the refresh, it responds with a 500 status code and an error message indicating a database error.
    5. The response includes the Access-Control-Allow-Origin header set to *, allowing cross-origin requests from any domain.

    */

    if (req.method === 'GET' && url.pathname === '/api/animals') {
      void (async () => {
        try {
          await refreshAnimalState()
          const payload = JSON.stringify({ animals}) //only send animals data
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(payload)
        } catch (error) {
          console.error('Failed to load animals from DB', error)
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify({ status: 'error', message: 'Database error' }))
        }
      })()
      return
    }

    /*
       1. The server listens for GET requests to the /api/yards endpoint.
    */

    if (req.method === 'GET' && url.pathname === '/api/yards') {
      void (async () => {
        try {
          await refreshYardState()
          const payload = JSON.stringify({ limitsField })// only send yards limits data
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(payload)
        } catch (error) {
          console.error('Failed to load yard limits from DB', error)
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify({ status: 'error', message: 'Database error' }))
        }
      })()
      return
    }

    /*

    1. The server listens for GET requests to the /status endpoint.
    2. When a request is received, it calls the refreshAnimalState function to update the in-memory animal state from the database.
    3. If the refresh is successful, it responds with a JSON object containing the status "ok" and the number of animals in the database.
    4. If there is an error during the refresh, it responds with a 500 status code and an error message indicating a database error.
    5. The response includes the Access-Control-Allow-Origin header set to *, allowing cross-origin requests from any domain.

    */

    if (req.method === 'GET' && url.pathname === '/api/status') {
      void (async () => {
        try {
          await refreshAnimalState()
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify({ status: 'ok', animals: animals.length }))
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify({ status: 'error', message: 'Database error' }))
        }
      })()
      return
    }



    if (req.method === 'POST' && url.pathname === '/api/animals/rename') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })

      req.on('end', async () => {
        try {
          const payload = JSON.parse(body)
          const animalId = String(payload?.id ?? '').trim()
          const newName = String(payload?.name ?? '').trim()

          if (!animalId || !newName) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
            res.end(JSON.stringify({ status: 'error', message: 'Missing id or name' }))
            return
          }

          const result = await renameAnimal(animalId, newName)
          if (!result) {
            res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
            res.end(JSON.stringify({ status: 'error', message: 'Animal not found' }))
            return
          }

          await refreshAnimalState()
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify({ status: 'ok', id: animalId, name: newName }))
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON body' }))
        }
      })
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })

  server.listen(HTTP_PORT, () => {
    console.log(`HTTP server listening on port ${HTTP_PORT}`)
    console.log(`GET /api/animals returns ${animals.length} database-backed animal entries`)
  })
}









async function startServer() {
  await initializeDatabase()
  await seedSampleData()
  await refreshAnimalState()
  await refreshYardState()
  
  createHttpServer()
  createTcpServer()
  
  console.log('Backend server started with database-backed animal data. Use a TCP socket to send JSON updates to port', TCP_PORT)
}

startServer().catch((error) => {
  console.error('Failed to start backend server', error)
  process.exit(1)
})