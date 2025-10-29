import { createClient } from '@supabase/supabase-js'
import logger from './logger'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing Supabase credentials')
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

logger.info('Supabase client initialized')


