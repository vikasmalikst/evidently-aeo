# Optimized Query Helpers

## Overview

This directory contains reusable query helpers for fetching metrics from the new optimized schema. These helpers provide consistent, performant patterns for all services migrating away from the compatibility view.

## Files

- `optimized-metrics.helper.ts` - Main helper class with query methods
- `__tests__/optimized-metrics.test.ts` - Test suite

## Schema Structure

The helpers query the new optimized schema:

```
metric_facts (core reference)
├── brand_metrics (brand visibility/presence)
├── competitor_metrics (competitor visibility)
├── brand_sentiment (brand sentiment)
└── competitor_sentiment (competitor sentiment)
```

## Usage

### Import

```typescript
import { optimizedMetricsHelper } from './services/query-helpers/optimized-metrics.helper';
// or
import { OptimizedMetricsHelper } from './services/query-helpers/optimized-metrics.helper';
```

### Fetch Brand Metrics

```typescript
const result = await optimizedMetricsHelper.fetchBrandMetrics({
  collectorResultIds: [123, 456, 789],
  includeSentiment: true,
});

if (result.success) {
  result.data.forEach(row => {
    console.log(row.visibility_index);
    console.log(row.share_of_answers);
    console.log(row.sentiment_score);
  });
}
```

### Fetch Competitor Metrics

```typescript
const result = await optimizedMetricsHelper.fetchCompetitorMetrics({
  collectorResultIds: [123, 456, 789],
  brandId: 'brand-uuid',
  includeSentiment: true,
});

if (result.success) {
  result.data.forEach(row => {
    console.log(row.competitor_name);
    console.log(row.visibility_index);
    console.log(row.share_of_answers);
  });
}
```

### Fetch Combined (Brand + Competitors)

```typescript
const result = await optimizedMetricsHelper.fetchCombinedMetrics({
  collectorResultIds: [123, 456, 789],
  includeSentiment: true,
});

if (result.success) {
  console.log('Brand rows:', result.data.brand.length);
  console.log('Competitor rows:', result.data.competitors.length);
}
```

### Get Distinct Collector Types (for filters)

```typescript
const collectorTypes = await optimizedMetricsHelper.getDistinctCollectorTypes(
  brandId,
  customerId,
  startDate,
  endDate
);

// Returns: ['ChatGPT', 'Claude', 'Gemini', ...]
```

### Fetch By Date Range

```typescript
const result = await optimizedMetricsHelper.fetchBrandMetricsByDateRange({
  brandId: 'brand-uuid',
  customerId: 'customer-uuid',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  collectorTypes: ['ChatGPT', 'Claude'],  // optional filter
  topics: ['pricing', 'features'],         // optional filter
  includeSentiment: true,
});
```

## Performance

All methods include `duration_ms` in the result for performance monitoring:

```typescript
const result = await optimizedMetricsHelper.fetchBrandMetrics({...});
console.log(`Query took ${result.duration_ms}ms`);
```

Expected performance (vs. compatibility view):
- Small queries (< 10 IDs): 5-10x faster
- Medium queries (10-100 IDs): 10-20x faster
- Large queries (> 100 IDs): 20-50x faster

## Testing

Run tests:

```bash
npm test query-helpers
```

Tests validate:
- ✅ Query correctness (returns expected data structure)
- ✅ Performance (faster than compatibility view)
- ✅ Data accuracy (matches compatibility view results)

## Migration Guide

### Before (using compatibility view):

```typescript
const { data: positions } = await supabase
  .from('extracted_positions_compat')
  .select('*')
  .in('collector_result_id', collectorResultIds)
  .is('competitor_name', null);
```

### After (using optimized helper):

```typescript
const result = await optimizedMetricsHelper.fetchBrandMetrics({
  collectorResultIds,
  includeSentiment: true,
});

const positions = result.data;  // Same structure, but optimized query
```

## Error Handling

All methods return a result object with `success` flag:

```typescript
const result = await optimizedMetricsHelper.fetchBrandMetrics({...});

if (!result.success) {
  console.error('Query failed:', result.error);
  // Handle error
} else {
  // Use result.data
}
```

## TypeScript Types

All types are defined in `backend/src/types/optimized-metrics.types.ts`:

- `BrandMetricsRow` - Brand metrics data
- `CompetitorMetricsRow` - Competitor metrics data
- `CombinedMetricsResult` - Brand + competitors
- `FetchMetricsOptions` - Query options
- `FetchBrandMetricsResult` - Query result

## Feature Flags

When migrating services, use feature flags for gradual rollout:

```typescript
const USE_OPTIMIZED_QUERIES = process.env.USE_OPTIMIZED_TOPICS === 'true';

if (USE_OPTIMIZED_QUERIES) {
  // New optimized query
  const result = await optimizedMetricsHelper.fetchBrandMetrics({...});
} else {
  // Old query via compatibility view
  const { data } = await supabase.from('extracted_positions_compat')...;
}
```

## Questions?

See: `/documentation/Key_docs/OPTIMIZED_QUERY_MIGRATION_PLAN.md`

