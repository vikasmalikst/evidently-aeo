# Domain Readiness Integration - Implementation Guide

## Quick Integration Steps

### Step 1: Import the Filter Service

**File:** `backend/src/services/recommendations/recommendation-v3.service.ts`

Add these imports at the top:

```typescript
import { domainReadinessService } from '../domain-readiness/domain-readiness.service';
import { 
  shouldFilterRecommendation, 
  getReadinessContext,
  enhanceRecommendationWithReadiness 
} from './domain-readiness-filter.service';
```

### Step 2: Fetch Domain Readiness Audit

**Location:** In `generateRecommendations()` method, after gathering brand context

**Add after line ~2094 (after `gatherBrandContext`):**

```typescript
// Step 1.5: Fetch latest Domain Readiness audit
console.log('📊 [RecommendationV3Service] Fetching Domain Readiness audit...');
const latestAudit = await domainReadinessService.getLatestAudit(brandId);
if (latestAudit) {
  console.log(`✅ [RecommendationV3Service] Found Domain Readiness audit (score: ${latestAudit.overallScore}/100, date: ${latestAudit.timestamp})`);
} else {
  console.log('⚠️ [RecommendationV3Service] No Domain Readiness audit found - recommendations will not be filtered');
}
```

### Step 3: Filter Recommendations After Generation

**Location:** In `generateRecommendations()` method, after `postProcessRecommendations()` call

**Add after line ~2136 (after post-processing):**

```typescript
// Step 2.5: Filter recommendations based on Domain Readiness
if (latestAudit) {
  const beforeFilter = recommendations.length;
  recommendations = recommendations.filter(rec => 
    !shouldFilterRecommendation(rec, latestAudit)
  );
  const filteredCount = beforeFilter - recommendations.length;
  if (filteredCount > 0) {
    console.log(`🚫 [RecommendationV3Service] Filtered ${filteredCount} recommendation(s) based on Domain Readiness audit`);
  }
  
  // Enhance priority for recommendations addressing readiness gaps
  recommendations = recommendations.map(rec => 
    enhanceRecommendationWithReadiness(rec, latestAudit)
  );
}
```

### Step 4: Add Readiness Context to Prompts (Optional Enhancement)

**Location:** In `generateRecommendationsForKPIs()` method, when building the prompt

**Add Domain Readiness context to the prompt:**

```typescript
// In generateRecommendationsForKPIs(), around line ~1669
const readinessContext = latestAudit ? getReadinessContext(latestAudit) : '';

const prompt = `You are a Brand/AEO expert. Generate 2-3 actionable recommendations for EACH identified KPI below.

${readinessContext}

IMPORTANT RULES:
- Do NOT recommend optimizing technical elements (sitemap, robots.txt, LLMs.txt, canonical URLs) if Domain Readiness shows these are already optimized (score >= 80).
- Prioritize recommendations that address Domain Readiness gaps (failed tests).
- For brands with low technical crawlability scores (< 60), prioritize technical fixes FIRST before content recommendations.
- Focus on content and strategy recommendations if technical foundation is solid (overall score >= 75).

[... rest of existing prompt ...]
`;
```

### Step 5: Store Audit Reference (Optional)

**Location:** In `saveToDatabase()` method, when creating generation record

**Add audit reference to metadata:**

```typescript
// In saveToDatabase(), around line ~2205
metadata: {
  version: 'v3',
  brandName: context.brandName,
  industry: context.industry,
  dataMaturity: context._dataMaturity,
  domainReadinessAuditId: latestAudit?.id || null,  // Add this
  domainReadinessScore: latestAudit?.overallScore || null  // Add this
}
```

---

## Complete Code Example

Here's the complete integration in the `generateRecommendations()` method:

