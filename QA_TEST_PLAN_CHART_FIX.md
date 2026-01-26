# QA Test Plan - Chart Date Alignment Fix

## Test Environment Setup

1. Start backend server: `cd backend && npm run dev`
2. Start frontend: `cd .. && npm run dev`
3. Navigate to: `http://localhost:5173/measure`
4. Select brand: **inSiderSports** (as requested)

## Test Scenarios

### Test 1: Basic Functionality - 7 Day Range
**Objective**: Verify charts plot correctly for default 1-week range

**Steps**:
1. Select brand "inSiderSports"
2. Ensure date range is set to last 7 days (default)
3. Check all KPI tabs (Visibility, Share, Sentiment, Brand Presence)
4. Verify brand line appears for all 7 days
5. Verify competitor lines appear for all 7 days
6. Verify LLM slice lines appear for all 7 days

**Expected Results**:
- ✅ All entities plot data for complete 7-day range
- ✅ No gaps in chart lines
- ✅ Console shows no alignment warnings
- ✅ Backend logs show: `{N} dates (expected {N})` for all collectors

**Backend Logs to Check**:
```
[TimeSeries] Collector {type}: 7 dates (expected 7), {X} with real data, {Y} interpolated
[TimeSeries] Brand summary: 7 dates, {X} with real data, {Y} interpolated
```

**Frontend Console to Check**:
- No `⚠️ Date array length mismatch` warnings
- No `⚠️ Data array length mismatch` warnings

---

### Test 2: Extended Range - 30 Days
**Objective**: Verify charts plot correctly when user expands date range

**Steps**:
1. Select brand "inSiderSports"
2. Change date range to last 30 days
3. Wait for data to load
4. Check all KPI tabs
5. Verify brand line appears for all 30 days
6. Verify competitor lines appear for all 30 days (not just few days)
7. Verify LLM slice lines appear for all 30 days

**Expected Results**:
- ✅ All entities plot data for complete 30-day range
- ✅ Competitors show data for full 30 days (not just recent days)
- ✅ Brand shows data for full 30 days
- ✅ No gaps or truncation in chart lines
- ✅ Console shows no alignment warnings

**Backend Logs to Check**:
```
[TimeSeries] Collector {type}: 30 dates (expected 30), {X} with real data, {Y} interpolated
[TimeSeries] Brand summary: 30 dates, {X} with real data, {Y} interpolated
[TimeSeries] Competitor "{name}": 30 dates total, {X} with real data, {Y} interpolated
```

**Frontend Console to Check**:
- No alignment warnings
- All date arrays should have length 30

---

### Test 3: Data Table Verification
**Objective**: Verify table data matches chart data

**Steps**:
1. Select brand "inSiderSports"
2. Set date range to 30 days
3. Open "Detailed Breakdown" table
4. Compare table data with chart data
5. Verify dates in table match dates in chart

**Expected Results**:
- ✅ Table shows data for all dates in range
- ✅ Table dates match chart date labels
- ✅ Values in table match values plotted on chart

---

### Test 4: Metric Type Switching
**Objective**: Verify all metric types plot correctly

**Steps**:
1. Select brand "inSiderSports"
2. Set date range to 30 days
3. Switch between metric types:
   - Visibility
   - Share of Answers
   - Sentiment
   - Brand Presence
4. Verify each metric type plots correctly

**Expected Results**:
- ✅ All metric types show complete date range
- ✅ No gaps when switching between metrics
- ✅ Data arrays align with date labels for all metrics

---

### Test 5: LLM Filter Application
**Objective**: Verify filtering doesn't break date alignment

**Steps**:
1. Select brand "inSiderSports"
2. Set date range to 30 days
3. Apply LLM filters (select specific LLMs)
4. Verify filtered data still plots for full date range
5. Remove filters
6. Verify all data still plots correctly

**Expected Results**:
- ✅ Filtered data shows complete date range
- ✅ Unfiltered data shows complete date range
- ✅ No alignment issues when toggling filters

---

### Test 6: Edge Case - Sparse Data
**Objective**: Verify handling of brands with gaps in data collection

