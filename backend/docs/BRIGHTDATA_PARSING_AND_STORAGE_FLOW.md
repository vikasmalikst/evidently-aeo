# BrightData Response Parsing and Storage Flow

## Overview
This document explains how BrightData responses are parsed and stored when received in real-time or via polling.

## Response Flow

### 1. **BrightData API Call** (`brightdata-collector.service.ts`)

BrightData can return responses in two ways:

#### A. **Real-time Response (Status 200)**
```typescript
// Lines 91-136: Immediate response
if (response.ok) {
  const result = await response.json();
  const responseData = Array.isArray(result) ? result : (result.data || []);
  
  // Parse response
  const answer = responseData[0]?.answer || 'No response';
  const citations = responseData[0]?.citations || [];
  const urls = responseData[0]?.urls || [];
  
  // Return BrightDataResponse
  return {
    answer,
    citations,
    urls,
    metadata: { ... }
  };
}
```

#### B. **Async Response with Polling (Status 202)**
```typescript
// Lines 292-302: Async response with snapshot_id
if (response.status === 202) {
  const result = await response.json();
  const snapshotId = result.snapshot_id;
  
  // Poll for results
  return await this.pollForSnapshot(snapshotId, 'grok', datasetId, request);
}
```

### 2. **Polling for Snapshot Results** (`brightdata-collector.service.ts`)

When BrightData returns a `snapshot_id`, we poll the snapshot endpoint:

```typescript
// Lines 394-582: pollForSnapshot method
private async pollForSnapshot(
  snapshotId: string, 
  collectorType: string, 
  datasetId: string, 
  request: BrightDataRequest
): Promise<BrightDataResponse> {
  
  // Poll up to 60 times with 10-second intervals
  for (let attempt = 1; attempt <= 60; attempt++) {
    const response = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`
    );
    
    const downloadResult = await response.json();
    
    // Check if data is ready
    if (downloadResult.answer_text || downloadResult.answer_section_html) {
      // Parse answer (prefer answer_text, fallback to answer_section_html)
      let answer = downloadResult.answer_text || '';
      if (!answer && downloadResult.answer_section_html) {
        // Extract text from HTML
        answer = downloadResult.answer_section_html
          .replace(/<[^>]*>/g, '')
          .trim();
      }
      
      // Extract URLs/citations from multiple possible fields
      let urls = [];
      const sources = downloadResult.sources || 
                     downloadResult.citations || 
                     downloadResult.urls || 
                     downloadResult.links || [];
      
      // Extract URLs from sources array
      urls = sources.map(s => {
        if (typeof s === 'string') return s;
        if (typeof s === 'object' && s.url) return s.url;
        return String(s);
      }).filter(url => url.startsWith('http'));
      
      // If no URLs found, extract from answer text
      if (urls.length === 0) {
        const urlRegex = /https?:\/\/[^\s\)<>"]+/g;
        urls = (answer.match(urlRegex) || []);
      }
      
      // Return parsed response
      return {
        answer,
        citations: urls,
        urls: urls,
        metadata: {
          snapshot_id: snapshotId,
          answer_section_html: downloadResult.answer_section_html // Store HTML for Grok
        }
      };
    }
    
    // Wait 10 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
```

### 3. **Priority Collector Service** (`priority-collector.service.ts`)

The parsed `BrightDataResponse` flows through the priority collector:

```typescript
// Lines 377-393: Convert BrightDataResponse to PriorityExecutionResult
const result = await this.executeWithProvider(...); // Calls BrightData service

