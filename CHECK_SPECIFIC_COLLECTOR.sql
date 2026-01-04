-- ============================================================================
-- CHECK DATA FOR SPECIFIC COLLECTOR_RESULT_ID
-- ============================================================================
-- Replace with your collector_result_id showing 0 counts

-- Step 1: Check metric_facts (you already did this - it exists!)
-- Result: metric_fact_id = 69e2f68e-0ea2-47fc-b829-05b1ebfaf599 ✅

-- Step 2: Check brand_metrics for this metric_fact_id
SELECT 
  bm.id AS brand_metrics_id,
  bm.metric_fact_id,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  bm.share_of_answers,
  bm.visibility_index,
  CASE 
    WHEN bm.id IS NULL THEN '❌ NO brand_metrics row!'
    WHEN bm.total_brand_mentions IS NULL THEN '⚠️ total_brand_mentions is NULL'
    WHEN bm.total_brand_mentions = 0 THEN '⚠️ total_brand_mentions is 0 (no mentions)'
    ELSE '✅ HAS brand_mentions data'
  END AS status
FROM metric_facts mf
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
WHERE mf.id = '69e2f68e-0ea2-47fc-b829-05b1ebfaf599';

-- Step 3: Check competitor_metrics for this metric_fact_id
SELECT 
  cm.id AS competitor_metrics_id,
  cm.metric_fact_id,
  cm.competitor_mentions,
  cm.total_competitor_product_mentions,
  cm.share_of_answers,
  CASE 
    WHEN COUNT(cm.id) = 0 THEN '❌ NO competitor_metrics rows!'
    WHEN SUM(cm.competitor_mentions) = 0 THEN '⚠️ All competitor_mentions are 0'
    ELSE '✅ HAS competitor_mentions data'
  END AS status,
  COUNT(cm.id) AS competitor_count,
  SUM(cm.competitor_mentions) AS total_competitor_mentions
FROM metric_facts mf
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
WHERE mf.id = '69e2f68e-0ea2-47fc-b829-05b1ebfaf599'
GROUP BY mf.id;

-- Step 4: COMPLETE CHECK - What Supabase should return
SELECT 
  cr.id AS collector_result_id,
  mf.id AS metric_fact_id,
  bm.id AS brand_metrics_id,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  COALESCE(SUM(cm.competitor_mentions), 0) AS total_competitor_mentions,
  COUNT(cm.id) AS competitor_metrics_count,
  -- Expected Supabase response structure:
  CASE 
    WHEN bm.id IS NULL THEN '❌ brand_metrics: [] (empty array)'
    WHEN bm.total_brand_mentions IS NULL THEN '⚠️ brand_metrics exists but counts are NULL'
    ELSE '✅ brand_metrics: [{...data...}]'
  END AS expected_supabase_brand_metrics,
  CASE 
    WHEN COUNT(cm.id) = 0 THEN '❌ competitor_metrics: [] (empty array)'
    WHEN SUM(cm.competitor_mentions) = 0 THEN '⚠️ competitor_metrics exists but mentions are 0'
    ELSE CONCAT('✅ competitor_metrics: [', COUNT(cm.id), ' rows with data]')
  END AS expected_supabase_competitor_metrics
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
WHERE cr.id = '5a7f99c2-080e-40c0-b4dc-3b5c4caafc40'
GROUP BY cr.id, mf.id, bm.id, bm.total_brand_mentions, bm.total_brand_product_mentions;

