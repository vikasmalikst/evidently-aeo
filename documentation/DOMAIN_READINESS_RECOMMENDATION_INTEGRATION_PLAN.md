# Domain Readiness & Recommendation Engine Integration Plan

**Author:** Senior Marketing Consultant  
**Date:** 2025-01-XX  
**Status:** Planning Phase

---

## 🎯 Executive Summary

This plan outlines the integration between **Domain Readiness** (technical audit tool) and the **Recommendation Engine** to eliminate redundant recommendations and prioritize actions based on actual technical gaps.

### Problem Statement

Currently, the recommendation engine may suggest optimizing technical elements (XML sitemap, robots.txt, crawlability) even when Domain Readiness audits show these are already optimized. This creates:
- **Redundant recommendations** that waste user time
- **Misaligned priorities** (suggesting fixes for things that are already fixed)
- **Poor user experience** (confusion about what actually needs work)

### Solution Overview

Integrate Domain Readiness audit results into the recommendation generation pipeline to:
1. **Filter out recommendations** for issues already resolved (per Domain Readiness)
2. **Prioritize recommendations** based on Domain Readiness gaps
3. **Enhance recommendation context** with technical readiness data
4. **Create technical-first recommendations** for brands with low readiness scores

---

## 📊 Domain Readiness Data Structure

### Audit Results Structure
```typescript
interface AeoAuditResult {
  overallScore: number; // 0-100
  scoreBreakdown: {
    technicalCrawlability: number;  // 0-100
    contentQuality: number;          // 0-100
    semanticStructure: number;       // 0-100
    accessibilityAndBrand: number;    // 0-100
    aeoOptimization: number;         // 0-100
  };
  detailedResults: {
    technicalCrawlability: {
      score: number;
      tests: TestResult[];  // Array of individual test results
    };
    // ... other categories
  };
}

interface TestResult {
  name: string;           // e.g., "XML Sitemap", "Robots.txt", "LLMs.txt"
  status: 'pass' | 'fail' | 'warning' | 'info';
  score: number;         // 0-100
  message: string;
  details?: Record<string, unknown>;
}
```

### Key Tests Tracked

**Technical Crawlability:**
- `analyzeBasicCrawlability` → Basic crawlability checks
- `analyzeRobotsTxt` → Robots.txt configuration
- `analyzeSitemap` → XML sitemap presence/quality
- `analyzeCanonical` → Canonical URL implementation
- `analyzeLlmsTxt` → LLMs.txt file presence

**Content Quality:**
- `analyzeFreshness` → Content freshness/publish dates
- `analyzeFaq` → FAQ content presence
- `analyzeBrandConsistency` → Brand name usage

**Semantic Structure:**
- `analyzeSchema` → Schema.org markup
- `analyzeHtmlStructure` → Heading hierarchy, semantic HTML

**Accessibility & Brand:**
- `analyzeAccessibility` → Image alt text, ARIA labels
- `analyzeMetadata` → Title, description, Open Graph tags

---

## 🔗 Integration Architecture

### Phase 1: Recommendation Filtering Service

Create a new service that maps Domain Readiness test results to recommendation keywords/patterns.

#### 1.1 Create Domain Readiness Filter Service

**File:** `backend/src/services/recommendations/domain-readiness-filter.service.ts`

