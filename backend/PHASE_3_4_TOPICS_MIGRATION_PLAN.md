# Phase 3.4: Brand Topics Service Migration Plan

**Status:** 🚧 In Progress  
**Priority:** 🔴 URGENT - Topics page shows NO new data after collection  
**Complexity:** HIGH  
**Estimated Time:** 2-3 days

---

## 📋 CURRENT IMPLEMENTATION ANALYSIS

### Service: `brand.service.ts` → `getBrandTopicsWithAnalytics()`

**What it does:**
1. Fetches distinct collector types (models) → **Uses `extracted_positions`**
2. Fetches brand positions with filtering → **Uses `extracted_positions`**
3. Groups positions by topic (from metadata or query)
4. Calculates aggregated metrics per topic (SOA, sentiment, visibility)
5. Fetches competitor averages per topic → **Uses `extracted_positions`**
6. Returns topics with analytics + available models

**Key Queries (3 places using extracted_positions):**

```sql
-- Query 1: Get available models
SELECT DISTINCT collector_type 
FROM extracted_positions
WHERE brand_id = ? AND processed_at BETWEEN ? AND ?

-- Query 2: Get brand positions
SELECT share_of_answers_brand, sentiment_score, visibility_index, 
       has_brand_presence, processed_at, collector_result_id, 
       topic, metadata, collector_type
FROM extracted_positions  
WHERE brand_id = ? AND processed_at BETWEEN ? AND ?
  [AND collector_type IN (...)]  -- optional filter
  [AND collector_result_id IN (...)]  -- optional filter
  
-- Query 3: Get competitor positions for averages
SELECT share_of_answers_competitor
FROM extracted_positions
WHERE brand_id IN (all_brands) AND processed_at BETWEEN ? AND ?
  AND competitor_name IS NOT NULL
```

---

## 🎯 MIGRATION STRATEGY

### Approach: Feature Flag with Optimized Queries

```typescript
const USE_OPTIMIZED_TOPICS_QUERY = process.env.USE_OPTIMIZED_TOPICS_QUERY === 'true';

if (USE_OPTIMIZED_TOPICS_QUERY) {
  // NEW: Query metric_facts + brand_metrics + brand_sentiment
} else {
  // LEGACY: Query extracted_positions
}
```

---

## 🔨 IMPLEMENTATION STEPS

### Step 1: Create Helper Method for Available Models ✅

**Method:** `optimizedMetricsHelper.fetchDistinctCollectorTypes()`

**Query:**
```typescript
.from('metric_facts')
.select('collector_type')
.eq('brand_id', brandId)
.gte('processed_at', startDate)
.lte('processed_at', endDate)
.not('collector_type', 'is', null)
```

**Returns:** `Set<string>` of collector types

---

### Step 2: Create Helper Method for Topic Positions ✅

**Method:** `optimizedMetricsHelper.fetchTopicPositions()`

**Query:**
```typescript
.from('metric_facts')
.select(`
  collector_result_id,
  collector_type,
  topic,
  processed_at,
  brand_metrics!inner(
    share_of_answers,
    visibility_index,
    has_brand_presence
  ),
  brand_sentiment(
    sentiment_score
  )
`)
.eq('brand_id', brandId)
.gte('processed_at', startDate)
.lte('processed_at', endDate)
[.in('collector_type', collectorTypes)]  -- optional
[.in('collector_result_id', collectorResultIds)]  -- optional
```

**Returns:** Array of positions with:
- collector_result_id
- collector_type
- topic
- processed_at
- share_of_answers_brand (from brand_metrics)
- visibility_index (from brand_metrics)
- has_brand_presence (from brand_metrics)
- sentiment_score (from brand_sentiment)

---

### Step 3: Create Helper Method for Competitor Averages ✅

**Method:** `optimizedMetricsHelper.fetchCompetitorAveragesByTopic()`

**Query:**
```typescript
.from('metric_facts')
.select(`
  topic,
  competitor_metrics!inner(
    share_of_answers
  )
`)
.in('brand_id', brandIds)  -- all brands for competitor comparison
.gte('processed_at', startDate)
.lte('processed_at', endDate)
.not('competitor_metrics.share_of_answers', 'is', null)
```

**Returns:** Map<topic, average_competitor_soa>

---

### Step 4: Migrate Main Service ✅

