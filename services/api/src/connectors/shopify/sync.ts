import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { shopifyGraphQL, PRODUCTS_QUERY, PRODUCTS_BY_VENDORS_QUERY, INVENTORY_LEVELS_QUERY } from './client'

interface ShopifyConnection {
  id: string
  platform: string
  shop_domain: string
  access_token: string
  approved_vendors: string[] | null  // null = all vendors, [] = none, [...] = specific vendors
  setup_complete: boolean
}

interface SyncStats {
  productsProcessed: number
  productsCreated: number
  productsUpdated: number
  inventoryUpdated: number
  alertsCreated: number
}

const DEFAULT_LOW_STOCK_THRESHOLD = 10

export async function syncShop(connectionId: string): Promise<SyncStats> {
  const stats: SyncStats = {
    productsProcessed: 0,
    productsCreated: 0,
    productsUpdated: 0,
    inventoryUpdated: 0,
    alertsCreated: 0
  }

  // Get the connection details including approved vendors
  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('id, platform, shop_domain, access_token, approved_vendors, setup_complete')
    .eq('id', connectionId)
    .single()

  if (error || !connection) {
    throw new Error('Platform connection not found')
  }

  if (connection.platform !== 'shopify') {
    throw new Error('Sync only implemented for Shopify connections')
  }

  // Check if setup is complete (brand selection done)
  if (!connection.setup_complete) {
    logger.warn(`⚠️ Skipping sync - brand selection not complete for ${connection.shop_domain}`)
    throw new Error('Brand selection not complete. Retailer must approve vendors before sync.')
  }

  // Check if any vendors are approved
  if (connection.approved_vendors && connection.approved_vendors.length === 0) {
    logger.warn(`⚠️ Skipping sync - no vendors approved for ${connection.shop_domain}`)
    return stats // Return empty stats - no products to sync
  }

  const vendorInfo = connection.approved_vendors 
    ? `${connection.approved_vendors.length} approved vendor(s): ${connection.approved_vendors.join(', ')}`
    : 'ALL vendors (full access)'

  logger.info(`🚀 Starting sync for Shopify store: ${connection.shop_domain}`)
  logger.info(`🏷️ Syncing: ${vendorInfo}`)

  try {
    // Sync all products and inventory
    await syncProducts(connection, stats)

    // Check for low stock alerts
    await checkLowStockAlerts(connection.id, stats)

    // Update last sync timestamp
    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId)

    logger.info(`✅ Sync completed for ${connection.shop_domain}`, stats)
    return stats

  } catch (err) {
    logger.error(`❌ Sync failed for ${connection.shop_domain}`, err)
    throw err
  }
}

async function syncProducts(connection: ShopifyConnection, stats: SyncStats) {
  let hasNextPage = true
  let cursor = null

  // Build vendor filter query if specific vendors are approved
  // null = all vendors (no filter needed)
  // [...] = specific vendors only
  const approvedVendors = connection.approved_vendors
  const useVendorFilter = approvedVendors !== null && approvedVendors.length > 0

  // Build Shopify query string for vendor filter
  // Format: vendor:"Brand1" OR vendor:"Brand2"
  const vendorQuery = useVendorFilter
    ? approvedVendors.map(v => `vendor:"${v}"`).join(' OR ')
    : null

  while (hasNextPage) {
    // Fetch products from Shopify - use filtered query if vendors are specified
    let data: any
    
    if (vendorQuery) {
      // Use vendor-filtered query
      data = await shopifyGraphQL(
        connection.shop_domain,
        connection.access_token,
        PRODUCTS_BY_VENDORS_QUERY,
        { first: 25, cursor, query: vendorQuery }
      )
    } else {
      // Fetch all products (full access)
      data = await shopifyGraphQL(
        connection.shop_domain,
        connection.access_token,
        PRODUCTS_QUERY,
        { first: 25, cursor }
      )
    }

    const products = data.products.edges.map((e: any) => e.node)
    logger.info(`📦 Processing ${products.length} products...${vendorQuery ? ' (filtered by approved vendors)' : ''}`)

    for (const product of products) {
      // Process each variant as a product in our system
      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node
        stats.productsProcessed++

        // Extract the numeric ID from Shopify's GID
        const externalId = variant.id.replace('gid://shopify/ProductVariant/', '')
        const sku = variant.sku || externalId
        const name = variant.title && variant.title !== 'Default Title'
          ? `${product.title} - ${variant.title}`
          : product.title

        // Check if product already exists (by external_id or sku)
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('connection_id', connection.id)
          .or(`external_id.eq.${externalId},sku.eq.${sku}`)
          .maybeSingle()

        let productId: string

        if (existingProduct) {
          // Update existing product
          const { error: updateError } = await supabase
            .from('products')
            .update({
              sku,
              name,
              brand: product.vendor || 'Unknown',
              external_id: externalId,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProduct.id)

          if (updateError) {
            logger.error('Error updating product', { error: updateError, name })
            continue
          }

          productId = existingProduct.id
          stats.productsUpdated++

        } else {
          // Create new product
          const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert({
              connection_id: connection.id,
              external_id: externalId,
              sku,
              name,
              brand: product.vendor || 'Unknown',
              default_min_stock: DEFAULT_LOW_STOCK_THRESHOLD
            })
            .select('id')
            .single()

          if (insertError || !newProduct) {
            logger.error('Error creating product', { error: insertError, name })
            continue
          }

          productId = newProduct.id
          stats.productsCreated++
        }

        // Sync inventory for this variant
        if (variant.inventoryItem?.id) {
          await syncInventory(connection, productId, variant.inventoryItem.id, stats)
        }
      }
    }

    // Pagination
    hasNextPage = data.products.pageInfo.hasNextPage
    cursor = data.products.pageInfo.endCursor
  }
}

