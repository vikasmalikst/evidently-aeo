CREATE TABLE IF NOT EXISTS backfill_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    customer_id UUID,
    target_start_date TIMESTAMP WITH TIME ZONE,
    target_end_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL,
    details JSONB,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Add index on brand_id and executed_at for faster history lookups
CREATE INDEX IF NOT EXISTS idx_backfill_history_brand_executed ON backfill_history(brand_id, executed_at DESC);
