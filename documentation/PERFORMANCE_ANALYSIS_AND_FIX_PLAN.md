# Performance Analysis & Fix Plan: Topics, Prompts, and Citations Pages

## Executive Summary

After splitting `extracted_positions` into separate tables (`metric_facts`, `brand_metrics`, `competitor_metrics`, `brand_sentiment`, `competitor_sentiment`), three pages are experiencing severe performance degradation:

- **Topics Page** (`/brands/:id/topics`)
- **Prompts Page** (`/brands/:id/prompts`)  
- **Citations/SearchSources Page** (`/brands/:id/sources`)

**Current State**: Pages take 10-30+ seconds to load (vs. previous 300ms-3s target)

**Root Causes Identified**:
1. Materialized view `extracted_positions_compat` not being refreshed automatically
2. Multiple JOINs across 5 tables without optimal indexes
3. Feature flags causing inconsistent query paths
4. No backend response caching
5. Missing composite indexes for common filter patterns

---

## Root Cause Analysis

### 1. Materialized View Not Refreshed ⚠️ **CRITICAL**

**Problem**: 
- `extracted_positions_compat` is a materialized view that needs manual refresh
- No automatic refresh after data collection/scoring
- Services querying stale or empty data

**Evidence**:
- Migration creates view but only refreshes once: `REFRESH MATERIALIZED VIEW public.extracted_positions_compat;`
- No refresh calls found in codebase after scoring/data collection
- View becomes stale immediately after new data is written

**Impact**: 
- Services may query empty/stale view
- Or fall back to slow direct queries on new schema (multiple JOINs)

**Location**: 
- View: `supabase/migrations/20250202000001_create_extracted_positions_compat_view.sql`
- Refresh script: `supabase/migrations/refresh_extracted_positions_compat.sql` (manual only)

---

### 2. Multiple JOINs Without Optimal Indexes ⚠️ **HIGH PRIORITY**

**Problem**:
When using new schema directly (via feature flags), queries require:
```
metric_facts 
  → JOIN brand_metrics (1:1)
  → JOIN brand_sentiment (1:1) 
  → JOIN competitor_metrics (1:N)
  → JOIN competitor_sentiment (1:N)
  → JOIN brand_competitors (for competitor names)
  → JOIN collector_results (for brand name)
```

**Current Indexes** (from migration):
- ✅ `idx_metric_facts_brand_customer_processed` on `(brand_id, customer_id, processed_at DESC)`
- ✅ `idx_brand_metrics_fact` on `(metric_fact_id)`
- ✅ `idx_competitor_metrics_fact_comp` on `(metric_fact_id, competitor_id)`
- ❌ **Missing**: Composite indexes for common filter patterns:
  - `(brand_id, customer_id, collector_type, processed_at)` - for Topics/Prompts filtering
  - `(brand_id, customer_id, topic, processed_at)` - for topic-based queries
  - `(collector_result_id, brand_id)` - for source attribution lookups

**Impact**:
- Sequential scans on large tables
- Slow JOIN operations
- Query planner may choose suboptimal plans

**Location**:
- Service: `backend/src/services/query-helpers/optimized-metrics.helper.ts`
- Topics: `backend/src/services/brand.service.ts` (lines 1512-1820)
- Prompts: `backend/src/services/prompts-analytics.service.ts` (lines 294-1222)
- Sources: `backend/src/services/source-attribution.service.ts` (lines 269-330)

---

### 3. Feature Flag Inconsistency ⚠️ **MEDIUM PRIORITY**

**Problem**:
Services use different feature flags to switch between old/new schema:
- Topics: `USE_OPTIMIZED_TOPICS_QUERY` (default: false)
- Sources: `USE_OPTIMIZED_SOURCE_ATTRIBUTION` (default: false)
- Prompts: No feature flag (always queries `collector_results` directly)

**Current State**:
- **Topics**: Falls back to `extracted_positions` (legacy) if flag is false
- **Sources**: Falls back to `extracted_positions` (legacy) if flag is false  
- **Prompts**: Always queries `collector_results` + joins to get metrics

**Impact**:
- Inconsistent performance across pages
- If `extracted_positions` is deprecated/empty, queries fail or return no data
- If flags enabled but view not refreshed, queries are slow (multiple JOINs)

**Location**:
- Topics: `backend/src/services/brand.service.ts:1509`
- Sources: `backend/src/services/source-attribution.service.ts:269`
- Prompts: Always uses `collector_results` (no flag)

---

### 4. No Backend Response Caching ⚠️ **MEDIUM PRIORITY**

