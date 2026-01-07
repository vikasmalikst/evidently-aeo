# Time Series Zero Values - Root Cause Analysis

## Problem Statement

When requesting a **short date range** (e.g., last 7 days: Dec 17-25), the time series shows **zeros** for the first few days, even though data exists for those dates when viewing a **longer range** (e.g., 3 weeks: Dec 3-25).

### Example from Logs

**7 Days (Dec 17-25):**
```
Bing Copilot: visibility=[0, 0, 0, 0, 0, 16, 16, 16, 16]
Gemini: visibility=[0, 0, 0, 0, 0, 27, 27, 27, 27]
ChatGPT: visibility=[0, 0, 0, 0, 0, 32.3, 32.3, 32.3, 32.3]
```

**3 Weeks (Dec 3-25):**
```
Bing Copilot: visibility=[0, 0, 32.6, 32.6, 32.6, 32.6, 34.7, 34.7, ..., 16, 16, 16, 16]
Gemini: visibility=[0, 0, 28.6, 28.7, 28.7, 27.1, 29.8, 30, ..., 27, 27, 27, 27]
ChatGPT: visibility=[0, 0, 33.4, 30.6, 31.3, 31.5, 30.6, ..., 32.3, 32.3, 32.3, 32.3]
```

**Observation:** The same dates (Dec 17-21) show zeros in the 7-day view but actual values in the 3-week view.

---

## Root Cause

### Current Implementation

**Location:** `backend/src/services/brand-dashboard/payload-builder.ts` (lines 2285-2331)

**Carry-Forward Logic:**
```typescript
let lastVisibility = 0  // ❌ PROBLEM: Initialized to 0
let lastShare = 0
let lastSentiment: number | null = null
let lastBrandPresence = 0

allDates.forEach(date => {
  const dayData = dailyData.get(date)
  if (dayData) {
    const hasVisibility = dayData.visibilityValues.length > 0
    const avgVisibility = hasVisibility
      ? round(average(dayData.visibilityValues) * 100)
      : lastVisibility  // Uses 0 if no data AND no previous value
    // ...
    lastVisibility = avgVisibility  // Only updates when there's data
  }
})
```

### The Problem

1. **Carry-forward values are initialized to 0** (line 2288-2291)
2. **When requesting a short date range** (e.g., Dec 17-25):
   - Days Dec 17-21 have no data in the requested range
   - Since `lastVisibility = 0`, those days show 0
   - When data appears on Dec 22, it carries forward from 0
3. **When requesting a longer range** (e.g., Dec 3-25):
   - Days Dec 3-21 have data, so `lastVisibility` gets set to actual values (32.6, 28.6, etc.)
   - When Dec 22 comes, it carries forward from those actual values
   - **Result:** Same dates show different values depending on the requested range

### Why This Happens

The carry-forward mechanism is **range-dependent**:
- It only looks at data **within the requested date range**
- It doesn't check for data **before** the requested range
- If the first few days of the range have no data, it defaults to 0

---

## Impact

- **Inconsistent charts:** Same dates show different values depending on date range selection
- **Misleading zeros:** Days with actual data appear as zeros in short-range views
- **Poor UX:** Users see "broken" trends when selecting shorter date ranges
- **Affects all metrics:** Visibility, Share of Answer, Sentiment, Brand Presence

---

## Critical Finding: Interpolated Data Usage

**Question:** Is interpolated data used for calculating metrics or only for trending on charts?

**Answer:** **Interpolated data is ONLY used for trending on charts, NOT for calculating the main metrics.**

### Evidence

**Main Metrics Calculation (from `collectorAggregates`):**
- **Location:** `backend/src/services/brand-dashboard/visibility.service.ts` (lines 71-140)
- **Source:** `aggregate.visibilityValues`, `aggregate.shareValues`, `aggregate.sentimentValues`
- **Built from:** Actual database rows in the requested date range (lines 818-869 in payload-builder.ts)
- **Calculation:** `average(aggregate.visibilityValues)` - uses only real data from database
- **Used for:** Main visibility/share/sentiment numbers shown in cards, tables, and summary metrics

