# Exact Database Queries for LLM-wise Counts (Brand, Product, Competitor, Keywords)

## Overview

The Prompts page fetches counts per LLM (collector) using **2 separate queries**:

1. **Brand/Product/Competitor Counts** → `optimized-metrics.helper.ts`
2. **Keywords Count** → `prompts-analytics.service.ts`

---

## Query 1: Brand, Product, Competitor Counts

### File Location
`backend/src/services/query-helpers/optimized-metrics.helper.ts` (lines 1262-1313)

### Supabase Query (TypeScript)

```typescript
let collectorQuery = this.supabase
  .from('collector_results')
  .select(`
    id,
    query_id,
    collector_type,
    created_at,
    metric_facts(
      query_id,
      processed_at,
      brand_metrics(
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
        brand_competitors(
          competitor_name
        )
      )
    )
  `)
  .eq('brand_id', brandId);

if (customerId) {
  collectorQuery = collectorQuery.eq('customer_id', customerId);
}

// IMPORTANT: When collectorResultIds are provided, skip date filters
if (collectorResultIds && collectorResultIds.length > 0) {
  collectorQuery = collectorQuery.in('id', collectorResultIds);
} else {
  if (startDate) {
    collectorQuery = collectorQuery.gte('created_at', startDate);
  }
  if (endDate) {
    collectorQuery = collectorQuery.lte('created_at', endDate);
  }
  if (queryIds && queryIds.length > 0) {
    collectorQuery = collectorQuery.in('query_id', queryIds);
  }
}

const { data: collectorData, error: collectorError } = await collectorQuery;
```

### Equivalent SQL Query

```sql
SELECT 
  cr.id AS collector_result_id,
  cr.query_id,
  cr.collector_type,
  cr.created_at,
  -- From metric_facts (LEFT JOIN)
  mf.id AS metric_fact_id,
  mf.query_id AS metric_fact_query_id,
  mf.processed_at,
  -- From brand_metrics (LEFT JOIN)
  bm.visibility_index,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  -- From brand_sentiment (LEFT JOIN)
  bs.sentiment_score,
  -- From competitor_metrics (LEFT JOIN, multiple rows per metric_fact)
  cm.competitor_id,
  cm.competitor_mentions,
  cm.total_competitor_product_mentions,
  bc.competitor_name
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN brand_sentiment bs ON bs.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
LEFT JOIN brand_competitors bc ON cm.competitor_id = bc.id
WHERE cr.brand_id = :brandId
  AND (:customerId IS NULL OR cr.customer_id = :customerId)
  -- When collectorResultIds provided:
  AND (:collectorResultIds IS NULL OR cr.id = ANY(:collectorResultIds))
  -- When collectorResultIds NOT provided:
  AND (
    :collectorResultIds IS NOT NULL OR (
      (:startDate IS NULL OR cr.created_at >= :startDate)
      AND (:endDate IS NULL OR cr.created_at <= :endDate)
      AND (:queryIds IS NULL OR cr.query_id = ANY(:queryIds))
    )
  )
ORDER BY cr.id;
```

### Data Transformation (After Query)

The raw Supabase response is transformed in `optimized-metrics.helper.ts` (lines 1356-1400):

