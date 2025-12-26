# One-at-a-Time Processing Strategy

## Summary of Request

### Current Approach (Batch Processing)
1. **Fetch**: Query returns multiple `collector_results` at once (limit = 50)
2. **Filter**: Post-query deduplication removes fully processed items
3. **Process**: Loop through all remaining results and process them
4. **Update**: Status updates would happen after processing all (not yet implemented)

### Requested Approach (One-at-a-Time)
1. **Fetch**: Query returns ONE `collector_result` at a time
2. **Process**: Process that single result completely (Step 1 → Step 2 → Step 3)
3. **Update**: Update `scoring_status` immediately after processing
4. **Repeat**: Fetch next row, process, update, repeat until no more rows

### Key Difference
- **Current**: Fetch all → Process all → Update all
- **Requested**: Fetch one → Process one → Update one → Repeat

---

## Benefits of One-at-a-Time Approach

### 1. **Immediate Status Updates**
- Status is updated as soon as each result is processed
- Real-time visibility into processing state
- Other workers can immediately see completed items

### 2. **Better Multi-Worker Coordination**
- Each worker processes one item, updates status, then fetches next
- Reduces contention (fewer items "in flight" at once)
- More granular locking (one row at a time)

### 3. **Fault Tolerance**
- If worker crashes, only one item is in "processing" state
- Easier to recover (fewer stale states)
- Progress is saved incrementally

### 4. **Simpler Status Management**
- Status update happens immediately after processing
- No need to track multiple items' states
- Clearer error handling (one item at a time)

---

## Implementation Strategy

### Phase 1: Query Modification

**Current Query (lines 414-425):**
```typescript
let query = this.supabase
  .from('collector_results')
  .select('...')
  .eq('brand_id', brandId)
  .eq('customer_id', customerId)
  .not('raw_answer', 'is', null)
  .order('created_at', { ascending: false })
  .limit(limit); // Fetches multiple rows
```

**Modified Query (One-at-a-Time):**
```typescript
// Fetch ONE row at a time
let query = this.supabase
  .from('collector_results')
  .select('...')
  .eq('brand_id', brandId)
  .eq('customer_id', customerId)
  .not('raw_answer', 'is', null)
  .or('scoring_status.is.null,scoring_status.eq.pending,scoring_status.eq.error') // Filter by status
  .not('scoring_status', 'in', ['processing', 'completed']) // Exclude processing/completed
  .order('created_at', { ascending: false })
  .limit(1); // Fetch only ONE row
```

---

### Phase 2: Processing Loop Restructure

**Current Structure:**
```typescript
// Fetch all
const collectorResults = await query;

// Filter
const resultsToProcess = collectorResults.filter(...);

// Process all
for (const result of resultsToProcess) {
  await processSingleResult(...);
}
```

**New Structure (One-at-a-Time):**
```typescript
let processedCount = 0;
let maxIterations = limit || 50; // Prevent infinite loops

while (processedCount < maxIterations) {
  // Fetch ONE row
  const { data: collectorResult, error } = await query.limit(1).maybeSingle();
  
  if (!collectorResult || error) {
    // No more rows to process
    break;
  }
  
  // Claim atomically (set status to 'processing')
  const claimed = await this.claimCollectorResult(collectorResult.id);
  if (!claimed) {
    // Another worker claimed it, skip and fetch next
    continue;
  }
  
  try {
    // Process completely (Step 1 → Step 2 → Step 3)
    await this.processSingleResultCompletely(collectorResult, brandId, customerId);
    
    // Update status to 'completed'
    await this.markCollectorResultCompleted(collectorResult.id);
    processedCount++;
  } catch (error) {
    // Update status to 'error'
    await this.markCollectorResultError(collectorResult.id, error.message);
  }
  
  // Loop continues to fetch next row
}
```

---

### Phase 3: Atomic Claiming Integration

