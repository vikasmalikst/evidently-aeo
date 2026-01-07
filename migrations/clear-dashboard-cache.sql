-- Clear all dashboard cache entries
-- Run this if you need to force all dashboards to recompute with new schema

DELETE FROM brand_dashboard_snapshots;

-- Or to clear cache for a specific customer:
-- DELETE FROM brand_dashboard_snapshots WHERE customer_id = 'YOUR_CUSTOMER_ID';

-- Or to clear cache for a specific brand:
-- DELETE FROM brand_dashboard_snapshots WHERE brand_id = 'YOUR_BRAND_ID';

