-- Create domain_readiness_audits table
CREATE TABLE IF NOT EXISTS domain_readiness_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    scores JSONB NOT NULL,
    results JSONB NOT NULL,
    bot_access JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID, -- Optional link to auth.users if available
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for faster lookup by brand
CREATE INDEX IF NOT EXISTS idx_domain_readiness_audits_brand_id ON domain_readiness_audits(brand_id);
CREATE INDEX IF NOT EXISTS idx_domain_readiness_audits_created_at ON domain_readiness_audits(created_at DESC);