**Claim Before Processing:**
```typescript
// Try to atomically claim the result
const { data: claimed, error } = await this.supabase
  .from('collector_results')
  .update({ 
    scoring_status: 'processing',
    scoring_started_at: new Date().toISOString()
  })
  .eq('id', collectorResultId)
  .in('scoring_status', ['pending', 'error', null]) // Only claim if claimable
  .select('id')
  .single();

if (!claimed || error) {
  // Already claimed by another worker, skip
  return false;
}
return true;
```

**Key Points:**
- Claim happens BEFORE processing starts
- Atomic operation prevents race conditions
- If claim fails, skip and fetch next row

---

### Phase 4: Status Updates After Processing

**After Success:**
```typescript
await this.supabase
  .from('collector_results')
  .update({
    scoring_status: 'completed',
    scoring_completed_at: new Date().toISOString(),
    scoring_error: null
  })
  .eq('id', collectorResultId);
```

**After Error:**
```typescript
await this.supabase
  .from('collector_results')
  .update({
    scoring_status: 'error',
    scoring_error: errorMessage
  })
  .eq('id', collectorResultId);
```

---

## Processing Flow Diagram

### One-at-a-Time Flow

```
START
  ↓
[Query: Fetch 1 row where status NOT IN ('processing', 'completed')]
  ↓
[No rows?] → END
  ↓
[Yes, got 1 row]
  ↓
[Atomic Claim: UPDATE status = 'processing' WHERE id = X AND status IN ('pending', 'error', NULL)]
  ↓
[Claim failed?] → [Skip, fetch next] → [Query again]
  ↓
[Claim succeeded]
  ↓
[Process: Step 1 (Analysis)]
  ↓
[Process: Step 2 (Positions)]
  ↓
[Process: Step 3 (Sentiment)]
  ↓
[All steps succeeded?]
  ↓
[Yes] → [UPDATE status = 'completed'] → [Increment counter] → [Query next]
  ↓
[No] → [UPDATE status = 'error'] → [Query next]
  ↓
[Repeat until no more rows or max iterations]
```

---

## Code Structure Changes

### Method: `processOneCollectorResult()`

**New method to handle one-at-a-time processing:**

```typescript
private async processOneCollectorResult(
  brandId: string,
  customerId: string,
  result: ConsolidatedScoringResult
): Promise<boolean> {
  // Returns: true if processed a row, false if no rows available
  
  // 1. Fetch ONE row
  const { data: collectorResult, error } = await this.supabase
    .from('collector_results')
    .select('id, customer_id, brand_id, query_id, question, execution_id, collector_type, raw_answer, brand, competitors, created_at, metadata, citations, urls, topic')
    .eq('brand_id', brandId)
    .eq('customer_id', customerId)
    .not('raw_answer', 'is', null)
    .or('scoring_status.is.null,scoring_status.eq.pending,scoring_status.eq.error')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!collectorResult || error) {
    return false; // No more rows
  }
  
  // 2. Claim atomically
  const claimed = await this.claimCollectorResult(collectorResult.id);
  if (!claimed) {
    return true; // Claimed by another worker, but we should try next row
  }
  
  // 3. Process completely
  try {
    await this.processSingleResultCompletely(collectorResult, brandId, customerId, result);
    await this.markCollectorResultCompleted(collectorResult.id);
    return true; // Successfully processed
  } catch (error) {
    await this.markCollectorResultError(collectorResult.id, error.message);
    return true; // Processed (with error)
  }
}
```

### Method: `scoreBrand()` Restructure

**New loop structure:**

```typescript
async scoreBrand(options: ConsolidatedScoringOptions): Promise<ConsolidatedScoringResult> {
  const { brandId, customerId, since, limit = 50 } = options;
  
  const result: ConsolidatedScoringResult = {
    processed: 0,
    positionsProcessed: 0,
    sentimentsProcessed: 0,
    citationsProcessed: 0,
    errors: [],
  };
  
  let processedCount = 0;
  const maxIterations = limit;
  
  // One-at-a-time processing loop
  while (processedCount < maxIterations) {
    const processed = await this.processOneCollectorResult(brandId, customerId, result);
    
    if (!processed) {
      // No more rows to process
      break;
    }
    
    processedCount++;
  }
  
  return result;
}
```

