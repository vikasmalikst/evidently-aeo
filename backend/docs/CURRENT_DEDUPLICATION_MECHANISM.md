# Current Deduplication Mechanism: How Scoring Prevents Duplicate Processing

## Overview

This document explains how the current scoring system determines which `collector_results` to process and how it attempts to prevent duplicate processing.

---

## Current Flow (Step-by-Step)

### Step 1: Initial Query (No Status Filtering)

**Location:** `consolidated-scoring.service.ts` - `scoreBrand()` method (lines 414-425)

```typescript
let query = this.supabase
  .from('collector_results')
  .select('id, customer_id, brand_id, query_id, ...')
  .eq('brand_id', brandId)
  .eq('customer_id', customerId)
  .not('raw_answer', 'is', null)  // Only process results with raw_answer
  .order('created_at', { ascending: false })
  .limit(limit);
```

**What it filters:**
- ✅ `brand_id` matches
- ✅ `customer_id` matches  
- ✅ `raw_answer IS NOT NULL` (has data to process)
- ✅ Optional: `created_at >= since` (if provided)
- ❌ **NO filtering by `scoring_status`** (this is the gap!)

**Result:** Fetches ALL collector_results that match criteria, regardless of processing status.

---

### Step 2: Post-Query Deduplication Check

**Location:** `consolidated-scoring.service.ts` - `scoreBrand()` method (lines 438-527)

After fetching results, the code checks which ones are **already fully processed**:

#### Option A: Optimized Schema Check (Default)
```typescript
// Check if metric_facts exists (Step 2 completed)
const { data: metricFacts } = await this.supabase
  .from('metric_facts')
  .select('collector_result_id, id')
  .in('collector_result_id', collectorResultIds)
  .eq('brand_id', brandId);

// Check if brand_sentiment exists (Step 3 completed)
const { data: brandSentiment } = await this.supabase
  .from('brand_sentiment')
  .select('metric_fact_id')
  .in('metric_fact_id', metricFactIds)
  .not('sentiment_score', 'is', null);
```

#### Option B: Legacy Schema Check (Fallback)
```typescript
// Check if extracted_positions exists
const { data: positionRow } = await this.supabase
  .from('extracted_positions')
  .select('id, sentiment_score')
  .eq('collector_result_id', cr.id)
  .limit(1)
  .maybeSingle();
```

**What it determines:**
- ✅ **Fully processed**: Has `metric_facts` AND `brand_sentiment` → Skip
- ⚠️ **Partially processed**: Has `metric_facts` but NO `brand_sentiment` → Process (to complete Step 3)
- ❌ **Not processed**: No `metric_facts` → Process

**Result:** Filters out fully processed results (lines 531-535)

```typescript
const resultsToProcess = collectorResults.filter(r => 
  r && r.id && 
  !fullyProcessedResults.has(r.id) &&  // Skip if fully processed
  r.raw_answer
);
```

---

### Step 3: Position Extraction Deduplication

**Location:** `position-extraction.service.ts` - `extractPositionsForNewResults()` method (lines 222-261)

Even if a result passes Step 2 filtering, position extraction service does its own check:

```typescript
// Check if positions already exist
const { data, error } = await this.supabase
  .from('metric_facts')  // or extracted_positions (legacy)
  .select('id')
  .eq('collector_result_id', result.id)
  .limit(1)
  .maybeSingle();

if (existing) {
  processedCollectorResults.add(result.id);  // Skip this one
}
```

**Result:** Filters out results that already have positions (line 269)

```typescript
const results = allResults
  .filter(r => r && r.raw_answer)
  .filter(r => !processedCollectorResults.has(r.id))  // Skip if already has positions
  .slice(0, limit);
```

---

## Current Limitations & Race Conditions

### ❌ Problem 1: No Atomic Coordination

**Issue:** Two workers can both fetch the same "unprocessed" result and both start processing it.

**Scenario:**
```
Time  Worker 1                    Worker 2
----  ---------------------------  ---------------------------
T1    Query: Fetch unprocessed     Query: Fetch unprocessed
      → Gets result ID 123         → Gets result ID 123
      
T2    Check: No metric_facts       Check: No metric_facts
      → Not processed              → Not processed
      
T3    Start processing...         Start processing...
      (Both workers process same result!)
```

**Why it happens:**
- Query happens at T1 (both see same data)
- Deduplication check happens at T2 (both see same state)
- Processing starts at T3 (both proceed)

**No locking mechanism** prevents this!

---

### ❌ Problem 2: Status Field Not Used

**Issue:** The `scoring_status` column exists but is **NOT used** in queries or updates.

**Current state:**
- Query doesn't filter by `scoring_status`
- Code doesn't update `scoring_status` when processing starts
- Code doesn't update `scoring_status` when processing completes
- Code doesn't update `scoring_status` when errors occur

**Result:** Status field is essentially unused.

---

### ❌ Problem 3: Stale Processing States

**Issue:** If a worker crashes while processing, there's no way to know:
- Which results are stuck in "processing" state
- When to retry failed items
- How to recover from interruptions

**Current behavior:**
- If worker crashes, result might be partially processed
- Next run will check `metric_facts` → might skip or might reprocess
- No clear indication of what happened

---

## How It Currently Prevents Duplicates

### ✅ Method 1: Database Existence Checks

**How it works:**
- Before processing, check if output tables already have data
- If `metric_facts` exists → skip (already processed)
- If `brand_sentiment` exists → skip (fully processed)

**Limitations:**
- ❌ Race condition: Two workers can both check before either writes
- ❌ Not atomic: Check and write are separate operations
- ❌ Slow: Requires multiple database queries per result

---

### ✅ Method 2: Upsert Operations

**How it works:**
- Uses `upsert` with `ON CONFLICT` clauses
- If duplicate key exists, update instead of insert

**Example:**
```typescript
await this.supabase
  .from('metric_facts')
  .upsert(metricFact, {
    onConflict: 'collector_result_id',
    ignoreDuplicates: false,
  });
```

**Limitations:**
- ✅ Prevents duplicate data in output tables
- ❌ Doesn't prevent duplicate processing work
- ❌ Both workers still do the expensive LLM calls

---

## Summary: Current Deduplication Strategy

| Aspect | Current Approach | Effectiveness |
|--------|-----------------|---------------|
| **Query Filtering** | Filters by brand_id, customer_id, raw_answer | ⚠️ Partial (doesn't use status) |
| **Post-Query Check** | Checks `metric_facts` and `brand_sentiment` tables | ⚠️ Partial (race condition possible) |
| **Atomic Coordination** | None | ❌ No protection |
| **Status Tracking** | Not used | ❌ Not implemented |
| **Multi-Worker Safety** | Relies on upsert operations | ⚠️ Prevents duplicate data, not duplicate work |

---

## What's Missing

1. **Status-based filtering** in initial query
2. **Atomic claiming** mechanism (UPDATE with WHERE condition)
3. **Status updates** during processing lifecycle
4. **Stale state recovery** mechanism
5. **Multi-worker coordination** to prevent simultaneous processing

---

## Recommended Solution

Implement the strategy outlined in the previous document:
- Use `scoring_status` field for filtering and tracking
- Add atomic claiming with UPDATE ... WHERE
- Update status at each stage (processing → completed/error)
- Add stale state recovery on startup

This will provide:
- ✅ True multi-worker coordination
- ✅ No duplicate processing
- ✅ Clear status visibility
- ✅ Automatic recovery from crashes

