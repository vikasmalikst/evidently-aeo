/*
  # Create Consolidated Analysis Cache Table
  
  This migration creates a table to cache consolidated analysis results (products, sentiment)
  to enable fault tolerance, resume capability, and incremental processing.
  
  ## New Table
  
  ### `consolidated_analysis_cache`
  - `collector_result_id` (bigint, primary key) - References collector_results.id
  - `products` (jsonb) - Extracted products (brand + competitors)
  - `sentiment` (jsonb) - Sentiment analysis (brand + competitors)
  - `llm_provider` (text) - Which LLM provider was used ('ollama' or 'openrouter')
  - `created_at` (timestamptz) - When the analysis was first cached
  - `updated_at` (timestamptz) - Last update timestamp
  
  ## Indexes
  - Primary key on `collector_result_id` for fast lookups
  - Index on `llm_provider` for analytics/debugging
  - Index on `created_at` for cleanup of old entries
*/

-- Create consolidated_analysis_cache table
CREATE TABLE IF NOT EXISTS public.consolidated_analysis_cache (
  collector_result_id bigint PRIMARY KEY,
  products jsonb NOT NULL DEFAULT '{}'::jsonb,
  sentiment jsonb NOT NULL DEFAULT '{}'::jsonb,
  llm_provider text NOT NULL CHECK (llm_provider IN ('ollama', 'openrouter')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Foreign key to collector_results
  CONSTRAINT fk_consolidated_analysis_cache_collector_result
    FOREIGN KEY (collector_result_id)
    REFERENCES public.collector_results(id)
    ON DELETE CASCADE
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_consolidated_analysis_cache_provider 
  ON public.consolidated_analysis_cache(llm_provider);

CREATE INDEX IF NOT EXISTS idx_consolidated_analysis_cache_created_at 
  ON public.consolidated_analysis_cache(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_consolidated_analysis_cache_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_consolidated_analysis_cache_updated_at ON public.consolidated_analysis_cache;
CREATE TRIGGER update_consolidated_analysis_cache_updated_at
  BEFORE UPDATE ON public.consolidated_analysis_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_consolidated_analysis_cache_updated_at();

-- Enable Row Level Security
ALTER TABLE public.consolidated_analysis_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all records
CREATE POLICY "Service role can manage consolidated analysis cache"
  ON public.consolidated_analysis_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Authenticated users can read their own customer's records
CREATE POLICY "Users can read own customer consolidated analysis cache"
  ON public.consolidated_analysis_cache FOR SELECT
  TO authenticated
  USING (
    collector_result_id IN (
      SELECT id FROM public.collector_results 
      WHERE customer_id IN (
        SELECT customer_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.consolidated_analysis_cache IS 
  'Caches consolidated analysis results (products and sentiment) for each collector_result to enable fault tolerance, resume capability, and incremental processing. Results are provider-agnostic and can be reused regardless of which LLM provider (Ollama or OpenRouter) was used.';

COMMENT ON COLUMN public.consolidated_analysis_cache.collector_result_id IS 
  'References collector_results.id. One analysis cache entry per collector_result.';

COMMENT ON COLUMN public.consolidated_analysis_cache.products IS 
  'JSONB containing extracted products: { "brand": ["product1", "product2"], "competitors": { "competitor1": ["productA"], "competitor2": ["productB"] } }';

COMMENT ON COLUMN public.consolidated_analysis_cache.sentiment IS 
  'JSONB containing sentiment analysis: { "brand": { "label": "POSITIVE", "score": 85 }, "competitors": { "competitor1": { "label": "NEUTRAL", "score": 60 } } }';

COMMENT ON COLUMN public.consolidated_analysis_cache.llm_provider IS 
  'Which LLM provider was used: "ollama" or "openrouter". Stored for analytics/debugging. Results are provider-agnostic and can be reused regardless of provider.';

