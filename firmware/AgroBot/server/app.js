import express from 'express'
import cors from 'cors'

import animalRoutes from './routes/animalRoutes.js'
import statusRoutes from './routes/statusRoutes.js'
import yardRoutes from './routes/yardRoutes.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors())
  app.use(express.json({ limit: '64kb' }))
  app.use('/api/animals', animalRoutes)
  app.use('/api/yards', yardRoutes)
  app.use('/api/status', statusRoutes)

  app.use((_request, response) => {
    response.status(404).json({ status: 'error', message: 'Route not found' })
  })

  app.use((error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed') {
      response.status(400).json({ status: 'error', message: 'Invalid JSON body' })
      return
    }

    console.error('Unhandled API error:', error)
    response.status(500).json({ status: 'error', message: 'Internal server error' })
  })

  return app
}