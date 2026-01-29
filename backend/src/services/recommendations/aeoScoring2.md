# AEO Content Scoring System – Multi Content Type Specification
Version: 1.0  
Owner: Product / AEO  
Status: Canonical Reference  
Implementation: Article scoring (v1), others TODO  

---

## 1. Purpose

This document defines how **AEO (Answer Engine Optimization) scoring**
should be designed across **different content types**.

AEO scoring measures whether AI systems (LLMs) can:
- Parse content
- Extract answers
- Reuse explanations
- Cite content as a reference

This is **not SEO scoring** and must not reuse SEO heuristics blindly.

---

## 2. Core Principle (Non-Negotiable)

> **Each content type requires its own AEO scoring model.**

AEO is **format-dependent**.  
Article scoring must NOT be reused for videos, podcasts, or community content.

---

## 3. Universal AEO Scoring Framework

All content types follow the same **high-level structure**:


What changes per content type:
- What “hygiene” means
- What “scrapability” signals look like

---

## 4. What AEO Scoring Measures (Global)

### AEO Scoring IS:
- AI reuse readiness
- Answer clarity
- Explanation depth
- Trust & credibility

### AEO Scoring IS NOT:
- Keyword optimization
- Engagement metrics
- Conversion optimization
- CTA effectiveness
- Brand persuasion

---

# CONTENT TYPE–WISE SCORING MODELS

---

## 5. Article / Blog Content (IMPLEMENTED – v1)

**Nature**
- Structured, reference-style content
- Canonical source for AI answers

### Hygiene Signals (30 pts)
- Minimum viable length
- Readable sentence structure
- Clear headings and lists
- Short, parseable paragraphs
- No spammy formatting

### AI Scrapability Signals (70 pts)
- Clear primary question
- Direct answer early in the content
- Explicit concept definitions
- Mechanism-based explanations (“why it works”)
- Comparisons and alternatives
- Trade-offs and limitations
- Concrete authority signals
- No CTAs or marketing language

**Status:** Implemented as AEO Article Scoring v1

---

## 6. Whitepapers (TODO – Phase 2)

**Nature**
- Long-form, authoritative, research-driven
- Often PDF or gated assets

### Hygiene Signals (30 pts)
- Executive summary present
- Clear section hierarchy
- Tables, charts, or figures referenced
- Logical progression of ideas
- Citations or references included

### AI Scrapability Signals (70 pts)
- Clear thesis statement
- Definitions of frameworks or models
- Evidence-backed claims
- Methodology explanation
- Explicit assumptions and limitations

**AEO Focus:** Trust, depth, and evidence  
**Status:** Not implemented

---

## 7. YouTube – Long-Form Videos (TODO – Phase 3)

**Nature**
- Spoken explanations
- AI consumption via transcripts

### Hygiene Signals (30 pts)
- Transcript available
- Chapters or timestamps
- Clear topic focus
- Limited filler content

### AI Scrapability Signals (70 pts)
- Early verbal framing or answer
- Concept explanations in transcript
- Logical progression of ideas
- Verbal comparisons
- Recap or summary section

**AEO Focus:** Transcript clarity and structure  
**Status:** Not implemented

---

## 8. YouTube Shorts / Short Videos (TODO – Phase 3)

**Nature**
- Single-idea, ultra-short format
- Minimal depth, maximum clarity

### Hygiene Signals (30 pts)
- Caption or transcript present
- One topic only
- Clean, understandable language

### AI Scrapability Signals (70 pts)
- One explicit claim or answer
- Clear context in text description
- Quotable statement
- No reliance on visuals alone

**AEO Focus:** Clarity and quotability  
**Status:** Not implemented

---

## 9. Podcasts (TODO – Phase 4)

**Nature**
- Conversational, long-form audio
- Trust built through discussion

### Hygiene Signals (30 pts)
- Transcript available
- Episode description structured
- Timestamps provided
- Speaker identification

### AI Scrapability Signals (70 pts)
- Clear discussion themes
- Explicit explanations within conversation
- Expert statements that can be quoted
- Summaries or key takeaways
- High signal-to-noise ratio

**AEO Focus:** Extractable insights from conversation  
**Status:** Not implemented

---

## 10. Expert / Community Responses (Reddit, Forums) (TODO – Phase 2)

**Nature**
- Experiential, peer-driven content
- High AI trust due to authenticity

### Hygiene Signals (30 pts)
- Readable formatting
- Paragraph separation
- Minimal slang or noise

### AI Scrapability Signals (70 pts)
- First-hand experience signals
- Clear stance or conclusion
- Reasoned explanation
- Experience-based comparisons
- Honest limitations

**AEO Focus:** Credibility and specificity  
**Status:** Not implemented

---

## 11. Rollout Strategy (Recommended)

1. Articles (DONE / v1)
2. Expert / Community Responses
3. Whitepapers
4. Long-form Videos
5. Short Videos
6. Podcasts

Reason:
- Articles and community content are most cited by AI
- Media formats depend on transcript quality
- Shorts have lowest AEO depth

---

## 12. Architectural Guardrails

- Do NOT reuse article scoring for other formats
- Do NOT collapse all content into one scoring engine
- Each content type gets its own scorer
- Same philosophy, different signals

---

## 13. Product Philosophy

- AEO rewards clarity over persuasion
- AEO prefers explanation over promotion
- AEO penalizes fluff naturally
- Imperfect heuristics are acceptable in v1
- Directional correctness > theoretical perfection

If creators say:
> “This feels like writing Wikipedia, not marketing”

That is a **positive signal**.

---

## 14. Final Note to Engineering

This document defines **WHAT must be measured**, not **HOW**.

Implementation details (regex, heuristics, models) are flexible,
but violating the dimensions defined here means
we are no longer building a true AEO scoring system.

---

End of document.
