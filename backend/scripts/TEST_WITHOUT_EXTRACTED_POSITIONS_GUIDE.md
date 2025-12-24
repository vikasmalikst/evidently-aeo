# Testing Without extracted_positions Table - Guide

This guide walks you through safely testing the system with the `extracted_positions` table disabled to verify all services work with the new schema.

---

## 🎯 Purpose

Verify that all services work correctly when `extracted_positions` table is unavailable, confirming that:
1. All UI services use new schema
2. All write operations use new schema
3. No services have hidden dependencies on old table

---

## 📋 Prerequisites

1. ✅ `USE_CONSOLIDATED_ANALYSIS=true` is enabled
2. ✅ All feature flags for optimized queries are ready (can be enabled)
3. ✅ Database backup (optional but recommended)
4. ✅ Access to Supabase database

---

## 🚀 Step-by-Step Process

### Step 1: Disable the Table

Run the SQL script to rename the table (making it inaccessible):

```bash
# Option 1: Using psql
psql $DATABASE_URL -f backend/scripts/test-without-extracted-positions.sql

# Option 2: Using Supabase CLI
supabase db execute -f backend/scripts/test-without-extracted-positions.sql

# Option 3: Copy/paste SQL into Supabase dashboard SQL editor
```

**What this does:**
- Renames `extracted_positions` → `extracted_positions_disabled_test`
- Renames `extracted_positions_compat` → `extracted_positions_compat_disabled_test`
- All queries to `extracted_positions` will now fail

---

### Step 2: Verify Table is Disabled

Check that the table is inaccessible:

```sql
-- This should fail
SELECT * FROM extracted_positions LIMIT 1;
```

Expected: Error like "relation 'extracted_positions' does not exist"

---

### Step 3: Enable Feature Flags (Temporary)

For testing, enable all optimized query flags:

```bash
export USE_OPTIMIZED_TOPICS_QUERY=true
export USE_OPTIMIZED_PROMPTS_ANALYTICS=true
export USE_OPTIMIZED_SOURCE_ATTRIBUTION=true
export USE_OPTIMIZED_KEYWORDS_QUERY=true
export USE_OPTIMIZED_RECOMMENDATIONS_V1=true
export USE_OPTIMIZED_RECOMMENDATIONS_V3=true
export USE_OPTIMIZED_POSITION_CHECK=true
export USE_OPTIMIZED_SENTIMENT_QUERY=true
export USE_OPTIMIZED_PROMPT_METRICS=true
export USE_OPTIMIZED_VALIDATION=true
```

Or add to `.env` file temporarily.

---

### Step 4: Run Automated Tests

Run the comprehensive test script:

```bash
cd backend
npx ts-node scripts/test-services-without-extracted-positions.ts
```

**What this tests:**
- ✅ Database connectivity
- ✅ New schema tables exist
- ✅ OptimizedMetricsHelper (brand metrics)
- ✅ OptimizedMetricsHelper (competitor metrics)
- ✅ Dashboard service
- ✅ Topics service
- ✅ Source Attribution service
- ✅ Consolidated Scoring service

**Expected Output:**
```
🧪 Testing Services Without extracted_positions Table
============================================================
✅ Database: Verify extracted_positions is disabled (5ms)
✅ Database: Verify new schema tables exist (12ms)
✅ OptimizedMetricsHelper: Fetch brand metrics by date range (45ms)
✅ OptimizedMetricsHelper: Fetch competitor metrics by date range (38ms)
✅ Dashboard Service: Build dashboard payload (120ms)
✅ Topics Service: Fetch topics with analytics (89ms)
✅ Source Attribution Service: Fetch source attribution (67ms)
✅ Consolidated Scoring Service: Validate scoring service (3ms)

📊 TEST SUMMARY
Total Tests: 8
✅ Passed: 8
❌ Failed: 0
⏱️  Total Duration: 379ms

✅ ALL TESTS PASSED - extracted_positions table can be safely dropped!
```

---

### Step 5: Manual UI Testing (Recommended)

Test each UI page manually:

1. **Dashboard** (`/brands/:brandId`)
   - Should load without errors
   - Metrics should display correctly

2. **Topics Page** (`/brands/:brandId/topics`)
   - Should load topics
   - Competitor data should display

3. **Source Attribution** (`/brands/:brandId/sources`)
   - Should load sources
   - SOA and sentiment should display

4. **Prompts Analytics** (`/brands/:brandId/prompts`)
   - Should load prompts
   - Metrics should display

5. **Keywords** (`/brands/:brandId/keywords`)
   - Should load keywords
   - Presence data should display

6. **Recommendations** (`/recommendations`)
   - Should generate recommendations
   - Competitor data should display

---

### Step 6: Test Write Operations (Optional)

If you want to test write operations:

```bash
# Trigger a data collection run
# This should write to new schema only
curl -X POST http://localhost:3000/api/admin/brands/:brandId/collect-and-score
```

Check logs to verify:
- ✅ Writes to `metric_facts`, `brand_metrics`, `competitor_metrics`
- ✅ Writes to `brand_sentiment`, `competitor_sentiment`
- ❌ No writes to `extracted_positions` (should fail if attempted)

---

## 🔄 Rollback (If Needed)

If any tests fail, restore the table:

```bash
# Option 1: Using psql
psql $DATABASE_URL -f backend/scripts/rollback-extracted-positions.sql

# Option 2: Using Supabase CLI
supabase db execute -f backend/scripts/rollback-extracted-positions.sql

# Option 3: Copy/paste SQL into Supabase dashboard
```

**What this does:**
- Renames `extracted_positions_disabled_test` → `extracted_positions`
- Restores the table to original state

---

## ✅ Success Criteria

All of the following must pass:

- [x] ✅ Automated tests pass (0 failures)
- [x] ✅ All UI pages load without errors
- [x] ✅ All UI pages display data correctly
- [x] ✅ No errors in browser console
- [x] ✅ No errors in backend logs
- [x] ✅ Write operations succeed (if tested)

---

## 🎯 Next Steps After Successful Tests

If all tests pass:

1. **Keep table disabled** (or drop it permanently)
2. **Enable all feature flags** in production
3. **Monitor for 1 week**
4. **Remove legacy fallback code**
5. **Drop table permanently** (if not already done)

---

## ⚠️ Troubleshooting

### Test Fails: "Table should be disabled but query succeeded"
- **Cause:** Table rename didn't work
- **Fix:** Check if table was renamed correctly
- **SQL:** `SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%extracted_positions%';`

### Test Fails: "Failed to fetch brand metrics"
- **Cause:** No data in new schema tables
- **Fix:** Run data collection first to populate new schema
- **Note:** This is expected if you haven't collected data yet

### UI Shows Errors
- **Cause:** Feature flags not enabled
- **Fix:** Enable all `USE_OPTIMIZED_*` flags
- **Check:** Backend logs for specific errors

### Write Operations Fail
- **Cause:** Service trying to write to old table
- **Fix:** Check which service failed, review code
- **Action:** Migrate that service to new schema

---

## 📝 Notes

- **Safe Operation:** Renaming is reversible (not destructive)
- **No Data Loss:** Data remains in renamed table
- **Quick Rollback:** Can restore in seconds if needed
- **Production Safe:** Can test in staging first

---

## 🎉 Success!

If all tests pass, you've confirmed:
- ✅ 100% migration to new schema
- ✅ No hidden dependencies on old table
- ✅ Safe to drop `extracted_positions` table

**Congratulations!** The migration is complete and verified! 🚀

