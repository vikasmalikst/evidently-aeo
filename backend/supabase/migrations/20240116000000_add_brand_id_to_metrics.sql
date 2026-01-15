-- Add brand_id column to metric_facts child tables and backfill data

-- 1. Add brand_id column to child tables
ALTER TABLE brand_metrics ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);
ALTER TABLE competitor_metrics ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);
ALTER TABLE brand_sentiment ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);
ALTER TABLE competitor_sentiment ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);

-- 2. Backfill brand_id from metric_facts (efficient update using FROM clause)
-- brand_metrics
UPDATE brand_metrics
SET brand_id = mf.brand_id
FROM metric_facts mf
WHERE brand_metrics.metric_fact_id = mf.id
AND brand_metrics.brand_id IS NULL;

-- competitor_metrics
UPDATE competitor_metrics
SET brand_id = mf.brand_id
FROM metric_facts mf
WHERE competitor_metrics.metric_fact_id = mf.id
AND competitor_metrics.brand_id IS NULL;

-- brand_sentiment
UPDATE brand_sentiment
SET brand_id = mf.brand_id
FROM metric_facts mf
WHERE brand_sentiment.metric_fact_id = mf.id
AND brand_sentiment.brand_id IS NULL;

-- competitor_sentiment
UPDATE competitor_sentiment
SET brand_id = mf.brand_id
FROM metric_facts mf
WHERE competitor_sentiment.metric_fact_id = mf.id
AND competitor_sentiment.brand_id IS NULL;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_metrics_brand_id ON brand_metrics(brand_id);
CREATE INDEX IF NOT EXISTS idx_competitor_metrics_brand_id ON competitor_metrics(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_sentiment_brand_id ON brand_sentiment(brand_id);
CREATE INDEX IF NOT EXISTS idx_competitor_sentiment_brand_id ON competitor_sentiment(brand_id);

-- 4. Make brand_id non-nullable after backfill (optional but recommended for data integrity)
-- We'll leave it nullable for now as requested by user to avoid strict dependency, 
-- but normally we would enforce NOT NULL here.
