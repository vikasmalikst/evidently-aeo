-- ============================================================================
-- LLM VISIBILITY VALIDATION QUERIES
-- ============================================================================
-- Validates the "LLM Visibility (7 Days)" section on the dashboard
-- Brand ID: 32b3dc03-fe6b-40e6-94ac-9a146ceca60d
-- No date filter - includes all historical data
-- ============================================================================

-- ============================================================================
-- MAIN QUERY: LLM Visibility Table (All Metrics Per Collector Type)
-- ============================================================================
-- This query returns all metrics for each LLM/collector type
-- Should match the "LLM Visibility (7 Days)" table on the dashboard
WITH visibility_per_llm AS (
  SELECT 
    mf.collector_type,
    AVG(bm.visibility_index) * 100 AS visibility_index,
    COUNT(*) AS visibility_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    AND bm.visibility_index IS NOT NULL
  GROUP BY mf.collector_type
),
share_per_llm AS (
  SELECT 
    mf.collector_type,
    AVG(bm.share_of_answers) AS share_of_answers,
    COUNT(*) AS share_records,
    COUNT(bm.share_of_answers) AS records_with_share
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    AND bm.share_of_answers IS NOT NULL
    AND bm.share_of_answers >= 0
  GROUP BY mf.collector_type
),
sentiment_per_llm AS (
  SELECT 
    mf.collector_type,
    AVG(bs.sentiment_score) AS sentiment_score,
    COUNT(*) AS sentiment_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    AND bs.sentiment_score IS NOT NULL
  GROUP BY mf.collector_type
),
brand_presence_per_llm AS (
  SELECT 
    mf.collector_type,
    COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS collector_results_with_presence,
    COUNT(DISTINCT mf.collector_result_id) AS total_collector_results
  FROM public.metric_facts mf
  LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  GROUP BY mf.collector_type
)
SELECT 
  v.collector_type AS llm,
  ROUND(v.visibility_index, 0) AS visibility,
  ROUND(s.share_of_answers, 0) AS soa,
  ROUND(st.sentiment_score, 0) AS sentiment,
  CASE 
    WHEN bp.total_collector_results > 0 
    THEN ROUND(
      (bp.collector_results_with_presence::numeric / 
       bp.total_collector_results::numeric) * 100, 
      0
    )
    ELSE 0
  END AS brand_presence,
  -- Additional metadata for validation
  v.visibility_records,
  s.share_records,
  s.records_with_share,
  st.sentiment_records,
  bp.collector_results_with_presence,
  bp.total_collector_results
FROM visibility_per_llm v
LEFT JOIN share_per_llm s ON v.collector_type = s.collector_type
LEFT JOIN sentiment_per_llm st ON v.collector_type = st.collector_type
LEFT JOIN brand_presence_per_llm bp ON v.collector_type = bp.collector_type
ORDER BY s.share_of_answers DESC NULLS LAST;

-- ============================================================================
-- ALTERNATIVE: Detailed Breakdown Per LLM (with more validation info)
-- ============================================================================
SELECT 
  mf.collector_type AS llm,
  
  -- Visibility Index
  ROUND(AVG(bm.visibility_index) * 100, 0) AS visibility,
  COUNT(bm.visibility_index) AS visibility_records,
  MIN(bm.visibility_index) * 100 AS min_visibility,
  MAX(bm.visibility_index) * 100 AS max_visibility,
  
  -- Share of Answers (SOA)
  ROUND(AVG(bm.share_of_answers), 0) AS soa,
  COUNT(bm.share_of_answers) AS soa_records,
  MIN(bm.share_of_answers) AS min_soa,
  MAX(bm.share_of_answers) AS max_soa,
  
  -- Sentiment Score
  ROUND(AVG(bs.sentiment_score), 0) AS sentiment,
  COUNT(bs.sentiment_score) AS sentiment_records,
  MIN(bs.sentiment_score) AS min_sentiment,
  MAX(bs.sentiment_score) AS max_sentiment,
  
  -- Brand Presence
  COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS collector_results_with_presence,
  COUNT(DISTINCT mf.collector_result_id) AS total_collector_results,
  CASE 
    WHEN COUNT(DISTINCT mf.collector_result_id) > 0 
    THEN ROUND(
      (COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END)::numeric / 
       COUNT(DISTINCT mf.collector_result_id)::numeric) * 100, 
      0
    )
    ELSE 0
  END AS brand_presence,
  
  -- Additional counts
  COUNT(DISTINCT mf.query_id) AS total_queries,
  COUNT(*) AS total_rows

FROM public.metric_facts mf
LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
GROUP BY mf.collector_type
ORDER BY AVG(bm.share_of_answers) DESC NULLS LAST;

-- ============================================================================
-- INDIVIDUAL METRIC QUERIES (for detailed validation)
-- ============================================================================

-- 1. Visibility Index Per LLM
SELECT 
  mf.collector_type AS llm,
  ROUND(AVG(bm.visibility_index) * 100, 0) AS visibility,
  COUNT(*) AS records,
  ROUND(MIN(bm.visibility_index) * 100, 1) AS min_visibility,
  ROUND(MAX(bm.visibility_index) * 100, 1) AS max_visibility
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  AND bm.visibility_index IS NOT NULL
GROUP BY mf.collector_type
ORDER BY visibility DESC;

