# Brand, Product, Competitor, and Keywords Count per LLM - Implementation Summary

## Overview

This document describes how Brand, Product, Competitor, and Keywords counts are fetched and displayed per LLM (collector) in the Responses section of the Prompts page.

## Data Structure

### TypeScript Interface

**File**: `src/types/prompts.ts`

```typescript
export interface CollectorResponse {
  collectorResultId: number
  collectorType: string          // LLM name (e.g., "ChatGPT", "Claude", "Perplexity")
  response: string                // The actual response text
  lastUpdated: string             // ISO timestamp
  brandMentions: number | null    // Count of brand mentions in this response
  productMentions: number | null  // Count of product mentions in this response
  competitorMentions: number | null // Count of competitor mentions in this response
}

export interface PromptEntry {
  id: string
  question: string
  topic: string
  responses?: CollectorResponse[]  // Array of responses, one per LLM/collector
  // ... other fields
}
```

**Key Points:**
- Each `PromptEntry` has a `responses` array
- Each item in `responses` represents one LLM's response to that prompt
- Each response has its own counts: `brandMentions`, `productMentions`, `competitorMentions`
- Counts are `number | null` (null if not available)

## Data Fetching

### API Endpoint

**Endpoint**: `GET /brands/{brandId}/prompts?startDate={startDate}&endDate={endDate}&collectors={collectorTypes}`

**Query Parameters:**
- `startDate`: Start date for date range filter
- `endDate`: End date for date range filter
- `collectors`: (Optional) Comma-separated list of collector types to filter by (e.g., "ChatGPT,Claude")

### Response Structure

**File**: `src/pages/Prompts.tsx`

The API returns a `PromptAnalyticsPayload`:

```typescript
interface PromptAnalyticsPayload {
  brandId: string
  brandName: string
  dateRange: { start: string; end: string }
  collectors: string[]  // Available collectors
  totalPrompts: number
  totalResponses: number
  topics: PromptTopic[]  // Array of topics
}

interface PromptTopic {
  id: string
  name: string
  prompts: PromptEntry[]  // Array of prompts
}
```

### Fetching Logic

**File**: `src/pages/Prompts.tsx` (lines 55-90)

```typescript
const promptsEndpoint = useMemo(() => {
  if (!selectedBrandId || brandsLoading) return null;
  const params = new URLSearchParams({
    startDate: startDate ? new Date(startDate + 'T00:00:00Z').toISOString() : '',
    endDate: endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : ''
  });

  // Filter by collector on backend
  if (selectedLLMs.length > 0) {
    params.set('collectors', selectedLLMs.join(','));
  }

  return `/brands/${selectedBrandId}/prompts?${params.toString()}`;
}, [selectedBrandId, startDate, endDate, brandsLoading, selectedLLMs]);

const {
  data: response,
  loading,
  error: fetchError
} = useCachedData<ApiResponse<PromptAnalyticsPayload>>(
  promptsEndpoint,
  {},
  { requiresAuth: true },
  { enabled: !!promptsEndpoint, refetchOnMount: false }
);
```

**Key Points:**
- Endpoint is memoized and recalculated when filters change
- Uses `useCachedData` hook for caching (see PAGE_LOAD_PERFORMANCE_SUMMARY.md)
- Response contains nested structure: `topics[] -> prompts[] -> responses[]`
- Each prompt can have multiple responses (one per LLM/collector)

## Data Display

### Component: ResponseViewer

**File**: `src/components/Prompts/ResponseViewer.tsx`

### Filtering Responses by Selected LLMs

**Lines 18-58**: Filters responses based on selected LLMs

```typescript
const filteredResponses = useMemo(() => {
  if (!prompt) return [];
  
  // If responses array exists, use it
  if (prompt.responses && prompt.responses.length > 0) {
    // If no LLMs selected (All Models), show all responses
    if (selectedLLMs.length === 0) {
      return prompt.responses;
    }
    // Otherwise filter by selected collectors
    return prompt.responses.filter(r => selectedLLMs.includes(r.collectorType));
  }
  
  // Fallback: single response mode (legacy support)
  // ...
  
  return [];
}, [prompt, selectedLLMs]);
```

**Key Points:**
- Filters `prompt.responses` array based on `selectedLLMs`
- If no LLMs selected, shows all responses
- Each response in the filtered array represents one LLM/collector

### Displaying Counts Per LLM

**Lines 170-224**: Renders each response with its counts

