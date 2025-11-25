# Multi-API-Key Performance Optimization Plan

## Executive Summary

This plan outlines a systematic approach to improve performance by distributing API calls across multiple API keys for each service. The goal is to reduce rate limiting bottlenecks, increase throughput, and enable parallel processing across services.

## Current State Analysis

### Current API Key Distribution

| Service | Current Key | Provider | Status |
|---------|------------|----------|--------|
| Position Extraction | `CEREBRAS_API_KEY_1` | Cerebras (primary), Gemini (fallback) | Single key |
| Sentiment Scoring | `CEREBRAS_API_KEY_2` | Cerebras (primary), Gemini (fallback) | Single key |
| Citation Categorization | `GOOGLE_GEMINI_API_KEY_3` | Gemini (primary), Cerebras (fallback) | Single key |
| Topic/Query Generation | `CEREBRAS_API_KEY` | Cerebras | Single key |

### Performance Bottlenecks Identified

1. **Sequential Processing:**
   - Position extraction: Processes one result at a time
   - Sentiment scoring: 2-second delay between calls
   - Citation extraction: 500ms delay between calls

2. **Rate Limiting:**
   - Single API key per service = single rate limit bucket
   - No failover mechanism if one key is exhausted
   - No load balancing across keys

3. **No Parallelization:**
   - Services run sequentially by default
   - Within-service batching is minimal
   - No key rotation for burst processing

## Proposed Architecture

### Phase 1: Multi-Key Infrastructure (Foundation)

#### 1.1 Enhanced API Key Resolver

**File:** `backend/src/utils/api-key-resolver.ts`

**Changes:**
- Support multiple keys per service
- Key rotation/round-robin logic
- Key health tracking (rate limit status)
- Automatic failover to healthy keys

**New Environment Variables:**
```bash
# Position Extraction - Multiple Keys
CEREBRAS_API_KEY_1=key1
CEREBRAS_API_KEY_1_2=key2
CEREBRAS_API_KEY_1_3=key3
# Fallback
CEREBRAS_API_KEY=key_fallback

# Sentiment Scoring - Multiple Keys
CEREBRAS_API_KEY_2=key1
CEREBRAS_API_KEY_2_2=key2
CEREBRAS_API_KEY_2_3=key3
# Fallback
CEREBRAS_API_KEY=key_fallback

# Citation Categorization - Multiple Keys
GOOGLE_GEMINI_API_KEY_3=key1
GOOGLE_GEMINI_API_KEY_3_2=key2
GOOGLE_GEMINI_API_KEY_3_3=key3
# Fallback
GOOGLE_GEMINI_API_KEY=key_fallback
```

**New Functions:**
```typescript
// Get all available keys for a service
getAllPositionExtractionKeys(): string[]
getAllSentimentScoringKeys(): string[]
getAllCitationCategorizationKeys(): string[]

// Get next key using round-robin
getNextPositionExtractionKey(): string | null
getNextSentimentScoringKey(): string | null
getNextCitationCategorizationKey(): string | null

// Mark key as rate-limited
markKeyRateLimited(key: string, service: string): void
isKeyHealthy(key: string, service: string): boolean
```

**Implementation Strategy:**
1. Parse environment variables with pattern `{SERVICE}_KEY_{INDEX}`
2. Maintain in-memory key pool with health status
3. Track rate limit errors per key
4. Auto-recover keys after cooldown period (e.g., 5 minutes)

---

### Phase 2: Parallel Batch Processing

#### 2.1 Batch Processing with Key Rotation

**Services to Update:**
- `position-extraction.service.ts`
- `sentiment-scoring.service.ts`
- `citation-categorization.service.ts`

**Key Changes:**

1. **Batch Processing:**
   ```typescript
   // OLD: Sequential
   for (const result of results) {
     await this.process(result);
   }

   // NEW: Parallel batches with key rotation
   const batches = chunk(results, BATCH_SIZE);
   await Promise.all(
     batches.map((batch, index) => 
       this.processBatch(batch, getNextKey(index))
     )
   );
   ```

2. **Concurrency Control:**
   - Maximum parallel requests per service (configurable)
   - Key-aware rate limiting (respect per-key limits)
   - Intelligent batching (adjust batch size based on key availability)

