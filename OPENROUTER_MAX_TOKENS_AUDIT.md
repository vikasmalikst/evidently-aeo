# OpenRouter API Max Tokens Audit

## Onboarding Intel - Max Tokens Settings

### Brand Intel Service
**File**: `backend/src/services/onboarding/services/llm-brand-intel.service.ts`
- **Line 143**: `max_tokens: 2000` (OpenRouter call)
- **Line 100**: `max_tokens: 2000` (Cerebras call - not OpenRouter)
- **Model**: `openai/gpt-4o-mini`
- **Purpose**: Brand intelligence (CEO, HQ, competitors, industry)
- **Recommendation**: ⚠️ **Reduce to 800-1000** - Brand intel is structured data, doesn't need 2000 tokens

### Brand Product Enrichment
**File**: `backend/src/services/onboarding/brand-product-enrichment.service.ts`
- **Uses**: `openrouter-collector.service.ts` with `collectorType: 'content'`
- **Default maxTokens**: `4000` (from collector config)
- **Model**: `openai/gpt-4o-mini`
- **Purpose**: Brand/competitor synonyms and products
- **Recommendation**: ⚠️ **Reduce to 1500-2000** - Product lists don't need 4000 tokens

---

## Complete OpenRouter API Max Tokens List

### 1. Onboarding Services

| Service | File | Line | Max Tokens | Model | Recommendation |
|---------|------|------|------------|-------|----------------|
| **Brand Intel** | `llm-brand-intel.service.ts` | 143 | **2000** | gpt-4o-mini | ⚠️ Reduce to **800-1000** |
| **Brand Enrichment** | `brand-product-enrichment.service.ts` | via collector | **4000** | gpt-4o-mini | ⚠️ Reduce to **1500-2000** |
| **Competitor Generation** | `competitor.service.ts` | 77 | **3000** | (Cerebras) | N/A (not OpenRouter) |
| **Prompt Generation** | `onboarding.routes.ts` | 670, 726 | **2000** | gpt-oss-20b | ✅ OK (complex generation) |

### 2. Sentiment Analysis Services

| Service | File | Line | Max Tokens | Model | Recommendation |
|---------|------|------|------------|-------|----------------|
| **Brand Sentiment** | `brand-sentiment.service.ts` | 211 | **2500** | gpt-oss-20b | ⚠️ Reduce to **500-800** (simple JSON) |
| **Competitor Sentiment** | `competitor-sentiment.service.ts` | 337 | **2500** | gpt-oss-20b | ⚠️ Reduce to **500-800** (simple JSON) |
| **Collector Sentiment** | `collector-sentiment.service.ts` | 624, 748 | **2000, 1500** | gpt-oss-20b | ⚠️ Reduce to **500-800** |
| **Combined Sentiment** | `combined-sentiment.service.ts` | 429 | **2500** | gpt-oss-20b | ⚠️ Reduce to **800-1000** |

### 3. Topics & Query Generation

| Service | File | Line | Max Tokens | Model | Recommendation |
|---------|------|------|------------|-------|----------------|
| **Topics Generation** | `topics-query-generation.service.ts` | 241, 277 | **4000** | gpt-oss-20b | ⚠️ Reduce to **2000-2500** |
| **Query Generation** | `query-generation.service.ts` | 305, 1837 | **2000** | gpt-oss-20b | ⚠️ Reduce to **1000-1500** |
| **Query Generation (short)** | `query-generation.service.ts` | 954, 985 | **200** | gpt-oss-20b | ✅ OK (short queries) |

### 4. Analysis & Categorization

| Service | File | Line | Max Tokens | Model | Recommendation |
|---------|------|------|------------|-------|----------------|
| **Consolidated Analysis** | `consolidated-analysis.service.ts` | 703 | **8192** | gpt-oss-20b | ✅ **KEEP** (complex multi-step) |
| **AEO Categorization** | `aeo-categorization.service.ts` | 156 | **2000** | gpt-oss-20b | ⚠️ Reduce to **500-800** (classification) |
| **Citation Categorization** | `citation-categorization.service.ts` | 290 | **15** | (not OpenRouter) | N/A |
| **Position Extraction** | `position-extraction.service.ts` | 1153 | **1000** | (Cerebras) | N/A |

### 5. Recommendations

| Service | File | Line | Max Tokens | Model | Recommendation |
|---------|------|------|------------|-------|----------------|
| **Recommendation V3** | `recommendation-v3.service.ts` | 607, 1311 | **2000, 4000** | gpt-oss-20b | ✅ OK (complex reasoning) |
| **Recommendation Content** | `recommendation-content.service.ts` | 364, 453 | **2000** | (Ollama/Cerebras) | N/A |
| **Recommendation Service** | `recommendation.service.ts` | 1726, 1787 | **4000** | gpt-oss-20b | ✅ OK (strategic thinking) |

### 6. Keywords & Trending

