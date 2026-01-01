# Performance Optimization Plan for /prompts and /search-visibility Pages

## Analysis Summary

After analyzing both pages, I've identified critical performance bottlenecks and implemented fixes with comprehensive logging.

## Critical Issues Identified & Fixed

### Issue 1: Prompts Page - Cascading Effect Loop ⚠️ CRITICAL
**Root Cause**: 
- Data loads → `llmOptions` set → `selectedLLM` set → endpoint changes → new fetch triggered
- This creates an infinite loop of API calls

**Impact**: Multiple unnecessary API calls, delayed rendering, poor UX

**Fix Applied**:
- Added `isLLMSetProgrammatically` ref to distinguish user actions from API responses
- Endpoint only includes `selectedLLM` filter when set by user, not from API response
- Prevents cascading re-fetches

**Files Modified**: `src/pages/Prompts.tsx`

### Issue 2: SearchVisibility Page - Heavy Synchronous Processing ⚠️ CRITICAL
**Root Cause**:
- Massive useEffect (158 lines) processes all data synchronously
- Blocks render until all processing completes
- Multiple state updates cause multiple re-renders

**Impact**: Long blocking time, delayed initial render, janky UI

**Fix Applied**:
- Moved data processing from useEffect to useMemo
- Batched state updates (single update instead of two)
- Processing now happens during render, not blocking

**Files Modified**: `src/pages/SearchVisibility.tsx`

### Issue 3: Unnecessary Component Re-renders
**Root Cause**:
- Components re-render on every parent state change
- No memoization on expensive components

**Impact**: Unnecessary work, slower interactions

**Fix Applied**:
- Added React.memo to PromptsList, VisibilityChart, VisibilityTable
- Prevents re-renders when props haven't changed

**Files Modified**:
- `src/components/Prompts/PromptsList.tsx`
- `src/components/Visibility/VisibilityChart.tsx`
- `src/components/Visibility/VisibilityTable.tsx`

## Performance Logging Added

All pages now log performance metrics to console:
- `[PERF] Prompts: Endpoint computation: XXms`
- `[PERF] Prompts: Data fetch complete: XXms`
- `[PERF] Prompts: Topics processing: XXms`
- `[PERF] Prompts: Page fully rendered: XXms`
- `[PERF] SearchVisibility: Endpoint computation: XXms`
- `[PERF] SearchVisibility: Data fetch complete: XXms`
- `[PERF] SearchVisibility: Data processing: XXms`
- `[PERF] SearchVisibility: Page fully rendered: XXms`

## Additional Optimizations Needed

### 1. Defer Chart Rendering (High Priority)
**Issue**: Charts render synchronously, blocking initial render
**Solution**: 
- Use `requestIdleCallback` or `setTimeout` to defer chart initialization
- Show skeleton/placeholder first, render chart after data is ready

### 2. Virtual Scrolling (Medium Priority)
**Issue**: Large lists render all items at once
**Solution**:
- Implement virtual scrolling for PromptsList if >100 items
- Implement virtual scrolling for VisibilityTable if >50 models

### 3. Progressive Data Loading (Medium Priority)
**Issue**: All data must be processed before showing anything
**Solution**:
- Show partial data immediately
- Process and add remaining data incrementally

### 4. Optimize Chart Data Computation (Low Priority)
**Issue**: Chart data recomputed on every render
**Solution**:
- Better memoization of chart data
- Only recompute when necessary dependencies change

## Testing & Measurement

1. Open browser DevTools Console
2. Navigate to `/prompts` page
3. Note all `[PERF]` log timings
4. Navigate to `/search-visibility` page
5. Note all `[PERF]` log timings
6. Share the timing data to identify remaining bottlenecks

## Expected Performance Improvements

### Prompts Page:
- **Before**: Multiple API calls due to cascading effect
- **After**: Single API call, no cascading
- **Expected**: 50-70% reduction in API calls, faster initial render

### SearchVisibility Page:
- **Before**: Heavy blocking processing in useEffect
- **After**: Non-blocking processing in useMemo
- **Expected**: 30-50% reduction in blocking time, faster initial render

### Component Re-renders:
- **Before**: Components re-render on every state change
- **After**: Memoized components only re-render when props change
- **Expected**: 40-60% reduction in unnecessary re-renders

## Next Steps

1. **Test the fixes** - Navigate to both pages and check console logs
2. **Share timing data** - Provide the `[PERF]` log timings
3. **Identify bottlenecks** - Based on logs, we'll optimize specific areas
4. **Implement remaining optimizations** - Defer chart rendering, virtual scrolling, etc.

## Files Modified

1. `src/pages/Prompts.tsx` - Fixed cascading effect, added logging
2. `src/pages/SearchVisibility.tsx` - Optimized data processing, added logging
3. `src/components/Prompts/PromptsList.tsx` - Added React.memo
4. `src/components/Visibility/VisibilityChart.tsx` - Added React.memo
5. `src/components/Visibility/VisibilityTable.tsx` - Added React.memo

## How to Verify Fixes

1. Check console for `[PERF]` logs - should see timing for each phase
2. Check Network tab - should see fewer API calls on Prompts page
3. Check React DevTools Profiler - should see fewer re-renders
4. Test user experience - pages should feel faster and more responsive

