# Competitor Data Fix Summary

## Issue Identified

**Problem**: Competitor data missing in UI for dates after Jan 18, 2026, even though data exists in database.

**Root Cause**: 
- Database has all competitor_metrics data ✅
- API query fails to retrieve all chunks due to 502 errors
- Chunking logic loses data when chunks fail after retries
- Large chunk size (500) causes 502 Bad Gateway errors

## Fixes Implemented

### 1. Reduced Chunk Size ✅
- **Before**: 500 metric_facts per chunk
- **After**: 200 metric_facts per chunk
- **Reason**: Competitor_metrics can have multiple rows per metric_fact_id, causing large result sets that trigger 502 errors

### 2. Improved Retry Logic ✅
- **Before**: 3 retry attempts, only retries 502 errors
- **After**: 5 retry attempts, retries 502/503/504/timeout/Bad Gateway errors
- **Added**: Exponential backoff with jitter to avoid thundering herd

### 3. Better Error Handling ✅
- **Before**: Silent failures, empty data returned
- **After**: Detailed logging with chunk info, warnings for competitor data loss
- **Added**: Chunk identification in error messages for debugging

### 4. Limited Concurrency ✅
- **Before**: All chunks processed in parallel (could overwhelm database)
- **After**: Process 3 chunks at a time (limited concurrency)
- **Reason**: Reduces database load and prevents 502 errors

## Files Modified

- `backend/src/services/brand-dashboard/payload-builder.ts`
  - Lines 131: Reduced chunkSize from 500 to 200
  - Lines 137-173: Improved retry logic with better error detection
  - Lines 182-239: Updated fetchChunkData with chunk info and better logging
  - Lines 240-256: Limited concurrency to 3 chunks at a time

## Expected Results

### Before Fix
- ❌ Competitor data missing for Jan 21-25
- ❌ 502 errors during chunk fetch
- ❌ Silent data loss on chunk failures

### After Fix
- ✅ All competitor data retrieved (Jan 9-25)
- ✅ Better handling of 502 errors with retries
- ✅ Detailed logging for debugging
- ✅ No data loss on transient errors

## Testing

1. **Restart backend** to apply changes
2. **Test dashboard** with InsiderSports brand
3. **Verify competitor charts** show full date range (Jan 9-25)
4. **Check backend logs** for chunk processing messages
5. **Monitor for 502 errors** - should retry automatically

## Monitoring

Watch for these log messages:
- `[Dashboard] Error fetching competitor_metrics chunk X/Y` - Indicates retry attempts
- `[Dashboard] ⚠️ Missing competitor data for N metric_facts` - Indicates data loss (should not happen)
- `[Dashboard] Failed to fetch chunk after 5 attempts` - Indicates persistent failure

## Next Steps

1. Deploy fix to production
2. Monitor logs for 502 errors
3. Verify competitor data displays correctly in UI
4. If issues persist, consider further reducing chunk size to 100
