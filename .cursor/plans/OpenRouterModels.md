# OpenRouter Model Recommendations for Topic & Prompt Generation

## Current Model Analysis

**Current Model**: `qwen/qwen3-235b-a22b-2507`
- **Size**: 235B total parameters, 22B active (MoE architecture)
- **Use Case**: Complex reasoning, mathematics, coding, logical analysis
- **For Our Task**: **Overkill** - Too large for structured JSON generation
- **Issues**: 
  - High token costs
  - Slower response times
  - Unnecessary computational overhead

## Our Requirements

1. **Structured JSON Output** (topics + queries)
2. **15-20 Topics** with descriptions and queries
3. **Cost Efficiency** - High volume usage
4. **Fast Response Times** - User-facing feature
5. **Good JSON Compliance** - Critical for parsing

---

## Recommended Model Alternatives

### 🏆 Option 1: Qwen2.5-72B-Instruct (RECOMMENDED - Best Balance)

**Model ID**: `qwen/qwen2.5-72b-instruct`

**Specifications**:
- **Size**: 72B parameters
- **Architecture**: Standard transformer
- **Context Window**: 128K tokens
- **JSON Compliance**: Excellent

**Why It's Perfect**:
- ✅ Strong JSON compliance for structured output
- ✅ Excellent balance of quality and speed
- ✅ ~3x smaller than current model (faster, cheaper)
- ✅ Lower cost while maintaining quality
- ✅ Faster response times

**Best For**: Production use where quality matters

**Expected Improvements**:
- Token Cost: ~60-70% reduction
- Response Time: ~40-50% faster
- Quality: Similar or better for structured tasks

---

### 💰 Option 2: Qwen2.5-32B-Instruct (MOST COST-EFFECTIVE)

**Model ID**: `qwen/qwen2.5-32b-instruct`

**Specifications**:
- **Size**: 32B parameters
- **Architecture**: Standard transformer
- **Context Window**: 128K tokens
- **JSON Compliance**: Very Good

**Why It's Perfect**:
- ✅ Very cost-effective (~7x smaller than current)
- ✅ Fast response times
- ✅ Good JSON compliance
- ✅ Excellent quality for topic generation
- ✅ Best value for money

**Best For**: High-volume, cost-sensitive production use

**Expected Improvements**:
- Token Cost: ~70-80% reduction
- Response Time: ~50-60% faster
- Quality: Very good for structured tasks

---

### ⚡ Option 3: GPT-4o Mini (MOST RELIABLE)

**Model ID**: `openai/gpt-4o-mini`

**Specifications**:
- **Size**: Small, optimized
- **Architecture**: OpenAI proprietary
- **Context Window**: 128K tokens
- **JSON Compliance**: Excellent
- **Pricing**: $0.15/$0.60 per 1M tokens (input/output)

