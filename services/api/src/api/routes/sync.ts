import { Router } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { syncShop } from '../../connectors/shopify/sync'

const router = Router()

// GET /api/sync/logs - Get sync logs
router.get('/logs', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100)

    if (error) throw error

    res.json(data || [])
  } catch (error) {
    logger.error('Error fetching sync logs:', error)
    next(error)
  }
})

// POST /api/sync/trigger - Trigger a sync job
router.post('/trigger', async (req, res, next) => {
  try {
    const { connectionId, syncType } = req.body

    let shopId = connectionId

    // If no connectionId provided, find the first active shop
    if (!shopId) {
       const { data: shop } = await supabase
         .from('shops')
         .select('id')
         .limit(1)
         .single()
       
       if (shop) {
         shopId = shop.id
       } else {
         return res.status(400).json({ error: 'No shops connected' })
       }
    }

    // Create sync log entry
    const { data: syncLog, error } = await supabase
      .from('sync_logs')
      .insert({
        connection_id: shopId,
        sync_type: syncType || 'full',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // Trigger Sync asynchronously (fire and forget for response)
    // In production, use a queue (BullMQ, etc.)
    syncShop(shopId)
      .then(async () => {
         await supabase.from('sync_logs').update({ 
           status: 'completed', 
           completed_at: new Date().toISOString() 
         }).eq('id', syncLog.id)
      })
      .catch(async (err) => {
         await supabase.from('sync_logs').update({ 
           status: 'failed', 
           error_message: err.message,
           completed_at: new Date().toISOString() 
         }).eq('id', syncLog.id)
      })

    res.json({ 
      message: 'Sync started',
      syncLog 
    })
  } catch (error) {
    logger.error('Error triggering sync:', error)
    next(error)
  }
})

export default router
