import { Router, Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import crypto from 'crypto'

const router = Router()

// Type definitions for Shopify OAuth responses
interface ShopifyTokenResponse {
  access_token: string
  scope: string
  expires_in?: number
  associated_user_scope?: string
  associated_user?: {
    id: number
    first_name: string
    last_name: string
    email: string
    account_owner: boolean
  }
}

// In-memory state management for OAuth (for development)
// In production, consider using Redis or database
const oauthStates = new Map<string, { shop: string; timestamp: number }>()
const STATE_EXPIRY = 10 * 60 * 1000 // 10 minutes

// Cleanup expired states periodically
setInterval(() => {
  const now = Date.now()
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > STATE_EXPIRY) {
      oauthStates.delete(state)
    }
  }
}, 60000) // Every minute

/**
 * GET /api/shopify/auth
 * Initiates OAuth flow - redirects merchant to Shopify authorization screen
 */
router.get('/auth', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string

    if (!shop) {
      return res.status(400).json({
        error: 'Missing shop parameter',
        message: 'Please provide a shop domain (e.g., your-store.myshopify.com)'
      })
    }

    // Normalize shop domain
    const normalizedShop = normalizeShopDomain(shop)

    // Validate shop domain format
    if (!isValidShopDomain(normalizedShop)) {
      return res.status(400).json({
        error: 'Invalid shop domain',
        message: 'Shop domain must be in format: your-store.myshopify.com'
      })
    }

    // Get environment variables
    const clientId = process.env.SHOPIFY_API_KEY
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI
    const scopes = process.env.SHOPIFY_SCOPES || 'read_products,read_inventory,read_locations,read_orders'

    if (!clientId || !redirectUri) {
      logger.error('Missing Shopify configuration', {
        hasClientId: !!clientId,
        hasRedirectUri: !!redirectUri
      })
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Shopify API credentials not configured'
      })
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex')
    oauthStates.set(state, {
      shop: normalizedShop,
      timestamp: Date.now()
    })

    // Build Shopify OAuth URL
    const authUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`)
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('scope', scopes)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('state', state)

    logger.info('Redirecting to Shopify OAuth', {
      shop: normalizedShop,
      scopes: scopes.split(',')
    })

    // Redirect to Shopify
    res.redirect(authUrl.toString())
  } catch (error) {
    logger.error('Error initiating OAuth:', error)
    res.status(500).json({
      error: 'OAuth initialization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/shopify/callback
 * Handles OAuth callback from Shopify - exchanges code for access token
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { shop, code, state, hmac } = req.query

    // Validate required parameters
    if (!shop || !code || !state) {
      return res.status(400).json({
        error: 'Missing OAuth parameters',
        message: 'Required parameters: shop, code, state'
      })
    }

    const shopDomain = shop as string
    const authCode = code as string
    const stateParam = state as string

    // Validate state (CSRF protection)
    const stateData = oauthStates.get(stateParam)
    if (!stateData || stateData.shop !== shopDomain) {
      logger.warn('Invalid OAuth state', { shop: shopDomain, state: stateParam })
      return res.status(403).json({
        error: 'Invalid state parameter',
        message: 'OAuth state validation failed - possible CSRF attack'
      })
    }

    // Remove used state
    oauthStates.delete(stateParam)

    // Validate HMAC signature
    if (hmac) {
      const isValidHmac = validateHmac(req.query)
      if (!isValidHmac) {
        logger.warn('Invalid HMAC signature', { shop: shopDomain })
        return res.status(403).json({
          error: 'Invalid HMAC signature',
          message: 'Request authentication failed'
        })
      }
    }

    // Exchange authorization code for access token
    const clientId = process.env.SHOPIFY_API_KEY
    const clientSecret = process.env.SHOPIFY_API_SECRET

    if (!clientId || !clientSecret) {
      logger.error('Missing Shopify credentials')
      return res.status(500).json({
        error: 'Server configuration error'
      })
    }

    const tokenUrl = `https://${shopDomain}/admin/oauth/access_token`
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Token exchange failed', {
        status: tokenResponse.status,
        error: errorText
      })
      return res.status(tokenResponse.status).json({
        error: 'Token exchange failed',
        message: errorText
      })
    }

    const tokenData = await tokenResponse.json() as ShopifyTokenResponse
    const accessToken = tokenData.access_token
    const scopes = tokenData.scope

    logger.info('Successfully obtained access token', {
      shop: shopDomain,
      scopes: scopes?.split(',')
    })

    // 1. Find or Create Store
    let storeId: string | null = null
    
    const { data: existingStore, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('name', shopDomain) // Using shop domain as name for now
      .single()
    
    if (existingStore) {
      storeId = existingStore.id
    } else {
      // Create new store
      const { data: newStore, error: createError } = await supabase
        .from('stores')
        .insert({ name: shopDomain })
        .select('id')
        .single()
      
      if (createError) {
        throw createError
      }
      storeId = newStore.id
    }

    // 2. Save/Update Connection
    // Check if connection exists
    const { data: existingConnection } = await supabase
      .from('platform_connections')
      .select('id')
      .eq('store_id', storeId)
      .eq('platform', 'shopify')
      .single()

    if (existingConnection) {
      // Update
      const { error: updateError } = await supabase
        .from('platform_connections')
        .update({
          access_token: accessToken,
          scopes: scopes?.split(','),
          shop_domain: shopDomain,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id)
      
      if (updateError) throw updateError
    } else {
      // Insert
       const { error: insertError } = await supabase
        .from('platform_connections')
        .insert({
          store_id: storeId,
          platform: 'shopify',
          shop_domain: shopDomain,
          access_token: accessToken,
          scopes: scopes?.split(','),
          is_active: true
        })
      
      if (insertError) throw insertError
    }

    logger.info('✅ Shopify connection saved', { shop: shopDomain })

    // Success page with database confirmation
    res.send(`
      <html>
        <head><title>OAuth Success</title></head>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1>✅ OAuth Connection Successful!</h1>
          <p><strong>Shop:</strong> ${shopDomain}</p>
          <p><strong>Scopes:</strong> ${scopes}</p>
          <p style="color: green; font-weight: bold;">Your Shopify store is now connected!</p>
          <p><small>✅ Connection saved to database</small></p>
          <script>
            // Optional: Close window or redirect to dashboard
            setTimeout(() => {
              window.location.href = "https://reporder-dashboard.vercel.app"; 
            }, 3000);
          </script>
        </body>
      </html>
    `)
  } catch (error) {
    logger.error('Error in OAuth callback:', error)
    res.status(500).json({
      error: 'OAuth callback failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/shopify/verify
 * Verify if a shop is connected
 */
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string

    if (!shop) {
      return res.status(400).json({
        error: 'Missing shop parameter'
      })
    }

    const normalizedShop = normalizeShopDomain(shop)

    const { data, error } = await supabase
      .from('platform_connections')
      .select('id, shop_domain, is_active, scopes, updated_at')
      .eq('platform', 'shopify')
      .eq('shop_domain', normalizedShop)
      .single()

    if (error || !data) {
      return res.json({
        connected: false,
        shop: normalizedShop
      })
    }

    res.json({
      connected: true,
      shop: data.shop_domain,
      status: data.is_active ? 'active' : 'inactive',
      scopes: data.scopes,
      connectedAt: data.updated_at
    })
  } catch (error) {
    logger.error('Error verifying connection:', error)
    res.status(500).json({
      error: 'Verification failed'
    })
  }
})

// Helper functions
function normalizeShopDomain(shop: string): string {
  // Remove protocol if present
  shop = shop.replace(/^https?:\/\//, '')
  
  // Remove trailing slash
  shop = shop.replace(/\/$/, '')
  
  // If it doesn't end with .myshopify.com, add it
  if (!shop.endsWith('.myshopify.com')) {
    shop = `${shop}.myshopify.com`
  }

  return shop
}

function isValidShopDomain(shop: string): boolean {
  const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]\.myshopify\.com$/
  return shopPattern.test(shop)
}

function validateHmac(query: any): boolean {
  try {
    const { hmac, ...params } = query

    if (!hmac) {
      return false
    }

    // Build query string from parameters (excluding hmac and signature)
    const sortedParams = Object.keys(params)
      .filter(key => key !== 'signature')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')

    // Calculate expected HMAC
    const clientSecret = process.env.SHOPIFY_API_SECRET
    if (!clientSecret) {
      logger.error('SHOPIFY_API_SECRET not configured')
      return false
    }

    const expectedHmac = crypto
      .createHmac('sha256', clientSecret)
      .update(sortedParams, 'utf8')
      .digest('hex')

    // Compare HMACs
    return crypto.timingSafeEqual(
      Buffer.from(expectedHmac),
      Buffer.from(hmac as string)
    )
  } catch (error) {
    logger.error('HMAC validation error:', error)
    return false
  }
}

export default router
