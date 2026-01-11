# Domain Readiness Integration - Verification Checklist

## ✅ Quick Verification Steps

### Step 1: Check Code is Integrated (5 minutes)

- [ ] **File exists:** `backend/src/services/recommendations/domain-readiness-filter.service.ts`
- [ ] **Imports added:** Check `recommendation-v3.service.ts` has:
  ```typescript
  import { domainReadinessService } from '../domain-readiness/domain-readiness.service';
  import { shouldFilterRecommendation, enhanceRecommendationWithReadiness } from './domain-readiness-filter.service';
  ```
- [ ] **No linting errors:** Run `npm run lint` in backend directory

### Step 2: Test with Logs (10 minutes)

1. **Start backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Watch logs in real-time:**
   ```bash
   # In another terminal
   tail -f backend/logs/app.log | grep -E "(DomainReadiness|Filtering|Priority boost)"
   ```

3. **Generate recommendations** (via UI or API)

4. **Look for these log messages:**

   ✅ **Success indicators:**
   - `✅ Found Domain Readiness audit (score: X/100)`
   - `🚫 Filtering: "..." - [Test Name] already optimized`
   - `⬆️ Priority boost (+X) for recommendation`

   ⚠️ **Expected (no audit):**
   - `⚠️ No Domain Readiness audit found - recommendations will not be filtered`

### Step 3: Test Scenarios (30 minutes)

#### Scenario A: Brand WITH High Readiness Score

**Setup:**
1. Go to Domain Readiness page
2. Run audit for a brand
3. Ensure some tests show "Pass" (score ≥ 80)
   - Example: XML Sitemap: 95/100 ✅

**Test:**
1. Generate recommendations for that brand
2. **Expected:** Recommendations mentioning "sitemap" should be **filtered out**
3. **Verify:** Check logs for `🚫 Filtering: "optimize XML sitemap..."`

**✅ Pass if:** Technical recommendations are filtered

---

#### Scenario B: Brand WITH Low Readiness Score

**Setup:**
1. Go to Domain Readiness page
2. Run audit for a brand
3. Ensure some tests show "Fail" (score < 60)
   - Example: Robots.txt: 30/100 ❌

**Test:**
1. Generate recommendations for that brand
2. **Expected:** Recommendations mentioning "robots.txt" should be **kept**
3. **Expected:** Priority should be **High** (boosted)
4. **Verify:** Check logs for `⬆️ Priority boost (+15)`

**✅ Pass if:** Technical recommendations appear with high priority

---

#### Scenario C: Brand WITHOUT Audit

**Setup:**
1. Use a brand that has **never** run Domain Readiness audit

**Test:**
1. Generate recommendations for that brand
2. **Expected:** All recommendations should appear (no filtering)
3. **Verify:** Check logs for `⚠️ No Domain Readiness audit found`

**✅ Pass if:** All recommendations appear normally

---

#### Scenario D: Stale Audit (> 90 days)

**Setup:**
1. Find or create a brand with audit older than 90 days
   - Or manually update audit date in database:
   ```sql
   UPDATE domain_readiness_audits 
   SET created_at = NOW() - INTERVAL '95 days'
   WHERE brand_id = 'YOUR_BRAND_ID';
   ```

**Test:**
1. Generate recommendations for that brand
2. **Expected:** Audit should be ignored (no filtering)
3. **Verify:** Check logs for `⚠️ Domain Readiness audit is stale (95 days old)`

**✅ Pass if:** No filtering occurs (audit ignored)

---

### Step 4: Database Verification (5 minutes)

**Check if filtering is working:**

```sql
-- 1. Check if audits exist
SELECT 
  brand_id,
  overall_score,
  created_at,
  DATE_PART('day', NOW() - created_at) as days_old
FROM domain_readiness_audits
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check recent recommendation generations
SELECT 
  id,
  brand_id,
  recommendations_count,
  created_at
FROM recommendation_generations
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check recommendations (should not have filtered ones)
SELECT 
  action,
  citation_source,
  priority,
  created_at
FROM recommendations
WHERE generation_id IN (
  SELECT id FROM recommendation_generations ORDER BY created_at DESC LIMIT 1
)
ORDER BY created_at DESC;
```

**✅ Pass if:** 
- Audits exist for brands that should have them
- Recommendations don't include filtered ones
- Priority is High for readiness gap recommendations

---

### Step 5: API Testing (10 minutes)

**Test via API:**

```bash
# 1. Get auth token (if needed)
# 2. Generate recommendations
curl -X POST http://localhost:3000/api/recommendations-v3/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brandId": "YOUR_BRAND_ID"}' \
  | jq '.data.recommendations | length'

# 3. Check response
# - Should return recommendations array
# - Count should match what's in logs (after filtering)
```

**✅ Pass if:** API returns recommendations and count matches logs

---

## 🎯 Success Criteria

### ✅ Implementation Verified If:

