-- Enable Row Level Security on all tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create a function to get current shop context from JWT
CREATE OR REPLACE FUNCTION get_current_shop_id()
RETURNS UUID AS $$
BEGIN
    RETURN (current_setting('app.current_shop_id', true))::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_current_platform()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_platform', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create service role for internal operations
CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Create shop-specific policies

-- Shops table policies
CREATE POLICY "shops_select" ON public.shops
    FOR SELECT USING (
        id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "shops_insert" ON public.shops
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role'
    );

CREATE POLICY "shops_update" ON public.shops
    FOR UPDATE USING (
        id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "shops_delete" ON public.shops
    FOR DELETE USING (
        auth.role() = 'service_role'
    );

-- Locations table policies  
CREATE POLICY "locations_select" ON public.locations
    FOR SELECT USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "locations_insert" ON public.locations
    FOR INSERT WITH CHECK (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "locations_update" ON public.locations
    FOR UPDATE USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "locations_delete" ON public.locations
    FOR DELETE USING (
        auth.role() = 'service_role'
    );

-- Products table policies
CREATE POLICY "products_select" ON public.products
    FOR SELECT USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "products_insert" ON public.products
    FOR INSERT WITH CHECK (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "products_update" ON public.products
    FOR UPDATE USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "products_delete" ON public.products
    FOR DELETE USING (
        auth.role() = 'service_role'
    );

-- Variants table policies
CREATE POLICY "variants_select" ON public.variants
    FOR SELECT USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "variants_insert" ON public.variants
    FOR INSERT WITH CHECK (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "variants_update" ON public.variants
    FOR UPDATE USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "variants_delete" ON public.variants
    FOR DELETE USING (
        auth.role() = 'service_role'
    );

-- Thresholds table policies
CREATE POLICY "thresholds_select" ON public.thresholds
    FOR SELECT USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "thresholds_insert" ON public.thresholds
    FOR INSERT WITH CHECK (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "thresholds_update" ON public.thresholds
    FOR UPDATE USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "thresholds_delete" ON public.thresholds
    FOR DELETE USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

-- Inventory snapshots table policies
CREATE POLICY "inventory_snapshots_select" ON public.inventory_snapshots
    FOR SELECT USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "inventory_snapshots_insert" ON public.inventory_snapshots
    FOR INSERT WITH CHECK (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "inventory_snapshots_update" ON public.inventory_snapshots
    FOR UPDATE USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "inventory_snapshots_delete" ON public.inventory_snapshots
    FOR DELETE USING (
        auth.role() = 'service_role'
    );

-- Incidents table policies
CREATE POLICY "incidents_select" ON public.incidents
    FOR SELECT USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "incidents_insert" ON public.incidents
    FOR INSERT WITH CHECK (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "incidents_update" ON public.incidents
    FOR UPDATE USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "incidents_delete" ON public.incidents
    FOR DELETE USING (
        auth.role() = 'service_role'
    );

-- Webhook events table policies
CREATE POLICY "webhook_events_select" ON public.webhook_events
    FOR SELECT USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "webhook_events_insert" ON public.webhook_events
    FOR INSERT WITH CHECK (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "webhook_events_update" ON public.webhook_events
    FOR UPDATE USING (
        auth.role() = 'service_role'
    );

CREATE POLICY "webhook_events_delete" ON public.webhook_events
    FOR DELETE USING (
        auth.role() = 'service_role'
    );

-- Audit log table policies (read-only for shops, full access for service)
CREATE POLICY "audit_log_select" ON public.audit_log
    FOR SELECT USING (
        shop_id = get_current_shop_id() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "audit_log_insert" ON public.audit_log
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role'
    );

-- No update/delete policies for audit_log to maintain integrity

-- Create helper functions for common queries
CREATE OR REPLACE FUNCTION get_shop_inventory_summary(
    p_shop_id UUID,
    p_platform platform_type
)
RETURNS TABLE (
    total_variants BIGINT,
    out_of_stock_variants BIGINT,
    low_stock_variants BIGINT,
    last_updated TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_variants,
        COUNT(*) FILTER (WHERE is_out_of_stock = true) as out_of_stock_variants,
        COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= threshold) as low_stock_variants,
        MAX(last_updated_at) as last_updated
    FROM inventory_snapshots 
    WHERE shop_id = p_shop_id AND platform = p_platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_active_incidents(
    p_shop_id UUID,
    p_platform platform_type,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    incident_id UUID,
    variant_external_id TEXT,
    location_external_id TEXT,
    quantity INTEGER,
    threshold INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.variant_external_id,
        i.location_external_id,
        i.quantity,
        i.threshold,
        i.created_at
    FROM incidents i
    WHERE i.shop_id = p_shop_id 
      AND i.platform = p_platform 
      AND i.status = 'open'
    ORDER BY i.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_shop_inventory_summary TO service_role;
GRANT EXECUTE ON FUNCTION get_active_incidents TO service_role;
