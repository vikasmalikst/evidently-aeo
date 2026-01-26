
-- Check for the last 7 days
WITH range AS (
  SELECT
    NOW() - INTERVAL '6 days' AS start_date,
    NOW() AS end_date
),
totals AS (
  SELECT count(*) as total_queries
  FROM metric_facts
  WHERE brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
    AND created_at >= (SELECT start_date FROM range)
    AND created_at <= (SELECT end_date FROM range)
)
SELECT 'My Brand' as entity,
       COUNT(bm.id) as presence_count,
       (SELECT total_queries FROM totals) as total_queries,
       ROUND(COUNT(bm.id)::numeric / NULLIF((SELECT total_queries FROM totals), 0)::numeric * 100, 2) as percentage
FROM metric_facts mf
JOIN brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
  AND mf.created_at >= (SELECT start_date FROM range)
  AND mf.created_at <= (SELECT end_date FROM range)
  AND bm.has_brand_presence = true

UNION ALL

-- Competitors
SELECT
    bc.competitor_name as entity,
    COUNT(cm.id) as presence_count,
    (SELECT total_queries FROM totals) as total_queries,
    ROUND(COUNT(cm.id)::numeric / NULLIF((SELECT total_queries FROM totals), 0)::numeric * 100, 2) as percentage
FROM brand_competitors bc
LEFT JOIN metric_facts mf ON mf.brand_id = bc.brand_id
    AND mf.created_at >= (SELECT start_date FROM range)
    AND mf.created_at <= (SELECT end_date FROM range)
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id AND cm.competitor_id = bc.id
WHERE bc.brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
  AND (
       cm.visibility_index > 0 
    OR cm.share_of_answers > 0 
    OR cm.competitor_mentions > 0
  )
GROUP BY bc.competitor_name;
