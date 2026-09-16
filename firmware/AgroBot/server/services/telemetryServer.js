import { createServer } from 'net'

import { extractJsonPayloads, processTelemetryPayload } from './telemetryParser.js'

export function createTelemetryServer() {
  return createServer((socket) => {
    let buffer = ''
    socket.setEncoding('utf8')

    socket.on('data', async (data) => {
      buffer += data
      const result = extractJsonPayloads(buffer)
      buffer = result.remainder

      for (const payload of result.payloads) {
        try {
          await processTelemetryPayload(payload)
        } catch (error) {
          console.warn('Could not process telemetry payload:', error.message)
        }
      }
    })

    socket.on('error', (error) => console.error('TCP socket error:', error.message))
  })
}