**Configuration:**
```bash
# Position Extraction
POSITION_EXTRACTION_BATCH_SIZE=10
POSITION_EXTRACTION_CONCURRENCY=3

# Sentiment Scoring
SENTIMENT_SCORING_BATCH_SIZE=15
SENTIMENT_SCORING_CONCURRENCY=4

# Citation Categorization
CITATIONS_BATCH_SIZE=20
CITATIONS_CONCURRENCY=5
```

---

### Phase 3: Intelligent Load Balancing

#### 3.1 Key Health Tracking

**New Service:** `backend/src/utils/api-key-health-tracker.ts`

**Features:**
- Track rate limit errors per key
- Track successful requests per key
- Automatic key cooldown (mark unhealthy temporarily)
- Health recovery (auto-mark healthy after cooldown)

**Data Structure:**
```typescript
interface KeyHealth {
  key: string;
  service: string;
  status: 'healthy' | 'rate_limited' | 'error';
  lastError?: Date;
  errorCount: number;
  successCount: number;
  cooldownUntil?: Date;
}
```

#### 3.2 Smart Key Selection

**Strategy:**
1. **Round-Robin (Default):** Distribute requests evenly
2. **Least-Used:** Select key with fewest recent requests
3. **Health-Based:** Skip unhealthy keys, use healthy ones
4. **Hybrid:** Combine strategies based on load

**Implementation:**
```typescript
function selectKey(keys: string[], service: string, strategy: 'round-robin' | 'least-used' | 'health-based'): string | null {
  const healthyKeys = keys.filter(key => isKeyHealthy(key, service));
  
  if (healthyKeys.length === 0) {
    // All keys unhealthy, wait for recovery or use fallback
    return getFallbackKey(service);
  }
  
  switch (strategy) {
    case 'round-robin':
      return getNextRoundRobinKey(healthyKeys, service);
    case 'least-used':
      return getLeastUsedKey(healthyKeys, service);
    case 'health-based':
      return getHealthiestKey(healthyKeys, service);
  }
}
```

---

### Phase 4: Enhanced Parallel Orchestration

#### 4.1 Update Brand Scoring Orchestrator

**File:** `backend/src/services/scoring/brand-scoring.orchestrator.ts`

**Changes:**
1. Enable parallel execution by default (with safety checks)
2. Increase batch sizes when multiple keys available
3. Dynamic concurrency adjustment based on key count

**New Options:**
```typescript
interface BrandScoringOptions {
  // ... existing options ...
  
  // NEW: Performance options
  enableParallelExecution?: boolean; // Default: true if multiple keys
  maxConcurrency?: number; // Default: calculated from key count
  batchSize?: number; // Default: calculated from key count
}
```

