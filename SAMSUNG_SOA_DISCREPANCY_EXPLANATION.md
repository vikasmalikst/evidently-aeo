# Why Samsung SOA Differs: Topics Page (25.52%) vs Search Visibility (48%)

## The Issue
- **Topics Page**: Shows competitor average SOA = **25.52%**
- **Search Visibility Page**: Shows Samsung SOA = **48%**

These values are **expected to be different** because they measure **completely different things**.

---

## 1. Topics Page: Competitor Average SOA (25.52%)

### What It Represents
**Average competitor SOA across the 5 visible topics** (or all topics if more are displayed)

### Calculation
From your image, the "COMPETITOR SOA" column shows per-topic competitor averages:
- Topic 1: 10.0%
- Topic 2 (SanDisk vs Samsung): 27.4%
- Topic 3: 25.1%
- Topic 4: 26.4%
- Topic 5: 38.7%

**Average = (10.0 + 27.4 + 25.1 + 26.4 + 38.7) / 5 = 25.52%** ✅

### Backend Logic
**File:** `brand.service.ts` → `getIndustryAvgSoAPerTopic()`

1. **Data Source**: Queries ALL positions from ALL brands in your customer account
2. **Filter**: Groups by topic name
3. **Calculation**: For each topic, calculates `average(all competitor SOA values for that topic)`
4. **Result**: Per-topic competitor averages

**Important**: This is **NOT Samsung-specific**. It's the average of **all competitors** combined, calculated per topic.

### Key Characteristics
- ✅ **Per-topic**: Each topic has its own competitor average
- ✅ **All competitors combined**: Not specific to Samsung
- ✅ **All brands**: Includes competitor data from all brands in customer account
- ✅ **Simple average**: `average(competitor SOA values for topic)`

---

## 2. Search Visibility Page: Samsung Overall SOA (48%)

### What It Represents
**Samsung's overall SOA across ALL queries/topics** (not just those 5 topics)

### Calculation
**File:** `visibility.service.ts` → `calculateCompetitorVisibility()`

1. **Data Source**: Queries positions for **your current brand (SanDisk)** only
2. **Filter**: Groups by competitor name (Samsung)
3. **Calculation**: Collects ALL Samsung competitor SOA values across ALL topics/queries
4. **Result**: Samsung's overall SOA = `average(all Samsung competitor SOA values)`

### Key Characteristics
- ✅ **Overall**: Aggregates across ALL topics/queries (not just 5 topics)
- ✅ **Samsung-specific**: Shows Samsung's individual performance
- ✅ **Current brand's queries**: Only includes competitor data from SanDisk's queries
- ✅ **Simple average** (after our recent fix): `average(all Samsung competitor SOA values)`

---

## Why They're Different: The Math

### Scenario Example

Let's say you have:
- **10 total topics** in your system
- **5 topics shown** on Topics page
- Samsung appears in all 10 topics

**Topics Page Calculation (25.52%):**
- Only looks at the 5 visible topics
- Average competitor SOA across those 5 topics = 25.52%
- This includes ALL competitors (Samsung, Crucial, Kingston, etc.) averaged together

**Search Visibility Calculation (48%):**
- Looks at ALL 10 topics (all queries)
- Samsung's SOA across all 10 topics = 48%
- This is Samsung-specific, not averaged with other competitors

### Key Differences

| Aspect | Topics Page (25.52%) | Search Visibility (48%) |
|--------|---------------------|------------------------|
| **Scope** | 5 visible topics only | ALL topics/queries |
| **What it measures** | Average of ALL competitors per topic | Samsung's individual SOA |
| **Data source** | All brands in customer account | Current brand's queries only |
| **Aggregation** | Per-topic → then averaged | All queries combined |
| **Competitor filter** | All competitors combined | Samsung only |

---

## Is This Correct?

**Yes, this is expected behavior!** They measure different things:

1. **Topics Page (25.52%)**: 
   - "What's the average competitor performance across these topics?"
   - Includes all competitors, scoped to specific topics

2. **Search Visibility (48%)**:
   - "What's Samsung's overall performance across all queries?"
   - Samsung-specific, across all topics

---

## If You Want Them to Match

You would need to make them calculate the same thing. Options:

### Option 1: Make Topics Page Show Samsung-Specific SOA Per Topic
- Filter competitor SOA to only Samsung
- Show Samsung's SOA per topic instead of "all competitors average"

**Code Change:** In `getIndustryAvgSoAPerTopic()`, filter by `competitor_name = 'Samsung'`

### Option 2: Make Search Visibility Show Average Across Only Those 5 Topics
- Filter Search Visibility to only calculate for the same 5 topics shown on Topics page
- Show Samsung's average SOA across just those topics

**Code Change:** Filter competitor aggregates by topic names matching Topics page

### Option 3: Show Both Values Clearly Labeled (Recommended)
- Keep both calculations
- Add clear labels:
  - Topics Page: "Competitor Average SOA (all competitors, per topic)"
  - Search Visibility: "Samsung Overall SOA (all topics)"

---

## Current Implementation Details

### Topics Page Competitor SOA
```typescript
// brand.service.ts - getIndustryAvgSoAPerTopic()
// For each topic:
// 1. Get ALL competitor SOA values for that topic (all competitors, all brands)
// 2. Calculate: average(all competitor SOA values)
// 3. Result: Per-topic competitor average

avgSoA = average(all competitor SOA values for this topic)
```

### Search Visibility Samsung SOA
```typescript
// visibility.service.ts - calculateCompetitorVisibility()
// For Samsung:
// 1. Get ALL Samsung competitor SOA values (all topics, from current brand's queries)
// 2. Calculate: average(all Samsung competitor SOA values)
// 3. Result: Samsung's overall SOA

share = average(all Samsung competitor SOA values) // Across all topics
```

---

## Recommendation

The discrepancy is **correct** - they're measuring different things. However, for better clarity:

1. **Rename Topics Page column**: Change "COMPETITOR SOA" to "Competitor Avg SOA (All Competitors)"
2. **Add tooltip**: "Average of all competitors' SOA for this topic"
3. **Rename Search Visibility**: Keep as "Share of Answers" with tooltip: "Samsung's overall SOA across all queries"

This makes it clear that:
- Topics page shows **competitor average per topic**
- Search Visibility shows **individual competitor overall SOA**

---

## Verification Query

To verify the Search Visibility calculation manually:

```sql
-- Samsung's overall SOA (matches Search Visibility)
SELECT AVG(share_of_answers_competitor) as samsung_soa
FROM extracted_positions
WHERE brand_id = 'your-brand-id'
  AND customer_id = 'your-customer-id'
  AND competitor_name ILIKE '%samsung%'
  AND share_of_answers_competitor IS NOT NULL
  AND processed_at >= 'start-date'
  AND processed_at <= 'end-date';
```

To verify Topics Page calculation manually:

```sql
-- Competitor average SOA per topic (matches Topics page)
SELECT 
  topic,
  AVG(share_of_answers_competitor) as avg_competitor_soa
FROM extracted_positions
WHERE customer_id = 'your-customer-id'
  AND share_of_answers_competitor IS NOT NULL
  AND competitor_name IS NOT NULL
  AND processed_at >= 'start-date'
  AND processed_at <= 'end-date'
GROUP BY topic;
```

---

**In summary**: The 25.52% and 48% values are both correct - they're just measuring different things!
