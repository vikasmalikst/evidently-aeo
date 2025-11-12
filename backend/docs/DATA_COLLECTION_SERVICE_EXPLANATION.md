# Data Collection Service - Complete Block-by-Block Explanation

## 📋 File Overview

**File:** `backend/src/services/data-collection.service.ts`  
**Purpose:** Orchestrates query execution across multiple AI collectors with priority-based fallback  
**Total Lines:** 683 lines

---

## 🗂️ Block 1: Imports and Setup (Lines 1-52)

```typescript
/**
 * Data Collection Service
 * Orchestrates query execution across multiple collectors
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';
import { oxylabsCollectorService } from './oxylabs-collector.service';
import { dataForSeoCollectorService } from './dataforseo-collector.service';
import { priorityCollectorService, PriorityExecutionResult } from './priority-collector.service';
```

**What it does:**
- Imports Supabase client for database operations
- Imports environment variable utilities
- Imports individual collector services (Oxylabs, DataForSEO)
- Imports priority collector service (handles fallback logic)

```typescript
// Load environment variables
loadEnvironment();

// Initialize Supabase client
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey, {...});
```

**What it does:**
- Loads environment variables
- Initializes Supabase client with service role key (bypasses RLS)
- Creates global Supabase instance for this module

---

## 📊 Block 2: TypeScript Interfaces (Lines 28-61)

### Interface 1: QueryExecutionRequest (Lines 28-37)
```typescript
export interface QueryExecutionRequest {
  queryId: string;
  brandId: string;
  customerId: string;
  queryText: string;
  intent: string;
  locale: string;
  country: string;
  collectors: string[];
}
```

**Purpose:** Defines input structure for query execution
- **queryId:** Unique identifier for the query
- **brandId:** Brand context
- **customerId:** Multi-tenant isolation
- **queryText:** The actual query text
- **intent:** Query intent (awareness, comparison, purchase, support)
- **locale/country:** Geographic context
- **collectors:** Which collectors to use (e.g., ['chatgpt', 'google_aio'])

### Interface 2: CollectorResult (Lines 39-52)
```typescript
export interface CollectorResult {
  queryId: string;
  executionId: string;
  collectorType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  response?: string;
  citations?: string[];
  urls?: string[];
  error?: string;
  executionTimeMs?: number;
  metadata?: any;
  brandId?: string;
  customerId?: string;
}
```

**Purpose:** Defines output structure from collectors
- **status:** Query execution state
- **response:** AI-generated answer
- **citations:** References used
- **urls:** Source URLs
- **metadata:** Additional data (provider, fallback chain, etc.)

### Interface 3: CollectorConfig (Lines 54-61)
```typescript
export interface CollectorConfig {
  name: string;
  enabled: boolean;
  baseUrl: string;
  timeout: number;
  retries: number;
  priority: number;
}
```

**Purpose:** Configuration for each collector
- **enabled:** Whether to use this collector
- **baseUrl:** Which service to use ('priority', 'oxylabs', 'dataforseo')
- **timeout:** Maximum wait time (ms)
- **retries:** How many retry attempts
- **priority:** Execution priority

---

## 🏗️ Block 3: Class Declaration and Constructor (Lines 63-82)

```typescript
export class DataCollectionService {
  private collectors: Map<string, CollectorConfig> = new Map();
  private supabase: any;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = getEnvVar('SUPABASE_URL');
    const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(...);
    
    this.initializeCollectors();
  }
}
```

**What it does:**
- Creates a class instance
- Maintains a **Map** of collectors (key-value store)
- Creates separate Supabase instance (different from module-level one)
- Calls `initializeCollectors()` to set up all collectors

**Why separate Supabase instances?**
- Module-level: Used in static functions
- Instance-level: Used in class methods

---

## ⚙️ Block 4: Collector Initialization (Lines 100-172)

```typescript
private initializeCollectors() {
  // ChatGPT Collector
  this.collectors.set('chatgpt', {
    name: 'ChatGPT Collector',
    enabled: true,
    baseUrl: 'priority',        // Uses priority fallback
    timeout: 30000,             // 30 seconds
    retries: 1,
    priority: 1                 // Highest priority
  });
  
  // Google AIO Collector
  this.collectors.set('google_aio', {
    name: 'Google AIO Collector',
    enabled: true,
    baseUrl: 'oxylabs',         // Direct Oxylabs
    timeout: 45000,             // 45 seconds
    retries: 2,
    priority: 2
  });
  
  // ... (6 more collectors)
}
```

