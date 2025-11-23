# Performance Analysis & Optimization Plan for /prompts and /search-visibility

## Identified Performance Issues

### /prompts Page Issues:

1. **Cascading Effect Loop** (CRITICAL):
   - Data loads → sets `llmOptions` → sets `selectedLLM` → changes `endpoint` → triggers new fetch
   - This creates an infinite loop causing multiple unnecessary API calls
   - Location: Lines 124-133, 79-93 in Prompts.tsx

2. **Heavy Synchronous Processing**:
   - Topics filtering happens in useMemo but still blocks render
   - No progressive rendering - everything waits for full data

3. **Multiple Re-renders**:
   - PromptsList component re-renders on every state change
   - No React.memo optimization

4. **Endpoint Re-computation**:
   - Endpoint changes when selectedLLM changes, even if data is the same

### /search-visibility Page Issues:

1. **Heavy useEffect Processing** (CRITICAL):
   - Lines 178-336: Massive synchronous data transformation in useEffect
   - Processes all LLM models, competitors, brand summary synchronously
   - Blocks render until all processing is complete

2. **Multiple State Updates**:
   - `setBrandModels` and `setCompetitorModels` cause separate re-renders
   - Should be batched into single update

3. **Complex Data Transformations**:
   - Brand summary calculation, topic aggregation all synchronous
   - No progressive rendering

4. **Chart Re-renders**:
   - Chart data depends on `currentModels` which changes frequently
   - Chart re-renders on every model update

5. **No Component Memoization**:
   - VisibilityChart, VisibilityTable not memoized
   - Re-render unnecessarily

## Optimization Strategy

### 1. Fix Cascading Effect in Prompts
- Don't change endpoint when selectedLLM is set from API response
- Only change endpoint on user interaction
- Use ref to track if LLM was set programmatically vs user action

### 2. Move Heavy Processing to useMemo
- Convert useEffect data processing to useMemo
- Process data incrementally
- Show partial data while processing

### 3. Batch State Updates
- Use single state update for related data
- Use React.startTransition for non-urgent updates

### 4. Add React.memo
- Memoize PromptsList, VisibilityChart, VisibilityTable
- Prevent unnecessary re-renders

### 5. Defer Non-Critical Rendering
- Use requestIdleCallback for chart rendering
- Lazy load expanded rows in tables

### 6. Add Performance Logging
- Log cache hit/miss times
- Log data processing times
- Log render times
- Log API fetch times

## Implementation Plan

1. Add performance logging utilities
2. Fix Prompts cascading effect
3. Optimize SearchVisibility data processing
4. Add React.memo to components
5. Batch state updates
6. Add progressive rendering

