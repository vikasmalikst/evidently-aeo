# Competitive Visibility Enhancement Plan

## Overview
Enhance the competitive visibility page to:
1. Show brand's own data in the competitive table for easier comparison
2. Add Brand Presence and Top Topics columns for competitors

## Implementation Plan

### Phase 1: Backend - Add Brand Presence and Top Topics for Competitors

#### 1.1 Update Types (`backend/src/services/brand-dashboard/types.ts`)
- [ ] Update `CompetitorVisibility` interface to include:
  - `brandPresencePercentage: number` - Percentage of queries where competitor appears
  - `topTopics: Array<{ topic: string; occurrences: number; share: number; visibility: number }>` - Top topics where competitor is mentioned

#### 1.2 Track Topics per Competitor (`backend/src/services/brand-dashboard/payload-builder.ts`)
- [ ] In the competitor aggregation loop (around line 536-607):
  - Track topics for each competitor by extracting from `row.metadata` or `queryMetadata`
  - Create a `competitorTopics` map: `Map<competitorName, Map<topicName, { occurrences, shareSum, visibilitySum, mentions }>>`
  - Aggregate topic data similar to how we do for brand topics

#### 1.3 Update Visibility Service (`backend/src/services/brand-dashboard/visibility.service.ts`)
- [ ] Update `calculateCompetitorVisibility` method:
  - Accept additional parameters: `totalQueries: number` and `competitorTopics: Map<string, Map<string, TopicStats>>`
  - Calculate `brandPresencePercentage` = (unique queries where competitor appears / totalQueries) * 100
  - Extract top topics from `competitorTopics` map, sorted by occurrences/visibility
  - Return top 5 topics per competitor

#### 1.4 Add Brand Summary to Payload (`backend/src/services/brand-dashboard/payload-builder.ts`)
- [ ] After calculating `llmVisibility`, create a brand summary:
  - Aggregate all LLM visibility data to get overall brand metrics
  - Calculate total brand visibility (average across all LLMs)
  - Calculate total brand share (sum of all LLM shares)
  - Calculate brand presence percentage (from existing `queriesWithBrandPresenceCount` / `totalQueries`)
  - Extract top topics from existing `topicAggregates`
- [ ] Add `brandSummary` field to `BrandDashboardPayload`:
  ```typescript
  brandSummary?: {
    visibility: number
    share: number
    brandPresencePercentage: number
    topTopics: Array<{ topic: string; occurrences: number; share: number; visibility: number }>
  }
  ```

### Phase 2: Frontend - Update Competitive Visibility Table

#### 2.1 Update SearchVisibility Page (`src/pages/SearchVisibility.tsx`)
- [ ] Extract brand summary from API response
- [ ] Create a brand model entry for competitive view:
  ```typescript
  const brandCompetitiveModel = {
    id: 'brand',
    name: selectedBrand.name,
    score: brandSummary.visibility,
    shareOfSearch: brandSummary.share,
    brandPresencePercentage: brandSummary.brandPresencePercentage,
    topTopic: brandSummary.topTopics[0]?.topic ?? '—',
    topTopics: brandSummary.topTopics,
    isBrand: true, // Flag to identify brand row
    // ... other fields
  }
  ```
- [ ] Prepend brand model to `competitorModels` array when `activeTab === 'competitive'`

#### 2.2 Update VisibilityTable Component (`src/components/Visibility/VisibilityTable.tsx`)
- [ ] Update `Model` interface to include `isBrand?: boolean` flag
- [ ] Show Brand Presence and Top Topics columns for competitive tab (remove the conditional hiding)
- [ ] Style brand row differently (e.g., highlighted background, bold text, or special indicator)
- [ ] Update table rendering to show:
  - Brand Presence percentage for all rows (brand + competitors)
  - Top Topic for all rows
  - Expandable row details showing full top topics list

### Phase 3: Data Flow Updates

#### 3.1 Pass Topic Data to Visibility Service
- [ ] In `payload-builder.ts`, after building `competitorAggregates`:
  - Build `competitorTopics` map from topic data
  - Pass `totalQueries` and `competitorTopics` to `calculateCompetitorVisibility`

#### 3.2 Update API Response Structure
- [ ] Ensure `brandSummary` is included in dashboard payload
- [ ] Ensure `competitorVisibility` entries include `brandPresencePercentage` and `topTopics`

## Data Structure Changes

### Backend Types
```typescript
export interface CompetitorVisibility {
  competitor: string
  mentions: number
  share: number
  visibility: number
  brandPresencePercentage: number  // NEW
  topTopics: Array<{                // NEW
    topic: string
    occurrences: number
    share: number
    visibility: number
    mentions: number
  }>
  collectors: Array<{
    collectorType: string
    mentions: number
  }>
}

export interface BrandDashboardPayload {
  // ... existing fields
  brandSummary?: {                  // NEW
    visibility: number
    share: number
    brandPresencePercentage: number
    topTopics: Array<{
      topic: string
      occurrences: number
      share: number
      visibility: number
    }>
  }
}
```

### Frontend Types
```typescript
interface Model {
  // ... existing fields
  isBrand?: boolean  // NEW - to identify brand row
}
```

## Implementation Order

1. **Backend First:**
   - Update types
   - Track competitor topics in payload builder
   - Update visibility service to calculate brand presence and top topics
   - Add brand summary calculation
   - Test backend API responses

2. **Frontend Second:**
   - Update types
   - Extract brand summary and add to competitive models
   - Update table to show all columns for competitive view
   - Style brand row
   - Test UI rendering

## Testing Checklist

- [ ] Backend returns `brandPresencePercentage` for all competitors
- [ ] Backend returns `topTopics` array for all competitors
- [ ] Backend returns `brandSummary` in dashboard payload
- [ ] Frontend shows brand row as first row in competitive table
- [ ] Brand row is visually distinct
- [ ] Brand Presence column shows data for brand and competitors
- [ ] Top Topics column shows data for brand and competitors
- [ ] Expandable rows show full topic lists
- [ ] Sorting works correctly with brand row included
- [ ] Chart includes brand data when brand row is selected

## Notes

- Brand Presence for competitors = percentage of queries where that competitor is mentioned
- Top Topics for competitors = topics/queries where competitor appears most frequently
- Brand row should always be visible and not sortable (or always at top)
- Consider adding a visual indicator (icon, badge, or different background) for the brand row

