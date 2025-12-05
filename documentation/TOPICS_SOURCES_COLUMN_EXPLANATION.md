# Topics Page - SOURCES Column Explanation

## Purpose of the SOURCES Column

The **SOURCES** column in the Topics page displays the **Brand Presence Percentage** - the percentage of queries/results where your brand was mentioned or had presence for that specific topic.

## How the Value is Calculated

### Backend Calculation

The percentage is calculated in `backend/src/services/brand.service.ts` (lines 1561-1578):

```typescript
// Count queries where brand had presence
const brandPresenceCount = analytics.filter(a => a.has_brand_presence).length;
const totalQueries = analytics.length;

// Calculate percentage
const brandPresencePercentage = totalQueries > 0
  ? (brandPresenceCount / totalQueries) * 100
  : null;
```

### Formula

```
Brand Presence Percentage = (Queries with Brand Presence / Total Queries) × 100
```

### Example

- Topic: "Excederin migraine relief"
- Total queries: 100
- Queries where brand was mentioned: 70
- **SOURCES value: 70.0%**

## Data Flow

1. **Backend**: Calculates `brandPresencePercentage` for each topic in `getBrandTopicsWithAnalytics()`
2. **API Response**: Returns `brandPresencePercentage` in the topics array (rounded to 0 decimals)
3. **Frontend Interface**: `BackendTopic` interface includes `brandPresencePercentage?: number | null`
4. **Current Status**: The value is returned but not currently displayed in the SOURCES column

## Current Implementation Status

- ✅ Backend calculates and returns `brandPresencePercentage`
- ✅ Frontend interface includes the field
- ❌ Frontend transformation doesn't map it to the topic data
- ❌ SOURCES column currently shows source badges instead of percentage

## Meaning of the Percentage

- **High percentage (70-100%)**: Your brand is frequently mentioned/present in responses for this topic
- **Medium percentage (30-69%)**: Moderate brand presence
- **Low percentage (0-29%)**: Your brand has limited presence for this topic (opportunity for improvement)

## Related Fields

- **SOA (Share of Answer)**: Measures how much of the answer is about your brand
- **Brand Presence Percentage**: Measures how often your brand appears in responses
- Both metrics complement each other to give a complete picture of brand visibility






