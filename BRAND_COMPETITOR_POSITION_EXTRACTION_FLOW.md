# Brand/Competitor Name and Position Extraction - Detailed Sequential Flow

## Overview
This document provides a step-by-step sequential flow of how brand names, competitor names, product names, and their positions are extracted from raw BrightData collector answers.

**Main Service**: `backend/src/services/scoring/position-extraction.service.ts`

---

## ENTRY POINT: Service Invocation

### 1. Service Trigger
**Location**: `backend/src/services/scoring/brand-scoring.orchestrator.ts`

**Triggered by**:
- Scheduled job (`backend/src/cron/scoringWorker.ts`)
- Brand creation (`backend/src/services/brand.service.ts` - line 824)
- Manual script execution (`backend/src/scripts/extract-positions.ts`)

**Method Called**:
```typescript
positionExtractionService.extractPositionsForNewResults(options)
```

**Options**:
- `customerId`: Optional filter
- `brandIds`: Optional array of brand IDs
- `since`: Optional timestamp (only process results after this date)
- `limit`: Maximum number of results to process (default: 500)

---

## PHASE 1: Fetch and Filter Collector Results

### Step 1.1: Query Collector Results
**Function**: `extractPositionsForNewResults()` (line 130)

**Action**:
1. Build Supabase query to `collector_results` table
2. Select columns:
   - `id`, `customer_id`, `brand_id`, `query_id`, `question`
   - `execution_id`, `collector_type`, `raw_answer`
   - `brand`, `competitors`, `created_at`, `metadata`
3. Apply filters:
   - `customerId` (if provided)
   - `brandIds` (if provided)
   - `since` timestamp (if provided)
4. Order by `created_at DESC` (newest first)
5. Limit to `fetchLimit` (default: `limit * 2`)

**Result**: Array of collector result rows

---

### Step 1.2: Check Already Processed Results
**Function**: `extractPositionsForNewResults()` (line 165-179)

**Action**:
1. For each fetched result:
   - Query `extracted_positions` table
   - Check if `collector_result_id` exists
   - If exists → mark as processed
2. Build `processedCollectorResults` Set

**Result**: Set of already-processed collector result IDs

---

### Step 1.3: Filter Unprocessed Results
**Function**: `extractPositionsForNewResults()` (line 182-187)

**Action**:
1. Filter out results that are in `processedCollectorResults` Set
2. Slice to `limit` (final batch size)
3. If no unprocessed results → return 0

**Result**: Array of unprocessed collector results to process

---

## PHASE 2: Process Each Collector Result

### Step 2.1: Parse and Validate Result
**Function**: `extractPositionsForNewResults()` (line 191-194)

**Action**:
1. Parse result using `CollectorResultRow` schema (Zod validation)
2. Validate required fields:
   - `id`, `brand_id`, `query_id`, `collector_type`
   - `raw_answer` (must exist)
   - `competitors` (can be array or null)

**Result**: Validated collector result object

---

### Step 2.2: Extract Positions (Main Processing)
**Function**: `extractPositions()` (line 217)

**Called with**: Parsed collector result

**This is the core function that does all the extraction work**

---

## PHASE 3: Topic Extraction

### Step 3.1: Extract Topic Name
**Function**: `extractPositions()` (line 220-237)

**Priority Order**:
1. **First**: Check `collector_results.topic` column
2. **Second**: Check `collector_results.metadata.topic_name` or `metadata.topic`
3. **Third**: Query `generated_queries` table:
   - Select `topic` column
   - Select `metadata.topic_name` or `metadata.topic`
4. **Helper**: `getTopicNameFromMetadata()` (line 849) extracts topic from metadata

**Result**: `topicName` (string or null)

**Storage**: Will be stored in `extracted_positions.topic` column

---

## PHASE 4: Brand Information Retrieval

### Step 4.1: Fetch Brand Data
**Function**: `extractPositions()` (line 239-250)

**Action**:
1. Query `brands` table:
   - Select: `id`, `name`, `metadata`
   - Filter: `brand_id = result.brand_id`
   - Use `.single()` (expects exactly one row)
