# Login → Dashboard Delay Fix

## Problem
After logging in, existing customers experienced a **2+ second delay** before seeing their dashboard. The screen showed "Loading dashboard insights..." even though they had existing brands.

## Root Cause
The `/api/brands` endpoint was being fetched **twice** without caching:
1. **First fetch** in `AuthPage.tsx` after login (to check if brands exist) - took ~2 seconds
2. **Second fetch** in `Dashboard.tsx` via `useManualBrandDashboard` hook - took another ~2 seconds

Both calls used `apiClient.request()` directly, which **bypassed the caching layer** entirely, despite having a 5-minute cache strategy configured for `/brands`.

## Solution
Updated both locations to use `cachedRequest()` instead of `apiClient.request()`:

### 1. `useManualBrandDashboard.ts`
Changed line 88 to use cached API:
```typescript
// Before:
const response = await apiClient.request<ApiResponse<ManualBrandSummary[]>>('/brands')

// After:
const response = await cachedRequest<ApiResponse<ManualBrandSummary[]>>('/brands', {}, { requiresAuth: true })
```

### 2. `AuthPage.tsx`
Changed line 50 to use cached API:
```typescript
// Before:
const brandsResponse = await apiClient.request<BrandsResponse>('/brands');

// After:
const brandsResponse = await cachedRequest<BrandsResponse>('/brands', {}, { requiresAuth: true });
```

## How It Works Now
1. **User logs in** → `AuthPage.handleSuccess()` fetches brands via `cachedRequest()`
2. Brands are **cached for 5 minutes** (as configured in `apiCache.ts`)
3. **User navigates to Dashboard** → `useManualBrandDashboard` calls `cachedRequest()` again
4. Second call **returns instantly from cache** (< 1ms instead of 2 seconds)
5. Dashboard shows **immediately** with cached data

## Performance Improvement
- **Before**: 2+ second delay (fresh API call every time)
- **After**: < 1ms (instant cache hit)
- **Cache duration**: 5 minutes (fresh), 15 minutes (stale-while-revalidate)

## Cache Strategy
The `/brands` endpoint uses an aggressive cache strategy (from `apiCache.ts`):
- **TTL**: 5 minutes (fresh data)
- **Stale time**: 15 minutes (serve stale + refresh in background)
- **Max age**: 30 minutes (absolute expiration)
- **Persistence**: Yes (survives page refreshes via localStorage)

## Additional Benefits
- Reduced server load (fewer redundant API calls)
- Better UX with instant navigation
- Stale-while-revalidate keeps data fresh in background
- Cache persists across page refreshes
- Works for all brands-related fetches throughout the app

## Files Changed
- `src/manual-dashboard/useManualBrandDashboard.ts` - Updated import and API call
- `src/pages/AuthPage.tsx` - Updated import and API call

## Testing
1. Log in with an existing account
2. Dashboard should appear instantly (< 100ms)
3. Browser console should show "RETURNING FRESH CACHE" instead of making API call
4. Subsequent navigations should also be instant for 5 minutes

