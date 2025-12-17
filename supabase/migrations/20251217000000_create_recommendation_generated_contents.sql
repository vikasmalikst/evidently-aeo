/*
  # Create Recommendation Generated Contents Table

  Stores LLM-generated content drafts for each recommendation, with accept/reject state.

  ## New Table: recommendation_generated_contents
  - Links to recommendations / generations / brand / customer
  - Stores the generated content, prompt, model/provider used
  - Tracks status (generated/accepted/rejected)
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.recommendation_generated_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  recommendation_id UUID NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES public.recommendation_generations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'accepted', 'rejected')),

  content_type TEXT NOT NULL DEFAULT 'draft',
  content TEXT NOT NULL,

  model_provider TEXT NOT NULL CHECK (model_provider IN ('cerebras', 'openrouter')),
  model_name TEXT,

  prompt TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recommendation_generated_contents_recommendation
  ON public.recommendation_generated_contents(recommendation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_generated_contents_generation
  ON public.recommendation_generated_contents(generation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_generated_contents_brand
  ON public.recommendation_generated_contents(brand_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_generated_contents_status
  ON public.recommendation_generated_contents(status);

-- Enable Row Level Security
ALTER TABLE public.recommendation_generated_contents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage recommendation generated contents"
  ON public.recommendation_generated_contents FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can view recommendation generated contents"
  ON public.recommendation_generated_contents FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.recommendation_generated_contents IS 'Stores LLM-generated content drafts for recommendations, with accept/reject status and model metadata.';
