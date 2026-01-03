/*
  Performance: optimized metrics schema indexes + extracted_positions_compat refresh helper

  Goals:
  - Speed up Topics / Sources / Prompts queries that filter by brand_id + customer_id + date + collector_type/topic
  - Provide a safe RPC we can call from the backend to refresh extracted_positions_compat after scoring

  Notes:
  - This migration is safe to run multiple times (IF NOT EXISTS guards).
  - REFRESH MATERIALIZED VIEW cannot be CONCURRENTLY inside a function (transaction-bound), so we use non-concurrent refresh.
*/

-- ============================================================================
-- 1) Composite indexes for common filter patterns
-- ============================================================================

-- Topics / prompts style filters: brand + customer + collector + date
CREATE INDEX IF NOT EXISTS idx_metric_facts_brand_customer_collector_processed
  ON public.metric_facts(brand_id, customer_id, collector_type, processed_at DESC)
  WHERE collector_type IS NOT NULL;

-- Topics aggregations: brand + customer + topic + date
CREATE INDEX IF NOT EXISTS idx_metric_facts_brand_customer_topic_processed
  ON public.metric_facts(brand_id, customer_id, topic, processed_at DESC)
  WHERE topic IS NOT NULL;

-- Source attribution: fast lookup by collector_result_id with brand scope
CREATE INDEX IF NOT EXISTS idx_metric_facts_collector_result_brand
  ON public.metric_facts(collector_result_id, brand_id);

-- ============================================================================
-- 2) extracted_positions_compat refresh RPC (for legacy readers)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_extracted_positions_compat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF to_regclass('public.extracted_positions_compat') IS NULL THEN
    RAISE NOTICE 'extracted_positions_compat does not exist, skipping refresh';
    RETURN;
  END IF;

  REFRESH MATERIALIZED VIEW public.extracted_positions_compat;
END;
$$;

COMMENT ON FUNCTION public.refresh_extracted_positions_compat IS
  'Refreshes the extracted_positions_compat materialized view (non-concurrent). Call after scoring writes metric_facts/metrics tables.';


