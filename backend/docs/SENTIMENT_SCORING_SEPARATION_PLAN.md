# Sentiment Scoring Separation Plan

## Problem Statement

Currently, sentiment scoring uses a single API call to analyze sentiment for both brand AND all competitors simultaneously. This causes:

1. **Token Limit Exceeded Errors**: When there are many competitors, the prompt becomes too large
2. **Too Many Requests Errors**: Rate limiting on Cerebras API due to large payloads
3. **Inconsistent Results**: Brand sentiment scoring was reliable when done separately, but became unreliable when combined with competitors

## Current Implementation

- **Method**: `scoreExtractedPositions()` in `sentiment-scoring.service.ts`
- **Process**: 
  1. Groups rows by `collector_result_id`
  2. For each group, makes ONE API call with brand + all competitors
  3. Uses `analyzeMultiEntitySentiment()` which creates a large prompt with all entities
- **Issues**:
  - Large prompts (20k word limit, but still hits token limits with many competitors)
  - Single point of failure (if one entity fails, all fail)
  - No prioritization (brand is as important as competitors)

## Proposed Solution: Separate Calls with Optimized Competitor Batching

### Strategy

**Separate into two distinct phases:**
1. **Phase 1: Brand Sentiment Scoring** (Priority)
   - Score brand sentiment first
   - Use simpler, focused prompts (single entity)
   - More reliable and faster
   
2. **Phase 2: Competitor Sentiment Scoring** (Secondary)
   - Score ALL competitors in ONE API call per collector_result_id
   - Competitors-only call (no brand in prompt = smaller prompt)
   - Structured response indexed by competitor name
   - More efficient than one-call-per-competitor

### Benefits

1. **Reduced Token Usage**: Smaller prompts = less token consumption
2. **Better Error Handling**: Brand scoring can succeed even if competitor scoring fails
3. **Prioritization**: Brand sentiment is always scored first
4. **Rate Limit Management**: Can apply different delays/strategies for each phase
5. **Scalability**: Can process competitors in smaller batches if needed

## Implementation Plan

### Step 1: Create Separate Methods

#### 1.1 Brand Sentiment Scoring Method
```typescript
public async scoreBrandSentiment(options: SentimentScoreOptions = {}): Promise<number>
```
- Query rows where `sentiment_score IS NULL` and `competitor_name IS NULL`
- Use existing `analyzeSentiment()` method (single entity)
- Update `sentiment_score` and `sentiment_label` columns
- Simpler, more reliable

#### 1.2 Competitor Sentiment Scoring Method
```typescript
public async scoreCompetitorSentiment(options: SentimentScoreOptions = {}): Promise<number>
```
- Query rows where `sentiment_score_competitor IS NULL` and `competitor_name IS NOT NULL`
- Group by `collector_result_id` (all competitors for same collector_result_id together)
- Make ONE API call per collector_result_id with ALL competitors
- Response structured by competitor name/index for easy mapping
- Update `sentiment_score_competitor` and `sentiment_label_competitor` columns

### Step 2: Update Orchestration

#### 2.1 Update `brand-scoring.orchestrator.ts`
```typescript
// Phase 1: Brand sentiment (priority)
const brandSentimentsProcessed = await sentimentScoringService.scoreBrandSentiment(sentimentOptions);

// Phase 2: Competitor sentiment (secondary)
const competitorSentimentsProcessed = await sentimentScoringService.scoreCompetitorSentiment(sentimentOptions);
```

#### 2.2 Update `scoringWorker.ts` (cron job)
- Call brand scoring first
- Then call competitor scoring
- Track metrics separately

### Step 3: Implementation Details

#### 3.1 Brand Sentiment Scoring
- **Query**: `WHERE sentiment_score IS NULL AND (competitor_name IS NULL OR competitor_name = '')`
- **Method**: Use existing `analyzeSentiment()` (single entity, simpler)
- **Provider**: Can use Cerebras, Gemini, or Hugging Face (same as before)
- **Rate Limiting**: 2 second delay between requests (current)

#### 3.2 Competitor Sentiment Scoring
- **Query**: `WHERE sentiment_score_competitor IS NULL AND competitor_name IS NOT NULL`
- **Grouping**: Group by `collector_result_id` (all competitors together)
- **API Call**: ONE call per collector_result_id with ALL competitors (but NO brand)
- **Prompt Structure**: 
  - Only includes competitor names (no brand)
  - Smaller prompt = less token usage
  - Response indexed by competitor name
- **Response Format**:
```json
{
  "competitors": [
    {
      "competitorName": "Competitor A",
      "label": "POSITIVE|NEGATIVE|NEUTRAL",
      "score": -1.0 to 1.0,
      "positiveSentences": [...],
      "negativeSentences": [...]
    },
    {
      "competitorName": "Competitor B",
      ...
    }
  ]
}
```
- **Provider**: Cerebras (for multi-entity analysis)
- **Rate Limiting**: 2-3 second delay between requests
- **Benefits**: 
  - Efficient (one call for all competitors)
  - Smaller prompts (no brand included)
  - Easy mapping (response indexed by competitor name)

### Step 4: Backward Compatibility

