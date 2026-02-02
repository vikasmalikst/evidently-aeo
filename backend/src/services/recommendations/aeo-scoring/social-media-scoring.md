# AEO Scoring Engine  
## Content Type: Social Media Thread (X / LinkedIn)

**Purpose**  
This document defines the scoring logic for evaluating how well a social media thread can be **scraped, understood, and reused by LLMs** as an explanation or citation source.

**Total Score: 100 (+5 Bonus)**

---

## 1. Opening Answer Quality (15)

- Central question/problem stated explicitly (5)  
- Direct answer present in first post (5)  
- Context of “who this is for / when it applies” included (5)

---

## 2. Thread Structure & Coherence (15)

- Logical flow across posts (5)  
- One idea per post (5)  
- Each post understandable standalone (5)

---

## 3. Informational Density (15)

- Posts contain factual information, not engagement fluff (5)  
- No filler hooks delaying the answer (5)  
- Concrete details included: numbers, steps, constraints (5)

---

## 4. Language & Tone (10)

- Neutral, non-promotional voice (5)  
- Declarative statements over opinions (5)

---

## 5. LLM Parsability (15)

- Short paragraphs / bullet-friendly format (5)  
- No reliance on images for core meaning (5)  
- Minimal use of hashtags or platform slang (5)

---

## 6. Semantic Clarity (10)

- Key terms defined before use (5)  
- Consistent terminology across posts (5)

---

## 7. Comparative Reasoning (10)

- Explains trade-offs where relevant (5)  
- Avoids absolute “best” claims (5)

---

## 8. Completeness of Explanation (10)

Thread covers most of:

- What it is  
- Why it matters  
- How it works  
- When it fails  
- Alternatives  
- Next steps  
(10)

---

## 9. Trust & Authority Signals (10)

- Mentions real-world constraints (5)  
- Distinguishes facts from opinions (5)

---

## 10. Follow-Up Readiness (Bonus +5)

- Anticipates 2–3 natural follow-up questions  
- Provides short clarifying answers

---

# Score Interpretation

- **85–100** → Highly AI-scrapable thread, citation-ready  
- **70–84** → Good human thread, partial AI reuse  
- **<70** → Engagement-focused, low AI value

---

# Evaluation Rules

- Score per section, then aggregate  
- Deduct points if:
  - Answer appears after post #3  
  - Core facts only exist in images  
  - Heavy promotional CTA language  
  - Clickbait-style hooks

- Allow partial credit for:
  - Incomplete but well-structured threads  
  - Educational threads without comparisons

---

# Output Format Example (for the service)

```json
{
  "content_type": "social_thread",
  "total_score": 87,
  "sections": {
    "opening_answer": 13,
    "structure": 14,
    "density": 12,
    "tone": 9,
    "parsability": 13,
    "semantic_clarity": 9,
    "comparative_reasoning": 8,
    "completeness": 9,
    "trust_signals": 9,
    "bonus_followups": 5
  },
  "verdict": "AI-scrapable"
}
