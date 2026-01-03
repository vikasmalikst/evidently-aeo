/*
  # Populate Product Mentions from consolidated_analysis_cache
  
  This migration populates total_brand_product_mentions and total_competitor_product_mentions
  in brand_metrics and competitor_metrics tables by counting product mentions in the raw_answer text.
  
  Data Source:
  - consolidated_analysis_cache.products (JSONB) contains:
    {
      "brand": ["product1", "product2"],
      "competitors": {
        "Competitor1": ["productA", "productB"],
        "Competitor2": []
      }
    }
  - collector_results.raw_answer (TEXT) contains the answer text to search in
  
  Logic:
  1. Extract product names from consolidated_analysis_cache.products
  2. Count occurrences of each product name in collector_results.raw_answer (case-insensitive, word-boundary aware)
  3. Sum all product mentions for brand and each competitor
  4. Update brand_metrics.total_brand_product_mentions
  5. Update competitor_metrics.total_competitor_product_mentions
*/

-- ============================================================================
-- HELPER FUNCTION: Count word occurrences in text (case-insensitive, word-boundary aware)
-- ============================================================================

CREATE OR REPLACE FUNCTION count_word_occurrences(
  text_to_search TEXT,
  word_to_find TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  word_count INTEGER := 0;
  search_text_lower TEXT;
  word_lower TEXT;
  escaped_word TEXT;
BEGIN
  -- Handle null inputs
  IF text_to_search IS NULL OR word_to_find IS NULL OR LENGTH(TRIM(word_to_find)) = 0 THEN
    RETURN 0;
  END IF;
  
  -- Convert to lowercase for case-insensitive matching
  search_text_lower := LOWER(text_to_search);
  word_lower := LOWER(TRIM(word_to_find));
  
  -- Escape special regex characters in the word
  escaped_word := regexp_replace(word_lower, '([\[\](){}.*+?^$|\\])', '\\\1', 'g');
  
  -- Count occurrences using regexp_matches with word boundaries
  -- \m = word start, \M = word end (PostgreSQL word boundary markers)
  -- This ensures we match whole words only, not partial matches
  SELECT COUNT(*) INTO word_count
  FROM regexp_matches(search_text_lower, '\m' || escaped_word || '\M', 'g');
  
  -- regexp_matches returns NULL if no matches, COUNT(*) returns 0 in that case
  RETURN COALESCE(word_count, 0);
END;
$$;

COMMENT ON FUNCTION count_word_occurrences IS 
  'Counts occurrences of a word in text using case-insensitive, word-boundary aware matching';

-- ============================================================================
-- STEP 1: Update brand_metrics.total_brand_product_mentions
-- ============================================================================

UPDATE public.brand_metrics bm
SET total_brand_product_mentions = COALESCE(
  (
    SELECT SUM(
      count_word_occurrences(
        cr.raw_answer,
        product_name.value::TEXT
      )
    )
    FROM public.metric_facts mf
    INNER JOIN public.collector_results cr ON cr.id = mf.collector_result_id
    INNER JOIN public.consolidated_analysis_cache cac ON cac.collector_result_id = cr.id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(cac.products->'brand', '[]'::jsonb)
    ) AS product_name
    WHERE mf.id = bm.metric_fact_id
  ),
  0
)
WHERE EXISTS (
  SELECT 1
  FROM public.metric_facts mf
  INNER JOIN public.collector_results cr ON cr.id = mf.collector_result_id
  INNER JOIN public.consolidated_analysis_cache cac ON cac.collector_result_id = cr.id
  WHERE mf.id = bm.metric_fact_id
    AND cac.products IS NOT NULL
    AND cac.products->'brand' IS NOT NULL
    AND jsonb_array_length(COALESCE(cac.products->'brand', '[]'::jsonb)) > 0
);

-- Log update results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.brand_metrics
  WHERE total_brand_product_mentions > 0;
  
  RAISE NOTICE '✅ Updated brand_metrics.total_brand_product_mentions for % rows', updated_count;
END $$;

-- ============================================================================
-- STEP 2: Update competitor_metrics.total_competitor_product_mentions
-- ============================================================================

-- First, we need to match competitor names from consolidated_analysis_cache
-- to competitor_id in competitor_metrics via brand_competitors table

