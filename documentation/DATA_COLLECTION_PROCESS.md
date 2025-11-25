# Data Collection Process Documentation

## Overview

The data collection service orchestrates query execution across multiple AI model collectors (ChatGPT, Google AIO, Perplexity, Claude, Gemini, Grok, Bing Copilot, etc.) with batching and concurrent execution to optimize performance and reliability.

## Architecture

### Two-Level Execution Model

1. **Query-Level Batching**: Multiple queries are processed in batches
2. **Collector-Level Concurrency**: Within each query, collectors execute concurrently

---

## 1. Query-Level Batching

### How It Works

Queries are processed in **batches of 3** to avoid overwhelming APIs and maintain system stability.

```typescript
const BATCH_SIZE = 3; // Process 3 queries at a time
```

### Process Flow

1. **Batch Creation**: Queries are divided into batches of 3
   - Batch 1: Queries 1-3
   - Batch 2: Queries 4-6
   - Batch 3: Queries 7-9
   - And so on...

2. **Sequential Batch Processing**: Each batch is processed sequentially
   - All queries in a batch execute concurrently
   - System waits for batch completion before starting next batch
   - 1-second pause between batches to be "nice" to APIs

3. **Batch Execution**:
   ```typescript
   for (let i = 0; i < requests.length; i += BATCH_SIZE) {
     const batch = requests.slice(i, i + BATCH_SIZE);
     const batchPromises = batch.map(request => 
       executeQueryAcrossCollectorsWithRetry(request)
     );
     await Promise.all(batchPromises);
   }
   ```

### Benefits

- **Rate Limiting**: Prevents API rate limit violations
- **Resource Management**: Controls memory and connection usage
- **Error Isolation**: Failures in one batch don't affect others
- **Progress Tracking**: Clear visibility into batch progress

---

## 2. Collector-Level Concurrency

### How It Works

Within each query, **all enabled collectors execute concurrently** using `Promise.allSettled()`.

### Process Flow

1. **Collector Discovery**: System identifies enabled collectors for the query
   ```typescript
   const enabledCollectors = request.collectors.filter(collector => 
     this.collectors.get(collector)?.enabled
   );
   ```

2. **Concurrent Execution**: All collectors start simultaneously
   ```typescript
   const promises = enabledCollectors.map(async collectorType => {
     return await executeWithPriorityFallback(request, collectorType);
   });
   
   const collectorResults = await Promise.allSettled(promises);
   ```

3. **Independent Execution**: Each collector:
   - Creates its own execution record in `query_executions` table
   - Runs independently with its own timeout and retry logic
   - Stores results separately in `collector_results` table

### Key Features

#### Promise.allSettled() Benefits

- **Fault Tolerance**: If one collector fails, others continue
- **No Blocking**: Slow collectors don't block fast ones
- **Complete Results**: All collector results are captured, regardless of individual failures

#### Example Scenario

For a query with 3 collectors (ChatGPT, Perplexity, Claude):

```
Query: "What is AI?"
├── ChatGPT Collector ──┐
├── Perplexity Collector├──> Execute concurrently
└── Claude Collector ────┘
    │
    ├── ChatGPT: ✅ Completed (2.3s)
    ├── Perplexity: ✅ Completed (4.1s)
    └── Claude: ❌ Failed (timeout)
    
Result: 2 successful, 1 failed (all tracked)
```

---

## 3. Priority-Based Fallback (Within Collectors)

### How It Works

Each collector can have multiple **providers** that are tried sequentially with priority-based fallback.

### Process Flow

1. **Provider Priority**: Providers are sorted by priority (ascending)
   ```typescript
   const sortedProviders = config.providers
     .filter(provider => provider.enabled)
     .sort((a, b) => a.priority - b.priority);
   ```

2. **Sequential Fallback**: Try providers in order until one succeeds
   ```typescript
   for (const provider of sortedProviders) {
     try {
       const result = await executeWithProvider(provider);
       return result; // Success - stop trying
     } catch (error) {
       // Continue to next provider if fallback enabled
       if (!provider.fallback_on_failure) break;
     }
   }
   ```

### Example: ChatGPT Collector

```
ChatGPT Collector
├── Provider 1: Oxylabs ChatGPT (priority 1)
│   └── ❌ Failed → Fallback enabled
├── Provider 2: OpenAI Direct (priority 2)
│   └── ✅ Success → Stop
└── Provider 3: BrightData ChatGPT (priority 3)
    └── (Not tried - previous succeeded)
```

