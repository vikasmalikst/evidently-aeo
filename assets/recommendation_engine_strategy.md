# Recommendation Engine Lifecycle Strategy

## 1. Executive Summary
This document outlines a strategy to transition the Recommendation Engine from an ad-hoc, limited generation model to a robust, automated weekly lifecycle. The core goals are to ensure comprehensive coverage, accurate lifecycle management, and efficient processing.

## 2. Weekly Generation Cycle & The "Lifecycle" Problem

### 2.1 The Core Challenge: Non-Deterministic LLMs vs. Stable State
The user's primary concern is valid: *How do we identify if a recommendation is "the same" as last week's if the LLM generates different text every time?*

If we rely on the LLM's output text (`"Create a blog post about X"` vs `"Write an article covering X"`) to identify a recommendation, we will fail. We will create duplicates and lose tracking history.

### 2.2 The Solution: Input-Based Deterministic Identity
We must shift the identity of a recommendation from the **Output** (what the LLM says) to the **Input** (the verified opportunity triggering it).

**The "Opportunity Signature"**
Every recommendation is born from a specific data gap. We can generate a **deterministic hash** based on that gap, before the LLM ever sees it.

*   **Signature Formula**: `Hash(Brand_ID + Query_ID + Gap_Type + Target_Competitor_Domain)`
    *   *Example*: `Hash("Nike" + "running shoes" + "Content_Gap_Video" + "runnersworld.com")`
    *   *Result*: `rec_8f3a2b1c`

**The Workflow:**
1.  **Analysis Phase (Deterministic)**: Our code analyzes SERP data. It finds: "For query 'running shoes', competitors have Video, you do not."
2.  **ID Generation**: We immediately assign ID `rec_8f3a2b1c` to this opportunity.
3.  **LLM Generation**: We send this data to the LLM. It writes: *"Create a high-energy running shoe review video."*
4.  **Persistence**: We save the row: `{ id: "rec_8f3a2b1c", text: "Create a...", status: "new" }`.

**Next Week:**
1.  **Analysis Phase**: Code finds the same gap. "Query 'running shoes' still needs Video."
2.  **ID Generation**: It generates the **exact same ID**: `rec_8f3a2b1c`.
3.  **Lookup**: We check the DB. "Does `rec_8f3a2b1c` exist?"
    *   **Yes**: It exists. We **do not** create a new one. We **do not** overwrite the text (unless we want to refresh it). We update the `last_seen` timestamp.
    *   **No**: This is truly new. Insert it.

This guarantees reliability. Even if the LLM would have phrased it differently this week, the **System ID** remains stable because the *root cause* is the same.

---

## 3. Detailed Lifecycle Management

With a stable ID system, we can implement a robust state machine.

### 3.1 State Transitions

| Current State (DB) | Cycle Outcome (New Analysis) | Action Taken | Rationale |
| :--- | :--- | :--- | :--- |
| **Pending / New** | **Found (Match)** | **Update Metric Data** | The opportunity still exists. Update `confidence`, `search_volume`, `last_seen`. Keep status "Pending". |
| **Pending / New** | **Not Found** | **Mark "Stale" / Archive** | The gap has closed naturally, or the query dropped in importance. Remove it from the user's queue to reduce noise. |
| **Approved / In Progress** | **Found (Match)** | **No Action (Log match)** | User is already working on it. Do not annoy them with "New!" notifications. Just log that it's still a valid opportunity. |
| **Approved / In Progress** | **Not Found** | **No Action** | Even if the data signal fades slightly, the user committed to this work. Let them finish. Do not delete "In Progress" work. |
| **Completed** | **Found (Match)** | **Update "Verification"** | We thought it was done, but the data says the gap still exists? This flags a **"Failed Fix"** or "Needs Optimization". We can prompt the user: *"You marked this done, but we still see a gap."* |
| *(Does not exist)* | **Found** | **INSERT** | A truly new opportunity. |

### 3.2 "Top 10" Removal Strategy (Pagination & Thresholding)
To move beyond the "Top 10" limit without blowing up costs or distinctness:

1.  **Hard Filtering (Pre-LLM)**:
    *   Filter opportunities by **Minimum Viable Impact**.
    *   *Rule*: `(Search Volume > 100) AND (Current Rank > 5)`
    *   This removes low-value noise before we ever pay for an LLM call.

2.  **Paginated Processing**:
    *   Instead of `top(10)`, we run a queue.
    *   `Queue = Fetch All Opportunities where Impact > Threshold`
    *   Process in batches of 5 concurrent requests.
    *   Stop when: Queue empty OR `Total_Recommendations > 50` (Safety cap).

3.  **Deduplication Scope**:
    *   Ensure we don't suggest 5 "Create Video" tasks for 5 variants of "running shoes".
    *   **Topic Clustering**: Group input opportunities by `Parent_Topic`.
    *   Send the *Cluster* to the LLM: *"Here are 5 queries about Running Shoes. Generate 1 consolidated recommendation."*
    *   This naturally compresses 50 opportunities into ~10 high-quality strategic recommendations.

---

## 4. Implementation Plan

### 4.1 Phase 1: Robust Identity (The "Fingerprint")
**Goal**: Stop using LLM output as the identity.
*   **Action**: Modify `OpportunityRecommendationService` to generate a deterministic hash ID from the input parameters (`query_id`, `competitor_domain`, `opportunity_type`) *before* calling the LLM.

### 4.2 Phase 2: State Machine
**Goal**: Handle "Old" vs "New".
*   **Action**: Update the `saveRecommendationsToDb` method.
*   **Logic**:
    ```typescript
    const newId = generateHash(opp);
    const existing = await findRec(newId);

    if (existing) {
       if (existing.status === 'pending') updateRec(existing);
       if (existing.status === 'completed') checkVerification(existing);
    } else {
       insertNewRec(newId, generatedText);
    }
    ```

### 4.3 Phase 3: Cluster-based Expansion
**Goal**: Remove "Top 10" limit efficiently.
*   **Action**: Implement `TopicClusteringService`.
*   **Logic**: Group opportunities by topic. Send groups to LLM. This allows processing 100 queries in just 10 LLM calls, effectively removing the limit while *lowering* costs.

### 4.4 Phase 4: Automation
**Goal**: Weekly schedule.
*   **Action**: Create `WeeklyRecommendationJob` in `JobScheduler`.
*   **Schedule**: Runs Sunday night. Ready for Monday morning review.
