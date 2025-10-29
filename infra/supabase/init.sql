-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create enum types
CREATE TYPE platform_type AS ENUM ('shopify', 'lightspeed', 'square');
CREATE TYPE shop_status AS ENUM ('active', 'suspended', 'uninstalled');
CREATE TYPE product_status AS ENUM ('active', 'archived', 'draft');
CREATE TYPE inventory_management AS ENUM ('shopify', 'manual', 'fulfillment_service');
CREATE TYPE inventory_policy AS ENUM ('deny', 'continue');
CREATE TYPE incident_type AS ENUM ('OOS_OPENED', 'OOS_RESOLVED');
CREATE TYPE incident_status AS ENUM ('open', 'resolved', 'ignored');

-- Shops table - core tenant isolation
CREATE TABLE public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    shop_domain TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status shop_status NOT NULL DEFAULT 'active',
    webhook_endpoint_id TEXT,
    scopes TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(platform, shop_domain)
);

-- Locations table
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(platform, shop_id, external_id)
);

-- Products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    handle TEXT,
    product_type TEXT,
    vendor TEXT,
    status product_status NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(platform, shop_id, external_id)
);

-- Variants table
CREATE TABLE public.variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    external_product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    price DECIMAL(10,2),
    inventory_management inventory_management,
    inventory_policy inventory_policy,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(platform, shop_id, external_id)
);

-- Thresholds table - configurable OOS thresholds
CREATE TABLE public.thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    variant_external_id TEXT NOT NULL,
    location_external_id TEXT NOT NULL,
    threshold INTEGER NOT NULL DEFAULT 0,
    hysteresis INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(platform, shop_id, variant_external_id, location_external_id)
);

-- Inventory snapshots table - current state
CREATE TABLE public.inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    variant_external_id TEXT NOT NULL,
    location_external_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    threshold INTEGER NOT NULL DEFAULT 0,
    is_out_of_stock BOOLEAN NOT NULL DEFAULT false,
    last_updated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(platform, shop_id, variant_external_id, location_external_id)
);

-- Incidents table - OOS events
CREATE TABLE public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    variant_external_id TEXT NOT NULL,
    location_external_id TEXT NOT NULL,
    type incident_type NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    threshold INTEGER NOT NULL DEFAULT 0,
    status incident_status NOT NULL DEFAULT 'open',
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Index for faster queries on active incidents
    INDEX idx_incidents_active ON incidents(platform, shop_id, status) WHERE status = 'open'
);

-- Webhook events table - audit trail
CREATE TABLE public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT,
    verified BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Index for processing queue
    INDEX idx_webhook_events_processing ON webhook_events(verified, processed_at, created_at) WHERE processed_at IS NULL
);

-- Audit log table - track all changes
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_values JSONB,
    new_values JSONB,
    changed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Index for efficient querying
    INDEX idx_audit_log_record ON audit_log(table_name, record_id, created_at)
);

-- Create indexes for performance
CREATE INDEX idx_shops_platform_domain ON shops(platform, shop_domain);
CREATE INDEX idx_locations_shop_platform ON locations(shop_id, platform);
CREATE INDEX idx_products_shop_platform ON products(shop_id, platform);
CREATE INDEX idx_variants_shop_platform ON variants(shop_id, platform);
CREATE INDEX idx_variants_product ON variants(product_id);
CREATE INDEX idx_thresholds_shop_platform ON thresholds(shop_id, platform);
CREATE INDEX idx_inventory_shop_platform ON inventory_snapshots(shop_id, platform);
CREATE INDEX idx_inventory_variant_location ON inventory_snapshots(variant_external_id, location_external_id);
CREATE INDEX idx_incidents_shop_platform ON incidents(shop_id, platform);
CREATE INDEX idx_incidents_variant_location ON incidents(variant_external_id, location_external_id);
CREATE INDEX idx_webhook_events_shop_platform ON webhook_events(shop_id, platform);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_variants_updated_at BEFORE UPDATE ON variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_thresholds_updated_at BEFORE UPDATE ON thresholds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (platform, shop_id, table_name, record_id, action, old_values)
        VALUES (OLD.platform, OLD.shop_id, TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (platform, shop_id, table_name, record_id, action, old_values, new_values)
        VALUES (NEW.platform, NEW.shop_id, TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (platform, shop_id, table_name, record_id, action, new_values)
        VALUES (NEW.platform, NEW.shop_id, TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for main tables
CREATE TRIGGER audit_shops AFTER INSERT OR UPDATE OR DELETE ON shops FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_locations AFTER INSERT OR UPDATE OR DELETE ON locations FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_variants AFTER INSERT OR UPDATE OR DELETE ON variants FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_thresholds AFTER INSERT OR UPDATE OR DELETE ON thresholds FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_inventory_snapshots AFTER INSERT OR UPDATE OR DELETE ON inventory_snapshots FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_incidents AFTER INSERT OR UPDATE OR DELETE ON incidents FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
