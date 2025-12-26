# Scoring Status Implementation Strategy

## Summary of Requirements

### Goal
Implement `scoring_status` field filtering and updates to:
1. **Filter queries** to only fetch collector_results that need processing
2. **Update status** during processing lifecycle to track state
3. **Enable multi-worker coordination** to prevent duplicate processing
4. **Work for both processing paths** (Ollama incremental + OpenRouter batch)

---

## Current State Analysis

### What Exists
- ✅ `scoring_status` column exists in `collector_results` table
- ✅ Backfill script created to populate initial status values
- ✅ Status values: `'pending'`, `'completed'`, `'error'` (and potentially `'processing'`)

### What's Missing
- ❌ Query doesn't filter by `scoring_status` (line 414-425)
- ❌ No status updates when processing starts
- ❌ No status updates when processing completes
- ❌ No status updates when errors occur
- ❌ No atomic claiming mechanism (race condition exists)

---

## Requirements Breakdown

### 1. Query Filtering

**Current Query (lines 414-425):**
```typescript
let query = this.supabase
  .from('collector_results')
  .select('...')
  .eq('brand_id', brandId)
  .eq('customer_id', customerId)
  .not('raw_answer', 'is', null)
  .order('created_at', { ascending: false })
  .limit(limit);
```

**Required Change:**
- Add filter: Only fetch rows where `scoring_status` is NOT `'processing'` OR `'completed'`
- This means: fetch `'pending'`, `'error'`, or `NULL` status only

**Filter Logic:**
```typescript
// Fetch only rows that need processing
.or('scoring_status.is.null,scoring_status.eq.pending,scoring_status.eq.error')
```

**Alternative (if Supabase supports):**
```typescript
.not('scoring_status', 'in', ['processing', 'completed'])
```

---

### 2. Status Updates During Processing

#### Update Points

**A. When Processing Starts (Atomic Claim)**
- **Location**: Before Step 1 (analysis)
- **Status**: `'processing'`
- **Method**: Atomic UPDATE with WHERE condition
- **Purpose**: Claim the row so other workers skip it

**B. When Processing Completes Successfully**
- **Location**: After Step 3 (sentiment storage) succeeds
- **Status**: `'completed'`
- **Condition**: All 3 steps succeeded
- **Additional**: Clear `scoring_error = NULL`

**C. When Processing Fails**
- **Location**: On any step failure (Step 1, 2, or 3)
- **Status**: `'error'`
- **Additional**: Set `scoring_error = <error_message>`
- **Condition**: Any step fails or exception occurs

---

## Implementation Strategy

### Phase 1: Atomic Claiming Mechanism

**Purpose**: Prevent multiple workers from processing the same result

**Implementation Pattern:**
```typescript
// Try to atomically claim the result
const { data: claimed, error } = await supabase
  .from('collector_results')
  .update({ 
    scoring_status: 'processing',
    scoring_started_at: new Date().toISOString()
  })
  .eq('id', collectorResultId)
  .in('scoring_status', ['pending', 'error', null]) // Only claim if not already processing/completed
  .select('id')
  .single();

if (!claimed || error) {
  // Another worker claimed it, skip
  return;
}
```

**Key Points:**
- Atomic operation: UPDATE with WHERE condition
- Only updates if status is claimable
- Returns updated row if successful
- If no row returned → already claimed by another worker

---

### Phase 2: Status Update Helper Methods

**Create reusable methods in `ConsolidatedScoringService`:**

#### Method 1: `claimCollectorResult(collectorResultId: number): Promise<boolean>`
- Atomically claims result for processing
- Returns `true` if successfully claimed, `false` if already claimed
- Sets status to `'processing'`
- Sets `scoring_started_at` timestamp

#### Method 2: `markCollectorResultCompleted(collectorResultId: number): Promise<void>`
- Updates status to `'completed'`
- Sets `scoring_completed_at` timestamp
- Clears `scoring_error` (if exists)

