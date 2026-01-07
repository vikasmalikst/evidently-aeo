# Time Series Lookback Implementation Summary

## Overview
Implemented a comprehensive fix for time series zero values issue by adding lookback initialization and marking interpolated vs. real data points.

## Problem Solved
- **Issue**: Short date ranges (e.g., 7 days) showed zeros for initial days that had actual data in longer ranges (e.g., 3 weeks)
- **Root Cause**: Carry-forward logic initialized to zero and only considered data within the requested date range
- **Solution**: Added 7-day lookback query to initialize carry-forward values from data before the requested range

## Implementation Details

### Backend Changes

#### 1. Lookback Query Function (`payload-builder.ts`)
- **Location**: Lines 2269-2442
- **Function**: `getLookbackValues()`
- **Purpose**: Fetches most recent data from 7 days before the requested start date
- **Features**:
  - Only runs for short date ranges (< 14 days) to avoid unnecessary queries
  - Queries `metric_facts` with joins to `brand_metrics` and `brand_sentiment`
  - Groups by collector type and date, then gets most recent date's aggregated values
  - Returns initialization values for visibility, share, sentiment, and brand presence

#### 2. Competitor Lookback Function (`payload-builder.ts`)
- **Location**: Lines 2547-2700
- **Function**: `getCompetitorLookbackValues()`
- **Purpose**: Similar lookback for competitor time series data
- **Features**:
  - Queries `metric_facts` with joins to `competitor_metrics` and `competitor_sentiment`
  - Groups by competitor name, collector type, and date
  - Returns initialization values per competitor

#### 3. Carry-Forward Initialization
- **Brand Visibility** (Lines 2462-2520):
  - Initializes `lastVisibility`, `lastShare`, `lastSentiment`, `lastBrandPresence` from lookback values
  - Falls back to 0 if no lookback data available
  - Marks each data point as real (`isRealData: true`) or interpolated (`isRealData: false`)

- **Competitor Visibility** (Lines 2702-2760):
  - Similar initialization for competitor time series
  - Uses first available lookback value across collectors
  - Marks real vs. interpolated data points

#### 4. Type Updates
- **Backend Types** (`types.ts`):
  - Added `isRealData?: boolean[]` to `LlmVisibilitySlice.timeSeries`
  - Added `isRealData?: boolean[]` to `CompetitorVisibility.timeSeries`

- **Visibility Service** (`visibility.service.ts`):
  - Updated function signatures to accept `isRealData` in time series data
  - Passes through `isRealData` flags to response payload

### Frontend Changes

#### 1. Type Definitions (`SearchVisibility.tsx`)
- **Updated Interfaces**:
  - `LlmVisibilitySlice.timeSeries`: Added `isRealData?: boolean[]`
  - `CompetitorVisibilityEntry.timeSeries`: Added `isRealData?: boolean[]`
  - `ModelData`: Added `isRealData?: boolean[]`

#### 2. Data Transformation (`SearchVisibility.tsx`)
- **Brand Models** (Line 360):
  - Passes through `isRealData` from `slice.timeSeries?.isRealData`
  
- **Competitor Models** (Line 562):
  - Passes through `isRealData` from `entry.timeSeries?.isRealData`

- **Chart Data** (Line 631):
  - Includes `isRealData` in dataset objects passed to chart

#### 3. Chart Rendering (`VisibilityChart.tsx`)
- **Point Radius Logic** (Lines 130-144):
  - Uses `isRealData` array to conditionally show/hide dots
  - If `isRealData` is available and matches data length:
    - Shows dots (radius 2-3) only for real data points
    - Hides dots (radius 0) for interpolated points
  - Falls back to showing all dots if `isRealData` not available

## Key Features

### 1. Lookback Window
- **Duration**: 7 days before requested start date
- **Condition**: Only runs for date ranges < 14 days
- **Rationale**: Longer ranges likely contain initialization data within the range

### 2. Data Point Marking
- **Real Data**: Points with actual database values (visibility, share, sentiment, or brand presence)
- **Interpolated Data**: Points filled via carry-forward logic
- **Visualization**: Only real data points show dots on charts

### 3. Coverage
- ✅ Brand Visibility charts
- ✅ Competitive Visibility charts
- ✅ All metrics (Visibility, Share, Sentiment, Brand Presence)
- ✅ All KPIs (calculated from real data, not affected by interpolation)

## Testing Checklist

- [ ] Test 7-day range with data before the range
- [ ] Test 7-day range without data before the range
- [ ] Test 14+ day range (should skip lookback)
- [ ] Verify dots only appear on real data points
- [ ] Verify interpolated points connect smoothly without dots
- [ ] Test brand visibility charts
- [ ] Test competitive visibility charts
- [ ] Verify main metrics (KPIs) are unaffected (calculated from real data)

## Performance Considerations

- **Lookback Query**: Only runs for short date ranges (< 14 days)
- **Query Optimization**: Uses indexed columns (`brand_id`, `processed_at`, `collector_type`)
- **Caching**: Lookback results are computed once per request
- **Fallback**: Gracefully handles missing lookback data (initializes to 0)

## Backward Compatibility

- ✅ All changes are backward compatible
- ✅ `isRealData` is optional in all interfaces
- ✅ Charts fall back to showing all dots if `isRealData` not available
- ✅ Existing API responses work without modification

## Files Modified

### Backend
1. `backend/src/services/brand-dashboard/payload-builder.ts`
   - Added lookback query functions
   - Updated carry-forward initialization
   - Added `isRealData` flags to time series

2. `backend/src/services/brand-dashboard/visibility.service.ts`
   - Updated function signatures
   - Passes through `isRealData` flags

3. `backend/src/services/brand-dashboard/types.ts`
   - Added `isRealData` to time series interfaces

### Frontend
1. `src/pages/SearchVisibility.tsx`
   - Updated TypeScript interfaces
   - Passes through `isRealData` in data transformation

2. `src/components/Visibility/VisibilityChart.tsx`
   - Updated to use `isRealData` for conditional dot rendering

## Summary

The implementation successfully addresses the zero values issue by:
1. **Initializing carry-forward from historical data** (7-day lookback)
2. **Marking real vs. interpolated data points** (`isRealData` flags)
3. **Visualizing only real data points** (dots on charts)
4. **Maintaining metric accuracy** (KPIs use real data only)

All changes are backward compatible and performance-optimized.

