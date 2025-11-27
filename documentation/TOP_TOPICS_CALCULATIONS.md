# Top Performing Topics - Calculation Details

## Overview
This document explains how the "Top Performing Topics" section calculates Brand Presence and how topics are ranked.

## Brand Presence Calculation

### Current Implementation
The Brand Presence percentage is calculated in `backend/src/services/brand-dashboard/payload-builder.ts`:

```typescript
const brandPresencePercentage = promptsTracked > 0 && aggregate.brandPresenceCount > 0
  ? Math.min(100, round((aggregate.brandPresenceCount / promptsTracked) * 100, 1))
  : null
```

Where:
- `promptsTracked` = Number of unique query IDs (`aggregate.queryIds.size`)
- `brandPresenceCount` = Count of rows where `has_brand_presence === true` (incremented per row, not per query)

### The Issue
**Problem**: `brandPresenceCount` is incremented for each **row** that has brand presence, not for each unique query. This means:

- If a single query has multiple rows (e.g., multiple LLM responses, multiple positions, or multiple collector results), `brandPresenceCount` can exceed `promptsTracked`
- This results in percentages > 100%, which are then capped at 100% by `Math.min(100, ...)`
- This is why you're seeing 100% in the UI even when the database shows values less than 100%

**Example**:
- Topic has 4 unique queries (`promptsTracked = 4`)
- But there are 5 rows with `has_brand_presence = true` (one query appears in multiple rows)
- Calculation: `(5 / 4) * 100 = 125%` → capped to `100%`

### Fix Implemented ✅
The fix has been implemented to track unique queries with brand presence instead of counting rows:

**Changes made:**
1. Changed `brandPresenceCount: number` to `queriesWithBrandPresence: Set<string>` in the topic aggregate type
2. Updated aggregation logic to add unique query IDs to the Set when:
   - `isBrandRow` is true (competitor_name is null/empty)
   - `hasBrandPresence` is true
   - `row.query_id` exists
3. Updated calculation to use `Set.size` instead of count
4. Removed the `Math.min(100, ...)` cap since tracking unique queries ensures the percentage can never exceed 100%

**Code location:** `backend/src/services/brand-dashboard/payload-builder.ts` (lines 520-523, 1300-1302)

This ensures the percentage accurately reflects the percentage of unique queries (not rows) that include brand presence, and only counts queries where `competitor_name` is null.

## Topic Ranking

Topics are ranked using the following logic (line 1321 in `payload-builder.ts`):

```typescript
.sort((a, b) => b.averageVolume - a.averageVolume || b.promptsTracked - a.promptsTracked)
```

### Ranking Criteria (in order of priority):

1. **Primary Sort: `averageVolume` (descending)**
   - `averageVolume` = Percentage of total citation usage for that topic
   - Calculated as: `(topic.citationUsage / totalTopicCitationUsage) * 100`
   - Topics with higher citation usage appear first

2. **Secondary Sort: `promptsTracked` (descending)**
   - `promptsTracked` = Number of unique queries tracked for that topic
   - Used as a tiebreaker when `averageVolume` is equal
   - Topics with more queries tracked appear first

### Final Selection
After sorting, only the top 5 topics are selected (`.slice(0, 5)`).

## Other Metrics

### Visibility Score
- Average of all visibility values for the topic
- Converted to percentage: `average(visibilityValues) * 100`
- Rounded to 1 decimal place

### Share of Answers
- Average of all share values for the topic
- Rounded to 1 decimal place

### Sentiment Score
- Average of all sentiment values for the topic
- Range: -1 to 1 (negative = negative sentiment, positive = positive sentiment)
- Rounded to 2 decimal places

## Location in Codebase

- **Backend Calculation**: `backend/src/services/brand-dashboard/payload-builder.ts` (lines 1272-1322)
- **Frontend Display**: `src/pages/dashboard/components/TopTopics.tsx`