```typescript
async generateRecommendations(
  brandId: string,
  customerId: string
): Promise<RecommendationV3Response> {
  console.log(`📊 [RecommendationV3Service] Generating recommendations for brand: ${brandId}`);

  // ... existing code ...

  try {
    // Step 1: Gather brand context
    console.log('📊 [RecommendationV3Service] Step 1: Gathering brand context...');
    const contextStartTime = Date.now();
    const context = await this.gatherBrandContext(brandId, customerId);
    console.log(`✅ [RecommendationV3Service] Context gathered in ${Date.now() - contextStartTime}ms`);
    
    if (!context) {
      return {
        success: false,
        kpis: [],
        recommendations: [],
        message: 'Failed to gather brand context.'
      };
    }

    // Step 1.5: Fetch latest Domain Readiness audit
    console.log('📊 [RecommendationV3Service] Fetching Domain Readiness audit...');
    const latestAudit = await domainReadinessService.getLatestAudit(brandId);
    if (latestAudit) {
      console.log(`✅ [RecommendationV3Service] Found Domain Readiness audit (score: ${latestAudit.overallScore}/100, date: ${latestAudit.timestamp})`);
    } else {
      console.log('⚠️ [RecommendationV3Service] No Domain Readiness audit found - recommendations will not be filtered');
    }

    const flags = this.getFeatureFlags();
    context._dataMaturity = this.computeDataMaturity(context);
    console.log(`🧪 [RecommendationV3Service] Data maturity: ${context._dataMaturity}`);

    // Step 2: Generate recommendations (cold-start templates OR LLM)
    let recommendations: RecommendationV3[] = [];
    if (flags.coldStartMode && context._dataMaturity === 'cold_start') {
      // ... existing cold-start code ...
    } else {
      console.log('📝 [RecommendationV3Service] Step 2: Generating recommendations with LLM...');
      const llmStartTime = Date.now();
      recommendations = await this.generateRecommendationsDirect(context);
      console.log(`✅ [RecommendationV3Service] LLM generation completed in ${Date.now() - llmStartTime}ms, produced ${recommendations.length} recommendation(s)`);
    }

    // Unified post-processing (competitor safety, quality contract, deterministic ranking)
    console.log(`📊 [RecommendationV3Service] Before post-processing: ${recommendations.length} recommendation(s)`);
    recommendations = this.postProcessRecommendations(context, recommendations);
    console.log(`📊 [RecommendationV3Service] After post-processing: ${recommendations.length} recommendation(s)`);

    // Step 2.5: Filter recommendations based on Domain Readiness
    if (latestAudit) {
      const beforeFilter = recommendations.length;
      recommendations = recommendations.filter(rec => 
        !shouldFilterRecommendation(rec, latestAudit)
      );
      const filteredCount = beforeFilter - recommendations.length;
      if (filteredCount > 0) {
        console.log(`🚫 [RecommendationV3Service] Filtered ${filteredCount} recommendation(s) based on Domain Readiness audit`);
      }
      
      // Enhance priority for recommendations addressing readiness gaps
      recommendations = recommendations.map(rec => 
        enhanceRecommendationWithReadiness(rec, latestAudit)
      );
    }

    if (recommendations.length === 0) {
      // ... existing error handling ...
    }

    // Step 3: Save to database
    const generationId = await this.saveToDatabase(brandId, customerId, [], recommendations, context, latestAudit);

    // ... rest of method ...
  } catch (error) {
    // ... error handling ...
  }
}
```

**Note:** You'll also need to update the `saveToDatabase()` signature to accept `latestAudit`:

```typescript
private async saveToDatabase(
  brandId: string,
  customerId: string,
  kpis: IdentifiedKPI[],
  recommendations: RecommendationV3[],
  context: BrandContextV3,
  latestAudit: AeoAuditResult | null = null  // Add this parameter
): Promise<string | null> {
  // ... existing code ...
  // Use latestAudit?.id in metadata if needed
}
```

---

## Testing Checklist

- [ ] Test with brand that has high readiness score (85+) - should filter technical recommendations
- [ ] Test with brand that has low readiness score (< 60) - should keep technical recommendations
- [ ] Test with brand that has no audit - should not filter anything
- [ ] Test with stale audit (> 90 days) - should ignore or warn
- [ ] Verify filtered recommendations are actually redundant
- [ ] Verify priority boosts work correctly
- [ ] Performance test - ensure < 200ms added latency

---

## Expected Behavior Examples

### Example 1: High Readiness (85/100)
- **Audit shows:** XML Sitemap: Pass (95/100), Robots.txt: Pass (90/100)
- **Recommendation:** "Audit and optimize XML sitemap, robots.txt, and crawlability"
- **Result:** ❌ **FILTERED OUT** (already optimized)

### Example 2: Low Readiness (45/100)
- **Audit shows:** XML Sitemap: Fail (30/100), FAQ Content: Fail (40/100)
- **Recommendation:** "Fix XML Sitemap: Missing or incomplete sitemap.xml"
- **Result:** ✅ **KEPT** + Priority boosted to High

### Example 3: No Audit
- **Audit:** None
- **Recommendation:** "Audit and optimize XML sitemap"
- **Result:** ✅ **KEPT** (no filtering without audit data)

---

## Rollback Plan

If issues arise, you can quickly disable filtering by:

1. Comment out the filtering code block
2. Or add a feature flag:

```typescript
const USE_DOMAIN_READINESS_FILTER = process.env.USE_DOMAIN_READINESS_FILTER !== 'false';

if (USE_DOMAIN_READINESS_FILTER && latestAudit) {
  // ... filtering code ...
}
```

---

## Next Steps

1. ✅ Review this guide
2. ✅ Implement Step 1-3 (core filtering)
3. ✅ Test with real data
4. ✅ Implement Step 4-5 (enhancements)
5. ✅ Deploy to staging
6. ✅ Monitor and validate
