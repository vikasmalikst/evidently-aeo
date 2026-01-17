# Recommendation Engine Enhancement Plan
**Role:** Senior Marketing Consultant & AEO Strategist
**Date:** January 18, 2026

## 1. Executive Summary
The current recommendation engine is a solid **quantitative foundation**. It successfully identifies *where* the brand is mentioned (Source Attribution) and *how much* (Visibility/SOA). However, to move from "Tool" to "Consultant," we must bridge the gap between **Metrics** and **Meaning**.

Currently, the engine says: *"Post on Reddit because you have low SOA there."*
The enhanced engine should say: *"Launch a community support thread on Reddit targeting 'pricing' keywords, because Competitor X is dominating this topic with negative sentiment."*

## 2. "The Consultant's Eye": Discovering Opportunities
Looking at the provided mockups and current logic, here are the key opportunities:

### A. The "Why" is Weak (Rationale Gap)
*   **Current State:** Recommendations are justified by raw numbers (e.g., "Impact Score: 8/10").
*   **Flaw:** Users (CMOs/Marketing Managers) need a *narrative*. Why is Reddit better than LinkedIn *for us right now*?
*   **Solution:** We need **Qualitative Context Injection**. We must feed the LLM not just *counts* but *topics* and *keywords* derived from the `ConsolidatedAnalysisService`.

### B. Missing "Battleground" Logic
*   **Current State:** We rank by `Opportunity / Effort`. This is linear.
*   **Flaw:** In marketing, we don't just want "easy" wins. We want **Strategic Wins**.
    *   **Battlegrounds:** High Volume + Mixed Sentiment + Low SOA. (High Priority - "Attack")
    *   **Strongholds:** High SOA + Positive Sentiment. (Maintenance - "Defend")
    *   **Lost Causes:** Competitor > 90% SOA. (Deprioritize - "Avoid")
*   **Solution:** Implement a **Source Classification Algorithm** to categorize domains and assign strategies accordingly.

### C. Generic Content Actions
*   **Current State:** Actions are often "Publish an article on [Domain]."
*   **Flaw:** This delegates the hard thinking to the user.
*   **Solution:** The recommendation itself must include the **Content Angle**.
    *   *Bad:* "Publish on Forbes."
    *   *Good:* "Pitch a 'Future of [Industry]' Op-Ed to Forbes, highlighting our recent [Product Feature] to counter [Competitor Name]'s narrative."

---

## 3. Technical Implementation Plan

We will execute this in three phases: **Data Enrichment**, **Algorithmic Ranking**, and **Prompt Strategy**.

### Phase 1: Context Enrichment (The "Brain" Upgrade)
*   **Objective:** Give the Recommendation LLM access to "What is being said," not just "How many times."
*   **Action:**
    1.  Modify `ContextBuilderService` to fetch **Top Keywords** and **Sentiment Themes** from the `consolidated_analysis_cache`.
    2.  If `ConsolidatedAnalysis` hasn't run recently, trigger a lightweight version to get keywords.
    3.  Pass a `topKeywords` and `competitorWeaknesses` arrays to the `generateRecommendationsDirect` prompt.

### Phase 2: Algorithmic Refinement (The "Ranking" Upgrade)
*   **Objective:** Make the `calculatedScore` reflect strategic value.
*   **Action:** Update `recommendation-ranking.service.ts`:
    1.  **Introduce `Classification`:**
        ```typescript
        if (impact > 7 && soa < 20 && citations > 50) return 'BATTLEGROUND';
        if (soa > 60) return 'STRONGHOLD';
        ```
    2.  **Weighted Scoring:**
        *   `Battleground` = 1.5x Multiplier (High Risk/High Reward).
        *   `Stronghold` = 0.8x Multiplier (Maintenance).
        *   `Opportunity` (High Impact, Zero SOA) = 1.2x Multiplier.
    3.  **Effort Dynamic:** "Battleground" actions usually require *High* effort, but the payoff is massive. We shouldn't penalize them too heavily for effort.

### Phase 3: Prompt Engineering (The "Voice" Upgrade)
*   **Objective:** output recommendations that sound like they came from a human strategist.
*   **Action:** Update `recommendation-v3.service.ts` prompts:
    1.  **Input:** "Here are the top 3 keywords driving traffic to this domain: [...]"
    2.  **Instruction:** "Do not just say 'Post on Reddit'. Specify the *type* of post (e.g., 'AMA', 'Customer Support', 'Feature Teaser') based on the data."
    3.  **Rationale:** Force the LLM to write a `rationale` that connects the *Data* (Low SOA) to the *Action* (AMA) via the *Insight* (High volume of questions about [Topic]).

---

## 4. Immediate "Flaw" Fixes (For Demo Readiness)
If you are demoing this soon, a user might point out:
1.  **"Why this source?"**: The table shows "Source/Domain". Ensure the *Reason* column explicitly says "High Impact Source with Low Brand Presence".
2.  **"What do I write?"**: The "Action" is the title. Ensure the *Content Generation* button is prominent and explains *what* it will produce (e.g., "Draft this Post").
3.  **Repetition**: Prevent multiple recommendations for the same domain unless they are distinct strategies (e.g., "Paid Ad" vs "Organic Post"). *Fix: Group by Domain in the UI or filter duplicates in backend.*

## 5. Proposed "Mock" Experience
*Imagine this row in your table:*
*   **Action:** "Host an AMA on r/SaaS to address pricing concerns"
*   **Source:** `reddit.com` (Battleground)
*   **Focus:** Visibility
*   **Priority:** High
*   **Rationale:** "Reddit drives 15% of industry citations, but your SOA is only 2%. Competitors are actively discussing pricing models here. An AMA clarifies your value prop directly."

*This is the meaningful output we will build.*
