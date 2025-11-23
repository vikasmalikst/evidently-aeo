# Data Collection & Scoring Process Walkthrough

## 📋 Overview

This document provides a comprehensive overview of the data collection and scoring process, including which APIs are used for what purposes and how the entire flow works from onboarding to dashboard rendering.

---

## 🔄 Complete Flow (Onboarding → Dashboard)

### Phase 1: Brand Onboarding
1. **User completes onboarding form** → Brand info, competitors, topics collected
2. **Brand creation API** (`POST /api/brands`)
   - Creates brand record in database
   - Stores competitors, topics, selected AI models
   - Generates queries automatically for topics

### Phase 2: Data Collection (Automatic)
3. **Automatic query execution** (triggered during brand creation)
   - For each generated query, executes across selected collectors
   - **Collectors used:**
     - ChatGPT (via Oxylabs or OpenAI Direct)
     - Claude (via OpenRouter)
     - Gemini (via BrightData)
     - Perplexity (via Oxylabs)
     - Bing Copilot (via BrightData)
     - Grok (via BrightData)
   - Results stored in `collector_results` table

### Phase 3: Scoring Operations (Automatic)
4. **Automatic scoring triggers** (after each collector_result is inserted)
   - **Position Extraction**: Extracts brand/competitor mention positions
   - **Sentiment Scoring**: Analyzes sentiment of answers
   - **Citation Extraction**: Extracts and categorizes citations/URLs

5. **Dashboard becomes available** with complete data

---

## 🔌 API Usage by Purpose

### 1. Data Collection APIs

#### **ChatGPT Collection**
- **Primary**: Oxylabs (`realtime.oxylabs.io`)
  - API: `OXYLABS_USERNAME`, `OXYLABS_PASSWORD`
  - Uses latest ChatGPT model by default
  - Synchronous requests
  
- **Fallback**: OpenAI Direct API
  - API: `OPENAI_API_KEY`
  - Model: `gpt-4o-mini` (configurable via `OPENAI_MODEL`)
  - Direct integration with OpenAI

#### **Claude Collection**
- **Provider**: OpenRouter
  - API: `OPENROUTER_API_KEY`
  - Model: `anthropic/claude-haiku-4.5`
  - Web search enabled via `tools` array
  - Supports streaming and web search

#### **Gemini Collection**
- **Provider**: BrightData
  - API: `BRIGHTDATA_API_KEY`
  - Dataset ID: `gd_m7di5jy6s9geokz8w` (for Gemini)
  - Uses `/scrape` endpoint (synchronous with async fallback)

#### **Perplexity Collection**
- **Provider**: Oxylabs
  - API: `OXYLABS_USERNAME`, `OXYLABS_PASSWORD`
  - Uses same Oxylabs infrastructure as ChatGPT

#### **Bing Copilot Collection**
- **Provider**: BrightData
  - API: `BRIGHTDATA_API_KEY`
  - Dataset ID: `gd_m7di5jy6s9geokz8w` (for Bing Copilot)
  - Uses `/scrape` endpoint (synchronous)
  - **Note**: Works perfectly with synchronous requests

#### **Grok Collection**
- **Provider**: BrightData
  - API: `BRIGHTDATA_API_KEY`
  - Dataset ID: `gd_m8ve0u141icu75ae74`
  - Uses `/scrape` endpoint (synchronous with async fallback)
  - Supports new `answer_section_html` field

---

### 2. Scoring APIs

#### **Position Extraction**
- **Primary**: Cerebras
  - API: `CEREBRAS_API_KEY`
  - Model: `qwen-3-235b-a22b-instruct-2507`
  - Extracts brand/competitor mention positions from answers
  
- **Fallback**: Google Gemini
  - API: `GOOGLE_GEMINI_API_KEY` or `GEMINI_API_KEY`
  - Model: `gemini-1.5-flash-002`
  - Alternative if Cerebras unavailable

#### **Sentiment Scoring**
- **Primary**: Cerebras
  - API: `CEREBRAS_API_KEY`
  - Model: `qwen-3-235b-a22b-instruct-2507`
  - High token limit (no truncation)
  
- **Secondary**: Google Gemini
  - API: `GOOGLE_GEMINI_API_KEY` or `GEMINI_API_KEY`
  - Model: `gemini-1.5-flash`
  - 1M token limit (no truncation needed)
  
- **Last Resort**: Hugging Face
  - API: `HUGGINGFACE_API_TOKEN`
  - Model: `distilbert/distilbert-base-uncased-finetuned-sst-2-english`
  - 512 token limit (may truncate)

#### **Citation Extraction & Categorization**
- **Primary**: Google Gemini
  - API: `GOOGLE_GEMINI_API_KEY`
  - Model: `gemini-2.5-flash`
  - Categorizes citations into domains/pages
  
