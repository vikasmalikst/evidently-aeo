# Schema Migration Analysis: extracted_positions → metric_facts

## Problem Statement

Counts (Brand, Product, Competitor, Keywords) were working perfectly in the previous project using `extracted_positions` table, but after migrating to the new schema (`metric_facts` + `brand_metrics` + `competitor_metrics`), some collectors show 0 counts even when data exists in the text.

## Previous Approach: `extracted_positions` Table

### Structure
- **Single table** with denormalized data
- **1 Brand Row** per `collector_result_id`:
  - `competitor_name = NULL`
  - `total_brand_mentions` (integer)
  - `total_brand_product_mentions` (integer)
  - `competitor_mentions` (integer) - **Total count of all competitors**
  - All other brand metrics (visibility, sentiment, etc.)
- **N Competitor Rows** per `collector_result_id` (one per competitor):
  - `competitor_name = "CompetitorA"`
  - `competitor_mentions` (integer) - **Count for this specific competitor**
  - Competitor-specific metrics

### Query Pattern (Previous)
```sql
SELECT 
  collector_result_id,
  collector_type,
  competitor_name,
  total_brand_mentions,
  total_brand_product_mentions,
  competitor_mentions
FROM extracted_positions
WHERE collector_result_id IN (123, 456, 789)
  AND brand_id = '...'
  AND customer_id = '...'
```

### Key Characteristics
✅ **Guaranteed Data**: If scoring ran, there's **always** 1 brand row per `collector_result_id`
✅ **Simple Query**: Single table, no JOINs required
✅ **Direct Access**: All counts in one row
✅ **No Date Filter Issues**: Query by `collector_result_id` directly, no date conflicts
✅ **Predictable**: Always returns data if scoring completed

### How Counts Were Fetched
```typescript
// Legacy code (prompts-analytics.service.ts:833-865)
const { data: legacyRows } = await supabaseAdmin
  .from('extracted_positions')
  .select('collector_result_id, total_brand_mentions, total_brand_product_mentions, competitor_mentions')
  .in('collector_result_id', allCollectorResultIds)
  .eq('brand_id', brandRow.id)
  .eq('customer_id', customerId)

// Process rows
legacyRows.forEach((row) => {
  const isBrandRow = !row.competitor_name || row.competitor_name.trim() === ''
  
  if (isBrandRow && row.collector_result_id) {
    mentionCountsByCollector.set(row.collector_result_id, {
      brand: row.total_brand_mentions || 0,
      product: row.total_brand_product_mentions || 0,
      competitor: row.competitor_mentions || 0  // Total competitor mentions
    })
  }
})
```

**Result**: Every `collector_result_id` that was scored had a brand row with counts.

---

## New Approach: `metric_facts` + `brand_metrics` + `competitor_metrics`

### Structure
- **`metric_facts`** (1 row per `collector_result_id`):
  - Links to `collector_result_id`
  - Contains `query_id`, `processed_at`, etc.
- **`brand_metrics`** (1 row per `metric_fact_id`):
  - `total_brand_mentions` (integer)
  - `total_brand_product_mentions` (integer) - **Added later via migration**
  - Brand visibility, SOA, etc.
- **`competitor_metrics`** (N rows per `metric_fact_id`):
  - `competitor_mentions` (integer) - **Per competitor**
  - `total_competitor_product_mentions` (integer) - **Per competitor**
  - Must be **SUMMED** to get total competitor counts

### Query Pattern (Current)
```sql
-- Supabase nested query (optimized-metrics.helper.ts:1262-1288)
SELECT 
  cr.id,
  cr.collector_type,
  mf.brand_metrics(
    total_brand_mentions,
    total_brand_product_mentions
  ),
  mf.competitor_metrics(
    competitor_mentions,
    total_competitor_product_mentions
  )
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
WHERE cr.id IN (123, 456, 789)
```

### Key Characteristics
❌ **No Guaranteed Data**: If scoring hasn't run, `metric_facts` row doesn't exist → NULL counts
❌ **Complex Query**: Requires nested JOINs across 3 tables
❌ **Aggregation Required**: Must SUM `competitor_metrics` rows to get total competitor count
❌ **Date Filter Conflicts**: When `collectorResultIds` provided, date filters could exclude valid results (FIXED)
❌ **Unpredictable**: May return NULL if scoring incomplete

