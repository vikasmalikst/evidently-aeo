-- ============================================================================
-- PROMPTS PAGE VALIDATION QUERIES
-- ============================================================================
-- This file contains validation queries for the Prompts page:
-- 1. Prompt List (with Visibility Score and Sentiment)
-- 2. Responses per Prompt (with Brand, Product, Competitor counts per collector/LLM)
-- 
-- Brand ID: 32b3dc03-fe6b-40e6-94ac-9a146ceca60d
-- Date Range: No date filter - includes all historical data
-- ============================================================================

-- ============================================================================
-- SECTION 1: PROMPT LIST WITH VISIBILITY AND SENTIMENT
-- ============================================================================
-- Validates the prompts list showing:
-- - Prompt text (question)
-- - Topic
-- - Visibility Score (average visibility_index * 100)
-- - Sentiment Score (average sentiment_score)
-- - Collector types that have responses
-- ============================================================================

WITH prompt_data AS (
  SELECT 
    mf.query_id,
    mf.collector_result_id,
    mf.collector_type,
    cr.question,
    mf.topic,
    bm.visibility_index,
    bs.sentiment_score,
    COALESCE(mf.processed_at::date, mf.created_at::date) AS metric_date
  FROM public.metric_facts mf
  INNER JOIN public.collector_results cr ON mf.collector_result_id = cr.id
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  LEFT JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    AND bm.visibility_index IS NOT NULL
    -- Optional: Add customer filter
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
    -- Optional: Add date filter
    -- AND COALESCE(mf.processed_at::date, mf.created_at::date) >= '2025-12-05'::date
    -- AND COALESCE(mf.processed_at::date, mf.created_at::date) <= '2026-01-03'::date
),
prompt_aggregates AS (
  SELECT 
    COALESCE(pd.query_id, 'query:' || pd.collector_result_id::text) AS prompt_id,
    pd.query_id,
    -- Get prompt text (question) - use first non-null question
    (SELECT question FROM prompt_data pd2 
     WHERE COALESCE(pd2.query_id, 'query:' || pd2.collector_result_id::text) = COALESCE(pd.query_id, 'query:' || pd.collector_result_id::text)
       AND pd2.question IS NOT NULL
     LIMIT 1) AS prompt_text,
    -- Get topic - use first non-null topic
    (SELECT topic FROM prompt_data pd2 
     WHERE COALESCE(pd2.query_id, 'query:' || pd2.collector_result_id::text) = COALESCE(pd.query_id, 'query:' || pd.collector_result_id::text)
       AND pd2.topic IS NOT NULL
     LIMIT 1) AS topic,
    -- Average visibility (0-1 scale, convert to 0-100)
    AVG(pd.visibility_index) * 100 AS avg_visibility,
    -- Average sentiment (exclude NULLs)
    AVG(pd.sentiment_score) FILTER (WHERE pd.sentiment_score IS NOT NULL) AS avg_sentiment,
    -- Collector types that have responses
    ARRAY_AGG(DISTINCT pd.collector_type) FILTER (WHERE pd.collector_type IS NOT NULL) AS collector_types,
    -- Count of responses
    COUNT(*) AS response_count
  FROM prompt_data pd
  GROUP BY COALESCE(pd.query_id, 'query:' || pd.collector_result_id::text), pd.query_id
)
SELECT 
  prompt_id,
  prompt_text AS prompt,
  topic,
  ROUND(COALESCE(avg_visibility, 0), 1) AS visibility_score,
  ROUND(COALESCE(avg_sentiment, 0), 0) AS sentiment_score,
  collector_types,
  response_count
FROM prompt_aggregates
WHERE prompt_text IS NOT NULL
ORDER BY avg_visibility DESC, response_count DESC;

-- ============================================================================
-- SECTION 2: RESPONSES PER PROMPT WITH BRAND/PRODUCT/COMPETITOR/KEYWORDS COUNTS PER COLLECTOR
-- ============================================================================
-- Validates the responses section showing:
-- - Collector/LLM type
-- - Response text
-- - Brand mentions count (per collector)
-- - Product mentions count (per collector)
-- - Competitor mentions count (per collector)
-- - Keywords count (per collector)
-- 
-- IMPORTANT: Each collector should have its own unique counts, not shared across collectors
-- ============================================================================

