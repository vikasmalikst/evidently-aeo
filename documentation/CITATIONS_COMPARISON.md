# Citations/Sources Fetching: Old vs New Recommendation Services

## Key Difference: Table Name

### OLD (`recommendation.service.ts`)
```typescript
const { data: citations } = await supabaseAdmin
  .from('extracted_citations')  // ❌ This table doesn't exist!
  .select('domain, collector_result_id')
  .eq('brand_id', brandId)
  .gte('created_at', currentStartDate);
  // ❌ Missing: .eq('customer_id', customerId)
  // ❌ Missing: .lte('created_at', currentEndDate)
  // ❌ Missing: .limit()
```

### NEW (`recommendation-v3.service.ts`)
```typescript
const { data: citations } = await supabaseAdmin
  .from('citations')  // ✅ Correct table name
  .select('domain, collector_result_id, usage_count')
  .eq('brand_id', brandId)
  .eq('customer_id', customerId)  // ✅ Added customer filter
  .gte('created_at', currentStartDate)
  .lte('created_at', currentEndDate)  // ✅ Added end date
  .limit(10000);  // ✅ Added limit for performance
```

## Detailed Comparison

### 1. **Table Name**
- **OLD**: `extracted_citations` (doesn't exist in your database)
- **NEW**: `citations` (correct table)

**Impact**: The old service might have been failing silently or working with empty data, while the new one correctly queries the `citations` table.

### 2. **Customer ID Filter**
- **OLD**: ❌ No `customer_id` filter
- **NEW**: ✅ Has `customer_id` filter

**Impact**: The old service might have been returning citations from all customers, while the new one correctly filters by customer.

### 3. **Date Range**
- **OLD**: Only `gte('created_at', currentStartDate)` (start date only)
- **NEW**: Both `gte()` and `lte()` (proper date range)

**Impact**: The old service might have been getting citations from all future dates (if any), while the new one correctly limits to the 30-day window.

### 4. **Usage Count**
- **OLD**: ❌ Doesn't fetch `usage_count`, always counts as 1
- **NEW**: ✅ Fetches `usage_count` and uses it

**Impact**: The old service undercounted citations if `usage_count > 1`.

### 5. **Query Optimization**
- **OLD**: Queries `extracted_positions` **once per domain** (N queries for N domains)
  ```typescript
  for (const [domain, sourceData] of sourceMap.entries()) {
    const { data: sourcePositions } = await supabaseAdmin
      .from('extracted_positions')
      .select('...')
      .in('collector_result_id', collectorIds.slice(0, 100));
    // Process positions...
  }
  ```

- **NEW**: Batches all `collector_result_ids` and queries in batches (much faster)
  ```typescript
  // Collect all IDs first
  const allCollectorIds = Array.from(new Set(...));
  
  // Batch query all positions
  for (let i = 0; i < allCollectorIds.length; i += batchSize) {
    const batch = allCollectorIds.slice(i, i + batchSize);
    const { data: batchPositions } = await supabaseAdmin
      .from('extracted_positions')
      .select('...')
      .in('collector_result_id', batch);
    // Store in map for fast lookup
  }
  
  // Then process each domain using pre-fetched data
  for (const [domain, sourceData] of sourceMap.entries()) {
    // Use pre-fetched positions from map
  }
  ```

**Impact**: The new approach is much faster for large datasets (1-2 queries vs N queries).

### 6. **Data Type for collector_result_id**
- **OLD**: Uses `Set<string>` (treats IDs as strings)
- **NEW**: Uses `Set<number>` (treats IDs as numbers, which is correct)

**Impact**: Type mismatch could cause issues, though JavaScript is usually forgiving.

### 7. **Sorting**
- **OLD**: Sorts by `citations` count (most cited first)
- **NEW**: Sorts by `impactScore` (highest impact first)

**Impact**: Different ordering, but both are valid approaches.

### 8. **Limit**
- **OLD**: No limit on citations query
- **NEW**: `.limit(10000)` to prevent timeout

**Impact**: The old service could timeout with very large datasets.

## Why the Old Service Might Have "Worked"

1. **Silent Failures**: If `extracted_citations` table doesn't exist, Supabase might return an empty array `[]` instead of throwing an error, so the code would continue with empty source metrics.

2. **No Customer Filter**: If there was only one customer or the data wasn't properly isolated, it might have appeared to work.

3. **Fallback Behavior**: The LLM might have generated recommendations even without source data (using generic sources).

## Why the New Service Might Be Failing

1. **Correct Table**: Now using `citations` table, which might have different data structure or be empty for this brand.

2. **Customer Filter**: Now filtering by `customer_id`, which might exclude data if the filter is incorrect.

3. **Date Range**: Now using proper date range, which might exclude data if dates are wrong.

4. **Performance**: Even with optimizations, if there are millions of citations, it might still be slow.

## Recommendations

1. **Check if `extracted_citations` table exists**:
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'extracted_citations';
   ```

2. **Check citations data**:
   ```sql
   SELECT COUNT(*) FROM citations 
   WHERE brand_id = '5a57c430-6940-4198-a1f5-a443cbd044dc'
   AND customer_id = '<your-customer-id>'
   AND created_at >= CURRENT_DATE - INTERVAL '30 days';
   ```

3. **Compare data between old and new approach**:
   - Check if old service was actually getting data or just silently failing
   - Verify customer_id is correct in new service
   - Check date ranges match

4. **Temporary workaround**: If you need to match the old behavior exactly, you could:
   - Remove `customer_id` filter temporarily
   - Remove date end filter
   - Check if `extracted_citations` table exists and use it if it does

