import express, { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const router = Router()

/**
 * Verify Shopify webhook signature using HMAC-SHA256
 * This is REQUIRED by Shopify for all webhook endpoints
 */
function verifyWebhookSignature(rawBody: Buffer, hmacHeader: string | undefined): boolean {
  if (!hmacHeader) {
    logger.warn('Missing X-Shopify-Hmac-Sha256 header')
    return false
  }

  const clientSecret = process.env.SHOPIFY_API_SECRET
  if (!clientSecret) {
    logger.error('SHOPIFY_API_SECRET not configured for webhook verification')
    return false
  }

  try {
    const calculatedHmac = crypto
      .createHmac('sha256', clientSecret)
      .update(rawBody)
      .digest('base64')

    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(calculatedHmac),
      Buffer.from(hmacHeader)
    )

    if (!isValid) {
      logger.warn('Webhook HMAC mismatch', {
        expected: calculatedHmac.substring(0, 10) + '...',
        received: hmacHeader.substring(0, 10) + '...'
      })
    }

    return isValid
  } catch (error) {
    logger.error('Webhook signature verification error:', error)
    return false
  }
}

// ============================================================
// GDPR MANDATORY COMPLIANCE WEBHOOKS
// These endpoints are REQUIRED by Shopify for all public apps
// Reference: https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks
// ============================================================

/**
 * POST /api/shopify/webhooks/customers/data_request
 * GDPR: Customer requests their data
 * Shopify sends this when a customer requests their data from a store
 */
