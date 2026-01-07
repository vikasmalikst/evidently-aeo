# Restore Table and Run Backfill - Instructions

## Current Situation
- ✅ `extracted_positions_disabled_test` has **9,714 rows** (historical data)
- ❌ `extracted_positions` exists but is **empty** (0 rows)
- ✅ `metric_facts` has **1,651 rows** (new schema, data since Saturday 20th)

## Problem
The backfill script looks for `extracted_positions`, but the table was renamed to `extracted_positions_disabled_test` for testing. We need to restore it.

## Solution Steps

### Step 1: Restore the Table Name

Run this SQL in **Supabase SQL Editor**:

```sql
-- Drop empty extracted_positions if it exists
DROP TABLE IF EXISTS public.extracted_positions CASCADE;

-- Rename disabled_test back to extracted_positions
ALTER TABLE extracted_positions_disabled_test 
RENAME TO extracted_positions;
```

**OR** use the provided script:
```bash
# Copy contents of: backend/scripts/restore-table-and-backfill.sql
# Paste into Supabase SQL Editor and run
```

### Step 2: Verify Table is Restored

Run this to verify:
```sql
SELECT 
    COUNT(*) as total_rows,
    MIN(processed_at) as earliest_date,
    MAX(processed_at) as latest_date
FROM public.extracted_positions;
```

Expected: Should show ~9,714 rows with historical dates.

### Step 3: Run Backfill Script

Once the table is restored, run the backfill:

```bash
cd backend
npx ts-node src/scripts/phase2-backfill-optimized-schema.ts
```

This will:
- Migrate all 9,714 rows from `extracted_positions` → `metric_facts`, `brand_metrics`, etc.
- Show progress in real-time
- Skip already migrated data (safe to re-run)

### Step 4: Refresh Materialized View

After backfill completes:
```sql
REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;
```

### Step 5: Verify Dashboard

Check the dashboard - historical data should now appear!

## Quick SQL Script

Here's the complete SQL to run in Supabase SQL Editor:

```sql
-- Step 1: Drop empty table
DROP TABLE IF EXISTS public.extracted_positions CASCADE;

-- Step 2: Restore table name
ALTER TABLE extracted_positions_disabled_test 
RENAME TO extracted_positions;

-- Step 3: Verify
SELECT 
    'Table Restored' as status,
    COUNT(*) as total_rows,
    MIN(processed_at) as earliest_date,
    MAX(processed_at) as latest_date
FROM public.extracted_positions;
```

## Expected Results

After backfill:
- ✅ Historical data (before Saturday 20th) appears in dashboard
- ✅ All brands show complete time series
- ✅ `metric_facts` will have ~11,365 rows (1,651 existing + ~9,714 migrated)