async function syncInventory(
  connection: ShopifyConnection,
  productId: string,
  inventoryItemId: string,
  stats: SyncStats
) {
  try {
    const data: any = await shopifyGraphQL(
      connection.shop_domain,
      connection.access_token,
      INVENTORY_LEVELS_QUERY,
      { inventoryItemId, first: 10 }
    )

    if (!data.inventoryItem?.inventoryLevels) {
      return
    }

    const levels = data.inventoryItem.inventoryLevels.edges.map((e: any) => e.node)

    for (const level of levels) {
      const available = level.quantities?.find((q: any) => q.name === 'available')
      const quantity = available ? available.quantity : 0
      const locationName = level.location?.name || 'Unknown Location'

      // Upsert inventory level
      const { data: existingLevel } = await supabase
        .from('inventory_levels')
        .select('id, quantity')
        .eq('product_id', productId)
        .eq('location_name', locationName)
        .maybeSingle()

      if (existingLevel) {
        // Only update if quantity changed
        if (existingLevel.quantity !== quantity) {
          await supabase
            .from('inventory_levels')
            .update({
              quantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingLevel.id)
          
          stats.inventoryUpdated++
        }
      } else {
        // Create new inventory level
        await supabase
          .from('inventory_levels')
          .insert({
            product_id: productId,
            location_name: locationName,
            quantity,
            low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD
          })
        
        stats.inventoryUpdated++
      }
    }
  } catch (err) {
    logger.error('Error syncing inventory', { productId, inventoryItemId, error: err })
  }
}

async function checkLowStockAlerts(connectionId: string, stats: SyncStats) {
  logger.info('🔍 Checking for low stock alerts...')

  // Find all products with inventory below threshold
  const { data: lowStockItems, error } = await supabase
    .from('inventory_levels')
    .select(`
      id,
      quantity,
      low_stock_threshold,
      product_id,
      location_name,
      products!inner (
        id,
        name,
        sku,
        connection_id
      )
    `)
    .eq('products.connection_id', connectionId)

  if (error || !lowStockItems) {
    logger.error('Error checking low stock', error)
    return
  }

  for (const item of lowStockItems) {
    const threshold = item.low_stock_threshold || DEFAULT_LOW_STOCK_THRESHOLD
    const isLowStock = item.quantity <= threshold

    if (isLowStock) {
      // Check if there's already an open alert for this product
      const { data: existingAlert } = await supabase
        .from('alerts')
        .select('id')
        .eq('product_id', item.product_id)
        .eq('status', 'open')
        .maybeSingle()

      if (!existingAlert) {
        // Create new alert
        const { error: alertError } = await supabase
          .from('alerts')
          .insert({
            product_id: item.product_id,
            connection_id: connectionId,
            alert_type: 'low_stock',
            quantity: item.quantity,
            threshold: threshold,
            status: 'open'
          })

        if (!alertError) {
          stats.alertsCreated++
          const product = item.products as any
          logger.warn(`⚠️ LOW STOCK ALERT: ${product.name} (${product.sku}) - ${item.quantity} units at ${item.location_name}`)
        }
      }
    } else {
      // If stock is above threshold, resolve any open alerts
      await supabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('product_id', item.product_id)
        .eq('status', 'open')
    }
  }

  logger.info(`📊 Alert check complete: ${stats.alertsCreated} new alerts created`)
}
