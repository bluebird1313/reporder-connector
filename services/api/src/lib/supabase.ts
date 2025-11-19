import { createClient } from '@supabase/supabase-js'
import logger from './logger'

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseUrl.includes('placeholder')) {
  logger.warn('⚠️  Supabase credentials not configured - database operations will fail')
  logger.warn('This is OK for testing OAuth flow only')
} else {
  logger.info('✅ Supabase client initialized')
}

export const supabase = createClient(supabaseUrl, supabaseKey)


