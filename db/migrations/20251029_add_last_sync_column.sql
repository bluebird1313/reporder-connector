-- Add last_sync_at column to shops table to track when inventory was last synced
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Add index for querying shops that need syncing
CREATE INDEX IF NOT EXISTS idx_shops_last_sync 
ON public.shops(last_sync_at) 
WHERE status = 'active';

-- Add comment to document the column
COMMENT ON COLUMN public.shops.last_sync_at IS 'Timestamp of the last successful inventory sync for this shop';

