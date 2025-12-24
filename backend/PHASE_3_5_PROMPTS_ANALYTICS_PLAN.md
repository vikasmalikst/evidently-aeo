# Phase 3.5: Prompts Analytics Service Migration Plan

**Status:** 🚧 Starting  
**Priority:** 🔴 URGENT - HIGH IMPACT  
**Complexity:** HIGH  
**Estimated Time:** 2-3 days

---

## 📋 CURRENT IMPLEMENTATION ANALYSIS

### Service: `prompts-analytics.service.ts` → `getPromptAnalytics()`

**What it does:**
1. Fetches collector results (prompts/responses)
2. Fetches visibility, sentiment, and mention counts from `extracted_positions`
3. Groups by query_id or collector_result_id
4. Calculates aggregated metrics per prompt
5. Returns prompts with analytics (visibility, sentiment, mentions, highlights)

**Key Query (Line ~734):**

```typescript
let visibilityQuery = supabaseAdmin
  .from('extracted_positions')
  .select(`
    query_id,
    collector_result_id,
    collector_type,
    visibility_index,
    competitor_name,
    sentiment_score,
    total_brand_mentions,
    total_brand_product_mentions,
    competitor_mentions
  `)
  .eq('brand_id', brandRow.id)
  .eq('customer_id', customerId)
  .gte('processed_at', startDate)
  .lte('processed_at', endDate)
  [.or('query_id.in.(...),collector_result_id.in.(...)')]  // optional filter
```

**What it extracts:**
1. **Visibility Index** → `brand_metrics.visibility_index`
2. **Sentiment Score** → `brand_sentiment.sentiment_score`
3. **Brand Mentions** → `brand_metrics.total_brand_mentions` (if exists) or calculate
4. **Product Mentions** → `brand_metrics.total_brand_product_mentions` (if exists)
5. **Competitor Mentions** → `competitor_metrics` count or `competitor_mentions` (if exists)
6. **Competitor Names** → `brand_competitors.competitor_name` via `competitor_metrics`

---

## 🎯 MIGRATION STRATEGY

### Approach: Feature Flag with Optimized Queries

```typescript
const USE_OPTIMIZED_PROMPTS_ANALYTICS = process.env.USE_OPTIMIZED_PROMPTS_ANALYTICS === 'true';

if (USE_OPTIMIZED_PROMPTS_ANALYTICS) {
  // NEW: Query metric_facts + brand_metrics + brand_sentiment + competitor_metrics
} else {
  // LEGACY: Query extracted_positions
}
```

---

## 🔨 IMPLEMENTATION STEPS

### Step 1: Create Helper Method for Prompts Analytics ✅

**Method:** `optimizedMetricsHelper.fetchPromptsAnalytics()`

**Query:**
```typescript
.from('metric_facts')
.select(`
  query_id,
  collector_result_id,
  collector_type,
  processed_at,
  brand_metrics!inner(
    visibility_index,
    total_brand_mentions,
    total_brand_product_mentions
  ),
  brand_sentiment(
    sentiment_score
  ),
  competitor_metrics(
    competitor_id,
    brand_competitors!inner(
      competitor_name
    )
  )
`)
.eq('brand_id', brandId)
.eq('customer_id', customerId)
.gte('processed_at', startDate)
.lte('processed_at', endDate)
[.in('query_id', queryIds)]  // optional
[.in('collector_result_id', collectorResultIds)]  // optional
```

**Returns:** Array of rows with:
- query_id
- collector_result_id
- collector_type
- visibility_index (from brand_metrics)
- sentiment_score (from brand_sentiment)
- total_brand_mentions (from brand_metrics)
- total_brand_product_mentions (from brand_metrics)
- competitor_names (from competitor_metrics → brand_competitors)
- competitor_count (count of competitor_metrics)

---

### Step 2: Migrate Main Service ✅

**File:** `backend/src/services/prompts-analytics.service.ts`

**Changes:**
1. Add feature flag check at the start
2. Replace `extracted_positions` query (line ~734) with optimized helper
3. Transform data to match legacy format
4. Keep all aggregation logic (works with both schemas)
5. Add performance logging