1. **Code Integration:**
   - ✅ Filter service file exists
   - ✅ Imports are correct
   - ✅ No linting errors

2. **Logging:**
   - ✅ Audit fetch messages appear
   - ✅ Filtering messages appear (when applicable)
   - ✅ Priority boost messages appear (when applicable)

3. **Functionality:**
   - ✅ High readiness brands: Technical recommendations filtered
   - ✅ Low readiness brands: Technical recommendations kept + priority boosted
   - ✅ No audit: All recommendations appear
   - ✅ Stale audit: Ignored (no filtering)

4. **Database:**
   - ✅ Recommendations saved correctly
   - ✅ No filtered recommendations in database
   - ✅ Priority values are correct

---

## 🐛 Common Issues & Solutions

### Issue: "No filtering happening"

**Possible causes:**
1. No audit exists → Run Domain Readiness audit first
2. Audit is stale → Check audit date (must be < 90 days)
3. Recommendations are for external sources → Only "owned-site" is filtered

**Solution:**
```bash
# Check if audit exists
SELECT * FROM domain_readiness_audits WHERE brand_id = 'YOUR_BRAND_ID';

# Check audit age
SELECT DATE_PART('day', NOW() - created_at) as days_old 
FROM domain_readiness_audits 
WHERE brand_id = 'YOUR_BRAND_ID';
```

---

### Issue: "Too many recommendations filtered"

**Possible causes:**
1. Test scores are too high (should be ≥ 80 to filter)
2. Keyword matching too aggressive

**Solution:**
- Check Domain Readiness audit scores
- Review logs to see which recommendations were filtered
- Verify test scores are correct

---

### Issue: "Priority not boosting"

**Possible causes:**
1. No failed tests in audit (need score < 60)
2. Keywords don't match failed tests

**Solution:**
- Check audit for failed tests
- Verify recommendation action text contains keywords
- Check logs for priority boost messages

---

## 📊 Expected Log Output Examples

### ✅ Successful Integration (High Readiness)

```
📊 [RecommendationV3Service] Fetching Domain Readiness audit...
✅ [RecommendationV3Service] Found Domain Readiness audit (score: 85/100, date: 2025-01-15, 5 days old)
📝 [RecommendationV3Service] Step 2: Generating recommendations with LLM...
✅ [RecommendationV3Service] LLM generation completed in 2341ms, produced 8 recommendation(s)
📊 [RecommendationV3Service] After post-processing: 8 recommendation(s)
🚫 [DomainReadinessFilter] Filtering: "Audit and optimize XML sitemap, robots.txt..." - XML Sitemap already optimized (score: 95, status: pass)
🚫 [DomainReadinessFilter] Filtering: "Optimize robots.txt configuration..." - Robots.txt already optimized (score: 90, status: pass)
🚫 [RecommendationV3Service] Filtered 2 recommendation(s) based on Domain Readiness audit
✅ [RecommendationV3Service] Returning 6 recommendations with IDs
```

### ✅ Successful Integration (Low Readiness)

```
📊 [RecommendationV3Service] Fetching Domain Readiness audit...
✅ [RecommendationV3Service] Found Domain Readiness audit (score: 45/100, date: 2025-01-15, 2 days old)
📝 [RecommendationV3Service] Step 2: Generating recommendations with LLM...
✅ [RecommendationV3Service] LLM generation completed in 2156ms, produced 7 recommendation(s)
📊 [RecommendationV3Service] After post-processing: 7 recommendation(s)
⬆️ [DomainReadinessFilter] Priority boost (+15) for recommendation: "Fix XML Sitemap: Missing or incomplete..." - addresses: XML Sitemap
⬆️ [DomainReadinessFilter] Priority boost (+15) for recommendation: "Fix Robots.txt: Blocking AI bots..." - addresses: Robots.txt
✅ [RecommendationV3Service] Returning 7 recommendations with IDs
```

### ⚠️ No Audit (Expected Behavior)

```
📊 [RecommendationV3Service] Fetching Domain Readiness audit...
⚠️ [RecommendationV3Service] No Domain Readiness audit found - recommendations will not be filtered
📝 [RecommendationV3Service] Step 2: Generating recommendations with LLM...
✅ [RecommendationV3Service] LLM generation completed in 1987ms, produced 6 recommendation(s)
📊 [RecommendationV3Service] After post-processing: 6 recommendation(s)
✅ [RecommendationV3Service] Returning 6 recommendations with IDs
```

---

## ✅ Final Checklist

- [ ] Code integrated (imports, no errors)
- [ ] Logs show audit fetching
- [ ] High readiness: Filtering works
- [ ] Low readiness: Priority boosting works
- [ ] No audit: No filtering (all recommendations appear)
- [ ] Stale audit: Ignored correctly
- [ ] Database: Recommendations saved correctly
- [ ] API: Returns correct recommendations

---

**Status:** Ready to verify! Follow the steps above to confirm implementation is working.
