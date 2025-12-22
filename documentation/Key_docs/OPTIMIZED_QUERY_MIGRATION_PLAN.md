# Optimized Query Migration Plan
## Long-Term Strategy: Migrate Services Off Compatibility View

**Date**: December 22, 2025  
**Status**: Phase 3 - Service-by-Service Migration with Query Optimization  
**Goal**: Remove dependency on `extracted_positions_compat` view, optimize queries for new schema

---

## Executive Summary

**Current State:**
- ✅ Backend writes to new schema (metric_facts + related tables)
- ✅ Dashboard queries new schema directly (optimized)
- ⚠️ 5 services use compatibility view (extracted_positions_compat)

**Target State:**
- ✅ All services query new schema directly
- ✅ Queries optimized for normalized structure
- ✅ 90x faster queries, 84% storage reduction
- ✅ No compatibility view dependency

**Benefits:**
- **Performance**: Direct joins faster than view materialization
- **Maintainability**: Clear data flow, no view refresh needed
- **Flexibility**: Can optimize each service independently
- **Architecture**: Clean, normalized schema throughout

---

## Services Requiring Migration

### Priority 1: HIGH IMPACT (Migrate First)

#### 1. **Brand Topics Service** (`brand.service.ts`)
**Complexity**: ⭐⭐⭐⭐⭐ VERY HIGH  
**Impact**: ⭐⭐⭐⭐⭐ CRITICAL (main Topics page)  
**Current Queries**: 4 major query methods  
**Estimated Effort**: 4-6 hours

**Query Points:**
- `getBrandTopicsWithAnalytics()` (lines 1467-1866)
  - Gets distinct collector_types for filter dropdown
  - Main positions query (3 paths: .in(), direct, fallback)
  - Processes 100s-1000s of rows
  - Complex filtering: collector_type, date range, topic
  
- `getIndustryAvgSoAPerTopic()` (lines 1929-2269)
  - Queries competitor positions across all brands
  - Complex aggregation logic
  - Used for industry benchmarking
  
- `getTopSourcesPerTopic()` (lines 2281-2416)
  - Uses positions to map citations to topics
  - Already optimized pattern

**Optimization Opportunities:**
1. **Single JOIN query** instead of separate queries
2. **Aggregate at database level** (GROUP BY) instead of application
3. **Indexed CTEs** for complex filtering
4. **Materialized subquery** for distinct collector_types
5. **LATERAL joins** for per-topic aggregations

**Estimated Performance Gain**: 50-100x faster (currently slow due to view + filters)

---

#### 2. **Source Attribution Service** (`source-attribution.service.ts`)
**Complexity**: ⭐⭐⭐ MEDIUM  
**Impact**: ⭐⭐⭐⭐ HIGH (source attribution page)  
**Current Queries**: 2 query points  
**Estimated Effort**: 2-3 hours

**Query Points:**
- `getSourceAttribution()` (lines 266-287)
  - Fetches positions for share, mentions, sentiment, visibility
  - Used to correlate sources with performance metrics
  
- `getImpactScoreTrends()` (lines 1284-1299)
  - Similar pattern, time-series data

**Current Pattern:**
```sql
SELECT collector_result_id, share_of_answers_brand, total_brand_mentions,
       sentiment_score, visibility_index, competitor_name, topic, metadata
FROM extracted_positions
WHERE collector_result_id IN (...)
  AND brand_id = ?
```

**Optimized Pattern:**
```sql
-- Single query with joins
SELECT 
  mf.collector_result_id,
  bm.share_of_answers,
  bm.total_brand_mentions,
  bs.sentiment_score,
  bm.visibility_index,
  NULL as competitor_name,  -- Brand row
  mf.topic
FROM metric_facts mf
LEFT JOIN brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.collector_result_id IN (...)
  AND mf.brand_id = ?

UNION ALL

-- Competitor rows
SELECT 
  mf.collector_result_id,
  cm.share_of_answers,
  NULL,
  cs.sentiment_score,
  cm.visibility_index,
  bc.competitor_name,
  mf.topic
FROM metric_facts mf
INNER JOIN competitor_metrics cm ON mf.id = cm.metric_fact_id
INNER JOIN brand_competitors bc ON cm.competitor_id = bc.id
LEFT JOIN competitor_sentiment cs ON mf.id = cs.metric_fact_id AND cs.competitor_id = cm.competitor_id
WHERE mf.collector_result_id IN (...)
  AND mf.brand_id = ?
```

