
# Strategy: Graph-Based Recommendation Engine

**Context:**
We are upgrading the Recommendation Engine ("The Marketing Strategist") from a frequency-counting model (N=50) to a Knowledge Graph model (N=4000+). This allows us to handle large-scale weekly data without losing context, enabling "Strategic Comparatives" rather than just generic advice.

## 1. The Architecture
*   **Type:** In-Memory Knowledge Graph (for <100k nodes) moving to Neo4j/Memgraph at scale.
*   **Library:** `graphology` (Node.js) or `ngraph`.
*   **Input:** Full history of `collector_results` (Raw JSON from LLM Analysis).
*   **Output:** High-signal "Clusters" and "Central Topics" fed to the Recommendation LLM.

## 2. The Graph Schema

### Nodes (Entities)
The graph consists of 5 core node types:
1.  **BRAND**: The root entity (e.g., `ASICS`).
2.  **PRODUCT**: Specific models (e.g., `Gel Kayano`, `Novablast`).
3.  **COMPETITOR**: Rival entities (e.g., `Brooks`, `Nike`).
4.  **TOPIC**: Dynamic extracted keywords (e.g., `Stability`, `Knee Pain`, `Peeling`).
    *   *Note:* These are specific extracted terms, not broad categories.
5.  **SENTIMENT**: Qualitative buckets (`Positive`, `Negative`, `Mixed`).

### Edges (Relationships) & Properties
Connecting the nodes based on co-occurrence in user answers.
*   `[Product] --(HAS_ATTRIBUTE)--> [Topic]`
*   `[Product] --(COMPETES_WITH)--> [Competitor]`
*   `[Topic] --(LEADS_TO)--> [Sentiment]`

**Crucially, we store Qualitative Evidence on the Edges:**
*   `evidence_quote`: *"My toe cap peeled off after 200 miles."* (Stored on the edge between `Brooks` and `Peeling`).
*   `original_narrative`: The summary context.

## 3. The Algorithms (The "Brain")

### A. Centrality (PageRank / TextRank)
*   **Goal:** Identifying "Structural Importance" vs "Frequency".
*   **Use Case:** Finding a hidden issue like "Customer Service" that connects multiple negative clusters, even if volume is low.

### B. Community Detection (Louvain)
*   **Goal:** Finding "Narratives" (Clusters of topics).
*   **Use Case:** Grouping `Price`, `Expensive`, `Value` into a single "Pricing Narrative" to avoid redundant recommendations.

## 4. Custom Business Metrics
We define three specific metrics to drive "War Room" insights:

1.  **Source Toxicity Score**
    *   `Count(Negative Edges) / Total Edges` per Source Node.
    *   *Insight:* "Reddit is 80% Toxic today; YouTube is 90% Positive."

2.  **The Opportunity Gap**
    *   Keywords where `[Competitor] -> [Negative]` exists, but `[Brand] -> [Negative]` does NOT.
    *   *Insight:* "Attack Competitor X on 'Durability' (they are weak, you are clean)."

3.  **The Feature Battleground**
    *   Keywords where both `[Brand]` and `[Competitor]` have high edge density.
    *   *Insight:* "The fight for 'Cushioning' is a draw. Differentiate here."

## 5. Implementation Prompt ("The Super Prompt")

Use this prompt to generate the exact code implementation:

```text
Role: Senior Data Architect
Goal: Implement a Knowledge Graph for Recommendation Engine using 'graphology'.

Requirements:
1. Schema: Brand, Product, Competitor, Topic (Keyword), Sentiment.
2. Edge Props: Store 'evidence_quote' on edges.
3. Input: Array of { products: [], keywords: [], sentiment: {}, quotes: [] }.
4. Algorithms:
   - Run PageRank to rank Topics by centrality.
   - Run Louvain to group Topics into Communities.
5. Queries:
   - "Find Top 5 Topics for Competitor X with Negative Sentiment".
   - "Find 'Opportunity Gaps' (Competitor is Negative, Brand is Neutral/Positive)".

Output: TypeScript Class 'RecommendationGraph' with distinct methods for ingestion, analysis, and querying.
```

## 6. Roadmap
1.  **Phase 7a:** Build "Shadow Graph" (In-memory, runs alongside current system).
2.  **Phase 7b:** Verify Metrics (Compare Graph Rank vs Frequency Count).
3.  **Phase 7c:** Switch Recommendation Prompt to use Graph Clusters.
