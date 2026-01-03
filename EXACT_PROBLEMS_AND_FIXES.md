# Exact Problems & Fixes: Multiple Database Queries

## The Problem in One Sentence

**Splitting `extracted_positions` into 5 tables increased database queries from 1 to 20+ per page load because services are doing sequential queries instead of JOINs.**

---

## Problem #1: Dashboard Payload Builder (WORST OFFENDER)

### Location
`backend/src/services/brand-dashboard/payload-builder.ts` (lines 155-201)

### What It Does (WRONG WAY)
```typescript
// 1. Query metric_facts (1 query)
const { data: metricFacts } = await supabaseAdmin
  .from('metric_facts')
  .select('id, collector_result_id, ...')
  .eq('brand_id', brand.id)

// 2. For EACH chunk of 200 IDs, do 4 separate queries:
for (let i = 0; i < metricFactIds.length; i += chunkSize) {
  const chunk = metricFactIds.slice(i, i + chunkSize)
  
  // Query 1: brand_metrics
  await supabaseAdmin.from('brand_metrics')
    .select('*').in('metric_fact_id', chunk)
  
  // Query 2: competitor_metrics
  await supabaseAdmin.from('competitor_metrics')
    .select('*').in('metric_fact_id', chunk)
  
  // Query 3: brand_sentiment
  await supabaseAdmin.from('brand_sentiment')
    .select('*').in('metric_fact_id', chunk)
  
  // Query 4: competitor_sentiment
  await supabaseAdmin.from('competitor_sentiment')
    .select('*').in('metric_fact_id', chunk)
}
```

### Impact
- **1000 metric_facts = 5 chunks × 4 queries = 20 queries**
- **Total: 21 queries** (1 + 20)
- **Before: 1 query** to `extracted_positions`

### The Fix (CORRECT WAY)
```typescript
// Single query with JOINs (like optimized-metrics.helper.ts does)
const { data: metricFacts } = await supabaseAdmin
  .from('metric_facts')
  .select(`
    id,
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
    ),
    brand_sentiment(
      sentiment_score,
      sentiment_label,
      positive_sentences,
      negative_sentences
    ),
    competitor_metrics(
      competitor_id,
      visibility_index,
      share_of_answers,
      competitor_positions,
      competitor_mentions,
      brand_competitors!inner(
        competitor_name
      )
    ),
    competitor_sentiment(
      competitor_id,
      sentiment_score,
      sentiment_label,
      positive_sentences,
      negative_sentences,
      brand_competitors!inner(
        competitor_name
      )
    )
  `)
  .eq('brand_id', brand.id)
  .gte('processed_at', startIsoBound)
  .lte('processed_at', endIsoBound)
```

**Result: 1 query instead of 21 queries** ✅

---

## Problem #2: Topics Service - Feature Flag Disabled

### Location
`backend/src/services/brand.service.ts` (line 1509)

### What It Does (WRONG WAY)
```typescript
const USE_OPTIMIZED_TOPICS_QUERY = process.env.USE_OPTIMIZED_TOPICS_QUERY === 'true';

if (USE_OPTIMIZED_TOPICS_QUERY) {
  // ✅ Uses JOINs (single query) - GOOD!
  const result = await optimizedMetricsHelper.fetchTopicPositions({...});
} else {
  // ❌ Falls back to legacy extracted_positions
  // But extracted_positions is empty/stale, so this fails or is slow
  const { data } = await supabaseAdmin
    .from('extracted_positions')
    .select('...')
}
```

### Impact
- Feature flag defaults to `false`
- Service queries stale/empty `extracted_positions` table
- Or falls back to slow legacy queries

### The Fix
```typescript
// Option 1: Enable by default
const USE_OPTIMIZED_TOPICS_QUERY = process.env.USE_OPTIMIZED_TOPICS_QUERY !== 'false';

// Option 2: Always use optimized (remove flag)
const result = await optimizedMetricsHelper.fetchTopicPositions({
  brandId,
  customerId,
  startDate: startIso,
  endDate: endIso,
  collectorTypes: mappedCollectorTypes.length > 0 ? mappedCollectorTypes : undefined,
  collectorResultIds,
});
```

**Result: Always uses single JOIN query** ✅

---

## Problem #3: Source Attribution - Feature Flag Disabled

### Location
`backend/src/services/source-attribution.service.ts` (line 269)

### What It Does (WRONG WAY)
```typescript
const USE_OPTIMIZED_SOURCE_ATTRIBUTION = process.env.USE_OPTIMIZED_SOURCE_ATTRIBUTION === 'true';

if (USE_OPTIMIZED_SOURCE_ATTRIBUTION) {
  // ✅ Uses JOINs (single query) - GOOD!
  const result = await optimizedMetricsHelper.fetchSourceAttributionMetrics({...});
} else {
  // ❌ Falls back to legacy extracted_positions
  const { data } = await supabaseAdmin
    .from('extracted_positions')
    .select('...')
    .in('collector_result_id', collectorResultIds)
}
```

### Impact
- Feature flag defaults to `false`
- Service queries stale/empty `extracted_positions` table

### The Fix
```typescript
// Option 1: Enable by default
const USE_OPTIMIZED_SOURCE_ATTRIBUTION = process.env.USE_OPTIMIZED_SOURCE_ATTRIBUTION !== 'false';

// Option 2: Always use optimized (remove flag)
const result = await optimizedMetricsHelper.fetchSourceAttributionMetrics({
  collectorResultIds,
  brandId,
  startDate: startIso,
  endDate: endIso,
});
```

