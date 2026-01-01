# Historical Trends Implementation Plan

## Overview
This document outlines the plan to implement historical data trends (change over time) functionality for:
1. **Top Brand Sources** widget on the dashboard
2. **Source Attribution table** on the search-sources page (already has change indicators, need to verify implementation)

The trends functionality is already implemented on the **search-visibility page** using time-series data and delta calculations.

---

## Current State Analysis

### ✅ Already Implemented

#### 1. Search Visibility Page
- **Location**: `src/pages/SearchVisibility.tsx`
- **Implementation**: 
  - Uses time-series data from backend (`timeSeries` property in `LlmVisibilitySlice`)
  - Calculates delta/change for visibility, share, and sentiment
  - Displays trends in table with change indicators
  - Supports weekly, monthly, and YTD timeframes

#### 2. Source Attribution Table (Search Sources Page)
- **Location**: `src/pages/SearchSources.tsx` + `backend/src/services/source-attribution.service.ts`
- **Implementation**:
  - Already calculates `mentionChange`, `soaChange`, and `sentimentChange`
  - Uses previous period comparison (same duration before current period)
  - Changes are displayed in the table with up/down arrows
  - **Status**: ✅ Already working - needs verification

### ❌ Needs Implementation

#### 1. Top Brand Sources Widget
- **Location**: 
  - Frontend: `src/pages/dashboard/components/TopBrandSources.tsx`
  - Backend: `backend/src/services/brand-dashboard/payload-builder.ts` (line ~1255)
- **Current Issue**: 
  - Change value is hardcoded to `0`: `change: hasImpact ? 0 : null`
  - Impact score is calculated but not compared to previous period
- **Required**: Calculate historical change for impact score

---

## Implementation Plan

### Phase 1: Backend - Historical Change Calculation for Top Brand Sources

#### Step 1.1: Understand Current Impact Score Calculation
**File**: `backend/src/services/brand-dashboard/payload-builder.ts` (lines ~1220-1264)

Current calculation:
```typescript
const impactScore = hasImpact
  ? round((0.35 * shareNorm + 0.35 * visibilityNorm + 0.3 * usageNorm), 1)
  : null
```

Impact score formula:
- 35% Share of Answer (SOA)
- 35% Visibility
- 30% Usage (normalized)

#### Step 1.2: Implement Previous Period Data Fetching
**Approach**: Similar to how `source-attribution.service.ts` calculates changes (lines 532-643)

**Steps**:
1. Calculate previous period date range (same duration before current period)
2. Query `extracted_positions` table for previous period data
3. Aggregate data by domain for previous period:
   - Usage (citation counts)
   - Share of Answer (from `share_of_answers_brand`)
   - Visibility (from `visibility_index`)
4. Calculate previous period impact scores using same formula

**Code Location**: 
- Add previous period calculation in `payload-builder.ts`
- Add around line ~1200 (before `topBrandSources` calculation)

#### Step 1.3: Calculate Change Values
**Steps**:
1. For each source in current period:
   - Find matching source in previous period (by domain/key)
   - Calculate: `change = currentImpactScore - previousImpactScore`
   - Handle cases where source didn't exist in previous period
2. Round to 1 decimal place for consistency

**Update Type Definition**:
- File: `backend/src/services/brand-dashboard/types.ts` (line 154)
- Current: `change: number | null`
- Already correct, no changes needed

### Phase 2: Frontend - Display Historical Changes

#### Step 2.1: Verify Current Display Implementation
**File**: `src/pages/dashboard/components/TopBrandSources.tsx`

Current implementation (lines 38-48):
```typescript
const hasChange = typeof page.change === 'number' && Number.isFinite(page.change);
const changeValue = hasChange ? page.change! : 0;
const changeLabel = hasChange ? Math.abs(changeValue).toFixed(1) : '—';
const changeClass = hasChange
  ? changeValue > 0 ? 'text-[#06c686]' : changeValue < 0 ? 'text-[#f94343]' : 'text-[#64748b]'
  : 'text-[#64748b]';
```

**Status**: ✅ Already handles change display correctly!
- Shows green for positive change
- Shows red for negative change
- Shows gray for zero/no change

**Action**: No changes needed - once backend calculates real change values, frontend will display them automatically.

#### Step 2.2: Test Display with Real Data
1. Verify change values are received from backend
2. Test edge cases:
   - New sources (no previous period data)
   - Sources that disappeared (had data in previous period but not current)
   - Zero change scenarios

### Phase 3: Source Attribution Table Verification

#### Step 3.1: Verify Backend Implementation
**File**: `backend/src/services/source-attribution.service.ts`

Current implementation:
- Lines 532-643: Previous period data fetching
- Lines 679-693: Change calculations
- Lines 708-712: Change values included in response

**Status**: ✅ Already implemented!

#### Step 3.2: Verify Frontend Display
**File**: `src/pages/SearchSources.tsx`

Current implementation:
- Lines 1207-1218: Mention Rate change display
- Lines 1226-1237: Share of Answer change display
- Lines 1252-1263: Sentiment change display

**Status**: ✅ Already implemented!