```typescript
import { AeoAuditResult, TestResult } from '../../domain-readiness/types';
import { RecommendationV3 } from './recommendation-v3.service';

/**
 * Maps Domain Readiness test names to recommendation action keywords
 */
const READINESS_TO_RECOMMENDATION_MAP: Record<string, string[]> = {
  // Technical Crawlability
  'XML Sitemap': ['sitemap', 'xml sitemap', 'sitemap.xml'],
  'Robots.txt': ['robots.txt', 'robots', 'crawlability'],
  'LLMs.txt': ['llms.txt', 'llm', 'ai bot access'],
  'Canonical URLs': ['canonical', 'canonical url', 'duplicate content'],
  'Basic Crawlability': ['crawlability', 'crawl', 'index coverage'],
  
  // Content Quality
  'FAQ Content': ['faq', 'frequently asked', 'q&a', 'answer-first'],
  'Content Freshness': ['freshness', 'publish date', 'content date', 'recent content'],
  'Brand Consistency': ['brand name', 'brand consistency', 'branding'],
  
  // Semantic Structure
  'Schema Markup': ['schema', 'schema.org', 'structured data', 'json-ld'],
  'Heading Hierarchy': ['heading', 'h1', 'h2', 'h3', 'headings'],
  'Semantic HTML': ['semantic html', 'html5', 'article', 'section'],
  
  // Accessibility & Brand
  'Image Alt Text': ['alt text', 'image alt', 'accessibility'],
  'Metadata Quality': ['metadata', 'meta description', 'title tag', 'og:title'],
  'Open Graph Tags': ['open graph', 'og:', 'social sharing'],
};

/**
 * Checks if a recommendation should be filtered based on Domain Readiness results
 */
export function shouldFilterRecommendation(
  recommendation: RecommendationV3,
  auditResult: AeoAuditResult | null
): boolean {
  if (!auditResult) {
    // No audit data = don't filter (allow all recommendations)
    return false;
  }

  const actionLower = recommendation.action.toLowerCase();
  
  // Check each test category
  for (const [testName, keywords] of Object.entries(READINESS_TO_RECOMMENDATION_MAP)) {
    // Check if recommendation mentions any keyword
    const matchesKeyword = keywords.some(keyword => actionLower.includes(keyword));
    
    if (matchesKeyword) {
      // Find the test result
      const testResult = findTestResult(auditResult, testName);
      
      if (testResult) {
        // Filter if test PASSED (score >= 80) or is WARNING (score >= 60)
        // Only keep recommendations if test FAILED (score < 60)
        if (testResult.status === 'pass' || (testResult.status === 'warning' && testResult.score >= 60)) {
          console.log(`🚫 [DomainReadinessFilter] Filtering recommendation: "${recommendation.action.substring(0, 50)}..." - ${testName} already optimized (score: ${testResult.score})`);
          return true; // Filter this recommendation
        }
      }
    }
  }

  return false; // Don't filter
}

/**
 * Find a test result by name across all categories
 */
function findTestResult(auditResult: AeoAuditResult, testName: string): TestResult | null {
  const categories = [
    auditResult.detailedResults.technicalCrawlability,
    auditResult.detailedResults.contentQuality,
    auditResult.detailedResults.semanticStructure,
    auditResult.detailedResults.accessibilityAndBrand,
    auditResult.detailedResults.aeoOptimization,
  ];

  for (const category of categories) {
    const test = category.tests.find(t => t.name === testName || t.name.includes(testName));
    if (test) return test;
  }

  return null;
}

/**
 * Get Domain Readiness context for recommendation prompts
 */
export function getReadinessContext(auditResult: AeoAuditResult | null): string {
  if (!auditResult) {
    return 'No Domain Readiness audit available.';
  }

  const lines: string[] = [];
  lines.push(`Domain Readiness Score: ${auditResult.overallScore}/100`);
  lines.push('');
  lines.push('Category Scores:');
  lines.push(`- Technical Crawlability: ${auditResult.scoreBreakdown.technicalCrawlability}/100`);
  lines.push(`- Content Quality: ${auditResult.scoreBreakdown.contentQuality}/100`);
  lines.push(`- Semantic Structure: ${auditResult.scoreBreakdown.semanticStructure}/100`);
  lines.push(`- Accessibility & Brand: ${auditResult.scoreBreakdown.accessibilityAndBrand}/100`);
  lines.push(`- AEO Optimization: ${auditResult.scoreBreakdown.aeoOptimization}/100`);
  lines.push('');

  // List failed tests (priority issues)
  const failedTests: string[] = [];
  const categories = [
    { name: 'Technical Crawlability', tests: auditResult.detailedResults.technicalCrawlability.tests },
    { name: 'Content Quality', tests: auditResult.detailedResults.contentQuality.tests },
    { name: 'Semantic Structure', tests: auditResult.detailedResults.semanticStructure.tests },
    { name: 'Accessibility & Brand', tests: auditResult.detailedResults.accessibilityAndBrand.tests },
    { name: 'AEO Optimization', tests: auditResult.detailedResults.aeoOptimization.tests },
  ];

  for (const category of categories) {
    const failures = category.tests.filter(t => t.status === 'fail' || (t.status === 'warning' && t.score < 60));
    if (failures.length > 0) {
      failedTests.push(`${category.name}: ${failures.map(t => t.name).join(', ')}`);
    }
  }

  if (failedTests.length > 0) {
    lines.push('Critical Issues (needs attention):');
    failedTests.forEach(issue => lines.push(`- ${issue}`));
  } else {
    lines.push('All technical checks passed. Focus on content and strategy recommendations.');
  }

  return lines.join('\n');
}
```

