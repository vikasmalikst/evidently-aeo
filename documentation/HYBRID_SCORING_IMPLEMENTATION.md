# Hybrid Scoring Implementation Summary

## Overview
Implemented a hybrid approach for consolidated scoring that provides:
- **Fault tolerance**: Analysis results stored in database (survive interruptions)
- **Incremental processing**: When Ollama is enabled, process each item completely before moving to next
- **Batch processing**: When OpenRouter is used, process in batches (faster)
- **Resume capability**: Can resume from any point, skip already-completed items
- **Provider-agnostic caching**: Analysis results can be reused regardless of LLM provider

---

## New Database Table

### `consolidated_analysis_cache`

**Purpose**: Stores consolidated analysis results (products and sentiment) for each `collector_result` to enable fault tolerance and resume capability.

**Schema**:
```sql
CREATE TABLE consolidated_analysis_cache (
  collector_result_id bigint PRIMARY KEY,
  products jsonb NOT NULL DEFAULT '{}'::jsonb,
  sentiment jsonb NOT NULL DEFAULT '{}'::jsonb,
  llm_provider text NOT NULL CHECK (llm_provider IN ('ollama', 'openrouter')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Fields**:
- `collector_result_id` (PK): References `collector_results.id`
- `products` (JSONB): `{ "brand": ["product1"], "competitors": { "comp1": ["productA"] } }`
- `sentiment` (JSONB): `{ "brand": { "label": "POSITIVE", "score": 85 }, "competitors": {...} }`
- `llm_provider`: Which provider was used ('ollama' or 'openrouter')
- `created_at`, `updated_at`: Timestamps

**Indexes**:
- Primary key on `collector_result_id`
- Index on `llm_provider` (for analytics)
- Index on `created_at` (for cleanup)

**Migration File**: `supabase/migrations/20250131000000_create_consolidated_analysis_cache.sql`

---

## Processing Modes

### Mode 1: Incremental Processing (Ollama Enabled)

**When**: `useOllama = true`

**Flow**:
1. For each `collector_result`:
   - **Step 1**: Run analysis (or get from DB cache) → Store in DB
   - **Step 2**: Extract positions → Store in DB
   - **Step 3**: Store sentiment → Update DB
   - Move to next item

**Benefits**:
- ✅ Results appear in real-time
- ✅ Better fault tolerance (each item is complete)
- ✅ Users see progress incrementally
- ✅ If interrupted, completed items are saved

**Example Log Flow**:
```
🔄 Using incremental processing (Ollama enabled)
   📊 [Item 1/50] Processing collector_result 5311...
   ♻️ Using cached analysis from DB for collector_result 5311
   📍 [Item 1/50] Extracting positions for collector_result 5311...
   ✅ Positions extracted for collector_result 5311
   💾 [Item 1/50] Storing sentiment for collector_result 5311...
   ✅ Sentiment stored for collector_result 5311
   ✅ [Item 1/50] Completed all steps for collector_result 5311
