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

// DELETE /api/connections/:id - Delete connection
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

export default router