**Time Series Data (separate calculation):**
- **Location:** `backend/src/services/brand-dashboard/payload-builder.ts` (lines 2088-2345)
- **Source:** `timeSeriesByCollector` - built separately from `positionRows`
- **Uses interpolation:** Carry-forward logic fills gaps (lines 2285-2331)
- **Attached to response:** Only for `timeSeries` field (line 168-174 in visibility.service.ts)
- **Used for:** Chart rendering only - the time series line/bar charts

### Conclusion

✅ **Main metrics (visibility, share, sentiment) are calculated from real database data only**
✅ **Interpolated data is ONLY used for chart visualization**
✅ **The zero values issue affects charts only, not the main metric calculations**

This means:
- The main metric cards/tables show accurate values (from real data)
- Only the time series charts show inconsistent zeros
- Fixing the interpolation will only affect chart display, not metric accuracy

---

## Solution Design

### Approach: Lookback Initialization

**Concept:** Before processing the requested date range, look back to find the most recent data point and use it to initialize carry-forward values.

### Implementation Strategy

1. **Query for lookback data** (before the requested start date)
   - Query `metric_facts` for data up to 7 days before the requested start date
   - Get the most recent value for each collector type
   - Use these values to initialize `lastVisibility`, `lastShare`, etc.

2. **Modify carry-forward logic**
   - Initialize carry-forward values from lookback data (if available)
   - Fall back to 0 only if no historical data exists at all

3. **Optimization**
   - Only perform lookback if the requested range is shorter than a threshold (e.g., < 14 days)
   - Cache lookback results per collector type

### Code Changes Required

**File:** `backend/src/services/brand-dashboard/payload-builder.ts`

**Changes:**
1. Add lookback query function (lines ~2270)
2. Modify carry-forward initialization (lines 2285-2291)
3. Use lookback values instead of 0

---

## Proposed Solution

### Lookback Window Duration

**Recommendation: 7-14 days**

**Reasoning:**
- **7 days:** Covers typical weekly collection patterns, sufficient for most cases
- **14 days:** Safer option to handle longer gaps (e.g., bi-weekly collection, holidays)
- **Consideration:** Should be configurable or adaptive based on data collection frequency

**Decision:** **7 days** (can be increased to 14 if gaps are common)

**Rationale:**
- Most data is collected daily or every few days
- 7 days provides good balance between coverage and query performance
- If no data found in 7 days, likely no recent data exists anyway
- Can be made configurable if needed

### Step 1: Add Lookback Query Function

```typescript
// Query for most recent data before the requested start date
async function getLookbackValues(
  brandId: string,
  collectorTypes: string[],
  beforeDate: string, // ISO date string
  lookbackDays: number = 7 // Default: 7 days lookback
): Promise<Map<string, {
  visibility: number
  share: number
  sentiment: number | null
  brandPresence: number
}>> {
  const lookbackStart = new Date(beforeDate)
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays)
  lookbackStart.setUTCHours(0, 0, 0, 0)
  
  const lookbackEnd = new Date(beforeDate)
  lookbackEnd.setUTCHours(0, 0, 0, 0)
  
  // Query metric_facts for data in lookback period
  // Group by collector_type and get most recent values
  // Return Map<collectorType, { visibility, share, sentiment, brandPresence }>
}
```

### Step 2: Initialize Carry-Forward from Lookback

```typescript
// Before processing allDates, get lookback values
const lookbackValues = await getLookbackValues(
  brand.id,
  Array.from(collectorAggregates.keys()),
  startIsoBound,
  7 // Look back 7 days (configurable)
)

timeSeriesByCollector.forEach((dailyData, collectorType) => {
  // Initialize from lookback (if available), otherwise 0
  const lookback = lookbackValues.get(collectorType)
  let lastVisibility = lookback?.visibility ?? 0
  let lastShare = lookback?.share ?? 0
  let lastSentiment = lookback?.sentiment ?? null
  let lastBrandPresence = lookback?.brandPresence ?? 0
  
  // Rest of the logic remains the same...
})
```

