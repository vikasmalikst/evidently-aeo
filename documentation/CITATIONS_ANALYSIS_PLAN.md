# Citations Analysis & Calculation Plan

## Executive Summary

This document provides a comprehensive analysis of how citations are calculated, displayed, and normalized across all dashboard pages. It identifies issues with normalization and clarifies what each metric actually represents.

---

## 1. Where Citations Are Displayed

### 1.1 Dashboard Page (`/src/pages/Dashboard.tsx`)
- **Top Brand Sources** widget (lines 728-838)
  - Shows top 5 sources where brand is cited
  - Displays: Impact Score (0-10), Change, Domain, URL
  - Data source: `dashboardData.topBrandSources`
  - Calculated in: `backend/src/services/brand-dashboard/payload-builder.ts` (lines 981-1004)

### 1.2 Search Sources Page (`/src/pages/SearchSources.tsx`)
- **Source Attribution Table** (lines 902-1392)
  - Full table of all citation sources
  - Columns: Source, Type, Mention Rate, Share of Answer (SOA), Sentiment, Top Topics, Pages, Prompts
  - Data source: `/brands/{brandId}/sources` API endpoint
  - Calculated in: `backend/src/services/source-attribution.service.ts`

### 1.3 Topics Analysis Page (`/src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx`)
- **Topics Ranked Table** shows SOA per topic
- Uses topic-level SOA calculations

---

## 2. Key Metrics Explained

### 2.1 Share of Answer (SOA) - THE CRITICAL CONFUSION

#### What is SOA?
SOA represents the brand's share of mentions in AI-generated answers. It's stored in `extracted_positions.share_of_answers_brand`.

#### Current Calculation Flow:

**Step 1: Data Storage**
- `extracted_positions.share_of_answers_brand` stores SOA per query/collector result
- Can be stored as:
  - Decimal (0.0-1.0) - e.g., 0.67 = 67%
  - Percentage (0-100) - e.g., 67 = 67%

**Step 2: Domain-Level Aggregation** (in `source-attribution.service.ts`)
```typescript
// Line 648-652: For each domain (e.g., help.lyft.com)
const avgShareRaw = average(aggregate.shareValues) // Average of all SOA values where this domain is cited
const avgShare = toPercentage(avgShareRaw) // Normalizes to 0-100%
```

**Step 3: The Confusion - What Does "SOA of help.lyft.com" Mean?**

**CURRENT BEHAVIOR:**
- "SOA of help.lyft.com" = **Average of brand's SOA values across all queries where help.lyft.com is cited**
- Example:
  - Query 1: help.lyft.com cited, brand SOA = 0.8 (80%)
  - Query 2: help.lyft.com cited, brand SOA = 0.5 (50%)
  - Query 3: help.lyft.com cited, brand SOA = 0.6 (60%)
  - **Result: help.lyft.com SOA = (0.8 + 0.5 + 0.6) / 3 = 0.633 = 63.3%**

**WHAT IT SHOULD MEAN (Clarification Needed):**
- Option A: **Domain-level SOA** (current) - Average brand SOA when this domain is cited
- Option B: **Brand's SOA specifically in this domain** - Only queries where brand appears in help.lyft.com content
- Option C: **Domain's share of total answer space** - What % of all answers cite help.lyft.com

**RECOMMENDATION:** 
- Current implementation (Option A) makes sense for "Share of Answer" metric
- But we need to clarify: "When help.lyft.com is cited, what is the average brand SOA?"
- This is NOT "What is the brand's SOA specifically in help.lyft.com content"

### 2.2 Mention Rate

**Definition:** Percentage of total collector results where this source is cited

**Formula:**
```typescript
mentionRate = (uniqueCollectorResults / totalResponsesCount) * 100
```

**Example:**
- Total collector results: 100
- help.lyft.com cited in: 10 collector results
- Mention Rate = (10/100) * 100 = 10%

**Status:** ✅ Clear and correct

### 2.3 Impact Score (Top Brand Sources)

**Definition:** Weighted combination of usage, share, and visibility

