# Complete Data Collection and Storage Guide

## 📋 Overview

This document provides a comprehensive overview of how data flows through the system, from initial collection to final storage in database tables. It covers all major tables, their relationships, and the complete data lifecycle.

---

## 🔄 Complete Data Flow (End-to-End)

```
1. User Onboarding
   ↓
2. Query Generation
   ↓
3. Data Collection (LLM Responses)
   ↓
4. Scoring & Analysis
   ↓
5. Position Extraction
   ↓
6. Dashboard & Analytics
```

---

## 📊 Core Tables and Their Purpose

### 1. **`brands`** - Brand Configuration
**Purpose**: Stores brand information and metadata

**Key Columns**:
- `id` (UUID) - Primary key
- `name` (text) - Brand name
- `customer_id` (UUID) - Owner
- `metadata` (JSONB) - Brand aliases, products, configuration

**When Created**: During onboarding

**Related Tables**:
- `brand_competitors` (one-to-many)
- `generated_queries` (one-to-many)
- `collector_results` (one-to-many)

---

### 2. **`brand_competitors`** - Competitor Configuration
**Purpose**: Stores competitor information for each brand

**Key Columns**:
- `id` (UUID) - Primary key
- `brand_id` (UUID) - Foreign key to `brands`
- `competitor_name` (text) - Competitor name
- `metadata` (JSONB) - Competitor products, aliases

**When Created**: During onboarding (user selects competitors)

**Related Tables**:
- `brands` (many-to-one)

---

### 3. **`generated_queries`** - Search Queries to Execute
**Purpose**: Stores queries that will be executed across LLM collectors

**Key Columns**:
- `id` (UUID) - Primary key
- `brand_id` (UUID) - Foreign key to `brands`
- `customer_id` (UUID) - Owner
- `query_text` (text) - The actual query/question
- `topic` (text) - Topic name (e.g., "Product Features")
- `intent` (text) - Query intent (default: 'data_collection')
- `is_active` (boolean) - **MUST be true** for queries to execute
- `locale` (text) - Locale (e.g., 'en-US')
- `country` (text) - Country (e.g., 'US')
- `metadata` (JSONB) - Additional metadata including `topic_name`

**When Created**: 
- Automatically during onboarding (query generation)
- Manually via "Manage Prompts" page

**Data Flow**:
```
Onboarding → Query Generation Service → INSERT INTO generated_queries
```

**Related Tables**:
- `brands` (many-to-one)
- `collector_results` (one-to-many via `query_id`)

**⚠️ Critical**: Queries must have `is_active = true` to be executed during data collection.

---

### 4. **`query_executions`** - Execution Tracking
**Purpose**: Tracks the execution status of each query per collector

**Key Columns**:
- `id` (UUID) - Primary key
- `query_id` (UUID) - Foreign key to `generated_queries`
- `collector_type` (text) - Which collector (ChatGPT, Claude, etc.)
- `status` (text) - pending → running → completed/failed
- `execution_id` (text) - Unique execution identifier
- `created_at`, `updated_at` - Timestamps

**When Created**: During data collection (one per query per collector)

**Data Flow**:
```
Data Collection Service → Create execution record → Execute collector → Update status
```

**Related Tables**:
- `generated_queries` (many-to-one)

---

### 5. **`collector_results`** - Raw LLM Responses
**Purpose**: Stores raw responses from LLM collectors (ChatGPT, Claude, Gemini, etc.)

**Key Columns**:
- `id` (bigint) - Primary key
- `query_id` (UUID) - Foreign key to `generated_queries`
- `brand_id` (UUID) - Foreign key to `brands`
- `customer_id` (UUID) - Owner
- `collector_type` (text) - Which collector (ChatGPT, Claude, Gemini, etc.)
- `raw_answer` (text) - **The full LLM response text**
- `question` (text) - The query/question that was asked
- `citations` (JSONB array) - Extracted citation URLs
- `urls` (JSONB array) - Source URLs
- `brand` (text) - Brand name
- `competitors` (JSONB array) - Competitor names
- `topic` (text) - Topic name
- `collection_time_ms` (integer) - Execution time
- `sentiment` (JSONB) - Sentiment analysis results (added during scoring)
- `metadata` (JSONB) - Additional metadata:
  - `topic_name` - Topic name
  - `product_names` - Extracted product names
  - `execution_time_ms` - Execution time
  - `status` - Collection status
  - `collected_by` - Who collected it
  - `collected_at` - Collection timestamp

**When Created**: After successful data collection from LLM

**Data Flow**:
```
Data Collection Service → Execute query across collectors → INSERT INTO collector_results
```

