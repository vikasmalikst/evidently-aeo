# Scoring Process: Data Flow & Database Tables

## Overview

This document outlines how data flows through the scoring process, which tables get updated, and when updates occur.

---

## High-Level Flow

```
collector_results (input)
    ↓
Step 1: Analysis → consolidated_analysis_cache + citations
    ↓
Step 2: Position Extraction → metric_facts + brand_metrics + competitor_metrics
    ↓
Step 3: Sentiment Storage → brand_sentiment + competitor_sentiment
    ↓
collector_results (status updated to 'completed')
```

---

## Step-by-Step Data Flow

### **Step 1: Consolidated Analysis**

**When:** First step for each `collector_result` with `scoring_status = 'pending'`

**Input:**
- Reads from: `collector_results` (raw_answer, brand_id, customer_id)
- Reads from: `brands` (brand name, metadata)
- Reads from: `brand_competitors` (competitor names, metadata)

**Processing:**
- Calls LLM to extract products, categorize citations, analyze sentiment
- OR uses cached analysis if already exists

**Output - Tables Updated:**

1. **`consolidated_analysis_cache`**
   - **When:** After analysis completes (or cache hit)
   - **What:** Stores products and sentiment as JSONB
   - **Condition:** One row per `collector_result_id` (upsert on conflict)
   - **Fields:** `collector_result_id` (PK), `products`, `sentiment`, `llm_provider`

2. **`citations`**
   - **When:** During analysis (citations are categorized)
   - **What:** Stores categorized citation URLs
   - **Condition:** One row per unique `(collector_result_id, url)` (upsert on conflict)
   - **Fields:** `collector_result_id`, `url`, `domain`, `category`, `page_name`, `customer_id`, `brand_id`

**Status Update:**
- `collector_results.scoring_status` → `'processing'` (when claimed by worker)
- `collector_results.scoring_worker_id` → worker ID
- `collector_results.scoring_started_at` → current timestamp

---

### **Step 2: Position Extraction**

**When:** After Step 1 completes (or if analysis cache exists)

**Input:**
- Reads from: `consolidated_analysis_cache` (products extracted in Step 1)
- Reads from: `collector_results` (raw_answer for position calculation)
- Reads from: `brand_competitors` (to get competitor IDs)

**Processing:**
- Calculates character positions where brand/competitors appear in raw_answer
- Extracts visibility metrics (share of answers, positions)

**Output - Tables Updated:**

1. **`metric_facts`**
   - **When:** After position extraction completes
   - **What:** Core reference table (one row per collector_result)
   - **Condition:** Upsert on `collector_result_id` conflict
   - **Fields:** `id` (PK), `collector_result_id`, `brand_id`, `customer_id`, `query_id`, `collector_type`, `topic`, `processed_at`

2. **`brand_metrics`**
   - **When:** After metric_fact is created
   - **What:** Brand visibility and position data
   - **Condition:** Upsert on `metric_fact_id` conflict
   - **Fields:** `metric_fact_id` (FK), `visibility_index`, `share_of_answers`, `brand_positions` (array), `brand_position` (first position)

3. **`competitor_metrics`**
   - **When:** After brand_metrics is created (if competitors exist)
   - **What:** Competitor visibility and position data (one row per competitor)
   - **Condition:** Upsert on `(metric_fact_id, competitor_id)` conflict
   - **Fields:** `metric_fact_id` (FK), `competitor_id` (FK), `visibility_index_competitor`, `share_of_answers_competitor`, `competitor_positions` (array)

**Optional Update:**
- `collector_results.metadata` → Updated with product names (if available)

---

### **Step 3: Sentiment Storage**

**When:** After Step 2 completes (requires `metric_fact_id`)

**Input:**
- Reads from: `consolidated_analysis_cache` (sentiment data from Step 1)
- Reads from: `metric_facts` (to get `metric_fact_id`)
- Reads from: `brand_competitors` (to get competitor IDs)

**Processing:**
- Extracts sentiment scores and labels from cached analysis
- Maps competitor names to competitor IDs

**Output - Tables Updated:**

1. **`brand_sentiment`**
   - **When:** After sentiment data is available
   - **What:** Brand sentiment analysis
   - **Condition:** Upsert on `metric_fact_id` conflict
   - **Fields:** `metric_fact_id` (FK), `sentiment_label`, `sentiment_score`, `positive_sentences`, `negative_sentences`