```typescript
const transformed = collectorData.map((cr: any) => {
  // Extract metric_facts (array or single object)
  const mf = Array.isArray(cr.metric_facts) 
    ? (cr.metric_facts.length > 0 ? cr.metric_facts[0] : null)
    : cr.metric_facts;
  
  // Extract brand_metrics
  const bm = mf?.brand_metrics 
    ? (Array.isArray(mf.brand_metrics) ? mf.brand_metrics[0] : mf.brand_metrics)
    : null;
  
  // Extract competitor_metrics (array of competitors)
  const cms = mf?.competitor_metrics
    ? (Array.isArray(mf.competitor_metrics) ? mf.competitor_metrics : [mf.competitor_metrics])
    : [];

  // SUM competitor mentions across all competitors
  let totalCompetitorMentions = 0;
  let totalCompetitorProductMentions = 0;
  const competitorNames: string[] = [];
  
  cms.forEach((cm: any) => {
    if (cm) {
      const bc = Array.isArray(cm.brand_competitors) ? cm.brand_competitors[0] : cm.brand_competitors;
      if (bc?.competitor_name) {
        competitorNames.push(bc.competitor_name);
      }
      if (cm.competitor_mentions !== null && cm.competitor_mentions !== undefined) {
        totalCompetitorMentions += Number(cm.competitor_mentions);
      }
      if (cm.total_competitor_product_mentions !== null && cm.total_competitor_product_mentions !== undefined) {
        totalCompetitorProductMentions += Number(cm.total_competitor_product_mentions);
      }
    }
  });

  return {
    collector_result_id: cr.id,
    collector_type: cr.collector_type,
    total_brand_mentions: bm?.total_brand_mentions ?? null,
    total_brand_product_mentions: bm?.total_brand_product_mentions ?? null,
    competitor_count: totalCompetitorMentions,  // SUM of all competitor_mentions
    competitor_product_count: totalCompetitorProductMentions,  // SUM of all competitor product mentions
    competitor_names: competitorNames
  };
});
```

### Final Output Structure

```typescript
{
  collector_result_id: number,
  collector_type: string,
  total_brand_mentions: number | null,        // From brand_metrics.total_brand_mentions
  total_brand_product_mentions: number | null, // From brand_metrics.total_brand_product_mentions
  competitor_count: number,                    // SUM of competitor_metrics.competitor_mentions
  competitor_product_count: number,          // SUM of competitor_metrics.total_competitor_product_mentions
  competitor_names: string[]                  // Array of competitor names
}
```

---

## Query 2: Keywords Count

### File Location
`backend/src/services/prompts-analytics.service.ts` (lines 619-649)

### Supabase Query (TypeScript)

```typescript
// Query 2A: Fetch keywords by query_id
if (allQueryIds.length > 0) {
  const { data: queryKeywordRows } = await supabaseAdmin
    .from('generated_keywords')
    .select('keyword, query_id, collector_result_id')
    .eq('brand_id', brandRow.id)
    .eq('customer_id', customerId)
    .in('query_id', allQueryIds);
}

// Query 2B: Fetch keywords by collector_result_id
if (allCollectorResultIds.length > 0) {
  const { data: collectorKeywordRows } = await supabaseAdmin
    .from('generated_keywords')
    .select('keyword, query_id, collector_result_id')
    .eq('brand_id', brandRow.id)
    .eq('customer_id', customerId)
    .in('collector_result_id', allCollectorResultIds);
}
```

### Equivalent SQL Query

```sql
-- Query 2A: By query_id
SELECT 
  keyword,
  query_id,
  collector_result_id
FROM generated_keywords
WHERE brand_id = :brandId
  AND customer_id = :customerId
  AND query_id = ANY(:queryIds);

-- Query 2B: By collector_result_id
SELECT 
  keyword,
  query_id,
  collector_result_id
FROM generated_keywords
WHERE brand_id = :brandId
  AND customer_id = :customerId
  AND collector_result_id = ANY(:collectorResultIds);
```

### Data Transformation (After Query)

```typescript
// Count keywords per collector_result_id
const keywordCountsByCollector = new Map<number, number>();

keywordRows.forEach((row) => {
  const collectorResultId = typeof row.collector_result_id === 'number' 
    ? row.collector_result_id 
    : null;
  
  if (collectorResultId !== null) {
    const currentCount = keywordCountsByCollector.get(collectorResultId) || 0;
    keywordCountsByCollector.set(collectorResultId, currentCount + 1);
  }
});
```

### Final Output Structure

```typescript
// Map: collector_result_id → keyword_count
keywordCountsByCollector: Map<number, number>
```

---

## Complete Query Flow

### Step 1: Collect Collector Result IDs

**File**: `prompts-analytics.service.ts` (lines 595-606)

```typescript
// Collect ALL collector_result_ids from ALL responses in ALL prompts
const allCollectorResultIds = Array.from(
  new Set(
    promptAggregates.flatMap((agg) => 
      [
        agg.collectorResultId,
        ...agg.responses.map(r => r.collectorResultId)
      ].filter((id): id is number => id !== null)
    )
  )
);
```

### Step 2: Fetch Brand/Product/Competitor Counts

