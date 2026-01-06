# Topics and Prompts Generation Flow

This document outlines the complete flow from topics generation to prompts generation, including all API calls at each step.

## Overview

The flow consists of two main stages:
1. **Topics Generation** - Generate topics for a brand
2. **Prompts Generation** - Generate search queries/prompts for selected topics

---

## Stage 1: Topics Generation

### Frontend Entry Point
- **Component**: `src/components/Topics/TopicSelectionModal.tsx`
- **API Function**: `fetchTopicsForBrand()` from `src/api/onboardingApi.ts`
- **Endpoint Called**: `POST /onboarding/topics`

### Backend Route
- **File**: `backend/src/routes/onboarding.routes.ts`
- **Route**: `POST /onboarding/topics` (line 255)
- **Authentication**: Required (`authenticateToken` middleware)

### Flow Steps

#### Step 1: Request Validation & Brand Lookup
- Validates `brand_name` is provided
- Extracts `customer_id` from authenticated user
- Attempts to find existing brand in database:
  - First by `brand_id` (if provided)
  - Then by `website_url` or `brand_name`
- Retrieves existing topics from database if brand exists

#### Step 2: Topics Generation Service
- **Service**: `topicsQueryGenerationService.generateTopicsAndQueries()`
- **File**: `backend/src/services/topics-query-generation.service.ts`
- **Input Parameters**:
  - `brandName`: Brand name
  - `industry`: Industry (from existing brand or request)
  - `competitors`: Competitor list (from existing brand or request)
  - `maxTopics`: 20 (default)

#### Step 3: External API Calls for Topics Generation

The service tries multiple providers in order:

**Primary: OpenRouter API**
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Method**: POST
- **Model**: `qwen/qwen3-235b-a22b-2507` (configurable via `OPENROUTER_TOPICS_MODEL`)
- **Headers**:
  - `Authorization: Bearer {OPENROUTER_API_KEY}`
  - `Content-Type: application/json`
  - `HTTP-Referer: {OPENROUTER_SITE_URL}` (if configured)
  - `X-Title: {OPENROUTER_SITE_TITLE}` (if configured)
- **Request Body**:
  - `model`: OpenRouter model name
  - `messages`: System + user prompt
  - `temperature`: 0.7
  - `max_tokens`: 4000
- **Timeout**: 90 seconds

**Fallback: Cerebras API**
- **Endpoint**: `https://api.cerebras.ai/v1/chat/completions`
- **Method**: POST
- **Model**: `gpt-4o-mini` (configurable via `CEREBRAS_MODEL`)
- **Headers**:
  - `Authorization: Bearer {CEREBRAS_API_KEY}`
  - `Content-Type: application/json`
- **Request Body**:
  - `model`: Cerebras model name
  - `messages`: System + user prompt
  - `temperature`: 0.7
  - `max_tokens`: 4000
- **Timeout**: 90 seconds

#### Step 4: Response Processing
- Parses JSON response from LLM
- Extracts topics with:
  - `intentArchetype`: One of 10 intent types (best_of, comparison, alternatives, pricing_or_value, use_case, how_to, problem_solving, beginner_explain, expert_explain, technical_deep_dive)
  - `topic`: Topic name
  - `description`: Topic description
  - `query`: Associated query (generated with topic)
  - `priority`: Priority score (1-5)
- Filters and ranks topics by priority
- Limits to top 20 topics (or `maxTopics`)

#### Step 5: Trending Keywords (Parallel, Non-blocking)
- **Service**: `trendingKeywordsService.getTrendingKeywords()`
- **File**: `backend/src/services/keywords/trending-keywords.service.ts`
- **Timeout**: 5 seconds (non-blocking)
- **API Calls** (in order):
  1. **OpenRouter API** (Primary)
     - Endpoint: `https://openrouter.ai/api/v1/chat/completions`
     - Model: `openai/gpt-oss-20b`
  2. **Cerebras API** (Fallback)
     - Endpoint: `https://api.cerebras.ai/v1/completions`
     - Model: `qwen-3-235b-a22b-instruct-2507`
  3. **Google Gemini API** (Final Fallback)
     - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
     - Model: `gemini-1.5-flash-002` (configurable via `GOOGLE_GEMINI_MODEL`)
     - Query param: `key={GOOGLE_GEMINI_API_KEY}`

#### Step 6: Response Formatting
- Organizes topics by category (awareness, comparison, purchase, post-purchase support)
- Maps intent archetypes to categories
- Includes:
  - `trending`: Trending topics (from trending keywords service)
  - `aiGenerated`: AI-generated topics organized by category
  - `preset`: Preset fallback topics
  - `existing_count`: Count of existing topics from database
  - `primaryDomain`: Primary domain of value for the brand

### Response Structure
```typescript
{
  success: true,
  data: {
    trending: Array<{id, name, source, relevance, trendingIndicator}>,
    aiGenerated: {
      awareness: Array<Topic>,
      comparison: Array<Topic>,
      purchase: Array<Topic>,
      support: Array<Topic>
    },
    preset: Array<{id, name, source, relevance}>,
    existing_count: number,
    primaryDomain: string
  }
}
```

---

## Stage 2: Prompts Generation

### Frontend Entry Point
- **Component**: `src/components/Onboarding/PromptConfiguration.tsx`
- **API Function**: `fetchPromptsForTopics()` from `src/api/onboardingApi.ts`
- **Endpoint Called**: `POST /onboarding/prompts`

### Backend Route
- **File**: `backend/src/routes/onboarding.routes.ts`
- **Route**: `POST /onboarding/prompts` (line 497)
- **Authentication**: Required (`authenticateToken` middleware)