- **Fallback**: Cerebras
  - API: `CEREBRAS_API_KEY`
  - Alternative categorization service

---

### 3. Topic & Query Generation APIs

#### **Topic Generation**
- **Primary**: Cerebras
  - API: `CEREBRAS_API_KEY`
  - Generates AEO topics for brands
  
- **Fallback**: Google Gemini
  - API: `GOOGLE_GEMINI_API_KEY`

#### **Query Generation**
- **Primary**: Cerebras
  - API: `CEREBRAS_API_KEY`
  - Generates search queries for topics
  
- **Secondary**: Google Gemini
  - API: `GOOGLE_GEMINI_API_KEY`

---

## ⏱️ Current Performance Bottlenecks

### 1. **Sequential Data Collection**
- Queries are executed one by one per collector
- No parallelization across queries
- Each query waits for previous to complete

### 2. **BrightData Polling**
- BrightData `/scrape` endpoint sometimes returns async (202 status)
- Current implementation polls every few seconds
- Can take 30-60 seconds per BrightData request

### 3. **Sequential Scoring**
- Scoring operations run sequentially (position → sentiment → citation)
- Could run in parallel for faster results

### 4. **Single API Key Usage**
- All scoring operations share same Cerebras/Gemini keys
- Rate limiting can slow down entire process

---

## 🚀 Optimization Strategy

### 1. **Parallel Data Collection**
- Execute multiple queries in parallel (3-5 at a time)
- Use different collectors simultaneously
- Reduce total collection time by 60-80%

### 2. **Multiple API Keys for Scoring**
- **Strategy**: Split API keys by operation
  - `CEREBRAS_API_KEY_1`: Position extraction
  - `CEREBRAS_API_KEY_2`: Sentiment scoring
  - `CEREBRAS_API_KEY_3`: Query generation
  - `GOOGLE_GEMINI_API_KEY_1`: Citation categorization
  - `GOOGLE_GEMINI_API_KEY_2`: Topic generation

### 3. **BrightData Optimization**
- **Option A**: Keep polling but optimize
  - Reduce poll interval (1-2 seconds instead of 5)
  - Use WebSocket for real-time updates if available
  - Implement exponential backoff
  
- **Option B**: Use BrightData webhooks (if available)
  - Register webhook URL for completion notifications
  - Eliminate polling entirely
  
- **Option C**: Accept async and move to background
  - Return 202 immediately
  - Process in background cron job
  - Show dashboard with partial data first

### 4. **Parallel Scoring Operations**
- Run position extraction, sentiment scoring, and citation extraction in parallel
- Use different API keys for each operation
- Reduce scoring time by 60-70%

### 5. **Progressive Dashboard Loading**
- Show dashboard as soon as first results are available
- Update in real-time as more data arrives
- Use optimistic UI updates

---

## 📊 Estimated Time Improvements

### Current Timeline
- **Onboarding completion** → **Dashboard ready**: 5-10 minutes
  - Data collection: 3-6 minutes (sequential)
  - Scoring: 2-4 minutes (sequential)
  - BrightData polling: 1-2 minutes

### Optimized Timeline
- **Onboarding completion** → **Dashboard ready**: 1-2 minutes
  - Data collection: 30-60 seconds (parallel, 3-5 queries at once)
  - Scoring: 20-40 seconds (parallel, multiple API keys)
  - BrightData: 30-60 seconds (optimized polling or webhooks)

**Improvement: 70-80% faster**

---

## 🔑 API Key Distribution Strategy

### Recommended Environment Variables

```bash
# Data Collection APIs
OXYLABS_USERNAME=xxx
OXYLABS_PASSWORD=xxx
OPENAI_API_KEY=xxx
OPENROUTER_API_KEY=xxx
BRIGHTDATA_API_KEY=xxx

# Scoring APIs - Position Extraction
CEREBRAS_API_KEY_POSITION=xxx  # For position extraction
GOOGLE_GEMINI_API_KEY_POSITION=xxx  # Fallback for position

# Scoring APIs - Sentiment Analysis
CEREBRAS_API_KEY_SENTIMENT=xxx  # For sentiment scoring
GOOGLE_GEMINI_API_KEY_SENTIMENT=xxx  # Fallback for sentiment
HUGGINGFACE_API_TOKEN=xxx  # Last resort for sentiment

# Scoring APIs - Citation Categorization
GOOGLE_GEMINI_API_KEY_CITATIONS=xxx  # For citation categorization
CEREBRAS_API_KEY_CITATIONS=xxx  # Fallback for citations

# Generation APIs - Topics & Queries
CEREBRAS_API_KEY_GENERATION=xxx  # For topic/query generation
GOOGLE_GEMINI_API_KEY_GENERATION=xxx  # Fallback for generation

# Backward Compatibility (fallback to single keys)
CEREBRAS_API_KEY=xxx  # Fallback if specific keys not set
GOOGLE_GEMINI_API_KEY=xxx  # Fallback if specific keys not set
```

