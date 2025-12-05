# Topics Page LLM Filter Fix

## Problem
The LLM filter on the Topics Analysis page was not working properly. When users selected a specific LLM model (e.g., ChatGPT, Claude, Gemini), the data was not being filtered correctly, showing data from all LLM models instead of just the selected one.

## Root Cause
The backend service `getBrandTopicsWithAnalytics` in `brand.service.ts` had a bug where the `collector_type` filter was being applied inconsistently:

### Issue 1: Filtered Collector Results Path (lines 1416-1437)
When `collector_results` were already filtered by `collector_type`, the code created a new query for `extracted_positions` that **did not include the `collector_type` filter**:

```typescript
// BEFORE (BUGGY CODE)
if (collectorResults.length > 0) {
  const collectorResultIds = collectorResults.map(cr => cr.id);
  // Comment said: "we don't need to filter positions by collector_type again"
  // BUT THIS WAS WRONG!
  let positionsQueryFiltered = supabaseAdmin
    .from('extracted_positions')
    .select('...')
    .in('collector_result_id', collectorResultIds);
  // Missing: .eq('collector_type', mappedCollectorType)
}
```

The incorrect assumption was that filtering `collector_results` would automatically filter `extracted_positions`. However, both tables have their own `collector_type` columns and need to be filtered independently.

### Issue 2: Citations Not Filtered by LLM Model
The `getTopSourcesPerTopic` method was fetching ALL citations for a brand, not just those from the selected LLM model. This meant citation sources were not filtered by the selected LLM.

## Solution

### Fix 1: Add collector_type Filter to extracted_positions Query
Added the `collector_type` filter to the `extracted_positions` query when using filtered collector results:

```typescript
// AFTER (FIXED CODE)
if (collectorResults.length > 0) {
  const collectorResultIds = collectorResults.map(cr => cr.id);
  let positionsQueryFiltered = supabaseAdmin
    .from('extracted_positions')
    .select('...')
    .in('collector_result_id', collectorResultIds);
  
  // IMPORTANT: Also filter by collector_type if provided
  // Both collector_results AND extracted_positions tables have collector_type column
  // We need to filter both to ensure all data is properly filtered by LLM model
  if (mappedCollectorType) {
    positionsQueryFiltered = positionsQueryFiltered.eq('collector_type', mappedCollectorType);
  }
}
```

### Fix 2: Pass Filtered Positions to Citations Query
Updated `getTopSourcesPerTopic` to:
1. Accept pre-filtered positions as a parameter
2. Extract `collector_result_ids` from these filtered positions
3. Fetch only citations that match these filtered collector_result_ids

```typescript
// Method signature updated to accept filtered positions
private async getTopSourcesPerTopic(
  brandId: string,
  customerId: string,
  topicMap: Map<string, any>,
  startIso: string,
  endIso: string,
  positions: any[] // Pre-filtered positions (already filtered by collector_type)
)

// Citations query now filters by collector_result_ids from filtered positions
const collectorResultIds = Array.from(new Set(
  positions.map(p => p.collector_result_id).filter((id): id is number => typeof id === 'number')
));

const { data: citations } = await supabaseAdmin
  .from('citations')
  .select('...')
  .in('collector_result_id', collectorResultIds); // Only citations from filtered results
```

## Impact
✅ **Topics data** is now correctly filtered by the selected LLM model  
✅ **Citations/sources** are now correctly filtered by the selected LLM model  
✅ **Analytics metrics** (SOA, visibility, sentiment) now reflect only the selected LLM  
✅ **Date range filters** continue to work as expected  

## Testing Recommendations
1. Open the Topics Analysis page
2. Select a specific LLM model from the dropdown (e.g., "ChatGPT")
3. Verify that:
   - Topic data updates and shows only results from ChatGPT
   - Citation sources reflect only ChatGPT citations
   - Metrics (Share of Answer, etc.) are recalculated for ChatGPT only
4. Switch to a different model (e.g., "Claude") and verify data updates correctly
5. Select "All Models" and verify all data is shown again

## Files Modified
- `/backend/src/services/brand.service.ts`
  - Fixed `getBrandTopicsWithAnalytics` method (lines ~1416-1437)
  - Updated `getTopSourcesPerTopic` method signature and implementation (lines ~1644-1651, ~1884-1923)

## Technical Notes
Both `collector_results` and `extracted_positions` tables have independent `collector_type` columns. When filtering by LLM model, **both tables must be filtered** to ensure data consistency. The previous code incorrectly assumed that filtering one table would automatically filter the other.






