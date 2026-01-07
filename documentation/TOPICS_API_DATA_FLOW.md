# Topics API Data Flow Analysis

## Current Configuration

**Feature Flag:** `USE_OPTIMIZED_TOPICS_QUERY=true` (in `backend/.env`)

## Data Flow Path

### 1. API Endpoint
- **Route:** `GET /brands/:id/topics`
- **File:** `backend/src/routes/brand.routes.ts` (line 553)
- **Handler:** Calls `brandService.getBrandTopicsWithAnalytics()`

### 2. Service Method
- **File:** `backend/src/services/brand.service.ts`
- **Method:** `getBrandTopicsWithAnalytics()` (line 1478)

### 3. Query Path (Based on Feature Flag)

#### ✅ OPTIMIZED PATH (Current - `USE_OPTIMIZED_TOPICS_QUERY=true`)

**Tables Queried:**
1. `generated_queries` - Gets topic names from queries (optional fallback)
2. `collector_results` - Gets collector result IDs (optional)
3. **`metric_facts`** - Main table (NEW SCHEMA)
   - Joins with `brand_metrics!inner` (REQUIRED - inner join)
   - Joins with `brand_sentiment` (optional)
   - Filters by: `brand_id`, `customer_id`, `processed_at` (date range), `collector_type`

**Query Location:** `backend/src/services/query-helpers/optimized-metrics.helper.ts`
- **Method:** `fetchTopicPositions()` (line 925)
- **Query:** Lines 951-987

**Key Issue:** Uses `!inner` join with `brand_metrics`, which means:
- If `brand_metrics` table is empty or not populated, NO data will be returned
- Even if `metric_facts` has data, it will be filtered out if there's no matching `brand_metrics` row

#### ❌ LEGACY PATH (Fallback - `USE_OPTIMIZED_TOPICS_QUERY=false`)

**Tables Queried:**
1. `generated_queries` - Gets topic names from queries
2. `collector_results` - Gets collector result IDs
3. **`extracted_positions`** - Main table (OLD SCHEMA)
   - Direct query on old table
   - Filters by: `brand_id`, `customer_id`, `processed_at`, `collector_type`

**Query Location:** `backend/src/services/brand.service.ts`
- **Lines:** 1726-1796

## Potential Issues

### Issue 1: Inner Join Filtering Out Data
The optimized query uses:
```sql
brand_metrics!inner(...)
```

This means if `brand_metrics` is not populated for rows in `metric_facts`, those rows will be excluded.

### Issue 2: Topic Column May Be Null
Even if positions are returned, positions without topics are filtered out:
- **Location:** `backend/src/services/brand.service.ts` (lines 1851-1855)
- **Logic:** Skips positions where `topic` is null or empty

### Issue 3: Date Range
The query filters by `processed_at` between `startDate` and `endDate`. If the date range is in the future or doesn't match when data was collected, no results will be returned.

## How to Debug

1. **Check which path is being used:**
   - Look for log: `⚡ [Topics] Using optimized query` or `📋 [Topics] Using legacy query`
   - Check `backend/.env` for `USE_OPTIMIZED_TOPICS_QUERY`

2. **Check if data exists:**
   ```sql
   -- Check metric_facts
   SELECT COUNT(*) FROM metric_facts WHERE brand_id = 'your-brand-id';
   
   -- Check brand_metrics
   SELECT COUNT(*) FROM brand_metrics bm
   JOIN metric_facts mf ON bm.metric_fact_id = mf.id
   WHERE mf.brand_id = 'your-brand-id';
   
   -- Check if topics are populated
   SELECT COUNT(*) FROM metric_facts 
   WHERE brand_id = 'your-brand-id' AND topic IS NOT NULL;
   ```

3. **Check the logs:**
   - Backend should log: `📊 Found X positions`
   - Backend should log: `- Positions with topics: X`
   - Backend should log: `- Positions without topics: X`

## Recommendations

1. **If using optimized path:** Ensure `brand_metrics` is populated for all `metric_facts` rows
2. **If data exists but topics are null:** Check why topics aren't being populated in `metric_facts.topic`
3. **If no data at all:** Check if data exists in `metric_facts` for the brand/date range
4. **Consider fallback:** Temporarily set `USE_OPTIMIZED_TOPICS_QUERY=false` to use legacy `extracted_positions` table if it still has data

