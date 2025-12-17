-- ============================================================================
-- SENTIMENT SCORE CONVERSION: OLD FORMAT (-1 to 1) TO NEW FORMAT (0-100)
-- ============================================================================
-- INSTRUCTIONS:
-- 1. Replace YOUR_BRAND_ID with your actual brand_id (e.g., 123)
-- 2. Replace YOUR_CUSTOMER_ID with your actual customer_id (e.g., 456)
-- 3. Run STEP 1 first to create backup
-- 4. Run STEP 2 to preview (optional)
-- 5. Run STEP 3 to convert
-- 6. Run STEP 4 to verify
-- 7. If something goes wrong, run STEP 5 to restore
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE BACKUP (RUN THIS FIRST!)
-- ============================================================================
-- Replace YOUR_BRAND_ID and YOUR_CUSTOMER_ID below

CREATE TABLE IF NOT EXISTS extracted_positions_sentiment_backup AS
SELECT 
  id,
  brand_id,
  customer_id,
  sentiment_score AS sentiment_score_old,
  sentiment_score_competitor AS sentiment_score_competitor_old,
  sentiment_label AS sentiment_label_old,
  sentiment_label_competitor AS sentiment_label_competitor_old,
  NOW() AS backup_created_at
FROM extracted_positions
WHERE brand_id = YOUR_BRAND_ID  -- ⚠️ REPLACE THIS
  AND customer_id = YOUR_CUSTOMER_ID  -- ⚠️ REPLACE THIS
  AND (
    (sentiment_score IS NOT NULL AND sentiment_score BETWEEN -1.0 AND 1.0)
    OR (sentiment_score_competitor IS NOT NULL AND sentiment_score_competitor BETWEEN -1.0 AND 1.0)
  );

-- Check backup was created successfully
SELECT 
  COUNT(*) as total_backed_up,
  COUNT(CASE WHEN sentiment_score_old IS NOT NULL THEN 1 END) as brand_sentiment_backed_up,
  COUNT(CASE WHEN sentiment_score_competitor_old IS NOT NULL THEN 1 END) as competitor_sentiment_backed_up
FROM extracted_positions_sentiment_backup;

-- ============================================================================
-- STEP 2: PREVIEW CONVERSION (OPTIONAL - SAFE TO RUN)
-- ============================================================================
-- This shows what will be converted without actually converting

SELECT 
  id,
  sentiment_score AS old_brand_score,
  ROUND(((sentiment_score + 1.0) / 2.0) * 100.0, 2) AS new_brand_score,
  sentiment_score_competitor AS old_competitor_score,
  ROUND(((sentiment_score_competitor + 1.0) / 2.0) * 100.0, 2) AS new_competitor_score
FROM extracted_positions
WHERE brand_id = YOUR_BRAND_ID  -- ⚠️ REPLACE THIS
  AND customer_id = YOUR_CUSTOMER_ID  -- ⚠️ REPLACE THIS
  AND (
    (sentiment_score IS NOT NULL AND sentiment_score BETWEEN -1.0 AND 1.0)
    OR (sentiment_score_competitor IS NOT NULL AND sentiment_score_competitor BETWEEN -1.0 AND 1.0)
  )
LIMIT 20;

-- ============================================================================
-- STEP 3: CONVERT SENTIMENT SCORES (ONLY RUNS ON OLD FORMAT SCORES)
-- ============================================================================
-- This ONLY converts scores that are between -1 and 1 (old format)
-- Scores already in 0-100 range are NOT touched

-- Convert brand sentiment scores
UPDATE extracted_positions
SET 
  sentiment_score = GREATEST(0, LEAST(100, ROUND(((sentiment_score + 1.0) / 2.0) * 100.0, 2))),
  sentiment_label = CASE
    WHEN ROUND(((sentiment_score + 1.0) / 2.0) * 100.0, 2) < 55 THEN 'NEGATIVE'
    WHEN ROUND(((sentiment_score + 1.0) / 2.0) * 100.0, 2) < 65 THEN 'NEUTRAL'
    ELSE 'POSITIVE'
  END
