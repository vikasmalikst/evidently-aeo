# Database Migration Instructions

## Option 1: Manual Migration via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the following SQL:

```sql
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
ALTER TABLE domain_readiness_audits 
DROP CONSTRAINT IF EXISTS unique_brand_audit_date;

ALTER TABLE domain_readiness_audits 
ADD CONSTRAINT unique_brand_audit_date 
UNIQUE (brand_id, audit_date);

-- Step 5: Create index for faster history queries
CREATE INDEX IF NOT EXISTS idx_domain_readiness_brand_date 
ON domain_readiness_audits (brand_id, audit_date DESC);
```

4. Click **Run** to execute the migration

## Option 2: Via TypeScript Script

```bash
cd backend
npx ts-node src/scripts/migrate-add-audit-date.ts
```

## Verification

After running the migration, verify it worked:

```sql
-- Check column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'domain_readiness_audits' 
AND column_name = 'audit_date';

-- Check constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'domain_readiness_audits' 
AND constraint_name = 'unique_brand_audit_date';

-- Check index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'domain_readiness_audits' 
AND indexname = 'idx_domain_readiness_brand_date';
```

## Rollback (if needed)

```sql
ALTER TABLE domain_readiness_audits DROP CONSTRAINT IF EXISTS unique_brand_audit_date;
DROP INDEX IF EXISTS idx_domain_readiness_brand_date;
ALTER TABLE domain_readiness_audits DROP COLUMN IF EXISTS audit_date;
```
