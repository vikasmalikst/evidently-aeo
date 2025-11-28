# What are "Gaps" and How Are They Calculated?

## What are Gaps?

**Gaps** (also called "Citation Gaps") represent topics where your brand has a **low Share of Answer (SOA)** compared to competitors or industry standards. These are strategic opportunities where competitors are being cited by AI models, but your brand is not.

### Definition

A **Gap** is a topic where:
- Your brand's SOA is **below 1.0x** (or below 20% in percentage terms)
- Competitors or other sources are being cited more frequently for the same topic
- There's an opportunity to improve your brand's visibility and citations

### Why Gaps Matter

Gaps identify high-value opportunities where:
1. **Market demand exists** - The topic is being searched and discussed
2. **Competitors are winning** - Other brands/sources are getting cited
3. **You can gain share** - By creating better content, you can capture more citations

## How Gaps Are Currently Calculated

### Current Implementation (Simplified)

The current calculation in `CompactMetricsPods.tsx` uses a **simplified estimation method**:

```typescript
const getCitationGapCount = (minSoA: number, totalTopics: number): number => {
  // If the minimum SOA across all topics is below 1.0x (20%),
  // estimate that some topics are gaps
  if (minSoA < 1.0) {
    // Estimate: 20% of topics are gaps
    return Math.max(1, Math.floor(totalTopics * 0.2));
  }
  return 0;
};
```

**Logic:**
- If the **minimum SOA** across all your topics is below 1.0x (20%), it assumes some topics are gaps
- Estimates that **20% of topics** are gaps (this is a rough approximation)
- Returns at least 1 gap if minSoA < 1.0, otherwise 0

### Example

If you have:
- **10 total topics**
- **Minimum SOA = 0.5x** (10% - meaning your worst-performing topic has 10% SOA)

Then:
- `minSoA < 1.0` → True
- `Math.floor(10 * 0.2) = 2`
- **Gaps = 2** (estimated)

## Limitations of Current Calculation

The current implementation is **simplified** and has limitations:

1. **Not topic-specific** - Doesn't identify which specific topics are gaps
2. **Fixed percentage** - Always estimates 20% of topics, regardless of actual distribution
3. **No competitor comparison** - Doesn't compare against actual competitor SOA
4. **No threshold customization** - Uses hardcoded 1.0x threshold

## Recommended Improved Calculation

### Approach 1: Count Topics Below Threshold

Count actual topics where SOA < 1.0x:

```typescript
const getCitationGapCount = (topics: Topic[]): number => {
  return topics.filter(topic => {
    const soA = topic.currentSoA || (topic.soA * 20); // Convert to percentage
    return soA < 20; // Below 20% (1.0x)
  }).length;
};
```

**Pros:**
- Accurate count of actual gaps
- Topic-specific (can identify which topics are gaps)

**Cons:**
- Requires access to full topics array
- Doesn't consider industry benchmarks

### Approach 2: Compare Against Industry Average

Count topics where your SOA is below industry average:

```typescript
const getCitationGapCount = (
  topics: Topic[],
  industryAvgSoA: number
): number => {
  return topics.filter(topic => {
    const soA = topic.currentSoA || (topic.soA * 20);
    return soA < industryAvgSoA;
  }).length;
};
```

**Pros:**
- More meaningful (compares to industry standard)
- Identifies relative gaps, not just absolute low performers

**Cons:**
- Requires industry benchmark data
- More complex to implement

### Approach 3: Compare Against Competitors

Count topics where competitors have higher SOA:

```typescript
const getCitationGapCount = (
  topics: Topic[],
  competitorSoA: Map<string, number> // topic_id -> competitor_avg_soa
): number => {
  return topics.filter(topic => {
    const yourSoA = topic.currentSoA || (topic.soA * 20);
    const competitorAvg = competitorSoA.get(topic.id) || 0;
    return yourSoA < competitorAvg;
  }).length;
};
```

**Pros:**
- Most actionable (shows where you're losing to competitors)
- Identifies competitive gaps

**Cons:**
- Requires competitor data
- Most complex to implement

## Implementation in Backend

To calculate gaps accurately, you would need to:

1. **Query topics with low SOA:**
   ```sql
   SELECT COUNT(*) as gap_count
   FROM topics t
   INNER JOIN topic_analytics ta ON t.id = ta.topic_id
   WHERE t.brand_id = :brand_id
     AND t.customer_id = :customer_id
     AND ta.share_of_answer < 1.0  -- Below 1.0x (20%)
     AND ta.created_at >= :start_date
     AND ta.created_at <= :end_date;
   ```

2. **Or compare against industry average:**
   ```sql
   WITH industry_avg AS (
     SELECT 
       LOWER(TRIM(topic_name)) as normalized_topic,
       AVG(share_of_answer) as avg_soa
     FROM topics t
     INNER JOIN topic_analytics ta ON t.id = ta.topic_id
     WHERE t.brand_id != :brand_id
       AND ta.created_at >= :start_date
       AND ta.created_at <= :end_date
     GROUP BY LOWER(TRIM(topic_name))
   )
   SELECT COUNT(*) as gap_count
   FROM topics t
   INNER JOIN topic_analytics ta ON t.id = ta.topic_id
   INNER JOIN industry_avg ia ON LOWER(TRIM(t.topic_name)) = ia.normalized_topic
   WHERE t.brand_id = :brand_id
     AND t.customer_id = :customer_id
     AND ta.share_of_answer < ia.avg_soa
     AND ta.created_at >= :start_date
     AND ta.created_at <= :end_date;
   ```

## Display in UI

The Gaps KPI card shows:
- **Primary Value**: Number of topics with gaps (e.g., "1", "5")
- **Label**: "Gaps"
- **Secondary**: "Citation gaps"
- **Change Indicator**: "Strategic opportunity"
- **Tooltip**: Explains what gaps are and suggests action

## Next Steps

To improve gap calculation:

1. **Phase 1**: Implement Approach 1 (count topics below threshold)
   - Simple, accurate count
   - Can be done with existing data

2. **Phase 2**: Add industry benchmark comparison
   - More meaningful gaps
   - Requires industry SOA calculation

3. **Phase 3**: Add competitor comparison
   - Most actionable
   - Requires competitor tracking

## Related Concepts

- **SOA (Share of Answer)**: Percentage of AI responses that cite your brand for a topic
- **Citation Gap**: Difference between your SOA and competitor/industry SOA
- **Strategic Opportunity**: Topics where improving content can gain significant share