2. Validate brand exists (throw error if not found)
3. Parse using `BrandRow` schema

**Result**: Brand object with `id`, `name`, `metadata`

**Purpose**: 
- Get official brand name
- Get brand metadata (for aliases, products, etc.)

---

## PHASE 5: Product Name Extraction

### Step 5.1: Get Product Names (with Caching)
**Function**: `getProductNames()` (line 426)

**Called with**:
- `brandId`: Brand UUID
- `brandName`: Brand name string
- `metadata`: Brand metadata object
- `rawAnswer`: Full answer text

**Action**:
1. **Check Cache First**:
   - Look up `brandId` in `productCache` Map
   - If found → return cached product names (skip LLM call)
   
2. **If Not Cached**:
   - Call `extractProductNamesWithLLM()` (line 448)
   - Store result in cache: `productCache.set(brandId, products)`
   - Return product names

**Result**: Array of product name strings (e.g., `["Product1", "Product2"]`)

**Caching Benefit**: Avoids redundant LLM calls for same brand across multiple collector results

---

### Step 5.2: LLM-Based Product Extraction
**Function**: `extractProductNamesWithLLM()` (line 448)

**Action**:
1. **Build Prompt**:
   - Brand name: `"${brandName}"`
   - Context: First 600 chars of metadata JSON
   - Snippet: Full `rawAnswer` text
   - Instructions:
     - Extract only official products sold by brand
     - Exclude generics, ingredients, categories
     - Exclude competitors and their products
     - Max 12 products
     - Return JSON array

2. **Call LLM**:
   - **Primary**: Cerebras API (`callCerebras()` - line 752)
   - **Fallback**: Gemini API (`callGemini()` - line 802)
   - Model: `qwen-3-235b-a22b-instruct-2507` (Cerebras) or `gemini-1.5-flash-002` (Gemini)
   - Temperature: 0.1 (low for consistency)
   - Max tokens: 1000

3. **Parse Response**:
   - Extract JSON from response
   - Validate it's an array
   - Sanitize each product name:
     - Remove parentheses content
     - Remove quotes
     - Remove trailing dashes/colons
     - Normalize whitespace

4. **Return**: Array of sanitized product names

**Result**: Array of product names (e.g., `["UberX", "Uber Black", "Uber Eats"]`)

---

## PHASE 6: Competitor Information Retrieval

### Step 6.1: Normalize Competitors Array
**Function**: `extractPositions()` (line 271-276)

**Action**:
1. Parse `result.competitors` (can be null, array of strings, or array of objects)
2. Normalize to consistent format:
   - If string: `"Nike"` → `{competitor_name: "Nike"}`
   - If object: `{competitor_name: "Nike"}` → keep as is
3. Handle both formats:
   - `["Nike", "Adidas"]` → `[{competitor_name: "Nike"}, {competitor_name: "Adidas"}]`
   - `[{competitor_name: "Nike"}]` → keep as is

**Result**: Array of competitor objects with `competitor_name` property

---

### Step 6.2: Fetch Competitor Metadata
**Function**: `extractPositions()` (line 278-287)

**Action**:
1. Query `brand_competitors` table:
   - Select: `competitor_name`, `metadata`
   - Filter: `brand_id = result.brand_id`
   - Get all competitors for this brand
2. Build `competitorMetadataMap`:
   - Key: `competitor_name.toLowerCase()`
   - Value: `metadata` object
   - Purpose: Fast lookup of competitor metadata

**Result**: Map of competitor name → metadata

---

### Step 6.3: Enrich Competitors with Product Names
**Function**: `extractPositions()` (line 289-296)

**Action**:
1. For each normalized competitor:
   - Look up metadata from `competitorMetadataMap`
   - Extract product names from metadata:
     - Call `extractProductNamesFromMetadata()` (line 651)
     - Checks metadata keys: `products`, `product_names`, `productNames`, etc.
   - Create enriched competitor object:
     ```typescript
     {
       competitor_name: "Nike",
       productNames: ["Air Max", "Jordan", ...]
     }
     ```

