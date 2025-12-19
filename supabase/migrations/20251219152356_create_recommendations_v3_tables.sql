/*
  # Create Recommendations V3 Tables
  
  This migration creates tables for the new Recommendations V3 workflow:
  - KPI-first approach (identify KPIs, then generate recommendations per KPI)
  - 4-step workflow (Generate → Approve → Content → Complete)
  - KPI tracking with before/after values
  
  ## New Tables
  
  ### `recommendation_v3_kpis`
  - Stores identified KPIs for each generation
  - Links to recommendation_generations
  - Stores KPI name, description, current/target values
  
  ## Modified Tables
  
  ### `recommendations` (additions)
  - `kpi_id` - Links recommendation to its KPI
  - `is_approved` - Step 1 → Step 2 workflow flag
  - `is_content_generated` - Step 2 → Step 3 workflow flag
  - `is_completed` - Step 3 → Step 4 workflow flag
  - `completed_at` - Timestamp when marked complete
  - `kpi_before_value` - KPI value at time of completion
  - `kpi_after_value` - KPI value collected next day (via cron)
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: recommendation_v3_kpis
-- Stores identified KPIs for each generation (KPI-first approach)
CREATE TABLE IF NOT EXISTS public.recommendation_v3_kpis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id UUID NOT NULL REFERENCES public.recommendation_generations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- KPI information
  kpi_name TEXT NOT NULL, -- e.g., "Visibility Index", "SOA %", "Sentiment Score"
  kpi_description TEXT NOT NULL, -- Why this KPI matters for this brand
  current_value NUMERIC(10, 4), -- Current KPI value
  target_value NUMERIC(10, 4), -- Target/improved value
  
  -- Ordering
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for recommendation_v3_kpis
CREATE INDEX IF NOT EXISTS idx_recommendation_v3_kpis_generation 
  ON public.recommendation_v3_kpis(generation_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_v3_kpis_brand 
  ON public.recommendation_v3_kpis(brand_id, customer_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_v3_kpis_generation_order 
  ON public.recommendation_v3_kpis(generation_id, display_order);

-- Add new columns to recommendations table for V3 workflow
-- Note: These columns are nullable to maintain backward compatibility with existing recommendations
ALTER TABLE public.recommendations 
  ADD COLUMN IF NOT EXISTS kpi_id UUID REFERENCES public.recommendation_v3_kpis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_content_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS kpi_before_value NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS kpi_after_value NUMERIC(10, 4);

-- Indexes for new recommendation workflow columns
CREATE INDEX IF NOT EXISTS idx_recommendations_kpi_id 
  ON public.recommendations(kpi_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendations_is_approved 
  ON public.recommendations(is_approved) WHERE is_approved = true;
  
CREATE INDEX IF NOT EXISTS idx_recommendations_is_content_generated 
  ON public.recommendations(is_content_generated) WHERE is_content_generated = true;
  
CREATE INDEX IF NOT EXISTS idx_recommendations_is_completed 
  ON public.recommendations(is_completed) WHERE is_completed = true;
  
CREATE INDEX IF NOT EXISTS idx_recommendations_generation_workflow 
  ON public.recommendations(generation_id, is_approved, is_content_generated, is_completed);

-- Enable Row Level Security for recommendation_v3_kpis
ALTER TABLE public.recommendation_v3_kpis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recommendation_v3_kpis
CREATE POLICY "Service role can manage recommendation v3 kpis"
  ON public.recommendation_v3_kpis FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can view recommendation v3 kpis"
  ON public.recommendation_v3_kpis FOR SELECT
  TO authenticated
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE public.recommendation_v3_kpis IS 'Stores identified KPIs for Recommendations V3 (KPI-first approach)';
COMMENT ON COLUMN public.recommendations.kpi_id IS 'Links recommendation to its identified KPI (V3 workflow)';
COMMENT ON COLUMN public.recommendations.is_approved IS 'Step 1 → Step 2: Recommendation has been approved by user';
COMMENT ON COLUMN public.recommendations.is_content_generated IS 'Step 2 → Step 3: Content has been generated for this recommendation';
COMMENT ON COLUMN public.recommendations.is_completed IS 'Step 3 → Step 4: Recommendation has been marked as completed';
COMMENT ON COLUMN public.recommendations.completed_at IS 'Timestamp when recommendation was marked as completed';
COMMENT ON COLUMN public.recommendations.kpi_before_value IS 'KPI value at time of completion (before action)';
COMMENT ON COLUMN public.recommendations.kpi_after_value IS 'KPI value collected next day via cron job (after action)';

