# Grounded Content Generation Strategy

> **Goal**: Eliminate LLM hallucination in generated content by injecting real-time web research before content generation.

---

## 1. Problem Statement

Our content generation pipeline currently sends prompts directly to an LLM without factual grounding. The model invents statistics, fabricates product features, and produces plausible-sounding but unverifiable claims. This undermines content credibility and AEO scoring quality.

---

## 2. Solution Overview

Add a **research step** between strategy generation and content generation. The LLM generates fact-grounded content using verified web research as its source material.

### New Pipeline (3 Steps)

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Strategy Generation (Existing LLM Call — Modified)     │
│  Input:  recommendation, brand, competitors, assetType          │
│  Output: content plan + sections + research_queries[]    ← NEW  │
│  Cost:   ~$0.0005 extra (50 tokens)                             │
│  Time:   0s extra (same call)                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ research_queries[]
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Web Research (NEW — Brave AI Grounding / Serper)       │
│  Input:  2-3 research queries (run in parallel)                 │
│  Output: facts, statistics, citations, source URLs              │
│  Cost:   $0.008–$0.027 per content piece                        │
│  Time:   2-3 seconds (parallel execution)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ research_context
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Content Generation (Existing LLM Call — Modified)      │
│  Input:  content plan + research_context + existing prompt       │
│  Output: full article/whitepaper/video script (fact-grounded)   │
│  Cost:   existing LLM cost (unchanged)                          │
│  Time:   15-25 seconds (unchanged)                              │
└─────────────────────────────────────────────────────────────────┘
```

**Total added cost**: ~$0.01–$0.03 per content piece  
**Total added time**: ~2-3 seconds

---

## 3. Implementation Details

### 3.1 Step 1: Modify Strategy Generation Prompt

**File**: `backend/src/services/recommendations/template-generation.service.ts`  
**Function**: `buildPlannerPrompt()`

**Change**: Add `research_queries` to the LLM output schema.

```diff
 // In the prompt instructions, add:
 "Output a JSON object with:
   - sections: array of content sections with headings and instructions
   - aeo_targets: key AEO optimization targets
+  - research_queries: array of 2-3 web search queries that would help
+    ground this content in real, verifiable facts. Queries should target:
+    (1) topic-specific data/statistics,
+    (2) brand-specific features/capabilities,
+    (3) competitive landscape or market trends.
+    Make queries specific and search-engine friendly."
```

**Expected output addition**:
```json
{
  "sections": [...],
  "aeo_targets": [...],
  "research_queries": [
    "Smartcat AI translation platform enterprise features pricing 2026",
    "AI translation vs human translation ROI statistics research",
    "Smartcat vs Phrase vs Crowdin enterprise translation comparison"
  ]
}
```

**Fallback**: If the LLM fails to produce `research_queries`, use heuristic templates:
```javascript
function fallbackResearchQueries(topic, brand, competitor, assetType) {
  return [
    `${topic} statistics data research 2026`,
    `${brand} ${topic} capabilities features`,
    `${brand} vs ${competitor} ${topic} comparison`
  ];
}
```

---

### 3.2 Step 2: Execute Web Research

**New File**: `backend/src/services/recommendations/web-research.service.ts`

#### Option A: Brave AI Grounding (Recommended Start)

```typescript
interface ResearchResult {
  query: string;
  answer: string;       // Brave's summarized answer (~300 tokens)
  citations: { url: string; title: string }[];
}