#### 1.2 Integrate Filter into Recommendation V3 Service

**File:** `backend/src/services/recommendations/recommendation-v3.service.ts`

Add Domain Readiness integration:

```typescript
import { domainReadinessService } from '../domain-readiness/domain-readiness.service';
import { shouldFilterRecommendation, getReadinessContext } from './domain-readiness-filter.service';

// In generateRecommendations method, after generating recommendations:

// Step 1: Fetch latest Domain Readiness audit
const latestAudit = await domainReadinessService.getLatestAudit(brandId);

// Step 2: Filter recommendations based on audit results
if (latestAudit) {
  recommendations = recommendations.filter(rec => 
    !shouldFilterRecommendation(rec, latestAudit)
  );
  console.log(`✅ [RecommendationV3Service] Filtered recommendations using Domain Readiness (${recommendations.length} remaining)`);
}

// Step 3: Add Domain Readiness context to prompts (for future recommendations)
// This can be added to the KPI identification and recommendation generation prompts
```

---

### Phase 2: Enhanced Recommendation Generation

#### 2.1 Add Domain Readiness Context to Prompts

Modify the recommendation generation prompts to include Domain Readiness data:

**In `generateRecommendationsForKPIs` method:**

```typescript
// Add Domain Readiness context to prompt
const readinessContext = getReadinessContext(latestAudit);

const prompt = `You are a Brand/AEO expert. Generate 2-3 actionable recommendations for EACH identified KPI below.

${readinessContext}

IMPORTANT RULES:
- Do NOT recommend optimizing technical elements (sitemap, robots.txt, LLMs.txt, canonical URLs) if Domain Readiness shows these are already optimized (score >= 80).
- Prioritize recommendations that address Domain Readiness gaps (failed tests).
- For brands with low technical crawlability scores (< 60), prioritize technical fixes FIRST before content recommendations.
- Focus on content and strategy recommendations if technical foundation is solid (overall score >= 75).

[... rest of prompt ...]
`;
```

#### 2.2 Create Technical-First Recommendations for Low Readiness

Add logic to generate technical recommendations when readiness is low:

```typescript
/**
 * Generate technical recommendations based on Domain Readiness gaps
 */
private async generateTechnicalRecommendations(
  auditResult: AeoAuditResult,
  brandId: string
): Promise<RecommendationV3[]> {
  const recommendations: RecommendationV3[] = [];
  
  // Only generate if overall score is low (< 60)
  if (auditResult.overallScore >= 60) {
    return recommendations;
  }

  // Check each category and generate recommendations for failures
  const categories = [
    {
      name: 'Technical Crawlability',
      tests: auditResult.detailedResults.technicalCrawlability.tests,
      focusArea: 'visibility' as const,
    },
    {
      name: 'Content Quality',
      tests: auditResult.detailedResults.contentQuality.tests,
      focusArea: 'visibility' as const,
    },
    {
      name: 'Semantic Structure',
      tests: auditResult.detailedResults.semanticStructure.tests,
      focusArea: 'visibility' as const,
    },
  ];

  for (const category of categories) {
    const failedTests = category.tests.filter(
      t => t.status === 'fail' || (t.status === 'warning' && t.score < 60)
    );

    for (const test of failedTests) {
      recommendations.push({
        action: `Fix ${test.name}: ${test.message}`,
        citationSource: 'owned-site',
        focusArea: category.focusArea,
        priority: test.score < 40 ? 'High' : 'Medium',
        effort: 'Low',
        kpi: 'Technical Readiness',
        reason: `Domain Readiness audit shows ${test.name} needs attention (score: ${test.score}/100)`,
        explanation: test.message,
        expectedBoost: '+5-15%',
        timeline: '1-2 weeks',
        confidence: 90,
      });
    }
  }

  return recommendations;
}
```

---

### Phase 3: Priority Scoring Enhancement

#### 3.1 Boost Priority Based on Readiness Gaps

Modify recommendation ranking to prioritize recommendations that address Domain Readiness gaps:

