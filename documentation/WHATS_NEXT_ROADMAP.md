# What's Next: Schema Migration Roadmap

**Last Updated:** Just now  
**Current Phase:** 3.4 Complete (pending user testing)  
**Overall Progress:** 4 of 7 phases complete (57%)

---

## 📊 COMPLETED PHASES ✅

### Phase 3.1: Query Helpers Foundation ✅
- **Status:** Complete
- **Deliverable:** `OptimizedMetricsHelper` with 7 reusable methods
- **Impact:** Foundation for all subsequent migrations

### Phase 3.2: Low-Risk Services ✅
- **Status:** Complete
- **Services Migrated:**
  1. Position Extraction Service (existence checks)
  2. Sentiment Services (deprecated, backfill only)
  3. Prompt Metrics Service (internal use)
  4. Keywords Analytics Service (keywords page)

### Phase 3.3: Source Attribution Service ✅
- **Status:** Complete and Verified
- **Testing:** Verified with Bose brand (working correctly)
- **Impact:** Source Attribution page shows new data

### Phase 3.4: Topics Page Service ✅
- **Status:** Implementation Complete, Testing Pending
- **What's Done:**
  - All 3 query points migrated
  - Competitor data bug fixed (SOA, Visibility, Sentiment)
  - Feature flag: `USE_OPTIMIZED_TOPICS_QUERY`
  - Comprehensive documentation
- **What's Needed:** User testing to confirm fix

---

## 🎯 IMMEDIATE NEXT STEP

### **USER ACTION REQUIRED: Test Phase 3.4**

**Before moving to Phase 3.5, please verify Phase 3.4 fix:**

1. Add to `backend/.env`:
   ```bash
   USE_OPTIMIZED_TOPICS_QUERY=true
   ```

2. Restart backend:
   ```bash
   cd backend
   npm run dev
   ```

3. Test Topics page:
   - URL: `/brands/af7ab809-862c-4b5c-9485-89ebccd9846d/topics`
   - Verify topics appear with metrics
   - **Check competitor data** (SOA, Visibility, Sentiment - should NOT be zero/null)
   - Check available models filter works

4. **Report results:**
   - ✅ If working: Move to Phase 3.5
   - ❌ If issues: Report specific discrepancies

**Estimated time:** 15-30 minutes

---

## 🚀 UPCOMING PHASES

### Phase 3.5: Prompts Analytics Service (NEXT)

**Priority:** 🔴 **URGENT - HIGH IMPACT**

**Problem:**
- Prompts Analytics page shows **NO NEW DATA** after collection
- Users expect to see their newly collected prompts and metrics
- Creates confusion, makes feature appear broken

**Service:** `backend/src/services/prompts-analytics.service.ts`

**What Needs Migration:**

**Query Point 1: Visibility & Sentiment Scores**
- **Current:** Queries `extracted_positions` for:
  - `visibility_index` (brand visibility per prompt)
  - `sentiment_score` (sentiment analysis)
  - `total_brand_mentions` (brand mention counts)
  - `total_brand_product_mentions` (product mentions)
  - `competitor_mentions` (competitor mentions)
- **New:** Query `metric_facts` + `brand_metrics` + `brand_sentiment`

**Query Point 2: Competitor Names**
- **Current:** Extracts competitor names from `extracted_positions.competitor_name`
- **New:** Query `competitor_metrics` joined with `brand_competitors`

**Complexity:** HIGH
- Service is complex (1156 lines)
- Multiple aggregations and calculations
- Handles both query-based and collector-based grouping
- Critical user-facing page

**Estimated Time:** 2-3 days

**Impact:**
- ✅ Prompts page shows NEW data immediately
- ✅ Users can see their collected prompts and responses
- ✅ Accurate metrics (visibility, sentiment, mentions)

---

### Phase 3.6: Recommendation Services

**Priority:** 🔴 **HIGH IMPACT**

**Problem:**
- Recommendations are using **OLD DATA** from `extracted_positions_compat`
- AI-generated insights may be inaccurate or outdated

**Services to Migrate:**
1. **Brand Recommendations Service** (if exists)
2. **AI Insights Service** (if exists)
3. Any service generating recommendations based on brand data

**Complexity:** MEDIUM-HIGH
- Depends on how recommendations are generated
- May need to update recommendation algorithms
- Need to verify AI prompts still work with new schema

**Estimated Time:** 1-2 days

**Impact:**
- ✅ Recommendations based on latest data
- ✅ More accurate AI insights
- ✅ Better user experience

---

### Phase 3.7: Cleanup & Finalization

**Priority:** 🟡 **CLEANUP**

**What to Do:**

1. **Remove Compatibility View** (if safe)
   - Verify NO services still using `extracted_positions_compat`
   - Drop materialized view
   - Update documentation

2. **Remove Legacy Code**
   - Remove all `if (USE_OPTIMIZED_*) {} else {}` branches
   - Keep only optimized code paths
   - Remove feature flags from `.env`

3. **Remove Old Table** (if safe)
   - Verify NO services still reading from `extracted_positions`
   - Archive or drop `extracted_positions` table
   - Update documentation

4. **Performance Optimization**
   - Add missing indexes if needed
   - Optimize slow queries
   - Monitor performance in production

5. **Final Documentation**
   - Update all docs to reflect new schema
   - Remove "legacy" references
   - Create migration complete summary

