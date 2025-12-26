# Backfill Scoring Status Script

## Overview

One-time backfill script to update `scoring_status` field for all `collector_results` where `scoring_status IS NULL`.

## Purpose

This script determines the processing status of collector_results based on the same logic used in the scoring service:
- **Post-query deduplication logic** (from `consolidated-scoring.service.ts`)
- **Position extraction check logic** (from `position-extraction.service.ts`)

## Status Determination

- **`'completed'`**: Fully processed (has `metric_facts` AND `brand_sentiment`)
- **`'pending'`**: Not fully processed (needs processing or partially processed)

## Usage

```bash
npm run script:backfill-scoring-status
```

Or directly:

```bash
ts-node --transpile-only src/scripts/backfill-scoring-status.ts
```

## Configuration

- **Batch size**: 100 records per batch (hardcoded)
- **Schema**: Optimized only (uses `metric_facts` + `brand_sentiment`)
- **Error handling**: Continues on errors (logs and continues)
- **Filtering**: Skips results without `raw_answer`

## What It Does

1. Finds all `collector_results` where:
   - `scoring_status IS NULL`
   - `raw_answer IS NOT NULL`

2. For each result, checks:
   - Does `metric_facts` exist? (Step 2 completed)
   - Does `brand_sentiment` exist? (Step 3 completed)

3. Updates status:
   - `'completed'` if both exist
   - `'pending'` if not fully processed

4. Processes in batches of 100 for performance

## Output

The script provides:
- Progress updates during processing
- Summary statistics:
  - Total processed
  - Completed count
  - Pending count
  - Skipped count
  - Error count

## Example Output

```
🚀 Starting scoring_status backfill...
   Batch size: 100
   Schema: Optimized only (metric_facts + brand_sentiment)

📊 Found 1523 collector_results with NULL scoring_status and raw_answer

📦 Processing batch of 100 collector_results...
   ✅ Updated 45 results to 'completed'
   ✅ Updated 55 results to 'pending'

📈 Progress: 100/1523 (6.6%)

...

============================================================
✅ Backfill Complete!
============================================================
📊 Summary:
   Total processed: 1523
   ✅ Completed: 687
   ⏳ Pending: 836
   ⏭️  Skipped: 0
   ❌ Errors: 0
============================================================
```

## Safety

- **Idempotent**: Safe to run multiple times (only updates NULL status)
- **Non-destructive**: Only updates `scoring_status` field
- **Error-tolerant**: Continues processing even if individual records fail

## Notes

- This is a **one-time migration script**
- After running, the scoring service will use `scoring_status` for filtering
- Results without `raw_answer` are skipped (not updated)

