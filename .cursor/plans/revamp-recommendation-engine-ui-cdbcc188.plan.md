---

name: "Recommendation Engine V2: Precise, Category-Driven Actions"

overview: ""

todos:

  - id: b55a5255-7fd5-4090-b9ab-281bc830ab59

content: Create Supabase migration for citation_category column

status: completed

  - id: d409a4b3-f286-4e0d-9754-e1f596d8cb39

content: Implement new heuristics and categorization logic in recommendation.service.ts

status: completed

  - id: dff1d581-2be6-47b3-b4e0-2a4d040e7a40

content: Update LLM prompt to include category context

status: completed

  - id: 802194a6-44e0-440d-9a16-c8df47f37005

content: Update frontend Recommendation types and UI to show category

status: completed

  - id: 2fd5538f-bb18-4b94-bbf3-d6502309c025

content: Integrate recommended actions into SearchSourcesR2.tsx (Citations Page)

status: completed

---

# Recommendation Engine V2: Precise, Category-Driven Actions

## 1. Data Ingestion & Heuristic Logic

The V2 engine will use specific metrics from the `SearchSourcesR2` page logic to categorize issues before they even reach the LLM.

### Input Data

- **Source Metrics**: `mentionRate`, `soa`, `sentiment`, `citations`, `impactScore` (composite).
- **Benchmarks (Medians/Percentiles)**: `mentionMedian`, `soaMedian`, `sentimentMedian`, `citationsMedian`, `compositeMedian`, `compositeTopQuartile`.
- **Trends**: Current vs. Previous period for Visibility, SOA, Sentiment.

### Heuristic Logic (Pre-computation)

We will pre-compute the "Citation Category" for each problem area using the **New Zone View** logic:

1.  **Priority Partnerships (Market Leaders)**: High Impact Score (≥P75) + High Quality (Sentiment ≥50%, Citations ≥25%).

    -   *Trigger*: High authority but declining SOA or missed keyword opportunities.

2.  **Reputation Management (Reputation Risks)**: High Visibility/SOA but Low Quality (Sentiment <50% OR Citations <20%).

    -   *Trigger*: Negative sentiment, low citation authority despite high visibility.

3.  **Growth Opportunities (Growth Bets)**: Good Quality (Sentiment ≥55% OR Citations ≥30%) but Lower Visibility.

    -   *Trigger*: High potential sources that need a visibility boost.

4.  **Monitor (Monitor & Improve)**: Low signals overall.

    -   *Trigger*: Maintenance mode, watch for sudden drops.

## 2. The "Super Prompt" Structure

The prompt will be restructured to enforce the category-based strategy.

**Persona**: "You are a Senior Brand/AEO Strategist specializing in [Industry]."

**Context**: "You are analyzing [Brand Name] performance against [Competitors] and [Benchmarks]."

**Strict Rules**:

-   **No Generic Advice**: Ban phrases like "Create high-quality content" or "Improve SEO".
-   **Mandatory Mapping**: Every recommendation MUST map to one of the 4 categories.
-   **Actionable Output**: Actions must be specific (e.g., "Publish a data-driven report on [Topic] to target [Source] for backlinks").

**Prompt Template (Draft)**:

```text
... (Brand & Metric Context) ...

DETECTED CATEGORY-BASED PROBLEMS:
[Priority Partnership Gap]: Source X has high authority (Impact 8.5) but SOA dropped 15%.
[Reputation Risk]: Source Y has high visibility (65%) but sentiment is negative (-0.4).
...

TASK:
Generate 5-10 high-precision recommendations.
For each recommendation, you MUST:
1. Assign it to one of: 'Priority Partnerships', 'Reputation Management', 'Growth Opportunities', 'Monitor'.
2. Define a concrete ACTION (e.g., "Co-author an article", "Update FAQ schema").
3. Specify the TARGET SOURCE/TOPIC.
4. Explain the EXPECTED IMPACT based on the category (e.g., "Recover SOA", "Fix Sentiment").

OUTPUT JSON FORMAT:
[{
  "citationCategory": "Priority Partnerships",
  "action": "...",
  "reason": "...",
  "targetSource": "...",
  ...
}]
```

## 3. Backend Integration (`recommendation.service.ts`)

-   **Update `gatherBrandContext`**:
    -   Calculate benchmarks (medians/percentiles) dynamically.
    -   Classify sources into zones *before* prompting.
    -   Pass this pre-classified data to the prompt.
-   **Refine `buildPrompt`**: Replace the current prompt with the new "super prompt".
-   **Enhance `parseRecommendations`**: Ensure strict validation of the `citationCategory` field.

## 4. Frontend Alignment (`Recommendations.tsx`)

-   **Visuals**:
    -   The "Action" column will prominently display the Category Badge.
    -   Color coding will match the `SearchSourcesR2` page (Green=Priority, Red=Reputation, Blue=Growth, Grey=Monitor).
-   **Filtering**:
    -   Add tabs/filters to view recommendations by Category (aligning with the Source page cards).

## 5. Execution Steps

1.  **Refine Heuristics**: Implement the "New Zone" calculation in `recommendation.service.ts`.
2.  **Update Prompt**: Integrate the new logic and category definitions into the LLM prompt.
3.  **Test**: Generate recommendations and verify they are specific and correctly categorized.
4.  **UI Updates**: Ensure the frontend displays these new, precise recommendations effectively.