- Keep `scoreExtractedPositions()` method but mark as deprecated
- Add deprecation warning
- Eventually remove after migration period

### Step 5: Error Handling Improvements

#### Brand Scoring
- If brand scoring fails, log error but continue
- Don't block competitor scoring

#### Competitor Scoring
- If competitor scoring fails for one competitor, continue with others
- Track failures per competitor
- Can retry failed competitors separately

### Step 6: Metrics & Logging

Track separately:
- `brandSentimentsProcessed`: Number of brand sentiment rows updated
- `competitorSentimentsProcessed`: Number of competitor sentiment rows updated
- `brandSentimentFailures`: Number of brand scoring failures
- `competitorSentimentFailures`: Number of competitor scoring failures

## Code Structure

```
sentiment-scoring.service.ts
├── scorePending() - Existing (for collector_results)
├── scoreBrandSentiment() - NEW
│   ├── Query brand rows only
│   ├── Use analyzeSentiment() (single entity)
│   └── Update sentiment_score columns
├── scoreCompetitorSentiment() - NEW
│   ├── Query competitor rows only
│   ├── Group by collector_result_id (all competitors together)
│   ├── Use analyzeCompetitorSentiment() (all competitors in one call)
│   └── Update sentiment_score_competitor columns (map by competitor name)
├── analyzeCompetitorSentiment() - NEW
│   ├── Takes text + list of competitor names (NO brand)
│   ├── Returns competitor-indexed sentiment results
│   └── Uses Cerebras API with structured response
└── scoreExtractedPositions() - DEPRECATED (keep for now)
    └── Call scoreBrandSentiment() + scoreCompetitorSentiment()
```

## Migration Strategy

### Phase 1: Add New Methods (Non-Breaking)
1. Implement `scoreBrandSentiment()`
2. Implement `scoreCompetitorSentiment()`
3. Test thoroughly

### Phase 2: Update Orchestrators
1. Update `brand-scoring.orchestrator.ts`
2. Update `scoringWorker.ts`
3. Monitor for issues

### Phase 3: Deprecate Old Method
1. Mark `scoreExtractedPositions()` as deprecated
2. Keep it as a wrapper that calls new methods
3. Remove after 2-3 releases

## Testing Plan

1. **Unit Tests**:
   - Test brand sentiment scoring with various scenarios
   - Test competitor sentiment scoring with 1, 5, 10+ competitors
   - Test error handling for each phase

2. **Integration Tests**:
   - Test full flow: brand scoring → competitor scoring
   - Test with rate limiting scenarios
   - Test with token limit scenarios

3. **Performance Tests**:
   - Compare token usage: old vs new approach
   - Compare API call count: old vs new approach
   - Measure time to complete: old vs new approach

## Rollout Plan

1. **Week 1**: Implement new methods, add tests
2. **Week 2**: Deploy to staging, monitor
3. **Week 3**: Deploy to production with feature flag
4. **Week 4**: Monitor production, gather metrics
5. **Week 5**: Remove feature flag, deprecate old method

## Risk Mitigation

1. **Feature Flag**: Add feature flag to switch between old/new approach
2. **Gradual Rollout**: Start with 10% of traffic, increase gradually
3. **Monitoring**: Track error rates, API usage, completion times
4. **Rollback Plan**: Keep old method available for quick rollback

## Success Metrics

- ✅ Zero token limit exceeded errors
- ✅ Zero "too many requests" errors
- ✅ Brand sentiment scoring success rate > 99%
- ✅ Competitor sentiment scoring success rate > 95%
- ✅ Reduced API token usage (target: 30-50% reduction)
- ✅ Faster completion time (target: 20-30% improvement)

## Implementation Details: Competitor-Only Multi-Entity Call

### New Method: `analyzeCompetitorSentiment()`

```typescript
private async analyzeCompetitorSentiment(
  text: string,
  competitorNames: string[]
): Promise<Map<string, EntitySentimentAnalysis>>
```

**Key Differences from Current `analyzeMultiEntitySentiment()`:**
1. **No brand in prompt** - Only competitors, reducing prompt size
2. **Competitor-indexed response** - Returns Map<competitorName, sentiment>
3. **Structured JSON format** - Easier to parse and map to database rows

**Prompt Structure:**
```
Analyze sentiment for the following competitors mentioned in the text.

Competitors to analyze:
1. Competitor A
2. Competitor B
3. Competitor C

[Text to analyze]

Respond with JSON:
{
  "competitors": [
    {
      "competitorName": "Competitor A",
      "label": "POSITIVE|NEGATIVE|NEUTRAL",
      "score": -1.0 to 1.0,
      "positiveSentences": [...],
      "negativeSentences": [...]
    }
  ]
}
```

**Benefits:**
- Smaller prompts (no brand = ~30-40% reduction in prompt size)
- Still efficient (one call for all competitors)
- Easy mapping (competitor name as key)
- Better error handling (can handle missing competitors gracefully)

## Future Optimizations

1. **Parallel Processing**: Process multiple collector_result_ids in parallel (with rate limiting)
2. **Caching**: Cache sentiment results for identical text/competitor combinations
3. **Retry Logic**: Implement exponential backoff for rate limit errors
4. **Batch Size Limits**: If too many competitors (>10), split into two batches