```typescript
/**
 * Enhance recommendation scores based on Domain Readiness gaps
 */
function enhanceRecommendationWithReadiness(
  recommendation: RecommendationV3,
  auditResult: AeoAuditResult | null
): RecommendationV3 {
  if (!auditResult) return recommendation;

  const actionLower = recommendation.action.toLowerCase();
  let priorityBoost = 0;

  // Check if recommendation addresses a failed test
  const categories = [
    auditResult.detailedResults.technicalCrawlability,
    auditResult.detailedResults.contentQuality,
    auditResult.detailedResults.semanticStructure,
    auditResult.detailedResults.accessibilityAndBrand,
  ];

  for (const category of categories) {
    const failedTests = category.tests.filter(
      t => t.status === 'fail' || (t.status === 'warning' && t.score < 60)
    );

    for (const test of failedTests) {
      const keywords = READINESS_TO_RECOMMENDATION_MAP[test.name] || [];
      if (keywords.some(kw => actionLower.includes(kw))) {
        // This recommendation addresses a failed test - boost priority
        priorityBoost += 10;
        if (test.score < 40) priorityBoost += 5; // Critical issue
      }
    }
  }

  // Adjust calculated score if it exists
  if (recommendation.calculatedScore !== undefined) {
    recommendation.calculatedScore = (recommendation.calculatedScore || 0) + priorityBoost;
  }

  // Upgrade priority if significant boost
  if (priorityBoost >= 15 && recommendation.priority === 'Medium') {
    recommendation.priority = 'High';
  } else if (priorityBoost >= 10 && recommendation.priority === 'Low') {
    recommendation.priority = 'Medium';
  }

  return recommendation;
}
```

---

## 🗄️ Database Schema Updates

### Add Domain Readiness Reference to Recommendations

**Migration:** `supabase/migrations/YYYYMMDD_add_domain_readiness_to_recommendations.sql`

```sql
-- Add column to track if recommendation was filtered by Domain Readiness
ALTER TABLE recommendations 
ADD COLUMN IF NOT EXISTS filtered_by_readiness BOOLEAN DEFAULT FALSE;

-- Add column to store Domain Readiness audit ID used for filtering
ALTER TABLE recommendations 
ADD COLUMN IF NOT EXISTS domain_readiness_audit_id UUID REFERENCES domain_readiness_audits(id);

-- Add index for querying
CREATE INDEX IF NOT EXISTS idx_recommendations_readiness_audit 
ON recommendations(domain_readiness_audit_id);

-- Add column to track readiness context in recommendation generation
ALTER TABLE recommendation_generations
ADD COLUMN IF NOT EXISTS domain_readiness_audit_id UUID REFERENCES domain_readiness_audits(id);
```

---

## 🔄 Implementation Flow

### Recommendation Generation with Domain Readiness

```
1. User requests recommendations
   ↓
2. Fetch brand context (metrics, trends, sources)
   ↓
3. Fetch latest Domain Readiness audit (if exists)
   ↓
4. Identify KPIs (with readiness context in prompt)
   ↓
5. Generate recommendations for each KPI
   ↓
6. Filter recommendations based on readiness audit
   - Remove recommendations for optimized elements
   - Keep recommendations for failed tests
   ↓
7. Enhance recommendations with readiness priority boost
   ↓
8. Generate technical recommendations (if readiness < 60)
   ↓
9. Merge and rank all recommendations
   ↓
10. Save to database (with audit reference)
```

---

## 📋 Implementation Checklist

### Phase 1: Core Filtering (Week 1)
- [ ] Create `domain-readiness-filter.service.ts`
- [ ] Implement keyword mapping (`READINESS_TO_RECOMMENDATION_MAP`)
- [ ] Implement `shouldFilterRecommendation()` function
- [ ] Implement `getReadinessContext()` function
- [ ] Add unit tests for filtering logic
- [ ] Integrate filter into `recommendation-v3.service.ts`
- [ ] Test with real audit data

### Phase 2: Enhanced Generation (Week 2)
- [ ] Add Domain Readiness context to KPI identification prompt
- [ ] Add Domain Readiness context to recommendation generation prompt
- [ ] Implement `generateTechnicalRecommendations()` method
- [ ] Update prompt templates with readiness rules
- [ ] Test recommendation generation with low/high readiness scores

### Phase 3: Priority Enhancement (Week 2)
- [ ] Implement `enhanceRecommendationWithReadiness()` function
- [ ] Update ranking algorithm to include readiness boost
- [ ] Test priority adjustments

### Phase 4: Database & Tracking (Week 3)
- [ ] Create database migration
- [ ] Update recommendation save logic to store audit reference
- [ ] Add filtering metadata to recommendations table
- [ ] Create analytics query to track filtering effectiveness

