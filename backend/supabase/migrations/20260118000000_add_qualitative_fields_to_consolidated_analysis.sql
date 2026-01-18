-- Add qualitative fields to consolidated_analysis_cache
ALTER TABLE consolidated_analysis_cache
ADD COLUMN keywords JSONB DEFAULT '[]'::jsonb,
ADD COLUMN quotes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN narrative JSONB DEFAULT '{}'::jsonb;
