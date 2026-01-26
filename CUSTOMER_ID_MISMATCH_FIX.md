# Customer ID Mismatch Fix - InsiderSports Issue

## Problem Identified

When a brand's `customer_id` is changed, historical data in `metric_facts` table may still have the old `customer_id`. This causes:

1. **Dashboard queries filter by new customer_id** → Only finds recent data (with new customer_id)
2. **Old data (with old customer_id) is excluded** → Charts show only last few days
3. **Fallback logic doesn't trigger** → Because SOME data is returned (recent data), fallback never runs

### Root Cause

The fallback logic in `payload-builder.ts` only triggers when **NO data** is returned:
```typescript
if (!primary.error && (primary.data?.length ?? 0) > 0) {
  return primary  // Returns even if data is sparse!
}
```

When customer_id changes:
- Old data: `customer_id = old_customer_id`
- New data: `customer_id = new_customer_id`
- Query with new customer_id returns SOME data (new data only)
- Fallback never triggers because `data.length > 0`
- Result: Only recent data is shown

## Solution Implemented

### 1. Smart Fallback Detection

Modified `positionsPromise` to check **date coverage** instead of just data presence:

```typescript
// Check if we have data for at least 50% of the requested date range
const dateCoverage = returnedDates.size / allDates.length
const hasGoodCoverage = dateCoverage >= 0.5

if (hasGoodCoverage) {
  return primary
} else {
  // Use fallback (brand-only query, no customer_id filter)
  console.warn('Sparse data detected, using fallback...')
}
```

### 2. Database Trigger (Already Exists)

There's a migration `20260126000000_add_customer_id_cascade_trigger.sql` that should automatically update `metric_facts.customer_id` when `brands.customer_id` changes. However:
- Trigger may not have run if customer_id was changed before trigger was created
- Trigger may have failed silently
- Data created after customer_id change but before trigger execution

## Fix for InsiderSports

### Option 1: Manual SQL Update (Recommended)

Run this SQL to update all metric_facts for the brand:

```sql
-- Get the current customer_id for the brand
SELECT id, name, customer_id 
FROM brands 
WHERE name ILIKE '%insidersports%' OR slug ILIKE '%insidersports%';

-- Update metric_facts (replace BRAND_ID and NEW_CUSTOMER_ID)
UPDATE metric_facts 
SET customer_id = 'NEW_CUSTOMER_ID'
WHERE brand_id = 'BRAND_ID';
```

### Option 2: Let the Code Fix It

The improved fallback logic will automatically use brand-only queries when sparse data is detected, so charts should work correctly even with mismatched customer_ids.

## Verification

After fix, check:

1. **Backend logs** should show:
   ```
   [Dashboard] Primary query returned sparse data (X/Y dates, Z% coverage)
   [Dashboard] Fallback used for extracted_positions (brand only)
   ```

2. **Charts** should show data for the full date range

3. **Database** - Check customer_id consistency:
   ```sql
   SELECT 
     COUNT(*) as total_rows,
     COUNT(DISTINCT customer_id) as distinct_customers,
     customer_id
   FROM metric_facts
   WHERE brand_id = 'BRAND_ID'
   GROUP BY customer_id;
   ```
   
   Should show only ONE distinct customer_id matching the brand's current customer_id.

## Prevention

1. **Always run migrations** when changing customer_id
2. **Check trigger exists**: 
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'brands_customer_id_cascade';
   ```
3. **Monitor logs** for sparse data warnings

## Files Modified

1. `backend/src/services/brand-dashboard/payload-builder.ts`
   - Added `extractDateForCoverage` helper function
   - Modified `positionsPromise` to check date coverage
   - Improved fallback logic to trigger on sparse data