**Problem**:
- Every page load triggers full database queries
- No Redis/memory cache for API responses
- Frontend cache (`useCachedData`) helps but backend still queries DB every time

**Impact**:
- Repeated identical queries hit database
- No benefit from query result reuse
- Database load increases with concurrent users

**Location**:
- All API routes: `backend/src/routes/brand.routes.ts`
- Services: `brand.service.ts`, `prompts-analytics.service.ts`, `source-attribution.service.ts`

---

### 5. Missing Composite Indexes for Filter Patterns ⚠️ **HIGH PRIORITY**

**Problem**:
Common query patterns filter by:
- `brand_id + customer_id + collector_type + processed_at` (Topics, Prompts)
- `brand_id + customer_id + topic + processed_at` (Topics aggregation)
- `collector_result_id + brand_id` (Source attribution)

**Current Indexes**:
- ✅ `idx_metric_facts_brand_customer_processed` on `(brand_id, customer_id, processed_at DESC)`
- ❌ Missing `collector_type` in composite
- ❌ Missing `topic` in composite
- ❌ Missing `collector_result_id` index on `metric_facts`

**Impact**:
- Index scans followed by filter operations
- Slower queries for filtered results

---

## Performance Fix Plan

### Phase 1: Immediate Fixes (Critical - 2-4 hours)

#### 1.1 Add Automatic Materialized View Refresh ✅

**Action**: Add refresh call after scoring/data collection completes

**Files to Modify**:
- `backend/src/services/jobs/data-collection-job.service.ts` - After data collection
- `backend/src/services/scoring/brand-scoring.orchestrator.ts` - After scoring
- `backend/src/cron/unified-job-worker.ts` - After job completion

**Implementation**:
```typescript
// After scoring/data collection completes
await supabaseAdmin.rpc('refresh_extracted_positions_compat');
// Or direct SQL:
await supabaseAdmin.from('_refresh_mv').select('*').eq('name', 'extracted_positions_compat');
```

**Expected Impact**: 
- View always has latest data
- Services using view get fresh data instantly
- **Target**: 50-80% reduction in query time for view-based queries

---

#### 1.2 Add Missing Composite Indexes ✅

**Action**: Create migration with composite indexes for common filter patterns

**New Indexes Needed**:
```sql
-- For Topics/Prompts filtering by collector_type
CREATE INDEX IF NOT EXISTS idx_metric_facts_brand_customer_collector_date 
  ON public.metric_facts(brand_id, customer_id, collector_type, processed_at DESC)
  WHERE collector_type IS NOT NULL;

-- For Topics aggregation by topic
CREATE INDEX IF NOT EXISTS idx_metric_facts_brand_customer_topic_date 
  ON public.metric_facts(brand_id, customer_id, topic, processed_at DESC)
  WHERE topic IS NOT NULL;

-- For Source attribution lookups
CREATE INDEX IF NOT EXISTS idx_metric_facts_collector_result_brand 
  ON public.metric_facts(collector_result_id, brand_id);

-- For competitor metrics joins
CREATE INDEX IF NOT EXISTS idx_competitor_metrics_comp_date 
  ON public.competitor_metrics(competitor_id, metric_fact_id)
  INCLUDE (visibility_index, share_of_answers);

-- For brand sentiment joins
CREATE INDEX IF NOT EXISTS idx_brand_sentiment_score 
  ON public.brand_sentiment(metric_fact_id)
  INCLUDE (sentiment_score, sentiment_label);
```

**Expected Impact**:
- **Target**: 60-90% reduction in query time for filtered queries
- Faster JOIN operations
- Better query plan selection

---

### Phase 2: Query Optimization (High Priority - 4-6 hours)

#### 2.1 Optimize Topics Query ✅

**Current Issues**:
- Multiple separate queries (queries → collector_results → positions)
- Feature flag causes inconsistent behavior
- No batching for large datasets

**Optimizations**:
1. **Single optimized query** using `OptimizedMetricsHelper`:
   ```typescript
   const result = await optimizedMetricsHelper.fetchTopicsWithMetrics({
     brandId,
     customerId,
     startDate: startIso,
     endDate: endIso,
     collectorTypes: mappedCollectorTypes,
   });
   ```

2. **Enable feature flag by default** after Phase 1 fixes:
   ```typescript
   const USE_OPTIMIZED_TOPICS_QUERY = process.env.USE_OPTIMIZED_TOPICS_QUERY !== 'false';
   ```

3. **Add query result caching** (see Phase 3)

**Expected Impact**:
- **Target**: 70-85% reduction in query time
- Single query instead of 3-4 sequential queries
- Consistent performance

