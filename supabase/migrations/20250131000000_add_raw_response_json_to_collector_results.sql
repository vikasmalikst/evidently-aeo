-- Add raw_response_json column to collector_results table
-- This column will store the complete JSON response from collectors for debugging and analysis

ALTER TABLE public.collector_results
  ADD COLUMN IF NOT EXISTS raw_response_json JSONB;

-- Add index for faster queries on raw_response_json (optional, for JSONB queries)
CREATE INDEX IF NOT EXISTS idx_collector_results_raw_response_json 
  ON public.collector_results USING GIN (raw_response_json)
  WHERE raw_response_json IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.collector_results.raw_response_json IS 'Complete raw JSON response from the collector API for debugging and analysis purposes';



