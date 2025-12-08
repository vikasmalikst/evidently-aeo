# Suggestions for Calculating Average Industry SOA

This document outlines several approaches for calculating "Average Industry SOA" (Share of Answer) that would provide meaningful competitive benchmarking for topics.

## Current State

Currently, the "Avg Industry SOA" column displays mock/deterministic data based on the brand's SOA. This needs to be replaced with real industry benchmark data.

## Calculation Approaches

### Approach 1: Aggregate SOA Across All Brands in Industry (Recommended)

Calculate the average SOA for the same topic across all brands in your database (excluding the current brand).

**Pros:**
- Provides true industry benchmark
- Uses actual data from your platform
- Automatically updates as more brands are added

**Cons:**
- Requires sufficient brands in the database
- May not be meaningful if few brands track the same topics
- Privacy considerations (aggregating competitor data)

**Implementation:**

```sql
-- Calculate average industry SOA for a specific topic
WITH brand_soa AS (
  SELECT 
    t.brand_id,
    t.topic_name,
    AVG(ta.share_of_answer) as avg_soa
  FROM topics t
  INNER JOIN topic_analytics ta ON t.id = ta.topic_id
  WHERE LOWER(TRIM(t.topic_name)) = LOWER(TRIM(:topic_name))
    AND t.brand_id != :current_brand_id  -- Exclude current brand
    AND ta.created_at >= :start_date
    AND ta.created_at <= :end_date
  GROUP BY t.brand_id, t.topic_name
)
SELECT 
  topic_name,
  AVG(avg_soa) as industry_avg_soa,
  COUNT(DISTINCT brand_id) as brand_count,
  STDDEV(avg_soa) as std_dev
FROM brand_soa
GROUP BY topic_name;
```

**Backend Implementation:**

```typescript
// In brand.service.ts - add method to getIndustryAvgSoA
private async getIndustryAvgSoA(
  topicName: string,
  currentBrandId: string,
  startIso: string,
  endIso: string
): Promise<number | null> {
  const normalizedTopicName = topicName.toLowerCase().trim();
  
  const { data, error } = await supabaseAdmin
    .from('topic_analytics')
    .select(`
      share_of_answer,
      topics!inner(topic_name, brand_id)
    `)
    .eq('topics.topic_name', normalizedTopicName)
    .neq('topics.brand_id', currentBrandId)
    .gte('created_at', startIso)
    .lte('created_at', endIso);
  
  if (error || !data || data.length === 0) {
    return null; // Not enough data
  }
  
  // Calculate average SOA across all brands
  const avgSoA = data.reduce((sum, item) => sum + (item.share_of_answer || 0), 0) / data.length;
  return avgSoA;
}
```

### Approach 2: Category-Based Industry Average

Calculate average SOA for all topics in the same category across all brands.

**Pros:**
- More data points (all topics in category, not just exact topic match)
- More stable benchmark
- Useful when exact topic matches are rare

**Cons:**
- Less precise (category-level vs topic-level)
- May not reflect topic-specific dynamics

**Implementation:**

```sql
-- Average SOA for all topics in the same category
SELECT 
  t.category,
  AVG(ta.share_of_answer) as category_avg_soa,
  COUNT(DISTINCT t.brand_id) as brand_count,
  COUNT(DISTINCT t.id) as topic_count
FROM topics t
INNER JOIN topic_analytics ta ON t.id = ta.topic_id
WHERE t.category = :category
  AND t.brand_id != :current_brand_id
  AND ta.created_at >= :start_date
  AND ta.created_at <= :end_date
GROUP BY t.category;
```

### Approach 3: Competitor-Based Average

Calculate average SOA from explicitly defined competitors for the brand.

**Pros:**
- Most relevant benchmark (direct competitors)
- Can be configured per brand
- More actionable insights

**Cons:**
- Requires competitor configuration
- May not have data for all competitors
- Manual setup required

**Implementation:**

```sql
-- Average SOA from configured competitors
SELECT 
  t.topic_name,
  AVG(ta.share_of_answer) as competitor_avg_soa,
  COUNT(DISTINCT t.brand_id) as competitor_count
FROM topics t
INNER JOIN topic_analytics ta ON t.id = ta.topic_id
INNER JOIN brand_competitors bc ON t.brand_id = bc.competitor_brand_id
WHERE bc.brand_id = :current_brand_id
  AND LOWER(TRIM(t.topic_name)) = LOWER(TRIM(:topic_name))
  AND ta.created_at >= :start_date
  AND ta.created_at <= :end_date
GROUP BY t.topic_name;
```

**Schema Addition Needed:**

```sql
-- Create brand_competitors table
CREATE TABLE IF NOT EXISTS brand_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  competitor_brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, competitor_brand_id)
);
```

### Approach 4: Historical Benchmark (Time-Based)

Compare current SOA to historical average for the same topic (same brand, previous period).

**Pros:**
- Always available (no need for other brands)
- Shows trend over time
- Useful for tracking improvement

**Cons:**
- Not a true "industry" benchmark
- Only shows internal progress, not competitive position

**Implementation:**