**Related Tables**:
- `generated_queries` (many-to-one)
- `brands` (many-to-one)
- `extracted_positions` (one-to-many)
- `citations` (one-to-many)
- `consolidated_analysis_cache` (one-to-one)

**⚠️ Critical**: This is the **primary source** of raw LLM responses. All scoring operations read from this table.

---

### 6. **`extracted_positions`** - Brand/Competitor Position Data
**Purpose**: Stores calculated positions, visibility metrics, and sentiment for brand and competitors

**Key Columns**:
- `id` (bigint) - Primary key
- `collector_result_id` (bigint) - Foreign key to `collector_results`
- `brand_id` (UUID) - Foreign key to `brands`
- `customer_id` (UUID) - Owner
- `query_id` (UUID) - Foreign key to `generated_queries`
- `collector_type` (text) - Which collector
- `brand_name` (text) - Brand name
- `competitor_name` (text) - **NULL for brand row**, competitor name for competitor rows
- `raw_answer` (text) - Full answer text (duplicated from `collector_results`)
- `brand_first_position` (integer) - First word position where brand is mentioned
- `brand_positions` (integer array) - All word positions where brand is mentioned
- `competitor_positions` (integer array) - All word positions where competitor is mentioned
- `total_brand_mentions` (integer) - Count of brand mentions
- `competitor_mentions` (integer) - Count of competitor mentions
- `total_word_count` (integer) - Total words in answer
- `visibility_index` (float) - Brand visibility (0-1 scale)
- `visibility_index_competitor` (float) - Competitor visibility (0-1 scale)
- `share_of_answers_brand` (float) - Brand share percentage (0-100)
- `share_of_answers_competitor` (float) - Competitor share percentage (0-100)
- `has_brand_presence` (boolean) - Whether brand is mentioned
- `topic` (text) - Topic name
- `sentiment_label` (text) - Brand sentiment: POSITIVE, NEGATIVE, NEUTRAL
- `sentiment_score` (float) - Brand sentiment score (-1.0 to 1.0)
- `sentiment_label_competitor` (text) - Competitor sentiment
- `sentiment_score_competitor` (float) - Competitor sentiment score
- `sentiment_positive_sentences` (JSONB array) - Positive sentences for brand
- `sentiment_negative_sentences` (JSONB array) - Negative sentences for brand
- `sentiment_positive_sentences_competitor` (JSONB array) - Positive sentences for competitor
- `sentiment_negative_sentences_competitor` (JSONB array) - Negative sentences for competitor
- `metadata` (JSONB) - Additional metadata:
  - `topic_name` - Topic name
  - `product_names` - Product names
  - `productNames` - Alternative key
  - `products` - Alternative key
- `processed_at` (timestamptz) - When position was extracted

**Row Structure**:
- **1 Brand Row**: `competitor_name = NULL`, contains brand metrics
- **N Competitor Rows**: One per competitor, `competitor_name` set, contains competitor-specific metrics

**When Created**: During position extraction (Step 2 of scoring)

**Data Flow**:
```
Position Extraction Service → Calculate positions → INSERT INTO extracted_positions
```

**Related Tables**:
- `collector_results` (many-to-one)
- `brands` (many-to-one)

**⚠️ Critical**: This table is the **primary source** for dashboard visibility charts, share metrics, and position data.

---

### 7. **`citations`** - Citation/URL Storage
**Purpose**: Stores extracted citations and URLs from LLM responses

**Key Columns**:
- `id` (bigint) - Primary key
- `collector_result_id` (bigint) - Foreign key to `collector_results`
- `brand_id` (UUID) - Foreign key to `brands`
- `customer_id` (UUID) - Owner
- `url` (text) - Citation URL
- `domain` (text) - Extracted domain name
- `category` (text) - Citation category (e.g., "Product Page", "Review Site")
- `metadata` (JSONB) - Additional metadata

**When Created**: During citation extraction (part of scoring)

**Data Flow**:
```
Citation Extraction Service → Extract URLs → Categorize → INSERT INTO citations
```

**Related Tables**:
- `collector_results` (many-to-one)

---

### 8. **`citation_categories`** - Citation Categorization Cache
**Purpose**: Caches citation categorization results to avoid redundant LLM calls

**Key Columns**:
- `id` (bigint) - Primary key
- `url` (text) - Citation URL
- `domain` (text) - Domain name
- `category` (text) - Citation category
- `customer_id` (UUID) - Owner
- `brand_id` (UUID) - Foreign key to `brands`
- `created_at`, `updated_at` - Timestamps

**When Created**: During citation categorization (cached for reuse)

**Data Flow**:
```
Citation Extraction Service → Check cache → If not found, call LLM → Store in cache
```

