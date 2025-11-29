-- =====================================================
-- MULTI-TENANCY SETUP FOR REPORDER CONNECTOR
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Create organizations table (tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create user_profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  full_name VARCHAR(255),
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add organization_id to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 4. Add organization_id to platform_connections
ALTER TABLE platform_connections ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_stores_org ON stores(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_org ON platform_connections(organization_id);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_request_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view org stores" ON stores;
DROP POLICY IF EXISTS "Users can view org connections" ON platform_connections;
DROP POLICY IF EXISTS "Users can view org products" ON products;
DROP POLICY IF EXISTS "Users can view org inventory" ON inventory_levels;
DROP POLICY IF EXISTS "Users can view org alerts" ON alerts;
DROP POLICY IF EXISTS "Users can update org alerts" ON alerts;
DROP POLICY IF EXISTS "Users can view org requests" ON restock_requests;
DROP POLICY IF EXISTS "Users can create org requests" ON restock_requests;
DROP POLICY IF EXISTS "Users can update org requests" ON restock_requests;
DROP POLICY IF EXISTS "Users can view request items" ON restock_request_items;

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view own organization" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- User profiles: Users can see profiles in their organization
CREATE POLICY "Users can view org profiles" ON user_profiles
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Stores: Users can only see their organization's stores
CREATE POLICY "Users can view org stores" ON stores
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage org stores" ON stores
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Platform connections: Users can only see their organization's connections
CREATE POLICY "Users can view org connections" ON platform_connections
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage org connections" ON platform_connections
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Products: Users can see products from their org's connections
CREATE POLICY "Users can view org products" ON products
  FOR SELECT USING (
    connection_id IN (
      SELECT pc.id FROM platform_connections pc
      JOIN user_profiles up ON pc.organization_id = up.organization_id
      WHERE up.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage org products" ON products
  FOR ALL USING (
    connection_id IN (
      SELECT pc.id FROM platform_connections pc
      JOIN user_profiles up ON pc.organization_id = up.organization_id
      WHERE up.id = auth.uid()
    )
  );

-- Inventory levels: Users can see inventory from their org's products
CREATE POLICY "Users can view org inventory" ON inventory_levels
  FOR SELECT USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN platform_connections pc ON p.connection_id = pc.id
      JOIN user_profiles up ON pc.organization_id = up.organization_id
      WHERE up.id = auth.uid()
    )
  );

-- Alerts: Users can see alerts from their org's connections
CREATE POLICY "Users can view org alerts" ON alerts
  FOR SELECT USING (
    connection_id IN (
      SELECT pc.id FROM platform_connections pc
      JOIN user_profiles up ON pc.organization_id = up.organization_id
      WHERE up.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage org alerts" ON alerts
  FOR ALL USING (
    connection_id IN (
      SELECT pc.id FROM platform_connections pc
      JOIN user_profiles up ON pc.organization_id = up.organization_id
      WHERE up.id = auth.uid()
    )
  );

-- Restock requests: Users can see requests from their org's connections
CREATE POLICY "Users can view org requests" ON restock_requests
  FOR SELECT USING (
    connection_id IN (
      SELECT pc.id FROM platform_connections pc
      JOIN user_profiles up ON pc.organization_id = up.organization_id
      WHERE up.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage org requests" ON restock_requests
  FOR ALL USING (
    connection_id IN (
      SELECT pc.id FROM platform_connections pc
      JOIN user_profiles up ON pc.organization_id = up.organization_id
      WHERE up.id = auth.uid()
    )
  );

-- Restock request items: Users can see items from their org's requests
CREATE POLICY "Users can view org request items" ON restock_request_items
  FOR SELECT USING (
    request_id IN (
      SELECT rr.id FROM restock_requests rr
      JOIN platform_connections pc ON rr.connection_id = pc.id
      JOIN user_profiles up ON pc.organization_id = up.organization_id
      WHERE up.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage org request items" ON restock_request_items
  FOR ALL USING (
    request_id IN (
      SELECT rr.id FROM restock_requests rr
      JOIN platform_connections pc ON rr.connection_id = pc.id
      JOIN user_profiles up ON pc.organization_id = up.organization_id
      WHERE up.id = auth.uid()
    )
  );

-- =====================================================
-- PUBLIC ACCESS FOR APPROVAL PAGES (Magic Links)
-- These allow unauthenticated access for retailer approvals
-- =====================================================

-- Allow public read access to restock requests by magic token
CREATE POLICY "Public can view requests by token" ON restock_requests
  FOR SELECT USING (true);

CREATE POLICY "Public can update requests by token" ON restock_requests
  FOR UPDATE USING (true);

CREATE POLICY "Public can view request items" ON restock_request_items
  FOR SELECT USING (true);

CREATE POLICY "Public can update request items" ON restock_request_items
  FOR UPDATE USING (true);

-- =====================================================
-- FUNCTION: Auto-create user profile and organization on signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
  agency_name_val VARCHAR;
  slug_val VARCHAR;
BEGIN
  -- Get agency name from metadata
  agency_name_val := NEW.raw_user_meta_data->>'agency_name';
  
  -- Create organization if agency_name is provided
  IF agency_name_val IS NOT NULL AND agency_name_val != '' THEN
    -- Generate slug from agency name (lowercase, replace spaces with hyphens)
    slug_val := lower(regexp_replace(agency_name_val, '[^a-zA-Z0-9]+', '-', 'g'));
    slug_val := trim(both '-' from slug_val);
    -- Add unique suffix if needed
    slug_val := slug_val || '-' || substring(gen_random_uuid()::text, 1, 8);
    
    INSERT INTO public.organizations (name, slug)
    VALUES (agency_name_val, slug_val)
    RETURNING id INTO org_id;
  END IF;

  -- Insert user profile with organization link
  INSERT INTO public.user_profiles (id, email, full_name, organization_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    org_id,
    CASE WHEN org_id IS NOT NULL THEN 'owner' ELSE 'member' END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

