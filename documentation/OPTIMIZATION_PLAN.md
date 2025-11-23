# Data Collection & Scoring Optimization Plan

## 🎯 Goals
- Reduce onboarding → dashboard time from 5-10 minutes to 1-2 minutes
- Improve user experience with real-time progress feedback
- Distribute load across multiple API keys
- Eliminate blocking operations

---

## 📋 Phase 1: Loading Screen & Progress Tracking (Immediate)

### Tasks
1. ✅ Create beautiful loading screen component
2. ✅ Add progress tracking API endpoint
3. ✅ Implement real-time progress updates
4. ✅ Auto-redirect to dashboard on completion

### Implementation Details
- **Loading Screen Component**: `DataCollectionLoadingScreen.tsx`
  - Shows animated progress indicators
  - Displays current operation (collecting, scoring, etc.)
  - Shows progress bar with query/result counts
  - Estimates time remaining

- **Progress API**: `GET /api/brands/:brandId/onboarding-progress`
  - Returns:
    - Total queries to collect
    - Completed queries
    - Total scoring operations
    - Completed scoring operations
    - Current operation type
    - Estimated completion time

- **WebSocket/SSE**: Optional real-time updates
  - Push progress updates to frontend
  - Eliminate polling

---

## 📋 Phase 2: Parallel Data Collection (High Priority)

### Current Problem
- Queries executed sequentially
- Each collector waits for previous query
- 3-6 minutes for 15 queries × 4 collectors

### Solution
- Execute queries in batches of 3-5
- Use Promise.all() for parallel execution
- Update progress in real-time

### Implementation
```typescript
// Pseudo-code
async function collectDataInParallel(queries, collectors, batchSize = 5) {
  const batches = chunk(queries, batchSize);
  
  for (const batch of batches) {
    const promises = batch.map(query => 
      collectors.map(collector => 
        executeCollection(query, collector)
      )
    ).flat();
    
    await Promise.allSettled(promises);
    updateProgress();
  }
}
```

### Expected Improvement
- **Before**: 3-6 minutes (sequential)
- **After**: 30-60 seconds (parallel batches)
- **Speedup**: 80-85%

---

## 📋 Phase 3: Multiple API Keys Distribution (High Priority)

### Current Problem
- Single API key per service (Cerebras, Gemini)
- Rate limiting slows down entire process
- All operations compete for same key

### Solution
Split API keys by operation type:

| Operation | New Key Variable | Fallback |
|-----------|------------------|----------|
| Position Extraction | `CEREBRAS_API_KEY_POSITION` | `CEREBRAS_API_KEY` |
| Sentiment Scoring | `CEREBRAS_API_KEY_SENTIMENT` | `CEREBRAS_API_KEY` |
| Citation Categorization | `GOOGLE_GEMINI_API_KEY_CITATIONS` | `GOOGLE_GEMINI_API_KEY` |
| Topic Generation | `CEREBRAS_API_KEY_GENERATION` | `CEREBRAS_API_KEY` |
| Query Generation | `CEREBRAS_API_KEY_GENERATION` | `CEREBRAS_API_KEY` |

### Implementation
1. Update environment variable loading
2. Modify services to use specific keys
3. Add fallback to generic keys
4. Test with multiple keys

### Expected Improvement
- **Before**: Rate limited, sequential operations
- **After**: No rate limit conflicts, parallel operations
- **Speedup**: 40-60%

---

## 📋 Phase 4: Parallel Scoring Operations (Medium Priority)

### Current Problem
- Scoring runs sequentially: Position → Sentiment → Citations
- Each operation waits for previous

### Solution
- Run all three operations in parallel
- Use different API keys for each
- Aggregate results when all complete

### Implementation
```typescript
async function scoreBrandParallel(brandId, customerId) {
  const [positions, sentiments, citations] = await Promise.all([
    positionExtractionService.extractPositions({ brandId, apiKey: CEREBRAS_KEY_1 }),
    sentimentScoringService.scorePending({ brandId, apiKey: CEREBRAS_KEY_2 }),
    citationExtractionService.extractCitations({ brandId, apiKey: GEMINI_KEY_1 })
  ]);
  
  return { positions, sentiments, citations };
}
```

### Expected Improvement
- **Before**: 2-4 minutes (sequential)
- **After**: 20-40 seconds (parallel)
- **Speedup**: 60-70%

---

## 📋 Phase 5: BrightData Optimization (Medium Priority)

### Current Problem
- BrightData sometimes returns async (202 status)
- Polling every 5-10 seconds
- Can take 30-60 seconds per request

### Options

#### Option A: Aggressive Polling (Quick Win)
- Reduce poll interval to 1-2 seconds
- Timeout after 30 seconds
- Move to background if timeout

#### Option B: Webhooks (Best Long-term)
- Register webhook URL with BrightData
- Receive completion notifications
- Zero polling needed

#### Option C: Hybrid Approach (Recommended)
- **Onboarding flow**: Aggressive polling (1-2s) with 2min timeout
- **Background**: Use existing cron job for failed/stuck requests
- **Future**: Implement webhooks when available