**Formula:**
```typescript
// Lines 983-989 in payload-builder.ts
usageNorm = source.usage / maxSourceUsage  // Normalized 0-1
shareNorm = source.share / 100             // Normalized 0-1
visibilityNorm = source.visibility / 100   // Normalized 0-1
impactScore = (0.35 * shareNorm + 0.35 * visibilityNorm + 0.3 * usageNorm) * 10
```

**Issues:**
- ❌ Normalizes all values to 0-1, then scales to 0-10
- ❌ Loses real value information
- ❌ Makes comparison difficult

**Status:** ⚠️ Needs to show real values

---

## 3. Normalization Issues

### 3.1 `toPercentage()` Function (utils.ts, lines 65-73)

```typescript
export const toPercentage = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value <= 1) {
    return clampPercentage(value * 100)  // Assumes 0-1 scale
  }
  return clampPercentage(value)          // Assumes already 0-100
}
```

**Problem:**
- Assumes values ≤ 1 are decimals (0-1 scale)
- Assumes values > 1 are percentages (0-100 scale)
- **This is ambiguous!** What if SOA is stored as 0.67 (67%) but we want to show it as 67%?
- What if SOA is stored as 67 (67%) and we multiply by 100, getting 6700%?

**Where Used:**
1. `source-attribution.service.ts` line 652: `const avgShare = toPercentage(avgShareRaw)`
2. `payload-builder.ts` line 971: `share: toPercentage(avgShare)`
3. `payload-builder.ts` line 972: `visibility: toPercentage(avgVisibilityRaw)`

### 3.2 `normalizeSentiment()` Function (utils.ts, lines 47-54)

```typescript
export const normalizeSentiment = (values: number[]): number => {
  if (!values.length) {
    return 50  // Default to neutral
  }
  const avgRaw = average(values)  // -1 to 1 scale
  const normalized = ((avgRaw + 1) / 2) * 100  // Converts to 0-100
  return Math.min(100, Math.max(0, normalized))
}
```

**Problem:**
- Converts sentiment from -1 to 1 scale to 0-100 scale
- **Loses original sentiment information**
- User wants to see real sentiment values (-1 to 1)

**Where Used:**
- `visibility.service.ts` lines 268, 279
- Should be removed - show raw sentiment

### 3.3 Impact Score Normalization (payload-builder.ts, lines 983-989)

**Problem:**
- Normalizes usage, share, and visibility to 0-1
- Then creates weighted average
- **Loses real value information**

---

## 4. Data Flow Analysis

### 4.1 Source Attribution Service Flow

```
1. Fetch citations from `citations` table
   └─> Domain, URL, usage_count, collector_result_id

2. Fetch SOA from `extracted_positions` table
   └─> share_of_answers_brand per collector_result_id

3. Aggregate by domain
   └─> Collect all SOA values where domain is cited
   └─> Average them: avgShareRaw = average(shareValues)

4. Normalize SOA
   └─> avgShare = toPercentage(avgShareRaw)  // ⚠️ PROBLEM HERE

5. Calculate Mention Rate
   └─> mentionRate = (uniqueCollectorResults / totalResponsesCount) * 100

6. Return to frontend
   └─> Displayed in SearchSources table
```

### 4.2 Top Brand Sources Flow

```
1. Fetch citations from `citations` table
   └─> Domain, URL, usage_count, collector_result_id

2. For each unique source (URL):
   a. Get all collector_result_ids where this source is cited
   b. Fetch SOA and visibility from `extracted_positions`
   c. Average: avgShare, avgVisibility
   d. Count: usage (total citations)

3. Normalize values
   └─> share = toPercentage(avgShare)  // ⚠️ PROBLEM
   └─> visibility = toPercentage(avgVisibility)  // ⚠️ PROBLEM

4. Calculate Impact Score
   └─> Normalize to 0-1, then weighted average, then scale to 0-10  // ⚠️ PROBLEM

5. Return top 5 sources
   └─> Displayed in Dashboard "Top Brand Sources"
```

---

## 5. Issues Identified

### 5.1 Critical Issues

1. **SOA Normalization Ambiguity**
   - `toPercentage()` assumes values ≤ 1 are decimals
   - But we don't know if SOA is stored as 0-1 or 0-100
   - **Solution:** Check database schema, standardize storage format, remove normalization

2. **Sentiment Normalization**
   - Converts -1 to 1 scale to 0-100
   - **Solution:** Show raw sentiment values (-1 to 1)

