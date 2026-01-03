# Debug Guide: metric_facts Has Data But Counts Show 0

## Step 1: Get Collector Result IDs Showing 0 Counts

1. Open browser DevTools → Network tab
2. Find the `/brands/{brandId}/prompts` API call
3. Look at the response → find a prompt with 0 counts
4. Note the `collectorResultId` from the response

OR check backend logs for:
```
[PromptsAnalytics] ⚠️ No counts found for collector X
```

## Step 2: Run Verification Query

Use `VERIFY_METRIC_FACTS_DATA.sql` query #6 (simulates actual query):

```sql
-- Replace 123, 456, 789 with your actual collector_result_ids
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  COALESCE(SUM(cm.competitor_mentions), 0) AS competitor_count,
  CASE 
    WHEN mf.id IS NULL THEN '❌ No metric_facts'
    WHEN bm.id IS NULL THEN '❌ No brand_metrics'
    WHEN bm.total_brand_mentions IS NULL AND bm.total_brand_product_mentions IS NULL 
         AND COALESCE(SUM(cm.competitor_mentions), 0) = 0 THEN '⚠️ All NULL/0'
    ELSE '✅ Has data'
  END AS status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
WHERE cr.id IN (123, 456, 789)  -- YOUR IDs
GROUP BY cr.id, cr.collector_type, mf.id, bm.total_brand_mentions, bm.total_brand_product_mentions
ORDER BY cr.id;
```

## Step 3: Check What the Backend Query Actually Returns

Add this debug logging to see what Supabase returns:

**File**: `backend/src/services/query-helpers/optimized-metrics.helper.ts`

After line 1308 (after `await collectorQuery`), add:

```typescript
// Debug: Log raw Supabase response
console.log(`[OptimizedMetrics] Raw Supabase response for collector_result_ids:`, 
  JSON.stringify(collectorData?.slice(0, 3), null, 2)
);
```

## Step 4: Check Data Transformation

The issue might be in how we transform the nested Supabase response.

**Check**: `optimized-metrics.helper.ts` lines 1310-1370

The transformation logic extracts:
- `bm` from `mf.brand_metrics` (array or single object)
- `bs` from `mf.brand_sentiment` (array or single object)
- `cms` from `mf.competitor_metrics` (array)

**Potential Issues**:
1. Supabase returns arrays but code expects single object
2. Supabase returns single object but code expects array
3. Field names don't match (e.g., `competitor_mentions` vs `competitor_count`)

## Step 5: Compare Expected vs Actual

### Expected Structure (from Supabase query):
```json
{
  "id": 123,
  "collector_type": "ChatGPT",
  "metric_facts": [
    {
      "id": 456,
      "brand_metrics": [
        {
          "total_brand_mentions": 5,
          "total_brand_product_mentions": 2
        }
      ],
      "competitor_metrics": [
        {
          "competitor_mentions": 3,
          "competitor_id": "uuid-1"
        }
      ]
    }
  ]
}
```

### Actual Structure (check logs):
Look for `[OptimizedMetrics] Raw Supabase response` in backend logs.

## Step 6: Common Issues to Check

### Issue A: Supabase Nested Query Returns Empty Arrays
**Symptom**: `metric_facts: []` or `brand_metrics: []`

**Check**: 
```sql
-- Verify foreign key relationships
SELECT 
  mf.id,
  mf.collector_result_id,
  bm.id AS brand_metrics_id,
  bm.metric_fact_id
FROM metric_facts mf
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
WHERE mf.collector_result_id IN (YOUR_IDS);
```

**Fix**: Ensure `brand_metrics.metric_fact_id` correctly references `metric_facts.id`

### Issue B: Field Name Mismatch
**Symptom**: Data exists but field names don't match

**Check**: 
```sql
-- Verify column names
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'brand_metrics' 
  AND column_name IN ('total_brand_mentions', 'total_brand_product_mentions');
```

### Issue C: NULL vs 0 Handling
**Symptom**: Database has `NULL` but code expects `0`

**Check**: 
```sql
-- Check for NULLs
SELECT 
  id,
  total_brand_mentions,
  total_brand_product_mentions,
  CASE 
    WHEN total_brand_mentions IS NULL THEN 'NULL'
    WHEN total_brand_mentions = 0 THEN '0'
    ELSE 'Has value'
  END AS status
FROM brand_metrics
WHERE metric_fact_id IN (
  SELECT id FROM metric_facts WHERE collector_result_id IN (YOUR_IDS)
);
```

### Issue D: Date Filter Still Applied
**Symptom**: Query excludes valid IDs due to date filter

**Check**: Backend logs for:
```
[OptimizedMetrics] Query returned X collector_results
[OptimizedMetrics] Collector_results with metrics: Y, without metrics: Z
```

If `without metrics` count is high, date filter might still be applied.

**Fix**: Verify the fix in `optimized-metrics.helper.ts` lines 1292-1306 is correct.

## Step 7: Test the Query Directly

Run the exact Supabase query structure:

```typescript
// In a test script or backend console
const { data, error } = await supabase
  .from('collector_results')
  .select(`
    id,
    collector_type,
    metric_facts(
      id,
      brand_metrics(
        total_brand_mentions,
        total_brand_product_mentions
      ),
      competitor_metrics(
        competitor_mentions,
        total_competitor_product_mentions
      )
    )
  `)
  .in('id', [YOUR_COLLECTOR_RESULT_IDS])
  .eq('brand_id', YOUR_BRAND_ID);

console.log('Supabase response:', JSON.stringify(data, null, 2));
```

Compare this with what the code expects.

## Step 8: Check Transformation Logic

**File**: `optimized-metrics.helper.ts` lines 1310-1370

The transformation handles:
- `Array.isArray(cr.metric_facts)` → takes first element
- `Array.isArray(mf.brand_metrics)` → takes first element
- `Array.isArray(mf.competitor_metrics)` → processes all elements

**Potential Bug**: If Supabase returns single object instead of array, `Array.isArray()` check fails.

**Fix**: Add fallback:
```typescript
const mf = Array.isArray(cr.metric_facts) 
  ? (cr.metric_facts.length > 0 ? cr.metric_facts[0] : null)
  : cr.metric_facts || null;  // Handle single object case
```

## Quick Debug Checklist

- [ ] Run SQL query #6 from `VERIFY_METRIC_FACTS_DATA.sql`
- [ ] Check backend logs for `[OptimizedMetrics] Raw Supabase response`
- [ ] Verify `metric_facts.id` exists for collector_result_ids
- [ ] Verify `brand_metrics.metric_fact_id` references correct `metric_facts.id`
- [ ] Check if counts are NULL vs 0 in database
- [ ] Verify date filters are NOT applied when collectorResultIds provided
- [ ] Check Supabase nested query structure matches code expectations
- [ ] Verify transformation logic handles both array and single object cases

