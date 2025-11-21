# Source Attribution Details Table - Metric Calculations Explained

## Overview
The "Source Attribution Details" table shows how different sources (domains) are cited in AI-generated answers and their associated metrics. This document explains how each metric is calculated and displayed.

---

## Table Columns Explained

### 1. **SOURCE** (Domain Name)
- **What it shows**: The domain name of the source (e.g., `uber.com`, `reddit.com`)
- **How it's determined**: Extracted from the `citations` table's `domain` field, or parsed from the `url` field if domain is missing
- **Normalization**: Domains are normalized to lowercase and `www.` prefix is removed for consistent grouping

---

### 2. **TYPE** (Source Category)
- **What it shows**: Categorization of the source (Corporate, Editorial, Reference, UGC, Social, Institutional)
- **How it's determined**: 
  - If the source domain matches the brand's own domain → `brand`
  - Otherwise, uses the `category` field from the `citations` table
  - Falls back to domain-based heuristics if category is missing
- **No normalization**: Raw category value from database

---

### 3. **MENTION RATE** (e.g., 36.8% for uber.com)
- **What it means**: The percentage of total AI responses (collector results) where this source domain is cited
- **Formula**: 
  ```
  Mention Rate = (Number of unique collector results citing this source / Total collector results) × 100
  ```
- **Example Calculation**:
  - Total collector results (AI responses) in the time period: 23
  - Number of unique collector results where `uber.com` is cited: 8
  - Mention Rate = (8 / 23) × 100 = **34.8%**
  
  This means `uber.com` appears as a citation in 34.8% of all AI-generated answers for this brand.

- **Data Source**: 
  - Numerator: Count of unique `collector_result_id` values from `citations` table for this domain
  - Denominator: Total count of `collector_results` for the brand in the time period

- **Change Calculation**: 
  - Compares current period mention rate vs. previous period mention rate
  - Previous period is calculated using the same formula for citations in the period before

- **Normalization**: ✅ **NONE** - This is a real percentage (0-100%)

---

### 4. **SHARE OF ANSWER (SOA)** (e.g., 68.6% for reddit.com)
- **What it means**: The average percentage of the AI answer that mentions the brand when this source is cited
- **Formula**:
  ```
  SOA = Average of all share_of_answers_brand values for collector results where this source is cited
  ```
- **Example Calculation**:
  - `reddit.com` is cited in 5 collector results
  - SOA values for those 5 results: [65%, 70%, 68%, 72%, 66%]
  - Average SOA = (65 + 70 + 68 + 72 + 66) / 5 = **68.2%**
  
  This means when `reddit.com` is cited, on average 68.2% of the AI answer content mentions the brand.

- **Data Source**: 
  - `extracted_positions.share_of_answers_brand` field (stored as 0-100 percentage)
  - Averaged across all collector results where this source appears

- **Change Calculation**:
  - Compares current period average SOA vs. previous period average SOA

- **Normalization**: ✅ **NONE** - SOA is already stored as 0-100 percentage in the database
  - The `share_of_answers_brand` field in `extracted_positions` table is stored as a percentage (0-100)
  - No `toPercentage()` conversion is applied (it was removed in previous fixes)

---

### 5. **SENTIMENT** (e.g., +0.71 for uber.com)
- **What it means**: The average sentiment score of AI responses when this source is cited
- **Scale**: -1.0 (very negative) to +1.0 (very positive)
  - **Positive**: > 0.3 (e.g., +0.71, +0.78)
  - **Neutral**: -0.1 to 0.3 (e.g., +0.15, -0.05)
  - **Negative**: < -0.1 (e.g., -0.25, -0.50)

- **Formula**:
  ```
  Sentiment = Average of all sentiment_score values for collector results where this source is cited
  ```

- **Example Calculation**:
  - `uber.com` is cited in 8 collector results
  - Sentiment scores: [0.75, 0.68, 0.72, 0.70, 0.65, 0.80, 0.69, 0.71]
  - Average Sentiment = (0.75 + 0.68 + 0.72 + 0.70 + 0.65 + 0.80 + 0.69 + 0.71) / 8 = **0.71**

- **Data Source**: 
  - `collector_results.sentiment_score` field (stored as -1 to 1 scale)
  - Averaged across all collector results where this source appears

- **Change Calculation**:
  - Compares current period average sentiment vs. previous period average sentiment