return {
  queryId,
  executionId,
  collectorType,
  provider: provider.name,
  status: 'completed',
  response: result.answer || result.response,        // ✅ Answer stored
  citations: result.citations || [],                 // ✅ Citations stored
  urls: result.urls || [],                           // ✅ URLs stored
  executionTimeMs: executionTime,
  metadata: result.metadata || {},                   // ✅ Includes answer_section_html
  brandId,
  customerId,
  snapshotId: result.metadata?.snapshot_id        // ✅ Snapshot ID stored
};
```

### 4. **Data Collection Service** (`data-collection.service.ts`)

Finally, the result is stored in the database:

```typescript
// Lines 688-707: Store result after priority fallback
if (result.status === 'completed') {
  await this.storeCollectorResult({
    queryId: result.queryId,
    executionId: result.executionId,
    collectorType: result.collectorType,
    status: result.status,
    response: result.response,              // ✅ Answer
    citations: result.citations,            // ✅ Citations array
    urls: result.urls,                      // ✅ URLs array
    executionTimeMs: result.executionTimeMs,
    metadata: {
      ...result.metadata,                   // ✅ Includes answer_section_html for Grok
      provider: result.provider,
      fallbackUsed: result.fallbackUsed,
      fallbackChain: result.fallbackChain
    },
    brandId: result.brandId,
    customerId: result.customerId,
    snapshotId: result.snapshotId           // ✅ BrightData snapshot ID
  });
}
```

### 5. **Database Storage** (`storeCollectorResult` method)

```typescript
// Lines 980-1022: Insert into collector_results table
const insertData = {
  query_id: result.queryId,
  collector_type: mappedCollectorType,      // e.g., "Grok", "Bing Copilot"
  raw_answer: result.response,              // ✅ Answer text stored here
  citations: result.citations,              // ✅ Citations array stored here
  urls: result.urls,                        // ✅ URLs array stored here
  brand_id: result.brandId,
  customer_id: result.customerId,
  execution_id: result.executionId,
  brightdata_snapshot_id: result.snapshotId, // ✅ Snapshot ID stored here
  metadata: {
    ...result.metadata,                     // ✅ Includes answer_section_html
    execution_time_ms: result.executionTimeMs,
    status: result.status,
    collected_by: 'main_process',
    collected_at: new Date().toISOString()
  }
};

await this.supabase
  .from('collector_results')
  .insert(insertData);
```

## Key Parsing Logic by Collector Type

### **Grok Collector** (`executeGrokQuery`)
- **Answer extraction**: 
  - Primary: `answer_text` field
  - Fallback: `answer_section_html` (HTML stripped of tags)
- **Citations/URLs extraction**:
  - Tries multiple fields: `citations`, `sources`, `urls`, `links`
  - Extracts from nested structures
  - Falls back to regex extraction from answer text if no structured fields

### **Bing Copilot** (`executeBingCopilotQuery`)
- **Answer extraction**: 
  - Fields: `answer_text`, `answer`, `response`, `content`
- **Citations/URLs extraction**:
  - Fields: `sources`, `citations`, `urls`
  - Handles both string arrays and object arrays

### **ChatGPT** (`executeChatGPTSync`)
- **Answer extraction**: 
  - From array response: `responseData[0]?.answer`
- **Citations/URLs extraction**:
  - From array response: `responseData[0]?.citations` and `responseData[0]?.urls`

### **Gemini** (`executeGeminiQuery`)
- **Answer extraction**: 
  - Fields: `answer_text`, `answer`, `response`, `content`
  - Also handles `answer_html` with HTML tag stripping
- **Citations/URLs extraction**:
  - Deep traversal of response object
  - Checks fields: `citations`, `links_attached`, `links`, `sources`, `top_sources`, `urls`

## Database Schema

The parsed data is stored in the `collector_results` table:

```sql
- raw_answer: text          -- The answer/response text
- citations: jsonb          -- Array of citation URLs
- urls: jsonb               -- Array of all URLs
- brightdata_snapshot_id: varchar  -- Snapshot ID for async responses
- metadata: jsonb           -- Contains answer_section_html for Grok
- execution_id: uuid        -- Links to query_executions table
```

## Summary

**Real-time Flow:**
1. BrightData returns 200 OK → Parse immediately → Store in DB

**Async Flow:**
1. BrightData returns 202 Accepted with `snapshot_id`
2. Poll snapshot endpoint every 10 seconds (max 60 attempts = 10 minutes)
3. When data is ready → Parse answer, citations, URLs
4. Store in `collector_results` table with all extracted data

**Key Points:**
- ✅ Answer text is stored in `raw_answer` column
- ✅ Citations are stored as JSONB array in `citations` column
- ✅ URLs are stored as JSONB array in `urls` column
- ✅ `answer_section_html` (for Grok) is preserved in `metadata` JSONB
- ✅ `snapshot_id` is stored for tracking async operations
- ✅ All parsing handles multiple response formats and fallbacks






