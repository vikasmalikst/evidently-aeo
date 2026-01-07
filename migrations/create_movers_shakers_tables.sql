-- Create Movers & Shakers tables
CREATE TABLE IF NOT EXISTS public.movers_shakers_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'review', 'news', 'social', etc.
  sentiment_score NUMERIC(5, 2), -- -1.0 to 1.0
  action_required TEXT, -- 'Monitor', 'Engage', 'Urgent', etc.
  snippet TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for fast retrieval by brand
  CONSTRAINT movers_shakers_items_brand_id_idx UNIQUE (brand_id, url)
);

CREATE INDEX IF NOT EXISTS idx_movers_shakers_brand_created ON public.movers_shakers_items(brand_id, created_at DESC);
