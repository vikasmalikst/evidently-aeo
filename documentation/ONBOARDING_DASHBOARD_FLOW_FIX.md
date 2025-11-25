# Onboarding to Dashboard Flow Fix

## Issue
After completing onboarding and starting data collection:
1. User sees the `DataCollectionLoadingScreen` for a long time
2. Dashboard keeps showing loading even after data is available in `extracted_positions` table
3. Brand dropdown is not automatically set to the newly onboarded brand
4. Dashboard doesn't show data after 20 seconds as expected

## What the DataCollectionLoadingScreen Shows

The `DataCollectionLoadingScreen` component displays:
1. **Progress Animation**: Animated progress bar showing collection and scoring stages
2. **Real-time Stats**: After 20 seconds, shows available dashboard data:
   - Share of Answer
   - Visibility Index
   - Sentiment Score
   - Total Queries
   - Queries with Brand Presence
   - Average Collection Time
3. **Progress Tracking**: Polls `/api/brands/:brandId/onboarding-progress` every 2 seconds
4. **Auto-navigation**: After 20 seconds, automatically navigates to dashboard

## Root Causes

1. **No Brand Auto-Selection**: Dashboard didn't automatically select the newly onboarded brand when navigating from the loading screen
2. **Loading State Too Strict**: Dashboard was waiting for all scoring to complete before showing data
3. **No Navigation State**: Loading screen didn't pass brandId to dashboard for auto-selection

## Fixes Applied

### 1. Updated DataCollectionLoadingScreen (`DataCollectionLoadingScreen.tsx`)

**Changes:**
- Pass `brandId` and `fromOnboarding` flag in navigation state when navigating to dashboard
- This allows dashboard to detect when coming from onboarding and auto-select the brand

**Code:**
```typescript
navigate('/dashboard', { 
  replace: true,
  state: { 
    autoSelectBrandId: brandId,
    fromOnboarding: true 
  }
});
```

### 2. Updated Dashboard (`Dashboard.tsx`)

**Changes:**
- Added `useLocation` hook to read navigation state
- Added auto-selection logic that:
  - Detects when coming from onboarding
  - Auto-selects the specified brandId from navigation state
  - Falls back to latest brand if specified brand doesn't exist yet
  - Selects latest brand if coming from onboarding but no specific brandId provided

**Auto-Selection Logic:**
```typescript
useEffect(() => {
  if (brandsLoading || brands.length === 0) {
    return;
  }

  const locationState = location.state as { autoSelectBrandId?: string; fromOnboarding?: boolean } | null;
  
  if (locationState?.autoSelectBrandId && locationState.fromOnboarding) {
    const brandToSelect = locationState.autoSelectBrandId;
    const brandExists = brands.some(brand => brand.id === brandToSelect);
    
    if (brandExists && selectedBrandId !== brandToSelect) {
      selectBrand(brandToSelect);
      window.history.replaceState({}, document.title);
    } else if (!brandExists) {
      // Select latest brand if specified brand doesn't exist yet
      const latestBrand = brands[0];
      if (latestBrand && selectedBrandId !== latestBrand.id) {
        selectBrand(latestBrand.id);
        window.history.replaceState({}, document.title);
      }
    }
  } else if (locationState?.fromOnboarding && !selectedBrandId && brands.length > 0) {
    // Select latest brand if coming from onboarding but no specific brandId
    const latestBrand = brands[0];
    if (latestBrand) {
      selectBrand(latestBrand.id);
      window.history.replaceState({}, document.title);
    }
  }
}, [brands, brandsLoading, selectedBrandId, selectBrand, location.state]);
```

**Loading State Fix:**
- Modified `shouldShowLoading` to show data immediately when coming from onboarding, even if scoring is incomplete
- This ensures dashboard shows available data after 20 seconds

**Code:**
```typescript
const locationState = location.state as { fromOnboarding?: boolean } | null;
const fromOnboarding = locationState?.fromOnboarding || false;
const shouldShowLoading = (authLoading || brandSelectionPending || (dashboardLoading && !dashboardData && !fromOnboarding));
```

## Expected Behavior After Fix

1. **After 20 Seconds:**
   - Loading screen navigates to dashboard
   - Dashboard automatically selects the newly onboarded brand
   - Dashboard shows available data immediately (even if scoring is incomplete)
   - Brand name appears in overview subtitle: "Here's your AI visibility performance overview for [Brand Name]"

2. **Brand Selection:**
   - Brand dropdown is automatically set to the newly onboarded brand
   - If brand doesn't exist yet (edge case), selects the latest brand
   - Brand selection is persisted in localStorage

3. **Data Display:**
   - Dashboard shows whatever data is available (from `extracted_positions`, `collector_results`, etc.)
   - Doesn't wait for all scoring to complete
   - Shows "Data Collection In Progress" banner if collection is still ongoing
   - Data updates automatically as more results become available

## Testing

1. **Complete Onboarding:**
   - Go through onboarding flow
   - Start data collection
   - Wait 20 seconds

2. **Verify Dashboard:**
   - Dashboard should load automatically
   - Brand dropdown should show the newly onboarded brand
   - Overview subtitle should show: "Here's your AI visibility performance overview for [Brand Name]"
   - Dashboard should show available data (even if scoring is incomplete)

3. **Verify Data Updates:**
   - Check that data appears as it becomes available
   - Verify "Data Collection In Progress" banner appears if collection is ongoing
   - Confirm data updates automatically

## Notes

- The dashboard will show data as soon as it's available, even if scoring (position extraction, sentiment scoring, citation extraction) is still in progress
- The "Data Collection In Progress" banner will appear if collection is still ongoing
- Brand selection is persisted, so refreshing the page will maintain the selected brand
- The overview subtitle automatically uses the selected brand name from `selectedBrand?.name` or `dashboardData.brandName`