**File**: `prompts-analytics.service.ts` (lines 766-773)

```typescript
const result = await optimizedMetricsHelper.fetchPromptsAnalytics({
  brandId: brandRow.id,
  customerId,
  startDate: normalizedRange.startIsoBound,
  endDate: normalizedRange.endIsoBound,
  queryIds: allQueryIds.length > 0 ? allQueryIds : undefined,
  collectorResultIds: allCollectorResultIds.length > 0 ? allCollectorResultIds : undefined,
});
```

### Step 3: Fetch Keywords Count

**File**: `prompts-analytics.service.ts` (lines 619-649)

```typescript
// Fetch keywords by query_id and collector_result_id
// Then count per collector_result_id
```

### Step 4: Map Counts to Collectors

**File**: `prompts-analytics.service.ts` (lines 878-947)

```typescript
// Process each row from Query 1
filteredRows.forEach((row: any) => {
  const isBrandRow = !row?.competitor_name || String(row.competitor_name).trim().length === 0;
  const collectorResultId = typeof row?.collector_result_id === 'number' ? row.collector_result_id : null;
  
  if (collectorResultId !== null && isBrandRow) {
    mentionCountsByCollector.set(collectorResultId, {
      brand: row.total_brand_mentions || 0,
      product: row.total_brand_product_mentions || 0,
      competitor: row.competitor_mentions || 0,  // This is competitor_count from Query 1
      keywords: keywordCountsByCollector.get(collectorResultId) || 0
    });
  }
});
```

### Step 5: Attach Counts to Responses

**File**: `prompts-analytics.service.ts` (lines 1153-1177)

```typescript
responses: sortedResponses.map((response) => {
  const collectorId = response.collectorResultId;
  const counts = collectorId !== null ? mentionCountsByCollector.get(collectorId) : undefined;
  const keywordCount = collectorId !== null ? (keywordCountsByCollector.get(collectorId) ?? 0) : 0;
  
  return {
    ...response,
    brandMentions: counts?.brand ?? 0,
    productMentions: counts?.product ?? 0,
    competitorMentions: counts?.competitor ?? 0,
    keywordCount: keywordCount
  };
})
```

---

## Key Points

1. **Query 1 uses nested Supabase joins**: `collector_results → metric_facts → brand_metrics/competitor_metrics`
2. **Query 1 aggregates competitor counts**: Must SUM all `competitor_metrics.competitor_mentions` rows
3. **Query 2 is separate**: Keywords are fetched independently and counted per `collector_result_id`
4. **Date filters are skipped**: When `collectorResultIds` are provided, date filters are NOT applied
5. **LEFT JOINs ensure all IDs returned**: Even if `metric_facts` doesn't exist, `collector_result` is still returned (with NULL counts)

---

## Testing the Queries

### Test Query 1 (Brand/Product/Competitor)

```sql
-- Replace with actual values
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  COALESCE(SUM(cm.competitor_mentions), 0) AS competitor_count,
  COALESCE(SUM(cm.total_competitor_product_mentions), 0) AS competitor_product_count
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
WHERE cr.id IN (123, 456, 789)  -- Your collector_result_ids
  AND cr.brand_id = 'YOUR_BRAND_ID'
GROUP BY cr.id, cr.collector_type, bm.total_brand_mentions, bm.total_brand_product_mentions
ORDER BY cr.id;
```

### Test Query 2 (Keywords)

```sql
-- Replace with actual values
SELECT 
  collector_result_id,
  COUNT(*) AS keyword_count
FROM generated_keywords
WHERE collector_result_id IN (123, 456, 789)  -- Your collector_result_ids
  AND brand_id = 'YOUR_BRAND_ID'
GROUP BY collector_result_id
ORDER BY collector_result_id;
```

---

## Common Issues

1. **Missing `metric_facts` rows**: Query returns NULL counts (expected until scoring runs)
2. **Date filter conflicts**: Fixed - date filters are skipped when `collectorResultIds` provided
3. **Competitor count aggregation**: Must SUM all `competitor_metrics` rows, not just take first
4. **Keywords not counted**: Check if `generated_keywords` table has rows for those `collector_result_id`s

