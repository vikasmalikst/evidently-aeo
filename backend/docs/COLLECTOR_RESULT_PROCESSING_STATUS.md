# Collector Result Processing Status Guide

## Overview

This document explains how to identify which `collector_results` have been processed through the consolidated scoring service and to what extent.

## Processing Steps

The consolidated scoring service processes collector_results in 3 main steps:

1. **Step 1: Consolidated Analysis** → Stores in `consolidated_analysis_cache`
2. **Step 2: Position Extraction** → Stores in `metric_facts`, `brand_metrics`, `competitor_metrics`
3. **Step 3: Sentiment Storage** → Stores in `brand_sentiment`, `competitor_sentiment`

## Processing Status Categories

### 1. **Fully Processed** ✅
- Has analysis (Step 1)
- Has positions (Step 2)
- Has sentiment (Step 3)

### 2. **Partially Processed** ⚠️
- **Analysis Only**: Has Step 1, missing Steps 2 & 3
- **Positions Only**: Has Steps 1 & 2, missing Step 3
- **Analysis + Positions**: Has Steps 1 & 2, missing Step 3

### 3. **Not Processed** ❌
- No analysis cache entry
- No metric_facts entry
- No sentiment entries

## Database Tables for Status Checking

### Step 1: Analysis Cache
**Table**: `consolidated_analysis_cache`
- `collector_result_id` (PK) - References `collector_results.id`
- `products` (JSONB) - Extracted products
- `sentiment` (JSONB) - Sentiment analysis
- `llm_provider` (text) - 'ollama' or 'openrouter'
- `created_at`, `updated_at` - Timestamps

### Step 2: Positions
**Tables**: 
- `metric_facts` - Core reference (one row per collector_result)
- `brand_metrics` - Brand position metrics
- `competitor_metrics` - Competitor position metrics

**Key Fields**:
- `metric_facts.collector_result_id` - Links to collector_result
- `metric_facts.id` - Used as foreign key in other tables

### Step 3: Sentiment
**Tables**:
- `brand_sentiment` - Brand sentiment (one row per metric_fact)
- `competitor_sentiment` - Competitor sentiment (multiple rows per metric_fact)

**Key Fields**:
- `brand_sentiment.metric_fact_id` - Links to metric_facts
- `competitor_sentiment.metric_fact_id` - Links to metric_facts

## SQL Queries to Check Status

### Query 1: Fully Processed Collector Results

```sql
-- Get all collector_results that are fully processed (all 3 steps)
SELECT 
  cr.id AS collector_result_id,
  cr.brand_id,
  cr.customer_id,
  cr.created_at AS collector_result_created_at,
  cac.created_at AS analysis_created_at,
  cac.llm_provider,
  mf.id AS metric_fact_id,
  mf.processed_at AS positions_processed_at,
  bs.sentiment_score AS brand_sentiment_score,
  bs.sentiment_label AS brand_sentiment_label
FROM collector_results cr
INNER JOIN consolidated_analysis_cache cac ON cr.id = cac.collector_result_id
INNER JOIN metric_facts mf ON cr.id = mf.collector_result_id
INNER JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE cr.brand_id = 'YOUR_BRAND_ID'  -- Optional filter
ORDER BY cr.created_at DESC;
```

### Query 2: Partially Processed - Analysis Only (Missing Positions & Sentiment)

```sql
-- Collector_results with analysis but no positions
SELECT 
  cr.id AS collector_result_id,
  cr.brand_id,
  cr.customer_id,
  cac.created_at AS analysis_created_at,
  cac.llm_provider
FROM collector_results cr
INNER JOIN consolidated_analysis_cache cac ON cr.id = cac.collector_result_id
LEFT JOIN metric_facts mf ON cr.id = mf.collector_result_id
WHERE mf.id IS NULL  -- No positions yet
  AND cr.brand_id = 'YOUR_BRAND_ID'  -- Optional filter
ORDER BY cr.created_at DESC;
```

### Query 3: Partially Processed - Positions Only (Missing Sentiment)

```sql
-- Collector_results with positions but no sentiment
SELECT 
  cr.id AS collector_result_id,
  cr.brand_id,
  cr.customer_id,
  mf.id AS metric_fact_id,
  mf.processed_at AS positions_processed_at
FROM collector_results cr
INNER JOIN metric_facts mf ON cr.id = mf.collector_result_id
LEFT JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE bs.metric_fact_id IS NULL  -- No sentiment yet
  AND cr.brand_id = 'YOUR_BRAND_ID'  -- Optional filter
ORDER BY cr.created_at DESC;
```

