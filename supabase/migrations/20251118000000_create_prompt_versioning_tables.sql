-- Migration: Create Prompt Versioning Tables
-- Description: Adds versioning system for prompt configurations
-- Author: System
-- Date: 2025-11-18

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: prompt_configurations
-- Stores version metadata for prompt configurations
CREATE TABLE IF NOT EXISTS public.prompt_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'initial_setup',
    'prompt_added',
    'prompt_removed',
    'prompt_edited',
    'bulk_update',
    'version_revert'
  )),
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Ensure version uniqueness per brand
  CONSTRAINT unique_version_per_brand UNIQUE (brand_id, customer_id, version)
);

-- Create partial unique index for active configurations (only one active per brand)
CREATE UNIQUE INDEX idx_prompt_configs_active_unique
  ON public.prompt_configurations (brand_id, customer_id)
  WHERE is_active = true;

-- Create regular indexes
CREATE INDEX idx_prompt_configs_brand ON public.prompt_configurations(brand_id, customer_id);
CREATE INDEX idx_prompt_configs_version ON public.prompt_configurations(brand_id, customer_id, version DESC);
CREATE INDEX idx_prompt_configs_created_at ON public.prompt_configurations(created_at DESC);

-- Table 2: prompt_configuration_snapshots
-- Stores actual prompt data for each version (snapshot)
CREATE TABLE IF NOT EXISTS public.prompt_configuration_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.prompt_configurations(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES public.generated_queries(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  query_text TEXT NOT NULL,
  is_included BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_query_per_config UNIQUE (configuration_id, query_id)
);

CREATE INDEX idx_config_snapshots_config ON public.prompt_configuration_snapshots(configuration_id);
CREATE INDEX idx_config_snapshots_query ON public.prompt_configuration_snapshots(query_id);
CREATE INDEX idx_config_snapshots_topic ON public.prompt_configuration_snapshots(configuration_id, topic);

-- Table 3: prompt_change_log
-- Detailed change tracking for audit purposes
CREATE TABLE IF NOT EXISTS public.prompt_change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.prompt_configurations(id) ON DELETE CASCADE,
  query_id UUID REFERENCES public.generated_queries(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('added', 'removed', 'edited', 'topic_changed')),
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES public.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_log_config ON public.prompt_change_log(configuration_id);
CREATE INDEX idx_change_log_query ON public.prompt_change_log(query_id);
CREATE INDEX idx_change_log_changed_at ON public.prompt_change_log(changed_at DESC);

-- Table 4: prompt_metrics_snapshots
-- Store calculated metrics at the time of each version for comparison
CREATE TABLE IF NOT EXISTS public.prompt_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.prompt_configurations(id) ON DELETE CASCADE,
  total_prompts INTEGER NOT NULL,
  total_topics INTEGER NOT NULL,
  coverage_score DECIMAL(5,2),
  avg_visibility_score DECIMAL(5,2),
  avg_sentiment_score DECIMAL(5,2),
  analyses_count INTEGER DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metrics_data JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT unique_metrics_per_config UNIQUE (configuration_id)
);

CREATE INDEX idx_metrics_snapshots_config ON public.prompt_metrics_snapshots(configuration_id);
CREATE INDEX idx_metrics_snapshots_calculated_at ON public.prompt_metrics_snapshots(calculated_at DESC);

-- Update existing tables

-- Add versioning support to generated_queries
ALTER TABLE public.generated_queries
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_generated_queries_active 
  ON public.generated_queries(brand_id, customer_id, is_active)
  WHERE is_active = true;

-- Add versioning support to collector_results (critical for tracking which version was active)
ALTER TABLE public.collector_results
  ADD COLUMN IF NOT EXISTS configuration_version INTEGER,
  ADD COLUMN IF NOT EXISTS configuration_id UUID REFERENCES public.prompt_configurations(id);

CREATE INDEX IF NOT EXISTS idx_collector_results_config_version 
  ON public.collector_results(brand_id, customer_id, configuration_version);

CREATE INDEX IF NOT EXISTS idx_collector_results_config_id 
  ON public.collector_results(configuration_id);

-- Add comments for documentation
COMMENT ON TABLE public.prompt_configurations IS 'Stores versioned configurations of prompts for each brand';
COMMENT ON TABLE public.prompt_configuration_snapshots IS 'Stores snapshots of prompts included in each configuration version';
COMMENT ON TABLE public.prompt_change_log IS 'Audit log of all changes made to prompt configurations';
COMMENT ON TABLE public.prompt_metrics_snapshots IS 'Stores calculated metrics for each configuration version';

COMMENT ON COLUMN public.prompt_configurations.version IS 'Auto-incremented version number, unique per brand';
COMMENT ON COLUMN public.prompt_configurations.is_active IS 'Only one version can be active at a time per brand';
COMMENT ON COLUMN public.prompt_configurations.change_type IS 'Type of change that created this version';
COMMENT ON COLUMN public.collector_results.configuration_version IS 'Version number active when this result was created';
COMMENT ON COLUMN public.collector_results.configuration_id IS 'Configuration ID active when this result was created';