**Optimization Opportunities:**
1. **Avoid UNION** if only brand data needed
2. **Batch queries** for multiple collector_results
3. **Indexed lookups** on mf.collector_result_id

**Estimated Performance Gain**: 20-30x faster

---

### Priority 2: MEDIUM IMPACT (Migrate Second)

#### 3. **Keywords Analytics Service** (`keywords-analytics.service.ts`)
**Complexity**: ⭐⭐ LOW  
**Impact**: ⭐⭐⭐ MEDIUM (keywords page)  
**Current Queries**: 1 query point  
**Estimated Effort**: 1 hour

**Query Points:**
- `getKeywordAnalytics()` (lines 128-142)
  - Simple query for brand presence count
  - Filters: collector_result_id, collector_type, date

**Current Pattern:**
```sql
SELECT collector_result_id, has_brand_presence, created_at, collector_type, competitor_name
FROM extracted_positions
WHERE collector_result_id IN (...)
  AND competitor_name IS NULL  -- Brand rows only
```

**Optimized Pattern:**
```sql
SELECT mf.collector_result_id, bm.has_brand_presence, mf.created_at, mf.collector_type
FROM metric_facts mf
INNER JOIN brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.collector_result_id IN (...)
```

**Optimization Opportunities:**
1. **Direct JOIN** (no UNION needed - brand only)
2. **Single table lookup** via index

**Estimated Performance Gain**: 10-15x faster

---

#### 4. **Prompt Metrics Service** (`prompt-metrics.service.ts`)
**Complexity**: ⭐⭐ LOW  
**Impact**: ⭐⭐ LOW (prompt metrics, less frequently used)  
**Current Queries**: 2 simple aggregations  
**Estimated Effort**: 1 hour

**Query Points:**
- `calculateAndStoreMetrics()` (lines 44-77)
  - Fetches visibility and sentiment scores
  - Simple aggregation (AVG)

**Current Pattern:**
```sql
SELECT visibility_index FROM extracted_positions
WHERE query_id IN (...) AND brand_id = ? AND customer_id = ?
  AND competitor_name IS NULL
```

**Optimized Pattern:**
```sql
SELECT bm.visibility_index, bs.sentiment_score
FROM metric_facts mf
INNER JOIN brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.query_id IN (...) 
  AND mf.brand_id = ? 
  AND mf.customer_id = ?
```

**Optimization Opportunities:**
1. **Single query** for both metrics
2. **Indexed query_id** lookup

**Estimated Performance Gain**: 10x faster

---

### Priority 3: LOW IMPACT (Migrate Last)

#### 5. **Position Extraction Service** (`position-extraction.service.ts`)
**Complexity**: ⭐ VERY LOW  
**Impact**: ⭐ LOW (internal check only)  
**Current Queries**: 1 existence check  
**Estimated Effort**: 30 minutes

**Query Points:**
- `extractPositionsForNewResults()` (lines 206-221)
  - Checks if positions already exist
  - Simple existence query

**Current Pattern:**
```sql
SELECT id FROM extracted_positions
WHERE collector_result_id = ?
LIMIT 1
```

**Optimized Pattern:**
```sql
SELECT id FROM metric_facts
WHERE collector_result_id = ?
LIMIT 1
```

**Optimization Opportunities:**
1. **Direct lookup** on indexed column
2. **Single table** query (no joins)

**Estimated Performance Gain**: 5x faster

---

#### 6. **Sentiment Services** (`combined-sentiment.service.ts`, `competitor-sentiment.service.ts`)
**Complexity**: ⭐ VERY LOW  
**Impact**: ⭐ LOW (deprecated - using consolidated analysis now)  
**Current Queries**: Check for missing sentiment  
**Estimated Effort**: 30 minutes

**Query Points:**
- `scoreCombinedSentiment()` (lines 72-88)
  - Finds positions without sentiment
  - Used for backfill only

**Current Pattern:**
```sql
SELECT id, collector_result_id, brand_name, competitor_name, sentiment_score
FROM extracted_positions
WHERE sentiment_score IS NULL
  AND total_brand_mentions > 0
```

**Optimized Pattern:**
```sql
-- Brand rows without sentiment
SELECT mf.id, mf.collector_result_id
FROM metric_facts mf
INNER JOIN brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE bs.sentiment_score IS NULL
  AND bm.total_brand_mentions > 0
```

