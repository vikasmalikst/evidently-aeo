-- =====================================================
-- GA4 Analytics Tables
-- =====================================================
-- This migration creates tables to store GA4 credentials
-- and cache analytics data in Supabase instead of JSON files
-- =====================================================

-- Table 1: Store GA4 credentials per brand
CREATE TABLE IF NOT EXISTS brand_ga4_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  property_id VARCHAR(255) NOT NULL,
  service_account_key JSONB NOT NULL,
  configured_by VARCHAR(255),
  configured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one GA4 config per brand
  CONSTRAINT unique_brand_ga4_config UNIQUE(brand_id, customer_id)
);

-- Table 2: Cache GA4 API responses (5-minute TTL)
CREATE TABLE IF NOT EXISTS ga4_report_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  cache_key VARCHAR(255) NOT NULL,
  report_data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique cache entries per brand/key
  CONSTRAINT unique_cache_entry UNIQUE(brand_id, customer_id, cache_key)
);

-- Table 3: Audit log for GA4 configuration changes (optional but recommended)
CREATE TABLE IF NOT EXISTS ga4_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'configure', 'update', 'delete', 'access'
  performed_by VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ga4_credentials_brand 
  ON brand_ga4_credentials(brand_id);

CREATE INDEX IF NOT EXISTS idx_ga4_credentials_customer 
  ON brand_ga4_credentials(customer_id);

CREATE INDEX IF NOT EXISTS idx_ga4_cache_brand 
  ON ga4_report_cache(brand_id);

CREATE INDEX IF NOT EXISTS idx_ga4_cache_expires 
  ON ga4_report_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_ga4_audit_brand 
  ON ga4_audit_log(brand_id);

CREATE INDEX IF NOT EXISTS idx_ga4_audit_created 
  ON ga4_audit_log(created_at DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ga4_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER ga4_credentials_updated_at
  BEFORE UPDATE ON brand_ga4_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_ga4_credentials_updated_at();

-- Function to automatically clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_ga4_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ga4_report_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE brand_ga4_credentials IS 'Stores GA4 service account credentials per brand';
COMMENT ON TABLE ga4_report_cache IS 'Caches GA4 API responses with 5-minute TTL';
COMMENT ON TABLE ga4_audit_log IS 'Audit trail for GA4 configuration changes';

COMMENT ON COLUMN brand_ga4_credentials.property_id IS 'GA4 Property ID (numeric string)';
COMMENT ON COLUMN brand_ga4_credentials.service_account_key IS 'Google Cloud service account JSON';
COMMENT ON COLUMN ga4_report_cache.cache_key IS 'Format: metric:dimension:days (e.g., eventCount:date:7d)';
COMMENT ON COLUMN ga4_report_cache.expires_at IS 'Cache entry expires after 5 minutes';

-- Grant permissions (adjust based on your RLS policies)
-- Note: You may need to adjust these based on your security requirements
ALTER TABLE brand_ga4_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_report_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_audit_log ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (customize for your needs)
-- Only allow access to brands owned by the authenticated user's customer
CREATE POLICY "Users can manage their own brand GA4 credentials"
  ON brand_ga4_credentials
  FOR ALL
  USING (customer_id::text = auth.jwt() ->> 'customer_id');

CREATE POLICY "Users can access their own brand GA4 cache"
  ON ga4_report_cache
  FOR SELECT
  USING (customer_id::text = auth.jwt() ->> 'customer_id');

CREATE POLICY "Users can view their own GA4 audit logs"
  ON ga4_audit_log
  FOR SELECT
  USING (customer_id::text = auth.jwt() ->> 'customer_id');