**Result: Always uses single JOIN query** ✅

---

## Problem #4: Prompts Service - No Optimized Helper

### Location
`backend/src/services/prompts-analytics.service.ts` (lines 326-650)

### What It Does (WRONG WAY)
```typescript
// 1. Query collector_results (1 query)
const { data: collectorRows } = await supabaseAdmin
  .from('collector_results')
  .select('id, query_id, collector_type, question, raw_answer, ...')
  .eq('brand_id', brandRow.id)
  .eq('customer_id', customerId)
  .gte('created_at', startIso)
  .lte('created_at', endIso)

// 2. Query generated_queries separately (1 query)
const { data: queryRows } = await supabaseAdmin
  .from('generated_queries')
  .select('id, query_text, metadata')
  .in('id', filteredQueryIds)

// 3. Query keywords separately (2 queries - by query_id and collector_result_id)
const { data: queryKeywordRows } = await supabaseAdmin
  .from('generated_keywords')
  .select('keyword, query_id, collector_result_id')
  .in('query_id', allQueryIds)

const { data: collectorKeywordRows } = await supabaseAdmin
  .from('generated_keywords')
  .select('keyword, query_id, collector_result_id')
  .in('collector_result_id', allCollectorResultIds)

// 4. Then separately fetch metrics from extracted_positions (if needed)
// This is done later in the code, adding more queries
```

### Impact
- **4+ sequential queries** instead of 1-2 with JOINs
- Metrics (SOA, sentiment, visibility) are fetched separately or missing

### The Fix
```typescript
// Use optimized helper to get metrics in single query
const collectorResultIds = rows.map(row => row.id);

const metricsResult = await optimizedMetricsHelper.fetchBrandMetrics({
  collectorResultIds,
  brandId: brandRow.id,
  customerId,
  includeSentiment: true,
});

// Create map for O(1) lookups
const metricsMap = new Map(
  metricsResult.data.map(m => [m.collector_result_id, m])
);

// Use metrics in aggregation
for (const row of rows) {
  const metrics = metricsMap.get(row.id);
  // Use metrics.share_of_answers, metrics.sentiment_score, etc.
}
```

**Result: 2 queries instead of 4+** ✅

---

## Problem #5: Materialized View Not Refreshed

### Location
`supabase/migrations/20250202000001_create_extracted_positions_compat_view.sql`

### What It Does (WRONG WAY)
```sql
-- View is created but only refreshed ONCE during migration
REFRESH MATERIALIZED VIEW public.extracted_positions_compat;
```

### Impact
- View becomes stale immediately after new data is written
- Services querying the view get empty/old data
- Services fall back to slow direct queries

### The Fix
Add automatic refresh after data collection/scoring:

**File: `backend/src/services/jobs/data-collection-job.service.ts`**
```typescript
// After data collection completes
await supabaseAdmin.rpc('refresh_extracted_positions_compat');
```

**File: `backend/src/services/scoring/brand-scoring.orchestrator.ts`**
```typescript
// After scoring completes
await supabaseAdmin.rpc('refresh_extracted_positions_compat');
```

**Or create a function:**
```sql
CREATE OR REPLACE FUNCTION refresh_extracted_positions_compat()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.extracted_positions_compat;
END;
$$;
```

**Result: View always has fresh data** ✅

---

## Summary: Query Count Comparison

### Before (Single Table)
- **Topics**: 1 query to `extracted_positions`
- **Prompts**: 1-2 queries
- **Sources**: 1 query to `extracted_positions`
- **Dashboard**: 1 query to `extracted_positions`
- **Total per page load: 1-2 queries**

### After Split (Current - WRONG)
- **Topics**: 1-3 queries (depending on feature flag)
- **Prompts**: 4+ queries (sequential)
- **Sources**: 1-2 queries (depending on feature flag)
- **Dashboard**: 21 queries (1 + 5 chunks × 4)
- **Total per page load: 7-30 queries**

### After Fix (With JOINs)
- **Topics**: 1 query (JOINs in single query)
- **Prompts**: 2 queries (collector_results + metrics with JOINs)
- **Sources**: 1 query (JOINs in single query)
- **Dashboard**: 1 query (JOINs in single query)
- **Total per page load: 1-2 queries** ✅

---

## Quick Fix Priority

1. **🔥 CRITICAL**: Fix `payload-builder.ts` (21 queries → 1 query)
2. **🔥 CRITICAL**: Enable feature flags by default (Topics, Sources)
3. **⚠️ HIGH**: Add automatic materialized view refresh
4. **⚠️ HIGH**: Optimize Prompts service to use metrics helper
5. **📊 MEDIUM**: Add composite indexes for faster JOINs

---

## Expected Performance Improvement

- **Current**: 10-30 seconds per page load
- **After Fix #1 (payload-builder)**: 3-5 seconds
- **After Fix #2 (feature flags)**: 1-3 seconds
- **After Fix #3 (view refresh)**: Consistent 1-3 seconds
- **After Fix #4 (Prompts)**: 0.5-2 seconds
- **After Fix #5 (indexes)**: 0.3-1 second ✅

**Target: 300ms-3s initial load, 0-10ms cached load**

