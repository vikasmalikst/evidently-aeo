-- ============================================================================
-- VISIBILITY INDEX & SOA MANUAL VERIFICATION QUERIES
-- ============================================================================
-- Replace [YOUR_BRAND_ID] and [YOUR_CUSTOMER_ID] with your actual values
-- ============================================================================

-- Step 1: Find your brand and customer IDs
-- ============================================================================
SELECT id, name, customer_id 
FROM brands 
WHERE name ILIKE '%uber%'  -- Replace with your brand name
LIMIT 5;


-- Step 2: Get sample raw data for verification
-- ============================================================================
-- Replace the IDs below with values from Step 1
SELECT 
    id,
    collector_result_id,
    query_id,
    brand_name,
    -- Raw inputs for calculations
    total_brand_mentions,
    competitor_mentions,
    total_word_count,
    brand_first_position,
    brand_positions,
    -- Stored calculated values (what we'll verify)
    visibility_index AS stored_visibility_index,
    share_of_answers_brand AS stored_soa,
    processed_at
FROM extracted_positions
WHERE brand_id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'  -- REPLACE WITH YOUR BRAND_ID
  AND customer_id = '4522adf5-81bc-496b-b64a-23370a048c44'  -- REPLACE WITH YOUR CUSTOMER_ID
  AND competitor_name IS NULL  -- Only brand rows
  AND visibility_index IS NOT NULL
ORDER BY processed_at DESC
LIMIT 10;


-- Step 3: Calculate Visibility Index manually and compare
-- ============================================================================
SELECT 
    id,
    collector_result_id,
    -- Input values
    brand_first_position,
    total_brand_mentions,
    total_word_count,
    -- Stored value
    visibility_index AS stored_vi,
    -- Manual calculation
    ROUND(
        (
            (1 / NULLIF(LOG(10, NULLIF(brand_first_position, 0) + 9), 0) * 0.6) +
            (NULLIF(total_brand_mentions, 0)::numeric / NULLIF(total_word_count, 1) * 0.4)
        )::numeric, 2
    ) AS calculated_vi,
    -- Difference
    ROUND(
        ABS(
            visibility_index - (
                (1 / NULLIF(LOG(10, NULLIF(brand_first_position, 0) + 9), 0) * 0.6) +
                (NULLIF(total_brand_mentions, 0)::numeric / NULLIF(total_word_count, 1) * 0.4)
            )
        )::numeric, 4
    ) AS difference
FROM extracted_positions
WHERE brand_id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'  -- REPLACE
  AND customer_id = '4522adf5-81bc-496b-b64a-23370a048c44'  -- REPLACE
  AND competitor_name IS NULL
  AND visibility_index IS NOT NULL
  AND brand_first_position IS NOT NULL
ORDER BY processed_at DESC
LIMIT 10;


-- Step 4: Calculate SOA manually and compare
-- ============================================================================
SELECT 
    id,
    collector_result_id,
    -- Input values
    total_brand_mentions,
    competitor_mentions,
    (total_brand_mentions + competitor_mentions) AS total_mentions,
    -- Stored value
    share_of_answers_brand AS stored_soa,
    -- Manual calculation
    ROUND(
        (NULLIF(total_brand_mentions, 0)::numeric / 
         NULLIF((total_brand_mentions + competitor_mentions), 0)) * 100, 
        2
    ) AS calculated_soa,
    -- Difference
    ROUND(
        ABS(
            share_of_answers_brand - (
                (NULLIF(total_brand_mentions, 0)::numeric / 
                 NULLIF((total_brand_mentions + competitor_mentions), 0)) * 100
            )
        )::numeric, 4
    ) AS difference
FROM extracted_positions
WHERE brand_id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'  -- REPLACE
  AND customer_id = '4522adf5-81bc-496b-b64a-23370a048c44'  -- REPLACE
  AND competitor_name IS NULL
  AND share_of_answers_brand IS NOT NULL
ORDER BY processed_at DESC
LIMIT 10;


-- Step 5: Verify relationship with sources (citations)
-- ============================================================================
-- Shows how extracted_positions connect to sources via collector_results → citations
SELECT 
    ep.id AS position_id,
    ep.collector_result_id,
    ep.visibility_index,
    ep.share_of_answers_brand AS soa,
    cr.id AS collector_result_id_check,
    c.domain,
    c.url,
    c.usage_count
FROM extracted_positions ep
JOIN collector_results cr ON ep.collector_result_id = cr.id
LEFT JOIN citations c ON cr.id = c.collector_result_id
WHERE ep.brand_id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'  -- REPLACE
  AND ep.customer_id = '4522adf5-81bc-496b-b64a-23370a048c44'  -- REPLACE
  AND ep.competitor_name IS NULL
ORDER BY ep.processed_at DESC
LIMIT 20;


-- Step 6: Aggregate by source domain (like Sources page)
-- ============================================================================
-- This mimics what source-attribution.service.ts does
SELECT 
    c.domain,
    COUNT(DISTINCT ep.collector_result_id) AS collector_results_count,
    COUNT(DISTINCT ep.id) AS position_count,
    -- Average metrics per source
    ROUND(AVG(ep.share_of_answers_brand), 2) AS avg_soa,
    ROUND(AVG(ep.visibility_index) * 100, 2) AS avg_visibility_percent,
    -- Sum of mentions
    SUM(ep.total_brand_mentions) AS total_brand_mentions,
    -- Total citations from this source
    SUM(c.usage_count) AS total_citations
FROM extracted_positions ep
JOIN collector_results cr ON ep.collector_result_id = cr.id
JOIN citations c ON cr.id = c.collector_result_id
WHERE ep.brand_id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'  -- REPLACE
  AND ep.customer_id = '4522adf5-81bc-496b-b64a-23370a048c44'  -- REPLACE
  AND ep.competitor_name IS NULL
GROUP BY c.domain
ORDER BY collector_results_count DESC
LIMIT 20;


-- Step 7: Calculate dashboard-level aggregations
-- ============================================================================
-- Average Visibility Index (as percentage, like dashboard shows)
SELECT 
    'Last 7 Days' AS period,
    COUNT(*) AS total_queries,
    COUNT(CASE WHEN visibility_index IS NOT NULL THEN 1 END) AS queries_with_visibility,
    ROUND(AVG(visibility_index) * 100, 1) AS avg_visibility_percentage,
    ROUND(AVG(share_of_answers_brand), 1) AS avg_soa_percentage,
    COUNT(CASE WHEN has_brand_presence THEN 1 END) AS queries_with_brand_presence,
    ROUND(
        (COUNT(CASE WHEN has_brand_presence THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 
        1
    ) AS brand_presence_percentage
FROM extracted_positions
WHERE brand_id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'  -- REPLACE
  AND customer_id = '4522adf5-81bc-496b-b64a-23370a048c44'  -- REPLACE
  AND competitor_name IS NULL
  AND processed_at >= NOW() - INTERVAL '7 days';

-- Compare with previous period
SELECT 
    'Previous 7 Days' AS period,
    COUNT(*) AS total_queries,
    COUNT(CASE WHEN visibility_index IS NOT NULL THEN 1 END) AS queries_with_visibility,
    ROUND(AVG(visibility_index) * 100, 1) AS avg_visibility_percentage,
    ROUND(AVG(share_of_answers_brand), 1) AS avg_soa_percentage
FROM extracted_positions
WHERE brand_id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'  -- REPLACE
  AND customer_id = '4522adf5-81bc-496b-b64a-23370a048c44'  -- REPLACE
  AND competitor_name IS NULL
  AND processed_at >= NOW() - INTERVAL '14 days'
  AND processed_at < NOW() - INTERVAL '7 days';


-- Step 8: Find discrepancies (values that don't match calculations)
-- ============================================================================
WITH calculated AS (
    SELECT 
        id,
        collector_result_id,
        visibility_index AS stored_vi,
        share_of_answers_brand AS stored_soa,
        -- Calculate VI
        ROUND(
            (
                (1 / NULLIF(LOG(10, NULLIF(brand_first_position, 0) + 9), 0) * 0.6) +
                (NULLIF(total_brand_mentions, 0)::numeric / NULLIF(total_word_count, 1) * 0.4)
            )::numeric, 2
        ) AS calc_vi,
        -- Calculate SOA
        ROUND(
            (NULLIF(total_brand_mentions, 0)::numeric / 
             NULLIF((total_brand_mentions + competitor_mentions), 0)) * 100, 
            2
        ) AS calc_soa
    FROM extracted_positions
    WHERE brand_id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'  -- REPLACE
      AND customer_id = '4522adf5-81bc-496b-b64a-23370a048c44'  -- REPLACE
      AND competitor_name IS NULL
)
SELECT 
    id,
    collector_result_id,
    stored_vi,
    calc_vi,
    ROUND(ABS(stored_vi - calc_vi), 4) AS vi_difference,
    stored_soa,
    calc_soa,
    ROUND(ABS(stored_soa - calc_soa), 4) AS soa_difference
FROM calculated
WHERE ABS(stored_vi - calc_vi) > 0.01  -- More than 0.01 difference
   OR ABS(stored_soa - calc_soa) > 0.01  -- More than 1% difference
ORDER BY vi_difference DESC, soa_difference DESC;


-- ============================================================================
-- SUMMARY QUERY: Quick overview of all metrics
-- ============================================================================
SELECT 
    'SUMMARY' AS report_type,
    COUNT(*) AS total_positions,
    COUNT(DISTINCT collector_result_id) AS unique_collector_results,
    COUNT(DISTINCT query_id) AS unique_queries,
    ROUND(AVG(visibility_index) * 100, 1) AS avg_visibility_index_percent,
    ROUND(AVG(share_of_answers_brand), 1) AS avg_soa_percent,
    MIN(processed_at) AS earliest_data,
    MAX(processed_at) AS latest_data
FROM extracted_positions
WHERE brand_id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'  -- REPLACE
  AND customer_id = '4522adf5-81bc-496b-b64a-23370a048c44'  -- REPLACE
  AND competitor_name IS NULL;


