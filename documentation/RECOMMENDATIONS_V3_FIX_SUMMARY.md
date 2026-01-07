# Recommendations V3 - Fixed Persistence and Brand Switching Issues

## Issues Fixed

### 1. **Brand Switching Not Updating Data**
**Problem:** When switching brands, the old brand's recommendations would persist because `generationId` was not being cleared.

**Solution:** Created `handleBrandSwitch()` that:
- Clears all state (generationId, recommendations, selections, content, etc.)
- Resets to Step 1
- Then updates the brand, triggering a fresh data load

### 2. **Page Refresh Redirecting to Wrong Step**
**Problem:** On page refresh, the automatic step detection would jump to Step 2 if any recommendations were approved, ignoring user's intended view.

**Solution:** Added `isFirstLoadRef` to distinguish between:
- **First load:** Auto-detect the most relevant step based on data state
- **Brand switch:** Always reset to Step 1 to show new brand's recommendations
- **Manual navigation:** Preserve user's chosen step

### 3. **Inconsistent Step Persistence**
**Problem:** The `loadLatestGeneration` effect would run multiple times and override the current step unpredictably.

**Solution:** 
- Only run step auto-detection on the very first page load
- After first load, preserve user's step selection
- When switching brands, reset to Step 1 (not auto-detect)

## Changes Made

### File: `src/pages/RecommendationsV3.tsx`

#### 1. Added Brand Switch Handler (lines 215-231)
```typescript
const handleBrandSwitch = useCallback((newBrandId: string) => {
  console.log(`🔄 [RecommendationsV3] Switching from brand ${selectedBrandId} to ${newBrandId}`);
  
  // Clear all state related to the current brand
  setGenerationId(null);
  setRecommendations([]);
  setSelectedIds(new Set());
  setCompletedIds(new Set());
  setContentMap(new Map());
  setExpandedSections(new Map());
  setError(null);
  setCurrentStep(1);
  
  // Now update the brand - this will trigger loadLatestGeneration
  selectBrand(newBrandId);
}, [selectedBrandId, selectBrand]);
```

#### 2. Updated Brand Selector (line 1194)
Changed from:
```typescript
onChange={(e) => selectBrand(e.target.value)}
```

To:
```typescript
onChange={(e) => handleBrandSwitch(e.target.value)}
```

#### 3. Improved Step Detection Logic (lines 233-310)
- Added `isFirstLoadRef` to track if this is the first page load
- On first load: Auto-detect most relevant step based on data
- On brand switch: Always start at Step 1
- Removed the condition that prevented loading when `generationId` exists
- Now properly handles generation switching for different brands

## How It Works Now

### First Page Load (or Hard Refresh)
1. Page loads, `isFirstLoadRef = true`
2. Fetches latest generation for selected brand
3. Auto-detects best step based on data:
   - Step 1: No approved recommendations
   - Step 2: Has approved but no content generated
   - Step 3: Has content generated but not all completed
   - Step 4: All recommendations completed
4. Sets `isFirstLoadRef = false`

### Brand Switching
1. User selects different brand
2. `handleBrandSwitch()` clears all state
3. Resets to Step 1
4. Fetches latest generation for new brand
5. Loads Step 1 recommendations for new brand
6. User stays at Step 1 (not auto-detected)

### Manual Step Navigation
1. User clicks step indicator
2. Loads data for that step
3. Step persists even on page refresh (first load auto-detection takes over)

## Testing Instructions

### Test 1: Brand Switching
1. Go to Recommendations V3 page
2. Note current brand and recommendations
3. Switch to different brand from dropdown
4. **Expected:** Page shows new brand's recommendations at Step 1
5. **Expected:** No old brand data visible

### Test 2: Page Refresh Persistence
1. Navigate to Step 2 or Step 3
2. Refresh the page (F5 or Cmd+R)
3. **Expected:** Page loads at the most relevant step based on data state
4. **Note:** This is intentional - we show the step where user should take action

### Test 3: Step Navigation
1. Click between different steps
2. **Expected:** Each step loads correct filtered data
3. **Expected:** No jumping between steps automatically

### Test 4: Generate New Recommendations
1. Click "Generate Recommendations"
2. Wait for generation to complete
3. **Expected:** Shows Step 1 with all new recommendations
4. Switch brands and back
5. **Expected:** New recommendations still visible

## Architecture Notes

The page now has three distinct loading scenarios:
1. **First Load:** Auto-detect best step
2. **Brand Switch:** Reset to Step 1
3. **Step Navigation:** User-driven, preserved

This provides a better UX by:
- Not confusing users with unexpected step jumps
- Properly isolating data between brands
- Starting fresh when switching contexts
- Auto-resuming workflow on first load

