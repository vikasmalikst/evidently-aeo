# Phase 3.2 Testing Guide
## Testing Optimized Queries Through Existing UI

**Last Updated**: December 22, 2025  
**Services to Test**: 4 migrated services from Phase 3.2

---

## 🎯 What We're Testing

Phase 3.2 migrated 4 services to use optimized queries. Now we'll test them through the UI to ensure:
1. ✅ Results match the old queries
2. ✅ Performance is improved
3. ✅ No errors occur
4. ✅ UI displays data correctly

---

## 📋 Prerequisites

- Backend server running
- Access to `.env` file in `backend/` directory
- UI accessible (usually `http://localhost:5173`)
- Database has some test data

---

## Step 1: Enable Feature Flags

Edit your `backend/.env` file and add these feature flags:

```bash
# Phase 3.2 - Optimized Query Feature Flags (Testing)
USE_OPTIMIZED_POSITION_CHECK=true
USE_OPTIMIZED_SENTIMENT_QUERY=true
USE_OPTIMIZED_PROMPT_METRICS=true
USE_OPTIMIZED_KEYWORDS_QUERY=true
```

**Note**: Set to `true` to test optimized queries, `false` to use legacy queries.

---

## Step 2: Restart Backend Server

After adding the flags, restart your backend:

```bash
# Stop current server (Ctrl+C)
# Then restart
cd backend
npm run dev
```

**Verify in logs**: You should see messages like:
- `⚡ Using optimized existence check (metric_facts)`
- `⚡ Using optimized sentiment query (new schema)`
- etc.

---

## Step 3: Test Each Service

### Test 1: Keywords Analytics Service ✅

**Feature Flag**: `USE_OPTIMIZED_KEYWORDS_QUERY=true`

**UI Location**: Keywords Analytics page

**Steps**:
1. Navigate to Keywords page in UI
2. Select a brand
3. Choose date range (e.g., last 30 days)
4. Optionally filter by LLM model (e.g., ChatGPT)
5. Click "Analyze" or view results

**What to Check**:
- ✅ Page loads without errors
- ✅ Keywords list displays
- ✅ Volume counts shown
- ✅ Presence percentages calculated
- ✅ Data matches previous results

**Backend Logs to Watch**:
```
Look for: "⚡ Using optimized keywords query" or "📋 Using legacy"
Check: Query duration (should be faster with optimized)
```

**Performance Comparison**:
- With `USE_OPTIMIZED_KEYWORDS_QUERY=false`: Check response time
- With `USE_OPTIMIZED_KEYWORDS_QUERY=true`: Should be 10-15x faster

---

### Test 2: Prompt Metrics Service ✅

**Feature Flag**: `USE_OPTIMIZED_PROMPT_METRICS=true`

**UI Location**: Prompt Configuration / Prompt Metrics page

**Steps**:
1. Navigate to Prompt Configuration page
2. View prompt metrics for a brand
3. Check average visibility scores
4. Check average sentiment scores
5. Verify metrics display correctly

**What to Check**:
- ✅ Metrics load without errors
- ✅ Average visibility displayed
- ✅ Average sentiment displayed
- ✅ Coverage scores shown
- ✅ Values match previous results

**Backend Logs to Watch**:
```
This service is called when calculating prompt metrics
No specific log yet, but check for errors
```

**Performance Comparison**:
- Legacy: 2 separate queries
- Optimized: 1 single query (should be 10-15x faster)

---

### Test 3: Position Extraction Service ✅

**Feature Flag**: `USE_OPTIMIZED_POSITION_CHECK=true`

**UI Location**: Triggered during data collection / scoring

**Steps**:
1. Trigger a scoring job from Admin / Scheduled Jobs page
2. Or run position extraction manually:
   ```bash
   cd backend
   npm run positions:extract
   ```

**What to Check**:
- ✅ Scoring completes successfully
- ✅ Position extraction runs
- ✅ No "already has positions" errors
- ✅ New positions are created

**Backend Logs to Watch**:
```bash
# Look for these messages:
🔍 [Position Extraction] Checking which results already have positions...
⚡ [Position Extraction] Using optimized existence check (metric_facts)
ℹ️ [Position Extraction] Collector_result XXX already has positions (optimized, XXms)
```

**Performance Comparison**:
- Check the duration in logs (e.g., "optimized, 15ms")
- Should be 5-10x faster than legacy

---

### Test 4: Sentiment Services ✅

**Feature Flag**: `USE_OPTIMIZED_SENTIMENT_QUERY=true`

**UI Location**: Triggered during sentiment scoring (if running old sentiment flow)

**Note**: These services are **deprecated**. New flow uses consolidated analysis which already writes to the new schema. This flag only affects backfill operations.

**Steps**:
1. If you have old data without sentiment, trigger sentiment scoring:
   ```bash
   cd backend
   npm run sentiments:score
   ```

**What to Check**:
- ✅ Service finds rows without sentiment
- ✅ Sentiment scoring completes
- ✅ No errors in logs

**Backend Logs to Watch**:
```bash
🎯 Starting combined sentiment scoring (OpenRouter) ...
⚡ Using optimized sentiment query (new schema)
OR
📋 Using legacy sentiment query (extracted_positions)
```

---

## Step 4: Performance Comparison Test

### A/B Testing (Most Thorough)

1. **Test with Legacy (Baseline)**:
   - Set all flags to `false` in `.env`
   - Restart backend
   - Perform UI actions (keywords, prompt metrics, etc.)
   - Note response times in browser DevTools (Network tab)

2. **Test with Optimized**:
   - Set all flags to `true` in `.env`
   - Restart backend
   - Perform same UI actions
   - Note response times
   - Compare with baseline

