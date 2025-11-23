# Manual Verification Guide: Visibility Index & Share of Answer (SOA)

This guide helps you manually verify Visibility Index and SOA calculations from the database.

## 📊 Understanding the Metrics

### 1. **Visibility Index**
**Formula:**
```
Visibility Index = (Prominence × 0.6) + (Density × 0.4)

Where:
- Prominence = 1 / log₁₀(firstPosition + 9)
- Density = totalBrandMentions / totalWordCount
```

**Stored as:** Decimal (0-1) in `extracted_positions.visibility_index`  
**Displayed as:** Percentage (multiplied by 100 in frontend)

### 2. **Share of Answer (SOA)**
**Formula:**
```
SOA = (totalBrandMentions / (totalBrandMentions + totalCompetitorMentions)) × 100
```

**Stored as:** Percentage (0-100) in `extracted_positions.share_of_answers_brand`

---

## 🔍 Step 1: Find Your Brand's Data

```sql
-- Get your brand_id and customer_id first
SELECT id, name, customer_id 
FROM brands 
WHERE name ILIKE '%YOUR_BRAND_NAME%';

-- Example: For a specific brand
SELECT id, name, customer_id 
FROM brands 
WHERE id = '1d3a41cc-e83f-45ff-887f-8eb66d4eaadc';
```

**Save these values:**
- `brand_id`: `[YOUR_BRAND_ID]`
- `customer_id`: `[YOUR_CUSTOMER_ID]`

---

## 🔍 Step 2: Get Raw Calculation Data from extracted_positions

```sql
-- Get all raw data needed for calculations
SELECT 
    id,
    collector_result_id,
    query_id,
    brand_name,
    competitor_name,
    -- Raw calculation inputs
    total_brand_mentions,
    competitor_mentions,
    total_word_count,
    brand_first_position,
    brand_positions,  -- Array of all brand mention positions
    -- Calculated values (to verify)
    visibility_index,
    share_of_answers_brand,
    processed_at,
    has_brand_presence
FROM extracted_positions
WHERE brand_id = '[YOUR_BRAND_ID]'
  AND customer_id = '[YOUR_CUSTOMER_ID]'
  AND competitor_name IS NULL  -- Only brand rows (not competitor rows)
ORDER BY processed_at DESC
LIMIT 20;  -- Start with recent 20 records
```

---

## 🧮 Step 3: Manually Calculate Visibility Index

For each row from Step 2, calculate:

### A. Calculate Prominence
```sql
-- PostgreSQL function to calculate prominence
SELECT 
    id,
    brand_first_position,
    CASE 
        WHEN brand_first_position IS NULL OR brand_first_position < 1 THEN 0
        ELSE 1 / LOG(10, brand_first_position + 9)
    END AS prominence_calculated
FROM extracted_positions
WHERE brand_id = '[YOUR_BRAND_ID]'
  AND collector_result_id = '[SPECIFIC_COLLECTOR_RESULT_ID]'
  AND competitor_name IS NULL;
```

**Manual calculation example:**
- If `brand_first_position = 5`:
  - `prominence = 1 / log₁₀(5 + 9) = 1 / log₁₀(14) = 1 / 1.146 = 0.872`

### B. Calculate Density
```sql
-- Calculate density
SELECT 
    id,
    total_brand_mentions,
    total_word_count,
    CASE 
        WHEN total_word_count = 0 THEN 0
        ELSE total_brand_mentions::numeric / total_word_count
    END AS density_calculated
FROM extracted_positions
WHERE brand_id = '[YOUR_BRAND_ID]'
  AND collector_result_id = '[SPECIFIC_COLLECTOR_RESULT_ID]'
  AND competitor_name IS NULL;
```

**Manual calculation example:**
- If `total_brand_mentions = 3` and `total_word_count = 500`:
  - `density = 3 / 500 = 0.006`

### C. Calculate Final Visibility Index
```sql
-- Complete Visibility Index calculation
SELECT 
    id,
    visibility_index AS stored_value,
    (
        (1 / NULLIF(LOG(10, NULLIF(brand_first_position, 0) + 9), 0) * 0.6) +
        (NULLIF(total_brand_mentions, 0)::numeric / NULLIF(total_word_count, 1) * 0.4)
    ) AS calculated_visibility_index,
    visibility_index - (
        (1 / NULLIF(LOG(10, NULLIF(brand_first_position, 0) + 9), 0) * 0.6) +
        (NULLIF(total_brand_mentions, 0)::numeric / NULLIF(total_word_count, 1) * 0.4)
    ) AS difference
FROM extracted_positions
WHERE brand_id = '[YOUR_BRAND_ID]'
  AND customer_id = '[YOUR_CUSTOMER_ID]'
  AND competitor_name IS NULL
  AND visibility_index IS NOT NULL
  AND brand_first_position IS NOT NULL
ORDER BY processed_at DESC
LIMIT 10;
```

