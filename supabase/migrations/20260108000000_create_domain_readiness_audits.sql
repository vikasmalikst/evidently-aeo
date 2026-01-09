CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.domain_readiness_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  scores JSONB NOT NULL,
  results JSONB NOT NULL,
  bot_access JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_domain_readiness_audits_brand_id
  ON public.domain_readiness_audits(brand_id);

CREATE INDEX IF NOT EXISTS idx_domain_readiness_audits_created_at
  ON public.domain_readiness_audits(created_at DESC);
