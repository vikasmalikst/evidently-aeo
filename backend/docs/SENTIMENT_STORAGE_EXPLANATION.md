# Sentiment Score Storage Explanation

## Overview

Sentiment scores for brands and competitors are stored in the `extracted_positions` table using a **dual-column pattern** (similar to other metrics like `visibility_index` vs `visibility_index_competitor`).

## Table Structure

The `extracted_positions` table has **separate columns** for brand and competitor sentiment:

### Brand Sentiment Columns
- `sentiment_label` - POSITIVE, NEGATIVE, or NEUTRAL
- `sentiment_score` - Numeric score from -1.0 to 1.0
- `sentiment_positive_sentences` - JSONB array of positive sentences
- `sentiment_negative_sentences` - JSONB array of negative sentences

### Competitor Sentiment Columns
- `sentiment_label_competitor` - POSITIVE, NEGATIVE, or NEUTRAL
- `sentiment_score_competitor` - Numeric score from -1.0 to 1.0
- `sentiment_positive_sentences_competitor` - JSONB array of positive sentences
- `sentiment_negative_sentences_competitor` - JSONB array of negative sentences

## Row Structure

The `extracted_positions` table uses a **one-row-per-entity** pattern:

### 1. Brand Row
- `competitor_name` = **NULL**
- Brand sentiment stored in: `sentiment_label`, `sentiment_score`, etc.
- Competitor sentiment columns = **NULL** (not used)

### 2. Competitor Rows (one per competitor)
- `competitor_name` = "CompetitorA", "CompetitorB", etc.
- Competitor sentiment stored in: `sentiment_label_competitor`, `sentiment_score_competitor`, etc.
- Brand sentiment columns = **NULL** or contain brand sentiment (depending on context)

## Example Data Structure

For a single `collector_result_id`, you might have:

```
Row 1 (Brand):
  - competitor_name: NULL
  - sentiment_label: "POSITIVE"
  - sentiment_score: 0.75
  - sentiment_label_competitor: NULL
  - sentiment_score_competitor: NULL

Row 2 (Competitor A):
  - competitor_name: "Nike"
  - sentiment_label: NULL (or brand sentiment if needed)
  - sentiment_score: NULL
  - sentiment_label_competitor: "NEUTRAL"
  - sentiment_score_competitor: 0.12

Row 3 (Competitor B):
  - competitor_name: "Adidas"
  - sentiment_label: NULL
  - sentiment_score: NULL
  - sentiment_label_competitor: "NEGATIVE"
  - sentiment_score_competitor: -0.45
```

## How It Works

### 1. Sentiment Analysis (One API Call)
When processing sentiment, the service:
- Groups all rows by `collector_result_id`
- Makes **one LLM API call** to analyze sentiment for brand + all competitors together
- Gets back sentiment for all entities in one response

### 2. Storage Logic
```typescript
// Brand row (competitor_name is NULL)
if (competitor_name === NULL) {
  // Store in brand columns
  sentiment_label = "POSITIVE"
  sentiment_score = 0.75
  // Competitor columns remain NULL
}

// Competitor row (competitor_name is "Nike")
if (competitor_name === "Nike") {
  // Store in competitor columns
  sentiment_label_competitor = "NEUTRAL"
  sentiment_score_competitor = 0.12
  // Brand columns may be NULL or contain brand data
}
```

### 3. Update Function
The `updatePositionRowsSentiment()` function uses an `isCompetitor` flag:

```typescript
if (isCompetitor) {
  // Store in competitor columns
  updateData.sentiment_label_competitor = sentiment.label;
  updateData.sentiment_score_competitor = sentiment.score;
} else {
  // Store in brand columns
  updateData.sentiment_label = sentiment.label;
  updateData.sentiment_score = sentiment.score;
}
```

## Why This Design?

1. **Consistency**: Follows the same pattern as other metrics (`visibility_index` vs `visibility_index_competitor`)
2. **Efficiency**: One API call analyzes all entities, then results are distributed to appropriate rows
3. **Query Flexibility**: Easy to filter by:
   - Brand sentiment: `WHERE competitor_name IS NULL AND sentiment_score IS NOT NULL`
   - Competitor sentiment: `WHERE competitor_name = 'Nike' AND sentiment_score_competitor IS NOT NULL`
   - All sentiment: `WHERE sentiment_score IS NOT NULL OR sentiment_score_competitor IS NOT NULL`

## Key Points

✅ **Brand sentiment** → stored in columns without `_competitor` suffix (when `competitor_name` is NULL)  
✅ **Competitor sentiment** → stored in columns with `_competitor` suffix (when `competitor_name` is set)  
✅ **One API call** → analyzes brand + all competitors together  
✅ **Multiple rows** → one row per entity (brand + each competitor)  
✅ **Same collector_result_id** → all rows share the same `collector_result_id` (same answer text)

## Common Queries

### Get brand sentiment
```sql
SELECT * FROM extracted_positions 
WHERE competitor_name IS NULL 
  AND sentiment_score IS NOT NULL;
```

### Get competitor sentiment
```sql
SELECT * FROM extracted_positions 
WHERE competitor_name = 'Nike' 
  AND sentiment_score_competitor IS NOT NULL;
```

### Get all sentiment for a collector result
```sql
SELECT * FROM extracted_positions 
WHERE collector_result_id = 123
  AND (sentiment_score IS NOT NULL OR sentiment_score_competitor IS NOT NULL);
```

