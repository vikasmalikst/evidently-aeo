
/*
 * VERIFICATION SCRIPT FOR MEASURE PAGE
 * Brand ID: 583be119-67da-47bb-8a29-2950eb4da3ea (Insider Sports)
 * Default Date Range: Last 7 Days
 */

-- 1. Setup Date Range (Adjust interval as needed matching the UI)
WITH range AS (
  SELECT
    NOW() - INTERVAL '6 days' AS start_date, -- e.g., Last 7 days including today
    NOW() AS end_date
),

-- 2. Base Totals (Denominator for Percentages)
totals AS (
  SELECT count(*) as total_queries
  FROM metric_facts
  WHERE brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
    AND created_at >= (SELECT start_date FROM range)
    AND created_at <= (SELECT end_date FROM range)
)

-- SECTION 1: MAIN KPI CARDS (Global Averages)
SELECT 
    'GLOBAL KPIs' as section,
    'Your Brand' as entity,
    -- Visibility: Average of visibility_index * 100
    ROUND(AVG(bm.visibility_index)::numeric * 100, 1) as visibility_score,
    -- Share of Answers: Average of share_of_answers * 100 (assuming DB is 0-1)
    ROUND(AVG(bm.share_of_answers)::numeric * 100, 1) as share_of_answers,
    -- Sentiment: Average sentiment_score
    ROUND(AVG(bs.sentiment_score)::numeric, 1) as sentiment_score,
    -- Brand Presence: % of queries where has_brand_presence is true
    ROUND(SUM(CASE WHEN bm.has_brand_presence THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 1) as brand_presence_pct
FROM metric_facts mf
JOIN brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id -- Sentiment might be sparse
WHERE mf.brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
  AND mf.created_at >= (SELECT start_date FROM range)
  AND mf.created_at <= (SELECT end_date FROM range)

UNION ALL

-- SECTION 2: COMPETITOR COMPARISON (For KPI Card Comparisons)
SELECT 
    'COMPETITOR' as section,
    bc.competitor_name as entity,
    ROUND(AVG(cm.visibility_index)::numeric * 100, 1) as visibility_score,
    ROUND(AVG(cm.share_of_answers)::numeric * 100, 1) as share_of_answers,
    -- Note: Competitor sentiment is in competitor_sentiment table or sometimes metrics
    ROUND(AVG(cs.sentiment_score)::numeric, 1) as sentiment_score,
    -- Competitor Presence: >0 visibility/share/mentions
    ROUND(
        SUM(CASE WHEN (cm.visibility_index > 0 OR cm.share_of_answers > 0 OR cm.competitor_mentions > 0) THEN 1 ELSE 0 END)::numeric 
        / NULLIF((SELECT total_queries FROM totals), 0)::numeric * 100
    , 1) as brand_presence_pct
FROM brand_competitors bc
LEFT JOIN metric_facts mf ON mf.brand_id = bc.brand_id
    AND mf.created_at >= (SELECT start_date FROM range)
    AND mf.created_at <= (SELECT end_date FROM range)
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id AND cm.competitor_id = bc.id
LEFT JOIN competitor_sentiment cs ON cs.metric_fact_id = mf.id AND cs.competitor_id = bc.id
WHERE bc.brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
GROUP BY bc.competitor_name

UNION ALL

-- SECTION 3: LLM Breakdown (For Search Visibility Table)
SELECT 
    'LLM BREAKDOWN' as section,
    mf.collector_type as entity,
    ROUND(AVG(bm.visibility_index)::numeric * 100, 1) as visibility_score,
    ROUND(AVG(bm.share_of_answers)::numeric * 100, 1) as share_of_answers,
    ROUND(AVG(bs.sentiment_score)::numeric, 1) as sentiment_score,
    ROUND(SUM(CASE WHEN bm.has_brand_presence THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 1) as brand_presence_pct
FROM metric_facts mf
JOIN brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
  AND mf.created_at >= (SELECT start_date FROM range)
  AND mf.created_at <= (SELECT end_date FROM range)
GROUP BY mf.collector_type;
