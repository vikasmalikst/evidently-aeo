-- Add sentiment columns to collector_results table
-- These columns will store sentiment analysis results directly in collector_results

ALTER TABLE public.collector_results
  ADD COLUMN IF NOT EXISTS sentiment_label VARCHAR(20),
  ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS sentiment_positive_sentences JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sentiment_negative_sentences JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries on sentiment_label
CREATE INDEX IF NOT EXISTS idx_collector_results_sentiment_label 
  ON public.collector_results(sentiment_label) 
  WHERE sentiment_label IS NOT NULL;

-- Add index for sentiment_score queries
CREATE INDEX IF NOT EXISTS idx_collector_results_sentiment_score 
  ON public.collector_results(sentiment_score) 
  WHERE sentiment_score IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.collector_results.sentiment_label IS 'Sentiment label: POSITIVE, NEGATIVE, or NEUTRAL';
COMMENT ON COLUMN public.collector_results.sentiment_score IS 'Sentiment score from -1.0 (very negative) to 1.0 (very positive)';
COMMENT ON COLUMN public.collector_results.sentiment_positive_sentences IS 'Array of sentences with positive sentiment';
COMMENT ON COLUMN public.collector_results.sentiment_negative_sentences IS 'Array of sentences with negative sentiment';

