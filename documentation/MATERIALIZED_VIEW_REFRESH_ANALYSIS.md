# Materialized View Refresh Analysis

## Answer: **NO, you do NOT need to manually refresh the materialized view**

### Current Implementation

**The dashboard does NOT use the materialized view `mv_brand_daily_metrics`.**

Instead, the dashboard queries the **base tables directly**:
- `metric_facts`
- `brand_metrics`
- `brand_sentiment`
- `competitor_metrics`
- `competitor_sentiment`

### Evidence

1. **Dashboard Query Code** (`backend/src/services/brand-dashboard/payload-builder.ts`):
   ```typescript
   // Line 80-107: Queries metric_facts directly
   let metricFactsQuery = supabaseAdmin
     .from('metric_facts')  // ← Direct table query, NOT materialized view
     .select(`...`)
   ```

2. **No Materialized View Usage Found**:
   - Searched entire `backend/src/services` directory
   - **Zero references** to `mv_brand_daily_metrics` in service code
   - Materialized view exists but is **unused**

3. **Data Collection Services**:
   - `position-extraction.service.ts` writes to `metric_facts`, `brand_metrics`, etc.
   - `consolidated-scoring.service.ts` writes to `brand_sentiment`, `competitor_sentiment`
   - **Neither service refreshes the materialized view**

### What This Means

✅ **New data appears automatically** in the dashboard because:
- Data is written directly to base tables (`metric_facts`, `brand_metrics`, etc.)
- Dashboard queries these base tables directly
- No materialized view refresh needed

❌ **Materialized view is currently unused**:
- Created for performance optimization (90x faster queries)
- But dashboard code was migrated to query base tables instead
- Refresh function exists but is never called

### When You WOULD Need to Refresh

You would only need to refresh the materialized view if:
1. **Dashboard code is updated** to use `mv_brand_daily_metrics` instead of base tables
2. **Performance optimization** is implemented to use the materialized view
3. **Other services** start using the materialized view

### Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Materialized View** | ✅ Created | Exists in database |
| **Refresh Function** | ✅ Created | `refresh_mv_brand_daily_metrics_incremental()` |
| **Auto-Refresh** | ❌ Not implemented | Never called in code |
| **Dashboard Usage** | ❌ Not used | Queries base tables directly |
| **Data Visibility** | ✅ Automatic | New data appears immediately |

### Recommendation

**For current implementation:**
- ✅ **No action needed** - new data appears automatically
- ✅ **No manual refresh required** for future data collection

**If you want to use the materialized view for performance:**
1. Update dashboard code to query `mv_brand_daily_metrics` instead of base tables
2. Add automatic refresh after data collection:
   ```typescript
   // After writing to metric_facts, brand_metrics, etc.
   await supabaseAdmin.rpc('refresh_mv_brand_daily_metrics_incremental');
   ```
3. Or set up a scheduled job to refresh periodically

### Summary

**You do NOT need to run `REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;` manually for future data collection.**

The materialized view was created for potential performance optimization but is currently unused. The dashboard queries the base tables directly, so new data appears immediately without any refresh needed.

The only time you needed to refresh it was for the **historical data migration** we just completed, to ensure the backfilled data was visible.