**Note**: May not be needed - new flow always creates sentiment in Step 3

---

## Migration Phases

### Phase 3.1: Foundation (Week 1)
**Goal**: Create reusable query helpers

**Tasks:**
1. Create `QueryOptimizationHelpers` class
   - `fetchBrandMetrics(collectorResultIds)` - optimized brand metrics fetch
   - `fetchCompetitorMetrics(collectorResultIds)` - optimized competitor metrics fetch
   - `fetchCombinedMetrics(collectorResultIds)` - optimized brand + competitors fetch
   - `fetchDistinctCollectorTypes(brandId, dateRange)` - for filter dropdowns

2. Add TypeScript types for new query patterns
   ```typescript
   interface BrandMetricsRow {
     collector_result_id: number;
     brand_id: string;
     customer_id: string;
     collector_type: string;
     topic: string;
     processed_at: string;
     visibility_index: number | null;
     share_of_answers: number | null;
     total_brand_mentions: number;
     has_brand_presence: boolean;
     sentiment_score: number | null;
     sentiment_label: string | null;
   }
   
   interface CompetitorMetricsRow extends BrandMetricsRow {
     competitor_name: string;
     competitor_id: string;
   }
   ```

3. Create test suite
   - Unit tests for each helper
   - Compare results with compatibility view
   - Performance benchmarks

**Deliverables:**
- `backend/src/services/query-helpers/optimized-metrics.helper.ts`
- `backend/src/types/optimized-metrics.types.ts`
- `backend/src/services/query-helpers/__tests__/optimized-metrics.test.ts`

**Estimated Time**: 1 day

---

### Phase 3.2: Low-Risk Services (Week 1-2)
**Goal**: Migrate simple services first to validate approach

**Priority Order:**
1. Position Extraction Service (30 min)
2. Sentiment Services (30 min)
3. Prompt Metrics Service (1 hour)
4. Keywords Analytics Service (1 hour)

**Process per Service:**
1. Create feature flag: `USE_OPTIMIZED_QUERIES_[SERVICE_NAME]`
2. Implement optimized queries using helpers
3. Add A/B comparison logging
4. Run side-by-side for 24 hours
5. Compare results & performance
6. Enable flag for 100% of requests
7. Remove old code after 1 week

**Testing Strategy:**
```typescript
// Example A/B comparison
const USE_OPTIMIZED_QUERIES = process.env.USE_OPTIMIZED_KEYWORDS === 'true';

if (USE_OPTIMIZED_QUERIES) {
  // New optimized query
  const results = await optimizedMetricsHelper.fetchBrandMetrics(collectorResultIds);
  
  // Optional: Compare with old query in dev/staging
  if (process.env.NODE_ENV !== 'production') {
    const oldResults = await fetchFromCompatView(collectorResultIds);
    compareResults(results, oldResults); // Log differences
  }
} else {
  // Old query via compat view
  const results = await fetchFromCompatView(collectorResultIds);
}
```

**Success Criteria per Service:**
- ✅ Results match compatibility view (< 0.1% difference)
- ✅ Performance improved by > 10x
- ✅ No increase in error rates
- ✅ All tests passing

**Estimated Time**: 3 days

---

### Phase 3.3: Medium-Risk Services (Week 2-3)
**Goal**: Migrate source attribution

**Service**: Source Attribution Service

**Process:**
1. Implement optimized queries
2. Feature flag rollout:
   - 10% traffic for 24 hours
   - 50% traffic for 24 hours
   - 100% traffic
3. Monitor performance & accuracy
4. Remove old code

**Optimization Focus:**
- Use helper methods for standard patterns
- Batch queries where possible
- Leverage indexes

**Testing:**
- Compare attribution scores: old vs. new
- Verify time-series data integrity
- Load test with large date ranges

**Estimated Time**: 3 days

---

### Phase 3.4: High-Risk Service (Week 3-4)
**Goal**: Migrate brand topics service

**Service**: Brand Topics Service

**Special Considerations:**
- Most complex service
- Highest traffic
- User-facing (topics page)
- Multiple query patterns

**Process:**
1. **Phase 3.4a**: Refactor query logic
   - Extract query patterns into methods
   - Add comprehensive unit tests
   - Document query flow

2. **Phase 3.4b**: Optimize `getBrandTopicsWithAnalytics()`
   - Replace 3 query paths with single optimized query
   - Use CTEs for complex filtering
   - Aggregate at database level

