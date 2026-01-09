# Domain Readiness ↔ Recommendations Engine Integration Plan

## Overview

This plan outlines how to connect the **Domain Readiness** audit system with the **Recommendations Engine** to create a unified, intelligent optimization workflow.

## Goals

1. **Prioritize recommendations** based on domain readiness gaps
2. **Generate context-aware recommendations** from readiness audit results
3. **Ensure technical foundation** before content recommendations
4. **Track improvement** by correlating recommendations with readiness score changes
5. **Create a unified optimization workflow** that guides users from audit → action → measurement

---

## Phase 1: Data Integration & Context Enrichment

### 1.1. Store Readiness Data in Recommendation Context

**Objective**: Make readiness audit results available to the recommendation engine.

**Implementation**:
- Modify `BrandContextV3` interface to include optional readiness data:
  ```typescript
  interface BrandContextV3 {
    // ... existing fields
    _domainReadiness?: {
      overallScore: number;
      scoreBreakdown: {
        technicalCrawlability: number;
        contentQuality: number;
        semanticStructure: number;
        accessibilityAndBrand: number;
      };
      criticalIssues: Array<{
        severity: 'critical' | 'high' | 'medium' | 'low';
        title: string;
        recommendation: string;
      }>;
      failedTests: Array<{
        name: string;
        category: string;
        message: string;
      }>;
      lastAuditDate: string;
    };
  }
  ```

- In `gatherBrandContext()`:
  - Query latest `domain_readiness_audits` for the brand
  - Attach readiness data to context if available
  - Log readiness score in context gathering

**Files to Modify**:
- `backend/src/services/recommendations/recommendation-v3.service.ts`
  - Update `BrandContextV3` interface
  - Modify `gatherBrandContext()` method

**Database Query**:
```sql
SELECT * FROM domain_readiness_audits 
WHERE brand_id = $1 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## Phase 2: Readiness-Based Recommendation Prioritization

### 2.1. Technical Foundation First Rule

**Objective**: For brands with low technical crawlability scores, prioritize technical recommendations.

**Implementation**:
- Create `prioritizeByReadiness()` function in `recommendation-ranking.service.ts`:
  ```typescript
  function prioritizeByReadiness(
    recommendations: RecommendationV3[],
    readiness: DomainReadinessData
  ): RecommendationV3[] {
    // If technical score < 50, boost technical recommendations
    if (readiness.scoreBreakdown.technicalCrawlability < 50) {
      return recommendations.map(rec => {
        if (isTechnicalRecommendation(rec)) {
          return { ...rec, priority: 'High' as const };
        }
        return rec;
      });
    }
    return recommendations;
  }
  ```

- Integrate into `postProcessRecommendations()`:
  - Call `prioritizeByReadiness()` after ranking
  - Only if readiness data exists

**Files to Modify**:
- `backend/src/services/recommendations/recommendation-ranking.service.ts`
- `backend/src/services/recommendations/recommendation-v3.service.ts`

---

## Phase 3: Readiness-Gap-Driven Recommendations

### 3.1. Generate Recommendations from Failed Tests

**Objective**: Create specific recommendations based on readiness audit failures.

**Implementation**:
- Create `generateReadinessRecommendations()` function:
  ```typescript
  function generateReadinessRecommendations(
    readiness: DomainReadinessData,
    context: BrandContextV3
  ): RecommendationV3[] {
    const recommendations: RecommendationV3[] = [];
    
    // Map failed tests to recommendations
    readiness.failedTests.forEach(test => {
      const rec = mapTestToRecommendation(test, context);
      if (rec) recommendations.push(rec);
    });
    
    return recommendations;
  }
  ```

- Mapping logic:
  - `"LLMs.txt Missing"` → `"Create /llms.txt file with brand information"`
  - `"Robots.txt Blocks LLM Bots"` → `"Update robots.txt to allow GPTBot, Claude, PerplexityBot"`
  - `"Missing FAQ Schema"` → `"Add FAQPage schema markup to FAQ pages"`
  - `"Low Readability Score"` → `"Simplify content language to improve readability"`
  - `"Missing Canonical URLs"` → `"Add canonical link tags to all pages"`
  - etc.

- Merge with existing recommendations:
  - Add readiness recommendations to the main recommendation list
  - Mark them with `source: 'readiness_audit'`
  - Deduplicate if similar recommendations already exist

**Files to Create**:
- `backend/src/services/recommendations/readiness-recommendations.service.ts`

**Files to Modify**:
- `backend/src/services/recommendations/recommendation-v3.service.ts`
  - Call `generateReadinessRecommendations()` in `generateRecommendations()`
  - Merge with LLM-generated recommendations

---

## Phase 4: Cold-Start + Readiness Integration

### 4.1. Enhanced Cold-Start Logic

**Objective**: For cold_start brands, check readiness first and adjust templates accordingly.

**Implementation**:
- Modify `computeDataMaturity()` to consider readiness:
  ```typescript
  private computeDataMaturity(context: BrandContextV3): BrandContextV3['_dataMaturity'] {
    // Existing logic...
    
    // If readiness data exists and technical score is very low
    if (context._domainReadiness?.scoreBreakdown.technicalCrawlability < 30) {
      // Force cold_start even if other metrics suggest otherwise
      return 'cold_start';
    }
    
    // ... rest of logic
  }
  ```

- Modify cold-start templates:
  - If readiness shows missing LLMs.txt → add "Create LLMs.txt" template
  - If robots.txt blocks bots → add "Fix robots.txt" template
  - If no sitemap → add "Create sitemap.xml" template

**Files to Modify**:
- `backend/src/services/recommendations/recommendation-v3.service.ts`
- `backend/src/services/recommendations/cold-start-templates.ts`

---

## Phase 5: Recommendation Quality Enhancement

### 5.1. Readiness-Aware Quality Contract

**Objective**: Use readiness data to validate recommendation quality.

**Implementation**:
- Enhance `filterLowQualityRecommendationsV3()`:
  - If readiness shows technical issues, don't filter out technical recommendations
  - If content quality is low, prioritize content recommendations
  - If semantic structure is poor, boost semantic recommendations

**Files to Modify**:
- `backend/src/services/recommendations/recommendation-quality.service.ts`

---

## Phase 6: Success Tracking & Feedback Loop

### 6.1. Track Recommendation Impact on Readiness

**Objective**: Measure if implementing recommendations improves readiness scores.

**Implementation**:
- Create `recommendation_readiness_impact` table:
  ```sql
  CREATE TABLE recommendation_readiness_impact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID REFERENCES recommendations(id),
    readiness_audit_id UUID REFERENCES domain_readiness_audits(id),
    before_score INTEGER,
    after_score INTEGER,
    score_delta INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

