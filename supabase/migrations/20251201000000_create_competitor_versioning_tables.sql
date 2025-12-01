-- Migration: Create Competitor Versioning Tables
-- Description: Adds versioning support for competitor management (similar to prompts and topics)
-- Date: 2025-12-01

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: competitor_configurations
-- Stores version metadata for competitor configurations
CREATE TABLE IF NOT EXISTS public.competitor_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'initial_setup',
    'competitor_added',
    'competitor_removed',
    'competitor_updated',
    'bulk_update',
    'version_revert'
  )),
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Ensure version uniqueness per brand
  CONSTRAINT unique_competitor_version_per_brand UNIQUE (brand_id, customer_id, version)
);

-- Create partial unique index for active configurations (only one active per brand)
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_configs_active_unique
  ON public.competitor_configurations (brand_id, customer_id)
  WHERE is_active = true;

-- Create regular indexes
CREATE INDEX IF NOT EXISTS idx_competitor_configs_brand 
  ON public.competitor_configurations(brand_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_competitor_configs_version 
  ON public.competitor_configurations(brand_id, customer_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_configs_created_at 
  ON public.competitor_configurations(created_at DESC);

-- Table 2: competitor_configuration_competitors
-- Stores actual competitor data for each version (snapshot)
CREATE TABLE IF NOT EXISTS public.competitor_configuration_competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.competitor_configurations(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  competitor_url TEXT,
  domain TEXT,
  relevance TEXT,
  industry TEXT,
  logo TEXT,
  source TEXT,
  priority INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_competitor_per_config UNIQUE (configuration_id, competitor_name)
);

CREATE INDEX IF NOT EXISTS idx_competitor_config_competitors_config 
  ON public.competitor_configuration_competitors(configuration_id);
CREATE INDEX IF NOT EXISTS idx_competitor_config_competitors_name 
  ON public.competitor_configuration_competitors(competitor_name);

-- Table 3: competitor_change_log
-- Detailed change tracking for audit purposes
CREATE TABLE IF NOT EXISTS public.competitor_change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.competitor_configurations(id) ON DELETE CASCADE,
  competitor_name TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('added', 'removed', 'updated')),
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES public.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_change_log_config 
  ON public.competitor_change_log(configuration_id);
CREATE INDEX IF NOT EXISTS idx_competitor_change_log_changed_at 
  ON public.competitor_change_log(changed_at DESC);

-- Add versioning support to brand_competitors table
-- Link to active configuration version
ALTER TABLE public.brand_competitors
  ADD COLUMN IF NOT EXISTS configuration_id UUID REFERENCES public.competitor_configurations(id),
  ADD COLUMN IF NOT EXISTS configuration_version INTEGER;

CREATE INDEX IF NOT EXISTS idx_brand_competitors_config_version 
  ON public.brand_competitors(brand_id, configuration_version);

-- Add comments for documentation
COMMENT ON TABLE public.competitor_configurations IS 'Stores versioned configurations of competitors for each brand';
COMMENT ON TABLE public.competitor_configuration_competitors IS 'Stores snapshots of competitors included in each configuration version';
COMMENT ON TABLE public.competitor_change_log IS 'Audit log of all changes made to competitor configurations';
COMMENT ON COLUMN public.competitor_configurations.version IS 'Auto-incremented version number, unique per brand';
COMMENT ON COLUMN public.competitor_configurations.is_active IS 'Only one version can be active at a time per brand';
COMMENT ON COLUMN public.competitor_configurations.change_type IS 'Type of change that created this version';
COMMENT ON COLUMN public.brand_competitors.configuration_version IS 'Version number active when this competitor was added';
COMMENT ON COLUMN public.brand_competitors.configuration_id IS 'Configuration ID active when this competitor was added';