**What it does:**
Registers 7 collectors:
1. **ChatGPT** - Priority fallback (Oxylabs → BrightData → OpenAI)
2. **Google AIO** - Direct Oxylabs
3. **Perplexity** - Direct Oxylabs
4. **Claude** - Priority fallback (DataForSEO → Anthropic → Oxylabs)
5. **Baidu** - DataForSEO
6. **Bing** - DataForSEO
7. **Gemini** - Priority fallback

**Configuration Details:**
- **baseUrl='priority'**: Uses priority-collector.service.ts (fallback logic)
- **baseUrl='oxylabs'**: Direct Oxylabs API call
- **baseUrl='dataforseo'**: Direct DataForSEO API call

---

## 🚀 Block 5: Main Execution Method (Lines 174-219)

### executeQueries() - The Orchestrator

```typescript
async executeQueries(requests: QueryExecutionRequest[]): Promise<CollectorResult[]> {
  const results: CollectorResult[] = [];
  const BATCH_SIZE = 3; // Process 3 queries at a time
```

**Entry Point:** Called from route with array of query requests

**Batching Strategy:**
```typescript
for (let i = 0; i < requests.length; i += BATCH_SIZE) {
  const batch = requests.slice(i, i + BATCH_SIZE);
```

**Process:**
1. Take 3 queries at a time
2. Process ALL 3 in parallel (Promise.all)
3. Wait for all 3 to complete
4. Move to next batch of 3
5. 1-second delay between batches

**Parallel Execution:**
```typescript
const batchPromises = batch.map(async (request, batchIndex) => {
  const executionId = await this.createQueryExecution(request);
  const collectorResults = await this.executeQueryAcrossCollectors(request, executionId);
  return collectorResults;
});

const batchResults = await Promise.all(batchPromises); // ⚡ PARALLEL
```

**Flow for 6 queries:**
```
Batch 1: Q1, Q2, Q3 → Execute all 3 in parallel
   ↓ ↓ ↓
Collectors for Q1: [ChatGPT, Google, Perplexity, Claude] → All 4 in parallel
Collectors for Q2: [ChatGPT, Google, Perplexity, Claude] → All 4 in parallel  
Collectors for Q3: [ChatGPT, Google, Perplexity, Claude] → All 4 in parallel

Wait 1 second

Batch 2: Q4, Q5, Q6 → Execute all 3 in parallel
   ↓ ↓ ↓
... same pattern
```

**Performance:**
- With 6 queries and 4 collectors:
- **Sequential would be:** 6 × 4 × 30s = 720 seconds (12 minutes)
- **With batching:** 2 batches × 30s + 1s delay = ~61 seconds ⚡

---

## 📝 Block 6: Database Execution Record (Lines 221-248)

```typescript
private async createQueryExecution(request: QueryExecutionRequest): Promise<string> {
  const { data, error } = await supabase
    .from('query_executions')
    .insert({
      query_id: request.queryId,
      brand_id: request.brandId,
      customer_id: request.customerId,
      collector_type: 'ChatGPT',        // Placeholder
      status: 'pending',
      metadata: {
        intent: request.intent,
        locale: request.locale,
        country: request.country,
        collectors: request.collectors
      }
    })
    .select('id')
    .single();
```

**Purpose:** Creates execution tracking record BEFORE running collectors

**Why before?**
- Tracks execution history
- Allows status checking during execution
- Provides audit trail

**Returns:** executionId (UUID) used to track this specific execution

---

## 🔄 Block 7: Multi-Collector Execution (Lines 250-304)

```typescript
private async executeQueryAcrossCollectors(
  request: QueryExecutionRequest, 
  executionId: string
): Promise<CollectorResult[]> {
  const results: CollectorResult[] = [];
  const enabledCollectors = request.collectors.filter(collector => 
    this.collectors.get(collector)?.enabled
  );
```

**Step 1: Filter Enabled Collectors**
- Removes disabled collectors from the list
- Example: `['chatgpt', 'google_aio', 'disabled_collector']` → `['chatgpt', 'google_aio']`

**Step 2: Execute All Collectors in Parallel**
```typescript
const promises = enabledCollectors.map(collectorType => 
  this.executeWithPriorityFallback(request, executionId, collectorType)
);

const collectorResults = await Promise.allSettled(promises);
```

**What happens:**
- ChatGPT starts executing (fallback chain begins)
- Google AIO starts executing (simultaneously)
- Perplexity starts executing (simultaneously)
- Claude starts executing (simultaneously)
- ALL run concurrently

**Step 3: Process Results**
```typescript
collectorResults.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    // Success: Add result
    results.push({...priorityResult});
  } else {
    // Failure: Add error
    results.push({
      status: 'failed',
      error: result.reason?.message
    });
  }
});
```

**Promise.allSettled() benefits:**
- Even if one collector fails, others continue
- No crashes on individual failures
- Returns results for ALL collectors

---

