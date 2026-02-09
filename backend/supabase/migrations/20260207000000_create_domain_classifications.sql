-- Migration: Create domain_classifications table for LLM-based domain analysis caching
-- This table stores analyzed domain classifications to avoid repeated LLM calls

CREATE TABLE IF NOT EXISTS domain_classifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT NOT NULL,
  classification JSONB NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  CONSTRAINT unique_domain_brand UNIQUE(domain, brand_id)
);

-- Index for fast lookups by domain and brand
CREATE INDEX idx_domain_classifications_lookup 
ON domain_classifications(domain, brand_id);

-- Index for cleanup of expired records and expiration checks
CREATE INDEX idx_domain_classifications_expired 
ON domain_classifications(expires_at);

-- Add comment explaining the table
COMMENT ON TABLE domain_classifications IS 'Stores LLM-analyzed domain classifications with 30-day caching to reduce API costs and improve performance';
