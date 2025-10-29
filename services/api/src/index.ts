import express from 'express'
import dotenv from 'dotenv'
import { corsMiddleware } from './middleware/cors'
import { errorHandler } from './middleware/errorHandler'
import healthRouter from './api/routes/health'
import connectionsRouter from './api/routes/connections'
import syncRouter from './api/routes/sync'
import shopifyRouter from './api/routes/shopify'
import logger from './lib/logger'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3004

// Middleware
app.use(express.json())
app.use(corsMiddleware)

// Routes
app.use('/', healthRouter)
app.use('/api/connections', connectionsRouter)
app.use('/api/sync', syncRouter)
app.use('/api/shopify', shopifyRouter)

// Error handling
app.use(errorHandler)

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV}`)
  logger.info(`Health check: http://localhost:${PORT}/health`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})

export default app


