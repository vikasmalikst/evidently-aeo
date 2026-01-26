# Graph Recommendation Engine: Implementation Summary

## 1. Concept: Moving from Lists to Networks
Previously, our recommendation engine was "linear"—it just counted how many times a keyword appeared (e.g., "Durability (50 mentions)").
**The Problem:** High frequency doesn't mean high importance. A common word might be noise, while a rare word might be the key differentiator.

**The Solution:** We implemented a **Knowledge Graph**. Instead of a list, we built a network where every Brand, Product, Topic, and Sentiment is a "node", and their relationships (co-occurrence) are "links".

---

## 2. The Algorithms
We applied two powerful network analysis algorithms to this graph.

### A. PageRank (Centrality)
*   **Concept:** Originally used by Google to rank websites. It asks: *"Which node is ‘voted for’ by other important nodes?"*
*   **In Our Data:** It identifies **Influence**.
*   **Example:**
    *   "Running" might be mentioned 100 times (High Frequency) but connects to everything generically.
    *   "Gel-Kayano" might be mentioned 50 times but connects specifically to "Comfort", "Stability", and "Marathon".
    *   **PageRank** figures out that "Comfort" is the *central* reason people buy the shoe, giving it a higher score than the generic "Running", even if mentions are lower.

### B. Louvain (Community Detection)
*   **Concept:** It detects "cliques" or clusters of nodes that talk to each other more than they talk to the rest of the network.
*   **In Our Data:** It identifies **Narratives**.
*   **Example:**
    *   **Cluster 1 (Performance):** Nodes like *Speed, Grip, Carbon Plate, Lightweight*.
    *   **Cluster 2 (Durability):** Nodes like *High Mileage, Outsole, Wear & Tear, Long Run*.
    *   The engine can now say: *"Your brand is winning in the Durability narrative but losing in the Performance narrative."*

---

## 3. Data Flow: How It Works
Here is how a raw user review becomes a strategic recommendation.

```mermaid
graph TD
    A[Raw Source<br/>(Reddit/Review)] -->|Data Collection| B(Consolidated Analysis)
    B -->|LLM Extraction| C{Qualitative Attributes}
    C -->|Extracts| D[Keywords]
    C -->|Extracts| E[Sentiment]
    C -->|Extracts| F[Topic/Entity]
    
    D & E & F -->|Saved to| G[(Database<br/>consolidated_analysis_cache)]
    
    G -->|Fetch 2000 Records| H[GraphService]
    
    subgraph "Graph Engine (In-Memory)"
        H -->|Build Nodes| I((Knowledge Graph))
        I -->|Run PageRank| J[Centrality Scores]
        I -->|Run Louvain| K[Community Clusters]
        J & K -->|Identify| L[Opportunity Gaps]
    end
    
    L -->|Inject Insights| M[LLM Prompt]
    M -->|Generate| N[Final Recommendation]

    style I fill:#f9f,stroke:#333
    style L fill:#bbf,stroke:#333
    style N fill:#bfb,stroke:#333
```

---

## 4. Concrete Example: The "Opportunity Gap"
How the new engine finds a competitor weakness that a frequency list would miss.

*   **Scenario:** 5 users complain about "Brooks Ghost" shoes peeling.
*   **Frequency Analysis:** 5 mentions is low noise. Ignored.
*   **Graph Analysis:**
    1.  **Nodes:** `Brooks` (Competitor) and `Peeling` (Topic) and `Negative` (Sentiment) exist.
    2.  **Edge:** Strong link between `Brooks` -> `Peeling`.
    3.  **Path:** `Brooks` -> `Peeling` -> `Negative`.
    4.  **Insight:** The graph sees a "structural structural weakness". Even if volume is low, the *connection* to negativity is strong (100% of "Peeling" mentions are negative).
    5.  **Output:** The system flags "Peeling" as an **Opportunity Gap** (Score 0.85).
    6.  **Recommendation:** *"Highlight your proprietary bonding technology to target dissatisfied Brooks owners complaining about peeling."*

## 5. Summary of Benefits
1.  **Context-Aware:** Understands *why* a topic matters, not just *that* it was mentioned.
2.  **Strategic:** Identifies specific attack vectors (Battlegrounds/Weaknesses).
3.  **Evidence-Based:** Links every insight back to specific quotes (Evidence).
