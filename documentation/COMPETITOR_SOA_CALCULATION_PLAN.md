# Competitor SOA Calculation Comparison: Topics Page vs Search Visibility Page

## Summary
The competitor SOA is calculated **differently** on these two pages, which explains why the values don't match.

---

## 1. Topics Page: Competitor Average SOA per Topic

### Location
**File:** `backend/src/services/brand.service.ts`  
**Method:** `getIndustryAvgSoAPerTopic()` (lines 1788-2021)

### Database Query
```sql
SELECT 
  topic,
  metadata,
  share_of_answers_competitor,  -- KEY: Only competitor SOA column
  processed_at,
  brand_id,
  competitor_name
FROM extracted_positions
WHERE customer_id = ?
  AND processed_at >= ?
  AND processed_at <= ?
  -- Excludes current brand appearing as competitor
  -- Filters by topic names if provided
```

### Calculation Method

1. **Data Source:**
   - Queries ALL positions from ALL brands (for the customer)
   - Uses ONLY `share_of_answers_competitor` column
   - Excludes rows where current brand appears as competitor
   - Groups by topic name

2. **Per-Topic Aggregation:**
   ```typescript
   // For each topic:
   // Collect all competitor SOA values for that topic
   topicData.soaValues.push(competitorSoA)  // From share_of_answers_competitor
   
   // Calculate simple average per topic
   avgSoA = average(all competitor SOA values for this topic)
   // = sum(soaValues) / soaValues.length
   ```

3. **Result:**
   - Returns per-topic competitor averages
   - Example: "Pricing" topic → 45% competitor average SOA
   - Each topic has its own competitor average

### Key Characteristics
- ✅ **Per-topic**: Each topic has separate competitor average
- ✅ **Simple average**: `average(all competitor SOA values for topic)`
- ✅ **Topic-scoped**: Only includes competitor SOA values for that specific topic
- ✅ **Cross-brand**: Includes competitor data from ALL brands in the customer account
- ✅ **Column used**: `share_of_answers_competitor` ONLY

### Formula
```
Competitor Avg SOA (per topic) = 
  SUM(share_of_answers_competitor for all competitors on this topic) 
  / COUNT(competitor positions for this topic)
```

---

## 2. Search Visibility Page: Overall Competitor SOA

### Location
**File:** `backend/src/services/brand-dashboard/payload-builder.ts` + `visibility.service.ts`  
**Methods:** 
- `buildDashboardPayload()` (aggregates competitor data)
- `calculateCompetitorVisibility()` (lines 202-314 in visibility.service.ts)

### Database Query
```sql
SELECT 
  competitor_name,
  share_of_answers_competitor,  -- KEY: Competitor SOA column
  visibility_index_competitor,
  sentiment_score_competitor,
  topic,
  query_id,
  ...
FROM extracted_positions
WHERE brand_id = ?  -- Current brand only
  AND customer_id = ?
  AND processed_at >= ?
  AND processed_at <= ?
  AND competitor_name IS NOT NULL
  AND competitor_name != ''  -- Exclude brand rows
```

### Calculation Method

1. **Data Source:**
   - Queries positions for CURRENT BRAND ONLY
   - Uses `share_of_answers_competitor` column
   - Groups by competitor name (across ALL topics)

2. **Overall Aggregation:**
   ```typescript
   // Collect all competitor SOA values per competitor (across all topics)
   competitorAggregate.shareValues.push(competitorShare)  // From share_of_answers_competitor
   
   // Then in visibility.service.ts:
   const competitorShare = aggregate.shareValues.reduce((sum, value) => sum + value, 0)
   
   // Option 1: Weighted average (if totalShareUniverse > 0)
   share = (competitorShare / totalShareUniverse) * 100
   
   // Option 2: Simple average fallback (if totalShareUniverse = 0)
   share = average(aggregate.shareValues) * 100
   ```

3. **Result:**
   - Returns overall competitor SOA (all topics combined)
   - Example: "Competitor A" → 32% overall SOA (across all topics)
   - Each competitor has ONE overall value

### Key Characteristics
- ❌ **Not per-topic**: Aggregates across ALL topics
- ⚠️ **Weighted or Simple**: Uses weighted average if `totalShareUniverse > 0`, else simple average
- ❌ **Topic-agnostic**: Includes competitor SOA from all topics combined
- ✅ **Brand-scoped**: Only includes competitor data relative to current brand's queries
- ✅ **Column used**: `share_of_answers_competitor` ONLY

### Formula

**When weighted (default):**
```
Competitor Overall SOA = 
  (SUM(competitor share values) / totalShareUniverse) * 100
  
Where:
  totalShareUniverse = brandShareSum + competitorShareSum
```

**When simple average (fallback):**
```
Competitor Overall SOA = 
  average(all competitor share values) * 100
```

---

