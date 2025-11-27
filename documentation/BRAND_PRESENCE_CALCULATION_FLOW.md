# Brand Presence Calculation Flow - Detailed Logic

## Overview
This document shows the exact code flow for calculating Brand Presence percentage per topic.

## Step-by-Step Logic

### 1. Data Structure Definition (Line 203-214)
```typescript
const topicAggregates = new Map<
  string,
  {
    queryIds: Set<string>                    // All unique query IDs for this topic (brand rows only)
    queriesWithBrandPresence: Set<string>    // Unique query IDs that have brand presence
    // ... other fields
  }
>()
```

### 2. Row Processing Loop (Lines 420-529)

For each row from `extracted_positions` table:

#### Step 2a: Determine if it's a brand row (Line 422)
```typescript
const isBrandRow = !row.competitor_name || row.competitor_name.trim().length === 0
```
- **Only processes rows where `competitor_name` is null/empty**
- Competitor rows are skipped for topic aggregation

#### Step 2b: Check for brand presence (Line 389)
```typescript
const hasBrandPresence = row.has_brand_presence === true
```
- Reads directly from `row.has_brand_presence` column
- Must be exactly `true` (not just truthy)

#### Step 2c: Topic Aggregation (Lines 499-529)

**Only executes if `isBrandRow === true`** (line 499)

```typescript
if (topicName) {
  // Initialize aggregate if needed
  if (!topicAggregates.has(topicName)) {
    topicAggregates.set(topicName, {
      queryIds: new Set<string>(),
      queriesWithBrandPresence: new Set<string>(),  // ← Using Set to track unique queries
      // ...
    })
  }
  
  const topicAggregate = topicAggregates.get(topicName)!
  
  // Track ALL query IDs for this topic (all brand rows)
  if (row.query_id) {
    topicAggregate.queryIds.add(row.query_id)  // ← Line 513
  }
  
  // Track ONLY queries that have brand presence
  if (isBrandRow && hasBrandPresence && row.query_id) {  // ← Line 522
    topicAggregate.queriesWithBrandPresence.add(row.query_id)  // ← Line 523
  }
}
```

**Key Points:**
- `queryIds` Set: Contains ALL unique query IDs that have at least one brand row for this topic
- `queriesWithBrandPresence` Set: Contains ONLY unique query IDs where `has_brand_presence === true` for at least one row

### 3. Calculation (Lines 1298-1302)

```typescript
const promptsTracked = aggregate.queryIds.size  // Total unique queries for this topic

const brandPresencePercentage = promptsTracked > 0 && aggregate.queriesWithBrandPresence.size > 0
  ? round((aggregate.queriesWithBrandPresence.size / promptsTracked) * 100, 1)
  : null
```

**Formula:**
```
Brand Presence % = (queriesWithBrandPresence.size / queryIds.size) * 100
```

## Example Scenarios

### Scenario 1: All queries have brand presence
- Topic: "best option for post-vaccination fever"
- Query 1: has_brand_presence = true
- Query 2: has_brand_presence = true
- Query 3: has_brand_presence = true
- Query 4: has_brand_presence = true

**Result:**
- `queryIds.size` = 4
- `queriesWithBrandPresence.size` = 4
- Brand Presence % = (4/4) * 100 = **100%** ✅

### Scenario 2: Some queries don't have brand presence
- Topic: "OTC options for people with liver concerns"
- Query 1: has_brand_presence = true
- Query 2: has_brand_presence = true
- Query 3: has_brand_presence = false (or null)
- Query 4: has_brand_presence = false (or null)

**Result:**
- `queryIds.size` = 4 (all 4 queries have brand rows)
- `queriesWithBrandPresence.size` = 2 (only 2 queries have brand presence)
- Brand Presence % = (2/4) * 100 = **50%** ✅

### Scenario 3: Multiple rows per query
- Topic: "best for headache relief"
- Query 1: Row 1 (has_brand_presence = true), Row 2 (has_brand_presence = false)
- Query 2: Row 1 (has_brand_presence = true)
- Query 3: Row 1 (has_brand_presence = false), Row 2 (has_brand_presence = false)

**Result:**
- `queryIds.size` = 3 (3 unique queries)
- `queriesWithBrandPresence.size` = 2 (Query 1 and Query 2 have at least one row with brand presence)
- Brand Presence % = (2/3) * 100 = **66.7%** ✅

## Potential Issues

### Issue 1: Backend not restarted
If the backend server hasn't been restarted, it's still running the old code that counts rows instead of unique queries.

**Solution:** Restart the backend server.

### Issue 2: Database data
If all queries in the database actually have `has_brand_presence = true` for at least one row, then 100% is correct.

**To verify:** Check the database:
```sql
SELECT 
  topic,
  query_id,
  COUNT(*) as row_count,
  COUNT(CASE WHEN has_brand_presence = true THEN 1 END) as rows_with_presence,
  MAX(CASE WHEN has_brand_presence = true THEN 1 ELSE 0 END) as query_has_presence
FROM extracted_positions
WHERE brand_id = '<your_brand_id>'
  AND competitor_name IS NULL
  AND topic = '<topic_name>'
GROUP BY topic, query_id
ORDER BY topic, query_id;
```

### Issue 3: Cache
The frontend cache might be serving old data.

**Solution:** Clear browser cache/localStorage or do a hard refresh.

## Code Locations

- **Type Definition:** `backend/src/services/brand-dashboard/payload-builder.ts:203-214`
- **Row Processing:** `backend/src/services/brand-dashboard/payload-builder.ts:420-529`
- **Brand Presence Check:** `backend/src/services/brand-dashboard/payload-builder.ts:389`
- **Query Tracking:** `backend/src/services/brand-dashboard/payload-builder.ts:513, 522-523`
- **Calculation:** `backend/src/services/brand-dashboard/payload-builder.ts:1298-1302`

