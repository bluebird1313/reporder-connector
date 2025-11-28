import { Router, Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { shopifyGraphQL, VENDORS_QUERY } from '../../connectors/shopify/client'
import { syncShop } from '../../connectors/shopify/sync'

const router = Router()

/**
 * GET /api/vendors/:connectionId
 * Fetch all vendors (brands) from a Shopify store
 * Used by the brand picker page to show retailer their options
 */
router.get('/:connectionId', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('platform_connections')
      .select('id, shop_domain, access_token, platform, approved_vendors, setup_complete')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      return res.status(404).json({ error: 'Connection not found' })
    }

    if (connection.platform !== 'shopify') {
      return res.status(400).json({ error: 'Only Shopify connections supported' })
    }

    // Fetch vendors from Shopify
    const data: any = await shopifyGraphQL(
      connection.shop_domain,
      connection.access_token,
      VENDORS_QUERY,
      { first: 250 }
    )

    const vendors = data.productVendors.edges
      .map((e: any) => e.node)
      .filter((v: string) => v && v.trim() !== '') // Filter out empty vendors
      .sort((a: string, b: string) => a.localeCompare(b))

    const shopName = data.shop?.name || connection.shop_domain

    res.json({
      shopName,
      shopDomain: connection.shop_domain,
      vendors,
      approvedVendors: connection.approved_vendors,
      setupComplete: connection.setup_complete,
      totalVendors: vendors.length
    })

  } catch (error) {
    logger.error('Error fetching vendors:', error)
    res.status(500).json({
      error: 'Failed to fetch vendors',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * POST /api/vendors/:connectionId/approve
 * Save the retailer's approved vendor selection
 * Body: { vendors: string[] | null }
 * - vendors: array of vendor names to approve
 * - null means "all vendors" (full access)
 */
router.post('/:connectionId/approve', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params
    const { vendors, selectAll } = req.body

    // Validate input
    if (selectAll !== true && !Array.isArray(vendors)) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Body must contain either { selectAll: true } or { vendors: string[] }'
      })
    }

    // Get connection to verify it exists
    const { data: connection, error: connError } = await supabase
      .from('platform_connections')
      .select('id, shop_domain')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      return res.status(404).json({ error: 'Connection not found' })
    }

    // Update approved vendors
    // null = all vendors (full access)
    // [] = no vendors (no access)
    // ['Vendor1', 'Vendor2'] = specific vendors only
    const approvedVendors = selectAll === true ? null : vendors

    const { error: updateError } = await supabase
      .from('platform_connections')
      .update({
        approved_vendors: approvedVendors,
        setup_complete: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    if (updateError) {
      throw updateError
    }

    logger.info('✅ Vendor access approved', {
      shop: connection.shop_domain,
      connectionId,
      approvedCount: selectAll ? 'ALL' : vendors.length,
      vendors: selectAll ? 'ALL' : vendors
    })

    // Start sync in background now that setup is complete
    logger.info('🔄 Starting sync after vendor approval...', { connectionId })
    
    syncShop(connectionId)
      .then((stats) => {
        logger.info('✅ Post-approval sync completed', { shop: connection.shop_domain, stats })
      })
      .catch((syncError) => {
        logger.error('❌ Post-approval sync failed', { shop: connection.shop_domain, error: syncError })
      })

    res.json({
      success: true,
      message: selectAll 
        ? 'Full access granted - syncing all vendors'
        : `Access granted for ${vendors.length} vendor(s)`,
      approvedVendors,
      setupComplete: true
    })

  } catch (error) {
    logger.error('Error approving vendors:', error)
    res.status(500).json({
      error: 'Failed to save vendor selection',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/vendors/:connectionId/status
 * Check if a connection has completed brand setup
 */
router.get('/:connectionId/status', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params

    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('id, shop_domain, approved_vendors, setup_complete')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      return res.status(404).json({ error: 'Connection not found' })
    }

    res.json({
      connectionId: connection.id,
      shopDomain: connection.shop_domain,
      setupComplete: connection.setup_complete,
      accessType: connection.approved_vendors === null 
        ? 'full' 
        : connection.approved_vendors.length === 0 
          ? 'none' 
          : 'partial',
      approvedVendorCount: connection.approved_vendors?.length ?? 'all'
    })

  } catch (error) {
    logger.error('Error checking vendor status:', error)
    res.status(500).json({ error: 'Failed to check status' })
  }
})

export default router

