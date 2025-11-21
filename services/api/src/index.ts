import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import { corsMiddleware } from './middleware/cors'
import { errorHandler } from './middleware/errorHandler'
import healthRouter from './api/routes/health'
import connectionsRouter from './api/routes/connections'
import syncRouter from './api/routes/sync'
import inventoryRouter from './api/routes/inventory'
import shopifyRouter from './api/routes/shopify'
import userRouter from './api/routes/user'
import logger from './lib/logger'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3004

// Middleware
app.use(express.json())
app.use(corsMiddleware)

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')))

/*
// Auth0 Configuration
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET || 'a_long_random_string',
  baseURL: process.env.BASE_URL || `http://localhost:${PORT}`,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL
}

// auth router attaches /login, /logout, and /callback routes to the baseURL
if (process.env.AUTH0_CLIENT_ID) {
  app.use(auth(config))
} else {
  logger.warn('Auth0 not configured. Auth routes will not be available.')
}
*/

// Routes
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>RepOrder Connector</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px; line-height: 1.5;">
        <h1>✅ RepOrder Connector is Running</h1>
        <p>This is the backend service for RepOrder.</p>
        <p>
          <a href="/health" style="color: #008060; text-decoration: none; font-weight: bold;">Check Health Status &rarr;</a>
        </p>
      </body>
    </html>
  `)
})

app.use('/', healthRouter)
app.use('/api/connections', connectionsRouter)
app.use('/api/sync', syncRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/shopify', shopifyRouter)
app.use('/api/user', userRouter)

app.get('/api/test-db', async (req, res) => {
  try {
    const { supabase } = require('./lib/supabase')
    const testName = `test-${Date.now()}`
    
    // Try to write
    const { data, error } = await supabase
      .from('stores')
      .insert({ name: testName })
      .select()
      .single()

    if (error) throw error

    res.json({ 
      success: true, 
      message: 'Wrote to DB successfully', 
      data,
      env: {
        url: process.env.SUPABASE_URL,
        keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) + '...'
      }
    })
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      details: error 
    })
  }
})

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
