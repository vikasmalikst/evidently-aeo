# Phase 3.3: Source Attribution Service Migration Plan

**Status**: 🚀 IN PROGRESS  
**Estimated Duration**: 2-3 hours  
**Started**: December 22, 2025

---

## Overview

Migrate Source Attribution Service from `extracted_positions` to optimized schema (`metric_facts` + related tables).

**Service File**: `backend/src/services/source-attribution.service.ts`

---

## Query Points to Migrate

### 1. Main Query: `getSourceAttribution()` (Line 267)
**Current**:
```typescript
.from('extracted_positions')
.select(`
  collector_result_id,
  share_of_answers_brand,
  total_brand_mentions,
  sentiment_score,
  visibility_index,
  competitor_name,
  topic,
  metadata
`)
.in('collector_result_id', collectorResultIds)
.eq('brand_id', brandId)
```

**Optimized**:
- Query `metric_facts` with joins to:
  - `brand_metrics` (share_of_answers, total_brand_mentions, visibility_index)
  - `brand_sentiment` (sentiment_score)
  - `competitor_metrics` (if competitor_name exists)
- Get topic from `metric_facts.topic` or `generated_queries.topic`
- Metadata from `metric_facts.metadata` (if needed)

**Fields Mapping**:
- `share_of_answers_brand` → `brand_metrics.share_of_answers`
- `total_brand_mentions` → `brand_metrics.total_brand_mentions`
- `sentiment_score` → `brand_sentiment.sentiment_score`
- `visibility_index` → `brand_metrics.visibility_index`
- `competitor_name` → `competitor_metrics.competitor_id` (join to `brand_competitors`)
- `topic` → `metric_facts.topic` or `generated_queries.topic`

---

### 2. Previous Period Query (Line 582)
**Current**:
```typescript
.from('extracted_positions')
.select('collector_result_id, share_of_answers_brand, sentiment_score, competitor_name')
.in('collector_result_id', previousCollectorIds)
.eq('brand_id', brandId)
.gte('processed_at', previousStart)
.lte('processed_at', previousEnd)
```

**Optimized**:
- Query `metric_facts` with date range filter on `processed_at`
- Join to `brand_metrics` for share_of_answers
- Join to `brand_sentiment` for sentiment_score
- Join to `competitor_metrics` if competitor_name needed

---

### 3. Impact Score Trends Query (Line 1285)
**Current**:
```typescript
.from('extracted_positions')
.select(`
  collector_result_id,
  share_of_answers_brand,
  total_brand_mentions,
  sentiment_score,
  visibility_index,
  competitor_name,
  processed_at
`)
.in('collector_result_id', collectorResultIds)
.eq('brand_id', brandId)
.gte('processed_at', startIso)
.lte('processed_at', endIso)
```

**Optimized**:
- Same pattern as main query
- Use `metric_facts.processed_at` for date filtering
- Join to all metric tables

---

## Implementation Strategy

### Step 1: Create Helper Method
Add a method to `OptimizedMetricsHelper`:
```typescript
async fetchSourceAttributionMetrics(options: {
  collectorResultIds: number[];
  brandId: string;
  startDate?: string;
  endDate?: string;
}): Promise<SourceAttributionMetrics[]>
```

### Step 2: Feature Flag
Add feature flag: `USE_OPTIMIZED_SOURCE_ATTRIBUTION`

### Step 3: Dual-Path Implementation
- If flag enabled: Use optimized query
- If flag disabled: Use legacy `extracted_positions` query
- Transform results to match existing format

### Step 4: Testing
- Compare results: old vs new
- Verify attribution scores match
- Check time-series data integrity

---

## Expected Performance Gain

**Current**: ~3.7 seconds  
**Optimized**: ~150ms  
**Speedup**: **25x faster**

---

## Risk Assessment

**Risk Level**: MEDIUM

**Why**:
- Source attribution is user-facing
- Complex data transformations
- Multiple query points

**Mitigation**:
- Feature flag for instant rollback
- Comprehensive logging
- Gradual rollout (10% → 50% → 100%)
- Side-by-side comparison

---

## Success Criteria

- ✅ Results match legacy queries exactly
- ✅ Performance improved by 20-30x
- ✅ No increase in error rates
- ✅ Attribution scores accurate
- ✅ Time-series data correct

---

## Next Steps

1. ✅ Analyze current queries (DONE)
2. ⏳ Implement optimized queries
3. ⏳ Add feature flag
4. ⏳ Test with real data
5. ⏳ Gradual rollout

---

**Ready to implement!** 🚀