async function executeResearch(queries: string[]): Promise<ResearchResult[]> {
  const results = await Promise.all(
    queries.map(query =>
      fetch('https://api.search.brave.com/res/v1/ai/chat', {
        method: 'POST',
        headers: {
          'X-Subscription-Token': process.env.BRAVE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: query, stream: false })
      }).then(r => r.json())
    )
  );
  return results;
}
```

**Pricing**: $0.004–$0.009/query | Free tier: 5,000 queries/month  
**Latency**: ~2-3s (all queries run in parallel via `Promise.all`)

#### Option B: Serper.dev (Cheapest Alternative)

```typescript
async function executeResearch(queries: string[]): Promise<ResearchResult[]> {
  const results = await Promise.all(
    queries.map(query =>
      fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query, num: 5 })
      }).then(r => r.json())
    )
  );
  // Returns raw Google snippets — needs formatting into context block
  return results.map(r => ({
    query: r.searchParameters.q,
    answer: r.organic.map(o => `${o.title}: ${o.snippet}`).join('\n'),
    citations: r.organic.map(o => ({ url: o.link, title: o.title }))
  }));
}
```

**Pricing**: $0.001/query | Free tier: 2,500 queries/month

> **Note**: Brave returns pre-summarized answers (better quality, higher cost).  
> Serper returns raw Google snippets (cheaper, needs more prompt engineering in Step 3).

---

### 3.3 Step 2.5: Build Research Context Block

Merge all research results into a single context string for the content LLM:

```typescript
function buildResearchContext(results: ResearchResult[]): string {
  let context = '## VERIFIED RESEARCH (Use these facts only)\n\n';
  
  for (const result of results) {
    context += `### Research: ${result.query}\n`;
    context += `${result.answer}\n`;
    context += `Sources: ${result.citations.map(c => c.url).join(', ')}\n\n`;
  }
  
  context += '## IMPORTANT RULES\n';
  context += '- Only use facts from the research above\n';
  context += '- Do NOT invent statistics or claims not in the research\n';
  context += '- Cite sources inline where possible\n';
  
  return context;
}
```

---

### 3.4 Step 3: Modify Content Generation Prompt

**File**: `backend/src/services/recommendations/new-content-factory.ts`

**Change**: Inject `research_context` into the content generation prompt.

```diff
 function buildContentPrompt(plan, brand, assetType) {
   const systemPrompt = buildSystemContext(brand);
+  const researchContext = plan.research_context; // from Step 2
   const contentPrompt = getAssetPrompt(assetType, plan);
   
   return {
     system: systemPrompt,
-    user: contentPrompt
+    user: `${researchContext}\n\n---\n\n${contentPrompt}`
   };
 }
```

---

## 4. Environment Variables

Add to `backend/.env`:
```bash
# Option A: Brave AI Grounding
BRAVE_API_KEY=your_brave_api_key_here

# Option B: Serper.dev  
SERPER_API_KEY=your_serper_api_key_here

# Feature flag
ENABLE_WEB_RESEARCH=true
```

---

## 5. Cost Summary

| Component | Cost Per Piece | 100/month | 500/month |
|-----------|---------------|-----------|-----------|
| Research queries in strategy call | ~$0.0005 | $0.05 | $0.25 |
| Brave AI Grounding (3 queries) | ~$0.015 | $1.50 | $7.50 |
| OR Serper.dev (3 queries) | ~$0.003 | $0.30 | $1.50 |
| Content LLM (unchanged) | ~$0.003–$0.05 | $0.30–$5.00 | $1.50–$25.00 |
| **Total with Brave** | **~$0.019–$0.066** | **$1.85–$6.55** | **$9.25–$32.75** |
| **Total with Serper** | **~$0.007–$0.054** | **$0.65–$5.35** | **$3.25–$26.75** |

---

## 6. Files to Modify

| File | Change |
|------|--------|
| `template-generation.service.ts` | Add `research_queries` to strategy prompt output schema |
| `web-research.service.ts` | **NEW** — Brave/Serper integration + context builder |
| `new-content-factory.ts` | Inject `research_context` into content prompts |
| `ecosystem.config.js` | Add `BRAVE_API_KEY` / `SERPER_API_KEY` env vars |
| `.env` | Add API keys + feature flag |

---

## 7. Implementation Order

1. **Add `research_queries` to strategy generation prompt** (~30 min)
2. **Create `web-research.service.ts`** with Brave or Serper integration (~1-2 hours)
3. **Inject research context into content factory** (~30 min)
4. **Add env vars and feature flag** (~15 min)
5. **Test with 3-5 content pieces**, compare quality before/after (~1 hour)
6. **Deploy** (~30 min)

**Estimated total**: 4-5 hours of dev work

---

## 8. Success Metrics

- Content pieces contain verifiable facts with source URLs
- AEO score improvement (fewer hallucinated claims)
- No significant increase in generation time (< 3s added)
- Content generation cost stays under $0.10/piece