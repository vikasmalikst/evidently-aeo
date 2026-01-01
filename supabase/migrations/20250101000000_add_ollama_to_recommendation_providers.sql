/*
  # Add Ollama Support to Recommendation Generated Contents

  Updates the model_provider CHECK constraint to include 'ollama' as a valid provider.
  This allows recommendation content generation to use locally hosted Ollama models.
*/

-- Drop the existing CHECK constraint
ALTER TABLE public.recommendation_generated_contents
  DROP CONSTRAINT IF EXISTS recommendation_generated_contents_model_provider_check;

-- Add the new CHECK constraint with 'ollama' included
ALTER TABLE public.recommendation_generated_contents
  ADD CONSTRAINT recommendation_generated_contents_model_provider_check
  CHECK (model_provider IN ('cerebras', 'openrouter', 'ollama'));

COMMENT ON COLUMN public.recommendation_generated_contents.model_provider IS 
  'LLM provider used: cerebras, openrouter, or ollama (local)';

