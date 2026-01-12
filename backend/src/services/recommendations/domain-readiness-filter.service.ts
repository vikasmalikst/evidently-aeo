/**
 * Domain Readiness Filter Service
 * 
 * Filters recommendations based on Domain Readiness audit results to prevent
 * redundant suggestions for technical elements that are already optimized.
 * 
 * Example: If Domain Readiness shows XML sitemap is 95/100 (pass),
 * filter out recommendations like "optimize XML sitemap".
 */

import { AeoAuditResult, TestResult } from '../domain-readiness/types';
import { RecommendationV3 } from './recommendation-v3.service';

// ============================================================================
// KEYWORD MAPPING: Domain Readiness Test → Recommendation Keywords
// ============================================================================

/**
 * Maps Domain Readiness test names to keywords that appear in recommendation actions.
 * 
 * When a recommendation's action text contains any of these keywords, we check
 * the corresponding Domain Readiness test result to decide if we should filter it.
 */
const READINESS_TO_RECOMMENDATION_MAP: Record<string, string[]> = {
  // Technical Crawlability Tests
  'XML Sitemap': ['sitemap', 'xml sitemap', 'sitemap.xml'],
  'Robots.txt': ['robots.txt', 'bot access'], // Removed 'crawlability' to avoid false positives
  'LLMs.txt': ['llms.txt', 'llm', 'ai bot access', 'ai crawler'],
  'Canonical URLs': ['canonical', 'canonical url', 'duplicate content', 'canonical tag'],
  'Basic Crawlability': ['index coverage', 'indexing', 'noindex'],
  'HTTP Status Codes': ['http status', '403', '404', '500', 'status code', 'redirect', 'broken link'],
  'SSL/HTTPS': ['ssl', 'https', 'security', 'certificate'],

  // Content Quality Tests
  'FAQ Content': ['faq', 'frequently asked', 'q&a', 'answer-first', 'questions'],
  'Content Freshness': ['freshness', 'publish date', 'content date', 'recent content', 'updated'],
  'Brand Consistency': ['brand name', 'brand consistency', 'branding', 'brand mention'],
  'Content Relevance': ['relevance', 'intent', 'depth'],

  // Semantic Structure Tests
  'Schema Markup': ['schema', 'schema.org', 'structured data', 'json-ld', 'microdata'],
  'Heading Hierarchy': ['heading', 'h1', 'h2', 'h3', 'headings', 'heading structure'],
  'Semantic HTML': ['semantic html', 'html5', 'article', 'section', 'semantic elements'],

  // Accessibility & Brand Tests
  'Image Alt Text': ['alt text', 'image alt', 'accessibility', 'alt attribute'],
  'Metadata Quality': ['metadata', 'meta description', 'title tag', 'meta tags'],
  'Open Graph Tags': ['open graph', 'og:', 'social sharing', 'og:title', 'og:description'],
  'Mobile Friendliness': ['mobile', 'responsive', 'viewport'],
  'Page Speed': ['speed', 'load time', 'performance', 'lcp', 'cls', 'fid'],
};

// ============================================================================
// FILTERING LOGIC
// ============================================================================

/**
 * Checks if a recommendation should be filtered based on Domain Readiness audit results.
 * 
 * @param recommendation - The recommendation to check
 * @param auditResult - Latest Domain Readiness audit result (null if no audit exists)
 * @returns true if recommendation should be filtered out, false otherwise
 */
export function shouldFilterRecommendation(
  recommendation: RecommendationV3,
  auditResult: AeoAuditResult | null
): boolean {
  // No audit data = don't filter (allow all recommendations)
  if (!auditResult) {
    return false;
  }

  const actionLower = recommendation.action.toLowerCase();

  // Only filter recommendations for "owned-site" (technical fixes)
  // External sources (directories, partnerships) shouldn't be filtered
  if (recommendation.citationSource !== 'owned-site') {
    return false;
  }

  // Check each test category for keyword matches
  for (const [testName, keywords] of Object.entries(READINESS_TO_RECOMMENDATION_MAP)) {
    // Check if recommendation action mentions any keyword
    const matchesKeyword = keywords.some(keyword => actionLower.includes(keyword));

    if (matchesKeyword) {
      // Find the corresponding test result in the audit
      const testResult = findTestResult(auditResult, testName);

      if (testResult) {
        // Filter if test PASSED (score >= 80) or is WARNING with good score (>= 60)
        // Only keep recommendations if test FAILED (score < 60) or is critical warning
        if (testResult.status === 'pass' || (testResult.status === 'warning' && testResult.score >= 60)) {
          console.log(
            `🚫 [DomainReadinessFilter] Filtering: "${recommendation.action.substring(0, 60)}..." - ` +
            `${testName} already optimized (score: ${testResult.score}, status: ${testResult.status})`
          );
          return true; // Filter this recommendation
        }
      }
    }
  }

  return false; // Don't filter
}

