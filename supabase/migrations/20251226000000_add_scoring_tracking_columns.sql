-- Add scoring tracking columns to collector_results table
-- These columns are required for the consolidated scoring service to track progress

ALTER TABLE collector_results 
ADD COLUMN IF NOT EXISTS scoring_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS scoring_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS scoring_error TEXT;

-- Index for scoring_status to speed up fetching pending rows
CREATE INDEX IF NOT EXISTS idx_collector_results_scoring_status ON collector_results(scoring_status);

-- Function to atomically claim a collector result
-- This avoids complex OR conditions in client-side queries which can cause issues
CREATE OR REPLACE FUNCTION claim_collector_result(row_id BIGINT)
RETURNS SETOF collector_results AS $$
BEGIN
  RETURN QUERY
  UPDATE collector_results
  SET 
    scoring_status = 'processing',
    scoring_started_at = NOW()
  WHERE 
    collector_results.id = row_id
    AND (
      collector_results.scoring_status IS NULL 
      OR collector_results.scoring_status IN ('pending', 'error')
    )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;