### Implementation
```typescript
async function collectWithBrightData(prompt, collectorType) {
  const response = await fetch('/scrape', { ... });
  
  if (response.status === 202) {
    // Aggressive polling for onboarding
    return await pollAggressively(snapshotId, {
      interval: 1000, // 1 second
      timeout: 120000, // 2 minutes
      onTimeout: () => moveToBackground(snapshotId)
    });
  }
  
  return await response.json();
}
```

### Expected Improvement
- **Before**: 30-60 seconds per BrightData request
- **After**: 10-30 seconds (aggressive polling) or instant (webhooks)
- **Speedup**: 50-90%

---

## 📋 Phase 6: Progressive Dashboard Loading (Future)

### Concept
- Show dashboard immediately with skeleton loaders
- Display partial results as they arrive
- Real-time UI updates via WebSocket/SSE

### Implementation
- Use React Query for real-time data fetching
- Implement optimistic UI updates
- Show "Loading..." badges for pending operations
- Update charts/tables as data arrives

### Benefits
- User sees dashboard immediately
- Perceived performance improvement
- Better user experience

---

## 📊 Combined Impact

### Current Timeline
```
Onboarding Complete
  ↓
Data Collection: 3-6 minutes (sequential)
  ↓
Scoring: 2-4 minutes (sequential)
  ↓
BrightData Polling: 1-2 minutes
  ↓
Dashboard Ready: 6-12 minutes total
```

### Optimized Timeline (After All Phases)
```
Onboarding Complete
  ↓
Data Collection: 30-60 seconds (parallel batches)
  ↓
Scoring: 20-40 seconds (parallel, multiple keys)
  ↓
BrightData: 10-30 seconds (aggressive polling)
  ↓
Dashboard Ready: 1-2 minutes total
```

### Overall Improvement
- **Time Reduction**: 80-85% faster
- **User Experience**: Real-time progress, no waiting in empty dashboard
- **Scalability**: Multiple API keys prevent rate limiting
- **Reliability**: Parallel operations continue even if one fails

---

## 🛠️ Implementation Priority

1. **Phase 1** (Loading Screen) - **IMMEDIATE** ⚡
   - Impact: High user experience improvement
   - Effort: Low (1-2 days)
   - Risk: Low

2. **Phase 2** (Parallel Collection) - **HIGH** 🔥
   - Impact: 80% time reduction
   - Effort: Medium (3-5 days)
   - Risk: Medium

3. **Phase 3** (Multiple API Keys) - **HIGH** 🔥
   - Impact: 40-60% performance improvement
   - Effort: Low (2-3 days)
   - Risk: Low

4. **Phase 4** (Parallel Scoring) - **MEDIUM** 📊
   - Impact: 60-70% time reduction
   - Effort: Medium (2-3 days)
   - Risk: Medium

5. **Phase 5** (BrightData Optimization) - **MEDIUM** 📊
   - Impact: 50-90% time reduction for BrightData
   - Effort: Low-Medium (2-4 days)
   - Risk: Low

6. **Phase 6** (Progressive Dashboard) - **FUTURE** 🚀
   - Impact: High UX improvement
   - Effort: High (5-7 days)
   - Risk: Medium

---

## 🔑 Environment Variables Setup

### Required (Immediate)
```bash
# Existing (keep for backward compatibility)
CEREBRAS_API_KEY=xxx
GOOGLE_GEMINI_API_KEY=xxx
```

### Recommended (Phase 3)
```bash
# Position Extraction
CEREBRAS_API_KEY_POSITION=xxx
GOOGLE_GEMINI_API_KEY_POSITION=xxx

# Sentiment Scoring
CEREBRAS_API_KEY_SENTIMENT=xxx
GOOGLE_GEMINI_API_KEY_SENTIMENT=xxx

# Citation Categorization
GOOGLE_GEMINI_API_KEY_CITATIONS=xxx
CEREBRAS_API_KEY_CITATIONS=xxx

# Topic/Query Generation
CEREBRAS_API_KEY_GENERATION=xxx
GOOGLE_GEMINI_API_KEY_GENERATION=xxx
```

### Notes
- Services will fallback to generic keys if specific keys not set
- Allows gradual migration
- No breaking changes

---

## 🧪 Testing Strategy

### Unit Tests
- Test parallel execution logic
- Test API key fallback mechanism
- Test progress tracking

### Integration Tests
- Test full onboarding flow
- Test parallel data collection
- Test scoring operations

### Performance Tests
- Measure before/after timing
- Test with different batch sizes
- Test rate limiting with multiple keys

### Load Tests
- Test with multiple concurrent onboardings
- Test API key distribution
- Test failure scenarios

---

## 📝 Success Metrics

- **Time to Dashboard**: < 2 minutes (from 5-10 minutes)
- **User Satisfaction**: Positive feedback on loading screen
- **API Success Rate**: > 95% (maintain current levels)
- **Rate Limit Errors**: < 1% (from potential 5-10%)
- **Progress Accuracy**: ±5% estimated time

---

This plan will be updated as implementation progresses.

