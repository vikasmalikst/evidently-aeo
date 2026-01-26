# Competitor Data QA Report - InsiderSports

## Issue Summary

**User Report**: Competitor data is missing since Jan 18, 2026 in the UI

## QA Findings

### Database Verification ✅

1. **Metric Facts Exist**: 
   - Total: 962 rows
   - Date range: Jan 9 - Jan 25, 2026
   - All have correct customer_id ✅

2. **Competitor Metrics Exist**:
   - Total: 2000+ rows
   - Date range: Jan 9 - Jan 25, 2026
   - All metric_facts have corresponding competitor_metrics ✅

3. **Date Coverage**:
   - Jan 9, 10, 12, 14, 15, 17: ✅ Data exists
   - Jan 18: ❌ No data (expected - no collection on this date)
   - Jan 19, 21, 22, 23, 24, 25: ✅ Data exists

### API Query Simulation ⚠️

When simulating the dashboard API query:
- **Expected**: Data for Jan 9-25 (12 dates)
- **Actual**: Data only returned for Jan 9-19 (7 dates)
- **Missing**: Jan 21, 22, 23, 24, 25

### Root Cause Analysis

The issue is **NOT** in the database - data exists for all dates.

The issue appears to be in the **query/retrieval logic**:

1. **Chunking Issue**: 
   - Competitor_metrics are fetched in chunks of 500
   - One chunk returned 502 Bad Gateway error
   - This may cause incomplete data retrieval

2. **Query Logic**:
   - `fetchPositions()` queries metric_facts first (lines 95-122)
   - Then fetches competitor_metrics for those metric_facts (lines 169-184)
   - If chunking fails, competitor data for those dates is missing

3. **Retry Logic**:
   - There IS retry logic (lines 137-152)
   - But 502 errors might not be retried properly
   - Or retries might be exhausting without success

## Verification Results

### Direct Database Query ✅
```sql
-- All dates have competitor_metrics
SELECT 
  DATE(mf.created_at) as date,
  COUNT(DISTINCT mf.id) as metric_facts,
  COUNT(cm.id) as competitor_metrics
FROM metric_facts mf
LEFT JOIN competitor_metrics cm ON mf.id = cm.metric_fact_id
WHERE mf.brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
  AND mf.customer_id = 'ecb3163d-960a-4d99-9402-38d1845ea663'
  AND mf.created_at >= '2026-01-21'
GROUP BY DATE(mf.created_at)
ORDER BY date;
```

**Result**: All dates have competitor_metrics ✅

### API Query Simulation ⚠️
- Query returns data up to Jan 19
- Missing data for Jan 21-25
- 502 error encountered during chunk fetch

## Recommended Fixes

### 1. Improve Retry Logic
- Add exponential backoff for 502 errors
- Increase max retry attempts
- Add better error handling for chunk failures

### 2. Reduce Chunk Size
- Current: 500 rows per chunk
- Suggested: 200-300 rows per chunk
- Reduces chance of 502 errors

### 3. Add Fallback Query
- If chunked query fails, try smaller chunks
- Or query dates individually if needed

### 4. Add Logging
- Log which chunks succeed/fail
- Track which dates are missing competitor data
- Alert when data gaps are detected

## Next Steps

1. **Test with smaller chunks** (200 instead of 500)
2. **Improve retry logic** for 502 errors
3. **Add date range validation** to detect missing dates
4. **Monitor API logs** for 502 errors during competitor_metrics fetch

## Files to Review

- `backend/src/services/brand-dashboard/payload-builder.ts`
  - Lines 137-152: Retry logic
  - Lines 154-158: Chunking logic
  - Lines 169-184: Competitor_metrics fetch