### Query 4: Not Processed at All

```sql
-- Collector_results with no processing at all
SELECT 
  cr.id AS collector_result_id,
  cr.brand_id,
  cr.customer_id,
  cr.created_at,
  cr.raw_answer IS NOT NULL AS has_raw_answer
FROM collector_results cr
LEFT JOIN consolidated_analysis_cache cac ON cr.id = cac.collector_result_id
LEFT JOIN metric_facts mf ON cr.id = mf.collector_result_id
WHERE cac.collector_result_id IS NULL  -- No analysis
  AND mf.id IS NULL  -- No positions
  AND cr.brand_id = 'YOUR_BRAND_ID'  -- Optional filter
  AND cr.raw_answer IS NOT NULL  -- Has data to process
ORDER BY cr.created_at DESC;
```

### Query 5: Complete Status Summary

```sql
-- Comprehensive status check for all collector_results
SELECT 
  cr.id AS collector_result_id,
  cr.brand_id,
  cr.customer_id,
  cr.created_at,
  CASE 
    WHEN cac.collector_result_id IS NOT NULL AND mf.id IS NOT NULL AND bs.metric_fact_id IS NOT NULL 
      THEN 'FULLY_PROCESSED'
    WHEN cac.collector_result_id IS NOT NULL AND mf.id IS NOT NULL AND bs.metric_fact_id IS NULL 
      THEN 'POSITIONS_ONLY'
    WHEN cac.collector_result_id IS NOT NULL AND mf.id IS NULL 
      THEN 'ANALYSIS_ONLY'
    ELSE 'NOT_PROCESSED'
  END AS processing_status,
  cac.llm_provider,
  cac.created_at AS analysis_created_at,
  mf.processed_at AS positions_processed_at,
  bs.sentiment_score AS brand_sentiment_score
FROM collector_results cr
LEFT JOIN consolidated_analysis_cache cac ON cr.id = cac.collector_result_id
LEFT JOIN metric_facts mf ON cr.id = mf.collector_result_id
LEFT JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE cr.brand_id = 'YOUR_BRAND_ID'  -- Optional filter
ORDER BY cr.created_at DESC;
```

### Query 6: Count by Status

```sql
-- Count collector_results by processing status
SELECT 
  CASE 
    WHEN cac.collector_result_id IS NOT NULL AND mf.id IS NOT NULL AND bs.metric_fact_id IS NOT NULL 
      THEN 'FULLY_PROCESSED'
    WHEN cac.collector_result_id IS NOT NULL AND mf.id IS NOT NULL AND bs.metric_fact_id IS NULL 
      THEN 'POSITIONS_ONLY'
    WHEN cac.collector_result_id IS NOT NULL AND mf.id IS NULL 
      THEN 'ANALYSIS_ONLY'
    ELSE 'NOT_PROCESSED'
  END AS processing_status,
  COUNT(*) AS count
FROM collector_results cr
LEFT JOIN consolidated_analysis_cache cac ON cr.id = cac.collector_result_id
LEFT JOIN metric_facts mf ON cr.id = mf.collector_result_id
LEFT JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE cr.brand_id = 'YOUR_BRAND_ID'  -- Optional filter
GROUP BY processing_status
ORDER BY count DESC;
```

## Code Patterns for Status Checking

### Pattern 1: Check if Fully Processed (from consolidated-scoring.service.ts)

```typescript
// This is how the service checks for fully processed results
const { data: metricFacts } = await supabase
  .from('metric_facts')
  .select('collector_result_id, id')
  .in('collector_result_id', collectorResultIds)
  .eq('brand_id', brandId);

const metricFactIds = metricFacts.map(mf => mf.id);
const { data: brandSentiment } = await supabase
  .from('brand_sentiment')
  .select('metric_fact_id')
  .in('metric_fact_id', metricFactIds)
  .not('sentiment_score', 'is', null);

const metricFactIdsWithSentiment = new Set(
  brandSentiment?.map(bs => bs.metric_fact_id) || []
);

// Fully processed = has metric_fact AND has sentiment
const fullyProcessed = metricFacts
  .filter(mf => metricFactIdsWithSentiment.has(mf.id))
  .map(mf => mf.collector_result_id);
```

