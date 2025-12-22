# Token Usage & Cost Analysis: Consolidated LLM Call

## Overview
This document provides detailed token usage estimates and cost calculations for the consolidated LLM call using OpenAI GPT-4o-mini model.

---

## Token Usage Breakdown

### Input Tokens (Prompt)

#### Base Prompt Structure
- **System instructions**: ~200 tokens
- **Task descriptions**: ~400 tokens
- **Rules and examples**: ~300 tokens
- **Output format specification**: ~200 tokens
- **Subtotal (base)**: ~1,100 tokens

#### Variable Components

**1. Brand Information**
- Brand name: ~5 tokens
- Brand metadata (600 chars): ~150 tokens
- **Subtotal**: ~155 tokens

**2. Competitor Information**
- Competitor names (3 competitors): ~15 tokens
- Competitor metadata (200 chars × 3): ~150 tokens
- **Subtotal**: ~165 tokens

**3. Citations**
- Citation URLs (5 citations, ~50 chars each): ~125 tokens
- **Subtotal**: ~125 tokens

**4. Answer Text** (Variable - largest component)
- Short answer (500 words): ~650 tokens
- Medium answer (1,500 words): ~1,950 tokens
- Long answer (3,000 words): ~3,900 tokens
- Very long answer (5,000 words): ~6,500 tokens

#### Total Input Tokens by Answer Length

| Answer Length | Base | Brand | Competitors | Citations | Answer Text | **Total Input** |
|--------------|------|-------|-------------|-----------|-------------|-----------------|
| **Short (500 words)** | 1,100 | 155 | 165 | 125 | 650 | **~2,195 tokens** |
| **Medium (1,500 words)** | 1,100 | 155 | 165 | 125 | 1,950 | **~3,495 tokens** |
| **Long (3,000 words)** | 1,100 | 155 | 165 | 125 | 3,900 | **~5,445 tokens** |
| **Very Long (5,000 words)** | 1,100 | 155 | 165 | 125 | 6,500 | **~9,045 tokens** |

**Note**: These are estimates. Actual token counts may vary based on:
- Special characters and formatting
- Code blocks or structured content
- Language (non-English may use more tokens)

---

### Output Tokens (Response)

#### Base JSON Structure
- JSON structure overhead: ~50 tokens
- **Subtotal**: ~50 tokens

#### Products Section
- Brand products (8 products, ~10 chars each): ~80 tokens
- Competitor products (3 competitors × 5 products × 10 chars): ~150 tokens
- **Subtotal**: ~230 tokens

#### Citations Section
- Citation categorization (5 citations × 30 chars): ~150 tokens
- **Subtotal**: ~150 tokens

#### Sentiment Section
- Brand sentiment (label + score + 3 positive + 2 negative sentences): ~200 tokens
- Competitor sentiment (3 competitors × 150 tokens each): ~450 tokens
- **Subtotal**: ~650 tokens

#### Total Output Tokens

| Component | Tokens |
|-----------|--------|
| JSON structure | 50 |
| Products | 230 |
| Citations | 150 |
| Sentiment | 650 |
| **Total Output** | **~1,080 tokens** |

**Note**: Output tokens can vary based on:
- Number of products found
- Number of citations
- Number of sentiment sentences extracted
- Length of sentences

**Range**: ~800 tokens (minimal) to ~2,000 tokens (comprehensive)

---

## Total Token Usage Summary

### Typical Scenarios

| Scenario | Answer Length | Input Tokens | Output Tokens | **Total Tokens** |
|----------|---------------|--------------|---------------|------------------|
| **Small** | 500 words | 2,195 | 1,080 | **~3,275 tokens** |
| **Medium** | 1,500 words | 3,495 | 1,080 | **~4,575 tokens** |
| **Large** | 3,000 words | 5,445 | 1,080 | **~6,525 tokens** |
| **Very Large** | 5,000 words | 9,045 | 1,080 | **~10,125 tokens** |

### Average Case
- **Input**: ~3,500 tokens (medium answer)
- **Output**: ~1,080 tokens
- **Total**: **~4,580 tokens per collector result**

---

## Cost Calculation: OpenAI GPT-4o-mini

### Pricing (as of 2024)
- **Input tokens**: $0.15 per million tokens
- **Output tokens**: $0.60 per million tokens

### Cost Per Collector Result

| Scenario | Input Tokens | Output Tokens | Input Cost | Output Cost | **Total Cost** |
|----------|--------------|---------------|------------|-------------|----------------|
| **Small** | 2,195 | 1,080 | $0.000329 | $0.000648 | **$0.000977** |
| **Medium** | 3,495 | 1,080 | $0.000524 | $0.000648 | **$0.001172** |
| **Large** | 5,445 | 1,080 | $0.000817 | $0.000648 | **$0.001465** |
| **Very Large** | 9,045 | 1,080 | $0.001357 | $0.000648 | **$0.002005** |