#### Method 3: `markCollectorResultError(collectorResultId: number, errorMessage: string): Promise<void>`
- Updates status to `'error'`
- Sets `scoring_error = errorMessage`
- Keeps `scoring_started_at` for debugging

---

### Phase 3: Integration Points

#### A. Incremental Processing (Ollama Path)

**Location**: `processSingleResultWithBatching()` method (line 89)

**Flow:**
1. **Before Step 1**: Call `claimCollectorResult()` → if false, skip
2. **After Step 3 succeeds**: Call `markCollectorResultCompleted()`
3. **On any error**: Call `markCollectorResultError()`

**Code Structure:**
```typescript
private async processSingleResultWithBatching(...) {
  const collectorResultId = collectorResult.id;
  
  // Claim before processing
  const claimed = await this.claimCollectorResult(collectorResultId);
  if (!claimed) {
    console.log(`   ⏭️ Collector_result ${collectorResultId} already being processed, skipping`);
    return;
  }
  
  try {
    // Step 1: Analysis
    // Step 2: Positions
    // Step 3: Sentiment
    
    // All steps succeeded
    await this.markCollectorResultCompleted(collectorResultId);
  } catch (error) {
    await this.markCollectorResultError(collectorResultId, error.message);
    throw error;
  }
}
```

#### B. Batch Processing (OpenRouter Path)

**Location**: `scoreBrand()` method - batch processing loop (around line 558)

**Flow:**
1. **Before Step 1 (for each result)**: Call `claimCollectorResult()` → if false, skip
2. **After Step 3 succeeds (for each result)**: Call `markCollectorResultCompleted()`
3. **On any error (for each result)**: Call `markCollectorResultError()`

**Code Structure:**
```typescript
// Step 1: Run consolidated analysis for all results
for (const collectorResult of collectorResults) {
  // Claim before processing
  const claimed = await this.claimCollectorResult(collectorResult.id);
  if (!claimed) {
    continue; // Skip if already claimed
  }
  
  try {
    // Run analysis
    // ...
    
    // After all steps succeed
    await this.markCollectorResultCompleted(collectorResult.id);
  } catch (error) {
    await this.markCollectorResultError(collectorResult.id, error.message);
  }
}
```

---

### Phase 4: Query Modification

**Location**: `scoreBrand()` method (line 414)

**Current:**
```typescript
let query = this.supabase
  .from('collector_results')
  .select('...')
  .eq('brand_id', brandId)
  .eq('customer_id', customerId)
  .not('raw_answer', 'is', null)
  .order('created_at', { ascending: false })
  .limit(limit);
```

**Modified:**
```typescript
let query = this.supabase
  .from('collector_results')
  .select('...')
  .eq('brand_id', brandId)
  .eq('customer_id', customerId)
  .not('raw_answer', 'is', null)
  .or('scoring_status.is.null,scoring_status.eq.pending,scoring_status.eq.error') // Only fetch processable rows
  .order('created_at', { ascending: false })
  .limit(limit);
```

**Alternative (if Supabase supports NOT IN):**
```typescript
// Check Supabase documentation for NOT IN syntax
.not('scoring_status', 'in', ['processing', 'completed'])
```

---

## Status Lifecycle

```
NULL or 'pending' 
    ↓
[Atomic Claim] → 'processing'
    ↓
[Step 1: Analysis] → (status remains 'processing')
    ↓
[Step 2: Positions] → (status remains 'processing')
    ↓
[Step 3: Sentiment] → (status remains 'processing')
    ↓
[All Steps Succeed] → 'completed'
    
OR

[Any Step Fails] → 'error' (with error message)
```

---

## Error Handling Strategy

### Partial Completion Handling