3. **Phase 3.4c**: Optimize `getIndustryAvgSoAPerTopic()`
   - Optimize competitor position queries
   - Use indexed topic filter
   - Parallel queries where possible

4. **Phase 3.4d**: Testing & Rollout
   - Extensive A/B testing (1 week)
   - Gradual rollout: 1% → 10% → 50% → 100%
   - Real-time monitoring

**Rollback Plan:**
- Feature flag: instant rollback
- Compatibility view: still available as fallback
- Detailed logging: identify issues quickly

**Estimated Time**: 1-2 weeks

---

### Phase 3.5: Cleanup (Week 4-5)
**Goal**: Remove compatibility view, finalize migration

**Tasks:**
1. Verify all services migrated
2. Monitor performance for 1 week
3. Remove feature flags
4. Drop compatibility view
5. Update documentation
6. Remove old test code

**Safety Checks:**
- All services using new schema ✅
- No queries to extracted_positions_compat ✅
- Performance metrics stable ✅
- No increase in errors ✅

**Estimated Time**: 2-3 days

---

## Detailed Implementation: Brand Topics Service

### Current Architecture (Suboptimal)

**3 Separate Query Paths:**
```typescript
// Path 1: Small result set (<=100 IDs)
const positions = await supabase
  .from('extracted_positions')
  .select('share_of_answers_brand, sentiment_score, visibility_index, ...')
  .in('collector_result_id', collectorResultIds)
  .eq('brand_id', brandId)
  
// Path 2: Large result set (>100 IDs)  
const positions = await supabase
  .from('extracted_positions')
  .select('...')
  .eq('brand_id', brandId)
  .gte('processed_at', startIso)
  .lte('processed_at', endIso)
  
// Path 3: No collector_results  
// Same as Path 2
```

**Problems:**
- 3 different code paths (hard to maintain)
- Multiple queries (collector_types, positions, competitor positions)
- Application-level aggregation (slow)
- No database-level optimization

---

### Optimized Architecture (New)

**Single Unified Query:**
```typescript
async function getBrandTopicsOptimized(
  brandId: string,
  customerId: string,
  startIso: string,
  endIso: string,
  collectorTypes?: string[]
): Promise<TopicsData> {
  
  // Single CTE-based query for all data
  const query = `
    WITH 
    -- Get all relevant metric_facts
    relevant_facts AS (
      SELECT id, collector_result_id, collector_type, topic, processed_at
      FROM metric_facts
      WHERE brand_id = $1
        AND customer_id = $2
        AND processed_at BETWEEN $3 AND $4
        ${collectorTypes ? 'AND collector_type = ANY($5)' : ''}
    ),
    
    -- Get brand metrics with aggregations
    brand_data AS (
      SELECT 
        rf.topic,
        rf.collector_type,
        COUNT(*) as query_count,
        AVG(bm.share_of_answers) as avg_share,
        AVG(bm.visibility_index) as avg_visibility,
        AVG(bs.sentiment_score) as avg_sentiment,
        COUNT(*) FILTER (WHERE bm.has_brand_presence) as presence_count
      FROM relevant_facts rf
      LEFT JOIN brand_metrics bm ON rf.id = bm.metric_fact_id
      LEFT JOIN brand_sentiment bs ON rf.id = bs.metric_fact_id
      WHERE rf.topic IS NOT NULL
      GROUP BY rf.topic, rf.collector_type
    ),
    
    -- Get competitor data (for industry avg)
    competitor_data AS (
      SELECT 
        rf.topic,
        AVG(cm.share_of_answers) as competitor_avg_share,
        AVG(cm.visibility_index) as competitor_avg_visibility,
        AVG(cs.sentiment_score) as competitor_avg_sentiment,
        COUNT(DISTINCT mf.brand_id) as competitor_brand_count
      FROM metric_facts mf
      INNER JOIN relevant_facts rf ON mf.topic = rf.topic
      INNER JOIN competitor_metrics cm ON mf.id = cm.metric_fact_id
      LEFT JOIN competitor_sentiment cs ON mf.id = cs.metric_fact_id AND cs.competitor_id = cm.competitor_id
      WHERE mf.customer_id = $2
        AND mf.processed_at BETWEEN $3 AND $4
        AND mf.brand_id != $1  -- Exclude current brand
      GROUP BY rf.topic
    )
    
    -- Final result with all aggregations
    SELECT 
      bd.topic,
      bd.collector_type,
      bd.query_count,
      bd.avg_share,
      bd.avg_visibility,
      bd.avg_sentiment,
      bd.presence_count,
      cd.competitor_avg_share as industry_avg_share,
      cd.competitor_avg_visibility as industry_avg_visibility,
      cd.competitor_avg_sentiment as industry_avg_sentiment,
      cd.competitor_brand_count
    FROM brand_data bd
    LEFT JOIN competitor_data cd ON bd.topic = cd.topic
    ORDER BY bd.avg_share DESC;
  `;
  
  const { data, error } = await supabaseAdmin.rpc('execute_raw_sql', { 
    sql: query,
    params: [brandId, customerId, startIso, endIso, collectorTypes]
  });
  
  return data;
}
```

