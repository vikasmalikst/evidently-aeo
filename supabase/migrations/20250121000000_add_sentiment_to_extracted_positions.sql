/*
  # Add sentiment columns to extracted_positions table
  
  This migration adds sentiment analysis columns to the extracted_positions table
  to support competitor sentiment scoring. Following the existing pattern (e.g., 
  visibility_index vs visibility_index_competitor), we have separate columns for
  brand and competitor sentiment.
  
  ## Changes
  1. Add brand sentiment columns:
     - `sentiment_label` (TEXT, nullable) - POSITIVE, NEGATIVE, or NEUTRAL for brand
     - `sentiment_score` (NUMERIC, nullable) - Score from -1.0 to 1.0 for brand
     - `sentiment_positive_sentences` (JSONB, default []) - Positive sentences for brand
     - `sentiment_negative_sentences` (JSONB, default []) - Negative sentences for brand
  2. Add competitor sentiment columns:
     - `sentiment_label_competitor` (TEXT, nullable) - POSITIVE, NEGATIVE, or NEUTRAL for competitor
     - `sentiment_score_competitor` (NUMERIC, nullable) - Score from -1.0 to 1.0 for competitor
     - `sentiment_positive_sentences_competitor` (JSONB, default []) - Positive sentences for competitor
     - `sentiment_negative_sentences_competitor` (JSONB, default []) - Negative sentences for competitor
  3. Create indexes for better query performance
*/

-- Add brand sentiment columns to extracted_positions table
ALTER TABLE public.extracted_positions
  ADD COLUMN IF NOT EXISTS sentiment_label TEXT,
  ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS sentiment_positive_sentences JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sentiment_negative_sentences JSONB DEFAULT '[]'::jsonb;

-- Add competitor sentiment columns to extracted_positions table
ALTER TABLE public.extracted_positions
  ADD COLUMN IF NOT EXISTS sentiment_label_competitor TEXT,
  ADD COLUMN IF NOT EXISTS sentiment_score_competitor NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS sentiment_positive_sentences_competitor JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sentiment_negative_sentences_competitor JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries on brand sentiment_label
CREATE INDEX IF NOT EXISTS idx_extracted_positions_sentiment_label 
  ON public.extracted_positions(sentiment_label) 
  WHERE sentiment_label IS NOT NULL;

-- Add index for brand sentiment_score queries
CREATE INDEX IF NOT EXISTS idx_extracted_positions_sentiment_score 
  ON public.extracted_positions(sentiment_score) 
  WHERE sentiment_score IS NOT NULL;

-- Add index for competitor sentiment_label
CREATE INDEX IF NOT EXISTS idx_extracted_positions_sentiment_label_competitor 
  ON public.extracted_positions(sentiment_label_competitor) 
  WHERE sentiment_label_competitor IS NOT NULL;

-- Add index for competitor sentiment_score
CREATE INDEX IF NOT EXISTS idx_extracted_positions_sentiment_score_competitor 
  ON public.extracted_positions(sentiment_score_competitor) 
  WHERE sentiment_score_competitor IS NOT NULL;

-- Add composite index for filtering by competitor name and competitor sentiment
CREATE INDEX IF NOT EXISTS idx_extracted_positions_competitor_sentiment 
  ON public.extracted_positions(competitor_name, sentiment_label_competitor, sentiment_score_competitor) 
  WHERE competitor_name IS NOT NULL AND sentiment_label_competitor IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.extracted_positions.sentiment_label IS 'Sentiment label for brand: POSITIVE, NEGATIVE, or NEUTRAL';
COMMENT ON COLUMN public.extracted_positions.sentiment_score IS 'Sentiment score for brand from -1.0 (very negative) to 1.0 (very positive)';
COMMENT ON COLUMN public.extracted_positions.sentiment_positive_sentences IS 'Array of sentences with positive sentiment mentioning the brand';
COMMENT ON COLUMN public.extracted_positions.sentiment_negative_sentences IS 'Array of sentences with negative sentiment mentioning the brand';
COMMENT ON COLUMN public.extracted_positions.sentiment_label_competitor IS 'Sentiment label for competitor: POSITIVE, NEGATIVE, or NEUTRAL';
COMMENT ON COLUMN public.extracted_positions.sentiment_score_competitor IS 'Sentiment score for competitor from -1.0 (very negative) to 1.0 (very positive)';
COMMENT ON COLUMN public.extracted_positions.sentiment_positive_sentences_competitor IS 'Array of sentences with positive sentiment mentioning the competitor';
COMMENT ON COLUMN public.extracted_positions.sentiment_negative_sentences_competitor IS 'Array of sentences with negative sentiment mentioning the competitor';

