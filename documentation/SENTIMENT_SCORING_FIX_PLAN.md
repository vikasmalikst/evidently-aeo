# Plan to Fix Sentiment Scoring Issues

## Problem Summary

1. **Rate Limiting (429 errors)**: Competitor sentiment scoring is hitting Cerebras API rate limits
2. **Brand Sentiment Not Scoring**: Brand sentiment scores are not being saved to database, even though competitor scores are working

---

## Issue 1: Rate Limiting (429 Errors)

### Root Causes
- **FALLBACK ISSUE (FIXED)**: Both brand and competitor sentiment scoring had fallbacks to `CEREBRAS_API_KEY`
  - Brand: `CEREBRAS_API_KEY_2` → was falling back to `CEREBRAS_API_KEY` ❌
  - Competitor: `CEREBRAS_API_KEY_4` → was falling back to `CEREBRAS_API_KEY` ❌
  - **If both keys weren't set, they'd use the same fallback key, causing rate limits**
- **BEFORE competitor sentiment was added**: Only brand sentiment was running, so even if it fell back to `CEREBRAS_API_KEY`, there was no competition
- **AFTER competitor sentiment was added**: Both operations running, and if they both fall back to the same key, they compete for rate limits
- Current delays (2s brand, 2.5s competitor) may be insufficient
- No exponential backoff or request queuing
- When rate limit is hit, waits 60s then continues immediately (may hit again)

### Key Insight
**The rate limit issue likely happened because:**
- If `CEREBRAS_API_KEY_2` or `CEREBRAS_API_KEY_4` weren't set, both would fall back to `CEREBRAS_API_KEY`
- This means both operations were using the SAME API key
- Even with different keys, if they're running in parallel or close together, the combined request rate might exceed limits

### Solutions

#### 1.1 Implement Request Queuing/Throttling
- **Priority: HIGH**
- Create a rate limiter that tracks requests per API key
- Queue requests when approaching rate limits
- Use token bucket or sliding window algorithm
- Track requests per second/minute per API key

#### 1.2 Increase Delays Between Requests
- **Priority: MEDIUM**
- Increase brand sentiment delay from 2s to 3-4s
- Increase competitor sentiment delay from 2.5s to 4-5s
- Make delays configurable via environment variables

#### 1.3 Implement Exponential Backoff
- **Priority: HIGH**
- When rate limit is hit, use exponential backoff (60s → 120s → 240s)
- Track consecutive rate limit errors per API key
- Reset backoff after successful requests

#### 1.4 Remove Fallbacks (CRITICAL - DONE)
- **Priority: CRITICAL** ✅ **COMPLETED**
- Remove fallback to `CEREBRAS_API_KEY` from both functions
- Brand sentiment: Use `CEREBRAS_API_KEY_2` ONLY (no fallback)
- Competitor sentiment: Use `CEREBRAS_API_KEY_4` ONLY (no fallback)
- This ensures they never use the same key even if one is missing

#### 1.5 Add Request Rate Monitoring
- **Priority: LOW**
- Log request timestamps per API key
- Track requests per minute/second
- Alert when approaching rate limits

---

## Issue 2: Brand Sentiment Not Scoring

### Root Causes (Potential)
1. Brand sentiment scoring failing silently (errors caught but not logged)
2. Query not finding brand rows correctly (Supabase query issue)
3. Rate limits causing brand scoring to fail before competitor scoring
4. API calls failing but errors being swallowed
5. `updatePositionRowsSentiment` not working correctly for brands
6. Brand sentiment scoring running but errors preventing database updates

### Solutions

#### 2.1 Improve Error Logging and Visibility
- **Priority: HIGH**
- Add detailed logging at each step of brand sentiment scoring:
  - Log when query finds brand rows
  - Log when API calls are made
  - Log when database updates succeed/fail
  - Log any errors with full stack traces
- Add metrics: rows found, rows processed, rows updated, errors

#### 2.2 Fix Query Logic
- **Priority: HIGH**
- Review Supabase query for brand rows:
  ```typescript
  .or('competitor_name.is.null,competitor_name.eq.')
  ```
  - This might not be working correctly
  - Test query directly in Supabase
  - Consider using `.is('competitor_name', null)` instead
  - Add logging to show how many rows the query returns

#### 2.3 Add Error Handling and Retry Logic
- **Priority: HIGH**
- Ensure errors in brand sentiment scoring don't prevent competitor scoring
- Add retry logic for transient failures
- Don't swallow errors - log and handle appropriately
- Check if errors in `analyzeSentiment` are being caught and ignored

#### 2.4 Verify Database Update Logic
- **Priority: HIGH**
- Test `updatePositionRowsSentiment` for brand rows
- Verify it's updating the correct columns (`sentiment_score`, `sentiment_label`, etc.)
- Add logging before/after database updates
- Check if updates are succeeding but being overwritten

