# Onboarding LLM Calls - Quick Reference

## Overview

During brand onboarding, the system makes **4 types of LLM calls**:

| # | LLM Call | Provider | When | What It Covers |
|---|----------|----------|------|----------------|
| 1 | **Brand Intelligence** | Cerebras | Always | Brand info + Competitors + Topics (all in one call) |
| 2 | **Competitor Generation** | Cerebras | Fallback only | Detailed competitor data (if #1 didn't return competitors) |
| 3 | **Topic Categorization** | Cerebras → Gemini → OpenAI | Conditional | Assigns topics to customer journey stages (awareness/comparison/purchase/support) |
| 4 | **Query Generation** | Cerebras → OpenAI | Conditional | Generates unique search queries for each topic |

---

## Flow

```
1. Brand Intelligence (Cerebras)
   └─→ Returns: Brand info + Competitors + Topics
       └─→ If competitors missing → 2. Competitor Generation (Cerebras)

3. Topic Categorization (Cerebras → Gemini → OpenAI)
   └─→ Only for uncategorized topics

4. Query Generation (Cerebras → OpenAI)
   └─→ Only if user hasn't provided queries
```

---

## Key Points

- **#1 is the main call** - combines brand info, competitors, and topics in a single LLM call
- **#2, #3, #4 are conditional** - only run when needed
- **Cerebras is primary** for all calls, with fallbacks to Gemini/OpenAI
- All calls have fallback chains to ensure onboarding completes even if LLM APIs fail

---

## File Locations

- Brand Intelligence & Competitors: `backend/src/services/onboarding-intel.service.ts`
- Topic Categorization: `backend/src/services/brand.service.ts`
- Query Generation: `backend/src/services/query-generation.service.ts`