-- Update competitor product mentions
-- Handle case-insensitive competitor name matching in JSONB
UPDATE public.competitor_metrics cm
SET total_competitor_product_mentions = COALESCE(
  (
    SELECT SUM(
      count_word_occurrences(
        cr.raw_answer,
        product_name.value::TEXT
      )
    )
    FROM public.metric_facts mf
    INNER JOIN public.collector_results cr ON cr.id = mf.collector_result_id
    INNER JOIN public.consolidated_analysis_cache cac ON cac.collector_result_id = cr.id
    INNER JOIN public.brand_competitors bc ON bc.id = cm.competitor_id
    -- Find the matching competitor key (case-insensitive) and extract products
    CROSS JOIN LATERAL (
      SELECT jsonb_array_elements_text(
        COALESCE(
          (
            SELECT cac.products->'competitors'->comp_key
            FROM jsonb_object_keys(cac.products->'competitors') AS comp_key
            WHERE LOWER(comp_key) = LOWER(bc.competitor_name)
            LIMIT 1
          ),
          '[]'::jsonb
        )
      ) AS value
    ) AS product_name
    WHERE mf.id = cm.metric_fact_id
      AND cac.products IS NOT NULL
      AND cac.products->'competitors' IS NOT NULL
      -- Ensure competitor exists in the products JSONB
      AND EXISTS (
        SELECT 1
        FROM jsonb_object_keys(cac.products->'competitors') AS comp_key
        WHERE LOWER(comp_key) = LOWER(bc.competitor_name)
      )
  ),
  0
)
WHERE EXISTS (
  SELECT 1
  FROM public.metric_facts mf
  INNER JOIN public.collector_results cr ON cr.id = mf.collector_result_id
  INNER JOIN public.consolidated_analysis_cache cac ON cac.collector_result_id = cr.id
  INNER JOIN public.brand_competitors bc ON bc.id = cm.competitor_id
  WHERE mf.id = cm.metric_fact_id
    AND cac.products IS NOT NULL
    AND cac.products->'competitors' IS NOT NULL
    -- Match competitor name (case-insensitive)
    AND EXISTS (
      SELECT 1
      FROM jsonb_object_keys(cac.products->'competitors') AS comp_key
      WHERE LOWER(comp_key) = LOWER(bc.competitor_name)
    )
);

-- Log update results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.competitor_metrics
  WHERE total_competitor_product_mentions > 0;
  
  RAISE NOTICE '✅ Updated competitor_metrics.total_competitor_product_mentions for % rows', updated_count;
END $$;

-- ============================================================================
-- STEP 3: Validation Queries (for manual verification)
-- ============================================================================

-- Check brand product mentions distribution
DO $$
DECLARE
  total_brand_rows INTEGER;
  rows_with_products INTEGER;
  max_product_mentions INTEGER;
  avg_product_mentions NUMERIC;
BEGIN
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE total_brand_product_mentions > 0),
         MAX(total_brand_product_mentions),
         ROUND(AVG(total_brand_product_mentions)::NUMERIC, 2)
  INTO total_brand_rows, rows_with_products, max_product_mentions, avg_product_mentions
  FROM public.brand_metrics;
  
  RAISE NOTICE '📊 Brand Metrics Summary:';
  RAISE NOTICE '   Total rows: %', total_brand_rows;
  RAISE NOTICE '   Rows with product mentions > 0: %', rows_with_products;
  RAISE NOTICE '   Max product mentions: %', max_product_mentions;
  RAISE NOTICE '   Avg product mentions: %', avg_product_mentions;
END $$;

-- Check competitor product mentions distribution
DO $$
DECLARE
  total_comp_rows INTEGER;
  rows_with_products INTEGER;
  max_product_mentions INTEGER;
  avg_product_mentions NUMERIC;
BEGIN
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE total_competitor_product_mentions > 0),
         MAX(total_competitor_product_mentions),
         ROUND(AVG(total_competitor_product_mentions)::NUMERIC, 2)
  INTO total_comp_rows, rows_with_products, max_product_mentions, avg_product_mentions
  FROM public.competitor_metrics;
  
  RAISE NOTICE '📊 Competitor Metrics Summary:';
  RAISE NOTICE '   Total rows: %', total_comp_rows;
  RAISE NOTICE '   Rows with product mentions > 0: %', rows_with_products;
  RAISE NOTICE '   Max product mentions: %', max_product_mentions;
  RAISE NOTICE '   Avg product mentions: %', avg_product_mentions;
END $$;

-- Sample verification query (uncomment to run manually)
/*
SELECT 
  mf.collector_result_id,
  cr.raw_answer,
  cac.products->'brand' AS brand_products,
  bm.total_brand_product_mentions,
  cm.competitor_id,
  bc.competitor_name,
  cac.products->'competitors'->>bc.competitor_name AS competitor_products,
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
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250203000000_populate_product_mentions.sql completed successfully';
  RAISE NOTICE '📝 Product mentions have been populated from consolidated_analysis_cache';
  RAISE NOTICE '🔍 Run the validation queries above to verify the results';
END $$;