---

## Considerations

### 1. **Performance Impact**

**Current (Batch):**
- 1 query to fetch 50 rows
- Process all 50
- Update all 50 at end

**New (One-at-a-Time):**
- 50 queries to fetch 50 rows (one at a time)
- Process one, update one, repeat

**Trade-off:**
- More database queries (50x more)
- But: Better multi-worker coordination
- But: Immediate status updates
- But: Better fault tolerance

### 2. **Query Efficiency**

**Optimization Options:**
- Use `LIMIT 1` with proper indexing on `scoring_status`
- Consider cursor-based pagination if needed
- Add index: `(brand_id, customer_id, scoring_status, created_at)`

### 3. **Infinite Loop Prevention**

**Safeguards:**
- Max iterations counter (use `limit` parameter)
- Break if no rows returned
- Break if all claims fail (no processable rows)

### 4. **Both Processing Paths**

**Ollama Path:**
- Already processes one-at-a-time (incremental)
- Just needs status updates integrated

**OpenRouter Path:**
- Currently batch processes (Step 1 all → Step 2 all → Step 3 all)
- Needs complete restructure to one-at-a-time

**Decision:**
- Apply one-at-a-time to BOTH paths for consistency
- Or: Keep Ollama one-at-a-time, make OpenRouter one-at-a-time too

---

## Implementation Checklist

### Files to Modify

1. **`consolidated-scoring.service.ts`**
   - [ ] Create `processOneCollectorResult()` method
   - [ ] Restructure `scoreBrand()` to use one-at-a-time loop
   - [ ] Add `claimCollectorResult()` method
   - [ ] Add `markCollectorResultCompleted()` method
   - [ ] Add `markCollectorResultError()` method
   - [ ] Modify query to fetch one row at a time
   - [ ] Add status filtering to query
   - [ ] Remove batch processing logic (or keep for backward compatibility)

### Processing Methods

- [ ] `processSingleResultCompletely()` - Process one result through all 3 steps
- [ ] Integrate status updates into processing flow
- [ ] Handle both Ollama and OpenRouter paths

### Testing

- [ ] Test single worker processing
- [ ] Test multi-worker coordination
- [ ] Test error handling
- [ ] Test status updates
- [ ] Test query filtering

---

## Questions for Approval

1. **Apply to Both Paths?**
   - Should one-at-a-time apply to BOTH Ollama and OpenRouter?
   - Or keep Ollama as-is (already incremental) and only change OpenRouter?

2. **Limit Parameter:**
   - Should `limit` parameter control max iterations in the loop?
   - Or should it be unlimited (process until no more rows)?

3. **Backward Compatibility:**
   - Remove batch processing entirely?
   - Or keep both options (feature flag)?

4. **Query Optimization:**
   - Add database index on `(brand_id, customer_id, scoring_status, created_at)`?
   - Or rely on existing indexes?

---

## Summary

### What We're Changing

1. **Query**: Fetch one row at a time instead of batch
2. **Processing**: Process one row completely before fetching next
3. **Status Updates**: Update status immediately after each row
4. **Loop Structure**: Replace batch loop with one-at-a-time loop

### Benefits

- ✅ Immediate status visibility
- ✅ Better multi-worker coordination
- ✅ Improved fault tolerance
- ✅ Simpler status management

### Trade-offs

- ⚠️ More database queries (but better coordination)
- ⚠️ Slightly slower overall (but more reliable)

---

## Next Steps

1. Review and approve this strategy
2. Confirm: Apply to both Ollama and OpenRouter paths?
3. Confirm: Limit parameter behavior?
4. Implement changes
5. Test with multiple workers

