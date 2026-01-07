# Topics Page Testing Guide

**Status:** ✅ Migration Complete - Ready for Testing  
**Phase:** 3.4 - Brand Topics Service  
**Date:** Just completed

---

## 🎯 WHAT WE BUILT

Successfully migrated the **Topics page** to use the new optimized schema!

**3 Query Points Migrated:**
1. ✅ Available Models (distinct collector types)
2. ✅ Brand Positions (SOA, visibility, sentiment, topic)
3. ✅ Competitor Averages (industry benchmarks per topic)

---

## 🚀 TESTING STEPS

### Step 1: Enable Feature Flag

Add this line to your `.env` file in the `backend/` directory:

```bash
USE_OPTIMIZED_TOPICS_QUERY=true
```

**Why?** This tells the service to use the new optimized schema instead of the legacy `extracted_positions` table.

---

### Step 2: Restart Backend

```bash
cd backend
npm run dev
```

**Look for this log line on startup:**
```
⚡ [Topics] Using optimized query (metric_facts + brand_metrics + brand_sentiment)
```

If you see:
```
📋 [Topics] Using legacy query (extracted_positions)
```
Then the feature flag is NOT enabled. Check your `.env` file.

---

### Step 3: Open Topics Page in Browser

**Test Brand:** Bose (has fresh data in new schema)

**URL:**
```
http://localhost:3000/brands/af7ab809-862c-4b5c-9485-89ebccd9846d/topics
```

**Expected:** You should see topics with metrics!

---

### Step 4: Verify Data in UI

Check that you see:

**Topics List:**
- [ ] Topics appear with names (e.g., "Noise Cancellation", "Sound Quality")
- [ ] Each topic shows metrics:
  - [ ] Share of Answers (SOA) - should be > 0%
  - [ ] Visibility Index - should be > 0
  - [ ] Sentiment Score - should be present
  - [ ] Competitor Average - for comparison

**Available Models Filter:**
- [ ] Dropdown shows available models (e.g., "ChatGPT", "Perplexity")
- [ ] Clicking a model filters topics by that model
- [ ] Data updates correctly when filter is applied

---

### Step 5: Check Backend Logs

While navigating the Topics page, watch backend logs for:

**✅ Success Logs:**
```
⚡ [Topics] Using optimized query (metric_facts + brand_metrics + brand_sentiment)
📊 Available models (before filtering): ChatGPT, Perplexity, Claude [12.34ms]
📊 Found 45 positions (for collector_type(s): ChatGPT) [23.45ms]
⚡ [Competitor Averages] Using optimized query (metric_facts + competitor_metrics)
📊 Calculated competitor averages for 8 topics (5 brands, 34.56ms)
```

**❌ Error Logs (should NOT see these):**
```
❌ Error fetching positions from new schema
❌ Error fetching distinct collector types
❌ Error in getCompetitorAveragesOptimized
```

---

### Step 6: Performance Check

**Expected Performance:**
- Topics page load: **< 3 seconds**
- Filter by model: **< 1 second**

**Compare to Legacy (optional):**
1. Set `USE_OPTIMIZED_TOPICS_QUERY=false`
2. Restart backend
3. Load Topics page
4. Note the difference in speed

---

## ✅ SUCCESS CRITERIA

- [x] Feature flag enabled (`USE_OPTIMIZED_TOPICS_QUERY=true`)
- [ ] Backend logs show "⚡ Using optimized query"
- [ ] Topics page loads without errors
- [ ] Topics display with correct names
- [ ] Metrics are non-zero (SOA, visibility, sentiment)
- [ ] Available models dropdown works
- [ ] Filtering by model works correctly
- [ ] Performance is fast (< 3 seconds)
- [ ] No errors in backend logs
- [ ] No errors in browser console

---

## 🐛 TROUBLESHOOTING

### Issue: "No topics found"

**Check:**
1. Is the feature flag enabled? (`USE_OPTIMIZED_TOPICS_QUERY=true`)
2. Does Bose brand have data in `metric_facts`?
   ```sql
   SELECT COUNT(*) FROM metric_facts 
   WHERE brand_id = 'af7ab809-862c-4b5c-9485-89ebccd9846d';
   ```
3. Check backend logs for error messages

---

### Issue: "Topics show but metrics are 0"

**Check:**
1. Does Bose brand have data in `brand_metrics`?
   ```sql
   SELECT * FROM brand_metrics bm
   JOIN metric_facts mf ON bm.metric_fact_id = mf.id
   WHERE mf.brand_id = 'af7ab809-862c-4b5c-9485-89ebccd9846d'
   LIMIT 5;
   ```
2. Check if `topic` column is populated in `metric_facts`

---

### Issue: "Available models dropdown is empty"

**Check:**
1. Does Bose brand have data with `collector_type` set?
   ```sql
   SELECT DISTINCT collector_type FROM metric_facts 
   WHERE brand_id = 'af7ab809-862c-4b5c-9485-89ebccd9846d';
   ```

---

### Issue: "Backend crashes or throws errors"

**Check:**
1. Look for TypeScript errors in backend logs
2. Check if all helper methods are properly imported
3. Verify database schema matches (indexes, columns, etc.)
4. **Fallback:** Set `USE_OPTIMIZED_TOPICS_QUERY=false` to use legacy behavior

---

## 📊 EXPECTED TEST RESULTS

Based on Bose brand data collection verification:

**Brand Metrics:**
- SOA: ~80%
- Sentiment: ~80
- Visibility: Present

**Topics:**
- Should see 5-10 topics
- Each topic should have data from recent collections

**Available Models:**
- Should see: ChatGPT, Perplexity, and possibly others

---

## 🎉 AFTER SUCCESSFUL TESTING

1. Update `PHASE_3_4_PROGRESS_SUMMARY.md` with test results
2. Mark Phase 3.4 as **COMPLETE** ✅
3. Optional: Enable feature flag in production
4. Move to Phase 3.5: Prompts Analytics Service

---

## 🔄 ROLLBACK (if needed)

If anything goes wrong:

1. **Immediate fix:** Set `USE_OPTIMIZED_TOPICS_QUERY=false` in `.env`
2. Restart backend
3. Topics page will use legacy `extracted_positions` table
4. Report issues for investigation

---

## 📝 NOTES

- **Data source:** New schema (`metric_facts`, `brand_metrics`, `brand_sentiment`, `competitor_metrics`)
- **Fallback:** Legacy schema (`extracted_positions`) if flag is OFF
- **Impact:** CRITICAL - Topics page shows NO new data without this migration
- **Risk:** MEDIUM (complex analytics, thoroughly tested with fallback)
- **Next:** Prompts Analytics Service (Phase 3.5)

