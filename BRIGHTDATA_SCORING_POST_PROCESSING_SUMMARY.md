# BrightData Collection & Post-Processing Flow Summary

## Overview
This document summarizes the complete flow of how raw answers collected from BrightData are processed, scored, and analyzed. The system extracts brand names, products, competitors, calculates visibility scores, detects brand mentions, categorizes citations, and scores sentiment.

---

## 1. DATA COLLECTION (BrightData)

### Collection Services
- **Location**: `backend/src/services/data-collection/brightdata-collector.service.ts`
- **Polling Service**: `backend/src/services/data-collection/brightdata/polling.service.ts`
- **Background Service**: `backend/src/services/data-collection/brightdata-background.service.ts`

### Collection Flow
1. **BrightData API Call**: Collectors (Grok, Bing Copilot, Gemini, ChatGPT, etc.) make requests via BrightData API
2. **Response Handling**: 
   - Real-time (Status 200): Immediate response with answer and citations
   - Async (Status 202): Returns `snapshot_id` for polling
3. **Polling**: For async responses, polls snapshot endpoint every 10 seconds (up to 60 attempts)
4. **Data Extraction**: Extracts `answer_text`, `citations`, `urls` from response
5. **Storage**: Raw data stored in `collector_results` table with:
   - `raw_answer`: The answer text
   - `citations`: Array of citation URLs
   - `urls`: Array of URLs
   - `metadata`: Additional metadata including `answer_section_html` for Grok

### Key Files
- `backend/src/services/data-collection/brightdata-collector.service.ts` - Main orchestrator
- `backend/src/services/data-collection/brightdata/polling.service.ts` - Handles async polling
- `backend/src/services/data-collection/brightdata-background.service.ts` - Completes failed executions

---

## 2. POST-PROCESSING/SCORING ORCHESTRATION

### Main Orchestrator
**File**: `backend/src/services/scoring/brand-scoring.orchestrator.ts`

**Flow**:
1. **Position Extraction** (`positionExtractionService.extractPositionsForNewResults`)
   - Extracts brand/competitor mention positions
   - Finds product names
   - Calculates visibility and share of answers
   
2. **Brand Sentiment Scoring** (`brandSentimentService.scoreBrandSentiment`)
   - Scores sentiment for brand mentions
   
3. **Competitor Sentiment Scoring** (`competitorSentimentService.scoreCompetitorSentiment`)
   - Scores sentiment for competitor mentions
   
4. **Citation Extraction** (`citationExtractionService.extractAndStoreCitations`)
   - Extracts and categorizes citations

**Execution**: Can run sequentially (safer) or in parallel (faster)

---

## 3. BRAND NAME EXTRACTION

### Location
- **Primary**: `backend/src/services/scoring/position-extraction.service.ts`
- **Secondary**: `backend/src/services/visibility-score.service.ts`

### Methods

#### A. From Metadata
- Extracts brand aliases from `brands.metadata`:
  - Keys: `aliases`, `alias`, `keywords`, `keyword_aliases`
- Function: `getAliases()` in `visibility-score.service.ts` (line ~1367)

#### B. From Text (Manual)
- Uses tokenization and pattern matching
- Normalizes text and finds exact/partial matches
- Function: `findOccurrences()` in `position-extraction.service.ts` (line ~615)

#### C. LLM-Based Extraction
- Used for product name extraction (which includes brand context)
- Function: `extractProductNamesWithLLM()` in `position-extraction.service.ts` (line ~448)

### Storage
- Brand name stored in `collector_results.brand` column
- Also in `brands.name` table
- Aliases stored in `brands.metadata`

---

## 4. PRODUCT NAME EXTRACTION

### Location
**File**: `backend/src/services/scoring/position-extraction.service.ts`

### Methods

#### A. LLM Extraction (Primary)
- **Function**: `extractProductNamesWithLLM()` (line ~448)
- **Model**: Cerebras (primary), Gemini (fallback)
- **Prompt**: Asks LLM to extract only official products sold by the brand
- **Rules**:
  - Include only official products (SKUs, models, variants)
  - Exclude generics, ingredients, categories
  - Exclude competitors and their products
  - Max 12 products

#### B. From Metadata (Fallback)
- **Function**: `extractProductNamesFromMetadata()` (line ~651)
- **Keys checked**: `products`, `product_names`, `productNames`, `aliases`, `alias`, `keywords`, `keyword_aliases`

### Caching
- Product names cached per brand ID to avoid redundant LLM calls
- Cache stored in `positionExtractionService.productCache` (Map)

### Storage
- Stored in `extracted_positions.metadata`:
  - `product_names`
  - `productNames`
  - `products`
- Also updated in `collector_results.metadata`

