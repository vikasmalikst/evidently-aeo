# KPI Suggestions for Topics Analysis Dashboard

Based on the available data in the topics analysis system, here are suggested KPIs to fill the gaps left by removing "Volume" and "Trending" cards.

## Available Data Points

From the `Topic` interface and backend data:
- `avgShareOfAnswer` (SOA) - Percentage (0-100)
- `avgSentiment` - Sentiment score (-1 to 1)
- `avgVisibility` - Visibility index
- `brandPresencePercentage` - Percentage of queries with brand presence
- `totalQueries` - Number of queries for each topic
- `topSources` - Top citation sources per topic
- `category` - Topic category
- `industryAvgSoA` - Industry average SOA (when available)
- `industryBrandCount` - Number of brands in industry average

## Recommended KPI Cards

### 1. **Brand Presence** (High Priority)
**Metric:** Average brand presence percentage across all topics
**Calculation:** `AVG(brandPresencePercentage)` across all topics
**Display:** 
- Primary: "XX.X%"
- Secondary: "Brand mentions in responses"
- Trend: Compare to previous period
**Icon:** CheckCircle or Target
**Color:** Green/Blue
**Why:** Shows how often your brand appears in AI responses, even if not cited

### 2. **Sentiment Score** (High Priority)
**Metric:** Average sentiment across all topics
**Calculation:** `AVG(avgSentiment)` across all topics
**Display:**
- Primary: "X.X" (on -1 to 1 scale) or "XX% Positive"
- Secondary: "Overall brand sentiment"
- Trend: Compare to previous period
**Icon:** Smile or TrendingUp
**Color:** Green (positive), Orange (neutral), Red (negative)
**Why:** Indicates how positively your brand is being discussed

### 3. **Top Performing Category** (Medium Priority)
**Metric:** Category with highest average SOA
**Calculation:** Group by category, calculate avg SOA, find max
**Display:**
- Primary: Category name (e.g., "Awareness")
- Secondary: "XX.X% avg SOA"
- Trend: Show if category is improving
**Icon:** Trophy or Star
**Color:** Gold/Yellow
**Why:** Highlights your strongest content area

### 4. **Total Queries** (Medium Priority)
**Metric:** Sum of all queries across topics
**Calculation:** `SUM(totalQueries)` across all topics
**Display:**
- Primary: Formatted number (e.g., "1.2K")
- Secondary: "Queries tracked"
- Trend: Compare to previous period
**Icon:** Search or Database
**Color:** Blue
**Why:** Shows total monitoring activity

### 5. **Unique Sources** (Medium Priority)
**Metric:** Count of unique top sources across all topics
**Calculation:** Count distinct domains from `topSources`
**Display:**
- Primary: Number (e.g., "15")
- Secondary: "Unique citation sources"
- Trend: Show if diversifying
**Icon:** Globe or Link
**Color:** Purple
**Why:** Indicates source diversity and reach

### 6. **Industry Comparison** (High Priority - if data available)
**Metric:** Average difference between brand SOA and industry SOA
**Calculation:** `AVG(brandSOA - industryAvgSoA)` for topics with industry data
**Display:**
- Primary: "+X.X%" or "-X.X%" (difference)
- Secondary: "vs industry average"
- Trend: Show if gap is closing
**Icon:** BarChart or Compare
**Color:** Green (above), Red (below)
**Why:** Shows competitive position

### 7. **Visibility Index** (Medium Priority)
**Metric:** Average visibility index across topics
**Calculation:** `AVG(avgVisibility)` across all topics
**Display:**
- Primary: "XX" (index value)
- Secondary: "Average visibility"
- Trend: Compare to previous period
**Icon:** Eye or Visibility
**Color:** Blue
**Why:** Measures overall brand visibility in AI responses

## Implementation Priority

### Phase 1 (Quick Wins - Use Existing Data):
1. **Brand Presence** - Already have `brandPresencePercentage`
2. **Sentiment Score** - Already have `avgSentiment`
3. **Total Queries** - Already have `totalQueries`

### Phase 2 (Requires Aggregation):
4. **Top Performing Category** - Need to group by category
5. **Unique Sources** - Need to extract and count unique domains
6. **Visibility Index** - Already have `avgVisibility`

### Phase 3 (Requires Industry Data):
7. **Industry Comparison** - Requires `industryAvgSoA` to be populated

## Example Implementation

```typescript
// In transformTopicsData or CompactMetricsPods
const calculateKPIs = (topics: Topic[]) => {
  const brandPresence = topics
    .filter(t => t.brandPresencePercentage !== null)
    .reduce((sum, t) => sum + (t.brandPresencePercentage || 0), 0) / topics.length;
  
  const avgSentiment = topics
    .filter(t => t.avgSentiment !== null)
    .reduce((sum, t) => sum + (t.avgSentiment || 0), 0) / topics.length;
  
  const totalQueries = topics
    .reduce((sum, t) => sum + (t.totalQueries || 0), 0);
  
  const uniqueSources = new Set(
    topics.flatMap(t => t.sources.map(s => {
      const domain = s.url?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || s.name;
      return domain;
    }))
  ).size;
  
  return {
    brandPresence,
    avgSentiment,
    totalQueries,
    uniqueSources
  };
};
```

## Recommended Final KPI Set

For a 5-card layout (replacing Volume and Trending):
1. **Topics** (keep)
2. **Avg SOA** (keep)
3. **Brand Presence** (new)
4. **Sentiment Score** (new)
5. **Gaps** (keep)

Or for a 4-card layout:
1. **Topics** (keep)
2. **Avg SOA** (keep)
3. **Brand Presence** (new)
4. **Gaps** (keep)

## Notes

- **Brand Presence** is the most actionable metric - shows opportunities to improve citations
- **Sentiment Score** provides quick health check of brand perception
- **Industry Comparison** is most valuable but requires sufficient data from other brands
- Consider making KPIs clickable to filter/scroll to relevant topics






