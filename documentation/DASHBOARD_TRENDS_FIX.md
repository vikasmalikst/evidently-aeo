# Dashboard Trends Fix - Summary

## Issues Found

1. **Date Filtering Issue:**
   - Dashboard was using `processed_at` for `extracted_positions` instead of `created_at`
   - This means new data collected might not show up if `processed_at` is different from `created_at`
   - **FIXED:** Changed to use `created_at` for filtering

2. **Time-Series Data Issue:**
   - Charts are showing flat lines because `buildTimeseries(value)` fills all days with the same aggregated value
   - Backend aggregates ALL data in the date range into a single score
   - Frontend then displays that single score for all days
   - **NEEDS FIX:** Backend needs to group data by day and calculate scores per day

3. **Score Calculation:**
   - Current scores are AVERAGES/AGGREGATES of all data in the date range
   - When you collect new data, it gets averaged with old data
   - **NEEDS FIX:** Need to show per-day scores OR show latest scores only

## What Was Fixed

✅ Changed `extracted_positions` query to filter by `created_at` instead of `processed_at`
✅ Added `created_at` to the SELECT statement so it's available for grouping

## What Still Needs to Be Done

1. **Backend:** Group `extracted_positions` by day (using `created_at`) and calculate scores per day
2. **Backend:** Return time-series data structure with daily values
3. **Frontend:** Use the time-series data from backend instead of `buildTimeseries(value)`

## Current Behavior

- **Scores shown:** Average of ALL data in the date range (old + new)
- **Charts:** Flat lines showing the same value for all days
- **New data:** Gets included in the average, but doesn't show as a trend

## Desired Behavior

- **Scores shown:** Per-day scores OR latest scores only
- **Charts:** Actual trends showing how scores change over time
- **New data:** Shows up as a new data point on the chart

## Next Steps

1. Modify backend to group data by `created_at` date
2. Calculate visibility/share/sentiment scores per day
3. Return time-series array in the API response
4. Update frontend to use the time-series data