**Result**: Array of enriched competitors with product names

**Helper Function**: `extractProductNamesFromMetadata()` (line 651)
- Recursively searches metadata object
- Checks keys: `products`, `product_names`, `productNames`, `aliases`, `alias`, `keywords`, `keyword_aliases`
- Sanitizes product names
- Returns deduplicated array

**⚠️ Current Limitation**:
- **No LLM extraction** for competitor products (unlike brand products)
- Competitor products must be pre-populated in `brand_competitors.metadata`
- If metadata is empty, competitor products won't be found in answer text
- **See "Potential Enhancements" section** for proposal to add LLM-based competitor product extraction

---

## PHASE 7: Position Calculation (Core Logic)

### Step 7.1: Calculate Word Positions
**Function**: `calculateWordPositions()` (line 510)

**Called with**:
- `brandName`: Brand name string
- `productNames`: Array of brand product names
- `enrichedCompetitors`: Array of competitors with product names
- `rawAnswer`: Full answer text

**This is where the actual position finding happens**

---

### Step 7.2: Tokenize Answer Text
**Function**: `tokenizeWords()` (line 584)

**Action**:
1. **Extract Words**:
   - Regex: `/\b[\p{L}\p{N}'']+\b/gu`
   - Matches: Unicode letters, numbers, apostrophes
   - Example: `"I love Nike shoes"` → `["I", "love", "Nike", "shoes"]`

2. **Create Two Arrays**:
   - `tokens`: Original words (preserved for reference)
   - `normalizedTokens`: Normalized words (for matching)

3. **Normalize Each Word**:
   - Call `normalizeWord()` (line 598) for each token:
     - Convert to lowercase
     - Remove leading/trailing apostrophes
     - Remove possessive endings (`'s`, `s'`)

**Result**: 
```typescript
{
  tokens: ["I", "love", "Nike", "shoes"],
  normalizedTokens: ["i", "love", "nike", "shoes"]
}
```

**Example Normalization**:
- `"Nike's"` → `"nike"`
- `"McDonald's"` → `"mcdonalds"`
- `"I've"` → `"ive"`

---

### Step 7.3: Normalize Brand Terms
**Function**: `calculateWordPositions()` (line 524-526)

**Action**:
1. Combine brand name + product names:
   - `[brandName, ...productNames]`
   - Example: `["Nike", "Air Max", "Jordan"]`

2. For each term:
   - Call `normalizeTerm()` (line 607):
     - Extract words using same regex
     - Normalize each word using `normalizeWord()`
   - Example: `"Air Max"` → `["air", "max"]`

3. Filter out empty term arrays

**Result**: Array of token arrays
- Example: `[["nike"], ["air", "max"], ["jordan"]]`

---

### Step 7.4: Find Brand Positions
**Function**: `calculateWordPositions()` (line 528-545)

**Action**:
1. **Initialize Sets**:
   - `brandPositionsSet`: For brand name + product mentions
   - `brandProductPositionsSet`: For product-only mentions

2. **Find Brand Name + Product Positions**:
   - For each brand term (brand name + products):
     - Call `findTermPositions()` (line 615)
     - Add all found positions to `brandPositionsSet`

3. **Find Product-Only Positions**:
   - For each product name separately:
     - Call `findTermPositions()`
     - Add positions to `brandProductPositionsSet`

4. **Convert to Sorted Arrays**:
   - `brandPositions`: All brand mentions (sorted ascending)
   - `brandFirst`: First position (or null if none)
   - `brandProductPositions`: Product-only positions (sorted)

**Result**:
```typescript
{
  brand: {
    first: 5,  // First mention at word position 5
    all: [5, 12, 45]  // All brand mentions
  },
  brandProducts: [12, 45]  // Product-only mentions
}
```

---

### Step 7.5: Find Term Positions (Core Matching Algorithm)
**Function**: `findTermPositions()` (line 615)