---

#### 2.2 Optimize Prompts Query ✅

**Current Issues**:
- Queries `collector_results` then joins to get metrics separately
- No direct use of optimized schema
- Multiple round trips for metadata

**Optimizations**:
1. **Use optimized schema directly**:
   ```typescript
   // Query metric_facts with brand_metrics and brand_sentiment in single query
   const result = await optimizedMetricsHelper.fetchBrandMetrics({
     collectorResultIds: collectorResultIds,
     brandId,
     customerId,
     includeSentiment: true,
   });
   ```

2. **Batch metadata queries**:
   - Fetch all `generated_queries` in single query
   - Fetch all `citations` in single query
   - Use Maps for O(1) lookups

**Expected Impact**:
- **Target**: 60-75% reduction in query time
- Fewer database round trips
- Better use of JOINs

---

#### 2.3 Optimize Source Attribution Query ✅

**Current Issues**:
- Feature flag defaults to false (uses legacy `extracted_positions`)
- Multiple sequential queries (citations → collector_results → positions)
- No batching for large citation sets

**Optimizations**:
1. **Enable optimized query by default**:
   ```typescript
   const USE_OPTIMIZED_SOURCE_ATTRIBUTION = process.env.USE_OPTIMIZED_SOURCE_ATTRIBUTION !== 'false';
   ```

2. **Single query with all joins**:
   ```typescript
   const result = await optimizedMetricsHelper.fetchSourceAttributionMetrics({
     collectorResultIds,
     brandId,
     startDate: startIso,
     endDate: endIso,
   });
   ```

3. **Batch citation queries** by domain early

**Expected Impact**:
- **Target**: 65-80% reduction in query time
- Consistent with other pages
- Better scalability

---

### Phase 3: Caching Layer (Medium Priority - 3-4 hours)

#### 3.1 Add Backend Response Caching ✅

**Implementation Options**:

**Option A: In-Memory Cache (Simple)**
- Use Node.js `Map` with TTL
- Cache key: `brandId:customerId:startDate:endDate:collectors`
- TTL: 5 minutes for topics/prompts, 10 minutes for sources

**Option B: Redis Cache (Production-Ready)**
- Use `ioredis` or `node-cache` with Redis backend
- Cache key: Same as Option A
- TTL: Configurable per endpoint

**Implementation**:
```typescript
// middleware/cache.middleware.ts
export const cacheMiddleware = (ttlSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = buildCacheKey(req);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    // Store original json method
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      cache.set(cacheKey, body, ttlSeconds);
      return originalJson(body);
    };
    next();
  };
};
```

**Expected Impact**:
- **Target**: 95-99% reduction for cached requests (0-10ms)
- Reduced database load
- Better user experience on repeated navigation

---

#### 3.2 Verify Frontend Cache ✅

**Current State**:
- Frontend uses `useCachedData` hook with `refetchOnMount: false`
- Cache key based on endpoint URL

**Verification**:
1. Check cache keys are stable (no random params)
2. Verify `refetchOnMount: false` is set on all three pages
3. Test cache hit rate in browser DevTools

**Files to Check**:
- `src/pages/Topics.tsx` (line 408)
- `src/pages/Prompts.tsx` (line 79)
- `src/pages/SearchSourcesR2.tsx` (line 184)

**Expected Impact**:
- Instant navigation if cache exists
- No unnecessary refetches

---

### Phase 4: Monitoring & Validation (Ongoing)

#### 4.1 Add Performance Logging ✅

**Action**: Add timing logs to all three services

**Implementation**:
```typescript
const startTime = performance.now();
// ... query execution ...
const duration = performance.now() - startTime;
console.log(`[Topics] Query completed in ${duration.toFixed(2)}ms`);
```

**Metrics to Track**:
- Query execution time
- Cache hit/miss rate
- Database query count per request
- Response size

---

#### 4.2 Performance Targets ✅

**Before Fixes**:
- Initial load: 10-30+ seconds ❌
- Cached load: 10-30+ seconds ❌
- Navigation: 10-30+ seconds ❌

**After Phase 1 (Indexes + View Refresh)**:
- Initial load: 2-5 seconds ✅
- Cached load: 0-10ms ✅
- Navigation: 0-10ms ✅

**After Phase 2 (Query Optimization)**:
- Initial load: 300ms-3s ✅
- Cached load: 0-10ms ✅
- Navigation: 0-10ms ✅

**After Phase 3 (Caching)**:
- Initial load: 300ms-3s ✅
- Cached load: 0-10ms ✅
- Navigation: 0-10ms ✅

---