**Complexity:** LOW-MEDIUM
**Estimated Time:** 1-2 days

**Impact:**
- ✅ Cleaner codebase
- ✅ Better performance
- ✅ Easier maintenance

---

## 📅 ESTIMATED TIMELINE

| Phase | Status | Estimated Time | Cumulative |
|-------|--------|----------------|------------|
| 3.1 Query Helpers | ✅ Complete | - | - |
| 3.2 Low-Risk Services | ✅ Complete | - | - |
| 3.3 Source Attribution | ✅ Complete | - | - |
| 3.4 Topics Page | ⏳ Testing | 30 min | - |
| **3.5 Prompts Analytics** | 🔜 Next | **2-3 days** | 2-3 days |
| 3.6 Recommendations | Pending | 1-2 days | 3-5 days |
| 3.7 Cleanup | Pending | 1-2 days | 4-7 days |

**Total Remaining:** ~4-7 days of work

---

## 🎯 SUCCESS METRICS

### How We'll Know We're Done:

**User Experience:**
- ✅ All UI pages show NEW data immediately after collection
- ✅ No user confusion about "missing data"
- ✅ Accurate metrics across all pages
- ✅ Fast page load times (< 3 seconds)

**Technical:**
- ✅ Zero services reading from `extracted_positions`
- ✅ Zero services reading from `extracted_positions_compat`
- ✅ All write operations going to new schema
- ✅ No feature flags (all optimized code)
- ✅ Clean codebase with no legacy branches

**Data Quality:**
- ✅ All metrics match between old and new schema (verified)
- ✅ No data loss during migration
- ✅ Competitor data accurate (SOA, Visibility, Sentiment)
- ✅ Trends calculated correctly

---

## 📊 CURRENT STATE SUMMARY

### Services Using NEW Schema (✅ 6):
1. ✅ Position Extraction Service (writes)
2. ✅ Consolidated Scoring Service (writes)
3. ✅ Dashboard/Payload Builder (reads)
4. ✅ Source Attribution Service (reads)
5. ✅ Keywords Analytics Service (reads)
6. ✅ Topics Page Service (reads - pending testing)

### Services Using OLD Schema (❌ 2):
1. ❌ Prompts Analytics Service (reads from `extracted_positions`)
2. ❌ Recommendation Services (reads from `extracted_positions_compat`)

### Services Still Reading `extracted_positions` (❌ 7):
According to `EXTRACTED_POSITIONS_USAGE_ANALYSIS.md`:
1. Prompts Analytics Service
2. Brand Topics Service (legacy fallback)
3. Source Attribution Service (legacy fallback)
4. Keywords Analytics Service (legacy fallback)
5. Sentiment Services (legacy fallback)
6. Prompt Metrics Service (legacy fallback)
7. Position Extraction Service (legacy fallback)

**Note:** Most of these have optimized paths with feature flags. Once flags are permanently enabled, legacy paths can be removed.

---

## 🎉 WHAT WE'VE ACCOMPLISHED

- ✅ **Normalized schema** designed and implemented
- ✅ **Zero downtime migration** (dual-write strategy)
- ✅ **Dashboard migrated** and working
- ✅ **Source Attribution migrated** and verified
- ✅ **Topics Page migrated** (pending testing)
- ✅ **6 services** fully migrated
- ✅ **Feature flags** for safe rollout
- ✅ **Comprehensive documentation** created
- ✅ **Testing guides** for each phase

---

## 💡 RECOMMENDATIONS

### For You (User):

1. **Test Phase 3.4 ASAP** (Topics page)
   - This unblocks Phase 3.5
   - Verify competitor data fix works

2. **After Phase 3.4 Testing:**
   - Give go-ahead for Phase 3.5 (Prompts Analytics)
   - This is HIGH IMPACT for users

3. **Plan for Cleanup (Phase 3.7):**
   - Schedule 1-2 days after Phases 3.5-3.6 complete
   - This will finalize the migration

### For Me (AI):

1. **Wait for Phase 3.4 test results**
   - Don't start Phase 3.5 until Phase 3.4 verified

2. **Prepare Phase 3.5 plan**
   - Analyze `prompts-analytics.service.ts` in detail
   - Design helper methods needed
   - Create migration plan document

3. **Be ready to fix issues**
   - If Phase 3.4 has issues, fix immediately
   - If Phase 3.5 reveals new patterns, adapt

---

## 🔄 DECISION POINTS

### After Phase 3.4 Testing:

**If working correctly:**
→ Proceed to Phase 3.5 (Prompts Analytics)

**If still has issues:**
→ Debug and fix Phase 3.4 before moving forward

### After Phase 3.5 Complete:

**If user wants faster completion:**
→ Do Phases 3.6 and 3.7 in parallel

**If user wants careful approach:**
→ Do Phase 3.6, test, then Phase 3.7

---

## ❓ QUESTIONS TO CONSIDER

1. **Do you want to test Phase 3.4 now?**
   - This is blocking Phase 3.5

2. **After Phase 3.5, should we prioritize Recommendations or Cleanup?**
   - Recommendations = better user experience
   - Cleanup = cleaner codebase

3. **When do you want to enable all flags in production?**
   - After all phases complete?
   - Or enable gradually as each phase is verified?

---

**🎯 IMMEDIATE ACTION: Please test Phase 3.4 (Topics page) and report results!**