- **Normalization**: ✅ **NONE** - Raw sentiment values (-1 to 1) are displayed
  - No `normalizeSentiment()` conversion is applied (it was removed in previous fixes)
  - Values are shown as-is: `+0.71`, `-0.25`, etc.

---

### 6. **TOP TOPICS**
- **What it shows**: The topics associated with collector results where this source is cited
- **How it's determined**: 
  - Extracted from `extracted_positions.metadata.topic_name` or `metadata.topic`
  - Aggregated across all collector results where this source appears
- **Display**: Shows up to 2 topics, with "+N more" indicator if there are more
- **No normalization**: Raw topic names from metadata

---

### 7. **PAGES**
- **What it shows**: Page names/titles from the `citations` table where this source is cited
- **How it's determined**: 
  - From `citations.page_name` field
  - Aggregated across all citations for this domain
- **Display**: Shows first page name, with "+N more" indicator if there are more
- **No normalization**: Raw page names from database

---

### 8. **PROMPTS**
- **What it shows**: The questions/prompts that resulted in AI responses citing this source
- **How it's determined**: 
  - Primary: `collector_results.question` field (the actual prompt sent to the AI)
  - Fallback: `generated_queries.query_text` if question is not available
- **Display**: Shows first prompt, with "+N more" indicator if there are more
- **No normalization**: Raw prompt text from database

---

## Overall Metrics (Above the Table)

### **OVERALL MENTION RATE**
- **What it means**: The average mention rate across all sources
- **Formula**: `Average of all individual source mention rates`
- **Example**: If you have 3 sources with mention rates [36.8%, 25.2%, 18.5%], overall = (36.8 + 25.2 + 18.5) / 3 = 26.8%
- **Normalization**: ✅ **NONE** - Simple average of percentages

### **AVG SENTIMENT SCORE**
- **What it means**: The average sentiment across all sources
- **Formula**: `Average of all individual source sentiment scores`
- **Example**: If sources have sentiments [0.71, 0.73, 0.78], overall = (0.71 + 0.73 + 0.78) / 3 = 0.74
- **Normalization**: ✅ **NONE** - Simple average of raw sentiment values (-1 to 1)

---

## Data Flow Summary

1. **Citations Table** → Provides domain, URL, category, usage_count, collector_result_id, query_id
2. **Collector Results Table** → Provides sentiment_score, question (prompt)
3. **Extracted Positions Table** → Provides share_of_answers_brand, total_brand_mentions, topic metadata
4. **Generated Queries Table** → Provides query_text (fallback for prompts)

**Aggregation Process**:
1. Group citations by normalized domain
2. For each domain, collect all associated collector_result_ids
3. Calculate averages for SOA, sentiment, and mention counts
4. Calculate mention rate as (unique collector results / total collector results) × 100
5. Aggregate topics, pages, and prompts from associated data

---

## Normalization Status

✅ **All normalization has been removed**:
- **Mention Rate**: Real percentage (0-100%), no conversion
- **Share of Answer**: Already stored as 0-100%, no `toPercentage()` applied
- **Sentiment**: Raw -1 to 1 values, no `normalizeSentiment()` applied
- **All other fields**: Raw values from database

---

## Example: Understanding uber.com Row

If `uber.com` shows:
- **Mention Rate**: 36.8% → Cited in 36.8% of all AI responses
- **Share of Answer**: 74.6% → When cited, on average 74.6% of the answer mentions the brand
- **Sentiment**: +0.71 → Positive sentiment (above 0.3 threshold)
- **Type**: Corporate → Categorized as corporate source
- **Topics**: "how ride-hailing works", "apps for airport pickup" → Associated topics
- **Pages**: "Uber" → Page name from citations
- **Prompts**: "how to book a ride from the airport using mo..." → Example prompt that cited this source

This means:
- Uber.com is a frequently cited source (36.8% of responses)
- When it's cited, the brand gets strong representation (74.6% of answer content)
- The sentiment is positive (+0.71)
- It's primarily cited for ride-hailing and airport pickup related queries

---

## Code Locations

- **Backend Service**: `backend/src/services/source-attribution.service.ts`
- **Frontend Display**: `src/pages/SearchSources.tsx`
- **Utility Functions**: `backend/src/services/brand-dashboard/utils.ts` (contains deprecated normalization functions)