---

## Root Causes of the Gap

### 1. **Missing `metric_facts` Rows** (Primary Issue)

**Previous**: `extracted_positions` row was created **during scoring**, so if scoring ran, data existed.

**Current**: `metric_facts` row is created **during scoring**, but:
- If scoring hasn't run → No `metric_facts` row → LEFT JOIN returns NULL → 0 counts
- If scoring failed partially → `metric_facts` exists but `brand_metrics` missing → NULL counts
- If scoring incomplete → Some `collector_result_id`s have data, others don't

**Impact**: Collectors that haven't been scored show 0 counts, even if text has mentions.

**Solution Applied**: 
- Changed query to start from `collector_results` with LEFT JOIN (ensures all IDs returned)
- Skip date filters when `collectorResultIds` provided
- Default to 0 counts when `metric_facts` is NULL (expected behavior)

### 2. **Date Filter Conflict** (FIXED)

**Previous**: Query by `collector_result_id` directly, no date filters applied.

**Current**: Query was applying date filters even when specific IDs provided:
```typescript
// BEFORE (WRONG)
if (startDate) {
  collectorQuery = collectorQuery.gte('created_at', startDate);  // Applied even with IDs
}
if (collectorResultIds) {
  collectorQuery = collectorQuery.in('id', collectorResultIds);
}
```

**Problem**: If a `collector_result`'s `created_at` was outside the date range, it was excluded even though the ID was explicitly requested.

**Fix Applied**: Skip date filters when `collectorResultIds` are provided:
```typescript
// AFTER (FIXED)
if (collectorResultIds && collectorResultIds.length > 0) {
  collectorQuery = collectorQuery.in('id', collectorResultIds);  // No date filter
} else {
  if (startDate) {
    collectorQuery = collectorQuery.gte('created_at', startDate);
  }
  // ...
}
```

### 3. **Data Availability Timing**

**Previous**: 
- Scoring → `extracted_positions` row created immediately
- Query always found data if scoring completed

**Current**:
- Scoring → `metric_facts` created → `brand_metrics` created → `competitor_metrics` created
- Multiple steps, any can fail
- Query may find `metric_facts` but missing `brand_metrics` → NULL counts

**Impact**: Partial scoring failures result in incomplete data.

### 4. **Query Complexity**

**Previous**: 
```sql
SELECT * FROM extracted_positions WHERE collector_result_id IN (...)
```
- Simple, direct, always returns data if exists

**Current**:
```typescript
// Nested Supabase query with multiple JOINs
collector_results → metric_facts → brand_metrics
                  → competitor_metrics (array)
```
- Complex nested structure
- Must handle NULLs at each level
- Must aggregate competitor rows

**Impact**: More error-prone, harder to debug.

---

## Comparison Table

| Aspect | Previous (`extracted_positions`) | Current (`metric_facts` + related) |
|--------|-----------------------------------|-------------------------------------|
| **Table Count** | 1 table | 3+ tables |
| **Query Complexity** | Simple SELECT | Nested JOINs |
| **Data Guarantee** | ✅ Always 1 row per `collector_result_id` if scored | ❌ May be NULL if scoring incomplete |
| **Date Filter** | Not needed (query by ID) | ⚠️ Can conflict with ID filter (FIXED) |
| **Competitor Count** | Direct: `competitor_mentions` (total) | Must SUM: `competitor_metrics.competitor_mentions` |
| **Product Count** | Direct: `total_brand_product_mentions` | Direct: `brand_metrics.total_brand_product_mentions` |
| **Missing Data Handling** | Row exists with 0 counts | Row may not exist → NULL → 0 |
| **Scoring Dependency** | Single step: create row | Multiple steps: `metric_facts` → `brand_metrics` → `competitor_metrics` |

---

## Issues We're Facing in New Approach

### Issue 1: Incomplete Scoring
**Symptom**: Some collectors show 0 counts even with text mentions.