router.post('/customers/data_request', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string
    const rawBody = req.body as Buffer
    
    // HMAC verification is REQUIRED
    if (!verifyWebhookSignature(rawBody, hmacHeader)) {
      logger.warn('❌ Invalid webhook signature for customers/data_request')
      return res.status(401).json({ error: 'Unauthorized - Invalid HMAC signature' })
    }

    const payload = JSON.parse(rawBody.toString('utf8'))
    
    logger.info('📋 GDPR Customer Data Request received', {
      shop_domain: payload.shop_domain,
      shop_id: payload.shop_id,
      customer_id: payload.customer?.id,
      customer_email: payload.customer?.email,
      orders_requested: payload.orders_requested
    })

    // RepOrder only stores product/inventory data, NOT customer personal data
    // We acknowledge the request but have no customer data to provide
    // If you store customer data in the future, compile and return it here

    res.status(200).json({ 
      success: true,
      message: 'Data request acknowledged. RepOrder does not store customer personal data.'
    })
  } catch (error) {
    logger.error('Error handling customer data request webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

/**
 * POST /api/shopify/webhooks/customers/redact
 * GDPR: Request to delete customer data
 * Shopify sends this when a customer requests data deletion from a store
 */
router.post('/customers/redact', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string
    const rawBody = req.body as Buffer
    
    // HMAC verification is REQUIRED
    if (!verifyWebhookSignature(rawBody, hmacHeader)) {
      logger.warn('❌ Invalid webhook signature for customers/redact')
      return res.status(401).json({ error: 'Unauthorized - Invalid HMAC signature' })
    }

    const payload = JSON.parse(rawBody.toString('utf8'))
    
    logger.info('🗑️ GDPR Customer Redact Request received', {
      shop_domain: payload.shop_domain,
      shop_id: payload.shop_id,
      customer_id: payload.customer?.id,
      customer_email: payload.customer?.email,
      orders_to_redact: payload.orders_to_redact
    })

    // RepOrder only stores product/inventory data, NOT customer personal data
    // We acknowledge the request - no customer data to delete
    // If you store customer data in the future, delete it here

    res.status(200).json({ 
      success: true,
      message: 'Redact request acknowledged. RepOrder does not store customer personal data.'
    })
  } catch (error) {
    logger.error('Error handling customer redact webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

/**
 * POST /api/shopify/webhooks/shop/redact
 * GDPR: Request to delete all shop data
 * Shopify sends this 48 hours after an app is uninstalled
 */
router.post('/shop/redact', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string
    const rawBody = req.body as Buffer
    
    // HMAC verification is REQUIRED
    if (!verifyWebhookSignature(rawBody, hmacHeader)) {
      logger.warn('❌ Invalid webhook signature for shop/redact')
      return res.status(401).json({ error: 'Unauthorized - Invalid HMAC signature' })
    }

    const payload = JSON.parse(rawBody.toString('utf8'))
    const shopDomain = payload.shop_domain
    
    logger.info('🏪 GDPR Shop Redact Request received', {
      shop_domain: shopDomain,
      shop_id: payload.shop_id
    })

    // Delete ALL data associated with this shop
    const { data: connection } = await supabase
      .from('platform_connections')
      .select('id, store_id')
      .eq('shop_domain', shopDomain)
      .single()

    if (connection) {
      // Delete in order to respect foreign key constraints
      
      // 1. Delete alerts
      const { error: alertsError } = await supabase
        .from('alerts')
        .delete()
        .eq('connection_id', connection.id)
      
      if (alertsError) logger.warn('Error deleting alerts:', alertsError)

      // 2. Delete inventory levels
      const { error: inventoryError } = await supabase
        .from('inventory_levels')
        .delete()
        .eq('connection_id', connection.id)
      
      if (inventoryError) logger.warn('Error deleting inventory:', inventoryError)

      // 3. Delete products
      const { error: productsError } = await supabase
        .from('products')
        .delete()
        .eq('connection_id', connection.id)
      
      if (productsError) logger.warn('Error deleting products:', productsError)

      // 4. Delete the connection itself
      const { error: connectionError } = await supabase
        .from('platform_connections')
        .delete()
        .eq('id', connection.id)
      
      if (connectionError) logger.warn('Error deleting connection:', connectionError)

      logger.info('✅ All shop data deleted for GDPR compliance', { 
        shop_domain: shopDomain,
        connection_id: connection.id 
      })
    } else {
      logger.info('No data found for shop (already deleted or never connected)', { 
        shop_domain: shopDomain 
      })
    }

    res.status(200).json({ 
      success: true,
      message: 'Shop data redacted successfully'
    })
  } catch (error) {
    logger.error('Error handling shop redact webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

/**
 * POST /api/shopify/webhooks/app/uninstalled
 * Handle app uninstall - mark connection as inactive immediately
 * Full data deletion happens via shop/redact 48 hours later
 */
router.post('/app/uninstalled', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string
    const rawBody = req.body as Buffer
    
    // HMAC verification is REQUIRED
    if (!verifyWebhookSignature(rawBody, hmacHeader)) {
      logger.warn('❌ Invalid webhook signature for app/uninstalled')
      return res.status(401).json({ error: 'Unauthorized - Invalid HMAC signature' })
    }

    const payload = JSON.parse(rawBody.toString('utf8'))
    const shopDomain = payload.myshopify_domain || payload.domain
    
    logger.info('🔌 App Uninstalled webhook received', {
      shop_domain: shopDomain,
      shop_id: payload.id,
      name: payload.name
    })

    // Mark the connection as inactive and clear the token
    // Don't delete data yet - shop/redact will handle full deletion in 48 hours
    const { data, error } = await supabase
      .from('platform_connections')
      .update({ 
        is_active: false,
        access_token: null, // Clear token immediately for security
        updated_at: new Date().toISOString()
      })
      .eq('shop_domain', shopDomain)
      .select('id')

    if (error) {
      logger.error('Error marking connection inactive:', error)
    } else if (data && data.length > 0) {
      logger.info('✅ Connection marked inactive', { 
        shop_domain: shopDomain,
        connection_id: data[0].id 
      })
    } else {
      logger.info('No active connection found for shop', { shop_domain: shopDomain })
    }

    res.status(200).json({ success: true })
  } catch (error) {
    logger.error('Error handling app uninstalled webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

export default router

