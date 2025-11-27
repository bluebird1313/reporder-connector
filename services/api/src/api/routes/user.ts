import { Router } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const router = Router()

// GET /api/user/me - Get current user and sync their profile to Supabase
router.get('/me', async (req, res) => {
  try {
    if (!req.oidc || !req.oidc.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = req.oidc.user
    
    // In a real Auth0 setup, the IDP access token (Shopify token)
    // is often passed in the user profile or requires a separate management API call
    // depending on how the "Social Connection" is set up.
    // For now, we will log the user and try to upsert them into the shops table 
    // if we can identify the shop from the profile.
    
    logger.info('User logged in:', { sub: user?.sub, name: user?.name })

    // TODO: Extract Shopify Access Token from Auth0 Identity
    // This often requires `identities[0].access_token` if configured to pass upstream tokens
    
    res.json(user)
  } catch (error) {
    logger.error('Error fetching user:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router