2. **`competitor_sentiment`**
   - **When:** After brand_sentiment is stored (if competitors exist)
   - **What:** Competitor sentiment analysis (one row per competitor)
   - **Condition:** Upsert on `(metric_fact_id, competitor_id)` conflict
   - **Fields:** `metric_fact_id` (FK), `competitor_id` (FK), `sentiment_label`, `sentiment_score`, `positive_sentences`, `negative_sentences`

**Status Update:**
- `collector_results.scoring_status` → `'completed'` (if all steps succeed)
- `collector_results.scoring_completed_at` → current timestamp
- `collector_results.scoring_worker_id` → cleared (null)
- `collector_results.scoring_started_at` → cleared (null)

---

## Error Handling & Status Updates

### **On Failure:**

**If Step 1 fails:**
- `collector_results.scoring_status` → `'failed'`
- `collector_results.scoring_error` → error message
- No tables updated (no analysis cache, no citations)

**If Step 2 fails:**
- `collector_results.scoring_status` → `'failed'`
- `collector_results.scoring_error` → error message
- Step 1 data remains (analysis cache, citations exist)
- No position tables updated

**If Step 3 fails:**
- `collector_results.scoring_status` → `'failed'`
- `collector_results.scoring_error` → error message
- Steps 1 & 2 data remains (analysis cache, positions exist)
- No sentiment tables updated

### **On Retry:**

**Conditions for retry:**
- `scoring_status = 'failed'` → Can be retried
- `scoring_status = 'pending'` → Will be processed
- `scoring_status = 'processing'` (stale >30 min) → Reset to 'pending' on startup

**Resume capability:**
- Step 1: Checks `consolidated_analysis_cache` → Skips if exists
- Step 2: Checks `metric_facts` → Skips if exists
- Step 3: Checks `brand_sentiment` → Skips if exists

---

## Table Relationships

```
collector_results (source)
    ├── consolidated_analysis_cache (1:1) - Step 1 output
    ├── citations (1:many) - Step 1 output
    └── metric_facts (1:1) - Step 2 output
            ├── brand_metrics (1:1) - Step 2 output
            ├── competitor_metrics (1:many) - Step 2 output
            ├── brand_sentiment (1:1) - Step 3 output
            └── competitor_sentiment (1:many) - Step 3 output
```

---

## Key Conditions & Triggers

### **When Scoring Starts:**
- `collector_results.scoring_status = 'pending'` OR `'failed'`
- `collector_results.raw_answer IS NOT NULL`
- Worker claims item atomically (prevents duplicate processing)

### **When Step 1 Runs:**
- No entry in `consolidated_analysis_cache` for this `collector_result_id`
- OR cache exists but needs refresh (rare)

### **When Step 2 Runs:**
- Step 1 completed (analysis cache exists)
- No entry in `metric_facts` for this `collector_result_id`
- OR positions need recalculation (rare)

### **When Step 3 Runs:**
- Step 2 completed (`metric_fact_id` exists)
- Sentiment data exists in `consolidated_analysis_cache`
- No entry in `brand_sentiment` for this `metric_fact_id`
- OR sentiment needs refresh (rare)

### **When Status = 'completed':**
- All 3 steps succeeded:
  - ✅ `consolidated_analysis_cache` has entry
  - ✅ `metric_facts` has entry
  - ✅ `brand_sentiment` has entry (or skipped if no sentiment data)

---

## Summary Table

| Step | Input Tables | Output Tables | When Updated | Condition |
|------|-------------|--------------|--------------|-----------|
| **1: Analysis** | `collector_results`, `brands`, `brand_competitors` | `consolidated_analysis_cache`, `citations` | After LLM analysis | No cache exists |
| **2: Positions** | `consolidated_analysis_cache`, `collector_results`, `brand_competitors` | `metric_facts`, `brand_metrics`, `competitor_metrics` | After position calculation | Step 1 complete, no metric_fact exists |
| **3: Sentiment** | `consolidated_analysis_cache`, `metric_facts`, `brand_competitors` | `brand_sentiment`, `competitor_sentiment` | After sentiment extraction | Step 2 complete, sentiment data exists |
| **Status** | N/A | `collector_results` | After each step | On claim, on completion, on failure |

---

## Notes

1. **Atomicity:** Each step uses upsert operations (atomic at row level)
2. **Idempotency:** Steps can be rerun safely (upsert prevents duplicates)
3. **Resume:** Process can resume from any step if interrupted
4. **Coordination:** Multiple workers can run simultaneously (atomic claiming prevents conflicts)
5. **Stale Recovery:** Items stuck in 'processing' >30 minutes are reset to 'pending' on service startup

