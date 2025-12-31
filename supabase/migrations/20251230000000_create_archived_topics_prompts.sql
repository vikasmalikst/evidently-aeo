-- Create archived_topics_prompts table
CREATE TABLE IF NOT EXISTS public.archived_topics_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.brand_topics(id) ON DELETE SET NULL,
    topic_name TEXT NOT NULL,
    prompts JSONB NOT NULL, -- Array of objects {id, text, locale, country, metadata}
    version_tag TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_archived_topics_prompts_brand_created_at
    ON public.archived_topics_prompts (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_archived_topics_prompts_brand_version_tag
    ON public.archived_topics_prompts (brand_id, version_tag);

-- Add version column to brand_topics if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_topics' AND column_name = 'version') THEN
        ALTER TABLE public.brand_topics ADD COLUMN version INTEGER DEFAULT 1;
    END IF;
END $$;
