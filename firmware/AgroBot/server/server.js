import 'dotenv/config'

import { createServer } from 'node:http'

import { initializeDatabase, seedSampleData } from './db/index.js'
import { createApp } from './app.js'
import { createTelemetryServer } from './services/telemetryServer.js'
import { listAnimals } from './db/index.js'
import { createAnimalsWebSocketServer } from './services/animalsWebSocketServer.js'

const HTTP_PORT = Number(process.env.PORT || 4000)
const TCP_PORT = Number(process.env.TCP_PORT || 4001)

async function startServer() {
  await initializeDatabase()
  await seedSampleData()

  const app = createApp()
  //Web Socket to tx Animal data constinously
  const httpServer = createServer(app)
  const animalsWebSocketServer = createAnimalsWebSocketServer(httpServer, listAnimals)
  httpServer.listen(HTTP_PORT, () => console.log(`HTTP server listening on port ${HTTP_PORT}`))

  //Tcp Socket to tx Animal data from Firmware constinously
  const tcpServer = createTelemetryServer({
    onTelemetryProcessed: () => animalsWebSocketServer.broadcastAnimals(),
  })
  tcpServer.listen(TCP_PORT, () => console.log(`TCP telemetry server listening on port ${TCP_PORT}`))

  //##################################################################################################
  
  function shutdown(signal) {
    console.log(`${signal} received, shutting down servers`)
    animalsWebSocketServer.close(() => httpServer.close(() => tcpServer.close(() => process.exit(0))))
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

startServer().catch((error) => {
  console.error('Failed to start backend server', error)
  process.exitCode = 1
})