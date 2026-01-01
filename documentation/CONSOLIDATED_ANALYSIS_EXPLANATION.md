# Consolidated Analysis Service - Explanation & Integration Guide

## Overview

The `consolidated-analysis.service.ts` is an **optimized version** of the brand scoring orchestration that combines **multiple LLM operations into a single API call** instead of making separate calls for each operation.

## What It Does

The consolidated analysis service performs **5 operations in ONE API call**:

1. **Brand Product Extraction** - Extracts official products sold by the brand
2. **Competitor Product Extraction** - Extracts products for each competitor
3. **Citation Categorization** - Categorizes citation URLs (Editorial, Corporate, Reference, UGC, Social, Institutional)
4. **Brand Sentiment Analysis** - Analyzes sentiment toward the brand
5. **Competitor Sentiment Analysis** - Analyzes sentiment toward each competitor

### Current Architecture (Brand Scoring Orchestrator)

The `brand-scoring.orchestrator.ts` currently orchestrates **separate services** that make **individual API calls**:

```
┌─────────────────────────────────────────────────────────┐
│  Brand Scoring Orchestrator                             │
├─────────────────────────────────────────────────────────┤
│  1. Position Extraction Service                         │
│     └─> Separate LLM call for product extraction        │
│                                                          │
│  2. Combined Sentiment Service                          │
│     └─> Separate LLM call for brand + competitor        │
│         sentiment (already optimized)                   │
│                                                          │
│  3. Citation Extraction Service                         │
│     └─> Extracts citations, then calls                  │
│         Citation Categorization Service                 │
│         └─> Separate LLM call per citation              │
└─────────────────────────────────────────────────────────┘
```

**Total: ~3-5+ API calls per collector_result**

### Consolidated Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Consolidated Analysis Service                          │
├─────────────────────────────────────────────────────────┤
│  Single LLM Call (OpenRouter)                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. Product Extraction (Brand + Competitors)      │  │
│  │ 2. Citation Categorization (All citations)       │  │
│  │ 3. Sentiment Analysis (Brand + Competitors)      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Total: 1 API call per collector_result**

## Key Differences & Gaps

### ✅ Advantages of Consolidated Service

1. **Cost Efficiency**: 1 API call instead of 3-5+ calls
2. **Speed**: Faster processing (single round-trip)
3. **Consistency**: All analysis uses the same context
4. **Token Efficiency**: Shared context reduces duplicate token usage

### ⚠️ Gaps & Differences

#### 1. **Citation Categorization Approach**

**Current (Citation Categorization Service):**
- Uses hardcoded domain patterns first (fast)
- Falls back to AI (Cerebras/Gemini) only for unknown domains
- Processes citations individually
- Has confidence levels and source tracking

**Consolidated Service:**
- Categorizes ALL citations in one prompt
- No hardcoded patterns (pure LLM)
- No confidence tracking
- May be less accurate for known domains

**Gap**: Consolidated service doesn't leverage hardcoded patterns, which are faster and more reliable.

#### 2. **Sentiment Score Scale**

**Current Services:**
- `brand-sentiment.service.ts`: Uses **-1.0 to 1.0** scale
- `combined-sentiment.service.ts`: Uses **1-100** scale
- Database stores in **1-100** scale

**Consolidated Service:**
- Returns **-1.0 to 1.0** scale
- Has normalization logic to convert to 1-100 scale

**Gap**: Scale inconsistency needs careful handling during integration.

#### 3. **Product Extraction**

**Current (Position Extraction Service):**
- Extracts positions (character indices) where products are mentioned
- Stores detailed position data in `extracted_positions` table
- Calculates visibility metrics, share of answers, etc.

**Consolidated Service:**
- Only extracts product **names** (no positions)
- Doesn't calculate visibility metrics
- Doesn't store position data

**Gap**: Consolidated service doesn't replace position extraction - it only extracts product names.

#### 4. **Error Handling & Fallbacks**

