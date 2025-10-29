export interface PlatformConnection {
  id: string
  store_id: string
  platform: 'shopify' | 'lightspeed' | 'woocommerce' | 'bigcommerce'
  shop_domain: string
  access_token: string
  refresh_token?: string
  is_active: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface SyncLog {
  id: string
  connection_id: string
  sync_type: 'products' | 'inventory' | 'orders' | 'full'
  status: 'running' | 'success' | 'failed' | 'partial'
  records_processed: number
  records_created: number
  records_updated: number
  records_failed: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}

export interface Product {
  id: string
  sku: string
  name: string
  brand: string
  default_min_stock: number
  created_at: string
  updated_at: string
}

export interface Store {
  id: string
  name: string
  address: string
  created_at: string
  updated_at: string
}


