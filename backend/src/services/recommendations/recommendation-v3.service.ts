/**
 * Recommendation Engine Service V3 - KPI-First Approach
 * 
 * Generates AI-powered recommendations using a KPI-first methodology:
 * 1. Phase 1: Identify 3-5 key KPIs/metrics that are most important for this brand
 * 2. Phase 2: Generate 2-3 recommendations per identified KPI
 * 
 * Uses Cerebras API with QWEN model.
 * 
 * This is a separate implementation from the original recommendation.service.ts
 * to maintain backward compatibility.
 */

import { getCerebrasKey, getCerebrasModel } from '../../utils/api-key-resolver';
import { supabaseAdmin } from '../../config/database';
import { OptimizedMetricsHelper } from '../query-helpers/optimized-metrics.helper';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';
import { shouldUseOllama, callOllamaAPI } from '../scoring/ollama-client.service';
import { sourceAttributionService } from '../source-attribution.service';
import {
  buildCompetitorExclusionList,
  filterCompetitorSources,
  filterCompetitorRecommendations,
  type CompetitorExclusionList
} from './competitor-filter.service';
import { generateColdStartRecommendations } from './cold-start-templates';
import { filterLowQualityRecommendationsV3 } from './recommendation-quality.service';
import { rankRecommendationsV3 } from './recommendation-ranking.service';
import { domainReadinessService } from '../domain-readiness/domain-readiness.service';
import { graphRecommendationService } from './graph-recommendation.service';
import {
  shouldFilterRecommendation,
  getReadinessContext,
  enhanceRecommendationWithReadiness
} from './domain-readiness-filter.service';
import { getHowToFixSteps } from './domain-readiness-resources';
import { recommendationContextService } from './recommendation-context.service';
import { recommendationPromptService } from './recommendation-prompt.service';
import { recommendationLLMService } from './recommendation-llm.service';
import {
  IdentifiedKPI,
  RecommendationV3,
  RecommendationV3Response,
  BrandContextV3,
  CerebrasChatResponse
} from './recommendation.types';
import { AeoAuditResult, BotAccessStatus, TestResult } from '../domain-readiness/types';



// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class RecommendationV3Service {
  private cerebrasApiKey: string | null;
  private cerebrasModel: string;

  constructor() {
    this.cerebrasApiKey = getCerebrasKey();
    this.cerebrasModel = getCerebrasModel();

    if (!this.cerebrasApiKey) {
      console.warn('⚠️ [RecommendationV3Service] CEREBRAS_API_KEY not configured');
    }
    console.log(`🤖 [RecommendationV3Service] Initialized with OpenRouter as primary (Cerebras as fallback)`);
  }

  private getFeatureFlags() {
    return {
      coldStartMode: process.env.RECS_V3_COLD_START_MODE !== 'false',
      coldStartPersonalize: process.env.RECS_V3_COLD_START_PERSONALIZE !== 'false',
      qualityContract: process.env.RECS_V3_QUALITY_CONTRACT !== 'false',
      deterministicRanking: process.env.RECS_V3_DETERMINISTIC_RANKING !== 'false',
      domainReadinessFilter: process.env.RECS_V3_DOMAIN_FILTER === 'true' // Disabled by default
    };
  }

  private computeDataMaturity(context: BrandContextV3): BrandContextV3['_dataMaturity'] {
    // Inline normalizePercent logic: 0-1 or 0-100 -> 0-100
    const normalize = (v: number | null | undefined) => {
      if (v === null || v === undefined) return null;
      const scaled = v <= 1 ? v * 100 : v;
      return Math.max(0, Math.min(100, Math.round(scaled * 10) / 10));
    };

    const visibility = normalize(context.visibilityIndex ?? null); // 0-100
    const soa = normalize(context.shareOfAnswers ?? null); // 0-100
    const sources = context.sourceMetrics ?? [];
    const totalCitations = sources.reduce((sum, s) => sum + (s.citations || 0), 0);
    const uniqueDomains = sources.length;

    // Conservative defaults (tune later)
    const N1 = 50; // citations
    const N2 = 5;  // unique domains
    const N4 = 5;  // visibility
    const N5 = 5;  // SOA

    const isColdStart =
      totalCitations < N1 ||
      uniqueDomains < N2 ||
      (visibility !== null && visibility < N4) ||
      (soa !== null && soa < N5);

    if (isColdStart) return 'cold_start';

    const isLowData =
      totalCitations < 100 ||
      (visibility !== null && visibility < 15);

    return isLowData ? 'low_data' : 'normal';
  }

  private attachSourceMetrics(context: BrandContextV3, recommendations: RecommendationV3[]): RecommendationV3[] {
    const normalizeSentiment100 = (value: number | null | undefined) =>
      value === null || value === undefined ? null : Math.max(0, Math.min(100, ((value + 1) / 2) * 100));

    const formatValue = (value: number | null | undefined, decimals: number = 1): string | null => {
      if (value === null || value === undefined) return null;
      return String(Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals));
    };

    const metricsByDomain = new Map((context.sourceMetrics ?? []).map(s => [s.domain, s]));

    return recommendations.map(rec => {
      const matchingSource = metricsByDomain.get(rec.citationSource || '');
      return {
        ...rec,
        impactScore: matchingSource ? formatValue(matchingSource.impactScore, 1) : rec.impactScore ?? null,
        mentionRate:
          matchingSource && Number.isFinite(matchingSource.mentionRate)
            ? formatValue(matchingSource.mentionRate, 1)
            : rec.mentionRate ?? null,
        soa:
          matchingSource && matchingSource.soa !== null && matchingSource.soa !== undefined
            ? formatValue(matchingSource.soa, 1)
            : rec.soa ?? null,
        sentiment:
          matchingSource && matchingSource.sentiment !== null && matchingSource.sentiment !== undefined
            ? formatValue(matchingSource.sentiment, 2)
            : rec.sentiment ?? null,
        visibilityScore:
          matchingSource && matchingSource.visibility !== null && matchingSource.visibility !== undefined
            ? String(Math.round(matchingSource.visibility))
            : rec.visibilityScore ?? null,
        citationCount: matchingSource ? matchingSource.citations : rec.citationCount ?? 0,
        // Ensure these exist
        explanation: rec.explanation || rec.reason || rec.action,
        focusSources: rec.focusSources || rec.citationSource,
        contentFocus: rec.contentFocus || rec.action,
        timeline: rec.timeline || '2-4 weeks',
        confidence: rec.confidence || 70
      };
    });
  }

  private postProcessRecommendations(context: BrandContextV3, recommendations: RecommendationV3[]): RecommendationV3[] {
    const flags = this.getFeatureFlags();
    console.log(`🔍 [RecommendationV3Service] Post-processing ${recommendations.length} recommendation(s)`);

    // Attach metrics first (so quality/ranking can rely on them)
    let recs = this.attachSourceMetrics(context, recommendations);
    console.log(`   ✓ After attachSourceMetrics: ${recs.length} recommendation(s)`);

    // Competitor filter (already implemented; keep as a safety gate)
    const exclusionList = context._competitorExclusionList || {
      names: new Set<string>(),
      domains: new Set<string>(),
      nameVariations: new Set<string>(),
      baseDomains: new Set<string>()
    };
    const competitorFilterResult = filterCompetitorRecommendations(recs, exclusionList, { allowTextMentions: true });
    if (competitorFilterResult.removed.length > 0) {
      console.warn(`   ⚠️ Competitor filter removed ${competitorFilterResult.removed.length} recommendation(s)`);
      competitorFilterResult.removed.slice(0, 5).forEach(r => {
        console.warn(`      - Removed: "${r.recommendation.action?.substring(0, 60)}..." Reason: ${r.reason}`);
      });
    }
    recs = competitorFilterResult.filtered;
    console.log(`   ✓ After competitor filter: ${recs.length} recommendation(s)`);

    // Quality contract
    if (flags.qualityContract) {
      const { kept, removed } = filterLowQualityRecommendationsV3(recs);
      if (removed.length > 0) {
        console.warn(`   ⚠️ Quality filter removed ${removed.length} recommendation(s)`);
        removed.slice(0, 10).forEach(r => {
          console.warn(`      - Removed: "${r.recommendation.action?.substring(0, 60)}..." Reasons: ${r.reasons.join('; ')}`);
        });
      }
      recs = kept;
      console.log(`   ✓ After quality filter: ${recs.length} recommendation(s)`);
    } else {
      console.log(`   ⏭️  Quality contract disabled (skipping quality filter)`);
    }

    // Deterministic ranking + confidence
    if (flags.deterministicRanking) {
      recs = rankRecommendationsV3(recs, { sourceMetrics: context.sourceMetrics });
      console.log(`   ✓ After ranking: ${recs.length} recommendation(s)`);
    } else {
      console.log(`   ⏭️  Deterministic ranking disabled (skipping ranking)`);
    }

    console.log(`✅ [RecommendationV3Service] Post-processing complete: ${recs.length} recommendation(s) remaining`);
    return recs;
  }

  private async personalizeColdStartRecommendations(
    context: BrandContextV3,
    templates: RecommendationV3[]
  ): Promise<RecommendationV3[]> {
    const flags = this.getFeatureFlags();
    if (!flags.coldStartPersonalize) return templates;

    try {
      const systemMessage = 'You are a senior marketing consultant and AEO expert. You transform baseline tasks into concrete, high-quality recommendations. Respond ONLY with valid JSON.';
      const prompt = recommendationPromptService.constructColdStartPrompt(context, templates);

      const parsed = await recommendationLLMService.executePrompt<any>(
        context.brandId,
        prompt,
        systemMessage
      );

      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
        return templates;
      }

      return parsed.map((rec: any) => ({
        action: String(rec.action || ''),
        citationSource: rec.citationSource === 'directories' ? 'directories' : 'owned-site',
        focusArea: rec.focusArea === 'soa' ? 'soa' : rec.focusArea === 'sentiment' ? 'sentiment' : 'visibility',
        priority: rec.priority === 'High' ? 'High' : rec.priority === 'Low' ? 'Low' : 'Medium',
        effort: rec.effort === 'High' ? 'High' : rec.effort === 'Low' ? 'Low' : 'Medium',
        kpi: rec.kpi || 'Visibility Index',
        reason: rec.reason,
        explanation: rec.explanation || rec.reason,
        expectedBoost: rec.expectedBoost,
        timeline: rec.timeline || '2-4 weeks',
        confidence: typeof rec.confidence === 'number' ? rec.confidence : 55,
        focusSources: rec.focusSources,
        contentFocus: rec.contentFocus
      }));
    } catch (e) {
      console.error('❌ [RecommendationV3Service] Cold Start Personalization failed:', e);
      return templates;
    }
  }

  /**
   * Personalize Domain Readiness recommendations using AI
   * Transforms generic technical fix actions into brand-specific, actionable recommendations
   */
  private async personalizeDomainReadinessRecommendations(
    context: BrandContextV3,
    templates: RecommendationV3[]
  ): Promise<RecommendationV3[]> {
    if (templates.length === 0) return [];

    const systemMessage =
      'You are a senior technical SEO and AEO expert. You transform generic technical issue fix recommendations into concrete, brand-specific action items. Respond ONLY with valid JSON.';

    const templatesJson = JSON.stringify(
      templates.map(t => ({
        action: t.action,
        reason: t.reason,
        explanation: t.explanation,
        howToFix: t.howToFix,
        priority: t.priority,
        effort: t.effort
      })),
      null,
      2
    );

    const prompt = `Context:
- Brand: ${context.brandName}
- Industry: ${context.industry || 'Unknown'}
- Brand URL: ${context.domainAuditResult?.domain || 'Unknown'}
- Current Domain Readiness Score: ${context.domainAuditResult?.overallScore || 'Unknown'}/100

Task:
You will receive domain audit recommendations for technical issues. Improve them using these rules:
1) Make each action brand-specific by using the actual brand URL where appropriate (e.g., "Add Sitemap: https://${context.domainAuditResult?.domain || 'yourdomain.com'}/sitemap.xml")
2) Personalize the howToFix steps based on brand context (e.g., if it's an e-commerce site, mention product pages)
3) Provide realistic timeline and effort estimates based on the complexity for this specific brand
4) Keep the source as "domain_audit" and maintain the existing priority/effort unless you have strong reason to change
5) Make explanations more specific and actionable for this brand's industry
6) Return all recommendations - do not filter any out

Required fields for each recommendation:
- action: Brand-specific action (string)
- reason: Why this matters for the brand (string)  
- explanation: Detailed explanation with success criteria (string)
- howToFix: Array of step-by-step instructions personalized for this brand (string[])
- priority: "High" | "Medium" | "Low"
- effort: "Low" | "Medium" | "High"
- timeline: Realistic timeline (string like "1-2 weeks")
- confidence: 0-100 (number)

Original recommendations JSON:
${templatesJson}

Return ONLY a JSON array with the personalized recommendations.`;

    try {
      const parsed = await recommendationLLMService.executePrompt<any>(
        context.brandId,
        prompt,
        systemMessage
      );

      if (!parsed || parsed.length === 0) {
        return templates;
      }

      // Map personalized recommendations, preserving domain_audit source
      return parsed.map((rec: any, index: number) => ({
        action: String(rec.action || templates[index]?.action || ''),
        citationSource: 'owned-site',
        focusArea: 'visibility' as const,
        priority: rec.priority === 'High' ? 'High' : rec.priority === 'Low' ? 'Low' : 'Medium',
        effort: rec.effort === 'High' ? 'High' : rec.effort === 'Low' ? 'Low' : 'Medium',
        kpi: 'Technical Health',
        reason: rec.reason || templates[index]?.reason,
        explanation: rec.explanation || templates[index]?.explanation,
        expectedBoost: 'Technical Baseline',
        timeline: rec.timeline || templates[index]?.timeline || '1-2 weeks',
        confidence: typeof rec.confidence === 'number' ? rec.confidence : 90,
        focusSources: 'owned-site',
        contentFocus: 'Technical Optimization',
        source: 'domain_audit' as const,
        howToFix: Array.isArray(rec.howToFix) ? rec.howToFix : templates[index]?.howToFix || []
      }));

    } catch (e) {
      console.error('❌ [RecommendationV3Service] Domain Readiness Personalization failed:', e);
      return templates;
    }
  }

  /**
   * Gather brand context for KPI identification
   */
  private async gatherBrandContext(
    brandId: string,
    customerId: string
  ): Promise<BrandContextV3 | null> {
    // Delegate to Context Service
    return recommendationContextService.gatherContext(brandId, customerId);
  }



  /**
   * Generate recommendations based on Domain Readiness Audit
   */
  private generateDomainReadinessRecommendations(context: BrandContextV3): RecommendationV3[] {
    const audit = context.domainAuditResult;
    if (!audit) return [];

    const recommendations: RecommendationV3[] = [];

    // Thresholds
    const CRITICAL_SCORE_THRESHOLD = 50;
    const WARNING_SCORE_THRESHOLD = 70;

    // Helper to map audit issues to recommendations
    const mapTestsToRecs = (
      bucketName: string,
      bucketLabel: string,
      tests: TestResult[],
      kpiName: string
    ) => {
      // Filter for failed tests or warnings
      const issues = tests.filter(t => t.status === 'fail' || t.status === 'warning');

      issues.forEach(issue => {
        // Determine priority based on status and severity
        const priority = issue.status === 'fail' ? 'High' : 'Medium';

        // Get how-to-fix steps from resources
        const howToFix = getHowToFixSteps(issue.name);

        const rec: RecommendationV3 = {
          action: `Fix ${bucketLabel} Issue: ${issue.name}`,
          citationSource: 'owned-site', // Technical fixes are usually on owned site
          focusArea: 'visibility', // Technical issues usually affect visibility first
          priority: priority,
          effort: 'Medium', // Default to Medium, hard to estimate without more data
          kpi: kpiName,
          reason: `${bucketLabel} score is impacted by failing test: ${issue.name}`,
          explanation: issue.message || `The test "${issue.name}" failed during the domain audit. Addressing this will improve your ${bucketLabel} score and overall technical health.`,
          expectedBoost: 'Technical Baseline',
          timeline: '1-2 weeks',
          confidence: 90, // High confidence because it's based on a hard test result
          focusSources: 'owned-site',
          contentFocus: 'Technical Optimization',
          source: 'domain_audit', // Mark as domain audit recommendation
          howToFix: howToFix, // Include step-by-step fix instructions
          visibilityScore: context.visibilityIndex !== undefined ? String(Math.round(context.visibilityIndex)) : undefined,
          soa: context.shareOfAnswers !== undefined ? String(Math.round(context.shareOfAnswers * 10) / 10) : undefined,
          sentiment: context.sentimentScore !== undefined ? String(Math.round(context.sentimentScore * 100) / 100) : undefined
        };

        recommendations.push(rec);
      });
    };

    // Helper to check for critical failures regardless of score
    const hasCriticalFailures = (tests: TestResult[]) => {
      return tests.some(t => t.score === 0 || t.status === 'fail');
    };

    // 1. Technical Crawlability
    const techTests = audit.detailedResults.technicalCrawlability.tests;
    if (audit.scoreBreakdown.technicalCrawlability < WARNING_SCORE_THRESHOLD || hasCriticalFailures(techTests)) {
      mapTestsToRecs('technicalCrawlability', 'Technical Crawlability', techTests, 'Technical Health');
    }

    // 2. Content Quality
    const contentTests = audit.detailedResults.contentQuality.tests;
    if (audit.scoreBreakdown.contentQuality < WARNING_SCORE_THRESHOLD || hasCriticalFailures(contentTests)) {
      mapTestsToRecs('contentQuality', 'Content Quality', contentTests, 'Technical Health');
    }

    // 3. Semantic Structure
    const semanticTests = audit.detailedResults.semanticStructure.tests;
    if (audit.scoreBreakdown.semanticStructure < WARNING_SCORE_THRESHOLD || hasCriticalFailures(semanticTests)) {
      mapTestsToRecs('semanticStructure', 'Semantic Structure', semanticTests, 'Technical Health');
    }

    // 4. Accessibility & Brand
    const accessTests = audit.detailedResults.accessibilityAndBrand.tests;
    if (audit.scoreBreakdown.accessibilityAndBrand < WARNING_SCORE_THRESHOLD || hasCriticalFailures(accessTests)) {
      mapTestsToRecs('accessibilityAndBrand', 'Accessibility & Brand', accessTests, 'Technical Health');
    }

    // 5. AEO Optimization (High Priority - always check for failures)
    const aeoTests = audit.detailedResults.aeoOptimization.tests;
    mapTestsToRecs('aeoOptimization', 'AEO Optimization', aeoTests, 'Technical Health');

    console.log(`🔧 [RecommendationV3Service] Generated ${recommendations.length} domain readiness recommendation(s)`);

    // No limit - return all domain readiness recommendations
    return recommendations;
  }

  /**
   * Phase 1: Identify KPIs for the brand
   */


  /**
   * Generate recommendations directly (simplified prompt, no KPI identification)
   */
  private async generateRecommendationsDirect(
    context: BrandContextV3
  ): Promise<RecommendationV3[]> {
    try {
      const prompt = recommendationPromptService.constructRecommendationPrompt(context);
      const systemMessage = 'You are a Senior Marketing Strategist & AEO Expert. You provide confident, direct, and high-impact strategic advice. Avoid generic fluff. Connect every recommendation to the Voice of Customer data provided. Respond only with valid JSON arrays.';

      return await recommendationLLMService.executePrompt<RecommendationV3>(
        context.brandId,
        prompt,
        systemMessage,
        16000
      );
    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Main entry point for generating recommendations
   */
  async generateRecommendations(
    brandId: string,
    customerId: string
  ): Promise<RecommendationV3Response> {
    console.log(`📊 [RecommendationV3Service] Generating recommendations for brand: ${brandId}`);

    // Check if Ollama is enabled for this brand
    const useOllama = await shouldUseOllama(brandId);
    if (useOllama) {
      console.log('📊 [RecommendationV3Service] Using Ollama as primary provider (OpenRouter → Cerebras as fallback)');
    } else {
      console.log('📊 [RecommendationV3Service] Using OpenRouter as primary provider (Cerebras as fallback)');
    }

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

      const flags = this.getFeatureFlags();
      context._dataMaturity = this.computeDataMaturity(context);
      console.log(`🧪 [RecommendationV3Service] Data maturity: ${context._dataMaturity}`);

      // Step 1.5: Fetch latest Domain Readiness audit
      console.log('📊 [RecommendationV3Service] Fetching Domain Readiness audit...');
      let latestAudit = await domainReadinessService.getLatestAudit(brandId);

      // Check if audit is stale (older than 90 days)
      if (latestAudit) {
        const auditDate = new Date(latestAudit.timestamp);
        const daysSinceAudit = (Date.now() - auditDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceAudit > 90) {
          console.log(`⚠️ [RecommendationV3Service] Domain Readiness audit is stale (${Math.round(daysSinceAudit)} days old) - ignoring for filtering`);
          latestAudit = null; // Don't use stale audit
        } else {
          console.log(`✅ [RecommendationV3Service] Found Domain Readiness audit (score: ${latestAudit.overallScore}/100, date: ${latestAudit.timestamp}, ${Math.round(daysSinceAudit)} days old)`);
        }
      } else {
        console.log('⚠️ [RecommendationV3Service] No Domain Readiness audit found - recommendations will not be filtered');
      }

      // Step 2: Generate recommendations (Parallel Execution)
      let recommendations: RecommendationV3[] = [];
      const kpis: IdentifiedKPI[] = []; // Kept for interface compatibility

      let strategicRecs: RecommendationV3[] = [];
      let domainRecs: RecommendationV3[] = [];

      console.log('🚀 [RecommendationV3Service] Starting parallel recommendation generation (Strategic + Technical)...');
      const genStartTime = Date.now();

      // Define the strategic generation promise
      const strategicPromise = (async () => {
        if (flags.coldStartMode && context._dataMaturity === 'cold_start') {
          console.log('🧊 [RecommendationV3Service] Generating strategic recommendations (Cold Start templates)...');
          const templates = generateColdStartRecommendations({ brandName: context.brandName, industry: context.industry });
          return await this.personalizeColdStartRecommendations(context, templates);
        } else {
          console.log('📝 [RecommendationV3Service] Generating strategic recommendations (LLM)...');
          return await this.generateRecommendationsDirect(context);
        }
      })();

      // Define the domain readiness promise
      const domainPromise = (async () => {
        if (context.domainAuditResult) {
          console.log('🔧 [RecommendationV3Service] Generating Domain Readiness recommendations...');
          const rawRecs = this.generateDomainReadinessRecommendations(context);
          if (rawRecs.length > 0) {
            // Optimization: Limit to top 8 unique technical issues to avoid context overflow/timeouts
            // (Deduplicate mainly by action name if needed, but here simple slice is safest for speed)
            const limitedRecs = rawRecs.slice(0, 8);
            if (rawRecs.length > 8) {
              console.log(`   ✂️ Capped technical recommendations to 8 (found ${rawRecs.length}) for faster personalization.`);
            }
            console.log(`   🤖 Personalizing ${limitedRecs.length} technical recommendations...`);
            return await this.personalizeDomainReadinessRecommendations(context, limitedRecs);
          }
          console.log('   ✨ No domain readiness recommendations to process.');
        }
        return [];
      })();

      // Execute in parallel
      try {
        [strategicRecs, domainRecs] = await Promise.all([strategicPromise, domainPromise]);
      } catch (err) {
        console.error('❌ [RecommendationV3Service] Parallel generation failed, attempting partial recovery:', err);
        // Best effort: if one failed, try to return what we have? 
        // For now, simpler to just log and rely on initialized empty arrays if individual promises caught errors internally 
        // (but purely internal handlers in direct/personalize methods usually catch errors)
      }

      console.log(`✅ [RecommendationV3Service] Parallel generation completed in ${Date.now() - genStartTime}ms`);

      // Merge results (Technical first, then Strategic)
      recommendations = [...domainRecs, ...strategicRecs];
      if (recommendations.length === 0) {
        console.error(`❌ [RecommendationV3Service] Total recommendations generated is 0!`);
      }

      // Unified post-processing (competitor safety, quality contract, deterministic ranking)
      console.log(`📊 [RecommendationV3Service] Before post-processing: ${recommendations.length} recommendation(s)`);
      recommendations = this.postProcessRecommendations(context, recommendations);
      console.log(`📊 [RecommendationV3Service] After post-processing: ${recommendations.length} recommendation(s)`);

      // Step 2.5: Filter recommendations based on Domain Readiness (if enabled)
      if (latestAudit) {
        if (flags.domainReadinessFilter) {
          const beforeFilter = recommendations.length;
          recommendations = recommendations.filter(rec =>
            !shouldFilterRecommendation(rec, latestAudit)
          );
          const filteredCount = beforeFilter - recommendations.length;
          if (filteredCount > 0) {
            console.log(`🚫 [RecommendationV3Service] Filtered ${filteredCount} recommendation(s) based on Domain Readiness audit`);
          }
        } else {
          console.log(`⏭️ [RecommendationV3Service] Domain Readiness filtering disabled (RECS_V3_DOMAIN_FILTER != 'true')`);
        }

        // Enhance priority for recommendations addressing readiness gaps
        recommendations = recommendations.map(rec =>
          enhanceRecommendationWithReadiness(rec, latestAudit)
        );
      }

      if (recommendations.length === 0) {
        console.error(`❌ [RecommendationV3Service] All recommendations were filtered out during post-processing`);
        console.error(`   - Data maturity: ${context._dataMaturity}`);
        console.error(`   - Feature flags:`, flags);
        return {
          success: false,
          kpis: [],
          recommendations: [],
          message: 'No recommendations generated at this time. All recommendations were filtered out during post-processing.'
        };
      }

      // Step 3: Prepare KPIs (Inject "Technical Health" if needed)
      const hasTechnicalRecs = recommendations.some(r => r.kpi === 'Technical Health');

      if (hasTechnicalRecs) {
        console.log('🔧 [RecommendationV3Service] Injecting "Technical Health" KPI for Domain Readiness recommendations');
        kpis.push({
          kpiName: 'Technical Health',
          kpiDescription: 'Technical foundation and site health based on Domain Readiness Audit',
          displayOrder: 0,
          currentValue: context.domainAuditResult?.overallScore || 0,
          targetValue: 100
        });
      }

      // Step 3b: Save to database (now passing synthesized KPIs) - this will add IDs to recommendations
      const generationId = await this.saveToDatabase(brandId, customerId, kpis, recommendations, context);

      if (!generationId) {
        return {
          success: false,
          kpis: [],
          recommendations: [],
          message: 'Failed to save recommendations to database.'
        };
      }

      return {
        success: true,
        kpis: kpis,
        recommendations: recommendations,
        message: 'Recommendations generated successfully.',
        generationId: generationId,
        dataMaturity: context._dataMaturity,
        generatedAt: new Date().toISOString(),
        brandId: brandId,
        brandName: context.brandName
      };



    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error:', error);
      return {
        success: false,
        kpis: [],
        recommendations: [],
        message: 'Failed to generate recommendations.'
      };
    }
  }

  /**
   * Save KPIs and recommendations to database
   */
  private async saveToDatabase(
    brandId: string,
    customerId: string,
    kpis: IdentifiedKPI[],
    recommendations: RecommendationV3[],
    context: BrandContextV3
  ): Promise<string | null> {
    try {
      // Create generation record
      const { data: generation, error: genError } = await supabaseAdmin
        .from('recommendation_generations')
        .insert({
          brand_id: brandId,
          customer_id: customerId,
          problems_detected: 0, // V3 doesn't use problem detection
          recommendations_count: recommendations.length,
          diagnostics_count: 0,
          status: 'completed',
          metadata: {
            version: 'v3',
            brandName: context.brandName,
            industry: context.industry,
            dataMaturity: context._dataMaturity
          }
        })
        .select('id')
        .single();

      if (genError || !generation) {
        console.error('❌ [RecommendationV3Service] Error creating generation:', genError);
        return null;
      }

      const generationId = generation.id;

      // Save KPIs (only if provided)
      let kpiIdMap = new Map<string, string>();
      if (kpis.length > 0) {
        const kpisToInsert = kpis.map((kpi, index) => ({
          generation_id: generationId,
          brand_id: brandId,
          customer_id: customerId,
          kpi_name: kpi.kpiName,
          kpi_description: kpi.kpiDescription,
          current_value: kpi.currentValue ?? null,
          target_value: kpi.targetValue ?? null,
          display_order: index
        }));

        const { data: insertedKpis, error: kpiError } = await supabaseAdmin
          .from('recommendation_v3_kpis')
          .insert(kpisToInsert)
          .select('id');

        if (kpiError) {
          console.error('❌ [RecommendationV3Service] Error inserting KPIs:', kpiError);
          return null;
        }

        // Map KPI IDs to recommendations
        kpis.forEach((kpi, idx) => {
          if (insertedKpis && insertedKpis[idx]) {
            kpiIdMap.set(kpi.kpiName, insertedKpis[idx].id);
          }
        });
      }

      // LAYER 2: Final validation before database save (extra safety net)
      const exclusionList = context._competitorExclusionList || {
        names: new Set<string>(),
        domains: new Set<string>(),
        nameVariations: new Set<string>(),
        baseDomains: new Set<string>()
      };

      const { filtered: finalRecommendations, removed: finalRemoved } = filterCompetitorRecommendations(
        recommendations,
        exclusionList,
        { allowTextMentions: true } // Allow strategic comparisons in text, but valid source filtering is strictly enforced by Source Safe List
      );

      if (finalRemoved.length > 0) {
        console.error(`🚫 [RecommendationV3Service] Layer 2 final validation: Removed ${finalRemoved.length} recommendation(s) before database save`);
        finalRemoved.forEach(({ reason }) => {
          console.error(`   - ${reason}`);
        });
      }

      const flags = this.getFeatureFlags();
      let finalForInsert = finalRecommendations;

      // Final quality gate (deterministic). We don't re-rank here; ranking is handled earlier.
      if (flags.qualityContract) {
        const { kept, removed } = filterLowQualityRecommendationsV3(finalForInsert);
        if (removed.length > 0) {
          console.warn(`⚠️ [RecommendationV3Service] Final quality gate removed ${removed.length} recommendation(s) before database save`);
          removed.slice(0, 10).forEach(r => {
            console.warn(`   - Removed: "${r.recommendation.action?.substring(0, 80)}..." Reasons: ${r.reasons.join('; ')}`);
          });
        }
        finalForInsert = kept;
      }

      if (finalForInsert.length === 0) {
        console.error('❌ [RecommendationV3Service] All recommendations were filtered out before database save');
        console.error(`   - Started with ${recommendations.length} recommendation(s)`);
        console.error(`   - After competitor filter: ${finalRecommendations.length} recommendation(s)`);
        console.error(`   - After quality filter: ${finalForInsert.length} recommendation(s)`);
        console.error(`   - Data maturity: ${context._dataMaturity}`);
        console.error(`   - Feature flags:`, flags);
        return null;
      }

      console.log(`💾 [RecommendationV3Service] Saving ${finalForInsert.length} recommendation(s) to database (started with ${recommendations.length})`);

      // Save recommendations (only the filtered ones)
      const recommendationsToInsert = finalForInsert.map((rec, index) => {
        const kpiId = rec.kpi ? kpiIdMap.get(rec.kpi) : null;

        return {
          generation_id: generationId,
          brand_id: brandId,
          customer_id: customerId,
          action: rec.action,
          reason: rec.reason || rec.action,
          explanation: rec.explanation || rec.reason || rec.action,
          citation_source: rec.citationSource,
          impact_score: rec.impactScore ? String(rec.impactScore) : null,
          mention_rate: rec.mentionRate ? String(rec.mentionRate) : null,
          soa: rec.soa ? String(rec.soa) : null,
          sentiment: rec.sentiment ? String(rec.sentiment) : null,
          visibility_score: rec.visibilityScore ? String(rec.visibilityScore) : null,
          citation_count: rec.citationCount || 0,
          focus_sources: rec.focusSources || rec.citationSource,
          content_focus: rec.contentFocus || rec.action,
          kpi: rec.kpi || 'Unknown',
          expected_boost: rec.expectedBoost || 'TBD',
          effort: rec.effort,
          timeline: rec.timeline || '2-4 weeks',
          confidence: rec.confidence || 70,
          priority: rec.priority,
          focus_area: rec.focusArea,
          calculated_score: rec.calculatedScore ?? null,
          display_order: index,
          kpi_id: kpiId,
          is_approved: false,
          is_content_generated: false,
          is_completed: false
        };
      });

      const { data: insertedRecommendations, error: recError } = await supabaseAdmin
        .from('recommendations')
        .insert(recommendationsToInsert)
        .select('id');

      if (recError) {
        console.error('❌ [RecommendationV3Service] Error inserting recommendations:', recError);
        return null;
      }

      // Map database IDs back to recommendations (use finalRecommendations, not original recommendations)
      if (insertedRecommendations && insertedRecommendations.length === finalForInsert.length) {
        for (let i = 0; i < finalForInsert.length; i++) {
          if (insertedRecommendations[i]?.id) {
            finalForInsert[i].id = insertedRecommendations[i].id;
            console.log(`✅ [RecommendationV3Service] Mapped ID ${insertedRecommendations[i].id} to recommendation ${i + 1}`);
          }
        }

        // Also update the original recommendations array for return value
        // Find matching recommendations and update their IDs
        finalForInsert.forEach((finalRec, idx) => {
          const originalIdx = recommendations.findIndex(r =>
            r.action === finalRec.action &&
            r.citationSource === finalRec.citationSource
          );
          if (originalIdx >= 0 && insertedRecommendations[idx]?.id) {
            recommendations[originalIdx].id = insertedRecommendations[idx].id;
          }
        });
      } else {
        console.warn(`⚠️ [RecommendationV3Service] ID count mismatch: ${insertedRecommendations?.length || 0} inserted vs ${finalForInsert.length} recommendations`);
      }

      console.log(`💾 [RecommendationV3Service] Saved ${kpis.length} KPIs and ${finalForInsert.length} recommendations (${recommendations.length - finalForInsert.length} filtered out)`);
      return generationId;

    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error saving to database:', error);
      return null;
    }
  }
}

export const recommendationV3Service = new RecommendationV3Service();
