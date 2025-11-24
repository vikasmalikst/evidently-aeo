/*
  # Add collection_time_ms column to collector_results table

  This migration adds a dedicated column to store the time taken for data collection
  for each query execution in its dedicated collector.

  ## Changes
  1. Add `collection_time_ms` column (integer, nullable) to `collector_results` table
  2. Create index on collection_time_ms for performance analysis queries
  3. Backfill collection_time_ms from metadata->>'execution_time_ms' if available
*/

-- Add collection_time_ms column to collector_results table
ALTER TABLE public.collector_results
  ADD COLUMN IF NOT EXISTS collection_time_ms integer;

-- Create index for better query performance when analyzing collection times
CREATE INDEX IF NOT EXISTS idx_collector_results_collection_time_ms 
  ON public.collector_results(collection_time_ms) 
  WHERE collection_time_ms IS NOT NULL;

-- Backfill collection_time_ms from metadata if available
UPDATE public.collector_results
SET collection_time_ms = (metadata->>'execution_time_ms')::integer
WHERE collection_time_ms IS NULL
  AND metadata IS NOT NULL
  AND metadata ? 'execution_time_ms'
  AND (metadata->>'execution_time_ms')::text ~ '^[0-9]+$';

-- Add comment for documentation
COMMENT ON COLUMN public.collector_results.collection_time_ms IS 'Time taken for data collection in milliseconds. Measured from when the collector request starts until the response is received.';

