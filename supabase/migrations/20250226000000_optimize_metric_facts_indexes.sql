-- Add missing indexes to metric_facts to support default query patterns
-- The default query path uses created_at, but existing indexes are on processed_at

-- Index for default brand + created_at queries
CREATE INDEX IF NOT EXISTS idx_metric_facts_brand_created 
  ON public.metric_facts(brand_id, created_at DESC);

-- Index for default brand + customer + created_at queries
CREATE INDEX IF NOT EXISTS idx_metric_facts_brand_customer_created 
  ON public.metric_facts(brand_id, customer_id, created_at DESC);

-- Index for query_id lookups
CREATE INDEX IF NOT EXISTS idx_metric_facts_query_id 
  ON public.metric_facts(query_id);

-- Index for brand + collector + created_at (often used in filtering)
CREATE INDEX IF NOT EXISTS idx_metric_facts_brand_collector_created 
  ON public.metric_facts(brand_id, collector_type, created_at DESC);
