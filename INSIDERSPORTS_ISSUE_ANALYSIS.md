# InsiderSports Chart Issue - Root Cause Analysis & Fix

## Problem Summary

**Symptom**: Charts for InsiderSports brand only show data for the last few days (Thu 22 - Sun 25), even though tables show data exists for the full date range (Thu 1 - Sun 25).

**User Context**: 
- Brand customer_id was changed
- Issue affects **both brand AND competitors** (confirmed)
- Not a timezone issue

**Competitor Impact**: 
- Competitor data comes from same `metric_facts` table
- Competitor rows are created from same `positionRows` that filter by customer_id
- Old competitor data has old customer_id → excluded from queries
- Result: Competitors also only show last few days

## Root Cause Analysis

### Primary Issue: Customer ID Mismatch

When a brand's `customer_id` is changed:

1. **Old data** in `metric_facts` table still has the **old customer_id**
2. **New data** has the **new customer_id**
3. Dashboard query filters by **new customer_id** (line 115 in payload-builder.ts)
4. Query returns **only recent data** (with new customer_id)
5. **Old data is excluded** (has old customer_id)

### Secondary Issue: Flawed Fallback Logic

The fallback logic had a critical flaw:

```typescript
// OLD CODE (BROKEN)
const primary = await fetchPositions(true, true)  // With customer_id filter
if (!primary.error && (primary.data?.length ?? 0) > 0) {
  return primary  // ❌ Returns even if data is sparse!
}
// Fallback never runs if ANY data is returned
```

**Problem**: 
- If query returns SOME data (recent days with new customer_id), fallback never triggers
- Fallback only runs when **ZERO data** is returned
- Result: Only recent data is shown, old data is ignored

### Why Database Trigger Didn't Help

There IS a database trigger (`brands_customer_id_cascade`) that should update `metric_facts.customer_id` when `brands.customer_id` changes. However:

1. **Trigger may not have run** if customer_id was changed before trigger was created
2. **Trigger may have failed** silently
3. **Data created after change** but before trigger execution may have old customer_id
4. **Even if trigger ran**, the fallback logic issue would still cause problems

## Solution Implemented

### 1. Smart Date Coverage Detection

Modified fallback logic to check **date coverage** instead of just data presence:

```typescript
// NEW CODE (FIXED)
const primary = await fetchPositions(true, true)
if (!primary.error && (primary.data?.length ?? 0) > 0) {
  // Extract unique dates from returned data
  const returnedDates = new Set<string>()
  primary.data.forEach(row => {
    const date = extractDateForCoverage(row.created_at)
    if (date) returnedDates.add(date)
  })
  
  // Check coverage: need at least 50% of date range
  const dateCoverage = returnedDates.size / expectedDays
  const hasGoodCoverage = dateCoverage >= 0.5
  
  if (hasGoodCoverage) {
    return primary
  } else {
    // Use fallback (brand-only, no customer_id filter)
    console.warn('Sparse data detected, using fallback...')
  }
}
```

### 2. Improved Fallback

When sparse data is detected:
- Automatically uses **brand-only query** (no customer_id filter)
- This includes **all data** regardless of customer_id
- Logs coverage statistics for debugging

## Fix for InsiderSports

### Immediate Fix (Code)

The code fix is already implemented. When you restart the backend:

1. Dashboard will detect sparse data (< 50% date coverage)
2. Automatically use brand-only query (includes all data)
3. Charts should show full date range

**Expected Logs**:
```
[Dashboard] Primary query returned sparse data (4/25 dates, 16.0% coverage)
[Dashboard] Fallback used for extracted_positions (brand only)
```

### Long-term Fix (Database)

To fix the root cause in the database, run:

```bash
# Option 1: Use the fix script
npx ts-node backend/scripts/fix-brand-customer-id.ts insidersports

# Option 2: Manual SQL
# First, get the brand ID and current customer_id
SELECT id, name, customer_id FROM brands WHERE name ILIKE '%insidersports%';

# Then update metric_facts (replace BRAND_ID and CUSTOMER_ID)
UPDATE metric_facts 
SET customer_id = 'CUSTOMER_ID'
WHERE brand_id = 'BRAND_ID';
```

## Verification Steps

### 1. Check Backend Logs

After restart, look for:
- `[Dashboard] Primary query returned sparse data` - Confirms detection
- `[Dashboard] Fallback used` - Confirms fix is working
- Coverage percentages should improve after fallback

### 2. Check Charts

- Navigate to `/measure` with InsiderSports brand
- Select 30-day date range
- Verify all entities (brand, competitors) plot for full range
- Should see data from Thu 1 to Sun 25 (not just Thu 22-25)

### 3. Check Database

```sql
-- Check customer_id distribution
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT customer_id) as distinct_customers,
  customer_id
FROM metric_facts
WHERE brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
GROUP BY customer_id;

-- Should show only ONE customer_id matching brand's current customer_id
```

## Files Modified

1. **`backend/src/services/brand-dashboard/payload-builder.ts`**
   - Added `extractDateForCoverage()` helper
   - Added `calculateExpectedDays()` helper
   - Modified `positionsPromise` to check date coverage
   - Improved fallback logic to trigger on sparse data

2. **`backend/scripts/fix-brand-customer-id.ts`** (NEW)
   - Utility script to fix customer_id mismatches
   - Can be run manually for any brand

3. **`CUSTOMER_ID_MISMATCH_FIX.md`** (NEW)
   - Documentation of the issue and fix

## Expected Behavior After Fix

### Before Fix
- **Brand charts**: Only last few days (Thu 22-25)
- **Competitor charts**: Only last few days (Thu 22-25)
- **Tables**: Show full data (Thu 1-25)
- **Mismatch**: Charts vs tables inconsistent

### After Fix
- **Brand charts**: Full date range (Thu 1-25) ✅
- **Competitor charts**: Full date range (Thu 1-25) ✅
- **Tables**: Show full data (Thu 1-25) ✅
- **Consistent**: All views show same data ✅
- **Backend logs**: Show fallback usage when sparse data detected ✅

## Prevention

1. **Always update metric_facts** when changing brand customer_id
2. **Check trigger exists**: `SELECT * FROM pg_trigger WHERE tgname = 'brands_customer_id_cascade';`
3. **Monitor logs** for sparse data warnings
4. **Run fix script** after customer_id changes if needed

## Testing Checklist

- [ ] Restart backend server
- [ ] Navigate to `/measure` with InsiderSports
- [ ] Select 30-day date range
- [ ] **Verify brand plots for full range** (Thu 1-25)
- [ ] **Verify ALL competitors plot for full range** (Thu 1-25) ← Critical!
- [ ] Check backend logs for fallback messages
- [ ] Verify no console warnings in browser
- [ ] Test with different date ranges (7 days, 30 days, 90 days)
- [ ] Verify competitor data in tables matches competitor charts
- [ ] Check that competitor lines don't disappear after few days
