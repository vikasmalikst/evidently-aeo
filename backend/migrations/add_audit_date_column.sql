-- Migration: Add audit_date for daily upsert pattern
-- Purpose: Store only one audit per brand per day, replacing old data
-- Date: 2026-01-10

-- Step 1: Add audit_date column (nullable initially for backfill)
ALTER TABLE domain_readiness_audits 
ADD COLUMN IF NOT EXISTS audit_date DATE;

-- Step 2: Backfill audit_date from created_at for existing records
UPDATE domain_readiness_audits 
SET audit_date = DATE(created_at)
WHERE audit_date IS NULL;

-- Step 3: Make audit_date NOT NULL after backfill
ALTER TABLE domain_readiness_audits 
ALTER COLUMN audit_date SET NOT NULL;

-- Step 4: Add unique constraint for (brand_id, audit_date)
-- This allows upsert to replace old audit with new one for same day
ALTER TABLE domain_readiness_audits 
DROP CONSTRAINT IF EXISTS unique_brand_audit_date;

ALTER TABLE domain_readiness_audits 
ADD CONSTRAINT unique_brand_audit_date 
UNIQUE (brand_id, audit_date);

-- Step 5: Create index for faster history queries
CREATE INDEX IF NOT EXISTS idx_domain_readiness_brand_date 
ON domain_readiness_audits (brand_id, audit_date DESC);

-- Rollback script (if needed):
-- ALTER TABLE domain_readiness_audits DROP CONSTRAINT IF EXISTS unique_brand_audit_date;
-- DROP INDEX IF EXISTS idx_domain_readiness_brand_date;
-- ALTER TABLE domain_readiness_audits DROP COLUMN IF EXISTS audit_date;