## 🎯 Block 8: Priority Fallback Execution (Lines 306-374)

```typescript
private async executeWithPriorityFallback(
  request: QueryExecutionRequest,
  executionId: string,
  collectorType: string
): Promise<PriorityExecutionResult> {
```

**This is called for EACH collector type**

**Step 1: Update Status**
```typescript
await this.updateExecutionStatus(executionId, collectorType, 'running');
```

**Step 2: Delegate to Priority Service**
```typescript
const result = await priorityCollectorService.executeWithPriorityFallback(
  request.queryId,
  executionId,
  collectorType,
  request.queryText,
  request.brandId,
  request.customerId,
  request.locale,
  request.country
);
```

**What priority service does:**
For ChatGPT:
1. Try Oxylabs (30s timeout)
2. If fails → Try BrightData (30s timeout)
3. If fails → Try OpenAI Direct (30s timeout)
4. Return first successful result

For Claude:
1. Try DataForSEO (60s timeout)
2. If fails → Try Anthropic Direct (60s timeout)
3. If fails → Try Oxylabs (60s timeout)

**Step 3: Store Result**
```typescript
if (result.status === 'completed') {
  await this.storeCollectorResult({...result});
}
```

**Step 4: Update Status**
```typescript
if (result.status === 'completed') {
  // Already stored above
} else {
  await this.updateExecutionStatus(executionId, collectorType, 'failed', result.error);
}
```

---

## 🗄️ Block 9: Database Updates (Lines 490-618)

### updateExecutionStatus() (Lines 490-514)

```typescript
private async updateExecutionStatus(
  executionId: string, 
  collectorType: string, 
  status: string, 
  errorMessage?: string
): Promise<void> {
  const mappedCollectorType = this.mapCollectorTypeToDatabase(collectorType);
  
  await supabase
    .from('query_executions')
    .update({
      collector_type: mappedCollectorType,
      status,
      error_message: errorMessage,
      executed_at: new Date().toISOString()
    })
    .eq('id', executionId);
}
```

**Purpose:** Updates execution record as collectors run
- Status changes: pending → running → completed/failed
- Tracks which collector succeeded
- Records errors

### storeCollectorResult() (Lines 516-618)

```typescript
private async storeCollectorResult(result: CollectorResult): Promise<void> {
  // Get brand name for context
  let brandName = null;
  if (result.brandId) {
    const { data: brandData } = await this.supabase
      .from('brands')
      .select('name')
      .eq('id', result.brandId)
      .single();
    brandName = brandData.name;
  }
```

**Step 1: Fetch Brand Context**
- Retrieves brand name for better data tracking

**Step 2: Prepare Insert Data**
```typescript
const insertData = {
  query_id: result.queryId,
  collector_type: 'ChatGPT',  // Mapped name
  raw_answer: result.response,
  citations: result.citations,
  urls: result.urls,
  brand: brandName,
  metadata: {
    ...result.metadata,
    execution_time_ms: result.executionTimeMs,
    status: result.status
  }
};
```

**Step 3: Add Multi-tenant Fields**
```typescript
if (result.brandId) {
  insertData.brand_id = result.brandId;
}
if (result.customerId) {
  insertData.customer_id = result.customerId;
}
```

**Why important?**
- Enables RLS (Row Level Security) in Supabase
- Each customer can only see their own data
- Isolates data per tenant

**Step 4: Insert with Error Handling**
```typescript
const { data, error } = await supabase
  .from('collector_results')
  .insert(insertData)
  .select();

if (error) {
  // Retry without execution_id if column doesn't exist
  if (error.code === 'PGRST204' && result.executionId) {
    // Retry logic...
  }
}
```

**Handles schema evolution:**
- If `execution_id` column doesn't exist, stores it in metadata instead
- Backward compatible with older schema versions

---

## 🔍 Block 10: Query Utilities (Lines 620-652)

### getExecutionStatus() (Lines 622-635)

```typescript
async getExecutionStatus(executionId: string): Promise<any> {
  const { data, error } = await supabase
    .from('query_executions')
    .select('*')
    .eq('id', executionId)
    .single();
```

**Purpose:** Allows frontend to check progress
- Returns status, error messages, execution time
- Used by status polling endpoints

### getQueryResults() (Lines 637-652)

```typescript
async getQueryResults(queryId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('collector_results')
    .select('*')
    .eq('query_id', queryId)
    .order('created_at', { ascending: false });
```

**Purpose:** Retrieves all results for a query across collectors
- Returns array of collector results
- Sorted by creation time (newest first)
- Used to show results page

---

## 💚 Block 11: Health Checks (Lines 654-679)

### checkCollectorHealth() (Lines 656-666)