| Service | File | Line | Max Tokens | Model | Recommendation |
|---------|------|------|------------|-------|----------------|
| **Trending Keywords** | `trending-keywords.service.ts` | 858, 904 | **2000** | gpt-oss-20b | ⚠️ Reduce to **1000-1500** |
| **Keyword Generation** | `keyword-generation.service.ts` | 149 | **2000** | (not OpenRouter) | N/A |

### 7. Brand Service

| Service | File | Line | Max Tokens | Model | Recommendation |
|---------|------|------|------------|-------|----------------|
| **Brand Service** | `brand.service.ts` | 2610, 2840 | **2000, 1000** | gpt-oss-20b | ⚠️ Review based on use case |

### 8. Data Collection

| Service | File | Line | Max Tokens | Model | Recommendation |
|---------|------|------|------------|-------|----------------|
| **Priority Collector** | `priority-collector.service.ts` | 762 | **1000** | gpt-oss-20b | ✅ OK |
| **OpenRouter Collector (content)** | `openrouter-collector.service.ts` | 86 | **4000** | gpt-oss-20b | ⚠️ Reduce to **2000** (default) |
| **OpenRouter Collector (claude)** | `openrouter-collector.service.ts` | 70 | **1024** | claude-haiku | ✅ OK |
| **OpenRouter Collector (deepseek)** | `openrouter-collector.service.ts` | 78 | **1024** | deepseek-r1 | ✅ OK |

### 9. Visibility & Movers

| Service | File | Line | Max Tokens | Model | Recommendation |
|---------|------|------|------------|-------|----------------|
| **Visibility Score** | `visibility-score.service.ts` | 532, 1565 | **500** | (not OpenRouter) | N/A |
| **Visibility Score** | `visibility-score.service.ts` | 678 | **2500** | (not OpenRouter) | N/A |

---

## High Priority Reductions (gpt-4o-mini)

These are using `gpt-4o-mini` and can be reduced significantly:

1. **Brand Intel**: 2000 → **800-1000** tokens (structured data)
2. **Brand Enrichment**: 4000 → **1500-2000** tokens (product lists)

**Estimated Cost Savings**: ~60-70% reduction in token costs for onboarding

---

## Medium Priority Reductions (gpt-oss-20b - Simple Tasks)

These are simple tasks that don't need high token limits:

1. **All Sentiment Services**: 2000-2500 → **500-800** tokens (simple JSON classification)
2. **AEO Categorization**: 2000 → **500-800** tokens (classification)
3. **Topics Generation**: 4000 → **2000-2500** tokens (structured output)
4. **Query Generation**: 2000 → **1000-1500** tokens (short queries)
5. **Trending Keywords**: 2000 → **1000-1500** tokens

**Estimated Cost Savings**: ~50-60% reduction in token costs

---

## Keep High (Complex Reasoning Tasks)

These need high token limits for complex reasoning:

1. **Consolidated Analysis**: **8192** ✅ (complex multi-step analysis)
2. **Recommendation Generation**: **4000** ✅ (strategic thinking)
3. **Recommendation V3**: **2000-4000** ✅ (complex reasoning)

---

## Recommended Actions

### Immediate (Onboarding - gpt-4o-mini)
```typescript
// llm-brand-intel.service.ts line 143
max_tokens: 1000,  // Reduced from 2000

// openrouter-collector.service.ts line 86 (content config)
maxTokens: 2000,  // Reduced from 4000
```

### Phase 1 (Simple Classification - gpt-oss-20b)
- All sentiment services: 500-800 tokens
- AEO categorization: 500-800 tokens

### Phase 2 (Structured Generation - gpt-oss-20b)
- Topics generation: 2000-2500 tokens
- Query generation: 1000-1500 tokens
- Trending keywords: 1000-1500 tokens

---

## Cost Impact Estimate

### Current Onboarding (gpt-4o-mini)
- Brand Intel: 2000 tokens × $0.15/1M = $0.0003 per call
- Brand Enrichment: 4000 tokens × $0.15/1M = $0.0006 per call
- **Total**: ~$0.0009 per onboarding

### After Reduction
- Brand Intel: 1000 tokens × $0.15/1M = $0.00015 per call
- Brand Enrichment: 2000 tokens × $0.15/1M = $0.0003 per call
- **Total**: ~$0.00045 per onboarding
- **Savings**: ~50% reduction

### Annual Impact (assuming 1000 onboardings/month)
- **Current**: $10.80/month
- **After**: $5.40/month
- **Savings**: $5.40/month = **$64.80/year**

---

## Notes

- **gpt-4o-mini** is very efficient - can handle most tasks with 500-1500 tokens
- **gpt-oss-20b** needs more tokens for reasoning, but simple tasks don't need 2000+ tokens
- Always test after reducing to ensure quality isn't impacted
- Monitor actual token usage - if responses are consistently shorter, reduce further

