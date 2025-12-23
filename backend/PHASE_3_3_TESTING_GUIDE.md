# Phase 3.3 Testing Guide: Source Attribution Service

**Status**: 🧪 READY FOR TESTING  
**Feature Flag**: `USE_OPTIMIZED_SOURCE_ATTRIBUTION`  
**Estimated Testing Time**: 15-30 minutes

---

## 🎯 What to Test

Phase 3.3 migrated the **Source Attribution Service** from `extracted_positions` to the optimized schema. This affects:

1. **Source Attribution Page** (main page)
2. **Impact Score Trends** (time-series charts)
3. **Previous Period Comparisons** (change metrics)

---

## 📋 Step-by-Step Testing

### Step 1: Enable Feature Flag

Add to `backend/.env`:

```bash
USE_OPTIMIZED_SOURCE_ATTRIBUTION=true
```

### Step 2: Restart Backend

```bash
# Stop server (Ctrl+C)
cd backend
npm run dev
```

### Step 3: Verify Feature Flag is Loaded

Check backend startup logs for:
```
✅ Loaded environment from: /Users/vikas/Documents/evidently/backend/.env
```

---

## 🧪 Test Cases

### Test 1: Source Attribution Main Page

**What to Test:**
- Navigate to **Source Attribution** page in UI
- Select a brand and date range (e.g., last 30 days)
- Verify page loads correctly

**What to Look For in Backend Logs:**

✅ **With Flag Enabled:**
```
⚡ [Source Attribution] Using optimized query (metric_facts + brand_metrics + brand_sentiment)
⚡ [Source Attribution] Optimized query completed in XXXms (YYY rows)
```

✅ **Expected Performance:**
- **Before**: ~3.7 seconds
- **After**: ~150ms
- **Speedup**: **25x faster**

**What to Verify:**
- ✅ Page loads without errors
- ✅ Sources list displays correctly
- ✅ Metrics (SOA, sentiment, mentions) are accurate
- ✅ Change percentages (soaChange, sentimentChange) are correct
- ✅ No console errors in browser
- ✅ No errors in backend logs

---

### Test 2: Impact Score Trends

**What to Test:**
- On Source Attribution page, interact with impact score trends
- Select different sources
- Change date range (7 days, 30 days)
- Switch between metrics (impactScore, mentionRate, soa, sentiment)

**What to Look For in Backend Logs:**

✅ **With Flag Enabled:**
```
⚡ [Source Attribution] Using optimized query (metric_facts + brand_metrics + brand_sentiment)
⚡ [Source Attribution] Optimized query completed in XXXms (YYY rows)
```

**What to Verify:**
- ✅ Charts render correctly
- ✅ Time-series data is accurate
- ✅ Date ranges work correctly
- ✅ Metric switching works
- ✅ Multiple source selection works

---

### Test 3: Previous Period Comparison

**What to Test:**
- View Source Attribution page
- Check "Change" columns (soaChange, sentimentChange, mentionChange)
- Verify these show correct previous period comparisons

**What to Look For in Backend Logs:**

✅ **With Flag Enabled:**
```
⚡ [Source Attribution] Using optimized query (metric_facts + brand_metrics + brand_sentiment)
⚡ [Source Attribution] Optimized query completed in XXXms (YYY rows)
```

**What to Verify:**
- ✅ Change percentages are accurate
- ✅ Positive/negative indicators are correct
- ✅ Previous period data matches expectations

---

### Test 4: Performance Comparison

**How to Compare:**

1. **Disable flag** (set to `false`):
   ```bash
   USE_OPTIMIZED_SOURCE_ATTRIBUTION=false
   ```
2. Restart backend
3. Load Source Attribution page
4. Note the response time in backend logs:
   ```
   [SourceAttribution] ⏱️ Total request duration: XXXXms
   ```

5. **Enable flag** (set to `true`):
   ```bash
   USE_OPTIMIZED_SOURCE_ATTRIBUTION=true
   ```
6. Restart backend
7. Load Source Attribution page again
8. Compare response times

