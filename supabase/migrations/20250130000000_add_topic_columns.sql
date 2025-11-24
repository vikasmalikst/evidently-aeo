/*
  # Add topic column to generated_queries, collector_results, and extracted_positions tables

  This migration adds a dedicated `topic` column to store topic names instead of storing them in the metadata JSON column.
  This improves query performance and makes topic-based filtering more efficient.

  ## Changes
  1. Add `topic` column (text, nullable) to `generated_queries` table
  2. Add `topic` column (text, nullable) to `collector_results` table  
  3. Add `topic` column (text, nullable) to `extracted_positions` table
  4. Create indexes on topic columns for better query performance
  5. Backfill topic data from metadata columns to the new topic columns
*/

-- Add topic column to generated_queries table
ALTER TABLE public.generated_queries
  ADD COLUMN IF NOT EXISTS topic text;

-- Add topic column to collector_results table
ALTER TABLE public.collector_results
  ADD COLUMN IF NOT EXISTS topic text;

-- Add topic column to extracted_positions table
ALTER TABLE public.extracted_positions
  ADD COLUMN IF NOT EXISTS topic text;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_generated_queries_topic 
  ON public.generated_queries(topic) 
  WHERE topic IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collector_results_topic 
  ON public.collector_results(topic) 
  WHERE topic IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_extracted_positions_topic 
  ON public.extracted_positions(topic) 
  WHERE topic IS NOT NULL;

-- Backfill topic data from metadata columns
-- For generated_queries: extract from metadata->>'topic_name' or metadata->>'topic'
UPDATE public.generated_queries
SET topic = COALESCE(
  metadata->>'topic_name',
  metadata->>'topic',
  NULL
)
WHERE topic IS NULL
  AND metadata IS NOT NULL
  AND (
    metadata ? 'topic_name' OR 
    metadata ? 'topic'
  );

-- For collector_results: extract from metadata->>'topic' or get from generated_queries
UPDATE public.collector_results cr
SET topic = COALESCE(
  cr.metadata->>'topic',
  cr.metadata->>'topic_name',
  gq.metadata->>'topic_name',
  gq.metadata->>'topic',
  gq.topic,
  NULL
)
FROM public.generated_queries gq
WHERE cr.query_id = gq.id
  AND cr.topic IS NULL
  AND (
    cr.metadata IS NOT NULL AND (cr.metadata ? 'topic' OR cr.metadata ? 'topic_name')
    OR gq.metadata IS NOT NULL AND (gq.metadata ? 'topic_name' OR gq.metadata ? 'topic')
    OR gq.topic IS NOT NULL
  );

-- For extracted_positions: extract from metadata->>'topic_name' or get from generated_queries
UPDATE public.extracted_positions ep
SET topic = COALESCE(
  ep.metadata->>'topic_name',
  ep.metadata->>'topic',
  gq.metadata->>'topic_name',
  gq.metadata->>'topic',
  gq.topic,
  NULL
)
FROM public.generated_queries gq
WHERE ep.query_id = gq.id
  AND ep.topic IS NULL
  AND (
    ep.metadata IS NOT NULL AND (ep.metadata ? 'topic_name' OR ep.metadata ? 'topic')
    OR gq.metadata IS NOT NULL AND (gq.metadata ? 'topic_name' OR gq.metadata ? 'topic')
    OR gq.topic IS NOT NULL
  );

-- Add comments for documentation
COMMENT ON COLUMN public.generated_queries.topic IS 'Topic name associated with this query. Extracted from metadata for backward compatibility.';
COMMENT ON COLUMN public.collector_results.topic IS 'Topic name associated with this collector result. Extracted from metadata or linked generated_queries for backward compatibility.';
COMMENT ON COLUMN public.extracted_positions.topic IS 'Topic name associated with this extracted position. Extracted from metadata or linked generated_queries for backward compatibility.';

