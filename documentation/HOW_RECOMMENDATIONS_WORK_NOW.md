# How Recommendations Work Now (With Domain Readiness Integration)

## 🎯 Overview

The recommendation engine now **intelligently filters** recommendations based on Domain Readiness audit results. This prevents redundant suggestions for technical elements that are already optimized.

---

## 📊 Complete Flow (Step-by-Step)

### Step 1: User Requests Recommendations
- **Trigger:** User clicks "Generate Recommendations" in the UI
- **API Call:** `POST /api/recommendations-v3/generate`
- **Payload:** `{ brandId: "..." }`

### Step 2: Gather Brand Context
The system collects:
- Brand metrics (visibility, SOA, sentiment)
- Citation sources and their performance
- Competitor data
- Trend analysis (current vs previous period)
- **Data maturity classification** (cold_start / low_data / normal)

### Step 3: Fetch Domain Readiness Audit ⭐ **NEW**
- **What happens:** System fetches the latest Domain Readiness audit for the brand
- **Checks:**
  - Does an audit exist?
  - Is the audit stale? (> 90 days old → ignored)
  - What's the overall score? (0-100)
  - What tests passed/failed?

**Example:**
```
✅ Found Domain Readiness audit (score: 85/100, date: 2025-01-15, 5 days old)
```

### Step 4: Generate Recommendations
The LLM generates recommendations based on:
- Brand performance data
- Citation source metrics
- Identified KPIs
- Competitor analysis

**Example recommendations generated:**
1. "Audit and optimize XML sitemap, robots.txt, and crawlability"
2. "Develop high-impact case studies"
3. "Optimize directory listings across review sites"
4. "Create FAQ content on reddit.com"