**Expected result:** `difference` should be ≈ 0 (small rounding differences are OK)

**Manual calculation example:**
- If `prominence = 0.872` and `density = 0.006`:
  - `Visibility Index = (0.872 × 0.6) + (0.006 × 0.4) = 0.5232 + 0.0024 = 0.5256`
  - Rounded to 2 decimals: `0.53`

---

## 🧮 Step 4: Manually Calculate Share of Answer (SOA)

```sql
-- Calculate SOA
SELECT 
    id,
    total_brand_mentions,
    competitor_mentions,
    share_of_answers_brand AS stored_soa,
    CASE 
        WHEN (total_brand_mentions + competitor_mentions) = 0 THEN NULL
        ELSE ROUND((total_brand_mentions::numeric / NULLIF((total_brand_mentions + competitor_mentions), 0)) * 100, 2)
    END AS calculated_soa,
    share_of_answers_brand - ROUND((total_brand_mentions::numeric / NULLIF((total_brand_mentions + competitor_mentions), 0)) * 100, 2) AS difference
FROM extracted_positions
WHERE brand_id = '[YOUR_BRAND_ID]'
  AND customer_id = '[YOUR_CUSTOMER_ID]'
  AND competitor_name IS NULL
  AND share_of_answers_brand IS NOT NULL
ORDER BY processed_at DESC
LIMIT 10;
```

**Expected result:** `difference` should be ≈ 0

**Manual calculation example:**
- If `total_brand_mentions = 5` and `competitor_mentions = 3`:
  - `SOA = (5 / (5 + 3)) × 100 = (5 / 8) × 100 = 62.5%`

---

## 🔗 Step 5: Verify Relationship with Sources

### A. See how extracted_positions link to sources via collector_results

```sql
-- Link extracted_positions → collector_results → citations → sources
SELECT 
    ep.id AS position_id,
    ep.collector_result_id,
    ep.visibility_index,
    ep.share_of_answers_brand,
    cr.id AS collector_result_id,
    cr.raw_answer,
    -- Count citations per collector result
    COUNT(DISTINCT c.id) AS citation_count,
    -- Get unique domains cited
    array_agg(DISTINCT c.domain) FILTER (WHERE c.domain IS NOT NULL) AS cited_domains
FROM extracted_positions ep
LEFT JOIN collector_results cr ON ep.collector_result_id = cr.id
LEFT JOIN citations c ON cr.id = c.collector_result_id
WHERE ep.brand_id = '[YOUR_BRAND_ID]'
  AND ep.customer_id = '[YOUR_CUSTOMER_ID]'
  AND ep.competitor_name IS NULL
GROUP BY ep.id, ep.collector_result_id, ep.visibility_index, ep.share_of_answers_brand, cr.id, cr.raw_answer
ORDER BY ep.processed_at DESC
LIMIT 10;
```

### B. Aggregate by source domain (like the Sources page)

```sql
-- Similar to source-attribution.service.ts logic
SELECT 
    c.domain,
    COUNT(DISTINCT ep.collector_result_id) AS collector_results_cited,
    COUNT(DISTINCT ep.id) AS position_count,
    -- Average SOA for this source
    AVG(ep.share_of_answers_brand) AS avg_soa,
    -- Average Visibility Index for this source
    AVG(ep.visibility_index) AS avg_visibility_index,
    -- Total mentions
    SUM(ep.total_brand_mentions) AS total_brand_mentions
FROM extracted_positions ep
JOIN collector_results cr ON ep.collector_result_id = cr.id
JOIN citations c ON cr.id = c.collector_result_id
WHERE ep.brand_id = '[YOUR_BRAND_ID]'
  AND ep.customer_id = '[YOUR_CUSTOMER_ID]'
  AND ep.competitor_name IS NULL
GROUP BY c.domain
ORDER BY collector_results_cited DESC
LIMIT 20;
```

---

## 📊 Step 6: Verify Dashboard Aggregations

### A. Average Visibility Index (shown as percentage in dashboard)

