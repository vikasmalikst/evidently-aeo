# Competitor Data Customer ID Impact Analysis

## Confirmation: Competitors ARE Affected

Yes, competitor data is **definitely impacted** by the customer_id change. Here's why:

## Data Flow Analysis

### 1. Competitor Data Source

Competitor data comes from the **same `metric_facts` table** that stores brand data:

```
metric_facts (has customer_id)
  ├── brand_metrics (via metric_fact_id)
  └── competitor_metrics (via metric_fact_id)  ← Competitor data
```

### 2. Query Path

**Main Competitor Data** (lines 2517-2580 in payload-builder.ts):
- Comes from `positionRows` array
- `positionRows` comes from `fetchPositions()` function
- `fetchPositions(true, true)` **filters by customer_id** (line 115)
- Result: Only competitor data with **new customer_id** is returned

**Competitor Lookback** (lines 2950-2970):
- Queries `metric_facts` directly
- **Does NOT filter by customer_id** (only filters by brand_id)
- This is only for initialization, not main data

### 3. The Problem

When customer_id changes:
1. **Old competitor data** in `metric_facts` has **old customer_id`
2. **New competitor data** has **new customer_id`
3. Main query filters by **new customer_id**
4. Only **recent competitor data** is returned
5. **Old competitor data is excluded**

## Impact on Competitors

### What's Affected:
- ✅ **Competitor timeSeries** (daily visibility, share, sentiment)
- ✅ **Competitor aggregation** (total visibility, share, mentions)
- ✅ **Competitor charts** (only show last few days)
- ✅ **Competitor brand presence** calculations

### What's NOT Affected:
- ✅ **Competitor lookback** (doesn't filter by customer_id)
- ✅ **Competitor list** (comes from `brand_competitors` table, not metric_facts)

## Why the Fix Works

The fix I implemented handles competitors automatically:

1. **Date coverage detection** checks ALL data (brand + competitors)
2. When sparse data is detected (< 50% coverage), uses **brand-only query**
3. Brand-only query **doesn't filter by customer_id**
4. This includes **all competitor data** (old and new customer_id)
5. Competitors get full date range in charts

## Verification

### Check Competitor Data Distribution

```sql
-- Check customer_id distribution in metric_facts for this brand
-- This will show if competitor data has mixed customer_ids
SELECT 
  customer_id,
  COUNT(*) as total_rows,
  COUNT(DISTINCT id) as unique_metric_facts,
  MIN(created_at) as earliest_date,
  MAX(created_at) as latest_date
FROM metric_facts mf
WHERE brand_id = '583be119-67da-47bb-8a29-2950eb4da3ea'
  AND EXISTS (
    SELECT 1 FROM competitor_metrics cm 
    WHERE cm.metric_fact_id = mf.id
  )
GROUP BY customer_id
ORDER BY customer_id;
```

### Expected Results

**Before Fix:**
- Query with new customer_id returns only recent competitor data
- Charts show competitors only for last few days

**After Fix:**
- Sparse data detection triggers fallback
- Fallback includes all competitor data (regardless of customer_id)
- Charts show competitors for full date range

## Database Fix

The same fix script works for competitors too, since competitor data is in `metric_facts`:

```bash
# This updates ALL metric_facts (including competitor data)
npx ts-node backend/scripts/fix-brand-customer-id.ts insidersports
```

Or manually:
```sql
-- Updates all metric_facts (brand + competitor data)
UPDATE metric_facts 
SET customer_id = (SELECT customer_id FROM brands WHERE id = 'BRAND_ID')
WHERE brand_id = 'BRAND_ID';
```

## Summary

✅ **Competitors ARE affected** by customer_id change
✅ **Fix handles competitors automatically** (same fallback logic)
✅ **Database fix updates both** brand and competitor data
✅ **No separate competitor fix needed** - it's all in `metric_facts`

The fix I implemented will automatically detect sparse competitor data and use the fallback query, which includes all competitor data regardless of customer_id.
