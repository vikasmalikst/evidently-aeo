# Timezone Fix - Manual Verification Steps

Since automated browser testing is rate-limited, please manually verify the fix:

## Steps to Verify

1. **Open your browser** to `http://localhost:5173/measure`

2. **Open Developer Tools** (F12 or Right-click → Inspect)

3. **Go to the Network tab**

4. **Refresh the page**

5. **Find the dashboard API request** (should be `/api/brands/.../dashboard?...`)

6. **Check the Request URL** - it should now include `timezoneOffset=300` (for EST)

7. **Click on the request** and view the **Response** tab

8. **Navigate to** `data.llmVisibility[0].timeSeries.dates`

9. **Check the last date** in the array:
   - ✅ **Expected**: `"2026-01-20"` (your local date in EST)
   - ❌ **Before fix**: `"2026-01-21"` (UTC date)

10. **Look at the chart** - the last x-axis label should show "Mon 20" or "Tue 20" (depending on what day Jan 20 is)

## What Changed

### Backend (`payload-builder.ts`)
- `generateDateRange` now applies timezone offset when extracting dates from ISO timestamps
- Converts UTC bounds to local dates before generating the date array

### Frontend (3 files)
- `MeasurePage.tsx` - Added `timezoneOffset` parameter
- `useDashboardData.ts` - Added `timezoneOffset` parameter  
- `SearchVisibility.tsx` - Added `timezoneOffset` parameter

## Expected Result

The chart should now display dates in your local timezone (EST), so when it's Jan 20 at 23:47 EST, the chart ends at Jan 20, not Jan 21.
