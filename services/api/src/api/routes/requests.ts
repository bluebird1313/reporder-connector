import { Router, Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const router = Router()

/**
 * GET /api/requests
 * List all restock requests
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { connection_id, status } = req.query

    let query = supabase
      .from('restock_requests')
      .select(`
        id,
        connection_id,
        status,
        magic_token,
        sent_at,
        approved_at,
        rejected_at,
        retailer_notes,
        created_at,
        platform_connections (
          shop_domain
        ),
        restock_request_items (
          id
        )
      `)
      .order('created_at', { ascending: false })

    if (connection_id) {
      query = query.eq('connection_id', connection_id as string)
    }
    if (status) {
      query = query.eq('status', status as string)
    }

    const { data, error } = await query

    if (error) throw error

    res.json(data)
  } catch (error) {
    logger.error('Error fetching requests:', error)
    res.status(500).json({ error: 'Failed to fetch requests' })
  }
})

/**
 * GET /api/requests/:id
 * Get a specific restock request
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data: request, error: requestError } = await supabase
      .from('restock_requests')
      .select(`
        *,
        platform_connections (
          shop_domain
        )
      `)
      .eq('id', id)
      .single()

    if (requestError) throw requestError

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('restock_request_items')
      .select(`
        *,
        products (
          name,
          sku
        )
      `)
      .eq('request_id', id)

    if (itemsError) throw itemsError

    res.json({ ...request, items })
  } catch (error) {
    logger.error('Error fetching request:', error)
    res.status(500).json({ error: 'Failed to fetch request' })
  }
})

/**
 * POST /api/requests
 * Create a new restock request
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { connection_id, items, notes, send_now } = req.body

    if (!connection_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'connection_id and items are required' })
    }

    // Create the request
    const { data: request, error: requestError } = await supabase
      .from('restock_requests')
      .insert({
        connection_id,
        status: send_now ? 'pending' : 'draft',
        sent_at: send_now ? new Date().toISOString() : null,
        retailer_notes: notes || null
      })
      .select()
      .single()

    if (requestError) throw requestError

    // Add items
    const requestItems = items.map((item: any) => ({
      request_id: request.id,
      product_id: item.product_id,
      current_quantity: item.current_quantity,
      requested_quantity: item.requested_quantity
    }))

    const { error: itemsError } = await supabase
      .from('restock_request_items')
      .insert(requestItems)

    if (itemsError) throw itemsError

    logger.info('Restock request created', { requestId: request.id, items: items.length })

    res.status(201).json(request)
  } catch (error) {
    logger.error('Error creating request:', error)
    res.status(500).json({ error: 'Failed to create request' })
  }
})

/**
 * POST /api/requests/:id/send
 * Send a request for approval
 */
router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('restock_requests')
      .update({
        status: 'pending',
        sent_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // TODO: Send email notification to retailer
    // This would integrate with an email service like SendGrid, Resend, etc.
    logger.info('Restock request sent for approval', { requestId: id })

    res.json(data)
  } catch (error) {
    logger.error('Error sending request:', error)
    res.status(500).json({ error: 'Failed to send request' })
  }
})

/**
 * GET /api/requests/approve/:token
 * Get request details by magic token (for retailer approval page)
 */
router.get('/approve/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const { data: request, error: requestError } = await supabase
      .from('restock_requests')
      .select(`
        id,
        status,
        token_expires_at,
        retailer_notes,
        created_at,
        platform_connections (
          shop_domain
        )
      `)
      .eq('magic_token', token)
      .single()

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    // Check if expired
    if (new Date(request.token_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Approval link has expired' })
    }

    // Check if already processed
    if (request.status === 'approved' || request.status === 'rejected') {
      return res.json({ ...request, already_processed: true })
    }

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('restock_request_items')
      .select(`
        id,
        product_id,
        current_quantity,
        requested_quantity,
        approved_quantity,
        products (
          name,
          sku
        )
      `)
      .eq('request_id', request.id)

    if (itemsError) throw itemsError

    res.json({ ...request, items })
  } catch (error) {
    logger.error('Error fetching request by token:', error)
    res.status(500).json({ error: 'Failed to fetch request' })
  }
})

/**
 * POST /api/requests/approve/:token
 * Process retailer approval/rejection
 */
router.post('/approve/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { approved, items, notes } = req.body

    // Find request by token
    const { data: request, error: findError } = await supabase
      .from('restock_requests')
      .select('id, status, token_expires_at')
      .eq('magic_token', token)
      .single()

    if (findError || !request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    // Check if expired
    if (new Date(request.token_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Approval link has expired' })
    }

    // Check if already processed
    if (request.status === 'approved' || request.status === 'rejected') {
      return res.status(400).json({ error: 'Request already processed' })
    }

    if (approved) {
      // Update item quantities if provided
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await supabase
            .from('restock_request_items')
            .update({ approved_quantity: item.approved_quantity })
            .eq('id', item.id)
        }
      }

      // Update request status
      const { error: updateError } = await supabase
        .from('restock_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          retailer_notes: notes || null
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      logger.info('Restock request approved', { requestId: request.id })
    } else {
      // Reject the request
      const { error: updateError } = await supabase
        .from('restock_requests')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          retailer_notes: notes || null
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      logger.info('Restock request rejected', { requestId: request.id })
    }

    // TODO: Send notification to agency about the response

    res.json({ success: true, approved })
  } catch (error) {
    logger.error('Error processing approval:', error)
    res.status(500).json({ error: 'Failed to process approval' })
  }
})

/**
 * DELETE /api/requests/:id
 * Delete a restock request
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Delete items first
    const { error: itemsError } = await supabase
      .from('restock_request_items')
      .delete()
      .eq('request_id', id)

    if (itemsError) throw itemsError

    // Delete request
    const { error: requestError } = await supabase
      .from('restock_requests')
      .delete()
      .eq('id', id)

    if (requestError) throw requestError

    logger.info('Restock request deleted', { requestId: id })

    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting request:', error)
    res.status(500).json({ error: 'Failed to delete request' })
  }
})

export default router

