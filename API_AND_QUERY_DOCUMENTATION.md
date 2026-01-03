# API Endpoint and Database Query for Prompts Counts

## API Endpoint

**Route:** `GET /api/brands/:brandId/prompts`

**File:** `backend/src/routes/brand.routes.ts` (lines 485-545)

**Example URL:**
```
GET /api/brands/32b3dc03-fe6b-40e6-94ac-9a146ceca60d/prompts?startDate=2025-12-05T00:00:00.000Z&endDate=2026-01-03T23:59:59.999Z
```

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string  
- `collectors` (optional): Comma-separated list of collector types

**Authentication:** Required (Bearer token)

---

## Service Method

**Service:** `PromptsAnalyticsService.getPromptAnalytics()`

**File:** `backend/src/services/prompts-analytics.service.ts` (line 295)

**Calls:** `OptimizedMetricsHelper.fetchPromptsAnalytics()`

**File:** `backend/src/services/query-helpers/optimized-metrics.helper.ts` (line 1229)

---

## Database Query (Supabase)

**File:** `backend/src/services/query-helpers/optimized-metrics.helper.ts` (lines 1257-1297)

### Supabase Query Structure:

```typescript
this.supabase
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
      competitor_mentions,
      total_competitor_product_mentions,
      brand_competitors!inner(
        competitor_name
      )
    )
  `)
  .eq('brand_id', brandId)
  .eq('customer_id', customerId)  // if provided
  .gte('processed_at', startDate)  // if provided
  .lte('processed_at', endDate)     // if provided
  .in('query_id', queryIds)         // if provided
  .in('collector_result_id', collectorResultIds)  // if provided
```

---

## Equivalent SQL Query

Here's the equivalent raw SQL that Supabase generates:

```sql
SELECT 
  mf.query_id,
  mf.collector_result_id,
  mf.collector_type,
  mf.processed_at,
  -- Brand metrics (INNER JOIN - only returns rows with brand_metrics)
  bm.visibility_index,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  -- Brand sentiment (LEFT JOIN)
  bs.sentiment_score,
  -- Competitor metrics (LEFT JOIN - can be multiple rows per metric_fact)
  cm.competitor_id,
  cm.competitor_mentions,
  cm.total_competitor_product_mentions,
  bc.competitor_name
FROM metric_facts mf
INNER JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN brand_sentiment bs ON bs.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
LEFT JOIN brand_competitors bc ON bc.id = cm.competitor_id
WHERE mf.brand_id = :brandId
  AND (:customerId IS NULL OR mf.customer_id = :customerId)
  AND (:startDate IS NULL OR mf.processed_at >= :startDate)
  AND (:endDate IS NULL OR mf.processed_at <= :endDate)
  AND (:queryIds IS NULL OR mf.query_id = ANY(:queryIds))
  AND (:collectorResultIds IS NULL OR mf.collector_result_id = ANY(:collectorResultIds))
ORDER BY mf.collector_result_id;
```

---

## ⚠️ CRITICAL ISSUE: INNER JOIN on brand_metrics

**The Problem:**

The query uses `brand_metrics!inner` which means:
- **ONLY** collector_results that have been **scored** (have `metric_facts` and `brand_metrics` rows) will be returned
- Collector_results that haven't been scored yet will **NOT** appear in the results
- This causes them to show **0 counts** in the UI

**Why this happens:**
1. Data collection creates `collector_results` rows
2. Scoring process creates `metric_facts` and `brand_metrics` rows
3. If scoring hasn't run for some collector_results, they won't have `metric_facts` rows
4. The INNER JOIN excludes them from the query results
5. The UI shows 0 counts because the collector_result_id isn't in the results

---

## Data Flow

```
1. Frontend calls: GET /api/brands/:brandId/prompts
   ↓
2. Route handler: brand.routes.ts (line 515)
   ↓
3. Service: promptsAnalyticsService.getPromptAnalytics()
   ↓
4. Helper: optimizedMetricsHelper.fetchPromptsAnalytics()
   ↓
5. Database Query: Supabase query to metric_facts with joins
   ↓
6. Transform: Maps database rows to response format
   ↓
7. Aggregate: Groups by collector_result_id and sets counts
   ↓
8. Response: Returns JSON with counts per collector
```

---

## How Counts Are Set

After the query returns, the data is transformed:

```typescript
// In optimized-metrics.helper.ts (lines 1311-1358)
const transformed = data.map((row) => {
  const bm = row.brand_metrics[0];  // Brand metrics
  const cms = row.competitor_metrics;  // Array of competitor metrics
  
  // Sum all competitor mentions
  let totalCompetitorMentions = 0;
  cms.forEach((cm) => {
    totalCompetitorMentions += cm.competitor_mentions || 0;
  });
  
  return {
    collector_result_id: row.collector_result_id,
    total_brand_mentions: bm?.total_brand_mentions ?? null,
    total_brand_product_mentions: bm?.total_brand_product_mentions ?? null,
    competitor_count: totalCompetitorMentions,
    // ...
  };
});
```

Then in `prompts-analytics.service.ts` (lines 904-910):

```typescript
mentionCountsByCollector.set(collectorResultId, {
  brand: brandMentions,
  product: productMentions,
  competitor: competitorMentions,
  keywords: keywordCountsByCollector.get(collectorResultId) || 0
});
```

---

## Debugging Queries

### Check which collector_results have metric_facts:

```sql
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  cr.query_id,
  CASE 
    WHEN mf.id IS NOT NULL THEN 'HAS metric_facts' 
    ELSE 'MISSING metric_facts' 
  END AS status,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
WHERE cr.brand_id = 'YOUR_BRAND_ID'
  AND cr.customer_id = 'YOUR_CUSTOMER_ID'
ORDER BY cr.id
LIMIT 50;
```

### Count missing vs present:

```sql
SELECT 
  COUNT(*) FILTER (WHERE mf.id IS NULL) AS missing_metric_facts,
  COUNT(*) FILTER (WHERE mf.id IS NOT NULL) AS has_metric_facts,
  COUNT(*) AS total_collector_results
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
WHERE cr.brand_id = 'YOUR_BRAND_ID'
  AND cr.customer_id = 'YOUR_CUSTOMER_ID';
```

---

## Solution

To fix the issue where some collectors show 0 counts:

1. **Ensure all collector_results are scored** - Run the scoring pipeline for all collector_results
2. **OR change the query to LEFT JOIN** - This will return all collector_results but with null values for unscored ones
3. **OR handle missing data in code** - Default to 0 counts when collector_result_id is not in query results

The recommended approach is **#1** - ensure all collector_results have been scored.