### Step 5: Post-Processing
Standard filtering:
- Competitor exclusion (don't recommend competitor domains)
- Quality filtering (remove low-quality recommendations)
- Ranking (deterministic scoring)

### Step 6: Domain Readiness Filtering ⭐ **NEW**
**This is where the magic happens:**

For each recommendation:
1. **Check if it's "owned-site"** (only filter technical fixes, not external sources)
2. **Extract keywords** from recommendation action text
3. **Match keywords** to Domain Readiness tests:
   - "sitemap" → XML Sitemap test
   - "robots.txt" → Robots.txt test
   - "faq" → FAQ Content test
   - etc.
4. **Check test result:**
   - If test **PASSED** (score ≥ 80) → **FILTER OUT** ❌
   - If test **FAILED** (score < 60) → **KEEP** ✅
   - If test is **WARNING** (60-79) → **KEEP** ✅

**Example:**
```
🚫 [DomainReadinessFilter] Filtering: "Audit and optimize XML sitemap..." - 
    XML Sitemap already optimized (score: 95, status: pass)
```

### Step 7: Priority Enhancement ⭐ **NEW**
Recommendations that address **failed Domain Readiness tests** get:
- **Priority boost** (+10 to +15 points)
- **Priority upgrade** (Low → Medium → High)
- **Higher calculated score** for ranking

**Example:**
```
⬆️ [DomainReadinessFilter] Priority boost (+15) for recommendation: 
    "Fix Robots.txt: Blocking AI bots" - addresses: Robots.txt
```

### Step 8: Save to Database
- Recommendations saved with IDs
- Generation record created
- Audit reference stored (optional, for future analytics)

### Step 9: Return to User
Final recommendations displayed in UI, with:
- No redundant technical recommendations
- Higher priority for addressing readiness gaps
- More relevant, actionable suggestions

---

## 🔍 How Filtering Works (Technical Details)

### Keyword Mapping

The system maps Domain Readiness tests to recommendation keywords:

| Domain Readiness Test | Recommendation Keywords |
|----------------------|------------------------|
| XML Sitemap | "sitemap", "xml sitemap", "sitemap.xml" |
| Robots.txt | "robots.txt", "robots", "crawlability" |
| LLMs.txt | "llms.txt", "llm", "ai bot access" |
| FAQ Content | "faq", "frequently asked", "q&a" |
| Schema Markup | "schema", "schema.org", "structured data" |
| Canonical URLs | "canonical", "canonical url" |

### Filtering Logic

```typescript
// Pseudo-code
if (recommendation.citationSource === 'owned-site') {
  for each keyword in recommendation.action {
    if (keyword matches Domain Readiness test) {
      if (test.status === 'pass' && test.score >= 80) {
        FILTER_OUT // Already optimized
      } else {
        KEEP // Needs work
      }
    }
  }
}
```

### What Gets Filtered vs Kept

**FILTERED OUT (❌):**
- Recommendations for technical elements that **passed** (score ≥ 80)
- Only applies to "owned-site" recommendations
- Example: "Optimize XML sitemap" when sitemap is 95/100

**KEPT (✅):**
- Recommendations for technical elements that **failed** (score < 60)
- Recommendations for external sources (directories, partnerships)
- Content/strategy recommendations (not technical)
- Example: "Fix robots.txt" when robots.txt is 30/100

---

## ✅ How to Verify Implementation

### Method 1: Check Server Logs

When generating recommendations, look for these log messages:

#### ✅ Audit Found
```
📊 [RecommendationV3Service] Fetching Domain Readiness audit...
✅ [RecommendationV3Service] Found Domain Readiness audit (score: 85/100, date: 2025-01-15, 5 days old)
```

#### ✅ Filtering Happening
```
🚫 [DomainReadinessFilter] Filtering: "Audit and optimize XML sitemap..." - XML Sitemap already optimized (score: 95, status: pass)
🚫 [RecommendationV3Service] Filtered 2 recommendation(s) based on Domain Readiness audit
```

#### ✅ Priority Enhancement
```
⬆️ [DomainReadinessFilter] Priority boost (+15) for recommendation: "Fix Robots.txt..." - addresses: Robots.txt
```

#### ⚠️ No Audit
```
⚠️ [RecommendationV3Service] No Domain Readiness audit found - recommendations will not be filtered
```

#### ⚠️ Stale Audit
```
⚠️ [RecommendationV3Service] Domain Readiness audit is stale (95 days old) - ignoring for filtering
```

### Method 2: Test with Real Brands

#### Test Case 1: Brand with High Readiness Score

**Setup:**
1. Run Domain Readiness audit for a brand
2. Ensure XML Sitemap, Robots.txt show "Pass" (score ≥ 80)
3. Generate recommendations

**Expected Result:**
- Recommendations mentioning "sitemap", "robots.txt" should be **filtered out**
- Logs should show: `🚫 Filtering: "optimize XML sitemap..."`

**How to Verify:**
```bash
# Check backend logs
tail -f backend/logs/app.log | grep "DomainReadinessFilter"
```

#### Test Case 2: Brand with Low Readiness Score

**Setup:**
1. Run Domain Readiness audit for a brand
2. Ensure XML Sitemap, Robots.txt show "Fail" (score < 60)
3. Generate recommendations

**Expected Result:**
- Recommendations mentioning "sitemap", "robots.txt" should be **kept**
- Priority should be **boosted** (High priority)
- Logs should show: `⬆️ Priority boost (+15)`

**How to Verify:**
- Check recommendations in UI - technical recommendations should appear
- Check logs for priority boost messages

#### Test Case 3: Brand with No Audit

**Setup:**
1. Use a brand that has **never** run a Domain Readiness audit
2. Generate recommendations

**Expected Result:**
- **No filtering** should occur
- All recommendations should appear
- Logs should show: `⚠️ No Domain Readiness audit found`

**How to Verify:**
- All recommendations should appear normally
- No filtering messages in logs

### Method 3: Database Verification

Check if recommendations were filtered:

```sql
-- Check recommendation generation records
SELECT 
  id,
  brand_id,
  recommendations_count,
  metadata->>'domainReadinessScore' as readiness_score,
  created_at
FROM recommendation_generations
ORDER BY created_at DESC
LIMIT 10;
```

### Method 4: API Testing

**Test the API directly:**

```bash
# Generate recommendations
curl -X POST http://localhost:3000/api/recommendations-v3/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brandId": "YOUR_BRAND_ID"}'
```

**Check response:**
- Look for `recommendations` array
- Count how many recommendations were returned
- Compare with logs to see if any were filtered

### Method 5: Compare Before/After

**Before Integration:**
- Generate recommendations for a brand with high readiness
- Note recommendations mentioning "sitemap", "robots.txt"

**After Integration:**
- Generate recommendations for the same brand
- Those technical recommendations should be **missing** (filtered out)

---

## 🧪 Quick Test Script

Here's a simple test you can run:

```bash
# 1. Start your backend server
cd backend
npm run dev

# 2. In another terminal, watch logs
tail -f logs/app.log | grep -E "(DomainReadiness|Filtering|Priority boost)"

# 3. Generate recommendations via API or UI
# 4. Check logs for filtering messages
```

---

## 📈 Expected Behavior Examples

### Example 1: High Readiness Brand (85/100)

**Domain Readiness Results:**
- XML Sitemap: ✅ Pass (95/100)
- Robots.txt: ✅ Pass (90/100)
- FAQ Content: ✅ Pass (88/100)

**Recommendations Generated:**
1. "Audit and optimize XML sitemap, robots.txt, and crawlability" ❌ **FILTERED**
2. "Develop high-impact case studies" ✅ **KEPT**
3. "Optimize directory listings" ✅ **KEPT** (external source)

**Result:** Only 2 recommendations shown to user (1 filtered)

---

### Example 2: Low Readiness Brand (45/100)

**Domain Readiness Results:**
- XML Sitemap: ❌ Fail (30/100)
- Robots.txt: ❌ Fail (25/100)
- FAQ Content: ❌ Fail (40/100)

**Recommendations Generated:**
1. "Fix XML Sitemap: Missing or incomplete sitemap.xml" ✅ **KEPT** + Priority: High
2. "Fix Robots.txt: Blocking AI bots" ✅ **KEPT** + Priority: High
3. "Audit and optimize FAQ content" ✅ **KEPT** + Priority: Medium

**Result:** All 3 recommendations shown, with priority boosts

---

### Example 3: No Audit

**Domain Readiness Results:**
- No audit available

**Recommendations Generated:**
1. "Audit and optimize XML sitemap" ✅ **KEPT** (no filtering)
2. "Develop case studies" ✅ **KEPT**
3. "Optimize directories" ✅ **KEPT**

**Result:** All recommendations shown (no filtering without audit)

---

## 🔧 Troubleshooting

### Issue: No filtering happening

**Check:**
1. Does the brand have a Domain Readiness audit?
   ```sql
   SELECT * FROM domain_readiness_audits WHERE brand_id = 'YOUR_BRAND_ID' ORDER BY created_at DESC LIMIT 1;
   ```

2. Is the audit stale? (> 90 days old)
   - Check logs for: `⚠️ Domain Readiness audit is stale`

3. Are recommendations for "owned-site"?
   - Only "owned-site" recommendations are filtered
   - External sources (directories) are never filtered

### Issue: Too many recommendations filtered

**Check:**
1. Are the test scores correct? (should be ≥ 80 to filter)
2. Check logs for filtering messages to see which ones were filtered
3. Verify keyword matching is working correctly

### Issue: Priority not boosting

**Check:**
1. Are there failed tests in the audit? (score < 60)
2. Do recommendations match keywords for failed tests?
3. Check logs for: `⬆️ Priority boost`

---

## 📝 Summary

**What Changed:**
- ✅ Recommendations are now filtered based on Domain Readiness
- ✅ Redundant technical recommendations are removed
- ✅ Priority is boosted for addressing readiness gaps
- ✅ Works gracefully when no audit exists

**How to Verify:**
1. ✅ Check server logs for filtering messages
2. ✅ Test with brands (high/low/no readiness)
3. ✅ Compare before/after recommendations
4. ✅ Check database for generation records

**Key Log Messages to Look For:**
- `✅ Found Domain Readiness audit` - Audit found
- `🚫 Filtering:` - Recommendation filtered
- `⬆️ Priority boost` - Priority enhanced
- `⚠️ No Domain Readiness audit found` - No audit (no filtering)

---

**Status:** ✅ **FULLY IMPLEMENTED AND READY TO TEST**
