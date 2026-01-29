# AEO Article Scoring Engine – Internal Research & Direction
Version: 1.0  
Owner: Product / AEO  
Scope: Article / Blog content only  
Status: Reference Specification (not implementation)

---

## 1. Context & Intent

We currently score article content using SEO-style heuristics
(word count, readability, brand mentions, CTAs, etc.).

This approach is **insufficient and partially incorrect for AEO**.

AEO (Answer Engine Optimization) scoring must measure whether
**AI systems (LLMs)** can confidently:
- Parse the content
- Extract answers
- Reuse explanations
- Cite the article as a reference

This document defines **what an AEO article scoring engine should measure**
and how our current approach should evolve.

---

## 2. What AEO Scoring Is (and Is Not)

### AEO Scoring IS:
- A measure of **AI scrapability**
- A measure of **answer readiness**
- A measure of **semantic clarity and reuse**
- A reference-quality assessment

### AEO Scoring IS NOT:
- SEO ranking prediction
- Keyword optimization
- Conversion optimization
- Engagement scoring
- CTA effectiveness

If a scoring rule exists primarily for marketing or SEO,
it should **not** influence AEO scoring.

---

## 3. Core Mental Model (Alignment Requirement)

Before implementation, the team should align on this statement:

> “AEO scoring measures how well an article can be reused by AI systems
> as an answer — not how persuasive or promotional it is.”

This alignment is critical. Without it, scoring will drift back to SEO logic.

---

## 4. High-Level Scoring Architecture

**Total Score: 100 points**

The score is intentionally split into two layers:


### Why this split exists:
- Hygiene ensures basic quality
- Scrapability measures AI usefulness
- Semantic scoring must outweigh surface metrics

---

## 5. Layer 1: Content Hygiene Score (30 pts)

**Purpose:** Baseline structural quality  
**Implementation:** Frontend  
**Nature:** Deterministic, rule-based

This layer answers:
> “Is this content clean, readable, and structurally sane?”

### Hygiene Dimensions:
- Minimum viable length
- Readable sentence structure
- Presence of headings and lists
- Short, parseable paragraphs
- Absence of spammy patterns

### Important Notes:
- Hygiene ≠ AEO
- This layer alone must never be labeled “AEO”
- This layer should NOT attempt semantic reasoning

---

## 6. Layer 2: AI Scrapability Score (70 pts)

**Purpose:** Measure AI reuse confidence  
**Implementation:** Backend  
**Nature:** Semantic, heuristic-based (v1)

This layer answers:
> “Would an LLM confidently reuse this article as an answer source?”

This is the **core AEO layer**.

---

## 7. AEO Article Scrapability Dimensions (Canonical)

The following dimensions fully define what an AEO-ready article is.

### 7.1 Primary Answer Presence
- One clear primary user question exists
- The question is answered explicitly
- The answer appears early in the article
- The answer is self-contained and quotable

If this is missing, the article is **not AEO-ready**.

---

### 7.2 Section Chunkability
- Content is organized into meaningful sections
- Each section is understandable in isolation
- Headings express intent or answers, not fluff

LLMs consume content in chunks, not as a single narrative.

---

### 7.3 Concept Definition & Clarity
- Key concepts are explicitly defined
- Definitions appear before evaluation or comparison
- Terminology is consistent across the article

Assertions without definitions reduce AI trust.

---

### 7.4 Explanation Depth (Why, Not Just What)
- The article explains *why* something works
- Mechanisms, processes, or logic are described
- Cause-and-effect relationships are clear

AI systems reuse explanations, not slogans.

---

### 7.5 Comparison & Trade-Off Readiness
- Alternatives or competitors are discussed where relevant
- Multiple comparison dimensions are used
- Limitations and downsides are acknowledged explicitly

Content that admits trade-offs is more trusted by AI.

---

### 7.6 Authority & Trust Signals
- Concrete details are present (processes, constraints)
- Real-world conditions or edge cases are mentioned
- The tone is calm, factual, and explanatory

Authority comes from specificity, not confidence.

---

### 7.7 Anti-Marketing Discipline
The following reduce AEO quality and should be penalized:
- CTAs (click, sign up, buy, download)
- Marketing language or hype
- Vague superiority claims (“best”, “leading”)
- Brand repetition without explanation

Reference content ≠ conversion content.

---

## 8. Frontend vs Backend Responsibilities

### Frontend (Content Hygiene Only)
- Length checks
- Readability checks
- Structural markers
- Formatting issues
- Spam detection

Frontend should NOT attempt:
- Semantic interpretation
- Concept detection
- Comparison logic
- Answer evaluation

---

### Backend (AI Scrapability)
- Primary answer detection
- Concept definition heuristics
- Comparison readiness
- Trade-off acknowledgment
- Authority signal detection

Semantic reasoning belongs exclusively to backend.

---

## 9. UI & Product Implications

The score must be **explainable**.

Recommended UI pattern:


Each major deduction should surface:
- What is missing
- Why it matters for AI
- What to fix

Opaque scores reduce trust.

---

## 10. What We Are Doing Wrong Today (Explicit)

Current issues with the existing scoring:
- Treats CTAs as a positive signal (incorrect for AEO)
- Rewards brand mentions instead of explanations
- Equates word count with usefulness
- Labels SEO hygiene as “AEO”
- Has no concept of a primary answer
- Has no semantic or trade-off evaluation

This document exists to correct that direction.

---

## 11. Scope Control

This specification applies ONLY to:
- Article / Blog content

Other content types (to be handled later):
- Whitepapers
- YouTube videos (long & short)
- Podcasts
- Community responses (e.g. Reddit)

Each content type requires a **separate AEO scoring model**.
We explicitly do NOT generalize article scoring to other formats.

---

## 12. Product Philosophy (Non-Negotiable)

- AEO rewards clarity over persuasion
- AEO prefers explanation over promotion
- AEO penalizes fluff naturally
- Imperfect heuristics are acceptable in v1
- Directional correctness > theoretical perfection

If writers say:
> “This feels like writing Wikipedia, not marketing”

That is a **positive signal**.

---

## 13. Final Note to Engineering

This document defines **WHAT must be measured**, not **HOW**.

Implementation details (regex, heuristics, models) are flexible,
but violating the dimensions defined here means
we are no longer building an AEO scoring engine.

---

End of document.
