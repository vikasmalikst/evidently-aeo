-- Migration: Create Topic Versioning Tables
-- Description: Adds versioning support for manage-topics experience
-- Date: 2025-11-27

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.topic_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'initial_setup',
    'topic_added',
    'topic_removed',
    'topic_updated',
    'bulk_update',
    'version_revert'
  )),
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT unique_topic_version_per_brand UNIQUE (brand_id, customer_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_configs_active_unique
  ON public.topic_configurations (brand_id, customer_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_topic_configs_brand
  ON public.topic_configurations(brand_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_topic_configs_created_at
  ON public.topic_configurations(created_at DESC);

CREATE TABLE IF NOT EXISTS public.topic_configuration_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.topic_configurations(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  topic_slug TEXT,
  source TEXT,
  category TEXT,
  relevance INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_configuration_topics_config
  ON public.topic_configuration_topics(configuration_id);

CREATE TABLE IF NOT EXISTS public.topic_change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.topic_configurations(id) ON DELETE CASCADE,
  topic_name TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('added', 'removed', 'edited')),
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES public.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_change_log_config
  ON public.topic_change_log(configuration_id);

CREATE INDEX IF NOT EXISTS idx_topic_change_log_changed_at
  ON public.topic_change_log(changed_at DESC);

COMMENT ON TABLE public.topic_configurations IS 'Stores versioned configurations of topics for each brand';
COMMENT ON TABLE public.topic_configuration_topics IS 'Stores the topics included in each configuration version';
COMMENT ON TABLE public.topic_change_log IS 'Audit log of topic configuration modifications';

