# Complete Onboarding & Setup Process Walkthrough

This document provides a comprehensive walkthrough of the entire onboarding and setup process, including all frontend and backend API calls, database insertions, and data flow.

## Table of Contents
1. [Overview](#overview)
2. [Step-by-Step Flow](#step-by-step-flow)
3. [Frontend Components](#frontend-components)
4. [Backend API Endpoints](#backend-api-endpoints)
5. [Database Operations](#database-operations)
6. [Data Flow Diagram](#data-flow-diagram)
7. [Mock/Fallback Data](#mockfallback-data)
8. [Topic Storage & Query Generation](#topic-storage--query-generation)

---

## Overview

The onboarding process consists of **3 main phases**:

1. **Onboarding Phase** (`/onboarding`): Brand selection and competitor selection
2. **Setup Phase** (`/setup`): AI model selection, topic selection, and prompt configuration
3. **Query Generation & Data Collection**: Automatic background processes after setup completion

---

## Step-by-Step Flow

### Phase 1: Authentication & Initial Redirect

**Frontend**: `src/pages/AuthPage.tsx` → `src/App.tsx`

1. User registers/logs in via `/auth`
2. After successful auth, `App.tsx` checks:
   - `localStorage.getItem('onboarding_complete')` 
   - `onboardingUtils.isOnboardingComplete()`
3. Redirects to:
   - `/onboarding` if not complete
   - `/setup` if onboarding complete but setup incomplete
   - `/dashboard` if both complete

**API Calls**: 
- `POST /auth/register` or `POST /auth/login` (via `src/lib/auth.ts`)

**Database Operations**:
- Creates/updates `users` table
- Creates `user_sessions` entry

---

### Phase 2: Onboarding - Brand Selection

**Frontend**: `src/pages/Onboarding.tsx` → `src/components/Onboarding/BrandInput.tsx`

**Step 1: Brand Input**
- User enters brand name/URL
- Frontend calls: `POST /onboarding/brand-intel`

**Backend**: `backend/src/routes/onboarding.routes.ts` → `POST /onboarding/brand-intel`

**API Flow**:
1. Checks if brand exists in database (`brandService.findBrandByUrlOrName`)
2. If exists:
   - Returns existing brand data
   - Fetches existing competitors from `brand_competitors`
   - Fetches existing topics from `brand_topics`
3. If new:
   - Calls `onboardingIntelService.lookupBrandIntel()` (external API - Logo.dev/Brandfetch)
   - Returns brand info + competitor suggestions

**Response Structure**:
```typescript
{
  success: true,
  data: {
    brand: {
      companyName: string,
      website: string,
      domain: string,
      logo: string,
      industry: string,
      // ... other fields
    },
    competitors: Array<{
      name: string,
      domain: string,
      url: string,
      logo: string,
      relevance: string
    }>,
    existing_topics?: string[] // Only if brand exists
  }
}
```

**Data Storage** (Temporary - localStorage only):
- `localStorage.setItem('onboarding_brand', JSON.stringify(brand))`
- **NO database insertion yet**

---

**Step 2: Competitor Selection**
- User selects 3+ competitors from suggestions
- Data stored in component state only
- **NO API call yet**

**Data Storage** (Temporary - localStorage only):
- `localStorage.setItem('onboarding_competitors', JSON.stringify(competitors))`
- **NO database insertion yet**

---

**Step 3: Summary & Continue**
- User reviews brand + competitors
- Clicks "Complete"
- Sets `localStorage.setItem('onboarding_complete', 'true')`
- Navigates to `/setup`

**Database Operations**: **NONE** - All data still in localStorage

---

### Phase 3: Setup - Topic & Model Selection

**Frontend**: `src/pages/Setup.tsx` → `src/components/Onboarding/SetupModal.tsx`

**Step 1: Welcome Screen**
- No API calls
- User clicks "Get Started"

---

**Step 2: AI Model Selection**
- User selects AI models (ChatGPT, Perplexity, Claude, etc.)
- Stored in component state: `selectedModels`
- **NO API call yet**

---

**Step 3: Topic Selection**
**Frontend**: `src/components/Topics/TopicSelectionModal.tsx`

**API Call**: `POST /onboarding/topics`

**Backend**: `backend/src/routes/onboarding.routes.ts` → `POST /onboarding/topics`

**API Flow**:
1. Checks if brand exists in database
2. If exists, fetches existing topics from `brand_topics`
3. Calls `trendingKeywordsService.getTrendingKeywords()` (Gemini API)
   - Returns trending keywords/topics
4. Normalizes topics using `trendingKeywordsService.normalizeTopicsToKeywords()`
5. Calls `aeoCategorizationService.categorizeTopics()` (Cerebras/OpenAI)
   - Categorizes topics into: awareness, comparison, purchase, support
6. Returns structured topics:
   ```typescript
   {
     trending: Topic[],
     aiGenerated: {
       awareness: Topic[],
       comparison: Topic[],
       purchase: Topic[],
       support: Topic[]
     },
     preset: Topic[],
     existing_count: number
   }
   ```

**Data Storage**: **NONE** - Topics displayed to user, stored in component state

**User Action**: Selects 5-10 topics

---

**Step 4: Prompt Configuration**
**Frontend**: `src/components/Onboarding/PromptConfiguration.tsx`

**API Call**: `POST /onboarding/prompts` (optional - for generating prompt suggestions)

**Backend**: `backend/src/routes/onboarding.routes.ts` → `POST /onboarding/prompts`

**API Flow**:
1. Uses Cerebras/OpenAI to generate query prompts for selected topics
2. Returns prompts grouped by topic:
   ```typescript
   [
     { topic: "Topic Name", prompts: ["query 1", "query 2", ...] },
     ...
   ]
   ```

**Data Storage**: **NONE** - Prompts stored in component state

**User Action**: Selects prompts (optional)

---

**Step 5: Complete Setup**
**Frontend**: `src/pages/Setup.tsx` → `handleComplete()`

**API Call**: `POST /brands` (via `submitBrandOnboarding()`)

**Backend**: `backend/src/routes/brand.routes.ts` → `POST /brands`
→ `backend/src/services/brand.service.ts` → `createBrand()`

---

## Complete Database Insertion Flow

When user clicks "Complete Setup", the following happens:

### 1. Brand Creation
**Table**: `brands`
**Fields Inserted**:
```sql
INSERT INTO brands (
  id, customer_id, name, slug, homepage_url, 
  industry, summary, ceo, headquarters, founded_year, metadata
)
VALUES (
  uuid, customer_id, brand_name, slug, website_url,
  industry, description, ceo, headquarters, founded_year,
  {
    ai_models: string[],
    topics: Array<{label, weight, source, category}>,
    ceo, headquarters, founded_year,
    brand_logo, competitors_detail
  }
)
```

**Code Location**: `backend/src/services/brand.service.ts:174-190`

---

### 2. Competitor Insertion
**Table**: `brand_competitors`
**Fields Inserted**:
```sql
INSERT INTO brand_competitors (
  brand_id, competitor_name, competitor_url, priority, metadata
)
VALUES (
  brand_id, name, url, index+1,
  { domain, relevance, industry, logo, source }
)
```

**Code Location**: `backend/src/services/brand.service.ts:240-267`

---

### 3. Topic Insertion
**Table**: `brand_topics`
**Fields Inserted**:
```sql
INSERT INTO brand_topics (
  brand_id, topic_name, description
)
VALUES (
  brand_id, topic_label, ''
)
```

**Code Location**: `backend/src/services/brand.service.ts:269-305`

**Important**: Topics are inserted as **plain strings** in `topic_name` column. Categories are added separately.

---

### 4. Topic Categorization (AI)
**Table**: `brand_topics` (UPDATE)
**Operation**: Updates `category` column for each topic

**API Flow**:
1. Calls `categorizeTopicsWithAI(brandId, topicLabels)`
2. Tries Cerebras AI first
3. Falls back to OpenAI if Cerebras fails
4. Falls back to rule-based categorization if both fail

**Categories**: `awareness`, `comparison`, `purchase`, `post-purchase support`

**Code Location**: `backend/src/services/brand.service.ts:307-324, 1007-1055`

---

### 5. Query Generation (Automatic)
**Triggered**: Automatically after topic insertion

**API Flow**:
1. Calls `queryGenerationService.generateSeedQueries()`
2. Passes `topics: topicLabels` to query generation
3. Uses Cerebras (primary) or OpenAI (fallback)
4. Generates 3-5 queries per topic

**Code Location**: `backend/src/services/brand.service.ts:326-343`

---

### 6. Query Storage
**Table**: `generated_queries`
**Fields Inserted**:
```sql
INSERT INTO generated_queries (
  generation_id, brand_id, customer_id, query_text, intent,
  brand, template_id, evidence_snippet, evidence_source,
  locale, country, metadata
)
VALUES (
  generation_id, brand_id, customer_id, query, intent,
  brand_name, template_id, snippet, source,
  locale, country,
  {
    topic: string,        // ✅ CRITICAL: Topic name stored here
    topic_name: string,   // ✅ Also stored as topic_name for compatibility
    priority: number,
    index: number,
    provider: string
  }
)
```

**Code Location**: `backend/src/services/query-generation.service.ts:2124-2143`

**Critical**: The `metadata.topic` and `metadata.topic_name` fields are populated during query generation. This is the **primary source** of topic information for queries.

---

### 7. Data Collection (Background)
**Triggered**: Automatically after query generation (non-blocking)

**API Flow**:
1. Fetches generated queries from `generated_queries` table
2. Maps selected AI models to collectors (ChatGPT → `chatgpt`, Perplexity → `perplexity`, etc.)
3. Calls `dataCollectionService.executeQueries()` for each query
4. Runs in background (setTimeout) - doesn't block brand creation response

**Tables Updated**:
- `collector_results`: Stores LLM responses
- `citations`: Stores extracted citations
- `extracted_positions`: Stores brand/competitor positions (with `metadata.topic_name`)

**Code Location**: `backend/src/services/brand.service.ts:347-493`

---

## Data Flow Diagram

```
User Input (Brand Name/URL)
    ↓
POST /onboarding/brand-intel
    ↓
[Check Database] → [External API if new]
    ↓
localStorage: onboarding_brand
    ↓
User Selects Competitors
    ↓
localStorage: onboarding_competitors
    ↓
Navigate to /setup
    ↓
POST /onboarding/topics
    ↓
[Gemini: Trending Keywords] + [Cerebras: Categorization]
    ↓
User Selects Topics & Models
    ↓
POST /brands (Complete Setup)
    ↓
┌─────────────────────────────────────┐
│ 1. INSERT brands                    │
│ 2. INSERT brand_competitors         │
│ 3. INSERT brand_topics              │
│ 4. UPDATE brand_topics (categories) │
│ 5. generateSeedQueries()            │
│    └─> INSERT generated_queries     │
│        └─> metadata.topic_name ✅   │
│ 6. executeQueries() (background)    │
│    └─> INSERT collector_results     │
│    └─> INSERT citations             │
│    └─> INSERT extracted_positions   │
│        └─> metadata.topic_name ✅   │
└─────────────────────────────────────┘
```

---

## Mock/Fallback Data

### 1. Topic Generation Fallbacks
**Location**: `backend/src/routes/onboarding.routes.ts:394-400`

If AI topic generation fails, preset topics are returned:
```typescript
const preset = [
  { id: 'preset-1', name: 'Product features', ... },
  { id: 'preset-2', name: 'Customer testimonials', ... },
  { id: 'preset-3', name: 'Integration capabilities', ... },
  { id: 'preset-4', name: 'Security and compliance', ... }
];
```

### 2. Prompt Generation Fallbacks
**Location**: `backend/src/routes/onboarding.routes.ts:678-688`

If AI prompt generation fails, basic prompts are generated:
```typescript
topics.forEach((topic) => {
  generatedQueries.push(
    { topic, query: `What are ${brand_name}'s ${topic.toLowerCase()}?` },
    { topic, query: `How does ${brand_name} handle ${topic.toLowerCase()}?` },
    { topic, query: `${brand_name} ${topic.toLowerCase()} information` }
  );
});
```

### 3. Topic Categorization Fallbacks
**Location**: `backend/src/services/brand.service.ts:1046-1054`

If AI categorization fails, rule-based categorization is used:
- Keywords like "compare", "vs", "better" → `comparison`
- Keywords like "buy", "pricing", "cost" → `purchase`
- Keywords like "support", "help", "troubleshoot" → `support`
- Default → `awareness`

### 4. Query Generation Provider Fallbacks
**Location**: `backend/src/services/query-generation.service.ts:123-156`

- Primary: Cerebras
- Fallback 1: OpenAI
- Fallback 2: Error (no mock data)

---

## Topic Storage & Query Generation

### Where Topics Are Stored

1. **`brand_topics` table**:
   - `topic_name`: Plain topic string (e.g., "Product features")
   - `category`: One of: `awareness`, `comparison`, `purchase`, `post-purchase support`
   - **Inserted during**: Brand creation (Step 3 above)

2. **`generated_queries.metadata`**:
   - `metadata.topic`: Topic name
   - `metadata.topic_name`: Topic name (duplicate for compatibility)
   - **Populated during**: Query generation (Step 5 above)
   - **Code**: `backend/src/services/query-generation.service.ts:2136-2139`

3. **`extracted_positions.metadata`**:
   - `metadata.topic_name`: Topic name
   - **Populated during**: Position extraction (after data collection)
   - **Code**: `backend/src/services/scoring/position-extraction.service.ts` (recently added)

### Topic Flow in Query Generation

```
brand_topics.topic_name (user selected)
    ↓
Passed to generateSeedQueries({ topics: topicLabels })
    ↓
Query generation creates queries with metadata:
  metadata: {
    topic: topicName,
    topic_name: topicName
  }
    ↓
INSERT INTO generated_queries (metadata)
    ↓
During data collection, queries are executed
    ↓
Position extraction reads query_id → fetches generated_queries.metadata.topic_name
    ↓
INSERT INTO extracted_positions (metadata: { topic_name })
```

### Critical Issue: Legacy Data

**Problem**: Existing `generated_queries` rows created before topic metadata was added have `metadata = {}` or `metadata = null`.

**Solution**: 
1. **New data**: All new queries automatically include `metadata.topic_name`
2. **Legacy data**: Cannot be backfilled without re-running query generation

**Verification Query**:
```sql
SELECT id, metadata->>'topic_name' as topic_name, created_at
FROM generated_queries
WHERE brand_id = 'your-brand-id'
ORDER BY created_at DESC
LIMIT 10;
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose | Database Operations |
|----------|--------|---------|---------------------|
| `/auth/register` | POST | User registration | INSERT `users` |
| `/auth/login` | POST | User login | INSERT `user_sessions` |
| `/onboarding/brand-intel` | POST | Get brand info | READ `brands`, `brand_competitors`, `brand_topics` |
| `/onboarding/competitors` | POST | Refresh competitors | None (external API) |
| `/onboarding/topics` | POST | Generate topics | READ `brand_topics` (if exists) |
| `/onboarding/prompts` | POST | Generate prompts | None (AI generation only) |
| `/brands` | POST | Complete onboarding | INSERT `brands`, `brand_competitors`, `brand_topics`, `generated_queries` |
| `/brands/:id/topics` | GET | Get brand topics | READ `brand_topics` |
| `/brands/:id/categorize-topics` | POST | Re-categorize topics | UPDATE `brand_topics` |

---

## Testing Checklist

### ✅ Verify Brand Creation
```sql
SELECT id, name, industry, metadata->'ai_models' as models
FROM brands
WHERE customer_id = 'your-customer-id'
ORDER BY created_at DESC;
```

### ✅ Verify Competitors
```sql
SELECT competitor_name, competitor_url, priority
FROM brand_competitors
WHERE brand_id = 'your-brand-id'
ORDER BY priority;
```

### ✅ Verify Topics
```sql
SELECT topic_name, category, created_at
FROM brand_topics
WHERE brand_id = 'your-brand-id'
ORDER BY created_at;
```

### ✅ Verify Query Generation
```sql
SELECT 
  query_text, 
  metadata->>'topic_name' as topic,
  metadata->>'topic' as topic_alt,
  created_at
FROM generated_queries
WHERE brand_id = 'your-brand-id'
ORDER BY created_at DESC
LIMIT 20;
```

### ✅ Verify Topic Metadata in Queries
```sql
SELECT 
  COUNT(*) as total_queries,
  COUNT(metadata->>'topic_name') as queries_with_topic
FROM generated_queries
WHERE brand_id = 'your-brand-id';
```

### ✅ Verify Position Extraction Metadata
```sql
SELECT 
  COUNT(*) as total_positions,
  COUNT(metadata->>'topic_name') as positions_with_topic
FROM extracted_positions
WHERE brand_id = 'your-brand-id';
```

---

## Common Issues & Solutions

### Issue 1: Topics Not Appearing in Dashboard
**Cause**: `generated_queries.metadata.topic_name` is empty for legacy data
**Solution**: Re-run query generation or wait for new data collection

### Issue 2: Topic Categorization Failing
**Cause**: AI API keys not configured or API errors
**Solution**: Check logs for fallback to rule-based categorization (should still work)

### Issue 3: Query Generation Not Triggering
**Cause**: Error in `generateSeedQueries()` is caught and logged but doesn't block brand creation
**Solution**: Check backend logs for query generation errors

### Issue 4: Data Collection Not Running
**Cause**: Background process may fail silently
**Solution**: Check `collector_results` table for recent entries, check backend logs

---

## Next Steps After Onboarding

1. **Dashboard Load**: `GET /brands/:id/dashboard`
   - Aggregates data from `extracted_positions`, `citations`, `generated_queries`
   - Uses `metadata.topic_name` to group by topic

2. **Position Extraction**: Runs via cron or manual trigger
   - Reads `collector_results`
   - Extracts brand/competitor positions
   - Links to `generated_queries` to get `topic_name`
   - Stores in `extracted_positions.metadata.topic_name`

3. **Dashboard Visuals**: 
   - "Top Performing Topics" uses `extracted_positions.metadata.topic_name`
   - "Top Brand Sources" uses `citations` + `extracted_positions`

---

## Summary

**Key Points**:
1. ✅ Topics are stored in `brand_topics` during brand creation
2. ✅ Topics are passed to query generation and stored in `generated_queries.metadata.topic_name`
3. ✅ Position extraction reads topic from `generated_queries` and stores in `extracted_positions.metadata.topic_name`
4. ⚠️ Legacy data (created before topic metadata was added) will have empty `metadata.topic_name`
5. ✅ All new data automatically includes topic metadata
6. ✅ Fallbacks exist for AI failures (preset topics, rule-based categorization, basic prompts)

**Data Flow**:
```
User Selection → brand_topics → Query Generation → generated_queries.metadata.topic_name 
→ Data Collection → Position Extraction → extracted_positions.metadata.topic_name → Dashboard
```

