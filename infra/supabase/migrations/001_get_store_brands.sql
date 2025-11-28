-- Migration: Create function to get unique brands per store
-- This function efficiently returns distinct brands for a given store connection

CREATE OR REPLACE FUNCTION get_store_brands(store_id UUID)
RETURNS TABLE(brand TEXT) 
LANGUAGE SQL
STABLE
AS $$
  SELECT DISTINCT p.brand 
  FROM products p
  WHERE p.connection_id = store_id 
    AND p.brand IS NOT NULL 
    AND p.brand != 'Unknown'
    AND p.is_archived = false
  ORDER BY p.brand;
$$;

-- Also create a function to get all brands across all stores (for global pages)
CREATE OR REPLACE FUNCTION get_all_brands()
RETURNS TABLE(brand TEXT) 
LANGUAGE SQL
STABLE
AS $$
  SELECT DISTINCT p.brand 
  FROM products p
  WHERE p.brand IS NOT NULL 
    AND p.brand != 'Unknown'
    AND p.is_archived = false
  ORDER BY p.brand;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_store_brands(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_store_brands(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_all_brands() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_brands() TO anon;