3. **Impact Score Loses Real Values**
   - Normalizes everything to 0-1, then scales to 0-10
   - **Solution:** Show real values (usage count, SOA %, visibility %)

4. **Unclear SOA Definition**
   - "SOA of help.lyft.com" is ambiguous
   - **Solution:** Clarify in UI: "Average Brand SOA when this source is cited"

### 5.2 Minor Issues

1. **Previous Period Comparison**
   - Uses different calculation method (line 667 in source-attribution.service.ts)
   - May cause incorrect change calculations

2. **Missing Data Handling**
   - Some places return 0, others return null
   - Should be consistent

---

## 6. Recommended Fixes

### 6.1 Remove All Normalization

**Action Items:**

1. **Remove `toPercentage()` normalization**
   - Check database: What format is `share_of_answers_brand` stored in?
   - If stored as 0-1: Multiply by 100 ONCE at display time
   - If stored as 0-100: Use directly
   - **Never normalize twice**

2. **Remove `normalizeSentiment()`**
   - Show raw sentiment values (-1 to 1)
   - Update UI to display properly

3. **Remove Impact Score normalization**
   - Show real values:
     - Usage: Actual citation count
     - SOA: Actual percentage (0-100%)
     - Visibility: Actual percentage (0-100%)
   - Remove the 0-10 impact score, or calculate it differently

### 6.2 Clarify SOA Definition

**Update UI Labels:**

- Current: "Share of Answer: 67.9%"
- New: "Avg Brand SOA when cited: 67.9%"
- Tooltip: "Average Share of Answer for your brand across all queries where this source is cited"

### 6.3 Standardize Data Format

**Database Check:**
```sql
-- Check what format share_of_answers_brand is stored in
SELECT 
  share_of_answers_brand,
  COUNT(*) as count
FROM extracted_positions
WHERE share_of_answers_brand IS NOT NULL
GROUP BY share_of_answers_brand
ORDER BY count DESC
LIMIT 20;
```

**Decision:**
- ✅ **CONFIRMED:** SOA is stored as **0-100 percentage** format
- Source: `position-extraction.service.ts:736` calculates as `(primaryMentions / total) * 100`
- **Action:** Remove `toPercentage()` normalization - values are already 0-100
- **Standardize:** Ensure all SOA values are stored as 0-100 (already the case)

### 6.4 Update Calculation Functions

**Before:**
```typescript
const avgShare = toPercentage(avgShareRaw)  // Ambiguous normalization
```

**After:**
```typescript
// SOA is stored as 0-100 percentage (confirmed in position-extraction.service.ts:736)
const avgShare = avgShareRaw  // Use directly - already 0-100 format
// No normalization needed!
```

---

## 7. Implementation Plan

### Phase 1: Investigation (Day 1)
1. ✅ Check database schema for `share_of_answers_brand` format
   - **FINDING:** SOA is stored as **0-100 percentage** (not 0-1 decimal)
   - Source: `position-extraction.service.ts:736` - `const share = (primaryMentions / total) * 100;`
   - This means `toPercentage()` should NOT multiply by 100 if value > 1
   - However, `toPercentage()` logic is still problematic: it assumes values ≤ 1 are decimals
2. ✅ Check sample data to see actual values
3. ✅ Document current normalization points

### Phase 2: Remove Normalization (Day 2)
1. Remove `toPercentage()` calls
2. Remove `normalizeSentiment()` calls
3. Update calculations to use raw values
4. Update display to show real values

### Phase 3: Update UI (Day 3)
1. Update labels to clarify SOA meaning
2. Update Impact Score to show real values
3. Add tooltips explaining metrics
4. Update SearchSources table headers

### Phase 4: Testing (Day 4)
1. Test with real data
2. Verify calculations match expectations
3. Check all pages display correctly
4. Verify no double-normalization

### Phase 5: Documentation (Day 5)
1. Update API documentation
2. Update frontend component docs
3. Create metric definitions document

---

## 8. Files to Modify

### Backend Files:
1. `backend/src/services/source-attribution.service.ts`
   - Remove `toPercentage()` calls (line 652, 672)
   - Update SOA calculation to use raw values

