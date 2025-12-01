# Sentiment Query Flow for Dashboard

## Overview

This document explains exactly how sentiment scores are queried from the database for both Brand Visibility and Competitive Visibility pages.

## Database Queries

### 1. Main Query: `extracted_positions` table

**Location:** `payload-builder.ts` lines 63-75

```typescript
const result = await supabaseAdmin
  .from('extracted_positions')
  .select(
    'brand_name, query_id, collector_result_id, collector_type, competitor_name, 
     visibility_index, visibility_index_competitor, 
     share_of_answers_brand, share_of_answers_competitor, 
     sentiment_score, sentiment_label,                    // ← Brand sentiment columns
     sentiment_score_competitor, sentiment_label_competitor, // ← Competitor sentiment columns
     total_brand_mentions, competitor_mentions, 
     processed_at, brand_positions, competitor_positions, 
     has_brand_presence, topic, metadata'
  )
  .eq('brand_id', brand.id)
  .eq('customer_id', customerId)
  .gte('processed_at', startIsoBound)
  .lte('processed_at', endIsoBound)
```

**Returns:** All position rows (both brand rows where `competitor_name IS NULL` and competitor rows where `competitor_name IS NOT NULL`)

### 2. Secondary Query: `collector_results` table

**Location:** `payload-builder.ts` lines 273-279

```typescript
const result = await supabaseAdmin
  .from('collector_results')
  .select('id, question, sentiment_score')  // ← Brand-level sentiment
  .in('id', uniqueCollectorResultIds)
```

**Purpose:** Get brand sentiment from `collector_results` table (used as fallback for brand sentiment)

**Returns:** Map of `collector_result_id → sentiment_score` stored in `collectorResultSentimentMap`

## Sentiment Processing Logic

### For BRAND SENTIMENT (Brand Visibility page - LLM models)

**Location:** `payload-builder.ts` lines 381-389

```typescript
// Priority: 1) sentiment_score from collector_results (via collector_result_id), 
//           2) sentiment_score from extracted_positions
let brandSentiment: number | null = null
if (row.collector_result_id && collectorResultSentimentMap.has(row.collector_result_id)) {
  brandSentiment = collectorResultSentimentMap.get(row.collector_result_id) ?? null
} else if (row.sentiment_score !== null && row.sentiment_score !== undefined) {
  brandSentiment = toNumber(row.sentiment_score)
}
const hasBrandSentiment = brandSentiment !== null && brandSentiment !== undefined
const brandSentimentValue = hasBrandSentiment ? brandSentiment : 0
```

**Processing:**
1. Only processes rows where `competitor_name IS NULL` (brand rows)
2. Uses `sentiment_score` column from `extracted_positions` OR `collector_results`
3. Aggregates by `collector_type` (line 558-560):
   ```typescript
   if (hasBrandSentiment) {
     collectorAggregate.sentimentValues.push(brandSentimentValue)
   }
   ```
4. Final calculation in `visibility.service.ts` line 120-123:
   ```typescript
   const sentimentValues = aggregate.sentimentValues || []
   const sentiment = sentimentValues.length > 0
     ? round(average(sentimentValues), 2)
     : null
   ```

### For COMPETITOR SENTIMENT (Competitive Visibility page)

**Location:** `payload-builder.ts` lines 604-612

```typescript
// Priority: 1) sentiment_score_competitor from extracted_positions (competitor-specific column)
// Note: We don't use collector_results sentiment for competitors since that's brand-level sentiment
let competitorSentiment: number | null = null
if ((row as any).sentiment_score_competitor !== null && (row as any).sentiment_score_competitor !== undefined) {
  competitorSentiment = toNumber((row as any).sentiment_score_competitor)
}
const hasCompetitorSentiment = competitorSentiment !== null && competitorSentiment !== undefined
const competitorSentimentValue = hasCompetitorSentiment ? competitorSentiment : 0
```

**Processing:**
1. Only processes rows where `competitor_name IS NOT NULL` (competitor rows)
2. Uses `sentiment_score_competitor` column from `extracted_positions`
3. Aggregates by `competitor_name` (line 651):
   ```typescript
   if (hasCompetitorSentiment) {
     competitorAggregate.sentimentValues.push(competitorSentimentValue)
   }
   ```
4. Final calculation in `visibility.service.ts` line 234-238:
   ```typescript
   const sentimentValues = aggregate.sentimentValues || []
   const sentiment = sentimentValues.length > 0
     ? round(average(sentimentValues), 2)
     : null
   ```

## Key Points

### Brand Visibility (LLM Models)
- **Data Source:** `extracted_positions.sentiment_score` OR `collector_results.sentiment_score`
- **Row Filter:** `competitor_name IS NULL`
- **Grouping:** By `collector_type` (e.g., "Perplexity", "Claude", "Google AIO")
- **Column Used:** `sentiment_score` (brand column)

### Competitive Visibility (Competitors)
- **Data Source:** `extracted_positions.sentiment_score_competitor`
- **Row Filter:** `competitor_name IS NOT NULL`
- **Grouping:** By `competitor_name` (e.g., "Netflix", "TikTok")
- **Column Used:** `sentiment_score_competitor` (competitor column)

## Potential Issues

1. **LLM Models showing "—":**
   - Check if `sentiment_score` is populated in `extracted_positions` for brand rows
   - Check if `sentiment_score` is populated in `collector_results`
   - Verify `collectorAggregate.sentimentValues` is being populated (line 558-560)

2. **Competitors all showing same value (55):**
   - Check if `sentiment_score_competitor` is populated in `extracted_positions` for competitor rows
   - Verify each competitor has distinct `sentiment_score_competitor` values
   - Check if aggregation is working correctly (line 651)

## Debug Queries

To verify data in database:

```sql
-- Check brand sentiment in extracted_positions
SELECT 
  collector_type,
  competitor_name,
  sentiment_score,
  sentiment_label,
  COUNT(*) as count
FROM extracted_positions
WHERE brand_id = 'YOUR_BRAND_ID'
  AND competitor_name IS NULL  -- Brand rows only
GROUP BY collector_type, competitor_name, sentiment_score, sentiment_label;

-- Check competitor sentiment in extracted_positions
SELECT 
  competitor_name,
  sentiment_score_competitor,
  sentiment_label_competitor,
  COUNT(*) as count
FROM extracted_positions
WHERE brand_id = 'YOUR_BRAND_ID'
  AND competitor_name IS NOT NULL  -- Competitor rows only
GROUP BY competitor_name, sentiment_score_competitor, sentiment_label_competitor;

-- Check sentiment in collector_results
SELECT 
  id,
  sentiment_score,
  sentiment_label,
  COUNT(*) as count
FROM collector_results
WHERE id IN (
  SELECT DISTINCT collector_result_id 
  FROM extracted_positions 
  WHERE brand_id = 'YOUR_BRAND_ID'
)
GROUP BY id, sentiment_score, sentiment_label;
```

