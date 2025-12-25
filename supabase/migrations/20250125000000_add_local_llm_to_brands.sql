-- Migration: Add local_llm column to brands table
-- Description: Adds brand-specific Ollama configuration storage
-- Date: 2025-01-25

-- Add local_llm column to brands table
-- Stores Ollama configuration as JSONB: { useOllama: boolean, ollamaUrl: string, ollamaModel: string }
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS local_llm JSONB DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.brands.local_llm IS 
  'Brand-specific Ollama configuration for local LLM scoring. Format: { useOllama: boolean, ollamaUrl: string, ollamaModel: string }';

-- Create index for efficient queries (optional, but helpful if we need to find brands using Ollama)
CREATE INDEX IF NOT EXISTS idx_brands_local_llm_enabled 
  ON public.brands((local_llm->>'useOllama')) 
  WHERE (local_llm->>'useOllama')::boolean = true;

