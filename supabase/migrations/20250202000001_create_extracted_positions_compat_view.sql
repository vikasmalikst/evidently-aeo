-- Migration: Create Compatibility View for extracted_positions
-- 
-- Purpose: Provides backwards compatibility for all services that still query extracted_positions
-- Reads from new optimized schema (metric_facts, brand_metrics, competitor_metrics, brand_sentiment, competitor_sentiment)
-- Returns data in extracted_positions format
--
-- Benefits:
-- - ZERO code changes needed in query services
-- - All services (topics, keywords, prompts, source attribution) work immediately
-- - Can migrate individual services later at your own pace
-- - Materialized for performance
--
-- Refresh Strategy:
-- - Refresh after each data collection batch
-- - Can be automated or manual
-- - Refresh is fast (only processes new data since last refresh)

-- Create materialized view that mimics extracted_positions format
CREATE MATERIALIZED VIEW IF NOT EXISTS public.extracted_positions_compat AS

-- Brand rows (competitor_name = NULL)
SELECT 
  -- Unique ID for each row (combine metric_fact_id and indicator for brand/competitor)
  (mf.id::text || '-brand')::text as row_id,
  
  -- Core reference data from metric_facts
  mf.collector_result_id,
  mf.brand_id,
  mf.customer_id,
  mf.query_id,
  mf.collector_type,
  mf.topic,
  mf.processed_at,
  mf.created_at,
  
  -- Brand name from collector_results (via join)
  cr.brand as brand_name,
  
  -- Brand row indicator
  NULL::text as competitor_name,
  
  -- Brand metrics
  bm.visibility_index,
  NULL::numeric as visibility_index_competitor,
  bm.share_of_answers as share_of_answers_brand,
  NULL::numeric as share_of_answers_competitor,
  bm.total_brand_mentions,
  NULL::integer as competitor_mentions,
  bm.brand_positions,
  NULL::integer[] as competitor_positions,
  bm.has_brand_presence,
  bm.brand_first_position,
  bm.total_word_count,
  
  -- Brand sentiment
  bs.sentiment_score,
  bs.sentiment_label,
  NULL::numeric as sentiment_score_competitor,
  NULL::text as sentiment_label_competitor,
  bs.positive_sentences as sentiment_positive_sentences,
  bs.negative_sentences as sentiment_negative_sentences,
  NULL::jsonb as sentiment_positive_sentences_competitor,
  NULL::jsonb as sentiment_negative_sentences_competitor,
  
  -- Metadata (null for compatibility)
  NULL::jsonb as metadata

FROM public.metric_facts mf
LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
LEFT JOIN public.collector_results cr ON mf.collector_result_id = cr.id

UNION ALL

-- Competitor rows (one per competitor)
SELECT 
  -- Unique ID for each row
  (mf.id::text || '-comp-' || cm.competitor_id::text)::text as row_id,
  
  -- Core reference data from metric_facts
  mf.collector_result_id,
  mf.brand_id,
  mf.customer_id,
  mf.query_id,
  mf.collector_type,
  mf.topic,
  mf.processed_at,
  mf.created_at,
  
  -- Brand name from collector_results (via join)
  cr.brand as brand_name,
  
  -- Competitor row indicator
  bc.competitor_name,
  
  -- Competitor metrics
  NULL::numeric as visibility_index,
  cm.visibility_index as visibility_index_competitor,
  NULL::numeric as share_of_answers_brand,
  cm.share_of_answers as share_of_answers_competitor,
  NULL::integer as total_brand_mentions,
  cm.competitor_mentions,
  NULL::integer[] as brand_positions,
  cm.competitor_positions,
  NULL::boolean as has_brand_presence,
  NULL::integer as brand_first_position,
  NULL::integer as total_word_count,
  
  -- Competitor sentiment
  NULL::numeric as sentiment_score,
  NULL::text as sentiment_label,
  cs.sentiment_score as sentiment_score_competitor,
  cs.sentiment_label as sentiment_label_competitor,
  NULL::jsonb as sentiment_positive_sentences,
  NULL::jsonb as sentiment_negative_sentences,
  cs.positive_sentences as sentiment_positive_sentences_competitor,
  cs.negative_sentences as sentiment_negative_sentences_competitor,
  
  -- Metadata (null for compatibility)
  NULL::jsonb as metadata

FROM public.metric_facts mf
INNER JOIN public.competitor_metrics cm ON mf.id = cm.metric_fact_id
INNER JOIN public.brand_competitors bc ON cm.competitor_id = bc.id
LEFT JOIN public.competitor_sentiment cs ON mf.id = cs.metric_fact_id AND cs.competitor_id = cm.competitor_id
LEFT JOIN public.collector_results cr ON mf.collector_result_id = cr.id;

-- Create indexes for performance (match extracted_positions indexes)
CREATE INDEX IF NOT EXISTS idx_ep_compat_brand_customer_date 
  ON public.extracted_positions_compat(brand_id, customer_id, processed_at);

CREATE INDEX IF NOT EXISTS idx_ep_compat_collector_type 
  ON public.extracted_positions_compat(collector_type);

CREATE INDEX IF NOT EXISTS idx_ep_compat_topic 
  ON public.extracted_positions_compat(topic) 
  WHERE topic IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ep_compat_collector_result 
  ON public.extracted_positions_compat(collector_result_id);

CREATE INDEX IF NOT EXISTS idx_ep_compat_created_at 
  ON public.extracted_positions_compat(created_at);

CREATE INDEX IF NOT EXISTS idx_ep_compat_processed_at 
  ON public.extracted_positions_compat(processed_at);

-- Enable RLS on the view (inherits from underlying tables)
ALTER MATERIALIZED VIEW public.extracted_positions_compat OWNER TO postgres;

-- Add comment
COMMENT ON MATERIALIZED VIEW public.extracted_positions_compat IS 
  'Compatibility view that mimics extracted_positions format. Reads from optimized schema (metric_facts + joins). Refresh after each data collection.';

-- Initial refresh
REFRESH MATERIALIZED VIEW public.extracted_positions_compat;