### Benefits
- **Rate limit isolation**: Each operation uses separate keys
- **Better throughput**: No waiting for rate limits
- **Graceful degradation**: Fallback to single keys if specific keys unavailable

---

## 🔍 BrightData Polling vs Real-time

### Current Implementation
- Uses `/scrape` endpoint
- Returns 202 (async) or 200 (sync) depending on load
- Polls every 5-10 seconds until ready
- Background cron job handles failed/stuck requests

### Recommendation: **Hybrid Approach**

1. **Onboarding Flow** (User waiting):
   - Use `/scrape` with aggressive polling (1-2 seconds)
   - Show progress in loading screen
   - Timeout after 2 minutes, move to background

2. **Background Processing**:
   - Keep cron job for failed/stuck requests
   - Process results when ready
   - Update dashboard progressively

3. **Future**: Implement webhooks if BrightData supports them
   - Register webhook URL
   - Receive completion notifications
   - Zero polling needed

---

## 🎯 Next Steps for Implementation

1. **Create loading screen component** (immediate)
   - Show real-time progress
   - Display current operation (collecting, scoring, etc.)
   - Redirect to dashboard when complete

2. **Implement parallel data collection** (Phase 1)
   - Batch queries (3-5 at a time)
   - Use Promise.all for parallel execution
   - Update loading screen with progress

3. **Split API keys** (Phase 2)
   - Update services to use specific keys
   - Add fallback logic
   - Test with multiple keys

4. **Parallel scoring** (Phase 3)
   - Run all scoring operations simultaneously
   - Use different API keys
   - Reduce total scoring time

5. **Optimize BrightData** (Phase 4)
   - Reduce polling interval
   - Implement timeout/background fallback
   - Explore webhook options

6. **Progressive dashboard** (Phase 5)
   - Show dashboard with partial data
   - Update as results arrive
   - Real-time UI updates

---

## 📝 API Usage Summary Table

| Operation | Primary API | Fallback API | Key Variable | Model |
|-----------|------------|--------------|--------------|-------|
| **Data Collection** |
| ChatGPT | Oxylabs | OpenAI Direct | `OXYLABS_*`, `OPENAI_API_KEY` | Latest / gpt-4o-mini |
| Claude | OpenRouter | - | `OPENROUTER_API_KEY` | claude-haiku-4.5 |
| Gemini | BrightData | - | `BRIGHTDATA_API_KEY` | - |
| Perplexity | Oxylabs | - | `OXYLABS_*` | - |
| Bing Copilot | BrightData | - | `BRIGHTDATA_API_KEY` | - |
| Grok | BrightData | - | `BRIGHTDATA_API_KEY` | - |
| **Scoring** |
| Position Extraction | Cerebras | Gemini | `CEREBRAS_API_KEY`, `GOOGLE_GEMINI_API_KEY` | qwen-3-235b / gemini-1.5-flash |
| Sentiment Scoring | Cerebras | Gemini → HF | `CEREBRAS_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `HUGGINGFACE_API_TOKEN` | qwen-3-235b / gemini-1.5-flash / distilbert |
| Citation Categorization | Gemini | Cerebras | `GOOGLE_GEMINI_API_KEY`, `CEREBRAS_API_KEY` | gemini-2.5-flash |
| **Generation** |
| Topic Generation | Cerebras | Gemini | `CEREBRAS_API_KEY`, `GOOGLE_GEMINI_API_KEY` | qwen-3-235b / gemini-1.5-flash |
| Query Generation | Cerebras | Gemini | `CEREBRAS_API_KEY`, `GOOGLE_GEMINI_API_KEY` | qwen-3-235b / gemini-1.5-flash |

---

## 🎨 User Experience Flow

### Current Flow
1. User completes onboarding
2. Redirected to dashboard
3. Dashboard shows empty/loading state
4. User waits 5-10 minutes
5. Dashboard populates with data

### Improved Flow (with Loading Screen)
1. User completes onboarding
2. Redirected to loading screen
3. **Loading screen shows:**
   - Animated progress indicators
   - Current operation: "Collecting data from ChatGPT..."
   - Progress bar: "Query 3 of 15"
   - Estimated time remaining
4. Real-time updates as operations complete
5. Auto-redirect to dashboard when ready (1-2 minutes)

### Future Flow (Progressive Dashboard)
1. User completes onboarding
2. Redirected to dashboard immediately
3. **Dashboard shows:**
   - Skeleton loaders
   - "Collecting data..." badges
   - Partial results as they arrive
   - Real-time updates
4. Full data available in 1-2 minutes

---

This document will be updated as optimizations are implemented.

