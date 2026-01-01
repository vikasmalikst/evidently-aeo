# Code Path & Supabase Queries - "Collect & Score" Button

## Complete Code Flow

### 1. Frontend: Button Click
**File:** `src/pages/admin/ScheduledJobs.tsx`
**Line:** ~420

```tsx
<button onClick={() => handleCollectAndScoreNow(selectedBrandId)}>
  Collect & Score
</button>
```

### 2. Frontend: Handler Function
**File:** `src/pages/admin/ScheduledJobs.tsx`
**Line:** ~191-220

```tsx
const handleCollectAndScoreNow = async (brandId: string) => {
  const response = await apiClient.post(
    `/admin/brands/${brandId}/collect-and-score-now`,
    {
      customer_id: customerId,  // '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
    }
  );
}
```

**API Call:**
```
POST /api/admin/brands/838ba1a6-3dec-433d-bea9-a9bc278969ea/collect-and-score-now
Body: { customer_id: "8ce361f9-6120-4c64-a441-5ec33a1dfc77" }
```

### 3. Backend: Route Handler
**File:** `backend/src/routes/admin.routes.ts`
**Line:** ~860-920

```typescript
router.post('/brands/:brandId/collect-and-score-now', async (req, res) => {
  const { brandId } = req.params;  // '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  const { customer_id } = req.body; // '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
  
  // Calls dataCollectionJobService.executeDataCollection()
  const collectionResult = await dataCollectionJobService.executeDataCollection(
    brandId,
    customer_id,
    { collectors, locale, country }
  );
});
```

### 4. Backend: Data Collection Service
**File:** `backend/src/services/jobs/data-collection-job.service.ts`
**Line:** ~31-100

## Exact Supabase Queries Executed

### Query 1: Check All Queries (Debug)
**File:** `backend/src/services/jobs/data-collection-job.service.ts`
**Line:** ~56-60

```typescript
const { data: allQueries, error: allQueriesError } = await supabase
  .from('generated_queries')
  .select('id, query_text, topic, intent, locale, country, brand_id, customer_id, is_active')
  .eq('brand_id', brandId)           // '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  .eq('customer_id', customerId);    // '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
```

**Equivalent SQL:**
```sql
SELECT 
  id, 
  query_text, 
  topic, 
  intent, 
  locale, 
  country, 
  brand_id, 
  customer_id, 
  is_active
FROM generated_queries
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77';
```

**Result from your logs:** `Total queries found (any status): 0`
**This means:** NO queries exist at all for this brand_id + customer_id combination!

### Query 2: Get Active Queries Only
**File:** `backend/src/services/jobs/data-collection-job.service.ts`
**Line:** ~82-86

```typescript
let queryBuilder = supabase
  .from('generated_queries')
  .select('id, query_text, topic, intent, locale, country')
  .eq('brand_id', brandId)           // '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  .eq('customer_id', customerId)     // '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
  .eq('is_active', true);            // boolean true
```

**Equivalent SQL:**
```sql
SELECT 
  id, 
  query_text, 
  topic, 
  intent, 
  locale, 
  country
FROM generated_queries
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
  AND is_active = true;
```

**Result from your logs:** `Active queries found: 0`

## The Problem

Your debug output shows:
```
Total queries found (any status): 0
```

This means **NO queries exist** in the `generated_queries` table for:
- `brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'`
- `customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77'`

## How to Verify

Run this SQL query in Supabase to check:

```sql
-- Check if ANY queries exist for this brand
SELECT 
  id,
  query_text,
  brand_id,
  customer_id,
  is_active,
  created_at
FROM generated_queries
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea';
```

If this returns 0 rows, then:
1. Queries were never created during onboarding
2. Queries exist but with a different brand_id
3. Queries exist but with a different customer_id

## How to Check What Brand/Customer IDs Your Queries Have

```sql
-- See all queries and their brand/customer IDs
SELECT 
  id,
  query_text,
  brand_id,
  customer_id,
  is_active,
  created_at
FROM generated_queries
ORDER BY created_at DESC
LIMIT 20;
```

This will show you:
- What brand_ids exist in your queries
- What customer_ids exist in your queries
- Whether they match what you're searching for

## Solution

You need to either:

1. **Create queries for this brand** (if they don't exist)
2. **Use the correct brand_id** (if queries exist for a different brand)
3. **Use the correct customer_id** (if queries exist for a different customer)
4. **Re-run onboarding** to create queries properly

## Code Locations Summary

| Step | File | Line | What It Does |
|------|------|------|--------------|
| 1. Button Click | `src/pages/admin/ScheduledJobs.tsx` | ~420 | User clicks button |
| 2. Frontend Handler | `src/pages/admin/ScheduledJobs.tsx` | ~191 | Makes API call |
| 3. Backend Route | `backend/src/routes/admin.routes.ts` | ~860 | Receives request |
| 4. Service Method | `backend/src/services/jobs/data-collection-job.service.ts` | ~31 | Executes collection |
| 5. Supabase Query | `backend/src/services/jobs/data-collection-job.service.ts` | ~56-86 | Queries database |

## Exact Query Being Executed

The backend executes this Supabase query:

```typescript
supabase
  .from('generated_queries')
  .select('id, query_text, topic, intent, locale, country')
  .eq('brand_id', '838ba1a6-3dec-433d-bea9-a9bc278969ea')
  .eq('customer_id', '8ce361f9-6120-4c64-a441-5ec33a1dfc77')
  .eq('is_active', true)
```

**This is equivalent to:**
```sql
SELECT id, query_text, topic, intent, locale, country
FROM generated_queries
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
  AND is_active = true;
```

**Your result:** 0 rows (no queries found)