**Related Tables**:
- `brands` (many-to-one)

---

### 9. **`consolidated_analysis_cache`** - Analysis Results Cache
**Purpose**: Caches consolidated analysis results (products, sentiment) for fault tolerance

**Key Columns**:
- `collector_result_id` (bigint) - Primary key, foreign key to `collector_results`
- `products` (JSONB) - Extracted products: `{ "brand": [...], "competitors": {...} }`
- `sentiment` (JSONB) - Sentiment analysis: `{ "brand": {...}, "competitors": {...} }`
- `llm_provider` (text) - Which provider was used ('ollama' or 'openrouter')
- `created_at`, `updated_at` - Timestamps

**When Created**: During consolidated analysis (Step 1 of scoring)

**Data Flow**:
```
Consolidated Analysis Service → Run analysis → Store in cache → Use for position extraction & sentiment
```

**Related Tables**:
- `collector_results` (one-to-one)

**⚠️ Critical**: This table enables fault tolerance - if scoring is interrupted, analysis results are preserved and can be reused.

---

## 🔄 Complete Data Lifecycle

### Phase 1: Onboarding & Setup

```
1. User creates brand
   → INSERT INTO brands

2. User selects competitors
   → INSERT INTO brand_competitors

3. System generates queries
   → INSERT INTO generated_queries (is_active = true)
```

**Tables Updated**: `brands`, `brand_competitors`, `generated_queries`

---

### Phase 2: Data Collection

```
1. User clicks "Collect Data Now" or scheduled job runs
   → Query: SELECT * FROM generated_queries WHERE is_active = true

2. For each query:
   a. Create execution records
      → INSERT INTO query_executions (status = 'pending')
   
   b. Execute across collectors (ChatGPT, Claude, Gemini, etc.)
      → For each collector:
         - Call LLM API
         - Extract response, citations, URLs
         - INSERT INTO collector_results
         - UPDATE query_executions (status = 'completed')
```

**Tables Updated**: `query_executions`, `collector_results`

**Key Data Stored**:
- `collector_results.raw_answer` - Full LLM response
- `collector_results.citations` - Citation URLs
- `collector_results.urls` - Source URLs
- `collector_results.question` - The query asked

---

### Phase 3: Scoring & Analysis

#### Step 1: Consolidated Analysis

```
1. For each collector_result:
   a. Check consolidated_analysis_cache
      → If exists: Use cached result
      → If not: Run LLM analysis
   
   b. Extract:
      - Brand products
      - Competitor products
      - Brand sentiment
      - Competitor sentiment
   
   c. Store in cache
      → INSERT/UPDATE consolidated_analysis_cache
```

**Tables Updated**: `consolidated_analysis_cache`

**Key Data Stored**:
- `products` - Extracted product names
- `sentiment` - Sentiment analysis results

---

#### Step 2: Position Extraction

```
1. For each collector_result:
   a. Get analysis from consolidated_analysis_cache
   
   b. Calculate word positions:
      - Tokenize raw_answer
      - Find brand mentions
      - Find competitor mentions
      - Calculate visibility_index
      - Calculate share_of_answers
   
   c. Build rows:
      - 1 brand row (competitor_name = NULL)
      - N competitor rows (one per competitor)
   
   d. Save positions
      → DELETE existing rows for collector_result_id
      → INSERT INTO extracted_positions
```

**Tables Updated**: `extracted_positions`

**Key Data Stored**:
- `brand_positions` - Word positions where brand is mentioned
- `competitor_positions` - Word positions where competitors are mentioned
- `visibility_index` - Brand visibility score
- `share_of_answers_brand` - Brand share percentage
- `has_brand_presence` - Whether brand is mentioned

---

#### Step 3: Citation Extraction & Categorization

```
1. For each collector_result:
   a. Extract citations from collector_results.citations
   
   b. For each citation:
      - Check citation_categories cache
      - If not cached: Call LLM to categorize
      - Store in cache
      → INSERT/UPDATE citation_categories
   
   c. Store citations
      → INSERT INTO citations
```

**Tables Updated**: `citations`, `citation_categories`

**Key Data Stored**:
- `citations.url` - Citation URL
- `citations.domain` - Domain name
- `citations.category` - Citation category

---

#### Step 4: Sentiment Storage

```
1. For each collector_result:
   a. Get sentiment from consolidated_analysis_cache
   
   b. Update extracted_positions:
      → UPDATE extracted_positions SET
         sentiment_label = ...,
         sentiment_score = ...,
         sentiment_positive_sentences = ...,
         sentiment_negative_sentences = ...
```

