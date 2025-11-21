# ProductNames Usage Analysis

## Overview
This document analyzes where `productNames` are used in the project, identifies the issue where competitor products are incorrectly included in brand product lists, and explains where competitor mentions are stored.

## Where ProductNames Are Used

### 1. **Prompts Page** (`src/pages/Prompts.tsx`)
- **Service**: `backend/src/services/prompts-analytics.service.ts`
- **Function**: `extractProductNames()` (lines 127-152)
- **Usage**: Extracts product names from `collector_results.metadata` and `generated_queries.metadata` to display product highlights in the Prompts page
- **Implementation**: Aggregates products from metadata keys: `products`, `product_names`, `productNames`, `product_entities`, `productEntities`, `productHighlights`, `highlighted_products`
- **Display**: Used in line 472-473 to populate `aggregate.highlights.products` set

### 2. **Brand Mentions Counting** (`backend/src/services/visibility-score.service.ts`)
- **Function**: `extractProductNames()` (lines 1367-1396) and `extractProductNamesWithLLM()` (lines 1410+)
- **Usage**: Extracts product names to count brand mentions including product mentions
- **Implementation**:
  - Uses LLM to extract product names from answer text
  - Combines brand name with product names: `[brandName, ...productNames]` (line 473, 999)
  - Uses these combined terms to count mentions in the answer text
  - Products are explicitly listed in the LLM prompt for counting (lines 1044-1095)

### 3. **Position Extraction** (`backend/src/services/scoring/position-extraction.service.ts`)
- **Function**: `getProductNames()` (lines 454-472), `extractProductNamesWithLLM()` (lines 479-523)
- **Usage**: Extracts product names and stores them in `extracted_positions` table and updates `collector_results.metadata`
- **Implementation**:
  - Uses LLM to extract products that "belong to" the brand (line 495)
  - Stores in metadata with keys: `product_names`, `productNames`, `products` (lines 296-298, 957-959)
  - Updates `collector_results.metadata` after position extraction (lines 940-976)

### 4. **Collector Results Metadata** (`collector_results` table)
- **Location**: `metadata` JSONB column
- **Fields**: 
  - `products` (array)
  - `productNames` (array) 
  - `product_names` (array)
- **Population**: 
  - Initially from collector response metadata (if provided)
  - Updated by `position-extraction.service.ts` after scoring (lines 940-976)
  - All three fields contain the same array for compatibility

## The Problem: Competitor Products in Brand Product Lists

### Issue Description
For Uber brand, the `collector_results.metadata` shows:
```json
{
  "products": ["UberX", "Uber Black", "Uber Eats", "Lyft", "Amazon Flex", "DoorDash", "Instacart", "Shipt"],
  "productNames": ["UberX", "Uber Black", "Uber Eats", "Lyft", "Amazon Flex", "DoorDash", "Instacart", "Shipt"],
  "product_names": ["UberX", "Uber Black", "Uber Eats", "Lyft", "Amazon Flex", "DoorDash", "Instacart", "Shipt"]
}
```

**Problem**: Competitors like "Lyft", "Amazon Flex", "DoorDash", "Instacart", "Shipt" are incorrectly included as Uber products.

### Root Cause

1. **LLM Extraction Prompt Issue** (`position-extraction.service.ts:487-498`)
   - Prompt asks: *"List popular or relevant products that belong to [brandName]"*
   - The LLM may misinterpret this when the answer text discusses multiple brands together
   - If the context shows products from competitors alongside the brand, the LLM might include them all

2. **No Competitor Filtering**
   - The extraction prompt doesn't explicitly exclude competitors
   - No validation step to filter out known competitors from product lists
   - The metadata from collectors might already contain a mixed `products` array

3. **Metadata Propagation**
   - If a collector (e.g., BrightData Bing Copilot) returns a `products` array in metadata that includes competitors, it gets propagated
   - The position extraction service then overwrites this with its LLM extraction, but if the LLM also makes the same mistake, the issue persists