**Current Services:**
- Individual services have retry logic
- Can fail independently (one failure doesn't block others)
- Better error isolation

**Consolidated Service:**
- Single point of failure
- If consolidated call fails, all operations fail
- Less granular error handling

#### 5. **Caching**

**Consolidated Service:**
- Has in-memory cache (Map-based)
- Cache keyed by `collector_result_id`
- Cache is lost on service restart

**Current Services:**
- No caching (always fresh analysis)
- Or database-level caching

**Gap**: Cache persistence not implemented.

#### 6. **Model Selection**

**Current Services:**
- Position Extraction: Cerebras (primary), Gemini (fallback)
- Sentiment: OpenRouter with model fallbacks
- Citation Categorization: Cerebras (primary), Gemini (fallback)

**Consolidated Service:**
- Uses OpenRouter with `openai/gpt-4o-mini`
- Uses `provider.sort: 'throughput'` for best throughput model
- No fallback to other providers

**Gap**: Different model selection strategy.

#### 7. **Database Integration**

**Current Services:**
- Direct database writes to `extracted_positions`
- Updates sentiment fields in position rows
- Stores citation categorizations in citations table

**Consolidated Service:**
- **Does NOT write to database**
- Only returns results
- Requires separate integration to persist data

**Gap**: Consolidated service is a pure analysis service - needs orchestration layer to persist results.

## Integration Guide

### Step 1: Update Brand Scoring Orchestrator

Modify `brand-scoring.orchestrator.ts` to use consolidated analysis:

```typescript
import { consolidatedAnalysisService } from './consolidated-analysis.service';
import { positionExtractionService } from './position-extraction.service';
import { citationExtractionService } from '../citations/citation-extraction.service';

export class BrandScoringService {
  async scoreBrand(options: BrandScoringOptions): Promise<BrandScoringResult> {
    // ... existing code ...

    // NEW: Use consolidated analysis for new collector results
    if (USE_CONSOLIDATED_ANALYSIS) {
      return await this.scoreBrandWithConsolidatedAnalysis(options);
    }

    // Fallback to existing approach
    return await this.scoreBrandLegacy(options);
  }

  private async scoreBrandWithConsolidatedAnalysis(
    options: BrandScoringOptions
  ): Promise<BrandScoringResult> {
    // 1. Get collector results that need processing
    const collectorResults = await this.getUnprocessedCollectorResults(options);

    let processed = 0;
    const errors: Array<{ operation: string; error: string }> = [];

    for (const result of collectorResults) {
      try {
        // 2. Call consolidated analysis
        const analysis = await consolidatedAnalysisService.analyze({
          brandName: result.brand,
          brandMetadata: result.brand_metadata,
          competitorNames: this.extractCompetitorNames(result.competitors),
          competitorMetadata: this.buildCompetitorMetadata(result.competitors),
          rawAnswer: result.raw_answer,
          citations: this.extractCitations(result.citations),
          collectorResultId: result.id,
        });

        // 3. Store products (still need position extraction for positions)
        await this.storeProducts(result, analysis.products);

        // 4. Store sentiment (update extracted_positions)
        await this.storeSentiment(result, analysis.sentiment);

        // 5. Store citation categorizations
        await this.storeCitationCategorizations(result, analysis.citations);

        processed++;
      } catch (error) {
        errors.push({
          operation: 'consolidated_analysis',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      positionsProcessed: processed, // Products extracted
      sentimentsProcessed: processed, // Sentiment analyzed
      competitorSentimentsProcessed: processed,
      citationsProcessed: processed,
      errors,
    };
  }
}
```

### Step 2: Handle Position Extraction

**Important**: Consolidated service extracts product **names**, but you still need **position extraction** for:
- Character positions in text
- Visibility metrics
- Share of answers calculations

**Options:**

**Option A: Hybrid Approach (Recommended)**
- Use consolidated service for products + sentiment + citations
- Still run position extraction for position data
- Merge results

**Option B: Enhanced Consolidated Service**
- Extend consolidated service to also extract positions
- Add position calculation logic

### Step 3: Handle Sentiment Scale Conversion

```typescript
private normalizeSentimentScore(score: number): number {
  // Convert -1.0 to 1.0 scale to 1-100 scale
  if (score >= -1 && score <= 1) {
    return Math.round(((score + 1) / 2) * 99) + 1;
  }
  // Already in 1-100 scale
  return Math.max(1, Math.min(100, score));
}
```

### Step 4: Integrate Citation Categorization

```typescript
private async storeCitationCategorizations(
  result: CollectorResult,
  categorizations: Record<string, { category: string; pageName: string | null }>
): Promise<void> {
  // Get existing citations for this collector_result
  const { data: citations } = await this.supabase
    .from('citations')
    .select('id, url')
    .eq('collector_result_id', result.id);

  if (!citations) return;

  // Update each citation with category
  for (const citation of citations) {
    const categorization = categorizations[citation.url];
    if (categorization) {
      await this.supabase
        .from('citations')
        .update({
          category: categorization.category,
          page_name: categorization.pageName,
        })
        .eq('id', citation.id);
    }
  }
}
```

### Step 5: Add Feature Flag

```typescript
// In brand-scoring.orchestrator.ts
const USE_CONSOLIDATED_ANALYSIS = process.env.USE_CONSOLIDATED_ANALYSIS === 'true';
```

### Step 6: Update Existing Services to Use Cache

The `combined-sentiment.service.ts` and `brand-sentiment.service.ts` already check for cached consolidated results:

```typescript
// This is already implemented!
if (USE_CONSOLIDATED_ANALYSIS) {
  const cached = (consolidatedAnalysisService as any).cache.get(collectorResultId);
  if (cached?.sentiment) {
    // Use cached sentiment
  }
}
```

## Recommended Integration Strategy

### Phase 1: Parallel Run (Testing)
1. Enable consolidated analysis with feature flag
2. Run both approaches in parallel
3. Compare results for accuracy
4. Monitor costs and performance

### Phase 2: Hybrid Approach
1. Use consolidated analysis for sentiment + citations
2. Keep position extraction separate (still needed for positions)
3. Gradually migrate

### Phase 3: Full Integration
1. Extend consolidated service to include position extraction
2. Replace all individual services
3. Remove legacy code

## Environment Variables

Add to `.env`:

```bash
# Enable consolidated analysis
USE_CONSOLIDATED_ANALYSIS=true

# OpenRouter configuration (already exists)
OPENROUTER_API_KEY=your_key
OPENROUTER_SITE_URL=your_site_url
OPENROUTER_SITE_TITLE=your_site_title
```

## Testing Checklist

- [ ] Consolidated analysis returns all expected fields
- [ ] Sentiment scores are correctly normalized (1-100 scale)
- [ ] Product names match position extraction results
- [ ] Citation categorizations match individual service results
- [ ] Error handling works correctly
- [ ] Cache is properly utilized
- [ ] Database writes are correct
- [ ] Performance improvement is measurable
- [ ] Cost reduction is measurable

## Potential Issues & Solutions

### Issue 1: Citation Categorization Accuracy
**Problem**: Consolidated service may be less accurate than hardcoded patterns.

**Solution**: 
- Keep hardcoded patterns in consolidated service
- Or use hybrid: hardcoded first, then LLM for unknown

### Issue 2: Position Data Missing
**Problem**: Consolidated service doesn't extract positions.

**Solution**: 
- Keep position extraction service
- Or extend consolidated service to include positions

### Issue 3: Cache Persistence
**Problem**: Cache is lost on restart.

**Solution**: 
- Implement Redis cache
- Or database-backed cache

### Issue 4: Model Selection
**Problem**: Different models may give different results.

**Solution**: 
- Test with same models
- Or accept model differences as optimization trade-off

## Conclusion

The consolidated analysis service is a **significant optimization** that reduces API calls from 3-5+ to 1 per collector result. However, it requires careful integration to:

1. Handle position extraction (still needed)
2. Normalize sentiment scores correctly
3. Integrate with existing database schema
4. Maintain accuracy compared to individual services

The recommended approach is a **gradual migration** with parallel running and comparison before full replacement.
