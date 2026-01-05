# LLM Model Selection Recommendations

## Overview

This document provides recommendations for when to use **gpt-4o-mini** vs **gpt-oss-20b** across different services in the codebase.

## Model Characteristics

### gpt-4o-mini
- ✅ **Fast** - Low latency, quick responses
- ✅ **Cost-effective** - Lower cost per token
- ✅ **Reliable** - Consistent JSON output
- ✅ **Good for** - Simple structured tasks, classification, high-volume operations
- ❌ **Not ideal for** - Complex reasoning, multi-step analysis

### gpt-oss-20b
- ✅ **Reasoning model** - Better for complex analysis
- ✅ **Deep understanding** - Handles nuanced tasks well
- ⚠️ **Slower** - Higher latency due to reasoning overhead
- ⚠️ **Higher cost** - More tokens needed (reasoning + output)
- ⚠️ **Token limits** - Needs higher max_tokens (4000+)
- ✅ **Good for** - Complex analysis, multi-step reasoning, deep content understanding

---

## Recommendations by Service

### ✅ Use **gpt-4o-mini** for:

#### 1. **Onboarding Services** ⭐ (HIGH PRIORITY)
- **File**: `backend/src/services/onboarding/brand-product-enrichment.service.ts`
- **Purpose**: Brand/competitor synonyms and products extraction
- **Why**: Simple structured JSON output, fast onboarding experience
- **Status**: ✅ Already switched

- **File**: `backend/src/services/onboarding/services/llm-brand-intel.service.ts`
- **Purpose**: Brand intelligence (CEO, HQ, competitors, industry)
- **Why**: Structured data extraction, fast response needed
- **Recommendation**: Switch from `gpt-oss-20b` to `gpt-4o-mini`

#### 2. **Sentiment Analysis** ⭐ (HIGH PRIORITY)
- **Files**: 
  - `backend/src/services/scoring/sentiment/brand-sentiment.service.ts`
  - `backend/src/services/scoring/sentiment/competitor-sentiment.service.ts`
  - `backend/src/services/scoring/sentiment/collector-sentiment.service.ts`
  - `backend/src/services/scoring/sentiment/combined-sentiment.service.ts`
- **Purpose**: Classify sentiment (POSITIVE/NEGATIVE/NEUTRAL) with score
- **Why**: Simple classification task, high volume, needs fast response
- **Recommendation**: Switch from `gpt-oss-20b` to `gpt-4o-mini`

#### 3. **AEO Categorization**
- **File**: `backend/src/services/aeo-categorization.service.ts`
- **Purpose**: Categorize citations (Editorial/Corporate/Reference/etc.)
- **Why**: Classification task, structured output
- **Recommendation**: Switch from `gpt-oss-20b` to `gpt-4o-mini`

#### 4. **Topics & Query Generation**
- **File**: `backend/src/services/topics-query-generation.service.ts`
- **Purpose**: Generate topics and search queries
- **Why**: Structured generation, fast onboarding
- **Recommendation**: Switch from `gpt-oss-20b` to `gpt-4o-mini`

- **File**: `backend/src/services/query-generation.service.ts`
- **Purpose**: Generate search queries for topics
- **Why**: Simple query generation, high volume
- **Recommendation**: Switch from `gpt-oss-20b` to `gpt-4o-mini`

#### 5. **Movers & Shakers Analysis**
- **File**: `backend/src/services/movers-and-shakers/analysis.service.ts`
- **Purpose**: Analyze trending topics/keywords
- **Why**: Structured analysis, performance-sensitive
- **Recommendation**: Switch from `gpt-oss-20b` to `gpt-4o-mini`

#### 6. **Trending Keywords**
- **File**: `backend/src/services/keywords/trending-keywords.service.ts`
- **Purpose**: Identify trending keywords
- **Why**: Simple extraction task
- **Recommendation**: Switch from `gpt-oss-20b` to `gpt-4o-mini`

#### 7. **Brand Service (Simple Operations)**
- **File**: `backend/src/services/brand.service.ts`
- **Purpose**: Various brand-related operations
- **Why**: Most operations are structured tasks
- **Recommendation**: Switch from `gpt-oss-20b` to `gpt-4o-mini` (unless complex analysis)

---

