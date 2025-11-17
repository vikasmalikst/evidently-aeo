/*
  # Source Attribution Snapshot Cache

  - Stores precomputed source attribution payloads per brand & customer & date range
  - Enables fast /search-sources page loads by serving cached data
  - Supports both "Top Sources" and "Source Coverage" tabs
*/

CREATE TABLE IF NOT EXISTS source_attribution_snapshots (
  brand_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  range_start timestamptz NOT NULL,
  range_end timestamptz NOT NULL,
  payload jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, customer_id, range_start, range_end)
);

CREATE INDEX IF NOT EXISTS idx_source_attribution_snapshots_lookup
  ON source_attribution_snapshots (brand_id, customer_id, range_start, range_end, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_attribution_snapshots_customer
  ON source_attribution_snapshots (customer_id, computed_at DESC);

ALTER TABLE source_attribution_snapshots
  ENABLE ROW LEVEL SECURITY;

-- Allow service role full access; backend uses service_role key
DROP POLICY IF EXISTS "Service role can manage source attribution snapshots" ON source_attribution_snapshots;
CREATE POLICY "Service role can manage source attribution snapshots"
  ON source_attribution_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

