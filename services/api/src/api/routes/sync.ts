import { Router } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const router = Router()

// GET /api/sync/logs - Get sync logs
router.get('/logs', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('recent_sync_status')
      .select('*')
      .limit(100)

    if (error) throw error

    res.json(data || [])
  } catch (error) {
    logger.error('Error fetching sync logs:', error)
    next(error)
  }
})

// GET /api/sync/history/:connectionId - Get sync history for connection
router.get('/history/:connectionId', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('connection_id', req.params.connectionId)
      .order('started_at', { ascending: false })
      .limit(50)

    if (error) throw error

    res.json(data || [])
  } catch (error) {
    logger.error('Error fetching sync history:', error)
    next(error)
  }
})

// POST /api/sync/trigger - Trigger a sync job
router.post('/trigger', async (req, res, next) => {
  try {
    const { connectionId, syncType } = req.body

    if (!connectionId || !syncType) {
      return res.status(400).json({ error: 'Missing connectionId or syncType' })
    }

    // Create sync log entry
    const { data: syncLog, error } = await supabase
      .from('sync_logs')
      .insert({
        connection_id: connectionId,
        sync_type: syncType,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // TODO: Add to job queue
    logger.info(`Sync triggered: ${syncType} for connection ${connectionId}`)

    res.json({ 
      message: 'Sync triggered',
      syncLog 
    })
  } catch (error) {
    logger.error('Error triggering sync:', error)
    next(error)
  }
})

export default router


