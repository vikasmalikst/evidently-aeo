# Scoring Service Usage Analysis

## Current Status

### ✅ Both "Collect & Score" and Cron Jobs Use:
**`brandScoringService` from `brand-scoring.orchestrator.ts`**

### ⚠️ Which Service is Actually Used?

The orchestrator uses a **feature flag** to determine which approach to use:

```typescript
const USE_CONSOLIDATED_ANALYSIS = process.env.USE_CONSOLIDATED_ANALYSIS === 'true';
```

**If `USE_CONSOLIDATED_ANALYSIS=true`:**
- ✅ Uses **Consolidated Scoring Service** (new, optimized)
- Single API call for all operations
- More efficient and faster

**If `USE_CONSOLIDATED_ANALYSIS` is not set or `false` (default):**
- ⚠️ Uses **Legacy Approach** (old method)
- Multiple separate API calls
- Less efficient but more stable/tested

---

## Current Configuration

### Files Using `brandScoringService`:

1. **Admin Route - "Collect & Score"** (`admin.routes.ts` line 1026):
   ```typescript
   const { brandScoringService } = await import('../services/scoring/brand-scoring.orchestrator');
   const scoringResult = await brandScoringService.scoreBrand({...});
   ```

2. **Admin Route - "Score Now"** (`admin.routes.ts` line 864):
   ```typescript
   const { brandScoringService } = await import('../services/scoring/brand-scoring.orchestrator');
   const result = await brandScoringService.scoreBrand({...});
   ```

3. **Cron Job Worker** (`unified-job-worker.ts` line 240):
   ```typescript
   import { brandScoringService } from '../services/scoring/brand-scoring.orchestrator';
   const scoringResult = await brandScoringService.scoreBrand({...});
   ```

### What the Orchestrator Does:

```typescript
async scoreBrand(options: BrandScoringOptions): Promise<BrandScoringResult> {
  // Use consolidated scoring if enabled
  if (USE_CONSOLIDATED_ANALYSIS) {
    return await this.scoreBrandWithConsolidatedAnalysis(options);
  }

  // Fallback to original approach
  return await this.scoreBrandLegacy(options);
}
```

---

## Legacy Approach (Current Default)

When `USE_CONSOLIDATED_ANALYSIS` is not set, it uses:

1. **Position Extraction Service** - Separate API call
2. **Combined Sentiment Service** - Separate API call (brand + competitors)
3. **Citation Extraction Service** - Separate API call

**Total: 3 separate API calls per scoring operation**

---

## Consolidated Approach (When Enabled)

When `USE_CONSOLIDATED_ANALYSIS=true`, it uses:

1. **Consolidated Scoring Service** - Single API call that does:
   - Position extraction
   - Sentiment scoring (brand + competitors)
   - Citation extraction
   - All in one optimized LLM call

**Total: 1 API call per scoring operation**

**Benefits:**
- ⚡ Faster execution (fewer API calls)
- 💰 Lower API costs (fewer tokens used)
- 🎯 More consistent results (single context)
- 📊 Better performance at scale

---

## How to Enable Consolidated Scoring

### Step 1: Add Environment Variable

Add to your `.env` file on the VPS:

```env
USE_CONSOLIDATED_ANALYSIS=true
```

### Step 2: Restart Services

```bash
# If using PM2
pm2 restart all

# If using systemd
sudo systemctl restart job-worker
sudo systemctl restart your-backend-service
```

### Step 3: Verify

Check logs to see which approach is being used:

**Consolidated (when enabled):**
```
🚀 Using consolidated analysis for brand scoring...
🎯 Starting consolidated scoring for brand...
```

**Legacy (default):**
```
[No specific message - uses separate services]
```

---

## Recommendation

### ✅ Enable Consolidated Scoring for Production

**Why:**
1. **Better Performance**: Single API call vs multiple calls
2. **Lower Costs**: More efficient token usage
3. **Faster Execution**: Reduced latency
4. **Better Scalability**: Handles high volume better

**How to Enable:**
1. Add `USE_CONSOLIDATED_ANALYSIS=true` to your `.env` file
2. Restart your services
3. Monitor logs to verify it's working
4. Check job execution times (should be faster)

**Testing Before Production:**
1. Enable on a test/staging environment first
2. Run a few test jobs
3. Verify results are correct
4. Compare execution times
5. Then enable on production

---

## Summary

| Aspect | Current (Default) | With Consolidated Enabled |
|--------|------------------|---------------------------|
| **Service Used** | Legacy (separate services) | Consolidated Scoring Service |
| **API Calls** | 3 separate calls | 1 consolidated call |
| **Performance** | Good | ⚡ Better |
| **Cost** | Higher | 💰 Lower |
| **Status** | ⚠️ Default (not optimized) | ✅ Recommended for production |

**Action Required:**
- Add `USE_CONSOLIDATED_ANALYSIS=true` to enable optimized scoring
- Both "Collect & Score" and cron jobs will automatically use it once enabled

---

**Last Updated**: January 2025
