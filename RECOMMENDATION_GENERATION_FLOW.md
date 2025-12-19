# Recommendation Generation Flow & Log Explanation

## What the Logs Mean

### Key Issue: `⚠️ [RecommendationV3Service] No sourceMetrics available in context`

**What this means:**
- The system tried to gather citation sources from your database but found **ZERO citations** for this brand in the last 30 days
- This happens when:
  1. No data has been collected yet (cron job hasn't run)
  2. The `extracted_citations` table has no rows for this brand
  3. All citations are older than 30 days

**Result:**
- The LLM sees "No sources available" in the prompt
- It generates recommendations with `"citationSource": "No sources available"` (literally that string!)
- All 8 recommendations have no matching source data → 0 matched, 8 unmatched

### Other Log Messages:

- `⚠️ Warning: Could not fetch queries` - Issue fetching collector queries (separate system)
- `⚠️ No collector_results found` - No collector results exist for this brand
- `✅ Cerebras API succeeded` - LLM generation worked fine (primary provider)
- `📊 Source data matched: 0, unmatched: 8` - No sources matched because none exist

---

## Recommendation Generation Flow (Short Version)

### Step-by-Step Process:

```
1. User clicks "Generate Recommendations"
   ↓
2. Backend: gatherBrandContext()
   ├─ Gets brand info (name, industry)
   ├─ Gets overall metrics (visibility, SOA, sentiment) from extracted_positions
   ├─ Gets competitor data
   └─ Gets source metrics from extracted_citations ← **THIS IS WHERE IT FAILED**
   ↓
3. Backend: generateRecommendationsDirect()
   ├─ Formats brand metrics for prompt
   ├─ Formats source list with exact domains + scores
   └─ Sends prompt to LLM (Cerebras primary, OpenRouter fallback)
   ↓
4. LLM generates JSON array of recommendations
   ↓
5. Backend: Enriches recommendations
   ├─ Maps citationSource to actual sourceMetrics
   ├─ Fills in real metrics (impactScore, mentionRate, soa, sentiment, etc.)
   └─ Saves to database with IDs
   ↓
6. Frontend receives recommendations and displays them
```

---

## How Sources Are Sent to LLM

### 1. Source Gathering (`gatherBrandContext`)

**Database Query:**
```sql
SELECT domain, collector_result_id, usage_count 
FROM citations
WHERE brand_id = ? 
  AND customer_id = ?
  AND created_at >= (30 days ago)
  AND created_at <= (today)
```

**Processing:**
- Groups citations by domain (normalized: lowercase, no www)
- For each domain, calculates:
  - **citations**: Count of citations
  - **mentionRate**: (unique collector_results / total collector_results) × 100
  - **soa**: Average share_of_answers_brand from extracted_positions
  - **sentiment**: Average sentiment_score from extracted_positions
  - **visibility**: Average visibility_index from extracted_positions
  - **impactScore**: Weighted formula: `(0.35 × soa + 0.35 × visibility + 0.3 × usage) / 10`

**Result:** Array of top 10 sources with all metrics

### 2. Prompt Formatting (`generateRecommendationsDirect`)

**Two formats are sent to LLM:**

**A. Simple Domain List (for strict matching):**
```
Available Citation Sources (you MUST use ONLY these exact domains):
1. example.com
2. another-domain.com
3. third-site.com
```

**B. Detailed Source Summary (with metrics):**
```
Source Details:
  1. example.com (150 citations, Impact 8.5/10, Mention Rate 45.2%, SOA 32.1%, Sentiment 68.5, Visibility 0.4)
  2. another-domain.com (120 citations, Impact 7.2/10, ...)
```

### 3. What LLM Receives

The prompt includes:
- Brand name, industry
- Overall brand metrics (visibility, SOA, sentiment)
- **Exact list of available domains** (numbered)
- **Detailed metrics for each domain** (citations, impact, mention rate, SOA, sentiment, visibility)
- Instructions to use ONLY the listed domains

### 4. What LLM Generates

```json
{
  "action": "Publish content on example.com",
  "citationSource": "example.com",  // Must match one from the list
  "focusArea": "visibility",
  "priority": "High",
  "effort": "Medium",
  // ... other fields
}
```

### 5. Backend Enrichment

After LLM generates recommendations:
- Backend finds matching source in `sourceMetrics` array
- Fills in real metrics:
  - `impactScore`: From sourceMetrics
  - `mentionRate`: From sourceMetrics
  - `soa`: From sourceMetrics
  - `sentiment`: From sourceMetrics
  - `visibilityScore`: From sourceMetrics
  - `citationCount`: From sourceMetrics

**If no match found:** All metrics remain `null` → Shows as empty in UI

---

## Why You're Seeing "No sources available"

**Root Cause:** The `citations` table has no data for this brand in the last 30 days.

**Solutions:**
1. **Wait for cron job** - If data collection runs daily, wait for it to populate citations
2. **Check database** - Verify `citations` table has rows for this brand
3. **Extend date range** - Temporarily increase the 30-day window to find older citations
4. **Manual data** - If this is a new brand, you may need to run data collection first

**Note:** The system uses the `citations` table (not `extracted_citations`). Each citation has a `collector_result_id` which is used to fetch scores from the `extracted_positions` table, following the same pattern as the Search-Sources page.

**Temporary Fix:** The system will still generate recommendations, but they won't have source-specific metrics. They'll be generic recommendations without citation source data.

---

## Current State

✅ **Working:**
- LLM generation (Cerebras)
- Recommendation creation
- Database saving
- Frontend display

❌ **Not Working:**
- Source matching (0/8 matched)
- Source-specific metrics (all null)
- LLM is using "No sources available" as citationSource

**Next Steps:**
1. Check if `extracted_citations` table has data for this brand
2. If not, wait for cron job or manually trigger data collection
3. Once citations exist, regenerate recommendations