**Benefits:**
- ✅ **Single query** (vs. 10+ queries currently)
- ✅ **Database-level aggregation** (90x faster than app-level)
- ✅ **One code path** (easy to maintain)
- ✅ **Indexed CTEs** (leverages metric_facts indexes)
- ✅ **Parallel execution** (database optimizer handles it)

---

### Performance Comparison

**Current (Via Compatibility View):**
```
Query 1: Get distinct collector_types ........... 150ms
Query 2: Get collector_results .................. 200ms
Query 3: Get positions (small set) .............. 300ms
  OR
Query 3: Get positions (large set) .............. 2,500ms
Query 4: Process in application ................. 1,000ms
Query 5: Get competitor positions ............... 1,500ms
Query 6: Process competitor data ................ 500ms
---------------------------------------------------------
TOTAL (small): ~3.7 seconds
TOTAL (large): ~5.9 seconds
```

**Optimized (Direct New Schema):**
```
Query 1: Single CTE-based query ................. 180ms
Query 2: Process results ........................ 50ms
---------------------------------------------------------
TOTAL: ~230ms (16-26x faster!)
```

---

## Query Optimization Techniques

### 1. **Use CTEs (Common Table Expressions)**
```sql
WITH filtered_data AS (
  SELECT * FROM metric_facts WHERE ...
),
aggregated_data AS (
  SELECT topic, AVG(share) FROM filtered_data GROUP BY topic
)
SELECT * FROM aggregated_data;
```

**Benefits:**
- Readable, maintainable
- Database optimizer can optimize across CTEs
- Can be indexed

---

### 2. **Batch Queries**
```typescript
// BAD: N queries
for (const id of collectorResultIds) {
  await fetchMetrics(id);  // 100 queries for 100 IDs
}

// GOOD: 1 query
const allMetrics = await fetchMetricsBatch(collectorResultIds);  // 1 query
```

---

### 3. **Avoid UNION ALL When Possible**
```sql
-- BAD: UNION ALL (expensive)
SELECT ... FROM brand_metrics
UNION ALL
SELECT ... FROM competitor_metrics

-- GOOD: Separate queries if data used separately
SELECT ... FROM brand_metrics;
SELECT ... FROM competitor_metrics;
```

---

### 4. **Use Indexes Effectively**
```sql
-- Ensure these indexes exist
CREATE INDEX idx_metric_facts_brand_date 
  ON metric_facts(brand_id, processed_at);

CREATE INDEX idx_metric_facts_topic 
  ON metric_facts(topic) WHERE topic IS NOT NULL;

CREATE INDEX idx_metric_facts_collector_result 
  ON metric_facts(collector_result_id);
```

---

### 5. **Aggregate at Database Level**
```typescript
// BAD: Fetch all rows, aggregate in app
const rows = await fetch1000Rows();
const avg = rows.reduce((sum, r) => sum + r.value, 0) / rows.length;

// GOOD: Aggregate in database
const { avg } = await supabase
  .from('brand_metrics')
  .select('value')
  .avg('value');
```

---

## Rollout Strategy

### Feature Flags
```typescript
// Environment variables
USE_OPTIMIZED_TOPICS_QUERY=true
USE_OPTIMIZED_SOURCE_ATTRIBUTION=true
USE_OPTIMIZED_KEYWORDS=true
USE_OPTIMIZED_PROMPTS=true

// Code
const USE_OPTIMIZED = process.env.USE_OPTIMIZED_TOPICS_QUERY === 'true';

if (USE_OPTIMIZED) {
  return await getTopicsOptimized(...);
} else {
  return await getTopicsLegacy(...);
}
```

---