#### 2.5 Add Debugging Mode
- **Priority: MEDIUM**
- Add a debug flag to log all operations
- Log the exact SQL queries being executed
- Log the exact data being sent to API
- Log the exact data being saved to database

#### 2.6 Check Execution Order
- **Priority: MEDIUM**
- Verify brand sentiment scoring runs before competitor scoring
- Check if brand scoring errors are preventing competitor scoring
- Ensure errors in one don't block the other

#### 2.7 Add Validation Checks
- **Priority: MEDIUM**
- Before updating database, validate:
  - Row exists
  - Sentiment data is valid
  - API response is valid
- After updating, verify:
  - Database was actually updated
  - Values match what was sent

---

## Implementation Priority

### Phase 1: Critical Fixes (Do First)
1. ✅ **REMOVE FALLBACKS** - Brand uses CEREBRAS_API_KEY_2 ONLY, Competitor uses CEREBRAS_API_KEY_4 ONLY
2. ✅ Improve error logging for brand sentiment scoring
3. ✅ Fix Supabase query for brand rows
4. ✅ Add exponential backoff for rate limits
5. ✅ Verify database update logic works for brands

### Phase 2: Rate Limiting Improvements
1. ✅ Implement request queuing/throttling
2. ✅ Increase delays between requests
3. ✅ Add request rate monitoring

### Phase 3: Robustness
1. ✅ Add retry logic for transient failures
2. ✅ Add validation checks
3. ✅ Add debugging mode
4. ✅ Separate API keys properly

---

## Testing Plan

### Test 1: Brand Sentiment Scoring
- Run brand sentiment scoring on a small batch
- Verify:
  - Query finds brand rows
  - API calls are made
  - Database is updated
  - No errors are swallowed

### Test 2: Rate Limiting
- Run both brand and competitor scoring simultaneously
- Verify:
  - No 429 errors
  - Requests are throttled properly
  - Exponential backoff works

### Test 3: Error Handling
- Simulate API failures
- Verify:
  - Errors are logged properly
  - One failure doesn't block the other
  - Retry logic works

### Test 4: Database Updates
- Run sentiment scoring
- Query database directly to verify:
  - Brand sentiment scores are saved
  - Competitor sentiment scores are saved
  - No data corruption

---

## Files to Modify

1. `backend/src/services/scoring/sentiment-scoring.service.ts`
   - Fix brand sentiment query
   - Add better error logging
   - Implement rate limiting
   - Add exponential backoff

2. `backend/src/services/scoring/brand-scoring.orchestrator.ts`
   - Improve error handling
   - Add better logging
   - Ensure errors don't block other operations

3. `backend/src/utils/api-key-resolver.ts` ✅ **UPDATED**
   - ✅ Removed fallbacks from `getSentimentScoringKey()` and `getCompetitorSentimentScoringKey()`
   - Brand sentiment: Uses `CEREBRAS_API_KEY_2` ONLY
   - Competitor sentiment: Uses `CEREBRAS_API_KEY_4` ONLY

4. Create new file: `backend/src/utils/rate-limiter.ts` (optional)
   - Implement request queuing
   - Track requests per API key
   - Implement throttling

---

## Success Criteria

1. ✅ **No fallbacks** - Brand uses CEREBRAS_API_KEY_2 ONLY, Competitor uses CEREBRAS_API_KEY_4 ONLY
2. ✅ No 429 rate limit errors
3. ✅ Brand sentiment scores are saved to database
4. ✅ Competitor sentiment scores continue to work
5. ✅ Errors are properly logged and visible
6. ✅ System handles rate limits gracefully
7. ✅ One scoring operation failure doesn't block others

---

## Changes Made

### ✅ Completed
1. **Removed fallbacks in `api-key-resolver.ts`**:
   - `getSentimentScoringKey()` now returns `process.env.CEREBRAS_API_KEY_2 || null` (no fallback to CEREBRAS_API_KEY)
   - `getCompetitorSentimentScoringKey()` now returns `process.env.CEREBRAS_API_KEY_4 || null` (no fallback to CEREBRAS_API_KEY)
   - Updated comments to reflect "ONLY (no fallback)"

2. **Updated comments in `sentiment-scoring.service.ts`**:
   - Clarified that brand uses CEREBRAS_API_KEY_2 ONLY
   - Clarified that competitor uses CEREBRAS_API_KEY_4 ONLY

### 🔄 Still To Do
- Improve error logging for brand sentiment scoring
- Fix Supabase query for brand rows (if needed)
- Add exponential backoff for rate limits
- Verify database update logic works for brands

