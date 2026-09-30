import 'dotenv/config'

import { initializeDatabase, seedSampleData } from './db/index.js'
import { createApp } from './app.js'
import { createTelemetryServer } from './services/telemetryServer.js'

const HTTP_PORT = Number(process.env.PORT || 4000)
const TCP_PORT = Number(process.env.TCP_PORT || 4001)

async function startServer() {
  await initializeDatabase()
  await seedSampleData()

  const app = createApp()
  const httpServer = app.listen(HTTP_PORT, () => console.log(`HTTP server listening on port ${HTTP_PORT}`))
  const tcpServer = createTelemetryServer()
  tcpServer.listen(TCP_PORT, () => console.log(`TCP telemetry server listening on port ${TCP_PORT}`))

  function shutdown(signal) {
    console.log(`${signal} received, shutting down servers`)
    httpServer.close(() => tcpServer.close(() => process.exit(0)))
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

startServer().catch((error) => {
  console.error('Failed to start backend server', error)
  process.exitCode = 1
})