**Parameters**:
- `tokens`: Normalized token array (e.g., `["i", "love", "nike", "shoes"]`)
- `termTokens`: Term to find (e.g., `["nike"]` or `["air", "max"]`)

**Algorithm** (Sliding Window):
1. **Initialize**:
   - `positions`: Empty array
   - `termLength`: Length of term tokens

2. **Sliding Window Search**:
   - For each position `i` from 0 to `tokens.length - termLength`:
     - Check if tokens starting at `i` match `termTokens`
     - Compare each token: `tokens[i + j] === termTokens[j]`
     - If all match → add `i + 1` to positions (1-indexed)

3. **Return**: Array of positions (1-indexed)

**Example**:
- Text: `"I love Nike shoes and Nike Air Max"`
- Tokens: `["i", "love", "nike", "shoes", "and", "nike", "air", "max"]`
- Term: `["nike"]`
- Result: `[3, 6]` (Nike appears at positions 3 and 6)

**Multi-word Example**:
- Term: `["air", "max"]`
- Result: `[7]` (Air Max appears starting at position 7)

---

### Step 7.6: Find Competitor Positions
**Function**: `calculateWordPositions()` (line 547-571)

**Action**:
1. **Initialize Maps**:
   - `competitorPositions`: `{competitor_name: [positions]}`
   - `competitorProductPositions`: `{competitor_name: [positions]}`

2. **For Each Competitor**:
   - **Combine Terms**: `[competitor_name, ...productNames]`
   - **Find Combined Positions**:
     - For each term (name + products):
       - Call `findTermPositions()`
       - Add all positions to `combinedPositionSet`
     - Store in `competitorPositions[competitor_name]`
   
   - **Find Product-Only Positions**:
     - For each competitor product separately:
       - Call `findTermPositions()`
       - Add to `productPositionSet`
     - Store in `competitorProductPositions[competitor_name]`

3. **Sort All Position Arrays** (ascending)

**Result**:
```typescript
{
  competitors: {
    "Adidas": [8, 15],
    "Puma": [22]
  },
  competitorProducts: {
    "Adidas": [15],  // Product-only mentions
    "Puma": []
  }
}
```

---

### Step 7.7: Calculate Word Count
**Function**: `calculateWordPositions()` (line 580)

**Action**:
- Return `tokens.length` (total word count)

**Result**: Total number of words in answer

---

## PHASE 8: Metrics Calculation

### Step 8.1: Calculate Total Mentions
**Function**: `extractPositions()` (line 328-333)

**Action**:
1. **Brand Mentions**:
   - `totalBrandMentions = positions.brand.all.length`
   - Count of all brand name + product mentions

2. **Competitor Mentions**:
   - Sum all competitor position arrays
   - `totalCompetitorMentions = sum(competitorPositions[each].length)`

3. **Product Mentions**:
   - `totalBrandProductMentions = positions.brandProducts.length`
   - `totalCompetitorProductMentions = sum(competitorProductPositions[each].length)`

**Result**: Counts for all entities

---

### Step 8.2: Calculate Visibility Index
**Function**: `calculateVisibilityIndex()` (line 690)

**Formula**:
```typescript
density = mentions / totalWords
prominence = 1 / log10(firstPosition + 9)
visibilityIndex = (prominence * 0.6) + (density * 0.4)
```

**Parameters**:
- `occurrences`: Number of mentions
- `positions`: Array of word positions
- `totalWords`: Total word count

**Calculation**:
1. If no mentions → return `0`
2. Calculate `density`: Mentions per word
3. Calculate `prominence`: Based on first position (earlier = higher)
4. Weighted average: 60% prominence, 40% density
5. Round to 2 decimal places

**Result**: Visibility index (0-1 scale, 0 = not visible, 1 = highly visible)

**Example**:
- Mentions: 3
- First position: 5
- Total words: 100
- Density: 3/100 = 0.03
- Prominence: 1/log10(5+9) = 1/log10(14) ≈ 0.85
- Visibility: (0.85 * 0.6) + (0.03 * 0.4) ≈ 0.52

---

