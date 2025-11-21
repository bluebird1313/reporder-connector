import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { shopifyGraphQL, PRODUCTS_QUERY, INVENTORY_LEVELS_QUERY } from './client'

interface ShopifyConnection {
  id: string
  platform: string
  shop_domain: string
  access_token: string
}

export async function syncShop(connectionId: string) {
  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('id, platform, shop_domain, access_token')
    .eq('id', connectionId)
    .single()

  if (error || !connection) {
    throw new Error('Platform connection not found')
  }

  if (connection.platform !== 'shopify') {
    throw new Error('Sync only implemented for Shopify connections')
  }

  logger.info(`Starting sync for Shopify store: ${connection.shop_domain}`)

  try {
    await syncProducts(connection)

    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId)

    logger.info(`Sync completed for Shopify store: ${connection.shop_domain}`)
  } catch (err) {
    logger.error(`Sync failed for Shopify store: ${connection.shop_domain}`, err)
    throw err
  }
}

async function syncProducts(connection: ShopifyConnection) {
  let hasNextPage = true
  let cursor = null

  while (hasNextPage) {
    const data: any = await shopifyGraphQL(
      connection.shop_domain,
      connection.access_token,
      PRODUCTS_QUERY,
      { first: 10, cursor }
    )
    const products = data.products.edges.map((e: any) => e.node)

    for (const p of products) {
      // Upsert Variants as products in our simplified schema
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node

        const sku = v.sku || v.id
        const name =
          v.title && v.title !== 'Default Title'
            ? `${p.title} - ${v.title}`
            : p.title

        const { data: productRow, error: productError } = await supabase
          .from('products')
          .upsert(
            {
              sku,
              name,
              brand: p.vendor || 'Shopify',
              default_min_stock: 0,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'sku' }
          )
          .select()
          .single()

        if (productError || !productRow) {
          logger.error('Error upserting product', { error: productError, product: name })
          continue
        }

        // Sync Inventory for this variant
        if (v.inventoryItem && v.inventoryItem.id) {
          await syncInventory(connection, productRow.id, v.inventoryItem.id)
        }
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage
    cursor = data.products.pageInfo.endCursor
  }
}

async function syncInventory(connection: ShopifyConnection, productId: string, inventoryItemId: string) {
  const data: any = await shopifyGraphQL(
    connection.shop_domain,
    connection.access_token,
    INVENTORY_LEVELS_QUERY,
    { inventoryItemId, first: 10 }
  )
  
  // Ensure we have inventory item data
  if (!data.inventoryItem || !data.inventoryItem.inventoryLevels) return

  const levels = data.inventoryItem.inventoryLevels.edges.map((e: any) => e.node)

  for (const level of levels) {
    const available = level.quantities.find((q: any) => q.name === 'available')
    const quantity = available ? available.quantity : 0
    const locationName = level.location?.name || 'Unknown Location'

    // Check if we already have an inventory level row for this product + location
    const { data: existingLevel } = await supabase
      .from('inventory_levels')
      .select('id')
      .eq('product_id', productId)
      .eq('location_name', locationName)
      .maybeSingle()

    if (existingLevel) {
      await supabase
        .from('inventory_levels')
        .update({
          quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLevel.id)
    } else {
      await supabase.from('inventory_levels').insert({
        product_id: productId,
        location_name: locationName,
        quantity,
        updated_at: new Date().toISOString()
      })
    }
  }
}
