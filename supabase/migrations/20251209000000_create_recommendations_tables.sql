/*
  # Create Recommendations Tables
  
  This migration creates tables for storing AI-generated recommendations, diagnostics, and trends.
  Links to brands and customers for tracking recommendation history and performance.
  
  ## New Tables
  
  ### `recommendation_generations`
  - Stores each generation run with metadata (brand, customer, timestamp, problems detected)
  - Links to brands and customers
  - Tracks generation status and metadata
  
  ### `recommendations`
  - Stores individual recommendations from each generation
  - Links to recommendation_generations
  - Stores all recommendation fields (action, reason, explanation, metrics, etc.)
  - Includes calculated score and trend data
  
  ### `recommendation_diagnostics`
  - Stores root cause diagnostic insights for each generation
  - Links to recommendation_generations
  - Stores diagnostic type, severity, title, description, evidence
  
  ### `recommendation_trends`
  - Stores trend analysis data for each generation
  - Links to recommendation_generations
  - Stores current/previous values and change percentages for Visibility, SOA, Sentiment
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: recommendation_generations
-- Stores metadata for each recommendation generation run
CREATE TABLE IF NOT EXISTS public.recommendation_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  problems_detected INTEGER NOT NULL DEFAULT 0,
  recommendations_count INTEGER NOT NULL DEFAULT 0,
  diagnostics_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'partial')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_recommendations_count CHECK (recommendations_count >= 0),
  CONSTRAINT valid_problems_detected CHECK (problems_detected >= 0)
);

-- Indexes for recommendation_generations
CREATE INDEX IF NOT EXISTS idx_recommendation_generations_brand 
  ON public.recommendation_generations(brand_id, customer_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_generations_customer 
  ON public.recommendation_generations(customer_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_generations_generated_at 
  ON public.recommendation_generations(generated_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_generations_brand_generated 
  ON public.recommendation_generations(brand_id, generated_at DESC);

-- Table 2: recommendations
-- Stores individual recommendations from each generation
CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id UUID NOT NULL REFERENCES public.recommendation_generations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Core recommendation fields
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  explanation TEXT NOT NULL,
  
  -- Source and metrics
  citation_source TEXT NOT NULL,
  impact_score TEXT,
  mention_rate TEXT,
  soa TEXT,
  sentiment TEXT,
  visibility_score TEXT,
  citation_count INTEGER DEFAULT 0,
  
  -- Focus areas
  focus_sources TEXT,
  content_focus TEXT,
  
  -- KPI and impact
  kpi TEXT NOT NULL,
  expected_boost TEXT,
  
  -- Effort and timeline
  effort TEXT NOT NULL CHECK (effort IN ('Low', 'Medium', 'High')),
  timeline TEXT,
  
  -- Confidence and priority
  confidence INTEGER NOT NULL DEFAULT 70 CHECK (confidence >= 0 AND confidence <= 100),
  priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
  focus_area TEXT NOT NULL CHECK (focus_area IN ('visibility', 'soa', 'sentiment')),
  
  -- Trend data
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
  trend_change_percent NUMERIC(5, 2),
  
  -- Scoring
  calculated_score NUMERIC(5, 2),
  
  -- Ordering within generation (for ranking)
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_generation 
  ON public.recommendations(generation_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendations_brand 
  ON public.recommendations(brand_id, customer_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendations_generation_order 
  ON public.recommendations(generation_id, display_order);
  
CREATE INDEX IF NOT EXISTS idx_recommendations_focus_area 
  ON public.recommendations(focus_area);
  
CREATE INDEX IF NOT EXISTS idx_recommendations_priority 
  ON public.recommendations(priority);
  
CREATE INDEX IF NOT EXISTS idx_recommendations_effort 
  ON public.recommendations(effort);
  
CREATE INDEX IF NOT EXISTS idx_recommendations_calculated_score 
  ON public.recommendations(calculated_score DESC NULLS LAST);
  
CREATE INDEX IF NOT EXISTS idx_recommendations_brand_created 
  ON public.recommendations(brand_id, created_at DESC);

-- Table 3: recommendation_diagnostics
-- Stores root cause diagnostic insights for each generation
CREATE TABLE IF NOT EXISTS public.recommendation_diagnostics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id UUID NOT NULL REFERENCES public.recommendation_generations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Diagnostic fields
  diagnostic_type TEXT NOT NULL CHECK (diagnostic_type IN (
    'content_structure',
    'authority_gap',
    'reputation_risk',
    'coverage_gap',
    'sentiment_issue'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT NOT NULL,
  
  -- Ordering
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for recommendation_diagnostics
CREATE INDEX IF NOT EXISTS idx_recommendation_diagnostics_generation 
  ON public.recommendation_diagnostics(generation_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_diagnostics_brand 
  ON public.recommendation_diagnostics(brand_id, customer_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_diagnostics_type 
  ON public.recommendation_diagnostics(diagnostic_type);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_diagnostics_severity 
  ON public.recommendation_diagnostics(severity);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_diagnostics_generation_order 
  ON public.recommendation_diagnostics(generation_id, display_order);

-- Table 4: recommendation_trends
-- Stores trend analysis data for each generation
CREATE TABLE IF NOT EXISTS public.recommendation_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id UUID NOT NULL REFERENCES public.recommendation_generations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Trend metric type
  metric_type TEXT NOT NULL CHECK (metric_type IN ('visibility', 'soa', 'sentiment')),
  
  -- Current period values
  current_value NUMERIC(10, 4) NOT NULL,
  
  -- Previous period values
  previous_value NUMERIC(10, 4) NOT NULL,
  
  -- Change calculation
  change_percent NUMERIC(6, 2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down', 'stable')),
  
  -- Period information
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  previous_period_start DATE NOT NULL,
  previous_period_end DATE NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure one trend record per metric type per generation
  CONSTRAINT unique_trend_per_generation_metric 
    UNIQUE (generation_id, metric_type)
);

-- Indexes for recommendation_trends
CREATE INDEX IF NOT EXISTS idx_recommendation_trends_generation 
  ON public.recommendation_trends(generation_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_trends_brand 
  ON public.recommendation_trends(brand_id, customer_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_trends_metric_type 
  ON public.recommendation_trends(metric_type);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_trends_direction 
  ON public.recommendation_trends(direction);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_trends_generation_metric 
  ON public.recommendation_trends(generation_id, metric_type);

-- Table 5: recommendation_user_actions (optional - for tracking user interactions)
-- Tracks user actions on recommendations (dismissed, completed, etc.)
CREATE TABLE IF NOT EXISTS public.recommendation_user_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recommendation_id UUID NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID, -- Optional: if you want to track per-user actions
  
  -- Action type
  action_type TEXT NOT NULL CHECK (action_type IN (
    'viewed',
    'dismissed',
    'marked_complete',
    'marked_in_progress',
    'bookmarked'
  )),
  
  -- Action metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for recommendation_user_actions
CREATE INDEX IF NOT EXISTS idx_recommendation_user_actions_recommendation 
  ON public.recommendation_user_actions(recommendation_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_user_actions_brand 
  ON public.recommendation_user_actions(brand_id, customer_id);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_user_actions_type 
  ON public.recommendation_user_actions(action_type);
  
CREATE INDEX IF NOT EXISTS idx_recommendation_user_actions_created 
  ON public.recommendation_user_actions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.recommendation_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_user_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recommendation_generations
-- Service role can manage all (for backend operations)
CREATE POLICY "Service role can manage recommendation generations"
  ON public.recommendation_generations FOR ALL
  TO service_role
  USING (true);

-- Authenticated users can view their own brand's generations
-- Note: Customer access is validated at application level via JWT
CREATE POLICY "Authenticated users can view recommendation generations"
  ON public.recommendation_generations FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for recommendations
CREATE POLICY "Service role can manage recommendations"
  ON public.recommendations FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can view recommendations"
  ON public.recommendations FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for recommendation_diagnostics
CREATE POLICY "Service role can manage diagnostics"
  ON public.recommendation_diagnostics FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can view diagnostics"
  ON public.recommendation_diagnostics FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for recommendation_trends
CREATE POLICY "Service role can manage trends"
  ON public.recommendation_trends FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can view trends"
  ON public.recommendation_trends FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for recommendation_user_actions
CREATE POLICY "Service role can manage user actions"
  ON public.recommendation_user_actions FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Users can manage own recommendation actions"
  ON public.recommendation_user_actions FOR ALL
  TO authenticated
  USING (
    user_id IS NULL OR user_id = (select auth.uid())
  );

-- Add comments for documentation
COMMENT ON TABLE public.recommendation_generations IS 'Stores metadata for each recommendation generation run';
COMMENT ON TABLE public.recommendations IS 'Stores individual AI-generated recommendations with all fields and calculated scores';
COMMENT ON TABLE public.recommendation_diagnostics IS 'Stores root cause diagnostic insights for each generation';
COMMENT ON TABLE public.recommendation_trends IS 'Stores trend analysis data (current vs previous period) for each generation';
COMMENT ON TABLE public.recommendation_user_actions IS 'Tracks user interactions with recommendations (viewed, dismissed, completed, etc.)';

COMMENT ON COLUMN public.recommendations.calculated_score IS 'Scientific score calculated using formula: (Impact × 0.4) + (Confidence × 0.3) - (Effort × 0.2) + (TrendUrgency × 0.1)';
COMMENT ON COLUMN public.recommendations.display_order IS 'Order within generation (0 = highest priority, based on calculated_score)';
COMMENT ON COLUMN public.recommendation_trends.change_percent IS 'Percentage change: ((current - previous) / previous) × 100';
COMMENT ON COLUMN public.recommendation_trends.direction IS 'Trend direction: up (improving), down (declining), stable (minimal change)';
