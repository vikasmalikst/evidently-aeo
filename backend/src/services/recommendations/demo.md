You are a Brand/AEO expert. Use the data below to create one recommendation per detected problem (max 10). Return ONLY a JSON array.

RULES (short)
- citationSource must be a domain from "Top Citation Sources" (never an LLM). If any source is missing/LLM, replace with the closest domain from that list before responding.
- Use numeric scores as provided (0–100 scales). Do NOT add % signs. Only expectedBoost should use percent style like "+0.1-0.3%". confidence is integer 0-100. timeline is a range ("2-4 weeks", "4-6 weeks").
- Sentiment banding (1–100): <55 negative, 55–65 watch, >65 good.
- **CRITICAL**: Every "reason" field MUST start with the problem ID in brackets like "[P1]", "[P2]", etc. Example: "[P1] Visibility is 0.4% vs 0.5% avg. Targeting reddit.com will improve citations."
- Each reason must reference the problem ID and real numbers; tie the action to a domain + content focus that moves the KPI.

Brand
- Name: SanDisk
- Industry: Data Storage
- Visibility: 0.3 (weak visibility)
- SOA: 50.7 (strong share)
- Sentiment: 82.8 (good)

Trends (30d vs prev)
- No trend data

Competitors
  No competitor data

LLM Performance (reference only; NOT sources)
  Perplexity | Visibility 0.3 | SOA 58 | Sentiment 80.4 | (61 responses)
  ChatGPT | Visibility 0.3 | SOA 44.9 | Sentiment 84.7 | (62 responses)
  Google AIO | Visibility 0.4 | SOA 56.9 | Sentiment 87.4 | (61 responses)
  Grok | Visibility 0.3 | SOA 47.8 | Sentiment 73.8 | (21 responses)
  Gemini | Visibility 0.3 | SOA 42.9 | Sentiment 84.5 | (60 responses)
  Bing Copilot | Visibility 0.3 | SOA 54.8 | Sentiment 73.5 | (20 responses)

Top Citation Sources (use only these domains)
  No source data available

Detected Problems (7)
[P1] Overall visibility index is 32.2, which is below the recommended 50 threshold
[P2] Brand has very low visibility (0.3%) in Perplexity responses (based on 61 queries) | LLM: Perplexity
[P3] Brand has very low visibility (0.3%) in ChatGPT responses (based on 62 queries) | LLM: ChatGPT
[P4] Brand has very low visibility (0.4%) in Google AIO responses (based on 61 queries) | LLM: Google AIO
[P5] Brand has very low visibility (0.3%) in Grok responses (based on 21 queries) | LLM: Grok
[P6] Brand has very low visibility (0.3%) in Gemini responses (based on 60 queries) | LLM: Gemini
[P7] Brand has very low visibility (0.3%) in Bing Copilot responses (based on 20 queries) | LLM: Bing Copilot

Your Task (JSON objects need):
- action
- reason (MUST start with problem ID like "[P1]", "[P2]" - this is REQUIRED)
- explanation (4-5 sentences)
- citationSource (domain from Top Citation Sources)
- impactScore, mentionRate, soa, sentiment, visibilityScore (0–100 scores), citationCount
- focusSources (domains), contentFocus
- kpi ("Visibility Index" | "SOA %" | "Sentiment Score")
- expectedBoost (+0.1-0.3% style), effort (Low/Medium/High), timeline ("2-4 weeks" etc.), confidence (0-100 int), priority (High/Medium/Low), focusArea (visibility/soa/sentiment), citationCategory (Priority Partnerships | Reputation Management | Growth Opportunities | Monitor)

VALID example (with problem ID):
[{"action":"Partner with reddit.com on enterprise storage Q&A","reason":"[P1] Visibility is 0.4% vs 0.5% avg. Reddit has 220 citations, so targeting it will improve citations.","citationSource":"reddit.com"}]
INVALID examples (will be rejected):
[{"reason":"Visibility is low, need to improve"}]
[{"citationSource":"Google AIO"}]