-- ============================================================================
-- Add Row Level Security (RLS) Policies to Optimized Schema
-- ============================================================================
-- This migration adds RLS policies to the new optimized schema tables created
-- in Phase 1. This ensures proper multi-tenant data isolation and security.
-- ============================================================================

-- ============================================================================
-- 1. METRIC_FACTS - Enable RLS and Add Policies
-- ============================================================================

ALTER TABLE public.metric_facts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all records (backend operations)
CREATE POLICY "Service role can manage metric facts"
  ON public.metric_facts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read their own customer's records
CREATE POLICY "Users can read own customer metric facts"
  ON public.metric_facts FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- 2. BRAND_METRICS - Enable RLS and Add Policies
-- ============================================================================

ALTER TABLE public.brand_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all records (backend operations)
CREATE POLICY "Service role can manage brand metrics"
  ON public.brand_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read their own customer's records
CREATE POLICY "Users can read own customer brand metrics"
  ON public.brand_metrics FOR SELECT
  TO authenticated
  USING (
    metric_fact_id IN (
      SELECT id FROM public.metric_facts 
      WHERE customer_id IN (
        SELECT customer_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 3. COMPETITOR_METRICS - Enable RLS and Add Policies
-- ============================================================================

ALTER TABLE public.competitor_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all records (backend operations)
CREATE POLICY "Service role can manage competitor metrics"
  ON public.competitor_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read their own customer's records
CREATE POLICY "Users can read own customer competitor metrics"
  ON public.competitor_metrics FOR SELECT
  TO authenticated
  USING (
    metric_fact_id IN (
      SELECT id FROM public.metric_facts 
      WHERE customer_id IN (
        SELECT customer_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 4. BRAND_SENTIMENT - Enable RLS and Add Policies
-- ============================================================================

ALTER TABLE public.brand_sentiment ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all records (backend operations)
CREATE POLICY "Service role can manage brand sentiment"
  ON public.brand_sentiment FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read their own customer's records
CREATE POLICY "Users can read own customer brand sentiment"
  ON public.brand_sentiment FOR SELECT
  TO authenticated
  USING (
    metric_fact_id IN (
      SELECT id FROM public.metric_facts 
      WHERE customer_id IN (
        SELECT customer_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 5. COMPETITOR_SENTIMENT - Enable RLS and Add Policies
-- ============================================================================

ALTER TABLE public.competitor_sentiment ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all records (backend operations)
CREATE POLICY "Service role can manage competitor sentiment"
  ON public.competitor_sentiment FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read their own customer's records
CREATE POLICY "Users can read own customer competitor sentiment"
  ON public.competitor_sentiment FOR SELECT
  TO authenticated
  USING (
    metric_fact_id IN (
      SELECT id FROM public.metric_facts 
      WHERE customer_id IN (
        SELECT customer_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 6. Add Comments for Documentation
-- ============================================================================

COMMENT ON POLICY "Service role can manage metric facts" ON public.metric_facts IS
  'Allows backend services using service_role key to perform all operations (SELECT, INSERT, UPDATE, DELETE) on metric_facts table.';

COMMENT ON POLICY "Users can read own customer metric facts" ON public.metric_facts IS
  'Allows authenticated frontend users to SELECT only the metric_facts records belonging to their customer_id. Multi-tenant data isolation.';

COMMENT ON POLICY "Service role can manage brand metrics" ON public.brand_metrics IS
  'Allows backend services using service_role key to perform all operations on brand_metrics table.';

COMMENT ON POLICY "Users can read own customer brand metrics" ON public.brand_metrics IS
  'Allows authenticated frontend users to SELECT only brand_metrics records belonging to their customer_id (via metric_facts join).';

COMMENT ON POLICY "Service role can manage competitor metrics" ON public.competitor_metrics IS
  'Allows backend services using service_role key to perform all operations on competitor_metrics table.';

COMMENT ON POLICY "Users can read own customer competitor metrics" ON public.competitor_metrics IS
  'Allows authenticated frontend users to SELECT only competitor_metrics records belonging to their customer_id (via metric_facts join).';

COMMENT ON POLICY "Service role can manage brand sentiment" ON public.brand_sentiment IS
  'Allows backend services using service_role key to perform all operations on brand_sentiment table.';

COMMENT ON POLICY "Users can read own customer brand sentiment" ON public.brand_sentiment IS
  'Allows authenticated frontend users to SELECT only brand_sentiment records belonging to their customer_id (via metric_facts join).';

COMMENT ON POLICY "Service role can manage competitor sentiment" ON public.competitor_sentiment IS
  'Allows backend services using service_role key to perform all operations on competitor_sentiment table.';

COMMENT ON POLICY "Users can read own customer competitor sentiment" ON public.competitor_sentiment IS
  'Allows authenticated frontend users to SELECT only competitor_sentiment records belonging to their customer_id (via metric_facts join).';

-- ============================================================================
-- Verification Queries (run after migration to verify)
-- ============================================================================

-- Check that RLS is enabled on all tables:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment');
-- Expected: All tables should have rowsecurity = true

-- Check policies exist:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment')
-- ORDER BY tablename, policyname;
-- Expected: 2 policies per table (service_role and authenticated)