### Pattern 2: Check if Has Positions (from position-extraction.service.ts)

```typescript
// Check if collector_result already has positions
const { data, error } = await supabase
  .from('metric_facts')
  .select('id')
  .eq('collector_result_id', collectorResultId)
  .limit(1)
  .maybeSingle();

const hasPositions = !!data;
```

### Pattern 3: Check if Has Analysis Cache

```typescript
// Check if analysis is cached
const { data, error } = await supabase
  .from('consolidated_analysis_cache')
  .select('products, sentiment')
  .eq('collector_result_id', collectorResultId)
  .maybeSingle();

const hasAnalysis = !!data;
```

## Helper Function Example

Here's a complete helper function you can use:

```typescript
interface ProcessingStatus {
  collectorResultId: number;
  status: 'FULLY_PROCESSED' | 'POSITIONS_ONLY' | 'ANALYSIS_ONLY' | 'NOT_PROCESSED';
  hasAnalysis: boolean;
  hasPositions: boolean;
  hasSentiment: boolean;
  analysisCreatedAt?: string;
  positionsProcessedAt?: string;
  metricFactId?: number;
}

async function getProcessingStatus(
  collectorResultIds: number[],
  supabase: SupabaseClient
): Promise<ProcessingStatus[]> {
  // Fetch all related data in parallel
  const [analysisCache, metricFacts, brandSentiment] = await Promise.all([
    supabase
      .from('consolidated_analysis_cache')
      .select('collector_result_id, created_at')
      .in('collector_result_id', collectorResultIds),
    supabase
      .from('metric_facts')
      .select('id, collector_result_id, processed_at')
      .in('collector_result_id', collectorResultIds),
    supabase
      .from('brand_sentiment')
      .select('metric_fact_id')
      .in('metric_fact_id', 
        // Get metric_fact_ids from metricFacts
        metricFacts.data?.map(mf => mf.id) || []
      )
  ]);

  // Create maps for quick lookup
  const analysisMap = new Map(
    analysisCache.data?.map(ac => [ac.collector_result_id, ac]) || []
  );
  const positionsMap = new Map(
    metricFacts.data?.map(mf => [mf.collector_result_id, mf]) || []
  );
  const sentimentMetricFactIds = new Set(
    brandSentiment.data?.map(bs => bs.metric_fact_id) || []
  );

  // Build status for each collector_result
  return collectorResultIds.map(id => {
    const analysis = analysisMap.get(id);
    const positions = positionsMap.get(id);
    const hasSentiment = positions && sentimentMetricFactIds.has(positions.id);

    let status: ProcessingStatus['status'];
    if (analysis && positions && hasSentiment) {
      status = 'FULLY_PROCESSED';
    } else if (analysis && positions) {
      status = 'POSITIONS_ONLY';
    } else if (analysis) {
      status = 'ANALYSIS_ONLY';
    } else {
      status = 'NOT_PROCESSED';
    }

    return {
      collectorResultId: id,
      status,
      hasAnalysis: !!analysis,
      hasPositions: !!positions,
      hasSentiment: !!hasSentiment,
      analysisCreatedAt: analysis?.created_at,
      positionsProcessedAt: positions?.processed_at,
      metricFactId: positions?.id,
    };
  });
}
```

## Notes

1. **Citations**: Citations are stored separately in the `citations` table and are part of Step 1, but checking them is optional for status determination.

2. **Legacy Schema**: If `USE_OPTIMIZED_POSITION_CHECK=false`, the system may check `extracted_positions` table instead of `metric_facts`. The queries above use the optimized schema.

3. **Error Handling**: Some collector_results may have partial data due to errors. The status queries above will still categorize them correctly.

4. **Performance**: For large datasets, consider adding indexes on:
   - `metric_facts.collector_result_id`
   - `brand_sentiment.metric_fact_id`
   - `consolidated_analysis_cache.collector_result_id`

## Related Code Locations

- **Status Checking Logic**: `backend/src/services/scoring/consolidated-scoring.service.ts` (lines 438-527)
- **Position Existence Check**: `backend/src/services/scoring/position-extraction.service.ts` (lines 222-261)
- **Analysis Cache Check**: `backend/src/services/scoring/consolidated-scoring.service.ts` (lines 55-82)