- When recommendations are marked as completed:
  - Check if readiness audit exists
  - Compare scores before/after
  - Store impact data

- Display in UI:
  - Show "This recommendation improved your readiness score by +X points"
  - Highlight high-impact recommendations

**Files to Create**:
- `backend/src/services/recommendations/recommendation-impact.service.ts`
- Migration: `supabase/migrations/XXXXX_create_recommendation_readiness_impact.sql`

**Files to Modify**:
- `backend/src/routes/recommendations-v3.routes.ts` (when marking complete)
- `src/pages/RecommendationsV3.tsx` (display impact)

---

## Phase 7: UI Integration

### 7.1. Readiness Score in Recommendations Page

**Objective**: Show readiness score and link to readiness page.

**Implementation**:
- Add readiness score badge to RecommendationsV3 page header
- Link to Domain Readiness page
- Show readiness-based recommendations with special badge

**Files to Modify**:
- `src/pages/RecommendationsV3.tsx`

### 7.2. Recommendations in Readiness Page

**Objective**: Show relevant recommendations directly in readiness audit results.

**Implementation**:
- In Domain Readiness page, add "Recommended Actions" section
- Fetch recommendations filtered by readiness gaps
- Show top 3-5 recommendations per category

**Files to Modify**:
- `src/pages/DomainReadiness/DomainReadinessPage.tsx`
- Create: `src/pages/DomainReadiness/components/RecommendedActions.tsx`

---

## Phase 8: Prompt Engineering Enhancement

### 8.1. Readiness Context in LLM Prompts

**Objective**: Include readiness data in recommendation generation prompts.

**Implementation**:
- Modify `generateRecommendationsDirect()` prompt:
  ```typescript
  const readinessContext = context._domainReadiness 
    ? `
Domain Readiness Analysis:
- Overall Score: ${context._domainReadiness.overallScore}/100
- Technical Crawlability: ${context._domainReadiness.scoreBreakdown.technicalCrawlability}/100
- Content Quality: ${context._domainReadiness.scoreBreakdown.contentQuality}/100
- Semantic Structure: ${context._domainReadiness.scoreBreakdown.semanticStructure}/100
- Accessibility & Brand: ${context._domainReadiness.scoreBreakdown.accessibilityAndBrand}/100

Critical Issues:
${context._domainReadiness.criticalIssues.map(issue => `- ${issue.title}: ${issue.recommendation}`).join('\n')}

When generating recommendations, prioritize addressing these readiness gaps.
    `
    : '';
  ```

**Files to Modify**:
- `backend/src/services/recommendations/recommendation-v3.service.ts`

---

## Implementation Priority

### **P1: High Priority (Week 1-2)**
1. ✅ Phase 1: Data Integration (store readiness in context)
2. ✅ Phase 2: Prioritization (technical foundation first)
3. ✅ Phase 3: Gap-driven recommendations (map tests to recs)

### **P2: Medium Priority (Week 3-4)**
4. ✅ Phase 4: Cold-start integration
5. ✅ Phase 7.1: UI integration (readiness score in recommendations page)

### **P3: Nice to Have (Week 5+)**
6. ✅ Phase 5: Quality enhancement
7. ✅ Phase 6: Success tracking
8. ✅ Phase 7.2: Recommendations in readiness page
9. ✅ Phase 8: Prompt engineering

---

## Success Metrics

1. **Recommendation Relevance**: % of recommendations that address readiness gaps
2. **Readiness Improvement**: Average readiness score increase after implementing recommendations
3. **User Engagement**: % of users who run readiness audit after seeing recommendations
4. **Completion Rate**: % of readiness-based recommendations that get completed

---

## Technical Considerations

### Performance
- Readiness data should be cached (don't query on every recommendation generation)
- Only fetch latest audit (not full history)
- Consider async readiness fetching if audit is in progress

### Data Freshness
- If readiness audit is > 30 days old, show warning
- Optionally trigger new audit if data is stale

### Error Handling
- If readiness service is unavailable, recommendations should still work
- Gracefully degrade if readiness data is missing

---

## Open Questions

1. Should we auto-trigger readiness audit when generating recommendations?
2. Should readiness recommendations be separate category or merged?
3. How to handle conflicting recommendations (readiness vs. citation-based)?
4. Should we show readiness score in recommendation cards?

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (data integration)
3. Test with real brands
4. Iterate based on feedback