### Average Cost
- **Input**: 3,500 tokens × $0.15/1M = **$0.000525**
- **Output**: 1,080 tokens × $0.60/1M = **$0.000648**
- **Total**: **~$0.001173 per collector result**

---

## Cost Comparison: Current vs Consolidated

### Current Approach (Separate Calls)

#### Token Usage (per collector result)
- Brand products: 700 tokens
- Citation categorization: 100 tokens × 5 citations = 500 tokens
- Brand sentiment: 1,300 tokens
- Competitor sentiment: 800 tokens × 3 competitors = 2,400 tokens
- **Total**: ~4,900 tokens

#### Cost (GPT-4o-mini)
- **Input**: 4,900 tokens × $0.15/1M = **$0.000735**
- **Output**: ~1,500 tokens × $0.60/1M = **$0.000900**
- **Total**: **~$0.001635 per collector result**

### Consolidated Approach

#### Token Usage (per collector result)
- **Input**: ~3,500 tokens
- **Output**: ~1,080 tokens
- **Total**: ~4,580 tokens

#### Cost (GPT-4o-mini)
- **Input**: 3,500 tokens × $0.15/1M = **$0.000525**
- **Output**: 1,080 tokens × $0.60/1M = **$0.000648**
- **Total**: **~$0.001173 per collector result**

### Savings
- **Token reduction**: ~320 tokens (6.5% reduction)
- **Cost reduction**: **~$0.000462 per result (28% savings)**
- **API calls**: 5 calls → 1 call (80% reduction)

---

## Monthly Cost Projections

### Assumptions
- **Collector results per month**: 10,000
- **Average answer length**: 1,500 words (medium)
- **Average citations**: 5 per result
- **Average competitors**: 3 per result

### Current Approach (Separate Calls)
- Cost per result: $0.001635
- **Monthly cost**: 10,000 × $0.001635 = **$16.35/month**

### Consolidated Approach
- Cost per result: $0.001173
- **Monthly cost**: 10,000 × $0.001173 = **$11.73/month**

### Monthly Savings
- **Savings**: $16.35 - $11.73 = **$4.62/month**
- **Annual savings**: **~$55.44/year**

### At Scale (100,000 results/month)
- Current: $163.50/month
- Consolidated: $117.30/month
- **Savings**: **$46.20/month** (~$554/year)

---

## Cost Breakdown by Component

### Consolidated Call (Medium Answer)

| Component | Input Tokens | Output Tokens | Input Cost | Output Cost | Total Cost |
|-----------|--------------|---------------|------------|-------------|------------|
| **Base prompt** | 1,100 | - | $0.000165 | - | $0.000165 |
| **Brand info** | 155 | - | $0.000023 | - | $0.000023 |
| **Competitor info** | 165 | - | $0.000025 | - | $0.000025 |
| **Citations** | 125 | - | $0.000019 | - | $0.000019 |
| **Answer text** | 1,950 | - | $0.000293 | - | $0.000293 |
| **Products output** | - | 230 | - | $0.000138 | $0.000138 |
| **Citations output** | - | 150 | - | $0.000090 | $0.000090 |
| **Sentiment output** | - | 650 | - | $0.000390 | $0.000390 |
| **JSON structure** | - | 50 | - | $0.000030 | $0.000030 |
| **TOTAL** | **3,495** | **1,080** | **$0.000525** | **$0.000648** | **$0.001173** |

---

## Optimization Opportunities

### 1. Truncate Long Answers
**Strategy**: Limit answer text to first 2,000 words (most relevant)

**Impact**:
- Input tokens: 3,495 → 2,545 (saves ~950 tokens)
- Cost savings: ~$0.000143 per result
- **Risk**: May miss important information later in text

### 2. Batch Citation Categorization
**Strategy**: Only categorize citations not in hardcoded patterns

**Impact**:
- Reduces prompt size if many citations are known domains
- **Benefit**: Slight token reduction

### 3. Limit Competitor Analysis
**Strategy**: Only analyze top 3 competitors (if more exist)

**Impact**:
- Reduces output tokens: ~150 tokens per extra competitor
- **Benefit**: Lower costs for brands with many competitors

### 4. Use Streaming for Large Responses
**Strategy**: Stream response to reduce latency

**Impact**:
- No cost savings, but better user experience
- **Benefit**: Faster perceived response time

---

## Cost Comparison: GPT-4o-mini vs Claude Sonnet 4.5

### Claude Sonnet 4.5 Pricing (as of 2024)
- **Input tokens**: $3.00 per million tokens
- **Output tokens**: $15.00 per million tokens