**Performance Calculation:**
```typescript
function calculateOptimalConcurrency(service: string): number {
  const availableKeys = getAllKeysForService(service);
  const healthyKeys = availableKeys.filter(key => isKeyHealthy(key, service));
  
  // Base concurrency: 2 requests per key
  // Cap at reasonable maximum (e.g., 10)
  return Math.min(healthyKeys.length * 2, 10);
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Build multi-key infrastructure

**Tasks:**
1. ✅ Create enhanced `api-key-resolver.ts` with multi-key support
2. ✅ Implement key health tracking system
3. ✅ Add key rotation logic
4. ✅ Update environment variable parsing
5. ✅ Write unit tests for key resolver

**Files to Create/Modify:**
- `backend/src/utils/api-key-resolver.ts` (enhance)
- `backend/src/utils/api-key-health-tracker.ts` (new)
- `backend/src/utils/key-selection-strategies.ts` (new)

**Testing:**
- Test key rotation
- Test health tracking
- Test fallback mechanisms

---

### Phase 2: Service Updates (Week 2)
**Goal:** Update scoring services to use multi-key infrastructure

**Tasks:**
1. ✅ Update `position-extraction.service.ts`:
   - Add batch processing
   - Implement key rotation per batch
   - Add concurrency control

2. ✅ Update `sentiment-scoring.service.ts`:
   - Add batch processing
   - Implement key rotation
   - Reduce delays (from 2s to configurable, lower when multiple keys)

3. ✅ Update `citation-categorization.service.ts`:
   - Enhance existing concurrency
   - Add key rotation
   - Optimize batch sizes

**Files to Modify:**
- `backend/src/services/scoring/position-extraction.service.ts`
- `backend/src/services/scoring/sentiment-scoring.service.ts`
- `backend/src/services/citations/citation-categorization.service.ts`
- `backend/src/services/citations/citation-extraction.service.ts`

**Configuration:**
- Add batch size and concurrency env vars
- Add key selection strategy env vars

---

### Phase 3: Orchestration (Week 3)
**Goal:** Enhance parallel execution in orchestrator

**Tasks:**
1. ✅ Update `brand-scoring.orchestrator.ts`:
   - Enable parallel by default (when keys available)
   - Dynamic concurrency calculation
   - Better error handling per service

2. ✅ Add performance monitoring:
   - Track processing time per service
   - Track key usage statistics
   - Log bottlenecks

**Files to Modify:**
- `backend/src/services/scoring/brand-scoring.orchestrator.ts`
- `backend/src/utils/performance-monitor.ts` (new)

---

### Phase 4: Monitoring & Tuning (Week 4)
**Goal:** Monitor performance and optimize

**Tasks:**
1. ✅ Add performance metrics:
   - Requests per key per minute
   - Rate limit errors per key
   - Average processing time per batch
   - Overall throughput improvement

2. ✅ Create performance dashboard/endpoint:
   - Key health status
   - Processing statistics
   - Recommendations for key allocation

3. ✅ Optimize based on metrics:
   - Adjust batch sizes
   - Tune concurrency limits
   - Rebalance key allocation

**Files to Create:**
- `backend/src/routes/performance.routes.ts` (new)
- `backend/src/services/performance-monitoring.service.ts` (new)

---

## Expected Performance Improvements

### Current Performance (Baseline)

| Service | Sequential Time | Current Rate |
|---------|----------------|--------------|
| Position Extraction (50 results) | ~5-8 minutes | ~6-10 results/min |
| Sentiment Scoring (50 results) | ~2-3 minutes | ~16-25 results/min |
| Citation Extraction (50 results) | ~10-15 minutes | ~3-5 results/min |
| **Total (Sequential)** | **~17-26 minutes** | **N/A** |

### Projected Performance (With Multi-Key)

**Assumptions:**
- 3 keys per service
- 3x parallelization per service
- Parallel execution across services

| Service | Optimized Time | Improved Rate |
|---------|---------------|---------------|
| Position Extraction (50 results) | ~2-3 minutes | ~16-25 results/min |
| Sentiment Scoring (50 results) | ~30-45 seconds | ~66-100 results/min |
| Citation Extraction (50 results) | ~4-5 minutes | ~10-12 results/min |
| **Total (Parallel)** | **~4-5 minutes** | **~10-12 results/min** |

**Overall Improvement: ~75-80% faster** ⚡

---

## Environment Variables Setup

### Recommended Key Allocation

```bash
# ============================================================================
# POSITION EXTRACTION - Cerebras Keys
# ============================================================================
CEREBRAS_API_KEY_1=sk-cerebras-key-1-xxx
CEREBRAS_API_KEY_1_2=sk-cerebras-key-1-2-xxx
CEREBRAS_API_KEY_1_3=sk-cerebras-key-1-3-xxx
# Fallback
CEREBRAS_API_KEY=sk-cerebras-fallback-xxx

# ============================================================================
# SENTIMENT SCORING - Cerebras Keys
# ============================================================================
CEREBRAS_API_KEY_2=sk-cerebras-key-2-xxx
CEREBRAS_API_KEY_2_2=sk-cerebras-key-2-2-xxx
CEREBRAS_API_KEY_2_3=sk-cerebras-key-2-3-xxx
# Fallback
CEREBRAS_API_KEY=sk-cerebras-fallback-xxx

# ============================================================================
# CITATION CATEGORIZATION - Gemini Keys
# ============================================================================
GOOGLE_GEMINI_API_KEY_3=AIzaSy-gemini-key-3-xxx
GOOGLE_GEMINI_API_KEY_3_2=AIzaSy-gemini-key-3-2-xxx
GOOGLE_GEMINI_API_KEY_3_3=AIzaSy-gemini-key-3-3-xxx
# Fallback
GOOGLE_GEMINI_API_KEY=AIzaSy-gemini-fallback-xxx