### Phase 5: Testing & Validation (Week 3-4)
- [ ] Test with brands that have high readiness scores
- [ ] Test with brands that have low readiness scores
- [ ] Test with brands that have no audit data
- [ ] Validate filtering accuracy (manual review)
- [ ] Performance testing (ensure no significant slowdown)

---

## 🎯 Success Metrics

### Key Performance Indicators

1. **Filtering Accuracy**
   - % of recommendations correctly filtered (should be > 95%)
   - False positive rate (filtering valid recommendations) < 5%
   - False negative rate (not filtering redundant recommendations) < 10%

2. **User Experience**
   - Reduction in redundant technical recommendations
   - Increase in actionable recommendations
   - User satisfaction with recommendation relevance

3. **Technical Performance**
   - Recommendation generation time increase < 200ms
   - Database query performance maintained

---

## 🚨 Edge Cases & Considerations

### 1. No Audit Data
- **Behavior:** Don't filter any recommendations
- **Rationale:** Without audit data, we can't know what's optimized

### 2. Stale Audit Data
- **Behavior:** Use audit if < 90 days old, otherwise ignore
- **Implementation:** Check `auditResult.timestamp` before filtering

### 3. Partial Test Results
- **Behavior:** Only filter if test result exists and is definitive (pass/fail)
- **Rationale:** Warning/info status may not be definitive

### 4. Multiple Audits
- **Behavior:** Always use latest audit (already handled by `getLatestAudit()`)
- **Rationale:** Most recent audit reflects current state

### 5. Recommendation Source Mismatch
- **Behavior:** Only filter if recommendation source is "owned-site"
- **Rationale:** External source recommendations (directories, partnerships) shouldn't be filtered by technical readiness

---

## 📝 Example Scenarios

### Scenario 1: High Readiness Score (85/100)

**Domain Readiness Results:**
- XML Sitemap: ✅ Pass (95/100)
- Robots.txt: ✅ Pass (90/100)
- LLMs.txt: ✅ Pass (88/100)

**Recommendation Engine Behavior:**
- ❌ **Filter out:** "Audit and optimize XML sitemap, robots.txt, and crawlability"
- ✅ **Keep:** "Develop high-impact case studies" (content recommendation)
- ✅ **Keep:** "Optimize directory listings" (external source)

### Scenario 2: Low Readiness Score (45/100)

**Domain Readiness Results:**
- XML Sitemap: ❌ Fail (30/100)
- Robots.txt: ❌ Fail (25/100)
- FAQ Content: ❌ Fail (40/100)

**Recommendation Engine Behavior:**
- ✅ **Keep:** "Fix XML Sitemap: Missing or incomplete sitemap.xml"
- ✅ **Keep:** "Fix Robots.txt: Blocking AI bots"
- ✅ **Keep:** "Audit and optimize FAQ content"
- ✅ **Prioritize:** Technical recommendations get High priority boost

### Scenario 3: No Audit Data

**Domain Readiness Results:**
- No audit available

**Recommendation Engine Behavior:**
- ✅ **Keep all recommendations** (no filtering)
- ✅ **Generate normally** without readiness context

---

## 🔮 Future Enhancements

### Phase 6: Advanced Integration (Future)

1. **Readiness-Based Recommendation Templates**
   - Pre-generate recommendations based on common readiness patterns
   - Cache recommendations for similar readiness profiles

2. **Readiness Trend Analysis**
   - Track readiness improvements over time
   - Correlate readiness improvements with visibility/SOA gains
   - Auto-generate "success stories" when readiness improves

3. **Smart Recommendation Sequencing**
   - Recommend technical fixes first for low-readiness brands
   - Recommend content strategy for high-readiness brands
   - Create "readiness roadmap" recommendations

4. **Integration with Content Generation**
   - Use readiness gaps to inform content generation prompts
   - Generate content that addresses specific technical issues

---

## 📚 References

- Domain Readiness Service: `backend/src/services/domain-readiness/domain-readiness.service.ts`
- Recommendation V3 Service: `backend/src/services/recommendations/recommendation-v3.service.ts`
- Domain Readiness Types: `backend/src/services/domain-readiness/types.ts`
- Domain Readiness Documentation: `documentation/DOMAIN_READINESS_EXPLAINED.md`

---

**Next Steps:**
1. Review and approve this plan
2. Create implementation tickets
3. Begin Phase 1 implementation
4. Schedule weekly review meetings
