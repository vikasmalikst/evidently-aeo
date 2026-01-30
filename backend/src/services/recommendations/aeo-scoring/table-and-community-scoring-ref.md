# AEO Scoring Service Reference
## Content Types: Expert Community Response & Comparison Table

**Purpose**  
This document defines scoring logic and evaluation criteria for building an **Answer Engine Optimization (AEO) Scoring Service**.  
The service evaluates content based on **AI / LLM scrapability**, citation readiness, and long-term retrieval value.

---

## 1. AEO Scoring Engine  
### Content Type: Expert Community Response  
*(Reddit · Quora · LinkedIn Threads · Forums · Comments)*

**Total Score: 100 (+5 Bonus)**

---

### 1. Question Relevance & Targeting (15)
- Response directly answers the original question
- Restates or clearly references the question context
- Matches the implied user intent (how-to, comparison, opinion, troubleshooting)

---

### 2. Early Answer Signal (15)
- Clear answer or stance in the first 2–3 sentences
- Uses declarative language (e.g., “X works because…”)
- Avoids hedging or vague qualifiers at the start

---

### 3. First-Hand Expertise Signals (15)
- Indicates lived or operational experience
- Mentions concrete constraints (cost, time, scale, limitations)
- Avoids generic or blog-style phrasing

---

### 4. Informational Density (15)
- Each paragraph adds new information
- No filler or conversational padding
- Content can be chunked and summarized independently

---

### 5. Neutral, Trustable Tone (10)
- Non-promotional and non-defensive
- Acknowledges trade-offs or downsides

---

### 6. Comparative & Contextual Reasoning (10)
- Explains *why* one option fits a specific scenario
- Avoids absolute or universal claims

---

### 7. Semantic & Terminology Clarity (10)
- Uses consistent terminology and definitions
- Avoids slang, emojis, or informal shorthand

---

### 8. Follow-Up Answer Readiness (10)
- Anticipates natural follow-up questions
- Includes clarifying details proactively

---

### 9. Reference & Verifiability (Bonus +5)
- Mentions verifiable facts, processes, or public references
- Avoids affiliate-style or spam links

---

### Expert Community Response Score Interpretation
- **85–100** → Highly AI-scrapable, citation-ready
- **70–84** → Good human response, partial AI extraction
- **<70** → Conversational, low AI reuse value

---

---

## 2. AEO Scoring Engine  
### Content Type: Comparison Table (Brand vs Competitor)

**Total Score: 100 (+5 Bonus)**

---

### 1. Comparison Intent Clarity (10)
- Clearly states what is being compared
- Identifies the target user or use case

---

### 2. Table Structure & Parsability (20)
- One attribute per row
- Identical structure across compared entities
- Attribute names are explicit and unambiguous
- No merged, decorative, or visual-only cells

---

### 3. Attribute Selection Quality (20)
- Includes functional attributes (features, limits, pricing model)
- Includes experiential attributes (support, onboarding, reliability)
- Includes constraints or exclusions
- Avoids marketing-only or vanity attributes

---

### 4. Neutral Language & Factuality (15)
- Uses factual, descriptive language
- Avoids superlatives without measurable context
- Maintains comparable units and definitions

---

### 5. Semantic Consistency (10)
- Terminology is consistent across rows and columns
- Attribute labels align with other comparison content

---

### 6. Contextual Interpretation Layer (10)
- Includes a short explanation before or after the table explaining:
  - When Entity A is a better fit
  - When Entity B is a better fit
- Avoids “winner declaration” language

---

### 7. Edge-Case & Limitation Coverage (10)
- Notes scenarios where the comparison breaks down
- Explicitly highlights trade-offs

---

### 8. Timeliness & Update Signals (5)
- Indicates time relevance (e.g., “as of 2026”)
- Signals current scope of offerings

---

### 9. LLM Extraction Readiness (Bonus +5)
- Table can be converted to plain text without loss of meaning
- Each cell represents an answerable fact

---

### Comparison Table Score Interpretation
- **90–100** → AI-ready comparison reference
- **75–89** → Human-usable, partial AI citation
- **<75** → Marketing-focused, low AI trust

---

## 3. Scoring Service Implementation Notes

- Scores should be computed per section and aggregated
- Allow partial scoring for incomplete content
- Track scores historically to measure improvement
- Use scoring thresholds to trigger content rewrites or enhancements
- Design outputs to be both human-readable and machine-consumable

---

## 4. Intended Use Cases

- Automated AEO quality checks
- Content generation validation
- Community response evaluation
- Competitive comparison benchmarking
- AI visibility optimization pipelines

---

**End of Reference Document**
