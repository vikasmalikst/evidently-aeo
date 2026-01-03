# Product Mentions Migration Guide

## Overview
This guide explains how to populate `total_brand_product_mentions` and `total_competitor_product_mentions` from `consolidated_analysis_cache` into the optimized metrics tables.

## Prerequisites
✅ Step 1 completed: Columns added to tables
- `brand_metrics.total_brand_product_mentions` (INTEGER)
- `competitor_metrics.total_competitor_product_mentions` (INTEGER)

## Step 2: Run the Migration

### Option A: Run via Supabase CLI (Recommended)
```bash
cd /Users/avayasharma/evidently-aeo
supabase db reset  # Only if you want to reset and run all migrations
# OR
supabase migration up  # Run only new migrations
```

### Option B: Run directly in Supabase SQL Editor
1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of `supabase/migrations/20250203000000_populate_product_mentions.sql`
3. Paste and execute

### Option C: Run via psql
```bash
psql -h <your-db-host> -U <user> -d <database> -f supabase/migrations/20250203000000_populate_product_mentions.sql
```

## What the Migration Does

1. **Creates Helper Function**: `count_word_occurrences()`
   - Counts word occurrences in text (case-insensitive, word-boundary aware)
   - Uses PostgreSQL regex with word boundaries (`\m` and `\M`)

2. **Updates Brand Product Mentions**:
   - Extracts product names from `consolidated_analysis_cache.products->'brand'` (JSONB array)
   - Counts occurrences of each product in `collector_results.raw_answer`
   - Sums all product mentions and updates `brand_metrics.total_brand_product_mentions`

3. **Updates Competitor Product Mentions**:
   - Extracts product names from `consolidated_analysis_cache.products->'competitors'-><competitor_name>` (JSONB array)
   - Handles case-insensitive competitor name matching
   - Counts occurrences of each product in `collector_results.raw_answer`
   - Sums all product mentions and updates `competitor_metrics.total_competitor_product_mentions`

4. **Validation**:
   - Logs summary statistics after updates
   - Provides sample verification queries

## Step 3: Verify the Migration

### Check Brand Product Mentions
```sql
-- Count distribution
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE total_brand_product_mentions > 0) as rows_with_products,
  MAX(total_brand_product_mentions) as max_mentions,
  ROUND(AVG(total_brand_product_mentions)::NUMERIC, 2) as avg_mentions
FROM public.brand_metrics;
```

### Check Competitor Product Mentions
```sql
-- Count distribution
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE total_competitor_product_mentions > 0) as rows_with_products,
  MAX(total_competitor_product_mentions) as max_mentions,
  ROUND(AVG(total_competitor_product_mentions)::NUMERIC, 2) as avg_mentions
FROM public.competitor_metrics;
```

### Sample Verification Query
```sql
-- Verify a few specific records
SELECT 
  mf.collector_result_id,
  cr.raw_answer,
  cac.products->'brand' AS brand_products_json,
  bm.total_brand_product_mentions,
  cm.competitor_id,
  bc.competitor_name,
  cac.products->'competitors'->>bc.competitor_name AS competitor_products_json,
  cm.total_competitor_product_mentions
FROM public.metric_facts mf
INNER JOIN public.collector_results cr ON cr.id = mf.collector_result_id
INNER JOIN public.consolidated_analysis_cache cac ON cac.collector_result_id = cr.id
LEFT JOIN public.brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN public.competitor_metrics cm ON cm.metric_fact_id = mf.id
LEFT JOIN public.brand_competitors bc ON bc.id = cm.competitor_id
WHERE bm.total_brand_product_mentions > 0 
   OR cm.total_competitor_product_mentions > 0
LIMIT 10;
```

### Compare with extracted_positions (if available)
```sql
-- Compare counts between old and new schema
SELECT 
  ep.collector_result_id,
  ep.total_brand_product_mentions as old_brand_products,
  bm.total_brand_product_mentions as new_brand_products,
  ep.total_competitor_product_mentions as old_comp_products,
  cm.total_competitor_product_mentions as new_comp_products
FROM public.extracted_positions ep
INNER JOIN public.metric_facts mf ON mf.collector_result_id = ep.collector_result_id
LEFT JOIN public.brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN public.competitor_metrics cm ON cm.metric_fact_id = mf.id 
  AND cm.competitor_id = (
    SELECT id FROM public.brand_competitors 
    WHERE competitor_name = ep.competitor_name 
    LIMIT 1
  )
WHERE ep.competitor_name IS NULL  -- Brand rows only for comparison
LIMIT 20;
```

## Step 4: Update Code to Use New Columns

After migration, update the following files:

1. **`backend/src/services/query-helpers/optimized-metrics.helper.ts`**:
   - Include `total_brand_product_mentions` in brand_metrics select
   - Include `total_competitor_product_mentions` in competitor_metrics select

2. **`backend/src/services/prompts-analytics.service.ts`**:
   - Use `total_brand_product_mentions` from brand_metrics instead of `null`
   - Use `total_competitor_product_mentions` from competitor_metrics

## Troubleshooting

### Issue: No rows updated
**Check**: Verify that `consolidated_analysis_cache` has data
```sql
SELECT COUNT(*) FROM public.consolidated_analysis_cache WHERE products IS NOT NULL;
```

### Issue: Product counts are 0
**Possible causes**:
1. Products array is empty in `consolidated_analysis_cache`
2. Product names don't match in the answer text (case/format differences)
3. No `metric_facts` row exists for the `collector_result_id`

**Debug query**:
```sql
SELECT 
  cac.collector_result_id,
  cac.products->'brand' as brand_products,
  LENGTH(cr.raw_answer) as answer_length,
  mf.id as metric_fact_id
FROM public.consolidated_analysis_cache cac
INNER JOIN public.collector_results cr ON cr.id = cac.collector_result_id
LEFT JOIN public.metric_facts mf ON mf.collector_result_id = cac.collector_result_id
WHERE cac.products->'brand' IS NOT NULL
  AND jsonb_array_length(cac.products->'brand') > 0
LIMIT 10;
```

### Issue: Competitor names don't match
**Check**: Verify competitor name matching
```sql
SELECT 
  bc.competitor_name as db_name,
  comp_key as cache_name,
  LOWER(bc.competitor_name) = LOWER(comp_key) as matches
FROM public.brand_competitors bc
CROSS JOIN LATERAL (
  SELECT DISTINCT comp_key
  FROM public.consolidated_analysis_cache cac
  CROSS JOIN LATERAL jsonb_object_keys(cac.products->'competitors') AS comp_key
  WHERE cac.products->'competitors' IS NOT NULL
) AS cache_competitors
WHERE bc.brand_id = '<your-brand-id>'
LIMIT 20;
```

## Performance Notes

- The migration may take several minutes for large datasets
- Consider running during off-peak hours
- The `count_word_occurrences` function is optimized but may be slow for very long texts
- Indexes on `collector_result_id` in all tables will help performance

## Next Steps

After successful migration:
1. ✅ Verify data looks correct
2. ✅ Update backend code to use new columns
3. ✅ Test Prompts page to see product counts
4. ✅ Update scoring pipeline to populate product mentions for new data going forward