**Action**: 
1. Test with real data to ensure changes are calculated correctly
2. Verify previous period calculation uses correct date range
3. Check edge cases (new sources, missing previous data)

---

## Implementation Details

### Date Range Calculation for Previous Period

**Pattern** (from `source-attribution.service.ts` line 534):
```typescript
const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
const previousStart = new Date(startDate)
previousStart.setUTCDate(previousStart.getUTCDate() - periodDays)
const previousEnd = startDate
```

**Example**:
- Current period: Jan 15 - Feb 15 (30 days)
- Previous period: Dec 16 - Jan 15 (30 days before)

### Impact Score Calculation Details

**Current Period** (already implemented):
```typescript
const usageNorm = maxSourceUsage > 0 ? (source.usage / maxSourceUsage) * 10 : 0
const shareNorm = (source.share / 100) * 10
const visibilityNorm = (source.visibility / 100) * 10
const impactScore = 0.35 * shareNorm + 0.35 * visibilityNorm + 0.3 * usageNorm
```

**Previous Period** (to be implemented):
- Need to calculate `maxSourceUsage` for previous period
- Calculate same normalized values
- Apply same formula
- Compare: `change = currentImpactScore - previousImpactScore`

### Data Aggregation Strategy

**Current Period** (already implemented):
- Aggregates data by domain from `extracted_positions`
- Uses `citations` table for usage counts
- Groups by domain/key

**Previous Period** (to be implemented):
- Same aggregation strategy
- Query same tables with previous period date range
- Match by domain/key for comparison

---

## Testing Strategy

### Backend Testing

1. **Unit Tests**:
   - Test previous period date calculation
   - Test impact score calculation for previous period
   - Test change calculation (positive, negative, zero)

2. **Integration Tests**:
   - Test full payload building with previous period data
   - Test edge cases (no previous data, new sources, etc.)

### Frontend Testing

1. **Visual Testing**:
   - Verify change indicators display correctly
   - Check color coding (green/red/gray)
   - Test with various change values

2. **Data Flow Testing**:
   - Verify change values are passed from backend
   - Test with missing/null change values
   - Test with zero change values

### End-to-End Testing

1. **Scenario 1**: Brand with historical data
   - Verify changes are calculated correctly
   - Verify display shows appropriate indicators

2. **Scenario 2**: New brand (no previous data)
   - Verify change shows as `—` or `0.0`
   - No errors or crashes

3. **Scenario 3**: Source appearing/disappearing
   - New source in current period → change should be positive or null
   - Source disappeared → should not appear in current period

---

## Files to Modify

### Backend Files

1. **`backend/src/services/brand-dashboard/payload-builder.ts`**
   - Add previous period data fetching (~line 1200)
   - Add previous period impact score calculation
   - Update `topBrandSources` change calculation (~line 1255)

### Frontend Files

1. **`src/pages/dashboard/components/TopBrandSources.tsx`**
   - ✅ No changes needed - already handles change display

2. **`src/pages/SearchSources.tsx`**
   - ✅ No changes needed - already handles change display
   - Verify/test with real data

---

## Implementation Checklist

### Backend
- [ ] Add previous period date range calculation
- [ ] Add previous period data query (extracted_positions, citations)
- [ ] Add previous period aggregation by domain
- [ ] Add previous period impact score calculation
- [ ] Update change calculation in topBrandSources mapping
- [ ] Add error handling for missing previous data
- [ ] Add logging for debugging

### Frontend
- [x] Verify TopBrandSources component handles change display
- [x] Verify SearchSources component handles change display
- [ ] Test with real data from backend
- [ ] Verify edge cases (null, zero, missing data)

### Testing
- [ ] Write unit tests for change calculation
- [ ] Write integration tests for payload builder
- [ ] Test with historical data
- [ ] Test with new brands (no history)
- [ ] Test edge cases

### Documentation
- [x] Create implementation plan (this document)
- [ ] Update API documentation if needed
- [ ] Add code comments explaining change calculation

---

## Success Criteria

1. ✅ Top Brand Sources widget shows real change values (not hardcoded 0)
2. ✅ Changes are calculated based on impact score comparison
3. ✅ Frontend displays changes with correct color coding
4. ✅ Source Attribution table changes continue to work correctly
5. ✅ Edge cases handled gracefully (no errors, appropriate display)

---

## Timeline Estimate

- **Phase 1 (Backend)**: 4-6 hours
  - Previous period data fetching: 2 hours
  - Impact score calculation: 1 hour
  - Change calculation: 1 hour
  - Testing & debugging: 1-2 hours

- **Phase 2 (Frontend)**: 1-2 hours
  - Verification: 1 hour
  - Testing: 1 hour

- **Phase 3 (Source Attribution Verification)**: 1-2 hours
  - Testing with real data: 1-2 hours

**Total Estimate**: 6-10 hours

---

## Notes

1. **Reuse Existing Patterns**: Follow the same pattern used in `source-attribution.service.ts` for previous period calculation
2. **Consistency**: Use same date range calculation logic across all services
3. **Performance**: Previous period queries may add latency - consider caching if needed
4. **Accuracy**: Ensure previous period comparison uses same aggregation logic as current period