```sql
-- Compare current period to previous period
WITH current_period AS (
  SELECT AVG(share_of_answer) as avg_soa
  FROM topic_analytics
  WHERE topic_id = :topic_id
    AND created_at >= :current_start
    AND created_at <= :current_end
),
previous_period AS (
  SELECT AVG(share_of_answer) as avg_soa
  FROM topic_analytics
  WHERE topic_id = :topic_id
    AND created_at >= :previous_start
    AND created_at <= :previous_end
)
SELECT 
  cp.avg_soa as current_avg,
  pp.avg_soa as previous_avg,
  (cp.avg_soa - pp.avg_soa) as delta,
  CASE 
    WHEN cp.avg_soa > pp.avg_soa THEN 'up'
    WHEN cp.avg_soa < pp.avg_soa THEN 'down'
    ELSE 'neutral'
  END as trend
FROM current_period cp
CROSS JOIN previous_period pp;
```

### Approach 5: Hybrid Approach (Recommended for MVP)

Combine multiple approaches with fallbacks:

1. **Primary**: Competitor-based average (if competitors configured)
2. **Fallback 1**: Industry-wide average for same topic (if >= 3 brands)
3. **Fallback 2**: Category-based average (if >= 5 brands in category)
4. **Fallback 3**: Historical benchmark (previous period)

**Implementation:**

```typescript
async getIndustryAvgSoA(
  topic: Topic,
  brandId: string,
  customerId: string,
  startIso: string,
  endIso: string
): Promise<{ soA: number; trend: Trend; source: string } | null> {
  
  // Try Approach 3: Competitor-based
  const competitorAvg = await this.getCompetitorAvgSoA(topic, brandId, startIso, endIso);
  if (competitorAvg && competitorAvg.brandCount >= 2) {
    return { ...competitorAvg, source: 'competitors' };
  }
  
  // Try Approach 1: Industry-wide for same topic
  const industryAvg = await this.getIndustryTopicAvgSoA(topic, brandId, startIso, endIso);
  if (industryAvg && industryAvg.brandCount >= 3) {
    return { ...industryAvg, source: 'industry' };
  }
  
  // Try Approach 2: Category-based
  const categoryAvg = await this.getCategoryAvgSoA(topic, brandId, startIso, endIso);
  if (categoryAvg && categoryAvg.brandCount >= 5) {
    return { ...categoryAvg, source: 'category' };
  }
  
  // Fallback: Historical benchmark
  const historicalAvg = await this.getHistoricalAvgSoA(topic, brandId, startIso, endIso);
  if (historicalAvg) {
    return { ...historicalAvg, source: 'historical' };
  }
  
  return null; // No data available
}
```

## Display Considerations

### Show Data Quality Indicators

- Display the source of the benchmark (e.g., "Based on 5 competitors" or "Category average")
- Show confidence level based on sample size
- Indicate when data is limited or unavailable

### Trend Calculation

Calculate trend by comparing:
- Current period industry average vs previous period industry average
- Or: Brand SOA vs Industry SOA (showing if brand is above/below industry)

```typescript
interface IndustrySoA {
  soA: number; // Average industry SOA (0-5x scale)
  trend: {
    direction: 'up' | 'down' | 'neutral';
    delta: number; // Change from previous period
  };
  source: 'competitors' | 'industry' | 'category' | 'historical';
  brandCount: number; // Number of brands in calculation
  confidence: 'high' | 'medium' | 'low'; // Based on sample size
}
```

## Recommended Implementation Plan

### Phase 1: MVP (Quick Win)
- Implement **Approach 4** (Historical Benchmark) first
- Always available, shows progress over time
- Can be implemented immediately with existing data

### Phase 2: Industry Benchmark
- Implement **Approach 1** (Industry-wide average)
- Requires sufficient brands in database
- Add data quality indicators

### Phase 3: Enhanced Benchmarking
- Add **Approach 3** (Competitor-based)
- Requires competitor configuration UI
- Most actionable for users

### Phase 4: Hybrid System
- Implement **Approach 5** (Hybrid with fallbacks)
- Best user experience
- Handles edge cases gracefully

## Database Schema Considerations

Ensure you have:
1. `topic_analytics` table with `share_of_answer` column
2. `topics` table with `topic_name`, `category`, `brand_id`
3. Optional: `brand_competitors` table for competitor tracking
4. Indexes on:
   - `topics(brand_id, topic_name)`
   - `topic_analytics(topic_id, created_at)`
   - `topic_analytics(created_at)` for date range queries

## Performance Optimization

- Cache industry averages (recalculate daily/hourly)
- Use materialized views for complex aggregations
- Pre-calculate category averages
- Consider separate table for industry benchmarks

```sql
-- Example: Materialized view for industry benchmarks
CREATE MATERIALIZED VIEW industry_soa_benchmarks AS
SELECT 
  LOWER(TRIM(t.topic_name)) as normalized_topic_name,
  t.category,
  AVG(ta.share_of_answer) as avg_soa,
  COUNT(DISTINCT t.brand_id) as brand_count,
  MAX(ta.created_at) as last_updated
FROM topics t
INNER JOIN topic_analytics ta ON t.id = ta.topic_id
WHERE ta.created_at >= NOW() - INTERVAL '90 days'
GROUP BY LOWER(TRIM(t.topic_name)), t.category;

-- Refresh periodically (e.g., daily)
REFRESH MATERIALIZED VIEW CONCURRENTLY industry_soa_benchmarks;
```







