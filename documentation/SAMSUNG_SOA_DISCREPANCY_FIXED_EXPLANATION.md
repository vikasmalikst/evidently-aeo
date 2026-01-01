# Why Samsung SOA Differs: Topics Page (25.52%) vs Search Visibility (48%)

## The Real Issue
Both pages show **Samsung's SOA**, but they use **different data sources**:

1. **Topics Page (25.52%)**: Samsung SOA from **ALL brands** in your customer account
2. **Search Visibility (48%)**: Samsung SOA from **your current brand (SanDisk) only**

---

## Topics Page: Samsung SOA Per Topic (25.52%)

### Data Source
**File:** `brand.service.ts` → `getIndustryAvgSoAPerTopic()` (lines 1817-1830)

```typescript
// Queries ALL brands in customer account
const { data: positions } = await supabaseAdmin
  .from('extracted_positions')
  .select('...')
  .eq('customer_id', customerId)  // ALL brands for this customer
  .gte('processed_at', startIso)
  .lte('processed_at', endIso)
```

### When Samsung Filter is Selected (lines 1938-1943):
```typescript
if (competitorNames && competitorNames.length === 1 && data.competitorSoAMap) {
  const singleCompetitor = competitorNames[0]; // "samsung"
  const competitorValues = data.competitorSoAMap.get(singleCompetitor) || [];
  if (competitorValues.length > 0) {
    // Samsung's SOA per topic
    avgSoA = competitorValues.reduce((sum, val) => sum + val, 0) / competitorValues.length;
  }
}
```

### What This Means:
- ✅ Samsung-specific (filtered correctly)
- ✅ Per-topic calculation
- ✅ **Data from ALL brands**: Includes Samsung SOA from queries of ALL brands in your customer account
- ✅ Then averaged: (Samsung per-topic averages) → 25.52%

**Example:**
- Brand A's queries mention Samsung → SOA values collected
- Brand B's queries mention Samsung → SOA values collected  
- Brand C (SanDisk) queries mention Samsung → SOA values collected
- **All combined** → averaged per topic → 25.52%

---

## Search Visibility: Samsung Overall SOA (48%)

### Data Source
**File:** `payload-builder.ts` → `buildDashboardPayload()` (lines 62-67)

```typescript
// Queries ONLY current brand (SanDisk)
const query = supabaseAdmin
  .from('extracted_positions')
  .select('...')
  .eq('brand_id', brand.id)  // SanDisk ONLY
  .eq('customer_id', customerId)
  .gte('processed_at', startIso)
  .lte('processed_at', endIso)
```

### Calculation (lines 757 + visibility.service.ts line 217):
```typescript
// Collect Samsung competitor SOA values from SanDisk's queries only
competitorAggregate.shareValues.push(competitorShare)

// Then calculate:
share = average(all Samsung competitor SOA values) // From SanDisk's queries only
```

### What This Means:
- ✅ Samsung-specific
- ✅ Overall (all topics combined)
- ✅ **Data from SanDisk only**: Only includes Samsung SOA from SanDisk's queries
- ✅ Simple average: `average(all Samsung SOA values)` = 48%

**Example:**
- SanDisk's queries mention Samsung → SOA values: [50%, 45%, 48%, 49%, ...]
- **Averaged** → 48%

---

## Why They're Different: Data Source

### The Problem:

**Topics Page**: 
- Queries: `WHERE customer_id = X` (all brands)
- Includes Samsung data from Brand A, Brand B, Brand C (SanDisk), etc.
- More data points → potentially different average

**Search Visibility**:
- Queries: `WHERE brand_id = 'sanDisk-id' AND customer_id = X` (SanDisk only)
- Only includes Samsung data from SanDisk's queries
- Fewer data points → different average

---

## The Fix: Make Search Visibility Match Topics Page

To make Search Visibility show the same 25.52%, we need to:

### Option 1: Use Same Data Source (All Brands)

**Change Search Visibility to query all brands** (like Topics page):

**File:** `payload-builder.ts` → Remove brand_id filter when calculating competitor visibility

**But wait!** This would affect the entire dashboard - it's designed to show data for the current brand only.

### Option 2: Make Topics Page Match Search Visibility

**Change Topics Page to query current brand only** (like Search Visibility):

**File:** `brand.service.ts` → `getIndustryAvgSoAPerTopic()` → Add brand_id filter

**But wait!** The Topics page is intentionally designed to show industry-wide competitor averages.

### Option 3: Clarify the Difference (Recommended)

Keep both but add clear labels:
- **Topics Page**: "Samsung SOA (Industry Average - All Brands)"
- **Search Visibility**: "Samsung SOA (vs Your Brand - SanDisk Only)"

---

## Which Is "Correct"?

Both are correct for their intended purpose:

1. **Topics Page (25.52%)**: Shows Samsung's performance across your **entire customer account** (all brands) - gives broader industry view
2. **Search Visibility (48%)**: Shows Samsung's performance **specifically against SanDisk** - gives focused competitive view

---

## Recommendation

The discrepancy is **expected and correct** because:
- They serve different purposes
- They use different data scopes (all brands vs current brand)

**However**, if you want them to match:

### Make Search Visibility Use All Brands Data (Option 1)

**Change:** `payload-builder.ts` - When calculating competitor visibility, optionally include all brands (if a flag is set)

Or:

### Make Topics Page Use Current Brand Only (Option 2)

**Change:** `brand.service.ts` - Add `brand_id` filter to `getIndustryAvgSoAPerTopic()` when a specific brand is selected

---

## SQL Queries to Verify

### Topics Page (All Brands):
```sql
-- Samsung SOA per topic from all brands
SELECT 
  topic,
  AVG(share_of_answers_competitor) as samsung_soa
FROM extracted_positions
WHERE customer_id = 'your-customer-id'
  AND competitor_name ILIKE '%samsung%'
  AND share_of_answers_competitor IS NOT NULL
  AND processed_at >= 'start-date'
  AND processed_at <= 'end-date'
GROUP BY topic;

-- Average of per-topic averages (matches 25.52%)
SELECT AVG(avg_soa)
FROM (
  SELECT 
    topic,
    AVG(share_of_answers_competitor) as avg_soa
  FROM extracted_positions
  WHERE customer_id = 'your-customer-id'
    AND competitor_name ILIKE '%samsung%'
    AND share_of_answers_competitor IS NOT NULL
    AND processed_at >= 'start-date'
    AND processed_at <= 'end-date'
  GROUP BY topic
) subquery;
```

### Search Visibility (SanDisk Only):
```sql
-- Samsung SOA overall from SanDisk's queries only
SELECT AVG(share_of_answers_competitor) as samsung_soa
FROM extracted_positions
WHERE brand_id = 'sanDisk-brand-id'
  AND customer_id = 'your-customer-id'
  AND competitor_name ILIKE '%samsung%'
  AND share_of_answers_competitor IS NOT NULL
  AND processed_at >= 'start-date'
  AND processed_at <= 'end-date';
-- This should match 48%
```

---

## Next Steps

Which approach would you prefer?

1. **Keep both as-is** but add clear labels explaining the difference
2. **Make Search Visibility use all brands** (to match Topics page)
3. **Make Topics page use current brand only** (to match Search Visibility)

The discrepancy is due to different data sources, not a calculation bug.
