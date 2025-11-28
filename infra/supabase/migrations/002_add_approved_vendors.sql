-- Migration: Add approved_vendors column to platform_connections
-- This enables retailer-controlled brand access for brand reps

-- Add approved_vendors column (NULL means all vendors are approved)
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS approved_vendors TEXT[] DEFAULT NULL;

-- Add setup_complete flag to track if retailer has completed brand selection
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT FALSE;

-- Add comment explaining the column
COMMENT ON COLUMN platform_connections.approved_vendors IS 
  'Array of vendor names the retailer has approved for sync. NULL means all vendors (full access). Empty array means no access.';

COMMENT ON COLUMN platform_connections.setup_complete IS 
  'Whether the retailer has completed the brand selection setup. If false, sync should not run.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_connections_setup 
ON platform_connections(setup_complete) 
WHERE setup_complete = false;