### Step 8.3: Calculate Share of Answers
**Function**: `calculateShareOfAnswers()` (line 705)

**Formula**:
```typescript
share = (primaryMentions / (primaryMentions + secondaryMentions)) * 100
```

**Parameters**:
- `primaryMentions`: Brand mentions (or competitor mentions)
- `secondaryMentions`: Competitor mentions (or brand mentions)

**Calculation**:
1. Total mentions = primary + secondary
2. If total = 0 → return `null`
3. Calculate percentage: `(primary / total) * 100`
4. Round to 2 decimal places

**Result**: Share percentage (0-100, or null if no mentions)

**Example**:
- Brand mentions: 5
- Competitor mentions: 3
- Share: (5 / 8) * 100 = 62.5%

---

## PHASE 9: Build Database Rows

### Step 9.1: Build Position Metadata
**Function**: `extractPositions()` (line 260-269)

**Action**:
1. Create `positionMetadata` object
2. Add `topic_name` (if exists)
3. Add product names:
   - `product_names`
   - `productNames` (alternative key)
   - `products` (alternative key)

**Result**: Metadata object for storage

---

### Step 9.2: Build Brand Row
**Function**: `extractPositions()` (line 341-366)

**Action**:
1. Create `PositionInsertRow` object with:
   - **Identifiers**: `customer_id`, `brand_id`, `query_id`, `collector_type`, `collector_result_id`
   - **Names**: `brand_name`, `competitor_name = null`
   - **Text**: `raw_answer`
   - **Positions**:
     - `brand_first_position`: First brand mention position
     - `brand_positions`: All brand mention positions
     - `competitor_positions`: Empty array (brand row)
   - **Counts**:
     - `total_brand_mentions`
     - `competitor_mentions`: Total competitor mentions
     - `total_brand_product_mentions`
     - `total_competitor_product_mentions`
   - **Metrics**:
     - `visibility_index`: Brand visibility
     - `visibility_index_competitor`: null
     - `share_of_answers_brand`: Brand share
     - `share_of_answers_competitor`: null
   - **Flags**:
     - `has_brand_presence`: true if mentions > 0
   - **Metadata**: `topic`, `metadata` object

**Result**: Brand row ready for database insertion

---

### Step 9.3: Build Competitor Rows
**Function**: `extractPositions()` (line 368-410)

**Action**:
1. **For Each Competitor**:
   - Get competitor positions from `competitorPositionMap`
   - Get competitor product positions from `competitorProductPositions`
   - Calculate competitor-specific metrics:
     - `competitorMentions`: Count from position array
     - `competitorVisibility`: Calculate visibility for this competitor
     - `competitorShareOfAnswers`: Calculate share vs brand + other competitors
   
2. **Create Row**:
   - Same structure as brand row
   - `competitor_name`: Set to competitor name
   - `competitor_positions`: Competitor-specific positions
   - `competitor_mentions`: Competitor-specific count
   - `visibility_index_competitor`: Competitor visibility
   - `share_of_answers_competitor`: Competitor share

**Result**: Array of competitor rows (one per competitor)

**Note**: Every competitor gets a row, even if not mentioned (positions = [])

---

## PHASE 10: Save to Database

### Step 10.1: Save Positions
**Function**: `savePositions()` (line 880)

**Action**:
1. **Prepare Rows**:
   - Combine: `[brandRow, ...competitorRows]`
   - Total rows: 1 brand + N competitors

2. **Idempotency**:
   - Delete existing rows for this `collector_result_id`
   - Ensures no duplicates if re-run

3. **Insert**:
   - Insert all rows into `extracted_positions` table
   - Use Supabase `.insert()` with array

4. **Update Collector Results Metadata**:
   - Fetch current `collector_results.metadata`
   - Merge product names into metadata:
     - `product_names`
     - `productNames`
     - `products`
   - Update `collector_results` row

**Result**: Positions saved to database

---

## PHASE 11: Return and Continue

### Step 11.1: Return Result
**Function**: `extractPositions()` (line 412-416)