## 3. Key Differences Summary

| Aspect | Topics Page | Search Visibility Page |
|--------|------------|----------------------|
| **Scope** | Per-topic | Overall (all topics) |
| **Aggregation** | Simple average | Weighted average (or simple fallback) |
| **Data Source** | All brands in customer account | Current brand's queries only |
| **Grouping** | By topic name | By competitor name |
| **Column Used** | `share_of_answers_competitor` | `share_of_answers_competitor` |
| **Result Type** | Topic-level averages | Competitor-level overall averages |
| **Example** | "Pricing" topic → 45% competitor avg | "Competitor A" → 32% overall SOA |

---

## 4. Why Values Don't Match

### Reason 1: Different Scope
- **Topics Page**: Shows competitor average **for a specific topic**
- **Search Visibility**: Shows competitor SOA **across all topics combined**

### Reason 2: Different Data Sets
- **Topics Page**: Uses competitor data from **ALL brands** in the customer account
- **Search Visibility**: Uses competitor data only from **current brand's queries**

### Reason 3: Different Aggregation
- **Topics Page**: Always simple average
- **Search Visibility**: Weighted average (relative to brand + competitor share universe)

---

## 5. Recommendations for Consistency

### Option A: Make Topics Page Match Search Visibility (Overall Competitor SOA)
- Change `getIndustryAvgSoAPerTopic()` to calculate overall competitor averages
- Remove per-topic grouping for competitor SOA
- Use same weighted calculation as Search Visibility

**Pros:**
- Values will match across pages
- Consistent methodology

**Cons:**
- Loses per-topic competitor insights (which might be valuable)

### Option B: Make Search Visibility Match Topics Page (Per-Topic Competitor SOA)
- Add per-topic breakdown to Search Visibility competitor data
- Show competitor SOA per topic on Search Visibility page

**Pros:**
- More granular insights
- Shows competitor performance by topic

**Cons:**
- Requires UI changes to Search Visibility page
- Different data structure

### Option C: Standardize Both to Simple Average
- Change Search Visibility to always use simple average (no weighted)
- Both pages use same calculation: `average(competitor SOA values)`

**Pros:**
- Simple and consistent
- Matches brand SOA calculation we just implemented

**Cons:**
- Search Visibility loses weighted context

### Option D: Clarify the Difference (Recommended)
- Keep both calculations but clearly label them:
  - **Topics Page**: "Competitor Average SOA (per topic)"
  - **Search Visibility**: "Competitor Overall SOA (all topics)"
- Add tooltips explaining the difference

**Pros:**
- Preserves both use cases
- Users understand why values differ
- No breaking changes

**Cons:**
- Users might still be confused

---

## 6. Implementation Plan (If Standardizing)

If you choose Option C (Simple Average):

### Phase 1: Update Search Visibility Competitor SOA

**File:** `backend/src/services/brand-dashboard/visibility.service.ts`

**Location:** `calculateCompetitorVisibility()` method (line 216)

**Current:**
```typescript
const competitorShare = aggregate.shareValues.reduce((sum, value) => sum + value, 0)
const share = totalShareUniverse > 0 
  ? round((competitorShare / totalShareUniverse) * 100) 
  : round(average(aggregate.shareValues) * 100)
```

**New:**
```typescript
// Always use simple average (consistent with Topics page and brand SOA)
const share = aggregate.shareValues.length > 0
  ? round(average(aggregate.shareValues))
  : 0
```

### Phase 2: Update Topics Page (if needed)

**File:** `backend/src/services/brand.service.ts`

**Location:** `getIndustryAvgSoAPerTopic()` method (line 1949)

**Current:** Already uses simple average ✅

**No changes needed** - already correct!

### Phase 3: Testing

1. Verify Topics page competitor SOA values
2. Verify Search Visibility competitor SOA values
3. Compare values (they should be closer, but won't match exactly due to different scopes)

---

## 7. Questions to Consider

1. **Should competitor SOA be per-topic or overall?**
   - Per-topic is more granular but more complex
   - Overall is simpler but loses topic-level insights

2. **Should we use simple average or weighted average?**
   - Simple average: Matches brand SOA calculation
   - Weighted average: Accounts for query volume

3. **Should competitor data come from all brands or current brand only?**
   - All brands: Broader industry view
   - Current brand only: More focused comparison

---

## 8. Current Status

- ✅ **Topics Page**: Simple average per topic (from all brands)
- ⚠️ **Search Visibility**: Weighted average overall (from current brand only)
- ⚠️ **Values don't match** due to different methodologies

---

## Next Steps

Please confirm which approach you'd like to take:
1. Option A: Make Topics match Search Visibility
2. Option B: Make Search Visibility match Topics
3. Option C: Standardize both to simple average
4. Option D: Keep both but clarify labels

Then I can implement the chosen solution.