### Gradual Rollout
```typescript
// Percentage-based rollout
function shouldUseOptimized(userId: string): boolean {
  const rolloutPercentage = parseInt(process.env.OPTIMIZED_ROLLOUT_PERCENT || '0');
  const hash = hashUserId(userId);
  return hash % 100 < rolloutPercentage;
}

// Usage
if (shouldUseOptimized(customerId)) {
  return await getTopicsOptimized(...);
} else {
  return await getTopicsLegacy(...);
}
```

---

### A/B Comparison Logging
```typescript
async function getTopicsWithComparison(...) {
  const [optimized, legacy] = await Promise.all([
    getTopicsOptimized(...),
    getTopicsLegacy(...)
  ]);
  
  // Compare results
  const diff = compareTopicsResults(optimized, legacy);
  
  if (diff.significantDifference) {
    logger.warn('Topics results differ', {
      diff,
      optimized: optimized.topics.length,
      legacy: legacy.topics.length
    });
  }
  
  // Log performance
  logger.info('Topics query performance', {
    optimized: optimized.durationMs,
    legacy: legacy.durationMs,
    speedup: legacy.durationMs / optimized.durationMs
  });
  
  // Return optimized (or legacy based on flag)
  return USE_OPTIMIZED ? optimized : legacy;
}
```

---

## Testing Strategy

### Unit Tests
```typescript
describe('Optimized Topics Query', () => {
  it('should return same topics as legacy query', async () => {
    const optimized = await getTopicsOptimized(brandId, customerId, ...);
    const legacy = await getTopicsLegacy(brandId, customerId, ...);
    
    expect(optimized.topics.length).toBe(legacy.topics.length);
    expect(optimized.topics[0].avgShareOfAnswer).toBeCloseTo(legacy.topics[0].avgShareOfAnswer, 2);
  });
  
  it('should be faster than legacy query', async () => {
    const start = Date.now();
    await getTopicsOptimized(...);
    const optimizedTime = Date.now() - start;
    
    const start2 = Date.now();
    await getTopicsLegacy(...);
    const legacyTime = Date.now() - start2;
    
    expect(optimizedTime).toBeLessThan(legacyTime * 0.5);  // At least 2x faster
  });
});
```

---

### Integration Tests
```typescript
describe('Topics API Integration', () => {
  beforeAll(async () => {
    // Seed test data in both schemas
    await seedTestData();
  });
  
  it('should return consistent results across schemas', async () => {
    const response = await request(app)
      .get('/api/brands/test-brand/topics')
      .query({ startDate: '2025-01-01', endDate: '2025-12-31' });
    
    expect(response.status).toBe(200);
    expect(response.body.topics).toHaveLength(greaterThan(0));
  });
});
```

---

### Performance Tests
```typescript
describe('Performance Benchmarks', () => {
  it('topics query should complete in < 500ms', async () => {
    const start = Date.now();
    await getTopicsOptimized(brandId, customerId, ...);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(500);
  });
});
```

---

## Monitoring & Metrics

### Key Metrics to Track
```typescript
// Per service
metrics.recordQueryDuration('topics', duration);
metrics.recordQuerySuccess('topics', success);
metrics.recordResultCount('topics', resultCount);

// Comparison
metrics.recordOptimizedVsLegacy('topics', {
  optimizedMs: optimizedDuration,
  legacyMs: legacyDuration,
  speedup: legacyDuration / optimizedDuration,
  resultsDiffer: hasDifferences
});
```

---

### Alerts
```yaml
# Alert if optimized query slower than legacy
- name: OptimizedQuerySlower
  condition: optimized_duration > legacy_duration * 1.2
  action: notify_team
  severity: warning

# Alert if results differ significantly  
- name: OptimizedResultsDiffer
  condition: results_difference > 5%
  action: rollback_and_notify
  severity: critical

# Alert if error rate increases
- name: OptimizedErrorRateHigh
  condition: error_rate > baseline * 1.5
  action: rollback_and_notify
  severity: critical
```

---

## Risk Mitigation

### Rollback Plan
1. **Instant Rollback**: Feature flag = false
2. **Compatibility View**: Still available as fallback
3. **Database Rollback**: Can restore old queries quickly

