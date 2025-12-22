# Phase 2: Backfill Historical Data

## Overview

This phase migrates historical data from `extracted_positions` to the new optimized schema tables:
- `metric_facts`
- `brand_metrics`
- `competitor_metrics`
- `brand_sentiment`
- `competitor_sentiment`

## Prerequisites

✅ Phase 1 complete (all tables created and verified)

## Running the Backfill

### Step 1: Test with Dry Run

First, test the migration without writing any data:

```bash
cd backend
DRY_RUN=true npx ts-node src/scripts/phase2-backfill-optimized-schema.ts
```

This will:
- Show what data would be migrated
- Display progress and statistics
- NOT write any data to the database

### Step 2: Run the Actual Migration

Once you've verified the dry run looks good, run the actual migration:

```bash
cd backend
npx ts-node src/scripts/phase2-backfill-optimized-schema.ts
```

### Step 3: Refresh Materialized View

After the backfill completes, refresh the materialized view:

**Run this SQL in Supabase SQL Editor:**
```sql
REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;
```

Or use the provided script:
```bash
# Copy the contents of supabase/migrations/refresh_materialized_view.sql
# and run it in Supabase SQL Editor
```

## Script Features

### Batch Processing
- Processes 100 rows at a time to avoid memory issues
- Shows progress after each batch

### Resume Capability
- Checks if data is already migrated before processing
- Can be safely re-run if interrupted
- Skips already migrated `collector_result_id`s

### Error Handling
- Logs errors without stopping the entire migration
- Continues processing remaining batches
- Shows error count in final summary

### Progress Tracking
```
📦 Batch 1 (offset 0)...
   📦 Processing 25 collector_results (150 rows)
   ✅ Migrated collector_result 12345 (1 brand + 5 competitors)
   ✅ Migrated collector_result 12346 (1 brand + 5 competitors)
   ...
   📈 Progress: 10% (100/1000 rows)
```

## What Gets Migrated

For each `collector_result_id` in `extracted_positions`:

### 1. metric_facts (1 row)
- Core metadata: brand_id, customer_id, query_id, collector_type, topic
- Timestamp: collected_at (from processed_at)

### 2. brand_metrics (1 row)
- Visibility metrics: visibility_index, share_of_answers
- Mention counts: total_mentions, product_mentions
- Position data: first_position, has_presence

### 3. brand_sentiment (1 row, if exists)
- Sentiment: sentiment_label, sentiment_score
- Sentences: positive_sentences, negative_sentences

### 4. competitor_metrics (N rows, one per competitor)
- Same metrics as brand_metrics, but for each competitor
- Links to brand_competitors table via competitor_id

### 5. competitor_sentiment (N rows, one per competitor with sentiment)
- Same sentiment data as brand_sentiment, but for each competitor

## Data Mapping

### From extracted_positions to metric_facts:
```
collector_result_id → collector_result_id
brand_id → brand_id
customer_id → customer_id
query_id → query_id
collector_type → collector_type
topic → topic
processed_at → collected_at
metadata → metadata
```

### From extracted_positions (brand row) to brand_metrics:
```
visibility_index → visibility_index
share_of_answers_brand → share_of_answers
total_brand_mentions → total_mentions
total_brand_mentions → product_mentions (approximate)
brand_first_position → first_position
has_brand_presence → has_presence
```

### From extracted_positions (competitor rows) to competitor_metrics:
```
visibility_index_competitor → visibility_index
share_of_answers_competitor → share_of_answers
competitor_mentions → total_mentions
competitor_mentions → product_mentions (approximate)
competitor_positions[0] → first_position
(competitor_mentions > 0) → has_presence
```

## Expected Output

### Dry Run:
```
========================================
Phase 2: Backfill Historical Data
========================================

🔍 DRY RUN MODE: No data will be written

📊 Total rows in extracted_positions: 1500
📦 Batch size: 100

📦 Batch 1 (offset 0)...
   📦 Processing 25 collector_results (150 rows)
   🔍 [DRY RUN] Would create metric_fact for collector_result 12345
   ...

========================================
BACKFILL COMPLETE
========================================
✅ Collector results processed: 250
✅ Metric facts created: 250
✅ Brand metrics created: 250
✅ Competitor metrics created: 1250
✅ Brand sentiments created: 240
✅ Competitor sentiments created: 1200
⏭️  Skipped (already migrated): 0
❌ Errors: 0

🔍 DRY RUN MODE: No actual data was written
   Run without DRY_RUN=true to perform actual migration
```

### Actual Migration:
```
========================================
Phase 2: Backfill Historical Data
========================================

📊 Total rows in extracted_positions: 1500
📦 Batch size: 100

📦 Batch 1 (offset 0)...
   📦 Processing 25 collector_results (150 rows)
   ✅ Migrated collector_result 12345 (1 brand + 5 competitors)
   ...

========================================
BACKFILL COMPLETE
========================================
✅ Collector results processed: 250
✅ Metric facts created: 250
✅ Brand metrics created: 250
✅ Competitor metrics created: 1250
✅ Brand sentiments created: 240
✅ Competitor sentiments created: 1200
⏭️  Skipped (already migrated): 0
❌ Errors: 0

✅ Next Step: Refresh materialized view
   Run: REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;
```

## Troubleshooting

### Script fails with "Missing Supabase credentials"
**Solution**: Ensure `.env` file has:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### "Competitor not found" warnings
**Solution**: This is normal. Some competitor names in `extracted_positions` might not exist in `brand_competitors` table. These are safely skipped.

### Script is interrupted mid-migration
**Solution**: Simply re-run the script. It will skip already migrated data and continue from where it left off.

### Errors during migration
**Solution**: Check the error logs. The script continues processing other rows even if some fail. After fixing the issue, re-run the script.

## Verification

After backfill completes, verify the data:

```sql
-- Check metric_facts count
SELECT COUNT(*) FROM metric_facts;

-- Check brand_metrics count (should match metric_facts)
SELECT COUNT(*) FROM brand_metrics;

-- Check competitor_metrics count (should be higher than metric_facts)
SELECT COUNT(*) FROM competitor_metrics;

-- Check materialized view has data
SELECT COUNT(*) FROM mv_brand_daily_metrics;

-- Sample data from new schema
SELECT 
  mf.collector_result_id,
  mf.brand_id,
  mf.collector_type,
  bm.visibility_index,
  bm.share_of_answers,
  COUNT(cm.id) as competitor_count
FROM metric_facts mf
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
GROUP BY mf.collector_result_id, mf.brand_id, mf.collector_type, bm.visibility_index, bm.share_of_answers
LIMIT 10;
```

## Performance

- **Small dataset (< 1000 rows)**: 1-2 minutes
- **Medium dataset (1000-10000 rows)**: 5-15 minutes
- **Large dataset (> 10000 rows)**: 30+ minutes

The script shows real-time progress so you can monitor the migration.

## Rollback (if needed)

If something goes wrong, you can rollback by truncating the new tables:

```sql
-- ⚠️ WARNING: This deletes all data from new schema tables
TRUNCATE metric_facts CASCADE;
```

This will cascade delete all related rows in:
- brand_metrics
- competitor_metrics
- brand_sentiment
- competitor_sentiment

Then you can re-run the backfill script.

## Next Step

After Phase 2 completes successfully:
- ✅ Historical data migrated to new schema
- ✅ Materialized view refreshed
- 📋 **Ready for Phase 3**: Implement dual-write (write to both old and new schemas)