## Implementation Order

### Week 1: Critical Fixes
1. ✅ **Day 1**: Add automatic materialized view refresh
2. ✅ **Day 1**: Create migration with composite indexes
3. ✅ **Day 2**: Test and validate Phase 1 fixes
4. ✅ **Day 3**: Optimize Topics query (Phase 2.1)

### Week 2: Query Optimization
5. ✅ **Day 4**: Optimize Prompts query (Phase 2.2)
6. ✅ **Day 5**: Optimize Source Attribution query (Phase 2.3)
7. ✅ **Day 6**: Test all three pages end-to-end

### Week 3: Caching & Polish
8. ✅ **Day 7**: Add backend response caching (Phase 3.1)
9. ✅ **Day 8**: Verify frontend cache (Phase 3.2)
10. ✅ **Day 9**: Add performance logging (Phase 4.1)
11. ✅ **Day 10**: Final validation and documentation

---

## Risk Assessment

### Low Risk ✅
- Adding indexes (read-only, can be created concurrently)
- Adding automatic view refresh (idempotent)
- Enabling feature flags (can be rolled back)

### Medium Risk ⚠️
- Query optimization (may expose bugs in data transformation)
- Caching layer (may serve stale data if TTL too long)

### Mitigation
- Test all changes in staging first
- Monitor query performance after each phase
- Have rollback plan for each change
- Use feature flags to enable/disable optimizations

---

## Success Criteria

### Must Have ✅
1. All three pages load in < 3 seconds (initial load, no cache)
2. Cached loads are instant (< 10ms)
3. Navigation between pages is instant if cache exists
4. No data accuracy regressions
5. Materialized view refreshes automatically

### Nice to Have 🎯
1. Query time < 1 second for typical date ranges
2. Cache hit rate > 80% for repeated navigation
3. Database query count < 5 per page load
4. Response size < 500KB per page

---

## Files to Modify

### Backend
1. `backend/src/services/jobs/data-collection-job.service.ts` - Add view refresh
2. `backend/src/services/scoring/brand-scoring.orchestrator.ts` - Add view refresh
3. `backend/src/cron/unified-job-worker.ts` - Add view refresh
4. `supabase/migrations/YYYYMMDD_add_composite_indexes.sql` - New migration
5. `backend/src/services/brand.service.ts` - Optimize Topics query
6. `backend/src/services/prompts-analytics.service.ts` - Optimize Prompts query
7. `backend/src/services/source-attribution.service.ts` - Optimize Sources query
8. `backend/src/middleware/cache.middleware.ts` - New caching middleware
9. `backend/src/routes/brand.routes.ts` - Add cache middleware to routes

### Frontend (Verification Only)
1. `src/pages/Topics.tsx` - Verify cache settings
2. `src/pages/Prompts.tsx` - Verify cache settings
3. `src/pages/SearchSourcesR2.tsx` - Verify cache settings

---

## Testing Checklist

### Phase 1 Testing
- [ ] Materialized view refreshes after data collection
- [ ] Materialized view refreshes after scoring
- [ ] New indexes are created successfully
- [ ] Query execution plans use new indexes
- [ ] Topics page loads in < 5 seconds

### Phase 2 Testing
- [ ] Topics page loads in < 3 seconds
- [ ] Prompts page loads in < 3 seconds
- [ ] Sources page loads in < 3 seconds
- [ ] All metrics match previous values (no regressions)
- [ ] Filtering by collector type works correctly
- [ ] Date range filtering works correctly

### Phase 3 Testing
- [ ] Cached responses return in < 10ms
- [ ] Cache invalidation works correctly
- [ ] Navigation between pages is instant
- [ ] Cache doesn't serve stale data beyond TTL

### Phase 4 Testing
- [ ] Performance logs show improvement
- [ ] Database query count reduced
- [ ] Response times meet targets
- [ ] No errors in production logs

---

## Notes

1. **Materialized View Refresh**: Consider using `REFRESH MATERIALIZED VIEW CONCURRENTLY` if the view has a unique index (currently it doesn't, but we can add one)

2. **Feature Flags**: After Phase 1, consider enabling optimized queries by default and removing legacy code paths

3. **Monitoring**: Set up alerts for:
   - Query time > 5 seconds
   - Cache hit rate < 50%
   - Materialized view refresh failures

4. **Future Optimizations**:
   - Consider partitioning `metric_facts` by date
   - Consider materialized views for common aggregations (topics, prompts by date)
   - Consider read replicas for heavy read workloads

---

**Last Updated**: 2025-01-31
**Status**: Planning Phase - Ready for Implementation