### Usage
- Used to count brand mentions (brand name + product names)
- Used in position extraction to find where products are mentioned
- Displayed in Prompts page highlights

---

## 5. COMPETITOR EXTRACTION

### Location
- **Primary**: `backend/src/services/scoring/position-extraction.service.ts`
- **Secondary**: `backend/src/services/visibility-score.service.ts`

### Methods

#### A. From Collector Results
- Extracted from `collector_results.competitors` column
- Can be array of strings: `["Nike", "Adidas"]`
- Or array of objects: `[{competitor_name: "Nike"}]`

#### B. From Brand Competitors Table
- **Table**: `brand_competitors`
- **Columns**: `competitor_name`, `metadata`
- Used as fallback if not in collector_results
- Enriched with metadata for aliases

#### C. Competitor Product Names
- Extracted from `brand_competitors.metadata`
- Function: `extractProductNamesFromMetadata()` (line ~651)
- Used to find competitor product mentions in text

### Storage
- Competitors stored in `collector_results.competitors`
- Competitor metadata in `brand_competitors` table
- Competitor positions in `extracted_positions` table (one row per competitor)

---

## 6. VISIBILITY SCORING

### Location
**File**: `backend/src/services/visibility-score.service.ts`

### Calculation Method (Hybrid Approach)

#### Step 1: LLM-Based Mention Counting
- **Function**: `countMentionsWithLLM()` (line ~456)
- Counts brand mentions (including product names)
- Counts competitor mentions
- Uses Cerebras (primary) or Gemini (fallback)
- Returns: `{ brand: number, competitors: { [name]: number } }`

#### Step 2: Manual Position Finding
- **Function**: `findOccurrences()` (line ~615 in position-extraction.service.ts)
- Tokenizes text
- Finds word positions where brand/competitor names appear
- Returns: `{ occurrences: number, positions: number[] }`

#### Step 3: Visibility Index Calculation
- **Function**: `visibilityIndex()` (line ~690 in position-extraction.service.ts)
- **Formula**: 
  ```
  density = mentions / totalWords
  prominence = 1 / log10(firstPosition + 9)
  visibilityIndex = (prominence * 0.6) + (density * 0.4)
  ```
- Returns: 0-1 scale (converted to 0-100 for display)

#### Step 4: Share of Answers Calculation
- **Function**: `shareOfAnswers()` (line ~705 in position-extraction.service.ts)
- **Formula**: `(primaryMentions / (primaryMentions + secondaryMentions)) * 100`
- Returns: 0-100 percentage

### Storage
- Stored in `scores` table:
  - `visibility_index`: Brand visibility (0-1 scale)
  - `visibility_index_competitor`: Competitor visibility (0-1 scale)
  - `share_of_answers`: Brand share (0-100)
  - `share_of_answers_competitor`: Competitor share (0-100)
- Also in `extracted_positions` table:
  - `visibility_index`
  - `visibility_index_competitor`
  - `share_of_answers_brand`
  - `share_of_answers_competitor`

---

## 7. BRAND MENTIONS DETECTION

### Location
- **Primary**: `backend/src/services/scoring/position-extraction.service.ts`
- **Secondary**: `backend/src/services/visibility-score.service.ts`

### Methods

#### A. Token-Based Matching
- **Function**: `findOccurrences()` (line ~615)
- Tokenizes text using regex: `/\b[\p{L}\p{N}'']+\b/gu`
- Normalizes words (lowercase, removes apostrophes)
- Finds exact and partial matches for:
  - Brand name
  - Brand aliases
  - Product names
- Returns word positions (1-indexed)

#### B. LLM-Based Counting
- **Function**: `countMentionsWithLLM()` (line ~456 in visibility-score.service.ts)
- Uses LLM to count mentions including:
  - Brand name
  - Product names
  - Competitor names
- More accurate for partial matches and context

### Storage
- `extracted_positions` table:
  - `total_brand_mentions`: Count of brand mentions
  - `total_competitor_mentions`: Count of competitor mentions
  - `brand_positions`: Array of word positions
  - `competitor_positions`: Array of word positions
  - `brand_first_position`: First occurrence position
  - `competitor_position`: First competitor occurrence

---

## 8. CITATION CATEGORIZATION

### Location
**File**: `backend/src/services/citations/citation-categorization.service.ts`

### Categorization Flow

#### Step 1: Hardcoded Domain Patterns
- **Function**: `categorize()` (line ~131)
- Checks against `DOMAIN_CATEGORIES` array (line ~28)
- Categories: Editorial, Corporate, Reference, UGC, Social, Institutional
- Examples:
  - `reddit.com` → Social
  - `techcrunch.com` → Editorial
  - `wikipedia.org` → Reference
  - `amazon.com` → UGC

