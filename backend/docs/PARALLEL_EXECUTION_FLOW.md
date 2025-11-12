# Query Execution Flow - Parallel Processing

## ✅ YES - Queries are sent to collectors in PARALLEL

### 📊 Execution Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                   Query Execution Flow                       │
└─────────────────────────────────────────────────────────────┘

QUERIES (Processed in batches of 3)
┌─────┬─────┬─────┐  ┌─────┬─────┬─────┐  ┌─────┬─────┐
│ Q1  │ Q2  │ Q3  │  │ Q4  │ Q5  │ Q6  │  │ Q7  │ Q8  │ ...
└─────┴─────┴─────┘  └─────┴─────┴─────┘  └─────┴─────┘
   ↓      ↓     ↓       ↓      ↓     ↓      ↓      ↓
   └──────┴─────┴───────┴──────┴─────┴──────┴──────┘
         Parallel (Promise.all within batch)

FOR EACH QUERY (e.g., Q1):
┌─────────────────────────────────────────────┐
│            Query 1                          │
└─────────────────────────────────────────────┘
    ↓         ↓         ↓         ↓
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│ChatGPT│ │ Google│ │ Perplex│ │Claude│ ... (7 collectors)
│       │ │ AIO   │ │ity     │ │      │
└───────┘ └───────┘ └───────┘ └───────┘
    ↓         ↓         ↓         ↓
Promise.allSettled() - ALL RUN IN PARALLEL
```

---

## 🔍 Code Flow Explanation

### Step 1: Query Batching (Lines 178-219 in data-collection.service.ts)

```typescript
async executeQueries(requests: QueryExecutionRequest[]) {
  const BATCH_SIZE = 3; // Process 3 queries at a time
  
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const batch = requests.slice(i, i + BATCH_SIZE);
    
    // ✅ PARALLEL: All queries in batch execute simultaneously
    const batchPromises = batch.map(async (request) => {
      // Execute query across collectors
      return await this.executeQueryAcrossCollectors(request, executionId);
    });
    
    const batchResults = await Promise.all(batchPromises); // ⚡ WAITS FOR ALL
    results.push(...batchResults.flat());
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

**What Happens:**
- Queries 1, 2, 3 execute **in parallel** (Promise.all)
- Then queries 4, 5, 6 execute in parallel
- Then queries 7, 8, 9 execute in parallel
- Small 1-second pause between batches to avoid API overload

---

### Step 2: Per-Query Collector Execution (Lines 253-304)

```typescript
private async executeQueryAcrossCollectors(request, executionId) {
  const enabledCollectors = ['chatgpt', 'google_aio', 'perplexity', 'claude', ...];
  
  // ✅ PARALLEL: All collectors for this query execute simultaneously
  const promises = enabledCollectors.map(collectorType => 
    this.executeWithPriorityFallback(request, executionId, collectorType)
  );
  
  // ⚡ ALL COLLECTORS RUN IN PARALLEL (Promise.allSettled)
  const collectorResults = await Promise.allSettled(promises);
  
  return collectorResults;
}
```

**What Happens for EACH Query:**
1. If you specify: `['chatgpt', 'google_aio', 'perplexity', 'claude']`
2. All 4 collectors execute **simultaneously**
3. ChatGPT starts immediately
4. Google AIO starts immediately (at the same time)
5. Perplexity starts immediately (at the same time)
6. Claude starts immediately (at the same time)

**Not Sequential:** ❌ ChatGPT finishes → then Google AIO → then Perplexity
**Parallel:** ✅ All 4 start at once and run concurrently

---

## 🎯 Real Example

### Scenario: Execute 2 Queries with 4 Collectors

```
Time 0s:
├─ Query 1 → ChatGPT     ⚡ (starts)
│            Google AIO  ⚡ (starts)
│            Perplexity  ⚡ (starts)
│            Claude      ⚡ (starts)
│
└─ Query 2 → ChatGPT     ⚡ (starts)
              Google AIO  ⚡ (starts)
              Perplexity  ⚡ (starts)
              Claude      ⚡ (starts)

All 8 operations (2 queries × 4 collectors) are RUNNING IN PARALLEL

Time 10s:
✅ ChatGPT for Query 1 completes
✅ Google AIO for Query 1 completes  
⏳ Perplexity for Query 1 still running...
⏳ Claude for Query 1 still running...
✅ ChatGPT for Query 2 completes
✅ Google AIO for Query 2 completes
⏳ Perplexity for Query 2 still running...
⏳ Claude for Query 2 still running...
```

---

## 🔑 Key Points

### 1. **Parallel Query Processing**
- Up to **3 queries** processed in parallel per batch
- Each batch waits for all queries to complete
- 1-second delay between batches

### 2. **Parallel Collector Execution**
- **ALL collectors** for a single query run **simultaneously**
- Uses `Promise.allSettled()` so failures don't stop others
- Each collector has its own fallback chain (handled internally)

### 3. **Collector Fallback Chains** (Still Sequential)
Within each collector, fallback happens **sequentially**:
```typescript
// ChatGPT Collector
1. Try Oxylabs (priority 1)      ← Wait for success/failure
2. Try BrightData (priority 2)   ← Wait for success/failure
3. Try OpenAI Direct (priority 3) ← Wait for success/failure
```

But if you're running **multiple collectors**, they all execute **in parallel**:
```typescript
// Query 1
ChatGPT fallback chain    → Running in parallel
Google AIO fallback chain → Running in parallel  
Perplexity fallback chain → Running in parallel
Claude fallback chain    → Running in parallel
```

---

## 📊 Performance Impact

### Sequential Execution (Current Implementation)
If you have:
- **2 queries**
- **4 collectors** (chatgpt, google_aio, perplexity, claude)
- Each collector takes **30 seconds**

**Sequential:** 2 × 4 × 30 = **240 seconds** (4 minutes)
**Parallel:** max(30, 30, 30, 30) = **30 seconds** per batch

### Your Implementation
With batches of 3 and parallel collectors:
- **3 queries** in parallel
- Each query runs **4 collectors** in parallel
- That's **12 operations** running simultaneously!

**For 24 queries:**
- Sequential: 24 × 4 × 30 = **48 minutes**
- Your implementation: 24 ÷ 3 batches = 8 batches × 30s = **~4 minutes** ⚡

---

## 🛠️ Configuration

### Batch Size (Line 180)
```typescript
const BATCH_SIZE = 3; // Process 3 queries at a time
```
- Increase for more parallelism (faster but heavier API load)
- Decrease for lighter API load (slower but safer)

### Collector Timeouts (Lines 106-169)
```typescript
'chatgpt': { timeout: 30000 },    // 30s
'google_aio': { timeout: 45000 },   // 45s
'perplexity': { timeout: 60000 },  // 60s
'claude': { timeout: 60000 }      // 60s
```
- Parallel execution means longest timeout wins per batch

---

## 🎯 Summary

**YES, queries are sent to collectors in PARALLEL**

1. ✅ **Multiple queries** (up to 3) execute **in parallel**
2. ✅ **Multiple collectors per query** execute **in parallel**
3. ❌ **Fallback chains within a collector** are sequential (by design)
4. ⚡ **Result:** Fast execution time even with multiple queries and collectors

The system is optimized for **maximum throughput** while respecting API rate limits!