---

## 4. Complete Execution Flow

### End-to-End Process

```
1. Receive Query Requests
   │
   ├─> [Batch 1: Queries 1-3]
   │   │
   │   ├─> Query 1
   │   │   ├─> ChatGPT Collector (concurrent)
   │   │   │   ├─> Oxylabs → ✅ Success
   │   │   ├─> Perplexity Collector (concurrent)
   │   │   │   ├─> Oxylabs → ✅ Success
   │   │   └─> Claude Collector (concurrent)
   │   │       └─> OpenRouter → ✅ Success
   │   │
   │   ├─> Query 2 (concurrent with Query 1)
   │   │   └─> [Similar process]
   │   │
   │   └─> Query 3 (concurrent with Query 1 & 2)
   │       └─> [Similar process]
   │
   ├─> Wait 1 second
   │
   └─> [Batch 2: Queries 4-6]
       └─> [Repeat process]
```

### Timeline Visualization

```
Time →
Batch 1:  [Q1: C1, C2, C3] [Q2: C1, C2] [Q3: C1, C2, C3]
          └─────────────────────────────────────────────┘
          All queries in batch execute concurrently
          All collectors per query execute concurrently
          
          ⏸️ 1 second pause
          
Batch 2:  [Q4: C1, C2] [Q5: C1, C2, C3] [Q6: C1]
          └──────────────────────────────────────┘
```

---

## 5. Error Handling & Resilience

### Retry Mechanism

- **Query-Level Retries**: Up to 2 retries with exponential backoff
- **Provider-Level Retries**: Configurable per provider (typically 1-2 retries)
- **Circuit Breaker**: Prevents repeated failures from overwhelming system

### Error Isolation

- **Batch Level**: One batch failure doesn't stop other batches
- **Query Level**: One query failure doesn't stop other queries in batch
- **Collector Level**: One collector failure doesn't stop other collectors
- **Provider Level**: One provider failure triggers fallback to next provider

### Result Tracking

All results (successful and failed) are tracked:
- **query_executions**: Execution records per collector
- **collector_results**: Final results with responses, citations, URLs
- **Error Metadata**: Detailed error information for debugging

---

## 6. Configuration

### Batch Size

```typescript
const BATCH_SIZE = 3; // Configurable
```

### Collector Configuration

Each collector has:
- **Timeout**: Per-collector timeout (30s - 5min depending on collector)
- **Retries**: Number of retry attempts
- **Priority**: Execution priority
- **Enabled/Disabled**: Toggle collector on/off

### System Configuration

```typescript
{
  max_concurrent_collectors: 3,
  default_timeout: 60000,
  default_retries: 2,
  fallback_enabled: true,
  async_execution: true,
  batch_size: 3
}
```

---

## 7. Performance Characteristics

### Throughput

- **Queries per Batch**: 3
- **Collectors per Query**: Typically 2-5 (varies by brand configuration)
- **Concurrent Executions**: Up to 15 (3 queries × 5 collectors)

### Latency

- **Batch Processing**: Sequential (one batch at a time)
- **Query Processing**: Concurrent within batch
- **Collector Processing**: Concurrent within query
- **Provider Fallback**: Sequential (try next on failure)

### Resource Usage

- **Memory**: Controlled by batch size
- **Network Connections**: Limited by concurrent collectors
- **API Rate Limits**: Managed by batching and delays

---

## 8. Database Schema

### query_executions

Tracks execution status for each collector per query:
- `query_id`: Reference to generated query
- `collector_type`: Which collector (ChatGPT, Perplexity, etc.)
- `status`: pending → running → completed/failed
- `execution_id`: Unique execution identifier

### collector_results

Stores final results from each collector:
- `query_id`: Reference to generated query
- `collector_type`: Which collector
- `raw_answer`: Response text
- `citations`: Extracted citations
- `urls`: Source URLs
- `collection_time_ms`: Execution time
- `metadata`: Additional execution details

---

## Summary

The data collection process uses a **two-level concurrency model**:

1. **Batching**: Queries processed in batches of 3 sequentially
2. **Concurrency**: Within each batch, queries execute concurrently; within each query, collectors execute concurrently

This design balances:
- ✅ **Performance**: Concurrent execution maximizes throughput
- ✅ **Reliability**: Batching prevents API overload
- ✅ **Resilience**: Fault isolation at multiple levels
- ✅ **Scalability**: Configurable batch sizes and timeouts