```

---

### Mode 2: Batch Processing (OpenRouter Enabled)

**When**: `useOllama = false`

**Flow**:
1. **Step 1**: Analyze all items → Store each in DB
2. **Step 2**: Extract positions for all analyzed items → Store in DB
3. **Step 3**: Store sentiment for all analyzed items → Update DB

**Benefits**:
- ✅ Faster for cloud LLMs (can process in parallel)
- ✅ Efficient batch operations
- ✅ Still uses DB cache for fault tolerance

---

## Resume Capability

### How It Works

**On Start**:
1. Check which results are **fully processed** (have positions AND sentiment)
2. Check which results have **positions but missing sentiment** (Step 3 incomplete)
3. Check which results have **analysis but no positions** (Step 2 incomplete)
4. Process only incomplete items

**Resume Logic**:
- ✅ Fully processed → Skip
- ✅ Has positions, missing sentiment → Complete Step 3 only
- ✅ Has analysis (in DB), missing positions → Complete Steps 2 & 3
- ✅ No analysis → Complete all 3 steps

---

## Provider-Agnostic Caching

### Strategy

**Analysis results are provider-agnostic**:
- If analysis exists in DB (from Ollama) → Reuse for OpenRouter
- If analysis exists in DB (from OpenRouter) → Reuse for Ollama
- Only re-analyze if:
  - No cached analysis exists, OR
  - User forces refresh (future feature)

**Benefits**:
- ✅ Faster recovery (no duplicate LLM calls)
- ✅ Cost savings
- ✅ Consistent results across provider switches

**Example Scenario**:
1. User starts with Ollama → Processes 20 items → Interrupted
2. User switches to OpenRouter → Reuses cached analysis from Ollama
3. Only processes remaining 30 items with OpenRouter

---

## Code Changes

### Files Modified

1. **`supabase/migrations/20250131000000_create_consolidated_analysis_cache.sql`**
   - Creates new table for analysis cache

2. **`backend/src/services/scoring/consolidated-analysis.service.ts`**
   - Added `getCachedAnalysisFromDB()`: Retrieves cached analysis
   - Added `storeAnalysisInDB()`: Stores analysis in DB
   - Modified `analyze()`: Checks DB cache before running new analysis

3. **`backend/src/services/scoring/consolidated-scoring.service.ts`**
   - Added `getCachedAnalysisFromDB()`: Retrieves cached analysis
   - Added `processSingleResultIncrementally()`: Processes one item completely (all 3 steps)
   - Modified `scoreBrand()`: 
     - Incremental processing for Ollama
     - Batch processing for OpenRouter
     - Improved resume capability

---

## Benefits Summary

### Fault Tolerance
- ✅ Analysis results survive interruptions
- ✅ Can resume from any point
- ✅ No duplicate work

### User Experience
- ✅ Real-time results with Ollama
- ✅ Faster completion with OpenRouter
- ✅ Progress visible incrementally

### Performance
- ✅ Provider-agnostic caching (reuse analysis)
- ✅ Efficient batch processing for cloud LLMs
- ✅ Sequential processing for local Ollama

### Debugging
- ✅ Can inspect analysis results in database
- ✅ Can see which provider was used
- ✅ Can track completion status

---

## Migration Instructions

1. **Run Migration**:
   ```bash
   # Apply the migration to create the table
   # (Migration will be applied automatically on next deployment)
   ```

2. **No Code Changes Required**:
   - Existing functionality remains unchanged
   - New features are additive
   - Backward compatible

3. **Verify**:
   - Check that `consolidated_analysis_cache` table exists
   - Run scoring and verify results are stored in cache
   - Test interruption and resume

---

## Testing Scenarios

### Scenario 1: Normal Flow (Ollama)
- ✅ Process 50 items incrementally
- ✅ Verify results appear in real-time
- ✅ Verify all 3 steps complete for each item

### Scenario 2: Interruption Recovery
- ✅ Start processing → Interrupt after 20 items
- ✅ Restart → Verify 20 items skipped, 30 items processed
- ✅ Verify all results are complete

### Scenario 3: Provider Switch
- ✅ Process 20 items with Ollama → Interrupt
- ✅ Switch to OpenRouter → Restart
- ✅ Verify cached analysis reused (no re-analysis)
- ✅ Verify remaining 30 items processed with OpenRouter

### Scenario 4: Partial Completion
- ✅ Step 1 completes → Interrupt
- ✅ Restart → Verify Steps 2 & 3 complete using cached analysis

---

## Current State

✅ **Migration Created**: `20250131000000_create_consolidated_analysis_cache.sql`
✅ **DB Cache Methods**: Added to `consolidated-analysis.service.ts`
✅ **Incremental Processing**: Implemented for Ollama
✅ **Batch Processing**: Maintained for OpenRouter
✅ **Resume Capability**: Improved skip logic
✅ **Provider-Agnostic**: Analysis reuse regardless of provider

**Ready for Testing**: Yes

