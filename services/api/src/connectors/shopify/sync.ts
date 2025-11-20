import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { shopifyGraphQL, PRODUCTS_QUERY, INVENTORY_LEVELS_QUERY } from './client'

export async function syncShop(shopId: string) {
  // 1. Get shop credentials
  const { data: shop, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single()

  if (error || !shop) throw new Error('Shop not found')

  logger.info(`Starting sync for shop: ${shop.shop_domain}`)

  try {
    // 2. Sync Products
    await syncProducts(shop)
    
    // 3. Update last sync time
    await supabase
      .from('shops')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', shopId)

    logger.info(`Sync completed for shop: ${shop.shop_domain}`)
  } catch (err) {
    logger.error(`Sync failed for shop: ${shop.shop_domain}`, err)
    throw err
  }
}

async function syncProducts(shop: any) {
  let hasNextPage = true
  let cursor = null

  while (hasNextPage) {
    const data: any = await shopifyGraphQL(shop.shop_domain, shop.access_token, PRODUCTS_QUERY, { first: 10, cursor })
    const products = data.products.edges.map((e: any) => e.node)

    for (const p of products) {
      // Upsert Product
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .upsert({
          platform: 'shopify',
          shop_id: shop.id,
          external_id: p.id,
          title: p.title,
          handle: p.handle,
          status: p.status.toLowerCase(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'platform,shop_id,external_id' })
        .select()
        .single()

      if (prodError) {
        logger.error('Error upserting product', { error: prodError, product: p.title })
        continue
      }

      // Upsert Variants
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node
        
        // Upsert Variant
        const { data: varData, error: varError } = await supabase
          .from('variants')
          .upsert({
            platform: 'shopify',
            shop_id: shop.id,
            product_id: prodData.id,
            external_id: v.id,
            external_product_id: p.id,
            title: v.title,
            sku: v.sku,
            price: v.price,
            updated_at: new Date().toISOString()
          }, { onConflict: 'platform,shop_id,external_id' })
          .select()
          .single()

        if (varError) {
           logger.error('Error upserting variant', { error: varError, variant: v.title })
           continue
        }

        // Sync Inventory for this variant
        if (v.inventoryItem && v.inventoryItem.id) {
           await syncInventory(shop, v.inventoryItem.id, v.id)
        }
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage
    cursor = data.products.pageInfo.endCursor
  }
}

async function syncInventory(shop: any, inventoryItemId: string, variantExternalId: string) {
  const data: any = await shopifyGraphQL(shop.shop_domain, shop.access_token, INVENTORY_LEVELS_QUERY, { inventoryItemId, first: 10 })
  
  // Ensure we have inventory item data
  if (!data.inventoryItem || !data.inventoryItem.inventoryLevels) return

  const levels = data.inventoryItem.inventoryLevels.edges.map((e: any) => e.node)

  for (const level of levels) {
    // We need to ensure the location exists in our DB first
    // For simplicity, we'll do a quick upsert of the location
    await supabase.from('locations').upsert({
      platform: 'shopify',
      shop_id: shop.id,
      external_id: level.location.id,
      name: level.location.name,
      updated_at: new Date().toISOString()
    }, { onConflict: 'platform,shop_id,external_id' })

    const available = level.quantities.find((q: any) => q.name === 'available')
    const quantity = available ? available.quantity : 0

    // Upsert Inventory Snapshot
    await supabase.from('inventory_snapshots').upsert({
      platform: 'shopify',
      shop_id: shop.id,
      variant_external_id: variantExternalId,
      location_external_id: level.location.id,
      quantity: quantity,
      last_updated_at: new Date().toISOString()
    }, { onConflict: 'platform,shop_id,variant_external_id,location_external_id' })
  }
}



