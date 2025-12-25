# Quick Fix: Data Only Showing Since Saturday 20th

## Problem
All brands are showing metrics data (Visibility/SOA/Sentiment) only since Saturday 20th. Historical data is missing.

## Quick Diagnosis (5 minutes)

Run this SQL in Supabase SQL Editor:

```sql
-- Quick check: Compare data availability
SELECT 
  'OLD SCHEMA' as schema,
  COUNT(DISTINCT collector_result_id) as collector_results,
  MIN(processed_at) as earliest_date,
  MAX(processed_at) as latest_date
FROM public.extracted_positions
UNION ALL
SELECT 
  'NEW SCHEMA' as schema,
  COUNT(DISTINCT collector_result_id) as collector_results,
  MIN(processed_at) as earliest_date,
  MAX(processed_at) as latest_date
FROM public.metric_facts;
```

**Expected Result:**
- If old schema has data before Saturday 20th but new schema doesn't → **Backfill needed**
- If both have same earliest date → **Different issue** (check dual-write)

## Solution: Run Historical Data Backfill

### Step 1: Test First (Dry Run)
```bash
cd backend
DRY_RUN=true npx ts-node src/scripts/phase2-backfill-optimized-schema.ts
```

**What this does:**
- Shows how many rows would be migrated
- Shows progress estimate
- **Does NOT write any data** (safe)

### Step 2: Run Actual Migration
```bash
cd backend
npx ts-node src/scripts/phase2-backfill-optimized-schema.ts
```

**What this does:**
- Migrates historical data from `extracted_positions` → `metric_facts`, `brand_metrics`, etc.
- **Safe to re-run** (skips already migrated data)
- Shows real-time progress

### Step 3: Refresh Materialized View
```sql
REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;
```

## Verification

After backfill, check dashboard - historical data should appear.

Or verify with SQL:
```sql
-- Check if data before Saturday 20th now exists
SELECT 
  COUNT(*) as rows_before_sat_20th,
  MIN(processed_at) as earliest_date
FROM public.metric_facts
WHERE processed_at < (SELECT MIN(processed_at) FROM public.metric_facts WHERE processed_at >= '2025-01-20');
```

## Full Diagnostic Script

For detailed analysis, run:
```sql
-- See: backend/scripts/check-data-migration-status.sql
```

## Common Issues

### Issue: "Missing Supabase credentials"
**Fix:** Ensure `.env` file has:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Issue: Script fails mid-migration
**Fix:** Simply re-run the script. It will skip already migrated data and continue.

### Issue: Backfill completes but data still missing
**Fix:** 
1. Check if materialized view was refreshed
2. Check dashboard cache (may need to clear)
3. Verify date filters in dashboard query

## Expected Timeline

- **Small dataset (< 1000 rows)**: 1-2 minutes
- **Medium dataset (1000-10000 rows)**: 5-15 minutes  
- **Large dataset (> 10000 rows)**: 30+ minutes

The script shows real-time progress.