```typescript
{filteredResponses.map((responseItem, index) => {
  return (
    <div key={`${responseItem.collectorResultId}-${index}`}>
      {/* LLM/Collector Header */}
      <div className="flex items-center gap-2 mb-1">
        {getLLMIcon(responseItem.collectorType)}
        <span className="text-sm font-semibold">
          {responseItem.collectorType}  {/* e.g., "ChatGPT" */}
        </span>
        {formattedDate && <span>• {formattedDate}</span>}
      </div>

      {/* Counts Display - Only shows if at least one count is not null */}
      {(responseItem.brandMentions !== null ||
        responseItem.productMentions !== null ||
        responseItem.competitorMentions !== null) && (
        <div className="text-xs flex items-center gap-2 mb-3 flex-wrap">
          {responseItem.brandMentions !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[var(--bg-secondary)]">
              Brand: {responseItem.brandMentions}
            </span>
          )}
          {responseItem.productMentions !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[var(--bg-secondary)]">
              Product: {responseItem.productMentions}
            </span>
          )}
          {responseItem.competitorMentions !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[var(--bg-secondary)]">
              Competitor: {responseItem.competitorMentions}
            </span>
          )}
        </div>
      )}

      {/* Response Text */}
      <div className="text-sm">
        <KeywordHighlighter text={responseItem.response} ... />
      </div>
    </div>
  );
})}
```

**Key Points:**
- Each response item is rendered separately
- Shows LLM/collector name (e.g., "ChatGPT") as header
- Displays counts in pill/badge format: "Brand: X", "Product: Y", "Competitor: Z"
- Counts are only displayed if at least one is not null
- Each count is only shown if its value is not null
- Counts are displayed **per response/LLM**, not aggregated

## Expected Backend Response Structure

The backend API should return data in this format:

```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "id": "topic-1",
        "name": "Product Features",
        "prompts": [
          {
            "id": "prompt-1",
            "question": "What are the key features?",
            "responses": [
              {
                "collectorResultId": 123,
                "collectorType": "ChatGPT",
                "response": "Response text here...",
                "lastUpdated": "2025-01-28T10:00:00Z",
                "brandMentions": 5,
                "productMentions": 3,
                "competitorMentions": 2
              },
              {
                "collectorResultId": 124,
                "collectorType": "Claude",
                "response": "Response text here...",
                "lastUpdated": "2025-01-28T10:05:00Z",
                "brandMentions": 4,
                "productMentions": 2,
                "competitorMentions": 1
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Critical Requirements:**
1. Each prompt must have a `responses` array (even if empty)
2. Each response object must have:
   - `collectorType`: String identifying the LLM/collector
   - `brandMentions`: Number or null
   - `productMentions`: Number or null
   - `competitorMentions`: Number or null
3. Counts should be calculated **per response/collector**, not aggregated across all responses
4. Multiple responses per prompt = one response per LLM that answered the prompt

## Data Flow Summary

1. **User selects prompt** → `selectedPrompt` state updated in `Prompts.tsx`
2. **ResponseViewer receives prompt** → `prompt.responses[]` array contains all LLM responses
3. **Filtering by selected LLMs** → `filteredResponses` contains only selected LLMs' responses
4. **Rendering** → Each response in `filteredResponses` is rendered with:
   - LLM/collector name (header)
   - Counts (brandMentions, productMentions, competitorMentions) as badges
   - Response text with highlighting

## Notes on Keywords Count

**Current Implementation**: Keywords count is **not currently displayed** in the ResponseViewer component, even though the user mentioned it. The component only displays:
- Brand mentions count
- Product mentions count
- Competitor mentions count

**If keywords count needs to be added:**
1. Add `keywordsCount: number | null` to `CollectorResponse` interface
2. Update backend to return `keywordsCount` in each response object
3. Add display logic in ResponseViewer (similar to other counts):
   ```typescript
   {responseItem.keywordsCount !== null && (
     <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[var(--bg-secondary)]">
       Keywords: {responseItem.keywordsCount}
     </span>
   )}
   ```

## Common Issues to Check

1. **Backend Response Structure**: Ensure backend returns `responses` array (not single `response` object)
2. **Count Fields**: Verify backend returns `brandMentions`, `productMentions`, `competitorMentions` in each response object
3. **Null Handling**: Frontend handles `null` values gracefully (only displays counts that are not null)
4. **Per-Collector Calculation**: Counts must be calculated per collector/LLM, not aggregated across all collectors
5. **Data Type**: Counts should be numbers, not strings
6. **Missing Responses Array**: If a prompt has no responses, `responses` should be an empty array `[]`, not `null` or `undefined`

## Files Reference

- **Types**: `src/types/prompts.ts`
- **Fetching**: `src/pages/Prompts.tsx` (lines 55-118)
- **Display**: `src/components/Prompts/ResponseViewer.tsx` (lines 170-224)
- **API Endpoint**: `GET /brands/{brandId}/prompts`

