-- SQL Query to Debug Prompts Analytics Counts
-- This shows the equivalent SQL query that the backend is executing

-- Replace these placeholders with actual values:
-- :brandId - UUID of the brand
-- :customerId - UUID of the customer  
-- :startDate - Start date (ISO string) or NULL
-- :endDate - End date (ISO string) or NULL
-- :queryIds - Array of query IDs or NULL
-- :collectorResultIds - Array of collector_result_ids or NULL

SELECT 
  mf.query_id,
  mf.collector_result_id,
  mf.collector_type,
  mf.processed_at,
  bm.visibility_index,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  bs.sentiment_score,
  -- Aggregate competitor metrics
  COALESCE(
    (SELECT SUM(cm.competitor_mentions) 
     FROM competitor_metrics cm 
     WHERE cm.metric_fact_id = mf.id),
    0
  ) AS total_competitor_mentions,
  COALESCE(
    (SELECT SUM(cm.total_competitor_product_mentions) 
     FROM competitor_metrics cm 
     WHERE cm.metric_fact_id = mf.id),
    0
  ) AS total_competitor_product_mentions,
  -- Get competitor names
  ARRAY_AGG(DISTINCT bc.competitor_name) FILTER (WHERE bc.competitor_name IS NOT NULL) AS competitor_names
FROM metric_facts mf
INNER JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN brand_sentiment bs ON bs.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
LEFT JOIN brand_competitors bc ON bc.id = cm.competitor_id
WHERE mf.brand_id = :brandId
  AND (:customerId IS NULL OR mf.customer_id = :customerId)
  AND (:startDate IS NULL OR mf.processed_at >= :startDate)
  AND (:endDate IS NULL OR mf.processed_at <= :endDate)
  AND (:queryIds IS NULL OR mf.query_id = ANY(:queryIds))
  AND (:collectorResultIds IS NULL OR mf.collector_result_id = ANY(:collectorResultIds))
GROUP BY 
  mf.id,
  mf.query_id,
  mf.collector_result_id,
  mf.collector_type,
  mf.processed_at,
  bm.visibility_index,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  bs.sentiment_score
ORDER BY mf.collector_result_id;

-- Check which collector_results have metric_facts entries
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  cr.query_id,
  CASE WHEN mf.id IS NOT NULL THEN 'HAS metric_facts' ELSE 'MISSING metric_facts' END AS status,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
WHERE cr.brand_id = :brandId
  AND (:customerId IS NULL OR cr.customer_id = :customerId)
  AND (:startDate IS NULL OR cr.created_at >= :startDate)
  AND (:endDate IS NULL OR cr.created_at <= :endDate)
  AND (:queryIds IS NULL OR cr.query_id = ANY(:queryIds))
  AND (:collectorResultIds IS NULL OR cr.id = ANY(:collectorResultIds))
ORDER BY cr.id
LIMIT 50;

-- Count how many collector_results are missing metric_facts
SELECT 
  COUNT(*) FILTER (WHERE mf.id IS NULL) AS missing_metric_facts,
  COUNT(*) FILTER (WHERE mf.id IS NOT NULL) AS has_metric_facts,
  COUNT(*) AS total_collector_results
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
WHERE cr.brand_id = :brandId
  AND (:customerId IS NULL OR cr.customer_id = :customerId)
  AND (:startDate IS NULL OR cr.created_at >= :startDate)
  AND (:endDate IS NULL OR cr.created_at <= :endDate);

