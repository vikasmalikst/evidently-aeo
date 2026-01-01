# Deleted Brand Error Fix

## Problem Description

When a brand is deleted directly from Supabase, the application can encounter a 404 error because:

1. **The brand ID remains stored in localStorage** under the key `'manual-dashboard:selected-brand'`
2. **The dashboard tries to load data immediately** for this deleted brand before validation occurs
3. **The API returns a 404 error** with "Brand not found for current customer"
4. **Only after the brands list is fetched**, the validation runs and corrects the brand selection

## Error Message Example

```
:3000/api/brands/838ba1a6-3dec-433d-bea9-a9bc278969ea/dashboard?startDate=2025-11-25&endDate=2025-12-24:1  
Failed to load resource: the server responded with a status of 404 (Not Found)

[apiCache] ❌ API request failed - Error: Brand not found for current customer
```

## Root Cause

This is a **race condition** in the data loading flow:

1. `useManualBrandDashboard` hook initializes `selectedBrandId` from localStorage (deleted brand ID)
2. `useDashboardData` hook creates a dashboard endpoint with this deleted brand ID
3. API call is made immediately → 404 error
4. Meanwhile, brands are being fetched in the background
5. Once brands are loaded, validation runs and updates `selectedBrandId` to a valid brand
6. But the error has already been logged and displayed

## Solution Implemented

### Code Changes

Modified `/src/pages/dashboard/hooks/useDashboardData.ts` to:

1. **Wait for brands to load** before creating the dashboard endpoint
2. **Validate brand existence** before making any API calls
3. **Prevent 404 errors** by checking if the selected brand exists in the brands list

### Key Changes

```typescript
const dashboardEndpoint = useMemo(() => {
  // Wait for brands to load before creating endpoint to prevent 404 errors
  if (brandsLoading) {
    return null;
  }
  
  // Ensure we have a valid brand selected
  if (!selectedBrandId || !startDate || !endDate) {
    return null;
  }
  
  // Additional safety check: ensure the selected brand actually exists
  const brandExists = brands.some(b => b.id === selectedBrandId);
  if (!brandExists) {
    console.warn(`Selected brand ${selectedBrandId} does not exist. Waiting for validation...`);
    return null;
  }
  
  // ... create endpoint
}, [selectedBrandId, startDate, endDate, reloadKey, isDataCollectionInProgress, brandsLoading, brands]);
```

## How It Works Now

1. Dashboard checks if brands are still loading (`brandsLoading` flag)
2. If brands are loading, **no endpoint is created** (prevents premature API calls)
3. Once brands are loaded, it validates that `selectedBrandId` exists in the brands list
4. If the brand doesn't exist, **no endpoint is created** and the validation in `useManualBrandDashboard` runs
5. `useManualBrandDashboard` automatically selects the first available brand or clears the selection
6. Dashboard endpoint is then created with the corrected brand ID

## What Happens When You Delete a Brand

### Before the Fix:
1. ❌ 404 error displayed to user
2. ❌ Error logged in console
3. ✅ Eventually corrects itself after brands load

### After the Fix:
1. ✅ Brands load first
2. ✅ Brand selection is validated
3. ✅ Invalid brand ID is automatically replaced with first available brand
4. ✅ No errors displayed to user
5. ✅ Smooth transition to valid brand

## Manual Cleanup (If Needed)

If you still see issues, you can manually clear the cached data:

### Option 1: Browser Console
Open browser console and run:
```javascript
// Clear the selected brand from localStorage
localStorage.removeItem('manual-dashboard:selected-brand');

// Clear all API cache
localStorage.clear();

// Reload the page
location.reload();
```

### Option 2: Application UI
1. Simply **log out and log back in** - this clears all cached data
2. Or **navigate to a different page** and back to the dashboard

## Prevention

To prevent this issue in the future:

### When Deleting Brands from Supabase:

1. **Use the application UI** to delete brands instead of directly in Supabase
2. Or **ensure you clear browser cache** after manual database changes
3. Or **notify users** to refresh their browser

### For Developers:

The fix is now in place and will automatically handle:
- Deleted brands
- Renamed brands
- Brand ID changes
- Empty brand lists

## Testing

To verify the fix works:

1. **Select a brand** in the dashboard
2. **Delete that brand** directly from Supabase
3. **Refresh the dashboard page**
4. **Expected behavior**: 
   - No 404 error
   - Dashboard automatically selects the first available brand
   - Smooth loading experience

## Technical Details

### Files Modified:
- `/src/pages/dashboard/hooks/useDashboardData.ts`

### Key Hooks Involved:
- `useManualBrandDashboard` - Manages brand list and selection with validation
- `useDashboardData` - Creates dashboard endpoint and fetches data (now with validation)
- `useCachedData` - Handles API caching with stale-while-revalidate pattern

### Dependencies Updated:
- Added `brandsLoading` and `brands` to the `dashboardEndpoint` useMemo dependencies
- This ensures the endpoint is recreated when brands are loaded or changed

## Impact

- **No breaking changes** - backwards compatible with existing code
- **Improved user experience** - no more 404 errors when brands are deleted
- **Better error handling** - graceful fallback to valid brands
- **Automatic recovery** - system self-heals without user intervention

## Related Files

- `/src/manual-dashboard/useManualBrandDashboard.ts` - Brand selection logic with validation (lines 105-146)
- `/src/hooks/useCachedData.ts` - Caching hook used by dashboard
- `/src/lib/apiCache.ts` - API caching layer with stale-while-revalidate
- `/src/lib/apiClient.ts` - Low-level API client with error handling

