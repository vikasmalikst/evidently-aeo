-- ============================================================================
-- SENTIMENT SCORE CONVERSION: OLD FORMAT (-1 to 1) TO NEW FORMAT (0-100)
-- ============================================================================
-- This script converts sentiment scores from old format (-1 to 1) to new format (0-100)
-- for a specific brand_id and customer_id.
--
-- IMPORTANT: Run this in order:
-- 1. STEP 1: Create backup
-- 2. STEP 2: Verify backup
-- 3. STEP 3: Convert scores
-- 4. STEP 4: Verify conversion
-- 5. If something goes wrong: STEP 5: Restore from backup
--
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE BACKUP TABLE
-- ============================================================================
-- This creates a backup of sentiment scores before conversion
-- Replace YOUR_BRAND_ID and YOUR_CUSTOMER_ID with actual values

CREATE TABLE IF NOT EXISTS extracted_positions_sentiment_backup AS
SELECT 
  id,
  brand_id,
  customer_id,
  sentiment_score AS sentiment_score_old,
  sentiment_score_competitor AS sentiment_score_competitor_old,
  sentiment_label AS sentiment_label_old,
  sentiment_label_competitor AS sentiment_label_competitor_old,
  created_at AS backup_created_at
FROM extracted_positions
WHERE brand_id = YOUR_BRAND_ID  -- REPLACE WITH ACTUAL BRAND_ID
  AND customer_id = YOUR_CUSTOMER_ID  -- REPLACE WITH ACTUAL CUSTOMER_ID
  AND (
    (sentiment_score IS NOT NULL AND sentiment_score BETWEEN -1.0 AND 1.0)
    OR (sentiment_score_competitor IS NOT NULL AND sentiment_score_competitor BETWEEN -1.0 AND 1.0)
  );

-- Verify backup was created
SELECT 
  COUNT(*) as backup_count,
  COUNT(CASE WHEN sentiment_score_old IS NOT NULL THEN 1 END) as brand_sentiment_count,
  COUNT(CASE WHEN sentiment_score_competitor_old IS NOT NULL THEN 1 END) as competitor_sentiment_count
FROM extracted_positions_sentiment_backup;

-- ============================================================================
-- STEP 2: PREVIEW CONVERSION (OPTIONAL - CHECK BEFORE ACTUAL CONVERSION)
-- ============================================================================
-- This shows what the conversion will look like without actually converting

SELECT 
  id,
  sentiment_score AS old_brand_score,
  ROUND(((sentiment_score + 1.0) / 2.0) * 100.0, 2) AS new_brand_score,
  sentiment_score_competitor AS old_competitor_score,
  ROUND(((sentiment_score_competitor + 1.0) / 2.0) * 100.0, 2) AS new_competitor_score
FROM extracted_positions
WHERE brand_id = YOUR_BRAND_ID  -- REPLACE WITH ACTUAL BRAND_ID
  AND customer_id = YOUR_CUSTOMER_ID  -- REPLACE WITH ACTUAL CUSTOMER_ID
  AND (
    (sentiment_score IS NOT NULL AND sentiment_score BETWEEN -1.0 AND 1.0)
    OR (sentiment_score_competitor IS NOT NULL AND sentiment_score_competitor BETWEEN -1.0 AND 1.0)
  )
LIMIT 10;  -- Preview first 10 rows

-- ============================================================================
-- STEP 3: CONVERT SENTIMENT SCORES
-- ============================================================================
-- This converts old format (-1 to 1) to new format (0-100)
-- ONLY converts scores that are in the old format range

-- Convert brand sentiment scores
UPDATE extracted_positions
SET 
  sentiment_score = GREATEST(0, LEAST(100, ROUND(((sentiment_score + 1.0) / 2.0) * 100.0, 2))),
  sentiment_label = CASE
    WHEN ROUND(((sentiment_score + 1.0) / 2.0) * 100.0, 2) < 55 THEN 'NEGATIVE'
    WHEN ROUND(((sentiment_score + 1.0) / 2.0) * 100.0, 2) < 65 THEN 'NEUTRAL'
    ELSE 'POSITIVE'
  END
WHERE brand_id = YOUR_BRAND_ID  -- REPLACE WITH ACTUAL BRAND_ID
  AND customer_id = YOUR_CUSTOMER_ID  -- REPLACE WITH ACTUAL CUSTOMER_ID
  AND sentiment_score IS NOT NULL
  AND sentiment_score BETWEEN -1.0 AND 1.0;

-- Convert competitor sentiment scores
UPDATE extracted_positions
SET 
  sentiment_score_competitor = GREATEST(0, LEAST(100, ROUND(((sentiment_score_competitor + 1.0) / 2.0) * 100.0, 2))),
  sentiment_label_competitor = CASE
    WHEN ROUND(((sentiment_score_competitor + 1.0) / 2.0) * 100.0, 2) < 55 THEN 'NEGATIVE'
    WHEN ROUND(((sentiment_score_competitor + 1.0) / 2.0) * 100.0, 2) < 65 THEN 'NEUTRAL'
    ELSE 'POSITIVE'
  END
WHERE brand_id = YOUR_BRAND_ID  -- REPLACE WITH ACTUAL BRAND_ID
  AND customer_id = YOUR_CUSTOMER_ID  -- REPLACE WITH ACTUAL CUSTOMER_ID
  AND sentiment_score_competitor IS NOT NULL
  AND sentiment_score_competitor BETWEEN -1.0 AND 1.0;

-- ============================================================================
-- STEP 4: VERIFY CONVERSION
-- ============================================================================
-- Check that conversion was successful

SELECT 
  COUNT(*) as total_converted,
  COUNT(CASE WHEN sentiment_score IS NOT NULL AND sentiment_score BETWEEN 0 AND 100 THEN 1 END) as brand_scores_in_range,
  COUNT(CASE WHEN sentiment_score_competitor IS NOT NULL AND sentiment_score_competitor BETWEEN 0 AND 100 THEN 1 END) as competitor_scores_in_range,
  MIN(sentiment_score) as min_brand_score,
  MAX(sentiment_score) as max_brand_score,
  AVG(sentiment_score) as avg_brand_score
FROM extracted_positions
WHERE brand_id = YOUR_BRAND_ID  -- REPLACE WITH ACTUAL BRAND_ID
  AND customer_id = YOUR_CUSTOMER_ID  -- REPLACE WITH ACTUAL CUSTOMER_ID
  AND id IN (SELECT id FROM extracted_positions_sentiment_backup);

-- ============================================================================
-- STEP 5: RESTORE FROM BACKUP (IF SOMETHING GOES WRONG)
-- ============================================================================
-- ONLY RUN THIS IF YOU NEED TO REVERT THE CONVERSION

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

-- ============================================================================
-- CLEANUP (OPTIONAL - ONLY AFTER VERIFYING EVERYTHING WORKS)
-- ============================================================================
-- DROP TABLE IF EXISTS extracted_positions_sentiment_backup;

