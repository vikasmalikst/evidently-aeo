# BrightData Request Bundling - Analysis & Implementation Plan

## Overview
Currently, each query execution makes a separate API call to BrightData. This plan outlines how to bundle multiple prompts into a single API call, receive a large JSON response, and parse it according to prompt-wise mapping.

## Current State Analysis

### Current Implementation
- **Pattern**: One prompt → One API call → One response
- **Endpoint**: `/datasets/v3/trigger`
- **Request Format**:
  ```json
  {
    "input": [{
      "url": "https://chatgpt.com/",
      "prompt": "single prompt",
      "index": 1
    }]
  }
  ```
- **Response Format**: Returns `snapshot_id` immediately, then polling retrieves:
  ```json
  [
    {
      "url": "...",
      "prompt": "...",
      "answer_text": "...",
      "links_attached": [...],
      "citations": [...],
      "index": 1
    }
  ]
  ```

### Findings from Example JSON
- Response is an **array** of results
- Each array element corresponds to one input prompt
- Each element contains: `url`, `prompt`, `answer_text`, `links_attached`, `citations`, `references`
- The `index` field can be used to map responses back to original requests

## Bundling Strategy

### ✅ Feasibility: **YES - This is possible**

BrightData's `/trigger` endpoint already supports multiple inputs in the `input` array. Each input can have a unique `index` for mapping.

### Proposed Architecture

#### 1. Request Batching Layer
- **Component**: `BrightDataBatchService`
- **Location**: `brightdata/batch.service.ts`
- **Responsibility**:
  - Collect multiple prompts within a time window (e.g., 1-5 seconds)
  - Group prompts by collector type (ChatGPT, Gemini, etc.)
  - Build batch payload with indexed inputs
  - Track prompt-to-index mappings

#### 2. Modified Trigger Endpoint
- **Multi-input payload**:
  ```json
  {
    "input": [
      {
        "url": "https://chatgpt.com/",
        "prompt": "prompt 1",
        "country": "US",
        "index": 1
      },
      {
        "url": "https://chatgpt.com/",
        "prompt": "prompt 2",
        "country": "US",
        "index": 2
      },
      {
        "url": "https://gemini.google.com/",
        "prompt": "prompt 3",
        "index": 1
      }
    ]
  }
  ```

#### 3. Response Parsing Layer
- **Component**: Enhanced `BrightDataPollingService`
- **Changes**:
  - Handle array responses (multiple results)
  - Map each result back to original prompt using `index`
  - Extract answer/URLs per result
  - Update database with correct mapping

#### 4. Integration Points

**Option A: Automatic Batching (Recommended)**
- Queue requests for a short time window
- Automatically batch when:
  - Time window expires (e.g., 2-5 seconds)
  - Batch size reaches threshold (e.g., 10 prompts)
  - Manual flush is triggered

**Option B: Explicit Batch API**
- New endpoint: `executeBatchQueries(requests: BrightDataRequest[])`
- Caller explicitly groups requests
- Returns array of responses

## Implementation Plan

### Phase 1: Core Batching Infrastructure

#### 1.1 Create Batch Service
**File**: `brightdata/batch.service.ts`
```typescript
interface BatchRequest {
  request: BrightDataRequest;
  collectorType: string;
  datasetId: string;
  metadata: {
    queryId?: string;
    executionId?: string;
    brandId?: string;
    customerId?: string;
  };
}

interface BatchResult {
  index: number;
  request: BrightDataRequest;
  response?: BrightDataResponse;
  error?: Error;
}

class BrightDataBatchService {
  // Queue requests by collector type
  private queues: Map<string, BatchRequest[]> = new Map();
  private batchWindowMs: number = 3000; // 3 seconds
  private maxBatchSize: number = 10;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  async queueRequest(batchRequest: BatchRequest): Promise<BrightDataResponse>;
  private async flushBatch(collectorType: string): Promise<BatchResult[]>;
  private buildBatchPayload(requests: BatchRequest[]): any;
}
```

#### 1.2 Enhanced Polling Service
**File**: `brightdata/polling.service.ts` (modify existing)
```typescript
// New method to handle batch responses
async parseBatchResponse(
  snapshotId: string,
  datasetId: string,
  indexMapping: Map<number, BatchRequest>
): Promise<Map<number, BrightDataResponse>> {
  // Poll for snapshot
  // Parse array response
  // Map each result by index
  // Return Map<index, BrightDataResponse>
}
```

#### 1.3 Update Base Service
**File**: `brightdata/base.service.ts`
- Add method to determine if collector supports batching
- Configure batch size limits per collector type

### Phase 2: Integration with Priority Collector

#### 2.1 Modify Priority Collector Service
**File**: `priority-collector.service.ts`
- Add batching option to collector configuration
- Route BrightData requests through batch service when enabled
- Handle batch responses and map back to original query executions

