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
app.use('/', healthRouter)
app.use('/api/connections', connectionsRouter)
app.use('/api/sync', syncRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/shopify', shopifyRouter)
app.use('/api/user', userRouter)

// UI Routes
/*
app.get('/dashboard', (req, res) => {
  if (req.oidc && req.oidc.isAuthenticated()) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))
  } else {
    res.redirect('/login')
  }
})

app.get('/', (req, res) => {
  if (req.oidc && req.oidc.isAuthenticated()) {
    res.redirect('/dashboard')
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  }
})
*/

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