-- 2. Share of Answers (SOA) Per LLM
SELECT 
  mf.collector_type AS llm,
  ROUND(AVG(bm.share_of_answers), 0) AS soa,
  COUNT(bm.share_of_answers) AS records_with_soa,
  COUNT(*) AS total_records,
  ROUND(MIN(bm.share_of_answers), 1) AS min_soa,
  ROUND(MAX(bm.share_of_answers), 1) AS max_soa
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  AND bm.share_of_answers IS NOT NULL
  AND bm.share_of_answers >= 0
GROUP BY mf.collector_type
ORDER BY soa DESC;

-- 3. Sentiment Score Per LLM
SELECT 
  mf.collector_type AS llm,
  ROUND(AVG(bs.sentiment_score), 0) AS sentiment,
  COUNT(bs.sentiment_score) AS records,
  ROUND(MIN(bs.sentiment_score), 1) AS min_sentiment,
  ROUND(MAX(bs.sentiment_score), 1) AS max_sentiment
FROM public.metric_facts mf
INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  AND bs.sentiment_score IS NOT NULL
GROUP BY mf.collector_type
ORDER BY sentiment DESC;

-- 4. Brand Presence Percentage Per LLM
SELECT 
  mf.collector_type AS llm,
  COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS collector_results_with_presence,
  COUNT(DISTINCT mf.collector_result_id) AS total_collector_results,
  CASE 
    WHEN COUNT(DISTINCT mf.collector_result_id) > 0 
    THEN ROUND(
      (COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END)::numeric / 
       COUNT(DISTINCT mf.collector_result_id)::numeric) * 100, 
      0
    )
    ELSE 0
  END AS brand_presence_percentage
FROM public.metric_facts mf
LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
GROUP BY mf.collector_type
ORDER BY brand_presence_percentage DESC;

-- ============================================================================
-- SOURCE TYPE DISTRIBUTION VALIDATION
-- ============================================================================
-- Validates the "Source Type Distribution" section
-- IMPORTANT: Backend uses `usage_count || 1` which means NULL becomes 1
-- Also: Backend converts NULL category to 'other', and filters by date range
-- This query matches backend behavior: COALESCE(usage_count, 1) and handles NULL categories

-- Method 1: Match backend exactly (with date range if needed)
-- Note: Backend filters by created_at date range, but you requested no date filter
-- If values don't match, check if dashboard is using a date range filter
WITH citation_data AS (
  SELECT 
    COALESCE(LOWER(TRIM(c.category)), 'other') AS category_key,
    COALESCE(c.usage_count, 1) AS usage_count -- Backend: usage_count || 1
  FROM public.citations c
  INNER JOIN public.metric_facts mf ON c.collector_result_id = mf.collector_result_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    -- Backend filters by created_at date range, but you requested no date filter
    -- Uncomment below if dashboard is using a date range:
    -- AND c.created_at >= 'START_DATE'
    -- AND c.created_at <= 'END_DATE'
),
category_totals AS (
  SELECT 
    category_key,
    SUM(usage_count) AS total_usage,
    COUNT(*) AS citation_count
  FROM citation_data
  GROUP BY category_key
),
total_citations AS (
  SELECT SUM(total_usage) AS grand_total
  FROM category_totals
)
SELECT 
  CASE 
    WHEN ct.category_key = 'other' THEN 'Other'
    WHEN ct.category_key = 'editorial' THEN 'Editorial'
    WHEN ct.category_key = 'corporate' THEN 'Corporate'
    WHEN ct.category_key = 'ugc' THEN 'UGC'
    WHEN ct.category_key = 'social' THEN 'Social'
    WHEN ct.category_key = 'institutional' THEN 'Institutional'
    WHEN ct.category_key = 'reference' THEN 'Reference'
    WHEN ct.category_key = 'media' THEN 'Media'
    ELSE INITCAP(ct.category_key)
  END AS source_type,
  ct.citation_count,
  ct.total_usage,
  ROUND(
    (ct.total_usage::numeric / NULLIF(tc.grand_total, 0)) * 100, 
    1
  ) AS percentage
FROM category_totals ct
CROSS JOIN total_citations tc
ORDER BY ct.total_usage DESC;

-- Method 2: Simple query (if Method 1 doesn't match, try this)
-- This excludes NULL usage_count (SQL default behavior)
SELECT 
  COALESCE(c.category, 'Other') AS source_type,
  COUNT(*) AS citation_count,
  SUM(COALESCE(c.usage_count, 1)) AS total_usage,
  ROUND(
    (SUM(COALESCE(c.usage_count, 1))::numeric / 
     NULLIF(SUM(SUM(COALESCE(c.usage_count, 1))) OVER (), 0)) * 100, 
    1
  ) AS percentage
FROM public.citations c
INNER JOIN public.metric_facts mf ON c.collector_result_id = mf.collector_result_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
GROUP BY COALESCE(c.category, 'Other')
ORDER BY total_usage DESC;

-- Alternative: Source Type Distribution with domain breakdown
SELECT 
  COALESCE(LOWER(TRIM(c.category)), 'other') AS source_type,
  c.domain,
  COUNT(*) AS citation_count,
  SUM(COALESCE(c.usage_count, 1)) AS total_usage
FROM public.citations c
INNER JOIN public.metric_facts mf ON c.collector_result_id = mf.collector_result_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
GROUP BY COALESCE(LOWER(TRIM(c.category)), 'other'), c.domain
ORDER BY source_type, total_usage DESC;