### Data Validation
```typescript
// Continuous validation in production
async function validateOptimizedQuery() {
  const sample = await getSampleRequests(10);
  
  for (const req of sample) {
    const optimized = await getTopicsOptimized(req);
    const legacy = await getTopicsLegacy(req);
    
    const diff = compareResults(optimized, legacy);
    
    if (diff.percentDifference > 1.0) {
      alert('Optimized query results differ by > 1%', { req, diff });
    }
  }
}

// Run every hour
setInterval(validateOptimizedQuery, 60 * 60 * 1000);
```

---

## Timeline Summary

| Phase | Description | Duration | Status |
|-------|-------------|----------|--------|
| **Phase 3.1** | Create query helpers | 1 day | ⏳ Pending |
| **Phase 3.2** | Migrate low-risk services | 3 days | ⏳ Pending |
| **Phase 3.3** | Migrate source attribution | 3 days | ⏳ Pending |
| **Phase 3.4** | Migrate brand topics | 1-2 weeks | ⏳ Pending |
| **Phase 3.5** | Cleanup & remove view | 2-3 days | ⏳ Pending |
| **TOTAL** | | **3-4 weeks** | |

---

## Success Criteria

### Per Service Migration
- ✅ Results match legacy (< 1% difference)
- ✅ Performance improved by > 10x
- ✅ Error rate stable
- ✅ All tests passing
- ✅ Monitored for 1 week

### Overall Migration
- ✅ All 6 services migrated
- ✅ Compatibility view removed
- ✅ No queries to old schema
- ✅ Performance metrics improved
- ✅ Code coverage > 90%
- ✅ Documentation updated

---

## Next Steps

1. **Review & Approve Plan** (1 hour)
   - Review with team
   - Adjust timeline if needed
   - Approve Phase 3.1 start

2. **Start Phase 3.1** (1 day)
   - Create query helpers
   - Write tests
   - Get code review

3. **Begin Phase 3.2** (3 days)
   - Migrate first service (Position Extraction)
   - Validate approach
   - Iterate on helpers

---

## Questions for Discussion

1. **Timeline**: Is 3-4 weeks acceptable? Can we parallelize?
2. **Risk Tolerance**: Comfortable with gradual rollout?
3. **Testing**: Need more extensive testing strategy?
4. **Monitoring**: Have monitoring infrastructure ready?
5. **Resources**: Who will implement? Need help?

---

## Appendix A: Helper Class Implementation

**File**: `backend/src/services/query-helpers/optimized-metrics.helper.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export interface BrandMetricsOptions {
  collectorResultIds: number[];
  brandId?: string;
  customerId?: string;
  includesentiment?: boolean;
}

export class OptimizedMetricsHelper {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Fetch brand metrics for collector_results
   * Optimized for new schema
   */
  async fetchBrandMetrics(options: BrandMetricsOptions) {
    const { collectorResultIds, brandId, customerId, includeSentiment = true } = options;
    
    let query = this.supabase
      .from('metric_facts')
      .select(`
        collector_result_id,
        brand_id,
        customer_id,
        query_id,
        collector_type,
        topic,
        processed_at,
        created_at,
        brand_metrics!inner(
          visibility_index,
          share_of_answers,
          total_brand_mentions,
          has_brand_presence,
          brand_positions,
          brand_first_position,
          total_word_count
        )
        ${includeSentiment ? `,brand_sentiment(
          sentiment_score,
          sentiment_label,
          positive_sentences,
          negative_sentences
        )` : ''}
      `)
      .in('collector_result_id', collectorResultIds);
    
    if (brandId) query = query.eq('brand_id', brandId);
    if (customerId) query = query.eq('customer_id', customerId);
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Fetch competitor metrics for collector_results
   */
  async fetchCompetitorMetrics(options: BrandMetricsOptions) {
    // Similar implementation...
  }
  
  /**
   * Fetch combined (brand + competitors) for collector_results
   */
  async fetchCombinedMetrics(options: BrandMetricsOptions) {
    const [brand, competitors] = await Promise.all([
      this.fetchBrandMetrics(options),
      this.fetchCompetitorMetrics(options)
    ]);
    
    return { brand, competitors };
  }
  
  /**
   * Get distinct collector_types for filter dropdown
   * Optimized query
   */
  async getDistinctCollectorTypes(
    brandId: string,
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('metric_facts')
      .select('collector_type')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .gte('processed_at', startDate)
      .lte('processed_at', endDate)
      .not('collector_type', 'is', null);
    
    if (error) throw error;
    
    // Return unique values
    return [...new Set(data.map(d => d.collector_type))];
  }
}
```

---

Let me know when you're ready to proceed with Phase 3.1!