### Cost Per Collector Result (Medium Answer)

#### GPT-4o-mini
- Input: 3,500 tokens × $0.15/1M = $0.000525
- Output: 1,080 tokens × $0.60/1M = $0.000648
- **Total**: **$0.001173**

#### Claude Sonnet 4.5
- Input: 3,500 tokens × $3.00/1M = $0.0105
- Output: 1,080 tokens × $15.00/1M = $0.0162
- **Total**: **$0.0267**

### Comparison
- **GPT-4o-mini is ~23x cheaper** than Claude Sonnet 4.5
- **Monthly cost (10K results)**:
  - GPT-4o-mini: $11.73
  - Claude Sonnet 4.5: $267.00
  - **Difference**: $255.27/month

### Trade-offs
- **GPT-4o-mini**: Much cheaper, good quality, structured output support
- **Claude Sonnet 4.5**: Higher quality, better reasoning, more expensive

**Recommendation**: Start with GPT-4o-mini for cost efficiency, upgrade to Claude if quality issues arise.

---

## Token Usage by Answer Length (Detailed)

### Short Answer (500 words)

```
Base prompt:           1,100 tokens
Brand info:              155 tokens
Competitor info:         165 tokens
Citations (5):           125 tokens
Answer text (500 words): 650 tokens
────────────────────────────────────
Total input:           2,195 tokens

Products:                230 tokens
Citations:               150 tokens
Sentiment:               650 tokens
JSON structure:           50 tokens
────────────────────────────────────
Total output:          1,080 tokens

TOTAL:                 3,275 tokens
COST:                  $0.000977
```

### Medium Answer (1,500 words)

```
Base prompt:           1,100 tokens
Brand info:              155 tokens
Competitor info:         165 tokens
Citations (5):           125 tokens
Answer text (1,500 words): 1,950 tokens
────────────────────────────────────
Total input:           3,495 tokens

Products:                230 tokens
Citations:               150 tokens
Sentiment:               650 tokens
JSON structure:           50 tokens
────────────────────────────────────
Total output:          1,080 tokens

TOTAL:                 4,575 tokens
COST:                  $0.001172
```

### Long Answer (3,000 words)

```
Base prompt:           1,100 tokens
Brand info:              155 tokens
Competitor info:         165 tokens
Citations (5):           125 tokens
Answer text (3,000 words): 3,900 tokens
────────────────────────────────────
Total input:           5,445 tokens

Products:                230 tokens
Citations:               150 tokens
Sentiment:               650 tokens
JSON structure:           50 tokens
────────────────────────────────────
Total output:          1,080 tokens

TOTAL:                 6,525 tokens
COST:                  $0.001465
```

### Very Long Answer (5,000 words)

```
Base prompt:           1,100 tokens
Brand info:              155 tokens
Competitor info:         165 tokens
Citations (5):           125 tokens
Answer text (5,000 words): 6,500 tokens
────────────────────────────────────
Total input:           9,045 tokens

Products:                230 tokens
Citations:               150 tokens
Sentiment:               650 tokens
JSON structure:           50 tokens
────────────────────────────────────
Total output:          1,080 tokens

TOTAL:                10,125 tokens
COST:                  $0.002005
```

---

## Recommendations

### 1. Use GPT-4o-mini for Cost Efficiency
- **23x cheaper** than Claude Sonnet 4.5
- Good quality for structured output tasks
- Sufficient for product extraction, categorization, sentiment

### 2. Implement Answer Truncation
- Limit to first 2,000-3,000 words
- Most relevant information is usually at the beginning
- **Savings**: ~$0.000143 per result

### 3. Monitor Token Usage
- Track actual vs estimated tokens
- Adjust truncation limits based on data
- Optimize prompt if token usage is higher than expected

### 4. Consider Caching
- Cache results per collector result ID
- Avoid re-processing same answers
- **Savings**: 100% for cached results

### 5. Batch Processing
- Process multiple results in parallel
- Better throughput
- No cost savings, but better performance

---

## Summary

### Token Usage (Average)
- **Input**: ~3,500 tokens
- **Output**: ~1,080 tokens
- **Total**: **~4,580 tokens per collector result**

### Cost (GPT-4o-mini)
- **Per result**: **~$0.001173**
- **Per 1,000 results**: **~$1.17**
- **Per 10,000 results**: **~$11.73**

### Savings vs Current Approach
- **28% cost reduction** per result
- **80% reduction** in API calls
- **Better consistency** (single source of truth)

### Recommendation
**Use GPT-4o-mini** for the consolidated call:
- Cost-effective ($0.001173 per result)
- Good quality for structured tasks
- Structured output support
- 23x cheaper than Claude Sonnet 4.5



