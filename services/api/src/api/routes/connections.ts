import { Router } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const router = Router()

// GET /api/connections - List all platform connections
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('platform_connections')
      .select(`
        *,
        stores (
          id,
          name,
          address
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(data || [])
  } catch (error) {
    logger.error('Error fetching connections:', error)
    next(error)
  }
})

// GET /api/connections/:id - Get single connection
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error

    res.json(data)
  } catch (error) {
    logger.error('Error fetching connection:', error)
    next(error)
  }
})

// POST /api/connections - Create new connection
router.post('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('platform_connections')
      .insert(req.body)
      .select()
      .single()

    if (error) throw error

    res.status(201).json(data)
  } catch (error) {
    logger.error('Error creating connection:', error)
    next(error)
  }
})

// POST /api/connections/:id/disconnect - Properly disconnect a store
router.post('/:id/disconnect', async (req, res, next) => {
  const connectionId = req.params.id
  
  logger.info(`🔌 Starting disconnect process for connection: ${connectionId}`)

  try {
    // 1. Get the connection details
    const { data: connection, error: fetchError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (fetchError || !connection) {
      logger.warn(`Connection not found: ${connectionId}`)
      return res.status(404).json({ error: 'Connection not found' })
    }

    logger.info(`Disconnecting store: ${connection.shop_domain}`)

    // 2. Unsubscribe from Shopify webhooks (if Shopify)
    if (connection.platform === 'shopify' && connection.access_token) {
      try {
        await unsubscribeShopifyWebhooks(connection.shop_domain, connection.access_token)
        logger.info(`✅ Unsubscribed from Shopify webhooks`)
      } catch (webhookError) {
        // Log but don't fail - webhooks may already be gone
        logger.warn(`⚠️ Could not unsubscribe webhooks (may already be removed):`, webhookError)
      }
    }

    // 3. Delete alerts for this connection
    const { error: alertsError } = await supabase
      .from('alerts')
      .delete()
      .eq('connection_id', connectionId)

    if (alertsError) {
      logger.error('Error deleting alerts:', alertsError)
    } else {
      logger.info(`✅ Deleted alerts for connection`)
    }

    // 4. Get product IDs for this connection (needed to delete inventory_levels)
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('connection_id', connectionId)

    const productIds = products?.map((p: any) => p.id) || []
    const productCount = productIds.length

    // 5. Delete inventory levels for those products
    if (productIds.length > 0) {
      const { error: inventoryError } = await supabase
        .from('inventory_levels')
        .delete()
        .in('product_id', productIds)

      if (inventoryError) {
        logger.error('Error deleting inventory levels:', inventoryError)
      } else {
        logger.info(`✅ Deleted inventory levels for ${productCount} products`)
      }
    }

    // 6. Delete products for this connection
    const { error: productsError } = await supabase
      .from('products')
      .delete()
      .eq('connection_id', connectionId)

    if (productsError) {
      logger.error('Error deleting products:', productsError)
    } else {
      logger.info(`✅ Deleted ${productCount} products`)
    }

    // 7. Delete the connection itself
    const { error: connectionError } = await supabase
      .from('platform_connections')
      .delete()
      .eq('id', connectionId)

    if (connectionError) {
      throw connectionError
    }

    logger.info(`✅ Successfully disconnected store: ${connection.shop_domain}`)

    // 8. Return success with summary
    res.json({
      success: true,
      message: `Successfully disconnected ${connection.shop_domain}`,
      summary: {
        shop_domain: connection.shop_domain,
        platform: connection.platform,
        products_deleted: productCount,
        alerts_deleted: 'cleaned',
        inventory_deleted: 'cleaned'
      }
    })

  } catch (error) {
    logger.error(`❌ Error disconnecting connection ${connectionId}:`, error)
    next(error)
  }
})

// DELETE /api/connections/:id - Simple delete (backwards compatibility)
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('platform_connections')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error

    res.status(204).send()
  } catch (error) {
    logger.error('Error deleting connection:', error)
    next(error)
  }
})

// Helper function to unsubscribe from Shopify webhooks
async function unsubscribeShopifyWebhooks(shopDomain: string, accessToken: string) {
  // First, get all existing webhooks
  const webhooksUrl = `https://${shopDomain}/admin/api/2024-10/webhooks.json`
  
  const response = await fetch(webhooksUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch webhooks: ${response.status}`)
  }

  const data = await response.json() as { webhooks?: any[] }
  const webhooks = data.webhooks || []

  // Delete each webhook
  for (const webhook of webhooks) {
    const deleteUrl = `https://${shopDomain}/admin/api/2024-10/webhooks/${webhook.id}.json`
    
    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    })
    
    logger.info(`Deleted webhook ${webhook.id} (${webhook.topic})`)
  }

  return webhooks.length
}

export default router