# ============================================================================
# PERFORMANCE TUNING
# ============================================================================
# Position Extraction
POSITION_EXTRACTION_BATCH_SIZE=10
POSITION_EXTRACTION_CONCURRENCY=6
POSITION_EXTRACTION_KEY_STRATEGY=round-robin

# Sentiment Scoring
SENTIMENT_SCORING_BATCH_SIZE=15
SENTIMENT_SCORING_CONCURRENCY=6
SENTIMENT_SCORING_KEY_STRATEGY=round-robin

# Citation Categorization
CITATIONS_BATCH_SIZE=20
CITATIONS_CONCURRENCY=6
CITATIONS_KEY_STRATEGY=round-robin

# Key Health Tracking
KEY_COOLDOWN_MINUTES=5
KEY_ERROR_THRESHOLD=5
```

---

## Risk Mitigation

### 1. Rate Limit Exhaustion
**Risk:** All keys get rate-limited simultaneously  
**Mitigation:**
- Implement exponential backoff per key
- Automatic key cooldown and recovery
- Graceful degradation to sequential processing

### 2. Key Cost Overruns
**Risk:** Multiple keys = multiple bills  
**Mitigation:**
- Monitor usage per key
- Set usage alerts
- Implement budget caps per key

### 3. Complexity Increase
**Risk:** More complex code = harder to debug  
**Mitigation:**
- Comprehensive logging
- Health dashboard
- Fallback to simple mode if issues

### 4. Inconsistent Results
**Risk:** Different keys might produce slightly different results  
**Mitigation:**
- Test consistency across keys
- Use same model/parameters per service
- Log which key was used for audit

---

## Success Metrics

### Key Performance Indicators (KPIs)

1. **Throughput:**
   - Results processed per minute (per service)
   - Overall onboarding completion time
   - Parallel execution effectiveness

2. **Reliability:**
   - Rate limit error rate
   - Key health uptime percentage
   - Successful request percentage

3. **Efficiency:**
   - Key utilization (requests per key)
   - Time saved vs. sequential processing
   - Resource cost per result

4. **User Experience:**
   - Onboarding completion time
   - Dashboard data freshness
   - Real-time scoring latency

---

## Rollout Strategy

### Phase 1: Testing (Week 1-2)
- Deploy to staging environment
- Test with 1-2 additional keys per service
- Monitor performance and errors

### Phase 2: Gradual Rollout (Week 3)
- Enable for new brands only
- Monitor closely
- Rollback plan ready

### Phase 3: Full Rollout (Week 4)
- Enable for all brands
- Monitor all metrics
- Optimize based on real data

---

## Future Enhancements

1. **Adaptive Batching:**
   - Adjust batch size based on key health
   - Dynamic concurrency limits

2. **Predictive Rate Limiting:**
   - Predict when keys will be rate-limited
   - Preemptively rotate keys

3. **Cost Optimization:**
   - Use cheaper keys for non-critical operations
   - Tier-based key allocation

4. **Multi-Region Support:**
   - Use keys from different regions
   - Latency-based key selection

---

## Documentation Updates

1. **Environment Variables Guide:**
   - How to set up multiple keys
   - Recommended key counts
   - Troubleshooting guide

2. **Performance Tuning Guide:**
   - How to adjust batch sizes
   - How to tune concurrency
   - How to monitor performance

3. **API Key Management:**
   - Best practices for key security
   - Rotation strategies
   - Cost monitoring

---

## Conclusion

This multi-API-key optimization plan provides a systematic approach to significantly improve performance by:

1. ✅ Distributing load across multiple keys
2. ✅ Enabling true parallel processing
3. ✅ Implementing intelligent load balancing
4. ✅ Providing robust error handling and fallbacks

**Expected Outcome:** 75-80% reduction in processing time, with better reliability and scalability.

**Next Steps:**
1. Review and approve this plan
2. Set up additional API keys in staging
3. Begin Phase 1 implementation
4. Monitor and iterate based on results


