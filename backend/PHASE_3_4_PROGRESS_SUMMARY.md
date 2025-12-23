# Phase 3.4 Progress Summary - Topics Page Migration

**Status:** 🚧 40% Complete  
**Last Updated:** Just now

---

## ✅ COMPLETED

### Step 1: Helper Methods (DONE)
- ✅ Added `fetchDistinctCollectorTypes()` to get available models
- ✅ Added `fetchTopicPositions()` to get brand metrics for topics
- ✅ Added `fetchCompetitorAveragesByTopic()` for competitive benchmarks
- ✅ All methods tested, no linter errors
- ✅ Committed and pushed to main

---

## 🚧 IN PROGRESS

### Step 2: Migrate Brand Service (NEXT)

**File:** `backend/src/services/brand.service.ts`  
**Method:** `getBrandTopicsWithAnalytics()`  
**Lines to modify:** ~1360-1920 (3 query points)

**Changes Required:**

1. **Line ~1467:** Get distinct collector types  
   ```typescript
   // OLD
   const { data: distinctCollectors } = await supabaseAdmin
     .from('extracted_positions')
     .select('collector_type')
     ...
   
   // NEW
   if (USE_OPTIMIZED_TOPICS_QUERY) {
     const result = await optimizedMetricsHelper.fetchDistinctCollectorTypes({
       brandId,
       startDate: startIso,
       endDate: endIso,
     });
     availableModels = result.data;
   } else {
     // existing query
   }
   ```

2. **Line ~1492-1570:** Get brand positions  
   ```typescript
   // OLD
   let positions: any[] = [];
   let positionsQuery = supabaseAdmin
     .from('extracted_positions')
     .select('share_of_answers_brand, ...')
     ...
   
   // NEW
   if (USE_OPTIMIZED_TOPICS_QUERY) {
     const result = await optimizedMetricsHelper.fetchTopicPositions({
       brandId,
       customerId,
       startDate: startIso,
       endDate: endIso,
       collectorTypes: mappedCollectorTypes,
       collectorResultIds: collectorResultIds,
     });
     positions = result.data;
   } else {
     // existing query
   }
   ```

3. **Line ~1920-1975:** Get competitor averages  
   ```typescript
   // OLD
   let positionsQuery = supabaseAdmin
     .from('extracted_positions')
     .select('share_of_answers_competitor')
     ...
   
   // NEW  
   if (USE_OPTIMIZED_TOPICS_QUERY) {
     const result = await optimizedMetricsHelper.fetchCompetitorAveragesByTopic({
       brandIds: allBrandIds,
       startDate: startIso,
       endDate: endIso,
       collectorTypes: mappedCollectorTypes,
     });
     competitorAvgMap = result.data;
   } else {
     // existing query
   }
   ```

**Key Considerations:**
- Keep ALL existing topic grouping logic (lines 1580-1750)
- Keep ALL filtering logic for collector_types
- Preserve exact output format
- Add comprehensive logging
- Import OptimizedMetricsHelper at top of file

---

## ⏸️ PENDING

- [ ] Add feature flag to `.env`
- [ ] Update `FEATURE_FLAGS.md`
- [ ] Test with Bose brand
- [ ] Verify all metrics match
- [ ] Performance testing

---

## 📊 ESTIMATED TIME REMAINING

- Brand service migration: **2-3 hours**
- Testing & fixes: **2-3 hours**
- **Total:** 4-6 hours (rest of today)

---

## 🎯 TODAY'S GOAL

Get Topics page showing NEW data for Bose brand by end of day!