**Expected Results**:
- 10-15x faster queries
- Same data displayed
- No errors

---

## Step 5: Check Backend Logs

After testing, check backend logs for:

```bash
# Search for optimized vs legacy messages
grep "optimized\|legacy" logs/*.log

# Check for errors
grep "ERROR\|Failed" logs/*.log

# Check query durations
grep "ms)" logs/*.log
```

---

## 🎯 Test Scenarios by UI Page

### Keywords Page
**Flags Used**: `USE_OPTIMIZED_KEYWORDS_QUERY`
**Actions**: View keywords, filter by date/model
**Expected**: Faster load, same data

### Prompt Metrics Page
**Flags Used**: `USE_OPTIMIZED_PROMPT_METRICS`
**Actions**: View prompt performance metrics
**Expected**: Faster calculation, same averages

### Admin / Scoring Page
**Flags Used**: `USE_OPTIMIZED_POSITION_CHECK`
**Actions**: Trigger scoring job
**Expected**: Faster position checks, same results

### Dashboard (General)
**Flags Used**: None directly (dashboard already uses new schema)
**Actions**: View visibility, sentiment charts
**Expected**: Already optimized in previous phases

---

## 📊 Success Criteria

### For Each Service:

**Functionality** ✅
- [ ] UI loads without errors
- [ ] Data displays correctly
- [ ] Values match legacy results

**Performance** ✅
- [ ] Queries complete faster (check logs)
- [ ] Page load times improved
- [ ] No timeout errors

**Stability** ✅
- [ ] No errors in browser console
- [ ] No errors in backend logs
- [ ] Feature flag can be toggled on/off

---

## 🔄 Rollback Plan

If you encounter issues:

1. **Immediate**: Set problematic flag to `false`
   ```bash
   USE_OPTIMIZED_KEYWORDS_QUERY=false
   ```

2. **Restart Backend**: Changes take effect immediately

3. **Report Issue**: Note which service failed and error messages

4. **Continue Testing**: Test other services independently

---

## 📝 Testing Checklist

Copy this checklist and check off as you test:

```
Phase 3.2 Services Testing:

Service 1: Keywords Analytics
- [ ] Flag enabled: USE_OPTIMIZED_KEYWORDS_QUERY=true
- [ ] Backend restarted
- [ ] Keywords page loads
- [ ] Data displays correctly
- [ ] Performance improved (checked logs)
- [ ] No errors

Service 2: Prompt Metrics
- [ ] Flag enabled: USE_OPTIMIZED_PROMPT_METRICS=true
- [ ] Backend restarted
- [ ] Prompt metrics load
- [ ] Averages calculated correctly
- [ ] Performance improved
- [ ] No errors

Service 3: Position Extraction
- [ ] Flag enabled: USE_OPTIMIZED_POSITION_CHECK=true
- [ ] Backend restarted
- [ ] Scoring job triggered
- [ ] Position checks work
- [ ] Logs show "optimized" path
- [ ] No errors

Service 4: Sentiment Services
- [ ] Flag enabled: USE_OPTIMIZED_SENTIMENT_QUERY=true
- [ ] Backend restarted
- [ ] Sentiment scoring works (if needed)
- [ ] Logs show correct path
- [ ] No errors

Overall:
- [ ] All 4 services tested
- [ ] Performance improved overall
- [ ] No breaking changes
- [ ] Ready for production (or rollback if issues)
```

---

## 🐛 Troubleshooting

### Issue: "Cannot read property of undefined"
**Solution**: Check that new schema tables exist (metric_facts, brand_metrics, etc.)

### Issue: "No data displayed"
**Solution**: 
1. Check if data exists in new schema
2. Try with flag set to `false` (legacy)
3. If legacy works, there might be a data mapping issue

### Issue: "Query timeout"
**Solution**: 
1. Check database indexes are created
2. Verify migration ran successfully
3. Check query in Supabase SQL editor

### Issue: "Different results than legacy"
**Solution**:
1. This could indicate a bug in transformation logic
2. Set flag to `false` and report the issue
3. Check backend logs for specific differences

---

## 📊 Performance Monitoring

### What to Monitor:

**Response Times**:
- Browser DevTools → Network tab
- Check API request durations
- Compare before/after enabling flags

**Backend Logs**:
- Query durations (look for "XXms" in logs)
- Error rates
- Which path is being used (optimized vs legacy)

**Database**:
- Query execution times in Supabase dashboard
- Index usage
- Table scan vs index scan

---

## 🎉 Expected Results

If all tests pass:

- ✅ All 4 services work correctly
- ✅ 10-15x performance improvement
- ✅ Same data displayed in UI
- ✅ No errors in logs
- ✅ **Phase 3.2 validated for production!**

---

## 📞 Next Steps After Testing

### If All Tests Pass:
1. Document test results
2. Plan production rollout schedule
3. Proceed to Phase 3.3 (Source Attribution)

### If Issues Found:
1. Disable problematic flag
2. Document the issue
3. Fix the issue
4. Re-test
5. Then proceed

---

## 💡 Tips

1. **Test one service at a time**: Enable one flag, test, then move to next
2. **Use browser DevTools**: Monitor network requests and console errors
3. **Check backend logs**: Most useful debugging information is there
4. **Compare results**: Toggle flag on/off to compare behavior
5. **Test with real data**: More reliable than synthetic test data

---

## 📚 Reference

- **Feature Flags Documentation**: `backend/FEATURE_FLAGS.md`
- **Migration Plan**: `documentation/Key_docs/OPTIMIZED_QUERY_MIGRATION_PLAN.md`
- **Progress Tracker**: `documentation/Key_docs/MIGRATION_PROGRESS_TRACKER.md`

---

**Happy Testing!** 🧪✨

