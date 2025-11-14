/*
  # Extend dashboard snapshots with date range

  - Allow caching multiple date windows per brand & customer
*/

ALTER TABLE brand_dashboard_snapshots
  ADD COLUMN IF NOT EXISTS range_start timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  ADD COLUMN IF NOT EXISTS range_end timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z';

ALTER TABLE brand_dashboard_snapshots
  DROP CONSTRAINT IF EXISTS brand_dashboard_snapshots_pkey;

ALTER TABLE brand_dashboard_snapshots
  ADD CONSTRAINT brand_dashboard_snapshots_pkey
  PRIMARY KEY (brand_id, customer_id, range_start, range_end);

CREATE INDEX IF NOT EXISTS idx_brand_dashboard_snapshots_range_lookup
  ON brand_dashboard_snapshots (customer_id, range_start, range_end, computed_at DESC);