**Why It's Perfect**:
- ✅ Excellent JSON compliance (OpenAI's strength)
- ✅ Very fast response times
- ✅ Very low cost
- ✅ Highly reliable for production
- ✅ Great for structured output

**Best For**: Maximum cost efficiency and reliability

**Expected Improvements**:
- Token Cost: ~80-90% reduction
- Response Time: ~60-70% faster
- Quality: Excellent for structured tasks

---

### 🚀 Option 4: Qwen2.5-14B-Instruct (ULTRA-FAST)

**Model ID**: `qwen/qwen2.5-14b-instruct`

**Specifications**:
- **Size**: 14B parameters
- **Architecture**: Standard transformer
- **Context Window**: 128K tokens
- **JSON Compliance**: Good

**Why It's Perfect**:
- ✅ Very fast response times
- ✅ Very low cost
- ✅ Good for structured output
- ✅ May need more prompt engineering

**Best For**: Speed-critical scenarios, high-volume simple tasks

**Expected Improvements**:
- Token Cost: ~85-90% reduction
- Response Time: ~70-80% faster
- Quality: Good (may need prompt tuning)

---

### 🔬 Option 5: DeepSeek-R1-Distill-Qwen (EXPERIMENTAL)

**Model ID**: `deepseek/deepseek-r1-distill-qwen-1.5b`

**Specifications**:
- **Size**: 1.5B parameters (very small)
- **Architecture**: Distilled model
- **JSON Compliance**: Good for simple tasks

**Why Consider It**:
- ✅ Extremely fast and cheap
- ✅ Good for simple structured tasks
- ⚠️ May need validation for complex topics
- ⚠️ Quality may vary

**Best For**: Testing, very high-volume simple cases

---

## Comparison Table

| Model | Size | Speed | Cost | JSON Quality | Reliability | Recommendation |
|-------|------|-------|------|--------------|-------------|----------------|
| **Current: qwen3-235b** | 235B | ⭐⭐ Slow | 💰💰💰 High | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ **Overkill** |
| **Qwen2.5-72B** | 72B | ⭐⭐⭐⭐ Fast | 💰💰 Medium | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **Best Balance** |
| **Qwen2.5-32B** | 32B | ⭐⭐⭐⭐⭐ Very Fast | 💰 Low | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ **Most Cost-Effective** |
| **GPT-4o Mini** | Small | ⭐⭐⭐⭐⭐ Very Fast | 💰 Very Low | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **Most Reliable** |
| **Qwen2.5-14B** | 14B | ⭐⭐⭐⭐⭐ Ultra Fast | 💰 Very Low | ⭐⭐⭐ | ⭐⭐⭐ | ⚠️ May need tuning |

---

## Final Recommendations

### 🥇 Primary Recommendation: Qwen2.5-32B-Instruct

**Model**: `qwen/qwen2.5-32b-instruct`

**Why**:
1. **7x smaller** than current model (faster, cheaper)
2. **Strong JSON compliance** for structured output
3. **Excellent quality** for topic generation
4. **Cost-effective** for high volume
5. **Fast response times**

**Expected Impact**:
- Token Cost: **~70-80% reduction**
- Response Time: **~50-60% faster**
- Quality: **Similar or better** for structured JSON tasks
- Reliability: **Similar or better**

---

### 🥈 Alternative: GPT-4o Mini (If Maximum Reliability Needed)

**Model**: `openai/gpt-4o-mini`

**Why**:
1. **Excellent JSON compliance** (OpenAI's strength)
2. **Very low cost** ($0.15/$0.60 per 1M tokens)
3. **Very fast** response times
4. **Highly reliable** for production
5. **Proven track record** for structured output

**Expected Impact**:
- Token Cost: **~80-90% reduction**
- Response Time: **~60-70% faster**
- Quality: **Excellent** for structured tasks
- Reliability: **Excellent**

---

## Implementation Guide

### File Locations to Update

#### 1. Topic Generation Service
**File**: `backend/src/services/topics-query-generation.service.ts`
- **Line 43**: Change default model
```typescript
const defaultModel = 'qwen/qwen2.5-32b-instruct'; // or 'openai/gpt-4o-mini'
```

#### 2. Prompt Generation Route
**File**: `backend/src/routes/onboarding.routes.ts`
- **Line 580**: Change default model
```typescript
const openRouterModel = process.env['OPENROUTER_MODEL'] || 'qwen/qwen2.5-32b-instruct';
```

### Environment Variable Override

You can override via environment variables:
```bash
# For topics generation
OPENROUTER_TOPICS_MODEL=qwen/qwen2.5-32b-instruct

# For prompts generation
OPENROUTER_MODEL=qwen/qwen2.5-32b-instruct
```

---

## Testing Plan

1. **Phase 1**: Test Qwen2.5-32B with current prompts
   - Monitor token usage
   - Check response quality
   - Measure response times

2. **Phase 2**: If quality is insufficient, try Qwen2.5-72B
   - Better quality, slightly higher cost
   - Still much better than current

3. **Phase 3**: If cost is critical, try GPT-4o Mini
   - Maximum cost savings
   - Excellent reliability

4. **Phase 4**: Optimize prompts for chosen model
   - Reduce prompt length
   - Fine-tune instructions
   - Further reduce token usage

---

## Cost Comparison (Estimated)

Based on typical topic generation request:
- **Input tokens**: ~800-1000 tokens (prompt)
- **Output tokens**: ~2000-3000 tokens (15-20 topics with queries)

| Model | Input Cost/1M | Output Cost/1M | Per Request Cost | Monthly (1000 req) |
|-------|---------------|----------------|------------------|-------------------|
| **qwen3-235b** | ~$2.00 | ~$8.00 | ~$0.025 | ~$25 |
| **Qwen2.5-72B** | ~$0.50 | ~$2.00 | ~$0.006 | ~$6 |
| **Qwen2.5-32B** | ~$0.30 | ~$1.20 | ~$0.004 | ~$4 |
| **GPT-4o Mini** | $0.15 | $0.60 | ~$0.002 | ~$2 |

*Note: Actual pricing may vary. Check OpenRouter pricing page for latest rates.*

---

## Migration Checklist

- [ ] Update `topics-query-generation.service.ts` (Line 43)
- [ ] Update `onboarding.routes.ts` (Line 580)
- [ ] Test with sample brand/industry
- [ ] Monitor token usage in logs
- [ ] Verify JSON parsing still works
- [ ] Check response quality
- [ ] Measure response times
- [ ] Update environment variables if needed
- [ ] Deploy to staging
- [ ] Monitor production metrics

---

## Notes

- All recommended models support 128K+ context windows (sufficient for our use case)
- JSON compliance is critical - test thoroughly before switching
- Consider A/B testing between models if unsure
- Monitor costs and quality metrics after migration
- Keep current model as fallback if needed

---

## References

- OpenRouter Models: https://openrouter.ai/models
- Qwen Models: https://huggingface.co/Qwen
- GPT-4o Mini: https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/