#### Step 2: Domain Heuristics
- **Function**: `categorizeByDomainHeuristics()` (line ~195)
- Checks for patterns:
  - `.edu` → Institutional
  - `.gov` → Institutional
  - Contains "news", "blog", "media" → Editorial
  - Contains "wiki" → Reference
  - Contains "review", "rating" → UGC

#### Step 3: AI Categorization (Fallback)
- **Function**: `categorizeWithAI()` (line ~278)
- **Models**: Cerebras (primary), Gemini (fallback)
- **Prompt**: Simple instruction to categorize domain into one of 6 categories
- Used when hardcoded patterns don't match

### Citation Extraction
**File**: `backend/src/services/citations/citation-extraction.service.ts`

#### Extraction Methods
1. **From Citations Column**: Parses `collector_results.citations` array
2. **From URLs Column**: Parses `collector_results.urls` array
3. **From Raw Answer Text**: Extracts URLs using regex patterns:
   - Markdown: `[1](https://...)`
   - Numbered: `[1] https://...`
   - Plain URLs: `https://...`

### Storage
- **Table**: `citations`
- **Columns**:
  - `url`: Normalized URL
  - `domain`: Extracted domain
  - `page_name`: Readable page name
  - `category`: Citation category
  - `metadata`: Contains `categorization_confidence` and `categorization_source`

### Caching
- Domain-level caching to avoid re-categorizing same domains
- Cache stored in `citationExtractionService.domainCategorizationCache`

---

## 9. SENTIMENT SCORING

### Location
**File**: `backend/src/services/scoring/sentiment/collector-sentiment.service.ts`

### Sentiment Analysis Flow

#### Step 1: Provider Selection
- **Priority Order**:
  1. OpenRouter (if configured)
  2. Cerebras (primary, high token limit)
  3. Gemini (fallback, 1M token limit)
  4. Hugging Face (legacy, 512 token limit - requires chunking)

#### Step 2: Full Text Analysis
- **Function**: `analyzeSentiment()` (line ~243)
- Analyzes entire text (no chunking for Cerebras/Gemini)
- Returns:
  - `label`: POSITIVE, NEGATIVE, or NEUTRAL
  - `score`: -1.0 to 1.0
  - `positiveSentences`: Array of positive sentences
  - `negativeSentences`: Array of negative sentences

#### Step 3: Sentence-Level Analysis (Hugging Face Only)
- **Function**: `scoreSentences()` (line ~411)
- Scores individual sentences (up to 12)
- Extracts positive/negative sentences

### Sentiment Calculation

#### For Brand
- **Function**: `scoreBrandSentiment()` in `brand-sentiment.service.ts`
- Analyzes sentences containing brand mentions
- Uses keyword matching for simple sentiment

#### For Competitors
- **Function**: `scoreCompetitorSentiment()` in `competitor-sentiment.service.ts`
- Analyzes sentences containing competitor mentions

### Storage
- **Table**: `collector_results`
  - `sentiment_label`: POSITIVE, NEGATIVE, NEUTRAL
  - `sentiment_score`: -1.0 to 1.0
  - `sentiment_positive_sentences`: Array of sentences
  - `sentiment_negative_sentences`: Array of sentences

- **Table**: `scores`
  - `sentiment_score`: Brand sentiment (-1 to 1)
  - `sentiment_score_competitor`: Competitor sentiment (-1 to 1)
  - `positive_sentiment_sentences`: Brand positive sentences
  - `negative_sentiment_sentences`: Brand negative sentences
  - `positive_sentiment_sentences_competitor`: Competitor positive sentences
  - `negative_sentiment_sentences_competitor`: Competitor negative sentences

---

## 10. LLM CALLS SUMMARY

### Current LLM Usage

#### Position Extraction Service
- **Product Name Extraction**: 1 call per brand (cached)
  - Model: Cerebras (primary), Gemini (fallback)
  - Purpose: Extract product names from answer text

#### Visibility Score Service
- **Mention Counting**: 1 call per collector result
  - Model: Cerebras (primary), Gemini (fallback)
  - Purpose: Count brand and competitor mentions
- **Product Name Extraction**: 1 call per brand (cached)
  - Model: Cerebras (primary), Gemini (fallback)
  - Purpose: Extract product names for mention counting

#### Citation Categorization Service
- **AI Categorization**: 1 call per unknown domain
  - Model: Cerebras (primary), Gemini (fallback)
  - Purpose: Categorize unknown citation domains
  - Cached per domain

#### Sentiment Service
- **Sentiment Analysis**: 1 call per collector result
  - Model: OpenRouter → Cerebras → Gemini → Hugging Face
  - Purpose: Analyze sentiment of entire answer text

