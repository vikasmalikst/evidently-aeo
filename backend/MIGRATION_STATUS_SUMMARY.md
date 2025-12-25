# Migration Status Summary

## Current Status (Checked: Just Now)

### Data Comparison

**OLD SCHEMA** (`extracted_positions_disabled_test`):
- Total rows: **9,714**
- Unique collector_result_ids: **1,619**
- Date range: November 8, 2025 → December 23, 2025
- **Rows before December 20, 2025: 8,388**

**NEW SCHEMA** (`metric_facts`):
- Total rows: **1,651**
- Unique collector_result_ids: **1,651**
- Date range: November 8, 2025 → December 24, 2025
- **Rows before December 20, 2025: 1,389**

### Migration Status

- ✅ **17% of historical data migrated** (1,389 / 8,388 rows before Dec 20)
- ⚠️ **8 collector_results missing** in new schema
- ❌ **6,999 rows missing** before December 20, 2025

### Impact on UI

**Problem:** Dashboard only shows data since December 20, 2025 because:
- Only 1,389 rows exist in new schema before Dec 20
- 8,388 rows exist in old schema before Dec 20
- **Missing: 6,999 rows of historical data**

## Solution

### Step 1: Run Backfill Script

The backfill script has been updated to use `extracted_positions_disabled_test`:

```bash
cd backend
npx ts-node src/scripts/phase2-backfill-optimized-schema.ts
```

**What this will do:**
- Migrate all 9,714 rows from `extracted_positions_disabled_test` → new schema
- Skip already migrated data (safe to re-run)
- Process in batches of 100 rows
- Show real-time progress

**Expected result:**
- New schema will have ~11,365 rows (1,651 existing + ~9,714 migrated, minus duplicates)
- All historical data before December 20 will be available
- Dashboard will show complete time series

### Step 2: Refresh Materialized View

After backfill completes:

```sql
REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;
```

### Step 3: Verify Dashboard

Check the dashboard - all historical data should now appear!

## Script Changes Made

✅ Updated backfill script to use `extracted_positions_disabled_test` instead of `extracted_positions`
✅ Created migration status checker script
✅ Verified data comparison shows migration is needed

## Next Steps

1. **Run backfill script** (will take ~5-15 minutes for 9,714 rows)
2. **Refresh materialized view**
3. **Verify dashboard** shows historical data
4. **Check specific brands** to confirm data appears