#### 2.2 Update Data Collection Service
**File**: `data-collection.service.ts`
- Option to enable/disable batching via environment variable
- Configurable batch window and size
- Monitor batch performance metrics

### Phase 3: Response Parsing & Mapping

#### 3.1 Enhanced Response Parser
```typescript
interface ParsedBatchResponse {
  results: Map<number, {
    answer: string;
    urls: string[];
    citations: string[];
    metadata: any;
  }>;
  errors: Map<number, Error>;
}

function parseBatchSnapshotResponse(
  rawResponse: any[],
  indexMapping: Map<number, BatchRequest>
): ParsedBatchResponse {
  // Iterate through response array
  // Extract answer/URLs for each index
  // Map to original request
  // Handle missing or failed results
}
```

#### 3.2 Database Updates
- Update `collector_results` table for each result in batch
- Maintain correct `execution_id` mapping
- Handle partial failures gracefully

### Phase 4: Configuration & Monitoring

#### 4.1 Environment Variables
```env
BRIGHTDATA_BATCH_ENABLED=true
BRIGHTDATA_BATCH_WINDOW_MS=3000
BRIGHTDATA_BATCH_MAX_SIZE=10
BRIGHTDATA_BATCH_BY_COLLECTOR_TYPE=true
```

#### 4.2 Metrics & Logging
- Track batch sizes
- Monitor batch efficiency (requests per API call)
- Log batch processing times
- Alert on batch failures

## Benefits

### Performance
- **Reduced API Calls**: 10 prompts = 1 API call (vs 10 calls)
- **Lower Latency**: Single round-trip for multiple prompts
- **Rate Limit Efficiency**: Better utilization of API quotas

### Cost
- Potentially lower API costs (depending on BrightData pricing model)
- Reduced infrastructure overhead

### Reliability
- Atomic batch processing
- Better error handling for partial failures
- Consistent processing window

## Challenges & Considerations

### 1. Response Mapping
- **Challenge**: Ensuring correct mapping when `index` is missing or incorrect
- **Solution**: Maintain internal mapping in batch service, validate on parse

### 2. Partial Failures
- **Challenge**: One prompt fails in batch
- **Solution**: Return individual error per index, continue processing others

### 3. Timeout Handling
- **Challenge**: Batch timeout affects all requests
- **Solution**: Implement per-request timeout in addition to batch timeout

### 4. Collector Type Mixing
- **Challenge**: Different collectors may have different URLs/payloads
- **Solution**: Group by collector type, send separate batches per type

### 5. Async Polling Complexity
- **Challenge**: Batch snapshot polling needs to map multiple results
- **Solution**: Store index mapping with snapshot_id, parse on poll completion

### 6. Database Updates
- **Challenge**: Multiple results need individual database records
- **Solution**: Batch database operations, use transactions where possible

## Alternative Approaches

### Approach 1: Full Batching (Recommended)
- Queue all BrightData requests
- Batch every N seconds or M requests
- Process entire batch together

### Approach 2: Hybrid Mode
- Immediate execution for single requests
- Batching only for multiple concurrent requests
- Configurable threshold (e.g., >3 requests = batch)

### Approach 3: Scheduled Batching
- Collect requests in time windows (e.g., every 10 seconds)
- Process batches on schedule
- Good for predictable workloads

## Migration Strategy

### Step 1: Feature Flag
- Add `BRIGHTDATA_BATCH_ENABLED` environment variable
- Default to `false` (current behavior)

### Step 2: Parallel Implementation
- Build batch service alongside existing services
- Both paths available, toggle via config

### Step 3: Testing
- Test with small batches (2-3 prompts)
- Verify index mapping accuracy
- Test error scenarios

### Step 4: Gradual Rollout
- Enable for non-critical collectors first
- Monitor performance and errors
- Expand to all collectors

### Step 5: Optimization
- Tune batch window and size
- Optimize parsing logic
- Improve error handling

## Success Metrics

- **API Call Reduction**: Target 80%+ reduction in API calls
- **Latency**: Batch requests should have similar total latency
- **Error Rate**: Should not increase vs individual requests
- **Throughput**: Should handle more requests per second

## Next Steps (If Approved)

1. ✅ Review and approve this plan
2. Create detailed technical specifications
3. Implement Phase 1 (Core Batching Infrastructure)
4. Add comprehensive tests
5. Deploy with feature flag disabled
6. Enable for testing environment
7. Monitor and optimize
8. Enable for production (gradual rollout)

## Questions to Resolve

1. **Batch Size Limits**: What's the maximum number of prompts per batch?
2. **Time Window**: What's the optimal batching window (balance between latency and efficiency)?
3. **Error Handling**: Should one failure fail the entire batch or continue processing?
4. **Priority Handling**: How to handle priority requests that need immediate execution?
5. **Cross-Collector Batching**: Can we batch across different collector types (ChatGPT + Gemini)?

---

**Status**: Planning Phase
**Last Updated**: 2025-01-28
**Next Review**: After approval