/**
 * Find a test result by name across all Domain Readiness categories.
 * 
 * @param auditResult - The audit result to search
 * @param testName - Name of the test to find (exact or partial match)
 * @returns TestResult if found, null otherwise
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
    // Try exact match first
    let test = category.tests.find(t => t.name === testName);

    // Try partial match if exact match fails
    if (!test) {
      test = category.tests.find(t =>
        t.name.toLowerCase().includes(testName.toLowerCase()) ||
        testName.toLowerCase().includes(t.name.toLowerCase())
      );
    }

    if (test) return test;
  }

  return null;
}

// ============================================================================
// CONTEXT GENERATION FOR PROMPTS
// ============================================================================

/**
 * Generate Domain Readiness context string for inclusion in recommendation prompts.
 * 
 * This helps the LLM understand the technical state of the brand's website
 * and avoid recommending fixes for things that are already optimized.
 * 
 * @param auditResult - Latest Domain Readiness audit result (null if no audit)
 * @returns Formatted context string for prompts
 */
export function getReadinessContext(auditResult: AeoAuditResult | null): string {
  if (!auditResult) {
    return 'Domain Readiness: No audit data available.';
  }

  const lines: string[] = [];
  lines.push('=== DOMAIN READINESS AUDIT RESULTS ===');
  lines.push(`Overall Score: ${auditResult.overallScore}/100`);
  lines.push('');
  lines.push('Category Breakdown:');
  lines.push(`- Technical Crawlability: ${auditResult.scoreBreakdown.technicalCrawlability}/100`);
  lines.push(`- Content Quality: ${auditResult.scoreBreakdown.contentQuality}/100`);
  lines.push(`- Semantic Structure: ${auditResult.scoreBreakdown.semanticStructure}/100`);
  lines.push(`- Accessibility & Brand: ${auditResult.scoreBreakdown.accessibilityAndBrand}/100`);
  lines.push(`- AEO Optimization: ${auditResult.scoreBreakdown.aeoOptimization}/100`);
  lines.push('');

  // List failed tests (priority issues that need attention)
  const failedTests: string[] = [];
  const categories = [
    { name: 'Technical Crawlability', tests: auditResult.detailedResults.technicalCrawlability.tests },
    { name: 'Content Quality', tests: auditResult.detailedResults.contentQuality.tests },
    { name: 'Semantic Structure', tests: auditResult.detailedResults.semanticStructure.tests },
    { name: 'Accessibility & Brand', tests: auditResult.detailedResults.accessibilityAndBrand.tests },
    { name: 'AEO Optimization', tests: auditResult.detailedResults.aeoOptimization.tests },
  ];

  for (const category of categories) {
    const failures = category.tests.filter(
      t => t.status === 'fail' || (t.status === 'warning' && t.score < 60)
    );
    if (failures.length > 0) {
      failedTests.push(
        `${category.name}: ${failures.map(t => `${t.name} (${t.score}/100)`).join(', ')}`
      );
    }
  }

  if (failedTests.length > 0) {
    lines.push('⚠️ Critical Issues (needs attention):');
    failedTests.forEach(issue => lines.push(`  - ${issue}`));
    lines.push('');
    lines.push('PRIORITY: Address these technical issues first before content recommendations.');
  } else {
    lines.push('✅ All technical checks passed. Focus on content and strategy recommendations.');
  }

  lines.push('');
  lines.push('IMPORTANT: Do NOT recommend optimizing technical elements that show "pass" status or score >= 80.');
  lines.push('=====================================');

  return lines.join('\n');
}

// ============================================================================
// PRIORITY ENHANCEMENT
// ============================================================================

/**
 * Enhance recommendation priority/score based on Domain Readiness gaps.
 * 
 * Recommendations that address failed Domain Readiness tests get priority boost.
 * 
 * @param recommendation - Recommendation to enhance
 * @param auditResult - Latest Domain Readiness audit result
 * @returns Enhanced recommendation with adjusted priority/score
 */
export function enhanceRecommendationWithReadiness(
  recommendation: RecommendationV3,
  auditResult: AeoAuditResult | null
): RecommendationV3 {
  if (!auditResult) return recommendation;

  const actionLower = recommendation.action.toLowerCase();
  let priorityBoost = 0;
  let addressedTests: string[] = [];

  // Check if recommendation addresses any failed test
  const categories = [
    { name: 'Technical Crawlability', tests: auditResult.detailedResults.technicalCrawlability.tests },
    { name: 'Content Quality', tests: auditResult.detailedResults.contentQuality.tests },
    { name: 'Semantic Structure', tests: auditResult.detailedResults.semanticStructure.tests },
    { name: 'Accessibility & Brand', tests: auditResult.detailedResults.accessibilityAndBrand.tests },
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
        addressedTests.push(test.name);

        // Extra boost for critical failures (score < 40)
        if (test.score < 40) {
          priorityBoost += 5;
        }
      }
    }
  }

  // Adjust calculated score if it exists
  if (recommendation.calculatedScore !== undefined && priorityBoost > 0) {
    recommendation.calculatedScore = (recommendation.calculatedScore || 0) + priorityBoost;
  }

  // Upgrade priority if significant boost
  if (priorityBoost >= 15 && recommendation.priority === 'Medium') {
    recommendation.priority = 'High';
  } else if (priorityBoost >= 10 && recommendation.priority === 'Low') {
    recommendation.priority = 'Medium';
  }

  if (addressedTests.length > 0) {
    console.log(
      `⬆️ [DomainReadinessFilter] Priority boost (+${priorityBoost}) for recommendation: ` +
      `"${recommendation.action.substring(0, 50)}..." - addresses: ${addressedTests.join(', ')}`
    );
  }

  return recommendation;
}