### Flow Steps

#### Step 1: Request Validation & Brand Lookup
- Validates `brand_name` and `topics` array are provided
- Extracts `customer_id` from authenticated user
- Attempts to find existing brand in database (same as topics flow)
- Uses existing brand data (industry, competitors) if available

#### Step 2: Prompt Building
- Builds a prompt requesting 3-5 search queries per topic
- Includes:
  - Brand name (for context, but queries should NOT include it)
  - Industry
  - Competitors (for context)
  - List of topics to generate queries for
- **Critical Rules**:
  - Queries must be NEUTRAL and INDUSTRY-FOCUSED
  - DO NOT include brand name in queries
  - DO NOT include competitor names (unless comparison query)

#### Step 3: External API Calls for Prompts Generation

The route tries multiple providers in order:

**Step 3.1: OpenRouter API (Primary)**
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Method**: POST
- **Model**: `qwen/qwen3-235b-a22b-2507` (configurable via `OPENROUTER_MODEL`)
- **Headers**:
  - `Authorization: Bearer {OPENROUTER_API_KEY}`
  - `Content-Type: application/json`
  - `HTTP-Referer: {OPENROUTER_SITE_URL}` (if configured)
  - `X-Title: {OPENROUTER_SITE_TITLE}` (if configured)
- **Request Body**:
  - `model`: OpenRouter model name
  - `messages`: System + user prompt
  - `temperature`: 0.7
  - `max_tokens`: 2000

**Step 3.2: Cerebras API (Secondary Fallback)**
- **Endpoint**: `https://api.cerebras.ai/v1/completions`
- **Method**: POST
- **Model**: `qwen-3-235b-a22b-instruct-2507` (configurable via `CEREBRAS_MODEL`)
- **Headers**:
  - `Authorization: Bearer {CEREBRAS_API_KEY}`
  - `Content-Type: application/json`
- **Request Body**:
  - `model`: Cerebras model name
  - `prompt`: User prompt (string, not messages array)
  - `max_tokens`: 2000
  - `temperature`: 0.7
  - `stop`: ['---END---']

**Step 3.3: Google Gemini API (Tertiary Fallback)**
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Method**: POST
- **Model**: `gemini-1.5-flash-002` (configurable via `GOOGLE_GEMINI_MODEL`)
- **Query Parameter**: `key={GOOGLE_GEMINI_API_KEY}`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  - `contents`: Array with user role and prompt text
  - `generationConfig`:
    - `temperature`: 0.7
    - `maxOutputTokens`: 2000

#### Step 4: Response Processing
- Extracts JSON array from LLM response
- Handles markdown code blocks if present
- Parses array of `{topic: string, query: string}` objects
- Groups queries by topic
- Maps queries to input topics (ensures all topics have prompts)

#### Step 5: Response Formatting
- Formats as array of topic-prompts pairs
- Each topic gets an array of prompts (3-5 queries per topic)

### Response Structure
```typescript
{
  success: true,
  data: Array<{
    topic: string,
    prompts: string[]
  }>
}
```

---

## Environment Variables Required

### Topics Generation
- `OPENROUTER_API_KEY` - Primary provider
- `OPENROUTER_TOPICS_MODEL` - Model for topics (optional, defaults to `qwen/qwen3-235b-a22b-2507`)
- `OPENROUTER_SITE_URL` - Optional, for OpenRouter tracking
- `OPENROUTER_SITE_TITLE` - Optional, for OpenRouter tracking
- `CEREBRAS_API_KEY` - Fallback provider
- `CEREBRAS_MODEL` - Model for Cerebras (optional, defaults to `gpt-4o-mini`)

### Prompts Generation
- `OPENROUTER_API_KEY` - Primary provider
- `OPENROUTER_MODEL` - Model for prompts (optional, defaults to `qwen/qwen3-235b-a22b-2507`)
- `OPENROUTER_SITE_URL` - Optional, for OpenRouter tracking
- `OPENROUTER_SITE_TITLE` - Optional, for OpenRouter tracking
- `CEREBRAS_API_KEY` - Secondary fallback
- `CEREBRAS_MODEL` - Model for Cerebras (optional, defaults to `qwen-3-235b-a22b-instruct-2507`)
- `GOOGLE_GEMINI_API_KEY` - Tertiary fallback (or `GEMINI_API_KEY` for compatibility)
- `GOOGLE_GEMINI_MODEL` - Model for Gemini (optional, defaults to `gemini-1.5-flash-002`)

### Trending Keywords (used in topics flow)
- `OPENROUTER_API_KEY` - Primary provider
- `CEREBRAS_API_KEY` - Fallback
- `GOOGLE_GEMINI_API_KEY` - Final fallback

---

## Request Deduplication

Both endpoints implement request deduplication:
- Uses a cache key based on request parameters
- If a duplicate request is detected, returns the result from the pending request
- Prevents duplicate API calls for the same parameters
- Cache cleanup after request completes

---

## Error Handling

- If primary provider fails, automatically falls back to next provider
- If all providers fail, returns error response
- Logs errors at each step for debugging
- Non-blocking errors (like trending keywords) don't fail the entire request

---

## Key Files Reference

### Frontend
- `src/api/onboardingApi.ts` - API client functions
- `src/components/Topics/TopicSelectionModal.tsx` - Topics UI component
- `src/components/Onboarding/PromptConfiguration.tsx` - Prompts UI component

### Backend
- `backend/src/routes/onboarding.routes.ts` - API route handlers
- `backend/src/services/topics-query-generation.service.ts` - Topics generation service
- `backend/src/services/keywords/trending-keywords.service.ts` - Trending keywords service