```sql
-- Calculate average Visibility Index (dashboard shows this × 100)
SELECT 
    AVG(visibility_index) * 100 AS avg_visibility_percentage,
    COUNT(*) AS total_queries,
    COUNT(CASE WHEN visibility_index IS NOT NULL THEN 1 END) AS queries_with_visibility
FROM extracted_positions
WHERE brand_id = '[YOUR_BRAND_ID]'
  AND customer_id = '[YOUR_CUSTOMER_ID]'
  AND competitor_name IS NULL
  AND processed_at >= NOW() - INTERVAL '7 days';  -- Adjust date range as needed
```

**Compare with:** Dashboard Visibility Score (should match `avg_visibility_percentage`)

### B. Average Share of Answer

```sql
-- Calculate average SOA
SELECT 
    AVG(share_of_answers_brand) AS avg_soa_percentage,
    COUNT(*) AS total_queries,
    COUNT(CASE WHEN share_of_answers_brand IS NOT NULL THEN 1 END) AS queries_with_soa
FROM extracted_positions
WHERE brand_id = '[YOUR_BRAND_ID]'
  AND customer_id = '[YOUR_CUSTOMER_ID]'
  AND competitor_name IS NULL
  AND processed_at >= NOW() - INTERVAL '7 days';  -- Adjust date range as needed
```

**Compare with:** Dashboard Share of Answers (should match `avg_soa_percentage`)

---

## 🔍 Step 7: Find Discrepancies

### Find records where calculation might be wrong:

```sql
-- Find rows where stored value doesn't match calculation
WITH calculated_values AS (
    SELECT 
        id,
        visibility_index AS stored_vi,
        share_of_answers_brand AS stored_soa,
        -- Calculate visibility index
        ROUND(
            (
                (1 / NULLIF(LOG(10, NULLIF(brand_first_position, 0) + 9), 0) * 0.6) +
                (NULLIF(total_brand_mentions, 0)::numeric / NULLIF(total_word_count, 1) * 0.4)
            )::numeric, 2
        ) AS calc_vi,
        -- Calculate SOA
        ROUND(
            (NULLIF(total_brand_mentions, 0)::numeric / NULLIF((total_brand_mentions + competitor_mentions), 0)) * 100, 2
        ) AS calc_soa
    FROM extracted_positions
    WHERE brand_id = '[YOUR_BRAND_ID]'
      AND customer_id = '[YOUR_CUSTOMER_ID]'
      AND competitor_name IS NULL
)
SELECT 
    id,
    stored_vi,
    calc_vi,
    ABS(stored_vi - calc_vi) AS vi_difference,
    stored_soa,
    calc_soa,
    ABS(stored_soa - calc_soa) AS soa_difference
FROM calculated_values
WHERE ABS(stored_vi - calc_vi) > 0.01  -- More than 0.01 difference
   OR ABS(stored_soa - calc_soa) > 0.01  -- More than 1% difference
ORDER BY vi_difference DESC, soa_difference DESC;
```

---

## 📋 Quick Verification Checklist

- [ ] **Step 1:** Identified brand_id and customer_id
- [ ] **Step 2:** Retrieved raw data from `extracted_positions`
- [ ] **Step 3:** Manually calculated Visibility Index for 3-5 sample rows
- [ ] **Step 4:** Manually calculated SOA for 3-5 sample rows
- [ ] **Step 5:** Verified relationship with sources via citations
- [ ] **Step 6:** Compared dashboard aggregations with SQL averages
- [ ] **Step 7:** Checked for discrepancies (differences > 0.01)

---

## 💡 Notes

1. **Visibility Index Range:** 0-1 (stored), displayed as 0-100% in frontend
2. **SOA Range:** 0-100 (stored as percentage)
3. **Rounding:** Values are rounded to 2 decimal places in calculations
4. **Null Handling:** If `total_word_count = 0` or no mentions, values may be `NULL`
5. **Multiple Positions:** One `collector_result_id` can have multiple `extracted_positions` rows (for different competitors), but for your brand, you typically want `competitor_name IS NULL`

---

## 🐛 Common Issues to Check

1. **Division by zero:** Ensure `total_word_count > 0` and `(total_brand_mentions + competitor_mentions) > 0`
2. **Null values:** Some rows may not have calculations if data is incomplete
3. **Competitor rows:** Always filter `competitor_name IS NULL` for brand metrics
4. **Date ranges:** Ensure you're comparing data from the same time period as the dashboard

