import { Router } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const router = Router()

// GET /api/inventory/snapshot - Get latest inventory
router.get('/snapshot', async (req, res) => {
  try {
    // In a real app, we'd filter by the logged-in user's shop_id
    const { data, error } = await supabase
      .from('inventory_snapshots')
      .select(`
        *,
        product:products(title),
        location:locations(name)
      `)
      .limit(50)

    if (error) throw error

    // Flatten structure for UI
    const formatted = data.map(item => ({
      ...item,
      title: item.product?.title || 'Unknown Product',
      variant_title: item.variant_external_id, // TODO: Join variants table for real title
      location_name: item.location?.name
    }))

    res.json(formatted)
  } catch (error) {
    logger.error('Error fetching inventory:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router





