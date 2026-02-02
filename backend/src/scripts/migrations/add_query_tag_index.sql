
-- Add index to query_tag for faster filtering
CREATE INDEX IF NOT EXISTS idx_generated_queries_tag ON generated_queries(query_tag);

-- Verify foreign key index on metric_facts(query_id) exists, if not create it
-- Note: Postgres usually doesn't auto-index FKs, good to have for joins
CREATE INDEX IF NOT EXISTS idx_metric_facts_query_id ON metric_facts(query_id);