**Returns**:
```typescript
{
  brandRow: PositionInsertRow,
  competitorRows: PositionInsertRow[],
  productNames: string[]
}
```

---

### Step 11.2: Process Next Result
**Function**: `extractPositionsForNewResults()` (line 197-202)

**Action**:
1. Increment `processed` counter
2. Log statistics
3. Continue to next result in loop
4. If error → log and continue (don't stop batch)

**Result**: Process all unprocessed results

---

## PHASE 12: Completion

### Step 12.1: Return Total Processed
**Function**: `extractPositionsForNewResults()` (line 207)

**Returns**: Number of successfully processed collector results

---

## DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ENTRY: extractPositionsForNewResults(options)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FETCH: Query collector_results table                     │
│    - Filter by customerId, brandIds, since                 │
│    - Order by created_at DESC                              │
│    - Limit to fetchLimit                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. FILTER: Check extracted_positions for existing rows     │
│    - Build Set of processed collector_result_ids          │
│    - Filter out already processed results                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. LOOP: For each unprocessed result                       │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ 4.1. Parse and validate result                      │ │
│    │ 4.2. Call extractPositions(result)                  │ │
│    │      ┌───────────────────────────────────────────┐ │ │
│    │      │ 5. Extract topic (from metadata/query)     │ │ │
│    │      │ 6. Fetch brand data (id, name, metadata)    │ │ │
│    │      │ 7. Get product names (cached LLM call)     │ │ │
│    │      │ 8. Normalize competitors array              │ │ │
│    │      │ 9. Fetch competitor metadata                │ │ │
│    │      │ 10. Enrich competitors with products        │ │ │
│    │      │ 11. Calculate word positions:               │ │ │
│    │      │     - Tokenize text                          │ │ │
│    │      │     - Normalize terms                        │ │ │
│    │      │     - Find brand positions                   │ │ │
│    │      │     - Find competitor positions              │ │ │
│    │      │ 12. Calculate metrics:                       │ │ │
│    │      │     - Total mentions                         │ │ │
│    │      │     - Visibility index                       │ │ │
│    │      │     - Share of answers                        │ │ │
│    │      │ 13. Build brand row                          │ │ │
│    │      │ 14. Build competitor rows (one per comp)     │ │ │
│    │      └───────────────────────────────────────────┘ │ │
│    │ 4.3. Save positions to database                      │ │
│    └─────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 15. RETURN: Total processed count                          │
└─────────────────────────────────────────────────────────────┘
```

---

## KEY ALGORITHMS

### 1. Tokenization Algorithm
**Regex**: `/\b[\p{L}\p{N}'']+\b/gu`
- Matches: Unicode letters, numbers, apostrophes
- Word boundaries: `\b` ensures whole words
- Global: Finds all matches
- Unicode: Handles international characters

### 2. Normalization Algorithm
**Steps**:
1. Convert to lowercase
2. Remove leading apostrophes: `'word` → `word`
3. Remove trailing apostrophes: `word'` → `word`
4. Remove possessive: `word's` → `word`, `words'` → `word`

### 3. Position Finding Algorithm (Sliding Window)
**Pseudocode**:
```
for i = 0 to tokens.length - termLength:
  match = true
  for j = 0 to termLength - 1:
    if tokens[i + j] !== termTokens[j]:
      match = false
      break
  if match:
    positions.add(i + 1)  // 1-indexed
```

### 4. Visibility Index Formula
```
density = mentions / totalWords
prominence = 1 / log10(firstPosition + 9)
visibility = (prominence * 0.6) + (density * 0.4)
```

### 5. Share of Answers Formula
```
share = (primaryMentions / (primaryMentions + secondaryMentions)) * 100
```

---

## DATABASE SCHEMA

### `extracted_positions` Table
**Columns**:
- `id`: Primary key
- `collector_result_id`: Foreign key to `collector_results`
- `brand_id`: Foreign key to `brands`
- `customer_id`: Foreign key to customers
- `query_id`: Foreign key to `generated_queries`
- `collector_type`: String (e.g., "Grok", "Gemini")
- `brand_name`: String
- `competitor_name`: String or null (null for brand row)
- `raw_answer`: Full answer text
- `brand_first_position`: Integer or null
- `brand_positions`: Integer array (JSONB)
- `competitor_positions`: Integer array (JSONB)
- `total_brand_mentions`: Integer
- `competitor_mentions`: Integer
- `total_word_count`: Integer
- `visibility_index`: Float (0-1)
- `visibility_index_competitor`: Float (0-1) or null
- `share_of_answers_brand`: Float (0-100) or null
- `share_of_answers_competitor`: Float (0-100) or null
- `has_brand_presence`: Boolean
- `topic`: String or null
- `metadata`: JSONB (contains product_names, topic_name)
- `processed_at`: Timestamp

**Row Structure**:
- **1 Brand Row**: `competitor_name = null`, contains brand metrics
- **N Competitor Rows**: One per competitor, contains competitor-specific metrics

---

## PERFORMANCE CONSIDERATIONS

### Caching
- **Product Names**: Cached per `brandId` in memory Map
- **Benefit**: Avoids redundant LLM calls for same brand

### Batch Processing
- Processes multiple results in one run
- Default limit: 500 results
- Continues on error (doesn't stop batch)

### Database Queries
- Single query to fetch collector results
- Batch check for existing positions
- Single insert for all position rows

### LLM Calls
- **1 call per brand** for product extraction (cached)
- **No LLM calls** for competitor product extraction (uses metadata only)
- **No LLM calls** for position finding (pure text matching)
- **Total**: ~1 LLM call per unique brand in batch

**Note**: See "Potential Enhancements" section for proposal to add LLM-based competitor product extraction

---

## ERROR HANDLING

### Validation Errors
- Zod schema validation catches invalid data
- Throws error if brand not found
- Continues to next result on error

### LLM Errors
- Falls back from Cerebras to Gemini
- Returns empty array if product extraction fails
- Logs warnings but continues processing

### Database Errors
- Throws error if insert fails
- Idempotency: Deletes existing rows before insert
- Prevents duplicate rows

---

## SUMMARY

**Total Steps**: ~15 major steps
**LLM Calls**: 1 per brand (cached, for product extraction)
**Text Processing**: Pure tokenization and pattern matching (no LLM)
**Database Writes**: 1 insert per collector result (1 brand row + N competitor rows)
**Performance**: Fast (no LLM for position finding, only for product extraction)

**Key Insight**: Position extraction uses **deterministic text matching**, not LLM. Only product name extraction uses LLM (and it's cached per brand).

---

## POTENTIAL ENHANCEMENTS

### Enhancement 1: LLM-Based Competitor Product Extraction

**Current Behavior**:
- **Brand products**: Extracted using LLM (`extractProductNamesWithLLM()`) - analyzes answer text dynamically
- **Competitor products**: Extracted from metadata only (`extractProductNamesFromMetadata()`) - requires pre-populated data

**Limitation**:
- Competitor product names must be manually added to `brand_competitors.metadata`
- If metadata is empty, competitor products won't be found in the answer text
- No dynamic extraction from answer text for competitors

**Proposed Enhancement**:
- Add LLM-based competitor product extraction similar to brand products
- Extract competitor product names from `raw_answer` text using LLM
- Fallback to metadata if LLM extraction fails or returns empty
- Cache competitor products per competitor (similar to brand product caching)

**Benefits**:
- More accurate competitor product detection
- Automatic discovery of competitor products mentioned in answers
- Better position tracking for competitor products
- Consistent approach for both brand and competitor products

**Implementation Considerations**:
- Add `extractCompetitorProductNamesWithLLM()` function
- Modify `enrichCompetitors()` to use LLM extraction with metadata fallback
- Add competitor product caching (Map<competitor_name, productNames[]>)
- Consider combining brand + competitor product extraction in single LLM call for efficiency

**Code Location**: 
- Current: `backend/src/services/scoring/position-extraction.service.ts` (line 289-296)
- Enhancement: Add LLM extraction before metadata fallback