**Tables Updated**: `extracted_positions`

**Key Data Stored**:
- `sentiment_label` - POSITIVE, NEGATIVE, NEUTRAL
- `sentiment_score` - Numeric score (-1.0 to 1.0)
- `sentiment_positive_sentences` - Positive sentences
- `sentiment_negative_sentences` - Negative sentences

---

### Phase 4: Dashboard & Analytics

```
1. Dashboard queries:
   → SELECT * FROM extracted_positions
     WHERE brand_id = ... AND date_range = ...
   
2. Topics page queries:
   → SELECT * FROM extracted_positions
     WHERE topic = ... AND brand_id = ...
   
3. Visibility charts:
   → SELECT visibility_index, share_of_answers_brand, processed_at
     FROM extracted_positions
     WHERE collector_type = ... AND date_range = ...
```

**Tables Queried**: `extracted_positions`, `collector_results`, `citations`

---

## 📋 Table Relationships Diagram

```
brands (1)
  ├── brand_competitors (many)
  ├── generated_queries (many)
  │     └── collector_results (many)
  │           ├── extracted_positions (many)
  │           ├── citations (many)
  │           └── consolidated_analysis_cache (1)
  └── citation_categories (many)
```

---

## 🔍 Key Queries for Understanding Data Flow

### Check if queries are active:
```sql
SELECT id, query_text, topic, is_active
FROM generated_queries
WHERE brand_id = '...' AND is_active = true;
```

### Check collector results:
```sql
SELECT id, collector_type, question, created_at
FROM collector_results
WHERE brand_id = '...'
ORDER BY created_at DESC;
```

### Check extracted positions:
```sql
SELECT 
  collector_type,
  brand_name,
  competitor_name,
  visibility_index,
  share_of_answers_brand,
  has_brand_presence,
  processed_at
FROM extracted_positions
WHERE brand_id = '...'
ORDER BY processed_at DESC;
```

### Check analysis cache:
```sql
SELECT 
  collector_result_id,
  products,
  sentiment,
  llm_provider,
  created_at
FROM consolidated_analysis_cache
WHERE collector_result_id IN (
  SELECT id FROM collector_results WHERE brand_id = '...'
);
```

---

## 📚 Related Documentation

For more detailed information, see:

1. **Data Collection Process**: `documentation/DATA_COLLECTION_PROCESS.md`
   - Explains batching, concurrency, and collector execution

2. **Data Collection Walkthrough**: `documentation/DATA_COLLECTION_AND_SCORING_WALKTHROUGH.md`
   - Complete flow from onboarding to dashboard
   - API usage by purpose

3. **Position Extraction Flow**: `BRAND_COMPETITOR_POSITION_EXTRACTION_FLOW.md`
   - Detailed step-by-step position extraction process
   - Algorithm explanations

4. **Tables Explained**: `DATA_COLLECTION_TABLES_EXPLAINED.md`
   - Which tables are queried during data collection
   - How to fix "No active queries found" issues

5. **Consolidated Analysis**: `CONSOLIDATED_ANALYSIS_IMPLEMENTATION_SUMMARY.md`
   - How consolidated analysis works
   - Caching strategy

6. **Hybrid Scoring**: `HYBRID_SCORING_IMPLEMENTATION.md`
   - Incremental vs batch processing
   - Fault tolerance and resume capability

---

## ⚠️ Critical Points

1. **`generated_queries.is_active`**: Must be `true` for queries to execute
2. **`collector_results.raw_answer`**: Primary source of LLM responses
3. **`extracted_positions`**: Primary source for dashboard metrics
4. **`consolidated_analysis_cache`**: Enables fault tolerance and resume capability
5. **Row Structure**: `extracted_positions` has 1 brand row + N competitor rows per `collector_result_id`

---

## 🎯 Summary

**Data Flow**:
```
Onboarding → Query Generation → Data Collection → Scoring → Dashboard
     ↓              ↓                ↓              ↓           ↓
  brands    generated_queries  collector_results  extracted_  Dashboard
                                    ↓            positions
                          consolidated_analysis_cache
```

**Key Tables**:
- **Configuration**: `brands`, `brand_competitors`, `generated_queries`
- **Raw Data**: `collector_results`
- **Processed Data**: `extracted_positions`, `citations`
- **Cache**: `consolidated_analysis_cache`, `citation_categories`

**Primary Data Sources for Dashboard**:
- **Visibility Charts**: `extracted_positions` (visibility_index, share_of_answers_brand)
- **Topics**: `extracted_positions` (topic column)
- **Citations**: `citations` table
- **Sentiment**: `extracted_positions` (sentiment_label, sentiment_score)