**Pseudo-code:**
```typescript
async getPromptAnalytics(...) {
  const USE_OPTIMIZED = process.env.USE_OPTIMIZED_PROMPTS_ANALYTICS === 'true';
  
  // ... existing collector_results query ...
  
  // Step: Get visibility, sentiment, mentions
  if (USE_OPTIMIZED) {
    const result = await optimizedMetricsHelper.fetchPromptsAnalytics({
      brandId,
      customerId,
      startDate: normalizedRange.startIsoBound,
      endDate: normalizedRange.endIsoBound,
      queryIds: allQueryIds.length > 0 ? allQueryIds : undefined,
      collectorResultIds: allCollectorResultIds.length > 0 ? allCollectorResultIds : undefined,
    });
    
    // Transform to match legacy format
    result.data.forEach(row => {
      const queryId = row.query_id;
      const collectorResultId = row.collector_result_id;
      
      // Process visibility
      if (row.brand_metrics?.visibility_index) {
        const keyByQuery = queryId ? queryId : null;
        const keyByCollector = collectorResultId ? `collector:${collectorResultId}` : null;
        // ... add to visibilityMap ...
      }
      
      // Process sentiment
      if (row.brand_sentiment?.sentiment_score) {
        // ... add to sentimentByCollectorResult ...
      }
      
      // Process mentions
      if (row.brand_metrics?.total_brand_mentions) {
        // ... add to mentionCountsByCollector/Query ...
      }
      
      // Process competitors
      if (row.competitor_metrics) {
        row.competitor_metrics.forEach(cm => {
          const competitorName = cm.brand_competitors?.competitor_name;
          // ... add to highlights.competitors ...
        });
      }
    });
  } else {
    // Legacy query to extracted_positions
  }
  
  // ... rest of aggregation logic (same for both) ...
}
```

---

### Step 3: Handle Edge Cases ✅

**Mention Counts:**
- If `total_brand_mentions` doesn't exist in `brand_metrics`, calculate from data
- If `total_brand_product_mentions` doesn't exist, calculate from data
- If `competitor_mentions` doesn't exist, count `competitor_metrics` rows

**Competitor Names:**
- Extract from `competitor_metrics` → `brand_competitors.competitor_name`
- Group by query_id or collector_result_id

**Visibility Normalization:**
- Keep same logic (0-1 scale → 0-100 scale)
- Average calculation remains the same

---

### Step 4: Add Feature Flag ✅

**File:** `backend/.env`

```bash
USE_OPTIMIZED_PROMPTS_ANALYTICS=true
```

---

### Step 5: Update Feature Flags Documentation ✅

**File:** `backend/FEATURE_FLAGS.md`

Add `USE_OPTIMIZED_PROMPTS_ANALYTICS` with description and rollout plan.

---

### Step 6: Testing ✅

**Test with brand that has fresh data:**

1. Enable flag: `USE_OPTIMIZED_PROMPTS_ANALYTICS=true`
2. Restart backend
3. Navigate to Prompts Analytics page
4. Verify:
   - Prompts appear with correct responses
   - Visibility scores display correctly
   - Sentiment scores display correctly
   - Mention counts (brand, product, competitor) are accurate
   - Competitor highlights appear
   - Performance is good (<3s)

---

## 📊 SUCCESS CRITERIA

- [ ] New data from collection appears on Prompts Analytics page
- [ ] All prompts display with correct metrics (visibility, sentiment, mentions)
- [ ] Competitor highlights display correctly
- [ ] Performance < 3 seconds for typical query
- [ ] No errors in backend logs
- [ ] Legacy fallback works when flag is OFF

---

## 🚨 RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Complex aggregation logic | HIGH | Preserve exact logic from legacy |
| Missing mention counts | MEDIUM | Calculate if not in database |
| Performance degradation | MEDIUM | Add indexes, optimize joins |
| Missing data for old brands | LOW | Feature flag allows instant rollback |
| Competitor name extraction | MEDIUM | Test thoroughly with multiple brands |

---

## 📈 EXPECTED IMPACT

- ✅ Prompts Analytics page shows NEW data immediately after collection
- ✅ Eliminates user confusion ("where's my data?")
- ✅ Improves query performance (normalized schema)
- ✅ Moves closer to removing `extracted_positions` table

---

## 🔄 ROLLOUT PLAN

1. **Day 1:** Implement helper method + migrate service
2. **Day 2:** Test with multiple brands, fix any issues
3. **Day 3:** Enable flag in production, monitor
4. **Week 1:** Verify with multiple brands, monitor performance
5. **Week 2:** If stable, remove legacy fallback code

---

## 📝 NOTES

- Keep exact same aggregation logic (don't break existing behavior)
- Preserve all filtering logic (query_id, collector_result_id)
- Match exact output format for UI compatibility
- Add comprehensive logging for debugging
- Handle null/undefined values gracefully