**Scenario**: Step 1 succeeds, Step 2 fails
- Status: `'error'`
- Error message: "Step 2 failed: <details>"
- Next run: Will retry (status is 'error', so it's fetchable)

**Scenario**: Step 1 & 2 succeed, Step 3 fails
- Status: `'error'`
- Error message: "Step 3 failed: <details>"
- Next run: Will retry (but can resume from Step 3 if cache exists)

### Retry Logic

- Items with `'error'` status are automatically retried (included in query filter)
- Items with `'processing'` status are skipped (being processed by another worker)
- Items with `'completed'` status are skipped (already done)

---

## Multi-Worker Coordination

### How It Works

**Worker 1:**
```
1. Query: Fetches result ID 123 (status = 'pending')
2. Claim: UPDATE ... WHERE id=123 AND status IN ('pending', 'error', NULL)
   → Success: status = 'processing'
3. Process: Step 1 → Step 2 → Step 3
4. Complete: status = 'completed'
```

**Worker 2 (simultaneous):**
```
1. Query: Fetches result ID 123 (status = 'pending') [same time as Worker 1]
2. Claim: UPDATE ... WHERE id=123 AND status IN ('pending', 'error', NULL)
   → Fails: No rows updated (status is now 'processing' from Worker 1)
3. Skip: Result already being processed
```

**Result**: Only one worker processes each result ✅

---

## Implementation Checklist

### Files to Modify

1. **`consolidated-scoring.service.ts`**
   - [ ] Add `claimCollectorResult()` method
   - [ ] Add `markCollectorResultCompleted()` method
   - [ ] Add `markCollectorResultError()` method
   - [ ] Modify `scoreBrand()` query to filter by status
   - [ ] Add claiming in `processSingleResultWithBatching()`
   - [ ] Add status updates in `processSingleResultWithBatching()`
   - [ ] Add claiming in batch processing loop
   - [ ] Add status updates in batch processing loop

### Database Columns Required

- ✅ `scoring_status` (TEXT) - Already exists
- ❓ `scoring_started_at` (TIMESTAMPTZ) - Check if exists
- ❓ `scoring_completed_at` (TIMESTAMPTZ) - Check if exists
- ❓ `scoring_error` (TEXT) - Check if exists

**Note**: If timestamp/error columns don't exist, we can:
- Option A: Add them via migration
- Option B: Only update `scoring_status` (minimal approach)

---

## Testing Strategy

### Test Cases

1. **Single Worker Processing**
   - Verify status changes: pending → processing → completed
   - Verify error status on failure

2. **Multi-Worker Coordination**
   - Start 2 workers simultaneously
   - Verify only one processes each result
   - Verify no duplicate processing

3. **Error Recovery**
   - Simulate failure at Step 2
   - Verify status = 'error' with error message
   - Verify retry picks it up on next run

4. **Query Filtering**
   - Verify 'processing' items are not fetched
   - Verify 'completed' items are not fetched
   - Verify 'pending' and 'error' items are fetched

---

## Edge Cases to Handle

1. **Stale 'processing' Status**
   - If worker crashes, status stays 'processing'
   - **Solution**: Add stale check on startup (reset if >30 minutes old)
   - **Location**: Beginning of `scoreBrand()` method

2. **Concurrent Claims**
   - Two workers try to claim same result simultaneously
   - **Solution**: Atomic UPDATE ensures only one succeeds

3. **Status Already Updated**
   - Another process updates status while we're processing
   - **Solution**: Final status update uses WHERE condition to prevent overwriting

---

## Summary

### What We're Implementing

1. **Query Filtering**: Only fetch rows with status NOT IN ('processing', 'completed')
2. **Atomic Claiming**: UPDATE with WHERE to claim rows atomically
3. **Status Updates**: Update status at key lifecycle points
4. **Error Handling**: Set status to 'error' with error message on failures
5. **Multi-Worker Support**: Enable multiple workers without conflicts

### Benefits

- ✅ Prevents duplicate processing
- ✅ Enables multi-worker load distribution
- ✅ Clear status visibility
- ✅ Automatic retry of failed items
- ✅ Works for both Ollama and OpenRouter paths

### Next Steps

1. Review and approve this strategy
2. Check if timestamp/error columns exist
3. Implement helper methods
4. Integrate into processing flows
5. Test with multiple workers