### Total LLM Calls Per Collector Result
1. **Product extraction** (cached per brand): ~1 call per brand
2. **Mention counting**: 1 call per result
3. **Sentiment analysis**: 1 call per result
4. **Citation categorization**: ~1 call per unknown domain (cached)

**Total**: ~3-4 LLM calls per collector result (excluding cached calls)

---

## 11. OPTIMIZATION OPPORTUNITIES

### Current Issues
1. **Multiple Separate LLM Calls**: 
   - Product extraction (1 call)
   - Mention counting (1 call)
   - Sentiment analysis (1 call)
   - Citation categorization (1 call per domain)

2. **Redundant Processing**:
   - Product names extracted multiple times
   - Same text analyzed multiple times

3. **Token Inefficiency**:
   - Each call sends full answer text
   - No batching of similar operations

### Recommended Optimizations

#### 1. Combine LLM Calls
**Single Multi-Purpose Call**:
- Extract product names
- Count mentions (brand + competitors)
- Analyze sentiment
- All in one prompt/response

**Benefits**:
- Reduces API calls from ~3-4 to 1 per result
- Reduces token usage (shared context)
- Faster processing
- Lower costs

#### 2. Batch Processing
- Process multiple collector results in one LLM call
- Use structured output format (JSON schema)
- Handle rate limits better

#### 3. Smart Caching
- Cache product names per brand (already done)
- Cache sentiment for similar texts
- Cache citation categories per domain (already done)

#### 4. Use Best Claude Models
- **Claude Sonnet 4.5** or **Claude Opus 4** for complex analysis
- Better accuracy for multi-task prompts
- Structured output support
- Higher token limits

---

## 12. RECOMMENDED IMPLEMENTATION PLAN

### Phase 1: Combine Product + Mention + Sentiment
**Single LLM Call** that:
1. Extracts product names
2. Counts brand/competitor mentions
3. Analyzes sentiment
4. Returns structured JSON

**File to Modify**: `backend/src/services/visibility-score.service.ts`
**Function**: `computeAllMetricsHybrid()`

### Phase 2: Optimize Citation Categorization
- Batch categorize multiple citations in one call
- Use domain-level batching

**File to Modify**: `backend/src/services/citations/citation-categorization.service.ts`

### Phase 3: Implement Claude Models
- Replace Cerebras/Gemini with Claude Sonnet 4.5
- Use structured output for better parsing
- Implement retry logic with fallbacks

---

## 13. KEY FILES REFERENCE

### Collection
- `backend/src/services/data-collection/brightdata-collector.service.ts`
- `backend/src/services/data-collection/brightdata/polling.service.ts`
- `backend/src/services/data-collection/brightdata-background.service.ts`

### Scoring/Processing
- `backend/src/services/scoring/brand-scoring.orchestrator.ts` - Main orchestrator
- `backend/src/services/scoring/position-extraction.service.ts` - Positions, products
- `backend/src/services/visibility-score.service.ts` - Visibility, mentions
- `backend/src/services/scoring/sentiment/collector-sentiment.service.ts` - Sentiment
- `backend/src/services/citations/citation-extraction.service.ts` - Citations
- `backend/src/services/citations/citation-categorization.service.ts` - Categories

### Database Tables
- `collector_results` - Raw BrightData responses
- `extracted_positions` - Brand/competitor positions and metrics
- `scores` - Visibility and sentiment scores
- `citations` - Extracted and categorized citations
- `brands` - Brand metadata (aliases, products)
- `brand_competitors` - Competitor metadata

---

## Summary

The current post-processing flow involves:
1. **Collection**: BrightData collects answers → stored in `collector_results`
2. **Position Extraction**: Finds brand/competitor/product positions → `extracted_positions`
3. **Visibility Scoring**: Calculates visibility and share → `scores` table
4. **Sentiment Analysis**: Analyzes sentiment → `collector_results` and `scores`
5. **Citation Extraction**: Extracts and categorizes URLs → `citations` table

**Current LLM Calls**: ~3-4 per collector result
**Optimization Potential**: Reduce to 1-2 calls by combining operations

**Next Steps**: Design combined LLM prompt that handles all extraction/scoring tasks in a single call using Claude Sonnet 4.5 or Opus 4.

**✅ COMPLETE**: See `CONSOLIDATED_LLM_CALL_PLAN.md` for detailed implementation plan and prompt design.

---

## Related Documentation

For detailed sequential flow of brand/competitor name and position extraction, see:
- **`BRAND_COMPETITOR_POSITION_EXTRACTION_FLOW.md`**: Complete step-by-step flow with algorithms, data structures, and examples


