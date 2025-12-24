# Phase 3.6: Recommendation Services Migration Plan

**Status:** 🚧 In Progress  
**Priority:** 🔴 HIGH IMPACT  
**Complexity:** MEDIUM-HIGH  
**Estimated Time:** 1-2 hours (fast-tracked)

---

## 📋 SERVICES IDENTIFIED

### 1. `recommendation.service.ts` (v1)
**Usage:** 5 query points using `extracted_positions`

### 2. `recommendation-v3.service.ts` (v3)
**Usage:** 4 query points using `extracted_positions`

---

## 🎯 QUERY PATTERNS IDENTIFIED

Both services use similar patterns:

### Pattern 1: Overall Brand Metrics (Current Period)
```typescript
.from('extracted_positions')
.select('visibility_index, share_of_answers_brand, sentiment_score')
.eq('brand_id', brandId)
.gte('created_at', startDate)
.lte('created_at', endDate)
```
→ **New:** `brand_metrics` + `brand_sentiment`

### Pattern 2: Overall Brand Metrics (Previous Period)
Same as Pattern 1, but with previous date range
→ **New:** Same helper, different dates

### Pattern 3: Competitor Metrics
```typescript
.from('extracted_positions')
.select('visibility_index, share_of_answers_brand, sentiment_score')
.eq('competitor_id', competitorId)
.gte('created_at', startDate)
.lte('created_at', endDate)
```
→ **New:** `competitor_metrics` + `competitor_sentiment`

### Pattern 4: Metrics by Collector Result ID
```typescript
.from('extracted_positions')
.select('collector_result_id, visibility_index, share_of_answers_brand, sentiment_score')
.eq('brand_id', brandId)
.in('collector_result_id', resultIds)
```
→ **New:** `brand_metrics` filtered by `collector_result_id`

### Pattern 5: LLM-specific Metrics (v1 only)
```typescript
.from('extracted_positions')
.select('visibility_index, share_of_answers_brand, sentiment_score')
.eq('brand_id', brandId)
.in('collector_result_id', llmResultIds)
```
→ **New:** Same as Pattern 4

---

## 🔨 IMPLEMENTATION STRATEGY

### Option 1: Use Existing Helpers ✅
We already have:
- `fetchBrandMetrics()` - for brand metrics
- `fetchCompetitorMetrics()` - for competitor metrics
- `fetchBrandMetricsByDateRange()` - for date-range queries

These can handle most patterns!

### Option 2: Create New Helper (if needed)
If existing helpers don't cover all cases, create:
- `fetchRecommendationMetrics()` - specialized for recommendations

**Decision:** Use existing helpers (Option 1) - they cover all patterns!

---

## 🚀 MIGRATION STEPS

### Step 1: Migrate `recommendation.service.ts` (v1)

**Query Point 1: Overall Brand Metrics (Current)**
- Replace with: `fetchBrandMetricsByDateRange()`
- Filter: `brand_id`, date range

**Query Point 2: Overall Brand Metrics (Previous)**
- Replace with: `fetchBrandMetricsByDateRange()`
- Filter: `brand_id`, previous date range

**Query Point 3: Competitor Metrics**
- Replace with: `fetchCompetitorMetrics()`
- Filter: `competitor_id` via `brand_competitors` join

**Query Point 4: LLM-specific Metrics**
- Replace with: `fetchBrandMetrics()`
- Filter: `brand_id`, `collector_result_id.in(llmResultIds)`

**Query Point 5: Source-specific Metrics**
- Replace with: `fetchBrandMetrics()`
- Filter: `brand_id`, `collector_result_id.in(sourceResultIds)`

### Step 2: Migrate `recommendation-v3.service.ts` (v3)

**Query Point 1: Overall Brand Metrics (Current)**
- Same as v1 Query Point 1

**Query Point 2: Overall Brand Metrics (Previous)**
- Same as v1 Query Point 2

**Query Point 3: Competitor Metrics**
- Same as v1 Query Point 3

**Query Point 4: Batched Position Metrics**
- Replace with: `fetchBrandMetrics()` in batches
- Filter: `brand_id`, `collector_result_id.in(batch)`

### Step 3: Add Feature Flags

**v1:** `USE_OPTIMIZED_RECOMMENDATIONS_V1`
**v3:** `USE_OPTIMIZED_RECOMMENDATIONS_V3`

### Step 4: Update Documentation

Update `FEATURE_FLAGS.md` with new flags

---

## 📊 EXPECTED BENEFITS

- ✅ Recommendations based on **latest data** (new schema)
- ✅ More accurate AI insights
- ✅ Better performance with normalized schema
- ✅ Eliminates dependency on `extracted_positions`

---

## 🚨 RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Algorithm changes | HIGH | Test recommendations before/after |
| Missing data | MEDIUM | Feature flag for instant rollback |
| Performance issues | LOW | Existing helpers are optimized |

---

## ✅ SUCCESS CRITERIA

- [ ] Both v1 and v3 services migrated
- [ ] Feature flags added
- [ ] No breaking changes to recommendation output
- [ ] Performance same or better
- [ ] All tests pass
- [ ] Documentation updated

---

## 📝 NOTES

- Keep exact same logic and calculations
- Transform data to match legacy format
- Preserve all filtering and aggregation
- Add comprehensive logging

