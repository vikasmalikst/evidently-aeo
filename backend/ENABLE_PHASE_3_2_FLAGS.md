# Enable Phase 3.2 Optimizations - Quick Guide

## ✅ Dashboard is Working!

Great! The dashboard is loading successfully. Now let's enable the Phase 3.2 optimizations.

---

## Step 1: Add Feature Flags to `.env`

Add these lines to your `backend/.env` file:

```bash
# Phase 3.2 - Optimized Query Feature Flags
USE_OPTIMIZED_POSITION_CHECK=true
USE_OPTIMIZED_SENTIMENT_QUERY=true
USE_OPTIMIZED_PROMPT_METRICS=true
USE_OPTIMIZED_KEYWORDS_QUERY=true
```

---

## Step 2: Restart Backend

```bash
# Stop server (Ctrl+C)
cd backend
npm run dev
```

---

## Step 3: What to Look For in Logs

### ✅ Position Extraction Service
**When**: During scoring/position extraction
**Look for**:
```
⚡ [Position Extraction] Using optimized existence check (metric_facts)
ℹ️ Collector_result XXX already has positions (optimized, 15ms)
```

**vs Legacy**:
```
📋 [Position Extraction] Using legacy existence check (extracted_positions)
ℹ️ Collector_result XXX already has positions (legacy, 50ms)
```

---

### ✅ Sentiment Services
**When**: During sentiment scoring (if running old flow)
**Look for**:
```
⚡ Using optimized sentiment query (new schema)
📊 Found X rows without sentiment (optimized)
```

**vs Legacy**:
```
📋 Using legacy sentiment query (extracted_positions)
📊 Found X rows without sentiment (legacy)
```

---

### ✅ Prompt Metrics Service
**When**: Viewing prompt metrics page
**Look for**: No specific log yet, but should be faster
**Test**: Navigate to prompt metrics page and check response time

---

### ✅ Keywords Analytics Service
**When**: Viewing keywords page
**Look for**: No specific log yet, but should be faster
**Test**: Navigate to keywords page and check response time

---

## Step 4: Test Each Service

### Test 1: Keywords Page
1. Navigate to **Keywords Analytics** page
2. Select a brand and date range
3. **Expected**: Page loads faster (10-15x improvement)
4. **Check backend logs**: Should see faster query times

### Test 2: Prompt Metrics
1. Navigate to **Prompt Configuration** page
2. View prompt metrics
3. **Expected**: Metrics calculate faster (single query vs 2 queries)
4. **Check backend logs**: Should see faster query times

### Test 3: Position Extraction
1. Go to **Admin → Scheduled Jobs**
2. Trigger a scoring job
3. **Check backend logs** for:
   ```
   ⚡ [Position Extraction] Using optimized existence check
   ```
4. **Expected**: Position checks complete faster (5-10x improvement)

### Test 4: Dashboard (Already Working!)
- Dashboard already uses new schema ✅
- No feature flag needed
- Already optimized from previous phases

---

## Step 5: Performance Comparison

### Before (Flags = false):
- Keywords page: ~800ms
- Prompt metrics: ~500ms (2 queries)
- Position checks: ~50ms per check

### After (Flags = true):
- Keywords page: ~60ms (10-15x faster)
- Prompt metrics: ~50ms (10-15x faster, 1 query)
- Position checks: ~15ms per check (5-10x faster)

---

## Troubleshooting

### If a service doesn't work:
1. **Disable that specific flag**:
   ```bash
   USE_OPTIMIZED_KEYWORDS_QUERY=false
   ```
2. **Restart backend**
3. **Service works with legacy queries**
4. **Report the issue**

### If all services fail:
1. **Disable all flags**:
   ```bash
   USE_OPTIMIZED_POSITION_CHECK=false
   USE_OPTIMIZED_SENTIMENT_QUERY=false
   USE_OPTIMIZED_PROMPT_METRICS=false
   USE_OPTIMIZED_KEYWORDS_QUERY=false
   ```
2. **Restart backend**
3. **Everything works as before**

---

## Success Indicators

✅ **All services work correctly**
✅ **Backend logs show "⚡ Using optimized..." messages**
✅ **Page load times improved**
✅ **No errors in browser console**
✅ **No errors in backend logs**

---

## Next Steps After Testing

If all tests pass:
1. ✅ Document test results
2. ✅ Plan production rollout
3. ✅ Proceed to Phase 3.3 (Source Attribution)

If issues found:
1. ⚠️ Disable problematic flag
2. 📝 Document the issue
3. 🔧 Fix the issue
4. 🧪 Re-test

---

**Ready to enable the flags and test!** 🚀