WITH response_data AS (
  SELECT 
    cr.id AS collector_result_id,
    cr.query_id,
    cr.collector_type,
    cr.question,
    cr.raw_answer AS response_text,
    cr.created_at,
    mf.topic,
    -- Brand metrics (per collector_result_id)
    bm.total_brand_mentions,
    bm.total_brand_product_mentions,
    -- Competitor metrics (per collector_result_id)
    COUNT(DISTINCT cm.id) AS competitor_count,
    ARRAY_AGG(DISTINCT bc.competitor_name) FILTER (WHERE bc.competitor_name IS NOT NULL) AS competitor_names,
    -- Keywords count (per collector_result_id)
    (SELECT COUNT(DISTINCT gk.keyword)
     FROM public.generated_keywords gk
     WHERE gk.collector_result_id = cr.id) AS keyword_count
  FROM public.collector_results cr
  INNER JOIN public.metric_facts mf ON cr.id = mf.collector_result_id
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  LEFT JOIN public.competitor_metrics cm ON mf.id = cm.metric_fact_id
  LEFT JOIN public.brand_competitors bc ON cm.competitor_id = bc.id
  WHERE cr.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    -- Optional: Add customer filter
    -- AND cr.customer_id = 'YOUR_CUSTOMER_ID'
    -- Optional: Add date filter
    -- AND cr.created_at >= '2025-12-05'::timestamp
    -- AND cr.created_at <= '2026-01-03'::timestamp
  GROUP BY 
    cr.id,
    cr.query_id,
    cr.collector_type,
    cr.question,
    cr.raw_answer,
    cr.created_at,
    mf.topic,
    bm.total_brand_mentions,
    bm.total_brand_product_mentions
),
-- Group by query_id to show all responses for each prompt
prompt_responses AS (
  SELECT 
    COALESCE(rd.query_id, 'query:' || rd.collector_result_id::text) AS prompt_id,
    rd.query_id,
    (SELECT question FROM response_data rd2 
     WHERE COALESCE(rd2.query_id, 'query:' || rd2.collector_result_id::text) = COALESCE(rd.query_id, 'query:' || rd.collector_result_id::text)
       AND rd2.question IS NOT NULL
     LIMIT 1) AS prompt_text,
    (SELECT topic FROM response_data rd2 
     WHERE COALESCE(rd2.query_id, 'query:' || rd2.collector_result_id::text) = COALESCE(rd.query_id, 'query:' || rd.collector_result_id::text)
       AND rd2.topic IS NOT NULL
     LIMIT 1) AS topic,
    -- Response details per collector
    ARRAY_AGG(
      jsonb_build_object(
        'collector_result_id', rd.collector_result_id,
        'collector_type', rd.collector_type,
        'response_text', LEFT(rd.response_text, 200) || CASE WHEN LENGTH(rd.response_text) > 200 THEN '...' ELSE '' END,
        'created_at', rd.created_at,
        'brand_mentions', rd.total_brand_mentions,
        'product_mentions', rd.total_brand_product_mentions,
        'competitor_mentions', rd.competitor_count,
        'competitor_names', rd.competitor_names,
        'keyword_count', rd.keyword_count
      )
      ORDER BY rd.created_at DESC
    ) AS responses
  FROM response_data rd
  GROUP BY COALESCE(rd.query_id, 'query:' || rd.collector_result_id::text), rd.query_id
)
SELECT 
  pr.prompt_id,
  pr.prompt_text AS prompt,
  pr.topic,
  jsonb_pretty(pr.responses) AS responses_json
FROM prompt_responses pr
WHERE pr.prompt_text IS NOT NULL
ORDER BY pr.prompt_text;

-- ============================================================================
-- SECTION 3: DETAILED RESPONSES WITH COUNTS PER COLLECTOR (TABULAR FORMAT)
-- ============================================================================
-- Shows each response with its collector-specific counts in a table format
-- This helps validate that each collector has unique counts
-- ============================================================================

SELECT 
  cr.id AS collector_result_id,
  cr.query_id,
  cr.collector_type AS llm,
  cr.question AS prompt,
  LEFT(cr.raw_answer, 100) || CASE WHEN LENGTH(cr.raw_answer) > 100 THEN '...' ELSE '' END AS response_preview,
  cr.created_at,
  -- Brand metrics (per collector - should be unique per collector)
  COALESCE(bm.total_brand_mentions, 0) AS brand_mentions,
  COALESCE(bm.total_brand_product_mentions, 0) AS product_mentions,
  -- Competitor count (per collector - should be unique per collector)
  (SELECT COUNT(DISTINCT cm.id)
   FROM public.metric_facts mf2
   INNER JOIN public.competitor_metrics cm ON mf2.id = cm.metric_fact_id
   WHERE mf2.collector_result_id = cr.id) AS competitor_mentions,
  -- Keywords count (per collector - should be unique per collector)
  (SELECT COUNT(DISTINCT gk.keyword)
   FROM public.generated_keywords gk
   WHERE gk.collector_result_id = cr.id) AS keyword_count,
  -- Visibility and Sentiment
  ROUND(COALESCE(bm.visibility_index, 0) * 100, 1) AS visibility_score,
  ROUND(COALESCE(bs.sentiment_score, 0), 0) AS sentiment_score
FROM public.collector_results cr
INNER JOIN public.metric_facts mf ON cr.id = mf.collector_result_id
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE cr.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  -- Optional: Add customer filter
  -- AND cr.customer_id = 'YOUR_CUSTOMER_ID'
  -- Optional: Add date filter
  -- AND cr.created_at >= '2025-12-05'::timestamp
  -- AND cr.created_at <= '2026-01-03'::timestamp
ORDER BY 
  cr.query_id,
  cr.collector_type,
  cr.created_at DESC;

-- ============================================================================
-- SECTION 4: VALIDATION - CHECK FOR DUPLICATE COUNTS ACROSS COLLECTORS
-- ============================================================================
-- This query helps identify if counts are incorrectly shared across collectors
-- If all collectors for the same query have the same counts, there's a bug
-- ============================================================================

