-- Additional performance indexes (complementing your existing indexes)
-- Your existing migration already has most indexes, but this adds one missing piece:

-- Citations: General queries WITHOUT collector_result_id filter
-- Your existing index: idx_citations_brand_customer_collector_result_created_at
--   covers: (brand_id, customer_id, collector_result_id, created_at)
-- But many queries filter by (brand_id, customer_id, created_at) WITHOUT collector_result_id
-- This simpler index will be used for those queries
CREATE INDEX IF NOT EXISTS idx_citations_brand_customer_created_at
ON citations (brand_id, customer_id, created_at DESC);

-- Note: You already have idx_extracted_positions_brand_customer_processed_at
-- which covers the simple case for extracted_positions, so no need to duplicate it.

-- Update statistics so Postgres query planner uses the new indexes
ANALYZE citations;
ANALYZE extracted_positions;