**File:** `backend/src/services/brand.service.ts`

**Changes:**
1. Add feature flag check at the start
2. Replace Query 1 (available models) with optimized helper
3. Replace Query 2 (positions) with optimized helper  
4. Keep topic grouping logic (works with both schemas)
5. Replace Query 3 (competitor averages) with optimized helper
6. Add performance logging

**Pseudo-code:**
```typescript
async getBrandTopicsWithAnalytics(...) {
  const USE_OPTIMIZED = process.env.USE_OPTIMIZED_TOPICS_QUERY === 'true';
  
  // Step 1: Get available models
  let availableModels: Set<string>;
  if (USE_OPTIMIZED) {
    availableModels = await optimizedHelper.fetchDistinctCollectorTypes(...);
  } else {
    // Legacy query to extracted_positions
  }
  
  // Step 2: Get positions
  let positions: any[];
  if (USE_OPTIMIZED) {
    const result = await optimizedHelper.fetchTopicPositions(...);
    positions = result.data.map(row => ({
      share_of_answers_brand: row.brand_metrics?.share_of_answers,
      sentiment_score: row.brand_sentiment?.sentiment_score,
      visibility_index: row.brand_metrics?.visibility_index,
      has_brand_presence: row.brand_metrics?.has_brand_presence,
      processed_at: row.processed_at,
      collector_result_id: row.collector_result_id,
      topic: row.topic,
      collector_type: row.collector_type,
    }));
  } else {
    // Legacy query to extracted_positions
  }
  
  // Step 3: Group by topic (same logic for both)
  const topicMap = new Map();
  // ... existing grouping logic ...
  
  // Step 4: Get competitor averages
  if (USE_OPTIMIZED) {
    competitorAvgs = await optimizedHelper.fetchCompetitorAveragesByTopic(...);
  } else {
    // Legacy query to extracted_positions
  }
  
  return { topics, availableModels };
}
```

---

### Step 5: Add Feature Flag ✅

**File:** `backend/.env`

```bash
USE_OPTIMIZED_TOPICS_QUERY=true
```

---

### Step 6: Update Feature Flags Documentation ✅

**File:** `backend/FEATURE_FLAGS.md`

Add `USE_OPTIMIZED_TOPICS_QUERY` with description and rollout plan.

---

### Step 7: Testing ✅

**Test with Bose brand** (has fresh data in new schema):

1. Enable flag: `USE_OPTIMIZED_TOPICS_QUERY=true`
2. Restart backend
3. Navigate to Topics page: `/brands/af7ab809-862c-4b5c-9485-89ebccd9846d/topics`
4. Verify:
   - Topics appear with correct names
   - SOA, visibility, sentiment values match database
   - Available models dropdown works
   - Competitor averages calculated correctly
   - Performance is good (<3s)

---

## 📊 SUCCESS CRITERIA

- [ ] New data from Bose collection appears on Topics page
- [ ] All topics display with correct metrics (SOA, visibility, sentiment)
- [ ] Available models filter works correctly
- [ ] Competitor averages display correctly
- [ ] Performance < 3 seconds for typical query
- [ ] No errors in backend logs
- [ ] Legacy fallback works when flag is OFF

---

## 🚨 RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Complex query logic | HIGH | Test thoroughly with multiple brands |
| Performance degradation | MEDIUM | Add indexes, optimize joins |
| Missing data for old brands | LOW | Feature flag allows instant rollback |
| Topic extraction differences | MEDIUM | Preserve exact logic from legacy |

---

## 📈 EXPECTED IMPACT

- ✅ Topics page shows NEW data immediately after collection
- ✅ Eliminates user confusion ("where's my data?")
- ✅ Improves query performance (normalized schema)
- ✅ Moves closer to removing `extracted_positions` table

---

## 🔄 ROLLOUT PLAN

1. **Day 1:** Implement helper methods + migrate service
2. **Day 2:** Test with Bose brand, fix any issues
3. **Day 3:** Enable flag in production, monitor
4. **Week 1:** Verify with multiple brands, monitor performance
5. **Week 2:** If stable, remove legacy fallback code

---

## 📝 NOTES

- Keep exact same topic grouping logic (don't break existing behavior)
- Preserve all collector_type filtering logic
- Match exact output format for UI compatibility
- Add comprehensive logging for debugging