WITH collector_counts AS (
  SELECT 
    cr.query_id,
    cr.id AS collector_result_id,
    cr.collector_type,
    COALESCE(bm.total_brand_mentions, 0) AS brand_mentions,
    COALESCE(bm.total_brand_product_mentions, 0) AS product_mentions,
    (SELECT COUNT(DISTINCT cm.id)
     FROM public.metric_facts mf2
     INNER JOIN public.competitor_metrics cm ON mf2.id = cm.metric_fact_id
     WHERE mf2.collector_result_id = cr.id) AS competitor_mentions,
    (SELECT COUNT(DISTINCT gk.keyword)
     FROM public.generated_keywords gk
     WHERE gk.collector_result_id = cr.id) AS keyword_count
  FROM public.collector_results cr
  INNER JOIN public.metric_facts mf ON cr.id = mf.collector_result_id
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE cr.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    AND cr.query_id IS NOT NULL
    -- Optional: Add customer filter
    -- AND cr.customer_id = 'YOUR_CUSTOMER_ID'
),
query_summary AS (
  SELECT 
    query_id,
    COUNT(DISTINCT collector_result_id) AS collector_count,
    COUNT(DISTINCT brand_mentions) AS unique_brand_counts,
    COUNT(DISTINCT product_mentions) AS unique_product_counts,
    COUNT(DISTINCT competitor_mentions) AS unique_competitor_counts,
    COUNT(DISTINCT keyword_count) AS unique_keyword_counts,
    -- Check if all collectors have the same counts (indicates bug)
    CASE 
      WHEN COUNT(DISTINCT brand_mentions) = 1 AND COUNT(DISTINCT collector_result_id) > 1 
      THEN 'WARNING: All collectors have same brand count'
      ELSE 'OK'
    END AS brand_count_status,
    CASE 
      WHEN COUNT(DISTINCT product_mentions) = 1 AND COUNT(DISTINCT collector_result_id) > 1 
      THEN 'WARNING: All collectors have same product count'
      ELSE 'OK'
    END AS product_count_status,
    CASE 
      WHEN COUNT(DISTINCT competitor_mentions) = 1 AND COUNT(DISTINCT collector_result_id) > 1 
      THEN 'WARNING: All collectors have same competitor count'
      ELSE 'OK'
    END AS competitor_count_status,
    CASE 
      WHEN COUNT(DISTINCT keyword_count) = 1 AND COUNT(DISTINCT collector_result_id) > 1 
      THEN 'WARNING: All collectors have same keyword count'
      ELSE 'OK'
    END AS keyword_count_status
  FROM collector_counts
  GROUP BY query_id
)
SELECT 
  query_id,
  collector_count,
  unique_brand_counts,
  unique_product_counts,
  unique_competitor_counts,
  unique_keyword_counts,
  brand_count_status,
  product_count_status,
  competitor_count_status,
  keyword_count_status,
    CASE 
    WHEN brand_count_status LIKE 'WARNING%' OR product_count_status LIKE 'WARNING%' OR competitor_count_status LIKE 'WARNING%' OR keyword_count_status LIKE 'WARNING%'
    THEN 'ISSUE DETECTED'
    ELSE 'OK'
  END AS overall_status
FROM query_summary
WHERE collector_count > 1
ORDER BY 
  CASE WHEN overall_status = 'ISSUE DETECTED' THEN 0 ELSE 1 END,
  collector_count DESC;

-- ============================================================================
-- DEBUG QUERIES
-- ============================================================================

-- Check if total_brand_mentions has 0 values (should be preserved, not converted to NULL)
SELECT 
  'Brand Mentions Check' AS info,
  COUNT(*) AS total_records,
  COUNT(total_brand_mentions) AS records_with_mentions,
  COUNT(*) - COUNT(total_brand_mentions) AS records_with_null_mentions,
  COUNT(*) FILTER (WHERE total_brand_mentions = 0) AS records_with_zero_mentions,
  ROUND((COUNT(*) FILTER (WHERE total_brand_mentions = 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS pct_zero_mentions
FROM public.brand_metrics bm
INNER JOIN public.metric_facts mf ON bm.metric_fact_id = mf.id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d';

-- Check collector-specific counts for a specific query
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  cr.query_id,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  (SELECT COUNT(DISTINCT cm.id)
   FROM public.metric_facts mf2
   INNER JOIN public.competitor_metrics cm ON mf2.id = cm.metric_fact_id
   WHERE mf2.collector_result_id = cr.id) AS competitor_count,
  (SELECT COUNT(DISTINCT gk.keyword)
   FROM public.generated_keywords gk
   WHERE gk.collector_result_id = cr.id) AS keyword_count
FROM public.collector_results cr
INNER JOIN public.metric_facts mf ON cr.id = mf.collector_result_id
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE cr.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  AND cr.query_id IS NOT NULL
  -- Replace with a specific query_id to test
  -- AND cr.query_id = 'YOUR_QUERY_ID'
ORDER BY cr.query_id, cr.collector_type;