2. `backend/src/services/brand-dashboard/payload-builder.ts`
   - Remove `toPercentage()` calls (lines 971, 972)
   - Update Impact Score calculation (lines 983-989)
   - Show real values instead of normalized

3. `backend/src/services/brand-dashboard/utils.ts`
   - Mark `toPercentage()` as deprecated
   - Mark `normalizeSentiment()` as deprecated
   - Add new helper functions if needed

4. `backend/src/services/brand-dashboard/visibility.service.ts`
   - Remove `normalizeSentiment()` calls (lines 268, 279)

### Frontend Files:
1. `src/pages/SearchSources.tsx`
   - Update table headers with clarifications
   - Add tooltips explaining SOA

2. `src/pages/Dashboard.tsx`
   - Update "Top Brand Sources" to show real values
   - Remove Impact Score or recalculate without normalization
   - Add tooltips

3. `src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx`
   - Update SOA display to show real values

---

## 9. Testing Checklist

- [ ] SOA values match database values (no double normalization)
- [ ] Sentiment shows -1 to 1 scale (not 0-100)
- [ ] Impact Score shows real values or is removed
- [ ] All pages display citations correctly
- [ ] Previous period comparisons work correctly
- [ ] No performance degradation
- [ ] Tooltips explain metrics clearly

---

## 10. Questions to Answer

1. **What format is `share_of_answers_brand` stored in the database?**
   - 0-1 decimal or 0-100 percentage?

2. **What should "SOA of help.lyft.com" actually mean?**
   - Current: Average brand SOA when this domain is cited
   - Alternative: Brand's SOA specifically in this domain's content
   - Alternative: Domain's share of total answer space

3. **Should Impact Score be removed or recalculated?**
   - Option A: Remove it, show real values (usage, SOA, visibility)
   - Option B: Keep it but calculate differently (without normalization)

4. **Should we show both domain-level and brand-specific SOA?**
   - Domain-level: Average brand SOA when domain is cited
   - Brand-specific: Brand SOA only in queries where brand appears in this domain

---

## 11. Example: help.lyft.com SOA Calculation

### Current (with normalization):
```
Query 1: help.lyft.com cited, brand SOA = 0.8 (stored as decimal)
Query 2: help.lyft.com cited, brand SOA = 0.5 (stored as decimal)
Query 3: help.lyft.com cited, brand SOA = 0.6 (stored as decimal)

avgShareRaw = (0.8 + 0.5 + 0.6) / 3 = 0.633
avgShare = toPercentage(0.633) = 63.3%  // ✅ Correct IF stored as 0-1
```

### If stored as 0-100 (percentage):
```
Query 1: help.lyft.com cited, brand SOA = 80 (stored as percentage)
Query 2: help.lyft.com cited, brand SOA = 50 (stored as percentage)
Query 3: help.lyft.com cited, brand SOA = 60 (stored as percentage)

avgShareRaw = (80 + 50 + 60) / 3 = 63.3
avgShare = toPercentage(63.3) = 63.3%  // ✅ Correct (no change needed)
```

### Problem:
If database has MIXED formats:
```
Query 1: brand SOA = 0.8 (decimal)
Query 2: brand SOA = 50 (percentage)

avgShareRaw = (0.8 + 50) / 2 = 25.4
avgShare = toPercentage(25.4) = 25.4%  // ❌ WRONG! Should be ~25.4% or 50%?
```

**Solution:** Standardize database format first!

---

## 12. Next Steps

1. **Immediate:** Check database format for `share_of_answers_brand`
2. **Immediate:** Document actual SOA calculation in code comments
3. **Short-term:** Remove all normalization functions
4. **Short-term:** Update UI to show real values
5. **Long-term:** Consider showing both domain-level and brand-specific SOA

---

## Appendix: Key Code Locations

### SOA Calculation:
- `backend/src/services/source-attribution.service.ts:648-652`
- `backend/src/services/brand-dashboard/payload-builder.ts:962-973`

### Normalization Functions:
- `backend/src/services/brand-dashboard/utils.ts:47-73`

### Display:
- `src/pages/SearchSources.tsx:1218` (SOA column)
- `src/pages/Dashboard.tsx:804` (Impact Score)

### Impact Score:
- `backend/src/services/brand-dashboard/payload-builder.ts:981-1004`

