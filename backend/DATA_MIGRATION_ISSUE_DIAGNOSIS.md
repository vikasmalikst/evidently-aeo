# Data Migration Issue Diagnosis

## Problem
All brands are showing metrics data (Visibility/SOA/Sentiment) only since Saturday 20th. Historical data before this date is missing.

## Root Cause Analysis

The dashboard has been migrated to use the **new optimized schema** (`metric_facts`, `brand_metrics`, `brand_sentiment`), but the **historical data backfill** from the old schema (`extracted_positions`) may not have been completed.

### Current State:
- ✅ **New schema tables exist**: `metric_facts`, `brand_metrics`, `brand_sentiment`, etc.
- ✅ **Dashboard uses new schema**: `payload-builder.ts` queries `metric_facts` 
- ❓ **Historical data migration status**: Unknown - needs verification
- ❓ **Old schema data**: `extracted_positions` table still exists (not renamed)

## Diagnostic Steps

### Step 1: Check Data in Both Schemas

Run the SQL script to check data availability:

```bash
# Run this in Supabase SQL Editor
backend/scripts/check-data-migration-status.sql
```

This will show:
- Date ranges in old schema (`extracted_positions`)
- Date ranges in new schema (`metric_facts`)
- Migration status (how many collector_results migrated)
- Data availability by date

### Step 2: Verify Migration Status

Check if backfill was run:

```sql
-- Check if there's data before Saturday 20th in new schema
SELECT 
  COUNT(*) as rows_before_sat_20th,
  MIN(processed_at) as earliest_date,
  MAX(processed_at) as latest_date_before_sat_20th
FROM public.metric_facts
WHERE processed_at < '2025-01-20'::date;  -- Adjust date based on actual Saturday 20th date

-- Check data in old schema before Saturday 20th
SELECT 
  COUNT(*) as rows_before_sat_20th,
  MIN(processed_at) as earliest_date,
  MAX(processed_at) as latest_date_before_sat_20th
FROM public.extracted_positions
WHERE processed_at < '2025-01-20'::date;  -- Adjust date based on actual Saturday 20th date
```

## Solution

### Option 1: Run Historical Data Backfill (Recommended)

If the backfill hasn't been run, migrate historical data from `extracted_positions` to the new schema:

#### Step 1: Test with Dry Run
```bash
cd backend
DRY_RUN=true npx ts-node src/scripts/phase2-backfill-optimized-schema.ts
```

This will show:
- How many rows would be migrated
- Progress estimate
- **No data will be written** (safe to run)

#### Step 2: Run Actual Migration
```bash
cd backend
npx ts-node src/scripts/phase2-backfill-optimized-schema.ts
```

**Note**: The script is **idempotent** - it skips already migrated data, so it's safe to re-run.

#### Step 3: Refresh Materialized View
After backfill completes, refresh the materialized view:

```sql
REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;
```

### Option 2: Check if Backfill Partially Completed

If backfill was run but only migrated recent data:

1. Check the backfill script logs for any errors
2. Re-run the backfill script (it will skip already migrated data)
3. Check if there were date filters applied during backfill

### Option 3: Verify Dual-Write is Working

Check if new data collection is writing to both schemas:

```sql
-- Check recent data in new schema (last 7 days)
SELECT 
  DATE(processed_at) as date,
  COUNT(*) as rows_in_new_schema
FROM public.metric_facts
WHERE processed_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(processed_at)
ORDER BY date DESC;

-- Check recent data in old schema (last 7 days)
SELECT 
  DATE(processed_at) as date,
  COUNT(*) as rows_in_old_schema
FROM public.extracted_positions
WHERE processed_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(processed_at)
ORDER BY date DESC;
```

If old schema has recent data but new schema doesn't, dual-write may not be enabled.

## Expected Results After Fix

After running the backfill:
- ✅ Historical data (before Saturday 20th) should appear in dashboard
- ✅ All brands should show complete time series data
- ✅ Both old and new schemas should have matching data

## Verification

After running the backfill, verify with:

```sql
-- Compare data counts
SELECT 
  'OLD SCHEMA' as schema_name,
  COUNT(DISTINCT collector_result_id) as unique_collector_results,
  MIN(processed_at) as earliest_date,
  MAX(processed_at) as latest_date
FROM public.extracted_positions
UNION ALL
SELECT 
  'NEW SCHEMA' as schema_name,
  COUNT(DISTINCT collector_result_id) as unique_collector_results,
  MIN(processed_at) as earliest_date,
  MAX(processed_at) as latest_date
FROM public.metric_facts;
```

The counts should be similar (new schema may have slightly fewer if some data couldn't be migrated).

## Next Steps

1. **Run diagnostic SQL** to understand current state
2. **Run backfill script** if historical data is missing
3. **Refresh materialized view** after backfill
4. **Verify dashboard** shows historical data
5. **Check dual-write** is working for new data