```typescript
async checkCollectorHealth(collectorType: string): Promise<boolean> {
  const healthStatus = await priorityCollectorService.checkCollectorHealth(collectorType);
  return Object.values(healthStatus).some(status => status === true);
}
```

**Purpose:** Tests if collector is operational
- Checks all providers in fallback chain
- Returns true if ANY provider is healthy
- Used by monitoring/dashboards

### getAllCollectorHealth() (Lines 668-679)

```typescript
async getAllCollectorHealth(): Promise<Record<string, boolean>> {
  const healthStatus: Record<string, boolean> = {};
  
  for (const [collectorType] of this.collectors) {
    healthStatus[collectorType] = await this.checkCollectorHealth(collectorType);
  }
  
  return healthStatus;
}
```

**Purpose:** Health check for ALL collectors
- Returns map: `{ chatgpt: true, google_aio: false, ... }`
- Used by admin dashboard
- Shows which collectors are down

---

## 🔧 Block 12: Helper Methods (Lines 84-98)

### mapCollectorTypeToDatabase()

```typescript
private mapCollectorTypeToDatabase(collectorType: string): string {
  const mapping: { [key: string]: string } = {
    'chatgpt': 'ChatGPT',
    'google_aio': 'Google AIO',
    'perplexity': 'Perplexity',
    'claude': 'Claude',
    'baidu': 'Baidu',
    'bing': 'Bing',
    'gemini': 'Gemini'
  };
  return mapping[collectorType] || collectorType;
}
```

**Purpose:** Normalizes collector names
- Internal format: `'chatgpt'` (lowercase, underscored)
- Database format: `'ChatGPT'` (proper case)
- Consistent naming in database

---

## 📊 Complete Execution Flow Example

### Input:
```json
{
  "queryText": "What is Nike's return policy?",
  "collectors": ["chatgpt", "google_aio", "perplexity"],
  "brandId": "abc-123",
  "customerId": "xyz-456"
}
```

### Process:

**1. executeQueries() called**
- Batch 1: Process 1 query
- queryText = "What is Nike's return policy?"
- collectors = ['chatgpt', 'google_aio', 'perplexity']

**2. createQueryExecution()**
- Creates DB record: id = "exec-789", status = 'pending'

**3. executeQueryAcrossCollectors()**
- 3 collectors enabled
- All 3 start in parallel

**4. executeWithPriorityFallback() for ChatGPT**
- priorityCollectorService.executeWithPriorityFallback('chatgpt', ...)
- Try Oxylabs → Success
- Returns: "Nike offers a 60-day return policy..."
- storeCollectorResult() saves to database

**5. executeWithPriorityFallback() for Google AIO**
- Oxylabs Google AIO
- Returns: "Nike's return policy is 60 days..."
- storeCollectorResult() saves to database

**6. executeWithPriorityFallback() for Perplexity**
- Oxylabs Perplexity
- Returns: "According to Nike's website..."
- storeCollectorResult() saves to database

**7. Collect Results**
```json
[
  {
    "collectorType": "chatgpt",
    "status": "completed",
    "response": "Nike offers a 60-day return policy...",
    "executionTimeMs": 2500
  },
  {
    "collectorType": "google_aio",
    "status": "completed",
    "response": "Nike's return policy is 60 days...",
    "executionTimeMs": 3200
  },
  {
    "collectorType": "perplexity",
    "status": "completed",
    "response": "According to Nike's website...",
    "executionTimeMs": 4100
  }
]
```

**8. Return to Route**
- Returns aggregated results
- Frontend displays all collector responses

---

## 🎯 Key Design Patterns

### 1. **Parallelism**
- Multiple queries: Process in batches of 3 in parallel
- Multiple collectors: All execute simultaneously per query
- Performance optimization

### 2. **Fallback Resilience**
- Each collector has 2-3 providers
- If primary fails, tries secondary
- Guarantees best effort execution

### 3. **Error Isolation**
- One collector failure doesn't stop others
- Uses Promise.allSettled() for graceful failures
- Detailed error logging

### 4. **Multi-Tenant Security**
- Always passes brand_id and customer_id
- RLS policies ensure data isolation
- No cross-tenant data leaks

### 5. **Database Tracking**
- Execution records track progress
- Result records store responses
- Audit trail for debugging

---

## 📈 Performance Characteristics

### Time Complexity
- Single query, N collectors: O(N) in parallel
- K queries, N collectors: O(K × N) in parallel (batched)

### Space Complexity
- Stores results in memory during execution
- Clears batch results after processing
- Minimal memory footprint

### Network Characteristics
- Concurrent API calls (no sequential waiting)
- 30-60s timeouts per collector
- Aggressive retries for reliability

This service is the **orchestration brain** of the data collection system, coordinating parallel execution with robust error handling! 🎯