**Steps**:
1. Select a brand with known data gaps (if available)
2. Set date range to 30 days
3. Verify charts handle missing dates gracefully
4. Check that interpolated values (carry-forward) are used correctly

**Expected Results**:
- ✅ Charts show complete date range even with data gaps
- ✅ Missing dates use carry-forward values (flat lines)
- ✅ Backend logs show correct count of real vs interpolated data
- ✅ `isRealData` flags correctly mark interpolated points

**Backend Logs to Check**:
```
[TimeSeries] Collector {type}: 30 dates (expected 30), {X} with real data, {Y} interpolated
```
Where Y should be > 0 if there are gaps.

---

### Test 7: Date Range Changes
**Objective**: Verify smooth transitions when changing date ranges

**Steps**:
1. Select brand "inSiderSports"
2. Start with 7-day range
3. Verify charts plot correctly
4. Change to 30-day range
5. Verify charts update and plot correctly
6. Change back to 7-day range
7. Verify charts revert correctly

**Expected Results**:
- ✅ Smooth transitions between date ranges
- ✅ No data misalignment after range changes
- ✅ All entities update correctly
- ✅ No console errors or warnings

---

### Test 8: Console Validation
**Objective**: Verify no alignment warnings appear

**Steps**:
1. Open browser DevTools Console
2. Select brand "inSiderSports"
3. Test various date ranges and filters
4. Monitor console for warnings

**Expected Results**:
- ✅ No `⚠️ Date array length mismatch` warnings
- ✅ No `⚠️ Data array length mismatch` warnings
- ✅ No backend validation errors in network tab

---

## Regression Tests

### Test 9: Existing Functionality
**Objective**: Ensure fix doesn't break existing features

**Steps**:
1. Test all existing chart features
2. Test table functionality
3. Test KPI cards
4. Test date range selector
5. Test brand switching

**Expected Results**:
- ✅ All existing features work as before
- ✅ No new bugs introduced
- ✅ Performance is acceptable

---

## Success Criteria

### Must Pass (Critical)
- ✅ All entities plot for complete date range (not just partial)
- ✅ No console warnings about date misalignment
- ✅ Backend logs show correct date counts
- ✅ Charts work for both 7-day and 30+ day ranges

### Should Pass (Important)
- ✅ Smooth transitions when changing date ranges
- ✅ Filters don't break alignment
- ✅ All metric types work correctly
- ✅ Table data matches chart data

### Nice to Have
- ✅ Performance is good (no significant slowdown)
- ✅ Interpolated data is clearly marked (via isRealData)

---

## Known Issues to Verify Fixed

1. ✅ **Issue**: Competitors only plotted for few days when requesting larger date range
   - **Fix**: Backend now ensures complete date arrays
   - **Test**: Verify competitors plot for full 30-day range

2. ✅ **Issue**: Brand data missing for some dates
   - **Fix**: Brand summary aggregation now handles all dates
   - **Test**: Verify brand plots for complete date range

3. ✅ **Issue**: Date arrays misaligned between entities
   - **Fix**: Frontend now aligns all data arrays with master dates
   - **Test**: Verify all entities use same date labels

---

## Debugging Tips

### If Charts Still Show Gaps:
1. Check backend logs for array length mismatches
2. Check frontend console for alignment warnings
3. Verify `allDates.length` matches collector date arrays
4. Check network response - verify timeSeries.dates arrays have correct length

### If Data Doesn't Plot:
1. Check browser console for errors
2. Verify data arrays are not empty
3. Check that `chartDateLabels.length === dataArray.length`
4. Verify timeSeries data exists in API response

### Backend Debugging:
- Look for `[TimeSeries]` log entries
- Check for `⚠️` warnings about array length mismatches
- Verify `allDates` generation includes all requested dates

---

## Test Results Template

```
Test #: [Number]
Date: [Date]
Tester: [Name]
Brand: inSiderSports
Date Range: [Range tested]

Results:
- Brand plotting: ✅/❌
- Competitors plotting: ✅/❌
- LLM slices plotting: ✅/❌
- Console warnings: ✅/❌ (none found)
- Backend logs: ✅/❌ (correct)
- Notes: [Any issues found]

Status: PASS / FAIL
```
