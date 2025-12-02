# Industry SOA Calculation Explanation

## Overview

This document explains how **Avg Industry SOA** and **Avg Competitor SOA** are calculated in the Topics Analysis page.

## Important Note

**There is NO separate "Avg Competitor SOA" calculation.** The system only calculates **"Avg Industry SOA"**, which represents the average SOA of all brands/competitors (excluding the current brand) mentioned in LLM responses for each topic.

## Avg Industry SOA Calculation

### Backend Calculation (`brand.service.ts` - `getIndustryAvgSoAPerTopic`)

**Location:** `backend/src/services/brand.service.ts` (lines 1665-1819)

**Method:**
1. **Data Source:** Queries the `extracted_positions` table
2. **Filters:**
   - `customer_id` = current customer
   - `brand_id` ≠ current brand (excludes your brand)
   - `processed_at` within selected date range
3. **Grouping:** Groups by normalized topic name (lowercase, trimmed)
4. **Calculation:**
   - **Important:** Brand and competitor SOA values are stored adjacently in the table
   - For each row, collects BOTH:
     - `share_of_answers_brand` (the main brand's SOA in that row)
     - `share_of_answers_competitor` (the competitor brand's SOA in that row)
   - Sums all these SOA values (from both columns) for each topic
   - Calculates the **average** of all collected SOA values
   - Both columns store values as **percentage (0-100)** format
   - This captures all brand SOA values from the industry, not just the "main" brand in each row
5. **Returns:**
   - `avgSoA`: Average SOA as percentage (0-100)
   - `trend`: Direction and delta (calculated from first half vs second half of time period)
   - `brandCount`: Number of unique brands contributing to the average

### Frontend Transformation (`Topics.tsx`)

**Location:** `src/pages/Topics.tsx` (lines 65-69)

**Transformation:**
- Backend returns `industryAvgSoA` as **percentage (0-100)**
- Frontend converts to **multiplier (0-5x)** for internal storage:
  ```typescript
  industryAvgSoA = backendPercentage / 20
  ```
- Example: Backend returns `25.5%` → Frontend stores as `1.275x` multiplier

### Display in UI

**Table (`TopicsRankedTable.tsx`):**
- Converts multiplier back to percentage for display: `(industryAvgSoA * 20).toFixed(1)%`
- Shows "—" if `industryAvgSoA` is null/undefined

**Charts (`TopicsBarChart.tsx`, `TopicsRacingBarChart.tsx`):**
- Converts multiplier to percentage: `(topic.industryAvgSoA * 20)`
- Only shows comparison bars if at least one topic has industry data
- Shows horizontal marker line for average across all topics

## Data Format

### Database Format
- **Column:** `share_of_answers_brand` in `extracted_positions` table
- **Format:** Percentage (0-100)
- **Source:** Calculated during position extraction from LLM responses

### Backend API Response
- **Field:** `industryAvgSoA` in topic object
- **Format:** Percentage (0-100)
- **Example:** `25.5` means 25.5%

### Frontend Storage
- **Field:** `topic.industryAvgSoA`
- **Format:** Multiplier (0-5x)
- **Example:** `1.275` means 1.275x (which equals 25.5%)

## When Industry SOA is Null

Industry SOA will be `null` when:
1. **No other brands** are tracking the same topics
2. **Topic name normalization** doesn't match (e.g., "running shoes" vs "Running Shoes")
3. **No data** exists in the selected date range
4. **Backend query** doesn't find matching `extracted_positions` records

## Gap Calculation

**Location:** `src/pages/TopicsAnalysis/components/CompactMetricsPods.tsx` (lines 29-50)

**Logic:**
- Counts topics where: `Brand SOA < Industry Avg SOA`
- Even if the difference is very small, it's still counted as a gap
- Both values are compared in percentage format (0-100)

**Formula:**
```typescript
const brandSoA = topic.currentSoA || (topic.soA * 20); // Percentage
const industryAvgSoA = (topic.industryAvgSoA * 20); // Convert multiplier to percentage
if (brandSoA < industryAvgSoA) {
  // This is a gap
}
```

## Verification Checklist

To verify the calculation is using the correct metrics:

1. **Database Columns:** ✅ Using BOTH `share_of_answers_brand` AND `share_of_answers_competitor` from `extracted_positions`
2. **Brand Filtering:** ✅ Excluding current brand (`brand_id != currentBrandId`)
3. **Topic Matching:** ✅ Normalizing topic names (lowercase, trimmed)
4. **Date Range:** ✅ Filtering by `processed_at` within selected range
5. **Average Calculation:** ✅ Simple average of ALL SOA values (from both brand and competitor columns)
6. **Format Conversion:** ✅ Backend returns percentage, frontend converts to multiplier

## Data Structure Understanding

**Important:** In the `extracted_positions` table, brand and competitor data are stored adjacently:
- Each collector result compares a brand with its competitor
- Row 1: `brand_name = Nike`, `share_of_answers_brand = Nike's SOA`, `share_of_answers_competitor = Adidas's SOA`
- Row 2: `brand_name = Adidas`, `share_of_answers_brand = Adidas's SOA`, `share_of_answers_competitor = Nike's SOA`

To get the complete industry average, we must sum both columns because:
- `share_of_answers_brand` contains the main brand's SOA
- `share_of_answers_competitor` contains the competitor brand's SOA
- Both represent real brand SOA values that should be included in the industry average

## Questions to Verify

1. **Is `share_of_answers_brand` the correct column?**
   - This represents the brand's share of answer in LLM responses
   - Should we be using a different metric?

2. **Should we exclude any specific brands?**
   - Currently excludes only the current brand
   - Should we exclude test brands, inactive brands, etc.?

3. **Is topic name normalization sufficient?**
   - Currently using lowercase + trim
   - Should we do fuzzy matching or handle synonyms?

4. **Should we weight by brand size or query volume?**
   - Currently using simple average
   - Should larger brands have more weight?

5. **Is the date range filtering correct?**
   - Currently using `processed_at` field
   - Should we use a different date field?

