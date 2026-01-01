# Date Filter and Change Comparison Plan

## Overview
This document outlines a plan to implement date filter functionality that allows users to:
1. Select a date range for the current period
2. Automatically compare it to a previous period
3. View changes/trends between periods

---

## Current State

### Issues Identified

1. **Brand Presence Calculation Bug**
   - **Problem**: Dashboard shows 100% brand presence for Perplexity, but data shows FALSE values
   - **Root Cause**: Frontend calculates `brandPresencePercentage = (brandPresenceCount / totalQueries) * 100`
   - **Issue**: `brandPresenceCount` counts rows, not unique collector results
   - **Fix Needed**: Backend should send count of unique collector results with brand presence, not row count

2. **Domain Column Location**
   - ✅ Fixed: Removed `domain` from `extracted_positions` query (it's only in `citations` table)

3. **Change Comparison Logic**
   - ✅ Updated: Now compares most recent day to previous day (day-over-day)
   - Current: Compares end date of range to previous day
   - Example: Dec 1-2 range compares Dec 2 data to Dec 1 data

---

## Date Filter Functionality Plan

### Option 1: Simple Date Range Picker (Recommended)

**UI Components:**
- Date range picker (start date + end date)
- "Compare to Previous Period" toggle/checkbox
- Display comparison period dates below the picker

**Behavior:**
- User selects date range (e.g., Dec 1-2)
- System automatically calculates previous period:
  - Previous period = Same duration before start date
  - Example: Dec 1-2 (2 days) → Previous: Nov 29-30 (2 days)
- Show both periods clearly:
  - "Current Period: Dec 1-2, 2025"
  - "Comparing to: Nov 29-30, 2025"

**Implementation:**
- Frontend: Add date range picker component
- Backend: Already supports `startDate` and `endDate` query params
- Display: Show comparison dates in UI header

**Pros:**
- Simple and intuitive
- Matches current API structure
- Easy to implement

**Cons:**
- Previous period is automatically calculated (not user-selectable)

---

### Option 2: Dual Date Range Picker

**UI Components:**
- Two date range pickers:
  - "Current Period" (start + end)
  - "Previous Period" (start + end)
- "Auto-calculate Previous Period" checkbox

**Behavior:**
- User can manually select both periods
- OR check "Auto-calculate" to automatically set previous period
- When auto-calculate is enabled, previous period = same duration before current period start

**Implementation:**
- Frontend: Two date range pickers with auto-calculate toggle
- Backend: Accept `previousStartDate` and `previousEndDate` query params (optional)
- If previous dates not provided, calculate automatically

**Pros:**
- Maximum flexibility
- Users can compare any two periods
- Still supports auto-calculation

**Cons:**
- More complex UI
- Requires backend changes to accept previous period dates

---

### Option 3: Preset Periods with Custom Override

**UI Components:**
- Preset buttons: "Last 7 Days", "Last 30 Days", "Last 90 Days", "Custom"
- When "Custom" selected, show date range picker
- "Compare to Previous Period" toggle
- Display comparison info

**Behavior:**
- Click preset → automatically sets date range and previous period
- Select "Custom" → user picks dates, system calculates previous period
- Toggle "Compare to Previous Period" → shows/hides change indicators

**Implementation:**
- Frontend: Preset buttons + conditional date picker
- Backend: No changes needed (uses existing date range logic)
- Display: Show change values when comparison is enabled

**Pros:**
- Quick access to common periods
- Still allows custom dates
- Clean UI

**Cons:**
- Requires preset definitions
- Slightly more complex than Option 1

---

## Recommended Approach: Option 1 + Enhanced Display

### Phase 1: Fix Brand Presence Bug

**Backend Changes:**
- File: `backend/src/services/brand-dashboard/visibility.service.ts`
- Change: Count unique collector results with brand presence, not rows
- Current: `brandPresenceCount` = count of rows where `has_brand_presence = true`
- Fix: `brandPresenceCount` = count of unique `collector_result_id` where `has_brand_presence = true`

**Frontend Changes:**
- File: `src/pages/SearchVisibility.tsx`
- Verify: Calculation uses unique collector results (should already be correct if backend is fixed)

### Phase 2: Add Date Range Picker

**Frontend Components:**
1. **Date Range Picker Component**
   - Location: `src/components/Dashboard/DateRangePicker.tsx` (new)
   - Features:
     - Start date input
     - End date input
     - Calendar picker (optional, can use native date input)
     - Validation (end date >= start date)
     - Max range limit (e.g., 90 days)

2. **Comparison Period Display**
   - Location: `src/components/Dashboard/ComparisonPeriodInfo.tsx` (new)
   - Shows:
     - Current period dates
     - Previous period dates (calculated)
     - Duration of each period

3. **Integration Points:**
   - Dashboard page: Add date picker above charts
   - Search Sources page: Add date picker above table
   - Search Visibility page: Add date picker above charts

**Backend Changes:**
- No changes needed (already supports `startDate` and `endDate` params)
- Ensure previous period calculation is consistent across all endpoints

### Phase 3: Enhanced Change Display

**Visual Indicators:**
1. **Change Values**
   - Show with color coding (green = positive, red = negative)
   - Show with arrows (↑ ↓)
   - Format: "+X.X" or "-X.X"

2. **Comparison Period Info**
   - Tooltip or info icon showing:
     - "Comparing Dec 2, 2025 to Dec 1, 2025"
     - "Change: +2.5 points"

3. **Empty States**
   - When no previous data: Show "—" or "No previous data"
   - When no change: Show "0.0" or "No change"

---

## Implementation Details

### Date Range Picker Component Structure

```typescript
interface DateRangePickerProps {
  startDate: string | null
  endDate: string | null
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  maxRange?: number // days
  minDate?: string
  maxDate?: string
}

// Usage:
<DateRangePicker
  startDate={startDate}
  endDate={endDate}
  onStartDateChange={setStartDate}
  onEndDateChange={setEndDate}
  maxRange={90}
/>
```

### Previous Period Calculation

```typescript
function calculatePreviousPeriod(
  startDate: Date,
  endDate: Date
): { start: Date; end: Date } {
  const duration = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1
  
  const previousEnd = new Date(startDate)
  previousEnd.setUTCHours(0, 0, 0, 0)
  
  const previousStart = new Date(previousEnd)
  previousStart.setUTCDate(previousStart.getUTCDate() - duration)
  
  return { start: previousStart, end: previousEnd }
}
```

### API Integration

**Current Endpoints:**
- `GET /api/brands/:brandId/dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/brands/:brandId/sources?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

**No changes needed** - endpoints already support date ranges

---

## UI/UX Considerations

### Date Picker Placement

1. **Dashboard Page:**
   - Top right corner (next to brand selector)
   - Or above the main chart area
   - Keep it visible but not intrusive

2. **Search Sources Page:**
   - Above the filter bar
   - Or in the page header
   - Consistent with other filters

3. **Search Visibility Page:**
   - Integrate with existing timeframe selector
   - Replace or enhance current timeframe dropdown

### Visual Design

- Use consistent date format: "MMM DD, YYYY" (e.g., "Dec 02, 2025")
- Show comparison period in smaller, muted text
- Use icons to indicate comparison (↔ or ⇄)
- Highlight when comparison is active

### User Feedback

- Show loading state when changing dates
- Display "No data available" for periods with no data
- Show "Calculating changes..." while processing
- Error messages for invalid date ranges

---

## Testing Plan

### Unit Tests

1. **Date Range Calculation**
   - Test previous period calculation for various ranges
   - Test edge cases (single day, month boundaries, etc.)

2. **Change Calculation**
   - Test with matching data
   - Test with missing previous data
   - Test with zero values

### Integration Tests

1. **API Endpoints**
   - Test with various date ranges
   - Test with invalid dates
   - Test with dates outside data range

2. **Frontend Components**
   - Test date picker interactions
   - Test date validation
   - Test comparison period display

### User Acceptance Tests

1. **Date Selection**
   - User can select date range
   - Previous period is calculated correctly
   - Changes are displayed accurately

2. **Edge Cases**
   - No previous data available
   - Single day selection
   - Very long date ranges
   - Dates with no data

---

## Migration Strategy

### Phase 1: Backend Fixes (Week 1)
- Fix brand presence calculation bug
- Ensure consistent previous period calculation
- Add logging for debugging

### Phase 2: Frontend Components (Week 2)
- Create DateRangePicker component
- Create ComparisonPeriodInfo component
- Add to one page (Dashboard) as pilot

### Phase 3: Integration (Week 3)
- Integrate date picker into all relevant pages
- Add comparison period display
- Test and refine

### Phase 4: Polish (Week 4)
- UI/UX improvements
- Performance optimization
- Documentation

---

## Success Criteria

1. ✅ Users can select custom date ranges
2. ✅ Previous period is automatically calculated and displayed
3. ✅ Change values are accurate and displayed correctly
4. ✅ Brand presence percentage is calculated correctly
5. ✅ UI is intuitive and consistent across pages
6. ✅ Performance is acceptable (no significant slowdown)

---

## Open Questions

1. **Default Date Range**: What should be the default when page loads?
   - Last 7 days?
   - Last 30 days?
   - All available data?

2. **Comparison Toggle**: Should comparison be always-on or optional?
   - Always show changes if previous data exists?
   - Or allow users to toggle comparison on/off?

3. **Date Format**: What format should dates use?
   - ISO format (YYYY-MM-DD) for API
   - Display format (MMM DD, YYYY) for UI
   - User's locale format?

4. **Max Range**: Should there be a maximum date range limit?
   - 90 days?
   - 365 days?
   - No limit?

---

## Notes

- Keep date handling consistent across frontend and backend
- Use UTC dates to avoid timezone issues
- Consider caching previous period calculations for performance
- Add analytics to track which date ranges users select most

