-- 1. Create Tables
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  price DECIMAL(10, 2),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  location TEXT DEFAULT 'Main Warehouse',
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Helper View
CREATE OR REPLACE VIEW product_inventory_view AS
SELECT 
  p.id as product_id,
  p.name,
  p.sku,
  p.category,
  p.price,
  i.quantity,
  i.low_stock_threshold,
  CASE 
    WHEN i.quantity <= i.low_stock_threshold THEN 'low_stock'
    ELSE 'in_stock'
  END as status
FROM products p
JOIN inventory i ON p.id = i.product_id;

-- 3. Seed Sendero-style Data
WITH new_products AS (
  INSERT INTO products (name, sku, category, price) VALUES
    ('Sendero Trucker Hat - Agave', 'HAT-AGAVE-001', 'Headwear', 32.00),
    ('Sendero Trucker Hat - Big Bend', 'HAT-BIGBEND-001', 'Headwear', 32.00),
    ('Sendero Trucker Hat - Joshua Tree', 'HAT-JOSHUA-001', 'Headwear', 32.00),
    ('Topographic Tee - Sage', 'TEE-TOPO-SAGE-M', 'Apparel', 38.00),
    ('Topographic Tee - Rust', 'TEE-TOPO-RUST-L', 'Apparel', 38.00),
    ('Canyon Fleece Pullover', 'FLC-CANYON-NVY-L', 'Apparel', 85.00),
    ('Badlands Bandana', 'ACC-BAND-BAD', 'Accessories', 18.00),
    ('Pioneer Work Gloves', 'GLV-WORK-001', 'Accessories', 45.00),
    ('Desert Drifter Mug', 'ACC-MUG-DESERT', 'Accessories', 22.00),
    ('Trailblazer Patch', 'ACC-PATCH-TB', 'Accessories', 8.00)
  RETURNING id, sku
)
INSERT INTO inventory (product_id, quantity, low_stock_threshold)
SELECT 
  id, 
  CASE 
    WHEN sku LIKE '%AGAVE%' THEN 4  -- Low stock!
    WHEN sku LIKE '%JOSHUA%' THEN 8 -- Low stock!
    WHEN sku LIKE '%RUST%' THEN 120 -- Healthy
    WHEN sku LIKE '%GLV%' THEN 2    -- Critical!
    ELSE floor(random() * 50 + 15)::int
  END,
  10 -- Alert threshold
FROM new_products;

