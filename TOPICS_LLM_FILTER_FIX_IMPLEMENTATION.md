# Topics LLM Filter Fix Implementation

## Issue
The Topics page was not filtering data properly when selecting LLM models from the dropdown. Users would see "No topics found for selected filters" even when selecting specific models like "google aio", "gemini", or "perplexity".

Additionally, the date filter was syncing with the backend unnecessarily.

## Changes Made

### File: `src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx`

**Problem:**
1. The `useEffect` that handled filter changes was comparing multiple filter values (date, model, period type) against initial values
2. Date filter changes were triggering backend requests unnecessarily
3. The complex logic was preventing the LLM model filter from working properly

**Solution:**
1. **Removed date filter sync**: Date selection now only affects the UI display, not backend data fetching
2. **Simplified LLM filter logic**: Only the `selectedModel` state change triggers backend filter updates
3. **Cleaner initial state tracking**: Simplified from tracking 3 values to just tracking the initial LLM model selection

### Key Changes:

#### Before:
```typescript
// Tracked date, model, and period type
const initialValuesRef = useRef<{
  selectedModel: string;
  selectedDate: number;
  datePeriodType: 'daily' | 'weekly' | 'monthly';
} | null>(null);

// Complex change detection
const hasChanged = 
  initial.selectedModel !== selectedModel ||
  initial.selectedDate !== selectedDate.getTime() ||
  initial.datePeriodType !== datePeriodType;

// Sent both date range and model filters
const newFilters = {
  startDate: start.toISOString().split('T')[0],
  endDate: end.toISOString().split('T')[0],
  collectorType: selectedModel && selectedModel !== '' ? selectedModel : undefined
};
```

#### After:
```typescript
// Only track initial LLM model
const initialModelRef = useRef<string | null>(null);

// Simple change detection
const hasChanged = initialModelRef.current !== selectedModel;

// Only send LLM model filter
const newFilters = {
  collectorType: selectedModel && selectedModel !== '' ? selectedModel : undefined
};
```

## Benefits

1. **LLM filtering works correctly**: When users select a specific LLM model, the backend now receives only the `collectorType` filter and returns the appropriate data
2. **No date filter interference**: Date selection is purely for UI display purposes and doesn't cause unnecessary backend requests
3. **Simpler logic**: Easier to maintain and debug
4. **Better performance**: Fewer backend requests since date changes don't trigger refetches

## Testing

To verify the fix:

1. Navigate to the Topics page (`/topics`)
2. Select a specific LLM model from the "All Models" dropdown (e.g., "google aio")
3. Verify that:
   - Data is filtered to show only topics for that LLM model
   - The page displays the filtered results correctly
   - No "No topics found for selected filters" error appears (unless there truly is no data for that model)
4. Select "All Models" to verify all topics are shown again
5. Change the date range and verify it updates the UI display but doesn't trigger a backend request

## Related Files

- `/Users/avayasharma/evidently/src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx` - Main component with filter logic
- `/Users/avayasharma/evidently/src/pages/Topics.tsx` - Parent component that handles data fetching
- `/Users/avayasharma/evidently/backend/src/services/brand.service.ts` - Backend service that processes the filters

## Date: November 29, 2025