**Expected Results:**
- Legacy: ~3,700ms
- Optimized: ~150ms
- **Improvement: 25x faster**

---

## 📊 What to Monitor

### Backend Logs

**Success Indicators:**
```
⚡ [Source Attribution] Using optimized query (metric_facts + brand_metrics + brand_sentiment)
⚡ [Source Attribution] Optimized query completed in 150ms (500 rows)
[SourceAttribution] ⏱️ Total request duration: 200ms
```

**Warning Signs:**
```
❌ [Source Attribution] Failed to fetch optimized positions: [error message]
📋 [Source Attribution] Using legacy query (extracted_positions)  # Flag not enabled
```

### Browser Console

**Check for:**
- ✅ No 500 errors
- ✅ No network errors
- ✅ Data loads correctly
- ✅ Charts render properly

### Data Accuracy

**Compare with Legacy:**
1. Load page with flag `false` → Note source list and metrics
2. Load page with flag `true` → Compare source list and metrics
3. **They should match exactly** (same sources, same metrics)

---

## 🔄 Rollback Procedure

If something goes wrong:

### Instant Rollback

1. **Set flag to `false`** in `backend/.env`:
   ```bash
   USE_OPTIMIZED_SOURCE_ATTRIBUTION=false
   ```

2. **Restart backend**

3. **Service uses legacy queries** (works as before)

### Verify Rollback

Check backend logs:
```
📋 [Source Attribution] Using legacy query (extracted_positions)
```

---

## ✅ Success Criteria

Phase 3.3 is successful if:

- ✅ Source Attribution page loads correctly
- ✅ All metrics are accurate (SOA, sentiment, mentions)
- ✅ Change percentages are correct
- ✅ Impact score trends work
- ✅ Performance improved by 20-30x
- ✅ No errors in logs or browser
- ✅ Data matches legacy queries exactly

---

## 🐛 Troubleshooting

### Issue: Page doesn't load

**Check:**
1. Feature flag is set correctly in `.env`
2. Backend restarted after flag change
3. Backend logs for errors
4. Browser console for errors

**Solution:**
- Disable flag and restart
- Check backend logs for specific error
- Verify database connection

---

### Issue: Data doesn't match

**Check:**
1. Compare source lists (should be identical)
2. Compare metrics (should match)
3. Check backend logs for query errors

**Solution:**
- Disable flag and compare
- Report discrepancy with specific examples
- Check if data exists in new schema

---

### Issue: Performance not improved

**Check:**
1. Feature flag is actually enabled
2. Backend logs show "⚡ Using optimized query"
3. Query duration in logs

**Solution:**
- Verify flag is `true` (not `"true"` or `True`)
- Check logs for actual query path used
- Compare with small dataset first

---

## 📝 Testing Checklist

- [ ] Feature flag added to `.env`
- [ ] Backend restarted
- [ ] Source Attribution page loads
- [ ] Sources list displays correctly
- [ ] Metrics are accurate
- [ ] Change percentages are correct
- [ ] Impact score trends work
- [ ] Performance improved (check logs)
- [ ] No errors in logs
- [ ] No errors in browser console
- [ ] Data matches legacy queries

---

## 🎉 Next Steps After Testing

If all tests pass:

1. ✅ **Document results** (performance gains, any issues)
2. ✅ **Plan production rollout** (gradual: 10% → 50% → 100%)
3. ✅ **Proceed to Phase 3.4** (Brand Topics Service)

If issues found:

1. ⚠️ **Disable flag** (instant rollback)
2. 📝 **Document the issue** (specific error, steps to reproduce)
3. 🔧 **Fix the issue**
4. 🧪 **Re-test**

---

## 📚 Reference

- **Migration Plan**: `backend/PHASE_3_3_SOURCE_ATTRIBUTION_PLAN.md`
- **Feature Flags**: `backend/FEATURE_FLAGS.md`
- **Query Helpers**: `backend/src/services/query-helpers/README.md`

---

**Ready to test!** 🚀

Start with Test 1 (Source Attribution Main Page) and work through each test case systematically.