### ✅ Use **gpt-oss-20b** for:

#### 1. **Consolidated Analysis** ⭐ (HIGH PRIORITY - KEEP)
- **File**: `backend/src/services/scoring/consolidated-analysis.service.ts`
- **Purpose**: Complex multi-step analysis extracting:
  - Products (brand + competitors)
  - Citation categorization
  - Sentiment analysis
  - Keywords with relevance scores
- **Why**: Requires deep understanding, multi-step reasoning, complex context
- **Status**: ✅ Keep as `gpt-oss-20b`

#### 2. **Recommendation Generation** ⭐ (HIGH PRIORITY - KEEP)
- **File**: `backend/src/services/recommendations/recommendation.service.ts`
- **Purpose**: Generate strategic recommendations
- **Why**: Requires understanding context, brand strategy, competitive landscape
- **Status**: ✅ Keep as `gpt-oss-20b`

- **File**: `backend/src/services/recommendations/recommendation-content.service.ts`
- **Purpose**: Generate detailed recommendation content
- **Why**: Complex content generation requiring strategic thinking
- **Status**: ✅ Keep as `gpt-oss-20b` (if using OpenRouter)

#### 3. **Data Collection (Complex Queries)**
- **File**: `backend/src/services/data-collection/priority-collector.service.ts`
- **Purpose**: Complex query processing
- **Why**: May need reasoning for complex queries
- **Recommendation**: Keep as `gpt-oss-20b` for complex cases, use `gpt-4o-mini` for simple ones

---

## Summary Table

| Service | Current Model | Recommended Model | Priority | Reason |
|---------|--------------|-------------------|----------|--------|
| **Onboarding - Brand Enrichment** | gpt-oss-20b | ✅ **gpt-4o-mini** | HIGH | Simple JSON, fast onboarding |
| **Onboarding - Brand Intel** | gpt-oss-20b | ✅ **gpt-4o-mini** | HIGH | Structured extraction |
| **Sentiment Analysis (All)** | gpt-oss-20b | ✅ **gpt-4o-mini** | HIGH | Simple classification |
| **AEO Categorization** | gpt-oss-20b | ✅ **gpt-4o-mini** | MEDIUM | Classification task |
| **Topics/Query Generation** | gpt-oss-20b | ✅ **gpt-4o-mini** | MEDIUM | Structured generation |
| **Movers & Shakers** | gpt-oss-20b | ✅ **gpt-4o-mini** | MEDIUM | Structured analysis |
| **Trending Keywords** | gpt-oss-20b | ✅ **gpt-4o-mini** | LOW | Simple extraction |
| **Consolidated Analysis** | gpt-oss-20b | ✅ **KEEP gpt-oss-20b** | HIGH | Complex reasoning needed |
| **Recommendations** | gpt-oss-20b | ✅ **KEEP gpt-oss-20b** | HIGH | Strategic thinking needed |

---

## Implementation Priority

### Phase 1: High Priority (Do First)
1. ✅ Onboarding - Brand Product Enrichment (DONE)
2. Onboarding - Brand Intel Service
3. All Sentiment Analysis Services

### Phase 2: Medium Priority
4. AEO Categorization
5. Topics/Query Generation
6. Movers & Shakers

### Phase 3: Low Priority
7. Trending Keywords
8. Other simple operations

---

## Cost & Performance Impact

### Switching to gpt-4o-mini will:
- ✅ **Reduce costs** by ~70-80% for high-volume operations
- ✅ **Improve latency** by ~50-70% (faster responses)
- ✅ **Reduce token usage** (no reasoning overhead)
- ✅ **Improve reliability** (simpler model, fewer edge cases)

### Keeping gpt-oss-20b for complex tasks:
- ✅ **Better quality** for complex analysis
- ✅ **More accurate** for multi-step reasoning
- ⚠️ **Higher cost** but justified for quality-critical operations

---

## Notes

- **Always set appropriate max_tokens**: 
  - `gpt-4o-mini`: 1000-2000 tokens (sufficient for most tasks)
  - `gpt-oss-20b`: 4000+ tokens (needs space for reasoning + output)

- **Monitor performance**: After switching, monitor accuracy and adjust if needed

- **Fallback strategy**: Keep fallback models (gpt-5-nano, etc.) for reliability