**Root Cause**: `metric_facts` row doesn't exist because scoring hasn't run for those `collector_result_id`s.

**Detection**:
```sql
-- Check which collector_results are missing metric_facts
SELECT 
  cr.id,
  cr.collector_type,
  cr.created_at,
  CASE WHEN mf.id IS NULL THEN 'MISSING metric_facts' ELSE 'HAS metric_facts' END
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
WHERE cr.id IN (YOUR_IDS)
ORDER BY cr.id;
```

**Solution**: Run scoring for missing `collector_result_id`s.

### Issue 2: Partial Scoring
**Symptom**: `metric_facts` exists but counts are 0.

**Root Cause**: `brand_metrics` row missing or has 0 values.

**Detection**:
```sql
-- Check if brand_metrics exists
SELECT 
  mf.id AS metric_fact_id,
  mf.collector_result_id,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions
FROM metric_facts mf
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
WHERE mf.collector_result_id IN (YOUR_IDS);
```

**Solution**: Re-run scoring or check scoring logs for errors.

### Issue 3: Date Filter Exclusion (FIXED)
**Symptom**: Requested `collector_result_id`s not returned.

**Root Cause**: Date filter excluded valid IDs.

**Fix Applied**: Skip date filters when `collectorResultIds` provided.

### Issue 4: Competitor Count Aggregation
**Symptom**: Competitor count incorrect.

**Root Cause**: Must SUM all `competitor_metrics.competitor_mentions` rows.

**Solution Applied**: Code now sums competitor mentions correctly.

---

## Why Previous Approach Worked Better

1. **Simplicity**: Single table, no JOINs, direct access
2. **Guaranteed Data**: If scoring ran, row exists (even with 0 counts)
3. **No Filter Conflicts**: Query by ID directly, no date issues
4. **Predictable**: Always returns data if scoring completed
5. **Easier Debugging**: One table to check

---

## Why New Approach Has Issues

1. **Complexity**: Multiple tables, nested JOINs, aggregation required
2. **No Data Guarantee**: Missing `metric_facts` → NULL → 0 counts
3. **Filter Conflicts**: Date filters can exclude valid IDs (FIXED)
4. **Unpredictable**: May return NULL if scoring incomplete
5. **Harder Debugging**: Must check 3+ tables

---

## Recommendations

### Short-term (Current Fixes Applied)
✅ Skip date filters when `collectorResultIds` provided
✅ LEFT JOIN from `collector_results` to ensure all IDs returned
✅ Default to 0 counts when `metric_facts` is NULL
✅ Add debug logging to identify missing data

### Long-term (Consider)
1. **Ensure Scoring Completeness**: 
   - Add monitoring to detect unscored `collector_result_id`s
   - Auto-retry failed scoring jobs
   - Show "Scoring in progress" status in UI

2. **Data Validation**:
   - Add database constraints to ensure `brand_metrics` exists if `metric_facts` exists
   - Add checksums to detect partial scoring failures

3. **Fallback Strategy**:
   - If `metric_facts` missing, calculate counts on-the-fly from `collector_results.raw_answer`
   - Cache results to avoid repeated calculations

4. **Query Optimization**:
   - Consider creating a materialized view similar to `extracted_positions_compat`
   - Use the compatibility view for prompts analytics if available

---

## Summary

**The Gap**: Previous approach guaranteed data availability (1 row per `collector_result_id` if scored), while new approach may have missing `metric_facts` rows, resulting in NULL counts.

**The Issue**: Some collectors show 0 counts because:
1. Scoring hasn't run → No `metric_facts` row
2. Partial scoring → `metric_facts` exists but `brand_metrics` missing
3. Date filter conflicts (FIXED) → Valid IDs excluded

**The Fix**: 
- Skip date filters when IDs provided ✅
- LEFT JOIN from `collector_results` ✅
- Default to 0 when data missing ✅
- Add debug logging ✅

**Remaining Issue**: Collectors without `metric_facts` rows will show 0 counts until scoring runs. This is expected behavior, but we should ensure scoring runs for all `collector_result_id`s.