### Where This Happens

1. **Collector Response** (`backend/src/services/data-collection/data-collection.service.ts:989-995`)
   - Initial metadata is stored from collector response
   - If collector metadata contains `products` array with competitors, it's stored as-is

2. **Position Extraction** (`backend/src/services/scoring/position-extraction.service.ts:940-976`)
   - After position extraction, product names are merged into existing metadata
   - This can overwrite or merge incorrectly extracted products

## Where Competitor Mentions Are Stored

### 1. **Collector Results Table**
- **Field**: `competitors` (JSONB array column)
- **Content**: Array of competitor names (strings)
- **Example**: `["Lyft", "DoorDash", "Amazon Flex"]`
- **Populated**: From `brand_competitors` table when storing collector result (line 962-978 in `data-collection.service.ts`)

### 2. **Extracted Positions Table**
- **Field**: `metadata` JSONB column contains:
  - `competitorProducts`: Object mapping competitor names to their product position arrays
  - Structure: `{ [competitor_name]: number[] }`
- **Example**: 
  ```json
  {
    "competitorProducts": {
      "Lyft": [45, 67, 120],
      "DoorDash": [89, 156]
    }
  }
  ```
- **Populated**: By `position-extraction.service.ts` (lines 308-356, 571-593)

### 3. **Brand Competitors Table** (`brand_competitors`)
- **Structure**: 
  - `competitor_name`: string
  - `metadata`: JSONB (can contain competitor's product names)
- **Usage**: Stores competitor information and their metadata (including their product names)
- **Accessed**: When extracting competitor product names for position calculation (lines 309-326 in `position-extraction.service.ts`)

### Note: Competitor Products Not Stored in Collector Results
- Competitor product names are NOT stored separately in `collector_results.metadata`
- Only competitor names are stored in the `competitors` array field
- Competitor products are only tracked in `extracted_positions.metadata.competitorProducts` for position tracking

## Recommendations

### 1. **Fix LLM Extraction Prompt**
- Add explicit instruction to exclude competitors
- Provide competitor list to LLM for filtering
- Add validation example showing what NOT to include

### 2. **Add Validation Step**
- After LLM extraction, cross-reference with `brand_competitors` table
- Filter out any products that belong to known competitors
- Log when products are filtered out for monitoring

### 3. **Separate Storage**
- Store competitor products separately in metadata (e.g., `competitor_products` field)
- Don't merge competitor products into brand product arrays

### 4. **Fix Existing Data**
- Add migration script to clean up incorrect product lists in `collector_results.metadata`
- Remove known competitors from `products`/`productNames`/`product_names` arrays

## Files to Review/Modify

1. `backend/src/services/scoring/position-extraction.service.ts`
   - Lines 479-523: `extractProductNamesWithLLM()` - Fix prompt and add validation
   - Lines 940-976: Metadata update logic - Add competitor filtering

2. `backend/src/services/data-collection/data-collection.service.ts`
   - Lines 989-995: Initial metadata storage - Consider filtering products array if present

3. `backend/src/services/prompts-analytics.service.ts`
   - Lines 127-152: `extractProductNames()` - Already handles multiple keys correctly

4. `backend/src/services/visibility-score.service.ts`
   - Lines 1367-1396: `extractProductNames()` - May need competitor filtering if it uses LLM extraction

## Summary

- **productNames used in**: Prompts page (highlights), Brand mention counting, Position extraction, Collector results metadata
- **Issue**: Competitor products (Lyft, DoorDash, etc.) incorrectly included in Uber's product list
- **Root cause**: LLM extraction doesn't filter competitors; no validation step
- **Competitor storage**: 
  - Names in `collector_results.competitors` array
  - Products in `extracted_positions.metadata.competitorProducts`
  - NOT stored separately in `collector_results.metadata`


