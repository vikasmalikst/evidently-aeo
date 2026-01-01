# Consolidated Analysis Service - Production Status

## Current Status

### ⚠️ NOT YET IN PRODUCTION (Requires Feature Flag)

The consolidated analysis service is **implemented and tested**, but **NOT automatically enabled** in production. It requires an environment variable to be set.

---

## How It Works

### Current Flow (When Collector Results Are Stored)

1. **Collector Result Stored** → `collector_results` table
2. **Automatic Trigger** → `brandScoringService.scoreBrandAsync()` is called
3. **Scoring Orchestrator** → Runs these services:
   - `positionExtractionService.extractPositionsForNewResults()` ✅ **Uses consolidated if enabled**
   - `brandSentimentService.scoreBrandSentiment()` ⚠️ **Partially uses consolidated**
   - `competitorSentimentService.scoreCompetitorSentiment()` ⚠️ **NOT using consolidated yet**
   - `citationExtractionService.extractAndStoreCitations()` ✅ **Uses consolidated if enabled**

### Trigger Points

**Automatic triggers** when collector results are stored:
1. `data-collection.service.ts` (line 1251) - After storing collector result
2. `brightdata/polling.service.ts` (line 424) - After BrightData polling completes
3. `brand.service.ts` (line 824) - After brand creation

**Scheduled triggers**:
1. `scoringWorker.ts` - Cron job runs scoring periodically
2. `unified-job-worker.ts` - Unified job system

---

## Sentiment Scoring Status

### ✅ Collector Sentiment Service
**File**: `backend/src/services/scoring/sentiment/collector-sentiment.service.ts`

**Status**: ✅ **INTEGRATED**
- Checks consolidated cache (line 158-177)
- Uses consolidated sentiment if available
- Falls back to individual analysis if not cached

**How it works**:
```typescript
if (USE_CONSOLIDATED_ANALYSIS) {
  const cached = consolidatedAnalysisService.cache.get(row.id);
  if (cached?.sentiment?.brand) {
    // Use consolidated sentiment
  } else {
    // Fall back to individual analysis
  }
}
```

### ✅ Brand Sentiment Service
**File**: `backend/src/services/scoring/sentiment/brand-sentiment.service.ts`

**Status**: ✅ **INTEGRATED** (Just completed)
- Checks consolidated cache (line 116-140)
- Uses consolidated sentiment if available
- Falls back to individual analysis if not cached

**How it works**:
```typescript
if (USE_CONSOLIDATED_ANALYSIS) {
  const cached = consolidatedAnalysisService.cache.get(collectorResultId);
  if (cached?.sentiment?.brand) {
    // Use consolidated sentiment
  } else {
    // Fall back to individual analysis
  }
}
```

### ✅ Competitor Sentiment Service
**File**: `backend/src/services/scoring/sentiment/competitor-sentiment.service.ts`

**Status**: ✅ **INTEGRATED** (Just completed)
- Checks consolidated cache (line 124-150)
- Uses consolidated sentiment if available
- Falls back to individual analysis if not cached

**How it works**:
```typescript
if (USE_CONSOLIDATED_ANALYSIS) {
  const cached = consolidatedAnalysisService.cache.get(collectorResultId);
  if (cached?.sentiment?.competitors) {
    // Use consolidated sentiment for all competitors
  } else {
    // Fall back to individual analysis
  }
}
```

---

## What's Consolidated vs Not

### ✅ Fully Consolidated (When Enabled)
1. **Position Extraction** (`position-extraction.service.ts`)
   - ✅ Brand product extraction
   - ✅ Competitor product extraction
   - ✅ Uses consolidated service when `USE_CONSOLIDATED_ANALYSIS=true`

2. **Citation Extraction** (`citation-extraction.service.ts`)
   - ✅ Citation categorization
   - ✅ Uses consolidated cache when available

3. **Collector Sentiment** (`collector-sentiment.service.ts`)
   - ✅ Brand sentiment (from consolidated cache)
   - ✅ Uses consolidated cache when available

### ✅ Fully Consolidated (When Enabled)
4. **Brand Sentiment** (`brand-sentiment.service.ts`)
   - ✅ Uses consolidated cache when available
   - ✅ Falls back to individual analysis if not cached
   - ✅ Fully integrated

5. **Competitor Sentiment** (`competitor-sentiment.service.ts`)
   - ✅ Uses consolidated cache when available
   - ✅ Falls back to individual analysis if not cached
   - ✅ Fully integrated

---

## How to Enable

### Step 1: Set Environment Variable
```bash
export USE_CONSOLIDATED_ANALYSIS=true
```

Or add to `.env`:
```bash
USE_CONSOLIDATED_ANALYSIS=true
```

### Step 2: Restart Services
Restart your backend services for the change to take effect.

### Step 3: Verify
Check logs for:
```
🔄 Using consolidated analysis service for collector_result 12345
```

---

## Current Behavior (When Enabled)

### Position Extraction
- ✅ Uses consolidated service
- ✅ Extracts brand + competitor products
- ✅ Falls back to individual extraction if consolidated fails

### Citation Extraction
- ✅ Checks consolidated cache first
- ✅ Uses citation categories from consolidated result
- ✅ Falls back to individual categorization if not cached

### Collector Sentiment
- ✅ Checks consolidated cache first
- ✅ Uses sentiment from consolidated result
- ✅ Falls back to individual analysis if not cached

### Brand Sentiment (CONSOLIDATED)
- ✅ Checks consolidated cache first
- ✅ Uses sentiment from consolidated result
- ✅ Falls back to individual analysis if not cached

### Competitor Sentiment (CONSOLIDATED)
- ✅ Checks consolidated cache first
- ✅ Uses sentiment from consolidated result (all competitors at once)
- ✅ Falls back to individual analysis if not cached

---

## Integration Status

### ✅ All Services Integrated

All scoring services are now integrated with the consolidated analysis service:

1. ✅ **Position Extraction** - Uses consolidated for products
2. ✅ **Citation Extraction** - Uses consolidated for categorization
3. ✅ **Collector Sentiment** - Uses consolidated cache
4. ✅ **Brand Sentiment** - Uses consolidated cache (just completed)
5. ✅ **Competitor Sentiment** - Uses consolidated cache (just completed)

**Integration Complete**: 100% ✅

---

## Recommended Next Steps

### ✅ Integration Complete!

All services are now integrated. Next steps:

### Option 1: Enable in Production (Recommended)
1. Set `USE_CONSOLIDATED_ANALYSIS=true` in production environment
2. Monitor results and costs
3. Verify all services are using consolidated cache

### Option 2: Gradual Rollout
1. Enable for testing with `USE_CONSOLIDATED_ANALYSIS=true`
2. Monitor results and costs for 1-2 weeks
3. Compare accuracy with individual operations
4. Enable by default if results are good

---

## Summary

| Service | Consolidated? | Status |
|---------|--------------|--------|
| Position Extraction | ✅ Yes | Fully integrated |
| Citation Extraction | ✅ Yes | Fully integrated |
| Collector Sentiment | ✅ Yes | Fully integrated |
| Brand Sentiment | ✅ Yes | Fully integrated |
| Competitor Sentiment | ✅ Yes | Fully integrated |

**Overall**: **100% consolidated** (5 out of 5 services) ✅

**To Enable**: Set `USE_CONSOLIDATED_ANALYSIS=true`

**Automatic Trigger**: ✅ Yes, when collector results are stored (via `brandScoringService.scoreBrandAsync()`)