WHERE brand_id = YOUR_BRAND_ID  -- ⚠️ REPLACE THIS
  AND customer_id = YOUR_CUSTOMER_ID  -- ⚠️ REPLACE THIS
  AND sentiment_score IS NOT NULL
  AND sentiment_score BETWEEN -1.0 AND 1.0;  -- ✅ Only converts old format

-- Convert competitor sentiment scores
UPDATE extracted_positions
SET 
  sentiment_score_competitor = GREATEST(0, LEAST(100, ROUND(((sentiment_score_competitor + 1.0) / 2.0) * 100.0, 2))),
  sentiment_label_competitor = CASE
    WHEN ROUND(((sentiment_score_competitor + 1.0) / 2.0) * 100.0, 2) < 55 THEN 'NEGATIVE'
    WHEN ROUND(((sentiment_score_competitor + 1.0) / 2.0) * 100.0, 2) < 65 THEN 'NEUTRAL'
    ELSE 'POSITIVE'
  END
WHERE brand_id = YOUR_BRAND_ID  -- ⚠️ REPLACE THIS
  AND customer_id = YOUR_CUSTOMER_ID  -- ⚠️ REPLACE THIS
  AND sentiment_score_competitor IS NOT NULL
  AND sentiment_score_competitor BETWEEN -1.0 AND 1.0;  -- ✅ Only converts old format

-- ============================================================================
-- STEP 4: VERIFY CONVERSION
-- ============================================================================
-- Check that all scores are now in 0-100 range

SELECT 
  COUNT(*) as total_rows_checked,
  COUNT(CASE WHEN sentiment_score IS NOT NULL THEN 1 END) as brand_scores_count,
  COUNT(CASE WHEN sentiment_score BETWEEN 0 AND 100 THEN 1 END) as brand_scores_valid,
  COUNT(CASE WHEN sentiment_score_competitor IS NOT NULL THEN 1 END) as competitor_scores_count,
  COUNT(CASE WHEN sentiment_score_competitor BETWEEN 0 AND 100 THEN 1 END) as competitor_scores_valid,
  MIN(sentiment_score) as min_brand_score,
  MAX(sentiment_score) as max_brand_score,
  AVG(sentiment_score) as avg_brand_score
FROM extracted_positions
WHERE brand_id = YOUR_BRAND_ID  -- ⚠️ REPLACE THIS
  AND customer_id = YOUR_CUSTOMER_ID  -- ⚠️ REPLACE THIS
  AND id IN (SELECT id FROM extracted_positions_sentiment_backup);

-- ============================================================================
-- STEP 5: RESTORE FROM BACKUP (ONLY IF SOMETHING GOES WRONG!)
-- ============================================================================
-- Run this ONLY if you need to undo the conversion

-- Restore brand sentiment scores
UPDATE extracted_positions ep
SET 
  sentiment_score = backup.sentiment_score_old,
  sentiment_label = backup.sentiment_label_old
FROM extracted_positions_sentiment_backup backup
WHERE ep.id = backup.id
  AND backup.sentiment_score_old IS NOT NULL;

-- Restore competitor sentiment scores
UPDATE extracted_positions ep
SET 
  sentiment_score_competitor = backup.sentiment_score_competitor_old,
  sentiment_label_competitor = backup.sentiment_label_competitor_old
FROM extracted_positions_sentiment_backup backup
WHERE ep.id = backup.id
  AND backup.sentiment_score_competitor_old IS NOT NULL;

-- Verify restore
SELECT 
  COUNT(*) as restored_count,
  MIN(sentiment_score) as min_restored_score,
  MAX(sentiment_score) as max_restored_score
FROM extracted_positions
WHERE brand_id = YOUR_BRAND_ID  -- ⚠️ REPLACE THIS
  AND customer_id = YOUR_CUSTOMER_ID  -- ⚠️ REPLACE THIS
  AND id IN (SELECT id FROM extracted_positions_sentiment_backup);

-- ============================================================================
-- CLEANUP (OPTIONAL - ONLY AFTER VERIFYING EVERYTHING WORKS CORRECTLY)
-- ============================================================================
-- DROP TABLE IF EXISTS extracted_positions_sentiment_backup;