### Step 3: Mark Interpolated Data Points

**Backend Changes:**
- Add a flag to each time series data point indicating if it's "real" (from database) or "interpolated" (carry-forward)
- Modify time series structure to include `isRealData: boolean[]` array

```typescript
timeSeriesData.set(collectorType, { 
  dates, 
  visibility, 
  share, 
  sentiment, 
  brandPresence,
  isRealData: boolean[] // NEW: true if data from DB, false if interpolated
})
```

**Frontend Changes:**
- Modify `VisibilityChart.tsx` to conditionally show dots only for real data points
- Use `pointRadius` array (per-point configuration) instead of single value
- Set `pointRadius: 0` for interpolated points, `pointRadius: 3` for real data points

**Implementation:**
```typescript
// In VisibilityChart.tsx
const datasets = selectedModels.map((modelId, index) => {
  const modelData = data.datasets.find(d => d.id === modelId);
  const isRealData = modelData.isRealData || []; // Array of booleans
  
  return {
    // ... other config
    pointRadius: modelData.data.map((_, i) => 
      isRealData[i] ? (isDimmed ? 2 : 3) : 0 // Only show dots for real data
    ),
    pointHoverRadius: modelData.data.map((_, i) => 
      isRealData[i] ? (isDimmed ? 3 : 6) : 0
    ),
  };
});
```

### Step 4: Optimization

- Only perform lookback if requested range < 14 days (to avoid unnecessary queries for long ranges)
- Cache lookback results to avoid duplicate queries

---

## Benefits

✅ **Consistent values:** Same dates show same values regardless of date range
✅ **Accurate trends:** No misleading zeros when data exists
✅ **Better UX:** Charts show correct trends in short-range views
✅ **Backward compatible:** Doesn't break existing functionality

---

## Testing Plan

1. **Test Case 1:** Request 7 days (Dec 17-25)
   - Expected: Should show actual values for Dec 17-21 (from lookback)
   - Verify: Values match 3-week view for same dates

2. **Test Case 2:** Request 3 weeks (Dec 3-25)
   - Expected: Should work as before (no regression)
   - Verify: Values unchanged

3. **Test Case 3:** Request range with no historical data
   - Expected: Should use 0 as fallback (existing behavior)
   - Verify: No errors, graceful degradation

4. **Test Case 4:** Request range starting at first available data
   - Expected: Should use 0 for first day, then carry forward
   - Verify: Correct behavior

---

## Implementation Notes

### Backend
- **Performance:** Lookback query adds minimal overhead (single query, filtered by date)
- **Edge Cases:** Handle cases where no lookback data exists (fallback to 0)
- **Date Handling:** Ensure timezone consistency between lookback and main query
- **Data Marking:** Track which data points are real vs interpolated in time series response

### Frontend
- **Chart Rendering:** Use per-point `pointRadius` configuration to show/hide dots
- **Visual Distinction:** Real data = dots visible, Interpolated data = no dots (line only)
- **User Experience:** Users can visually distinguish actual measurements from interpolated values

### Data Structure Changes

**Backend Type Update:**
```typescript
// backend/src/services/brand-dashboard/types.ts
export interface LlmVisibilitySlice {
  // ... existing fields
  timeSeries?: {
    dates: string[]
    visibility: number[]
    share: number[]
    sentiment: (number | null)[]
    isRealData?: boolean[] // NEW: true = from DB, false = interpolated
  }
}
```

**Frontend Type Update:**
```typescript
// src/components/Visibility/VisibilityChart.tsx
interface VisibilityChartProps {
  data: {
    labels: string[]
    datasets: Array<{
      id: string
      label: string
      data: Array<number | null>
      isRealData?: boolean[] // NEW: per-point real data flags
    }>
  }
  // ... rest of props
}
```

---

## Approval Required

**Question:** Should we proceed with this solution?

**Alternative Approaches Considered:**
1. ❌ Always query full historical range (too expensive)
2. ❌ Remove carry-forward entirely (breaks gap handling)
3. ✅ Lookback initialization (optimal balance)

**Recommendation:** Proceed with lookback initialization approach.

