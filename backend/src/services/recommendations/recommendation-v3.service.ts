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
import {
  shouldFilterRecommendation,
  getReadinessContext,
  enhanceRecommendationWithReadiness
} from './domain-readiness-filter.service';
import { getHowToFixSteps } from './domain-readiness-resources';
import { AeoAuditResult, BotAccessStatus, TestResult } from '../domain-readiness/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Identified KPI for a brand
 */
export interface IdentifiedKPI {
  id?: string;              // Database id (present when loaded from DB)
  kpiName: string;          // e.g., "Visibility Index", "SOA %", "Sentiment Score"
  kpiDescription: string;    // Why this KPI matters for this brand
  currentValue?: number;     // Current KPI value
  targetValue?: number;      // Target/improved value
  displayOrder: number;      // Order in which KPIs should be displayed
}

/**
 * Recommendation for V3 (simplified structure)
 */
export interface RecommendationV3 {
  id?: string;
  action: string;           // What to do
  citationSource: string;   // Source/domain
  focusArea: 'visibility' | 'soa' | 'sentiment';
  priority: 'High' | 'Medium' | 'Low';
  effort: 'Low' | 'Medium' | 'High';
  kpiId?: string;           // Links to identified KPI
  kpi?: string;             // KPI name (for display)

  // Additional fields (stored but not shown in simplified table)
  reason?: string;
  explanation?: string;
  impactScore?: string;
  mentionRate?: string;
  soa?: string;
  sentiment?: string;
  visibilityScore?: string;
  citationCount?: number;
  focusSources?: string;
  contentFocus?: string;
  expectedBoost?: string;
  timeline?: string;
  confidence?: number;
  calculatedScore?: number; // Deterministic ranking score (stored in DB as calculated_score)

  // Workflow flags
  isApproved?: boolean;
  isContentGenerated?: boolean;
  isCompleted?: boolean;
  completedAt?: string;
  kpiBeforeValue?: number;
  kpiAfterValue?: number;

  // Source tracking
  source?: 'domain_audit' | 'ai_generated';
  howToFix?: string[];  // Step-by-step fix instructions (for domain audit recs)

  // Strategic classification (filled by ranking service)
  strategicRole?: 'Battleground' | 'Stronghold' | 'Opportunity' | 'Standard';
}

/**
 * Response from V3 recommendation service
 */
export interface RecommendationV3Response {
  success: boolean;
  generationId?: string;
  dataMaturity?: 'cold_start' | 'low_data' | 'normal';
  kpis: IdentifiedKPI[];
  recommendations: RecommendationV3[];
  message?: string;
  generatedAt?: string;
  brandId?: string;
  brandName?: string;
}

/**
 * Brand context for KPI identification
 */
export interface BrandContextV3 {
  brandId: string;
  brandName: string;
  brandDomain?: string;      // Brand's own domain (for competitor filter whitelist)
  brandSummary?: string;
  industry?: string;
  visibilityIndex?: number;
  shareOfAnswers?: number;
  sentimentScore?: number;
  trends?: {
    visibility?: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
    soa?: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
    sentiment?: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
  };
  competitors?: Array<{
    name: string;
    visibilityIndex?: number;
    shareOfAnswers?: number;
    sentimentScore?: number;
  }>;
  sourceMetrics?: Array<{
    domain: string;
    mentionRate: number;
    soa: number;
    sentiment: number;
    citations: number;
    impactScore: number;
    visibility: number;
    topCompetitor?: {
      name: string;
      soa: number;
      sentiment: number;
    };
  }>;
  // Internal fields for competitor filtering (not exposed in prompt)
  _competitorExclusionList?: CompetitorExclusionList;
  _competitorAvgMetrics?: {
    visibility?: number;
    soa?: number;
    sentiment?: number;
    count: number;
  };
  // Internal: data maturity classification (computed)
  _dataMaturity?: 'cold_start' | 'low_data' | 'normal';

  // Domain Readiness Audit Result
  domainAuditResult?: AeoAuditResult | null;

  // Qualitative Context (from Consolidated Analysis)
  topKeywords?: Array<{ keyword: string; count: number }>;
  strategicNarrative?: string;
  keyQuotes?: string[];

  // Phase 7: Graph Insights
  graphInsights?: {
    opportunityGaps: Array<{
      topic: string;
      score: number;
      context: string;
      evidence: string[];
    }>;
  };
}

type CerebrasChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

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
    const visibility = this.normalizePercent(context.visibilityIndex ?? null); // 0-100
    const soa = this.normalizePercent(context.shareOfAnswers ?? null); // 0-100
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
    const competitorFilterResult = filterCompetitorRecommendations(recs, exclusionList);
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

    const systemMessage =
      'You are a senior marketing consultant and AEO expert. You transform baseline tasks into concrete, high-quality recommendations. Respond ONLY with valid JSON.';

    const templatesJson = JSON.stringify(
      templates.map(t => ({
        action: t.action,
        citationSource: t.citationSource,
        focusArea: t.focusArea,
        priority: t.priority,
        effort: t.effort,
        kpi: t.kpi,
        reason: t.reason,
        explanation: t.explanation,
        expectedBoost: t.expectedBoost,
        timeline: t.timeline,
        confidence: t.confidence,
        focusSources: t.focusSources,
        contentFocus: t.contentFocus
      })),
      null,
      2
    );

    const prompt = `Context:
- Brand: ${context.brandName}
- Industry: ${context.industry || 'Unknown'}
- Brand summary: ${context.brandSummary || 'Unknown'}
- Data maturity: cold_start

Task:
You will receive baseline cold-start recommendations. Improve them using these rules:
1) If the brand is likely established or already has the basics, DO NOT output naive "create pricing page" style items. Instead rewrite as "audit/verify/optimize" with concrete checks.
2) Remove any items that are clearly redundant for an established brand (but keep if uncertain and rewrite as an audit).
3) Rewrite each kept recommendation into a concrete deliverable (specific page names, outlines, checklist steps, directory copy bullets).
4) Add explicit success criteria inside explanation (what to measure, and when).
5) Keep citationSource as one of: "owned-site" | "directories"
6) Keep fields: action, citationSource, focusArea, priority, effort, kpi, reason, explanation, expectedBoost, timeline, confidence, focusSources, contentFocus
7) Output 5-10 recommendations max. Return ONLY a JSON array.

Baseline recommendations JSON:
${templatesJson}`;

    // Call provider (Ollama → OpenRouter → Cerebras), similar to generateRecommendationsDirect
    let content: string | null = null;

    const useOllama = await shouldUseOllama(context.brandId);
    if (useOllama) {
      try {
        console.log('🦙 [RecommendationV3Service] Personalization: attempting Ollama...');
        const ollamaResponse = await callOllamaAPI(systemMessage, prompt, context.brandId);
        content = ollamaResponse || null;
      } catch (e: any) {
        console.error('❌ [RecommendationV3Service] Personalization Ollama failed:', e.message || e);
      }
    }

    if (!content) {
      try {
        console.log('🚀 [RecommendationV3Service] Personalization: attempting OpenRouter...');
        const or = await openRouterCollectorService.executeQuery({
          collectorType: 'content',
          prompt,
          maxTokens: 2500,
          temperature: 0.3,
          topP: 0.9,
          enableWebSearch: false
        });
        content = or.response || null;
      } catch (e: any) {
        console.error('❌ [RecommendationV3Service] Personalization OpenRouter failed:', e.message || e);
      }
    }

    if (!content && this.cerebrasApiKey) {
      try {
        console.log('🔄 [RecommendationV3Service] Personalization: trying Cerebras fallback...');
        const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.cerebrasApiKey}`
          },
          body: JSON.stringify({
            model: this.cerebrasModel,
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: prompt }
            ],
            max_tokens: 2500,
            temperature: 0.3
          })
        });
        if (response.ok) {
          const data = (await response.json()) as CerebrasChatResponse;
          content = data?.choices?.[0]?.message?.content || null;
        }
      } catch (e) {
        console.error('❌ [RecommendationV3Service] Personalization Cerebras failed:', e);
      }
    }

    if (!content) {
      console.warn('⚠️ [RecommendationV3Service] Personalization LLM call failed, returning original templates');
      return templates;
    }

    // Parse JSON array (reuse the same robust cleaning approach used elsewhere in this service)
    console.log('📝 [RecommendationV3Service] Personalization response (first 500 chars):', content.substring(0, 500));

    let cleaned = content.trim();

    // Remove markdown code blocks
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    // Try to extract JSON array if there's extra text
    let jsonStart = cleaned.indexOf('[');
    let jsonEnd = cleaned.lastIndexOf(']');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    // Try parsing
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('❌ [RecommendationV3Service] Personalization JSON parse error. Attempting to fix...');
      console.error('Cleaned content (first 1000 chars):', cleaned.substring(0, 1000));

      // Try to fix common JSON issues
      // Remove trailing commas before closing brackets
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

      // Fix extra closing braces before closing bracket
      cleaned = cleaned.replace(/\}\s*\}\s*\]/g, '}]');
      cleaned = cleaned.replace(/(\})\s*\}(\s*\])/g, '$1$2');

      // Try to extract just the array part more aggressively
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        cleaned = arrayMatch[0];
      }

      // Final cleanup: remove any standalone closing braces before ]
      const lastBraceIndex = cleaned.lastIndexOf('}');
      const lastBracketIndex = cleaned.lastIndexOf(']');
      if (lastBraceIndex !== -1 && lastBracketIndex !== -1 && lastBraceIndex < lastBracketIndex) {
        const beforeBracket = cleaned.substring(lastBraceIndex, lastBracketIndex);
        const braceCount = (beforeBracket.match(/\}/g) || []).length;
        if (braceCount > 1) {
          cleaned = cleaned.substring(0, lastBraceIndex) +
            cleaned.substring(lastBraceIndex).replace(/\}/g, '').replace(/\]/, '}]');
        }
      }

      try {
        parsed = JSON.parse(cleaned);
      } catch (secondError) {
        console.error('❌ [RecommendationV3Service] Failed to parse personalization JSON after fixes:', secondError);
        console.error('Cleaned content (last 200 chars):', cleaned.substring(Math.max(0, cleaned.length - 200)));
        console.warn('⚠️ [RecommendationV3Service] Returning original templates due to JSON parse failure');
        return templates;
      }
    }

    if (!Array.isArray(parsed)) {
      console.warn('⚠️ [RecommendationV3Service] Personalization returned non-array, returning original templates');
      return templates;
    }

    if (parsed.length === 0) {
      console.warn('⚠️ [RecommendationV3Service] Personalization returned empty array, returning original templates');
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

    let content: string | null = null;

    // Try Ollama first (if enabled for this brand)
    const useOllama = await shouldUseOllama(context.brandId);
    if (useOllama) {
      try {
        console.log('🦙 [RecommendationV3Service] Domain Readiness Personalization: attempting Ollama...');
        const ollamaResponse = await callOllamaAPI(systemMessage, prompt, context.brandId);
        content = ollamaResponse || null;
      } catch (e: any) {
        console.error('❌ [RecommendationV3Service] Domain Readiness Personalization Ollama failed:', e.message || e);
      }
    }

    if (!content) {
      try {
        console.log('🚀 [RecommendationV3Service] Domain Readiness Personalization: attempting OpenRouter...');
        const or = await openRouterCollectorService.executeQuery({
          collectorType: 'content',
          prompt,
          maxTokens: 3000,
          temperature: 0.3,
          topP: 0.9,
          enableWebSearch: false
        });
        content = or.response || null;
      } catch (e: any) {
        console.error('❌ [RecommendationV3Service] Domain Readiness Personalization OpenRouter failed:', e.message || e);
      }
    }

    if (!content && this.cerebrasApiKey) {
      try {
        console.log('🔄 [RecommendationV3Service] Domain Readiness Personalization: trying Cerebras fallback...');
        const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.cerebrasApiKey}`
          },
          body: JSON.stringify({
            model: this.cerebrasModel,
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: prompt }
            ],
            max_tokens: 3000,
            temperature: 0.3
          })
        });
        if (response.ok) {
          const data = (await response.json()) as CerebrasChatResponse;
          content = data?.choices?.[0]?.message?.content || null;
        }
      } catch (e) {
        console.error('❌ [RecommendationV3Service] Domain Readiness Personalization Cerebras failed:', e);
      }
    }

    if (!content) {
      console.warn('⚠️ [RecommendationV3Service] Domain Readiness Personalization LLM call failed, returning original templates');
      return templates;
    }

    // Parse JSON response
    console.log('📝 [RecommendationV3Service] Domain Readiness Personalization response (first 500 chars):', content.substring(0, 500));

    let cleaned = content.trim();

    // Remove markdown code blocks
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    // Extract JSON array
    let jsonStart = cleaned.indexOf('[');
    let jsonEnd = cleaned.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('❌ [RecommendationV3Service] Domain Readiness Personalization JSON parse error');
      return templates;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn('⚠️ [RecommendationV3Service] Domain Readiness Personalization returned invalid/empty array');
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
  }

  /**
   * Normalize a metric that may be in 0-1 or 0-100 to a 0-100 display scale
   */
  private normalizePercent(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const scaled = value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, Math.round(scaled * 10) / 10));
  }

  /**
   * Gather brand context for KPI identification
   */
  private async gatherBrandContext(
    brandId: string,
    customerId: string
  ): Promise<BrandContextV3 | null> {
    try {
      // Get brand info (including homepage_url for domain extraction)
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name, industry, summary, homepage_url')
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .single();

      if (brandError || !brand) {
        console.error('❌ [RecommendationV3Service] Brand not found:', brandError);
        return null;
      }

      // Extract brand domain from homepage_url
      let brandDomain: string | undefined;
      if (brand.homepage_url) {
        try {
          // Handle both full URLs and domain-only formats
          const url = brand.homepage_url.startsWith('http')
            ? new URL(brand.homepage_url)
            : new URL(`https://${brand.homepage_url}`);
          brandDomain = url.hostname.replace(/^www\./, '');
          console.log(`🏷️ [RecommendationV3Service] Brand domain extracted: ${brandDomain} (from ${brand.homepage_url})`);
        } catch (e) {
          // Fallback: use homepage_url directly if URL parsing fails
          brandDomain = brand.homepage_url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
          console.log(`🏷️ [RecommendationV3Service] Brand domain extracted (fallback): ${brandDomain}`);
        }
      } else {
        console.warn(`⚠️ [RecommendationV3Service] No homepage_url found for brand ${brandId}, brand whitelist may not work correctly`);
      }

      // Date ranges: Current period (last 30 days) and Previous period (days 31-60)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const currentStartDate = thirtyDaysAgo.toISOString().split('T')[0];
      const currentEndDate = new Date().toISOString().split('T')[0];
      const previousStartDate = sixtyDaysAgo.toISOString().split('T')[0];
      const previousEndDate = thirtyDaysAgo.toISOString().split('T')[0];

      // Initialize feature flag and helper
      const USE_OPTIMIZED_RECOMMENDATIONS = process.env.USE_OPTIMIZED_RECOMMENDATIONS_V3 === 'true';
      const optimizedMetricsHelper = new OptimizedMetricsHelper(supabaseAdmin);

      if (USE_OPTIMIZED_RECOMMENDATIONS) {
        console.log('   ⚡ [Recommendations V3] Using optimized queries (metric_facts + brand_metrics)');
      } else {
        console.log('   📋 [Recommendations V3] Using legacy queries (extracted_positions)');
      }

      // ========================================
      // 1. OVERALL BRAND METRICS (Current Period)
      // ========================================
      let visibilityIndex: number | undefined;
      let shareOfAnswers: number | undefined;
      let sentimentScore: number | undefined;

      if (USE_OPTIMIZED_RECOMMENDATIONS) {
        const result = await optimizedMetricsHelper.fetchBrandMetricsByDateRange({
          brandId,
          customerId,
          startDate: currentStartDate,
          endDate: currentEndDate,
          includeSentiment: true,
        });

        if (result.success && result.data.length > 0) {
          const validVis = result.data.filter(m => m.visibility_index != null);
          const validSoa = result.data.filter(m => m.share_of_answers != null);
          const validSent = result.data.filter(m => m.sentiment_score != null);

          if (validVis.length > 0) {
            visibilityIndex = validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length;
          }
          if (validSoa.length > 0) {
            shareOfAnswers = validSoa.reduce((sum, m) => sum + (m.share_of_answers || 0), 0) / validSoa.length;
          }
          if (validSent.length > 0) {
            sentimentScore = validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length;
          }
        }
      } else {
        const { data: overallMetrics } = await supabaseAdmin
          .from('extracted_positions')
          .select('visibility_index, share_of_answers_brand, sentiment_score')
          .eq('brand_id', brandId)
          .gte('created_at', currentStartDate)
          .lte('created_at', currentEndDate);

        if (overallMetrics && overallMetrics.length > 0) {
          const validVis = overallMetrics.filter(m => m.visibility_index != null);
          const validSoa = overallMetrics.filter(m => m.share_of_answers_brand != null);
          const validSent = overallMetrics.filter(m => m.sentiment_score != null);

          if (validVis.length > 0) {
            visibilityIndex = validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length;
          }
          if (validSoa.length > 0) {
            shareOfAnswers = validSoa.reduce((sum, m) => sum + (m.share_of_answers_brand || 0), 0) / validSoa.length;
          }
          if (validSent.length > 0) {
            sentimentScore = validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length;
          }
        }
      }

      // ========================================
      // 1B. OVERALL BRAND METRICS (Previous Period) - For Trend Analysis
      // ========================================
      let prevVisibilityIndex: number | undefined;
      let prevShareOfAnswers: number | undefined;
      let prevSentimentScore: number | undefined;

      if (USE_OPTIMIZED_RECOMMENDATIONS) {
        const result = await optimizedMetricsHelper.fetchBrandMetricsByDateRange({
          brandId,
          customerId,
          startDate: previousStartDate,
          endDate: previousEndDate,
          includeSentiment: true,
        });

        if (result.success && result.data.length > 0) {
          const validVis = result.data.filter(m => m.visibility_index != null);
          const validSoa = result.data.filter(m => m.share_of_answers != null);
          const validSent = result.data.filter(m => m.sentiment_score != null);

          if (validVis.length > 0) {
            prevVisibilityIndex = validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length;
          }
          if (validSoa.length > 0) {
            prevShareOfAnswers = validSoa.reduce((sum, m) => sum + (m.share_of_answers || 0), 0) / validSoa.length;
          }
          if (validSent.length > 0) {
            prevSentimentScore = validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length;
          }
        }
      } else {
        const { data: previousMetrics } = await supabaseAdmin
          .from('extracted_positions')
          .select('visibility_index, share_of_answers_brand, sentiment_score')
          .eq('brand_id', brandId)
          .gte('created_at', previousStartDate)
          .lte('created_at', previousEndDate);

        if (previousMetrics && previousMetrics.length > 0) {
          const validVis = previousMetrics.filter(m => m.visibility_index != null);
          const validSoa = previousMetrics.filter(m => m.share_of_answers_brand != null);
          const validSent = previousMetrics.filter(m => m.sentiment_score != null);

          if (validVis.length > 0) {
            prevVisibilityIndex = validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length;
          }
          if (validSoa.length > 0) {
            prevShareOfAnswers = validSoa.reduce((sum, m) => sum + (m.share_of_answers_brand || 0), 0) / validSoa.length;
          }
          if (validSent.length > 0) {
            prevSentimentScore = validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length;
          }
        }
      }

      // Calculate trends
      const calculateTrend = (current: number | undefined, previous: number | undefined) => {
        if (current === undefined || previous === undefined || previous === 0) return undefined;
        const changePercent = ((current - previous) / previous) * 100;
        const direction: 'up' | 'down' | 'stable' = Math.abs(changePercent) < 2 ? 'stable' : (changePercent > 0 ? 'up' : 'down');
        return {
          current,
          previous,
          changePercent: Math.round(changePercent * 10) / 10,
          direction
        };
      };

      const trends = {
        visibility: calculateTrend(visibilityIndex, prevVisibilityIndex),
        soa: calculateTrend(shareOfAnswers, prevShareOfAnswers),
        sentiment: calculateTrend(sentimentScore, prevSentimentScore)
      };

      // Get competitors from brand_competitors (new schema)
      // Fetch with metadata to get domains for filtering
      // Note: brand_competitors doesn't have is_active column, so we fetch all competitors
      const { data: competitors, error: competitorError } = await supabaseAdmin
        .from('brand_competitors')
        .select('id, competitor_name, competitor_url, metadata')
        .eq('brand_id', brandId)
        .order('priority', { ascending: true })
        .limit(10); // Increased limit to catch more competitors

      if (competitorError) {
        console.error(`❌ [RecommendationV3Service] Error fetching competitors:`, competitorError);
      }

      // Debug: Log raw competitor data
      if (competitors && competitors.length > 0) {
        console.log(`🔍 [RecommendationV3Service] Found ${competitors.length} active competitor(s):`);
        competitors.forEach((comp, idx) => {
          const domain = comp.metadata?.domain || (comp.competitor_url ? new URL(comp.competitor_url).hostname.replace(/^www\./, '') : 'N/A');
          console.log(`   ${idx + 1}. ${comp.competitor_name} - URL: ${comp.competitor_url || 'N/A'}, Domain: ${domain}, Metadata: ${JSON.stringify(comp.metadata)}`);
        });
      } else {
        console.warn(`⚠️ [RecommendationV3Service] No active competitors found for brand ${brandId}`);
      }

      // Build competitor exclusion list for filtering (Layer 1: Pre-generation filtering)
      // Pass brand domain and name to whitelist them from being flagged as competitors
      const competitorExclusionList = competitors && competitors.length > 0
        ? buildCompetitorExclusionList(competitors, brandDomain, brand.name)
        : {
          names: new Set<string>(),
          domains: new Set<string>(),
          nameVariations: new Set<string>(),
          baseDomains: new Set<string>(),
          brandDomain: brandDomain,
          brandName: brand.name
        };

      if (competitors && competitors.length > 0) {
        console.log(`🚫 [RecommendationV3Service] Built competitor exclusion list: ${competitors.length} competitors`);
        console.log(`   - Competitor names: ${Array.from(competitorExclusionList.names).join(', ') || 'N/A'}`);
        console.log(`   - Competitor domains: ${Array.from(competitorExclusionList.domains).join(', ') || 'N/A'}`);
        console.log(`   - Competitor name variations: ${Array.from(competitorExclusionList.nameVariations).slice(0, 10).join(', ') || 'N/A'}`);
      } else {
        console.warn(`⚠️ [RecommendationV3Service] Competitor exclusion list is EMPTY - no competitors found or no domains stored`);
      }

      const competitorData: BrandContextV3['competitors'] = [];

      if (competitors && competitors.length > 0) {
        for (const comp of competitors) {
          let compVis: number | undefined;
          let compSoa: number | undefined;
          let compSent: number | undefined;

          if (USE_OPTIMIZED_RECOMMENDATIONS) {
            const result = await optimizedMetricsHelper.fetchCompetitorMetricsByDateRange({
              competitorId: comp.id,
              brandId,
              customerId,
              startDate: currentStartDate,
              endDate: currentEndDate,
              includeSentiment: true,
            });

            if (result.success && result.data.length > 0) {
              const validVis = result.data.filter(m => m.visibility_index != null);
              const validSoa = result.data.filter(m => m.share_of_answers != null);
              const validSent = result.data.filter(m => m.sentiment_score != null);

              if (validVis.length > 0) {
                compVis = validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length;
              }
              if (validSoa.length > 0) {
                compSoa = validSoa.reduce((sum, m) => sum + (m.share_of_answers || 0), 0) / validSoa.length;
              }
              if (validSent.length > 0) {
                compSent = validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length;
              }
            }
          } else {
            // Legacy: Query from old competitors table and extracted_positions
            const { data: legacyCompetitors } = await supabaseAdmin
              .from('competitors')
              .select('id, name')
              .eq('brand_id', brandId)
              .eq('is_active', true)
              .limit(5);

            if (legacyCompetitors) {
              const legacyComp = legacyCompetitors.find(c => c.name === comp.competitor_name);
              if (legacyComp) {
                const { data: compMetrics } = await supabaseAdmin
                  .from('extracted_positions')
                  .select('visibility_index, share_of_answers_brand, sentiment_score')
                  .eq('competitor_id', legacyComp.id)
                  .gte('created_at', currentStartDate)
                  .lte('created_at', currentEndDate);

                if (compMetrics && compMetrics.length > 0) {
                  const validVis = compMetrics.filter(m => m.visibility_index != null);
                  const validSoa = compMetrics.filter(m => m.share_of_answers_brand != null);
                  const validSent = compMetrics.filter(m => m.sentiment_score != null);

                  if (validVis.length > 0) {
                    compVis = validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length;
                  }
                  if (validSoa.length > 0) {
                    compSoa = validSoa.reduce((sum, m) => sum + (m.share_of_answers_brand || 0), 0) / validSoa.length;
                  }
                  if (validSent.length > 0) {
                    compSent = validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length;
                  }
                }
              }
            }
          }

          competitorData.push({
            name: comp.competitor_name || 'Unknown',
            visibilityIndex: compVis,
            shareOfAnswers: compSoa,
            sentimentScore: compSent
          });
        }
      }

      // Use the same source-attribution service as Citations Sources page for 100% consistency
      console.log('📊 [RecommendationV3Service] Fetching source data using source-attribution service (same as Citations Sources page)...');
      const sourceAttributionStartTime = Date.now();

      const sourceAttributionResponse = await sourceAttributionService.getSourceAttribution(
        brandId,
        customerId,
        { start: currentStartDate, end: currentEndDate }
      );

      console.log(`✅ [RecommendationV3Service] Fetched ${sourceAttributionResponse.sources.length} sources from source-attribution service in ${Date.now() - sourceAttributionStartTime}ms`);

      const sourceMetrics: BrandContextV3['sourceMetrics'] = [];
      const sourceMap = new Map<string, { domain: string; source: typeof sourceAttributionResponse.sources[0] }>();

      if (sourceAttributionResponse.sources && sourceAttributionResponse.sources.length > 0) {
        // Build source map from source-attribution service response (exact same data as Citations Sources page)
        for (const source of sourceAttributionResponse.sources) {
          // Normalize domain name (remove www, lowercase)
          const normalizedDomain = source.name.toLowerCase().replace(/^www\./, '').trim();
          if (normalizedDomain && normalizedDomain !== 'unknown') {
            sourceMap.set(normalizedDomain, {
              domain: normalizedDomain,
              source: source
            });
          }
        }

        // Convert source-attribution data to recommendation format
        // Use top 10 sources sorted by value score (same as Citations Sources page)
        const topSources = sourceAttributionResponse.sources
          .sort((a, b) => {
            const valueDiff = (b.value || 0) - (a.value || 0);
            if (Math.abs(valueDiff) > 0.01) return valueDiff;
            return b.mentionRate - a.mentionRate;
          })
          .slice(0, 10);

        for (const source of topSources) {
          const normalizedDomain = source.name.toLowerCase().replace(/^www\./, '').trim();

          sourceMetrics.push({
            domain: normalizedDomain,
            mentionRate: Math.round(source.mentionRate * 10) / 10,
            soa: Math.round(source.soa * 10) / 10,
            sentiment: Math.round(source.sentiment * 100) / 100,
            citations: source.citations,
            impactScore: Math.round((source.value || 0) * 10) / 10,
            visibility: source.visibility ? Math.round(source.visibility) : 0 // Visibility is already 0-100 from source-attribution service
          });
        }

        // LAYER 1: Filter out competitor sources before prompt generation
        const originalSourceCount = sourceMetrics.length;
        const filteredSourceMetrics = filterCompetitorSources(sourceMetrics, competitorExclusionList);
        const filteredCount = originalSourceCount - filteredSourceMetrics.length;

        if (filteredCount > 0) {
          console.log(`🚫 [RecommendationV3Service] Filtered out ${filteredCount} competitor source(s) from available citation sources`);
        }

        // Use filtered sources
        sourceMetrics.length = 0;
        sourceMetrics.push(...filteredSourceMetrics);

        console.log(`✅ [RecommendationV3Service] Using ${sourceMetrics.length} sources from source-attribution service (exact same as Citations Sources page, competitor sources filtered)`);
        console.log(`📊 [RecommendationV3Service] Top sources by Value score (after competitor filtering):`);
        sourceMetrics.forEach((s, idx) => {
          console.log(`  ${idx + 1}. ${s.domain} - Value: ${s.impactScore}, Citations: ${s.citations}, SOA: ${s.soa}%, Visibility: ${s.visibility}, Sentiment: ${s.sentiment}`);
        });
      } else {
        console.warn('⚠️ [RecommendationV3Service] No sources found from source-attribution service');
      }

      // Calculate aggregated competitor metrics (without names) for context
      const competitorAvgVisibility = competitorData.length > 0
        ? competitorData.reduce((sum, c) => sum + (c.visibilityIndex || 0), 0) / competitorData.filter(c => c.visibilityIndex !== undefined).length
        : undefined;
      const competitorAvgSoa = competitorData.length > 0
        ? competitorData.reduce((sum, c) => sum + (c.shareOfAnswers || 0), 0) / competitorData.filter(c => c.shareOfAnswers !== undefined).length
        : undefined;
      const competitorAvgSentiment = competitorData.length > 0
        ? competitorData.reduce((sum, c) => sum + (c.sentimentScore || 0), 0) / competitorData.filter(c => c.sentimentScore !== undefined).length
        : undefined;

      return {
        brandId: brand.id,
        brandName: brand.name,
        brandDomain: brandDomain, // Add brand domain for whitelist filtering
        brandSummary: (brand as any).summary || undefined,
        industry: brand.industry || undefined,
        visibilityIndex,
        shareOfAnswers,
        sentimentScore,
        trends,
        competitors: competitorData, // Keep for internal use, but won't include names in prompt
        sourceMetrics: sourceMetrics.slice(0, 10), // Already sorted by Value score (top 10 only), competitor sources filtered
        // Store exclusion list and aggregated metrics for use in prompt generation
        _competitorExclusionList: competitorExclusionList,
        _competitorAvgMetrics: {
          visibility: competitorAvgVisibility,
          soa: competitorAvgSoa,
          sentiment: competitorAvgSentiment,
          count: competitorData.length
        },
        domainAuditResult: await domainReadinessService.getLatestAudit(brand.id),
        ...(await this.getQualitativeContext(brandId, customerId, currentStartDate))
      };

    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error gathering context:', error);
      return null;
    }
  }

  /**
   * Fetch Qualitative Context (Keywords, Quotes, Narrative)
   * Queries consolidated_analysis_cache via collector_results link
   */
  private async getQualitativeContext(
    brandId: string,
    customerId: string,
    startDate: string
  ): Promise<Partial<BrandContextV3>> {
    try {
      // Fetch analysis cache joined with collector_results to filter by brand
      // We limit to 50 recent entires to get a good sample without over-fetching
      const { data, error } = await supabaseAdmin
        .from('consolidated_analysis_cache')
        .select(`
          keywords,
          quotes,
          narrative,
          collector_results!inner(brand_id, created_at)
        `)
        .eq('collector_results.brand_id', brandId)
        .gte('collector_results.created_at', startDate)
        .order('created_at', { ascending: false, foreignTable: 'collector_results' })
        .limit(50);

      if (error) {
        console.warn('⚠️ [RecommendationV3Service] Error fetching qualitative context:', error.message);
        return {};
      }

      if (!data || data.length === 0) {
        return {};
      }

      console.log(`🧠 [RecommendationV3Service] Fetched ${data.length} analysis records for qualitative context`);

      // Aggregation Logic
      const aggregatedKeywords = this.aggregateKeywords(data);
      const strategicNarrative = this.aggregateNarratives(data);
      const keyQuotes = this.extractTopQuotes(data);

      return {
        topKeywords: aggregatedKeywords,
        strategicNarrative,
        keyQuotes
      };
    } catch (err) {
      console.error('❌ [RecommendationV3Service] Unexpected error in getQualitativeContext:', err);
      return {};
    }
  }

  /**
   * Helper: Aggregate Keywords by frequency/relevance
   */
  private aggregateKeywords(data: any[]): Array<{ keyword: string; count: number }> {
    const counts = new Map<string, number>();

    data.forEach(row => {
      if (Array.isArray(row.keywords)) {
        row.keywords.forEach((k: any) => {
          if (k && k.keyword) {
            const term = k.keyword.toLowerCase().trim();
            counts.set(term, (counts.get(term) || 0) + 1);
          }
        });
      }
    });

    return Array.from(counts.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 keywords
  }

  /**
   * Helper: Aggregate Narratives (Simple concatenation of unique summaries for now)
   */
  private aggregateNarratives(data: any[]): string {
    const narratives = new Set<string>();

    data.forEach(row => {
      if (row.narrative && row.narrative.brand_summary) {
        narratives.add(row.narrative.brand_summary);
      }
    });

    // Pick top 3 unique narratives to form a summary
    return Array.from(narratives).slice(0, 3).join(' ');
  }

  /**
   * Helper: Extract Top Quotes
   */
  private extractTopQuotes(data: any[]): string[] {
    const quotes: string[] = [];

    data.forEach(row => {
      if (Array.isArray(row.quotes)) {
        row.quotes.forEach((q: any) => {
          if (q && q.text && q.text.length > 20) { // Filter distinct short junk
            quotes.push(`"${q.text}" (${q.sentiment})`);
          }
        });
      }
    });

    // Pick last 5 (most recent) - logic is simple for now
    return quotes.slice(0, 5);
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
  private async identifyKPIs(context: BrandContextV3): Promise<IdentifiedKPI[]> {
    const normalizePercent = (value: number | null | undefined) => this.normalizePercent(value);
    const normalizeSentiment100 = (value: number | null | undefined) =>
      value === null || value === undefined ? null : Math.max(0, Math.min(100, ((value + 1) / 2) * 100));

    // Build brand metrics summary
    const brandLines: string[] = [];
    const brandVisibility = normalizePercent(context.visibilityIndex ?? null);
    if (brandVisibility !== null) {
      brandLines.push(`- Visibility Index: ${Math.round(brandVisibility * 10) / 10}`);
    }

    const brandSoa = normalizePercent(context.shareOfAnswers ?? null);
    if (brandSoa !== null) {
      brandLines.push(`- Share of Answers (SOA): ${Math.round(brandSoa * 10) / 10}%`);
    }

    const brandSentiment = normalizeSentiment100(context.sentimentScore ?? null);
    if (brandSentiment !== null) {
      brandLines.push(`- Sentiment Score: ${Math.round(brandSentiment * 10) / 10}`);
    }

    // Simplified prompt - removed competitor summary, trends, and citation sources
    // These are not needed for KPI identification and add unnecessary complexity

    const prompt = `You are a Brand/AEO expert. Analyze the brand data below and identify 3-5 key KPIs/metrics that are most important for improving this brand's performance.

Return ONLY a JSON array of KPIs. Each KPI should have:
- kpiName: The KPI name (e.g., "Visibility Index", "SOA %", "Sentiment Score")
- kpiDescription: A 2-3 sentence explanation of why this KPI matters for this specific brand based on their current performance
- currentValue: The current value (numeric, can be null if not available)
- targetValue: A reasonable target value to aim for (numeric, can be null)

Brand Performance Data
- Name: ${context.brandName}
- Industry: ${context.industry || 'Not specified'}
${brandLines.join('\n')}

Your Task:
Identify 3-5 KPIs that are most critical for this brand to improve. Focus on:
1. KPIs where the brand is underperforming (low values indicate improvement opportunity)
2. KPIs with the highest potential impact on brand visibility and authority
3. KPIs that align with the brand's industry and goals

Return ONLY a JSON array like:
[
  {
    "kpiName": "Visibility Index",
    "kpiDescription": "Your visibility is 35% vs competitor average of 50%. Improving visibility will increase brand mentions in AI responses.",
    "currentValue": 35.2,
    "targetValue": 50.0
  },
  {
    "kpiName": "SOA %",
    "kpiDescription": "Your SOA is 28% vs industry benchmark of 35%. Low SOA means you're not being chosen for direct answers.",
    "currentValue": 28.5,
    "targetValue": 35.0
  }
]

Respond only with the JSON array.`;

    try {
      let content: string | null = null;

      // Try OpenRouter first (primary)
      try {
        console.log('🚀 [RecommendationV3Service] Attempting OpenRouter API (primary) for KPI identification...');
        const or = await openRouterCollectorService.executeQuery({
          collectorType: 'content',
          prompt,
          maxTokens: 2000,
          temperature: 0.5,
          topP: 0.9,
          enableWebSearch: false
        });
        content = or.response;
        if (content) {
          console.log('✅ [RecommendationV3Service] OpenRouter API succeeded (primary provider) for KPI identification');
        } else {
          console.warn('⚠️ [RecommendationV3Service] OpenRouter returned empty content');
        }
      } catch (e) {
        console.error('❌ [RecommendationV3Service] OpenRouter API failed:', e);
      }

      // Fallback to Cerebras if OpenRouter failed
      if (!content && this.cerebrasApiKey) {
        try {
          console.log('🔄 [RecommendationV3Service] OpenRouter failed, trying Cerebras fallback for KPI identification...');
          const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.cerebrasApiKey}`
            },
            body: JSON.stringify({
              model: this.cerebrasModel,
              messages: [
                {
                  role: 'system',
                  content: 'You are a senior Brand/AEO expert. Analyze brand data and identify the most important KPIs. Respond only with valid JSON arrays.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              max_tokens: 2000,
              temperature: 0.5
            })
          });

          if (response.ok) {
            const data = await response.json() as CerebrasChatResponse;
            content = data?.choices?.[0]?.message?.content || null;
            if (content) {
              console.log('✅ [RecommendationV3Service] Cerebras fallback succeeded for KPI identification');
            }
          } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`❌ [RecommendationV3Service] Cerebras fallback failed: ${response.status} - ${errorText.substring(0, 200)}`);
          }
        } catch (e) {
          console.error('❌ [RecommendationV3Service] Cerebras fallback failed:', e);
        }
      }

      if (!content) {
        console.error('❌ [RecommendationV3Service] Failed to get KPI identification from LLM');
        return [];
      }

      // Log raw response for debugging
      console.log('📝 [RecommendationV3Service] Raw LLM response (first 500 chars):', content.substring(0, 500));

      // Parse JSON response - try multiple extraction strategies
      let cleaned = content.trim();

      // Remove markdown code blocks
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      // Try to extract JSON array if there's extra text
      let jsonStart = cleaned.indexOf('[');
      let jsonEnd = cleaned.lastIndexOf(']');

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }

      // Try parsing
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseError) {
        console.error('❌ [RecommendationV3Service] JSON parse error. Attempting to fix...');
        console.error('Cleaned content (first 1000 chars):', cleaned.substring(0, 1000));

        // Try to fix common JSON issues
        // Remove trailing commas before closing brackets
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

        // Fix extra closing braces before closing bracket (e.g., "  }\n  }\n]")
        // This happens when LLM adds an extra closing brace
        cleaned = cleaned.replace(/\}\s*\}\s*\]/g, '}]');

        // Remove any extra closing braces right before the closing bracket
        // Match pattern: whitespace + } + whitespace + } + whitespace + ]
        cleaned = cleaned.replace(/(\})\s*\}(\s*\])/g, '$1$2');

        // Try to extract just the array part more aggressively
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          cleaned = arrayMatch[0];
        }

        // Final cleanup: remove any standalone closing braces before ]
        // This handles cases like: "  }\n  }\n]" -> "  }\n]"
        const lastBraceIndex = cleaned.lastIndexOf('}');
        const lastBracketIndex = cleaned.lastIndexOf(']');
        if (lastBraceIndex !== -1 && lastBracketIndex !== -1 && lastBraceIndex < lastBracketIndex) {
          // Check if there are multiple closing braces before the bracket
          const beforeBracket = cleaned.substring(lastBraceIndex, lastBracketIndex);
          const braceCount = (beforeBracket.match(/\}/g) || []).length;
          if (braceCount > 1) {
            // Remove extra braces, keep only one
            cleaned = cleaned.substring(0, lastBraceIndex) +
              cleaned.substring(lastBraceIndex).replace(/\}/g, '').replace(/\]/, '}]');
          }
        }

        try {
          parsed = JSON.parse(cleaned);
        } catch (secondError) {
          console.error('❌ [RecommendationV3Service] Failed to parse JSON after fixes:', secondError);
          console.error('Cleaned content (last 200 chars):', cleaned.substring(Math.max(0, cleaned.length - 200)));

          // Last resort: try to manually extract array elements
          try {
            const elements: any[] = [];
            const elementMatches = cleaned.match(/\{[^}]*"kpiName"[^}]*\}/g);
            if (elementMatches && elementMatches.length > 0) {
              for (const match of elementMatches) {
                try {
                  const element = JSON.parse(match);
                  elements.push(element);
                } catch (e) {
                  // Skip malformed elements
                }
              }
              if (elements.length > 0) {
                console.log(`⚠️ [RecommendationV3Service] Manually extracted ${elements.length} KPIs from malformed JSON`);
                parsed = elements;
              } else {
                throw secondError;
              }
            } else {
              throw secondError;
            }
          } catch (manualError) {
            console.error('Full content length:', content.length);
            console.error('Cleaned content length:', cleaned.length);
            return [];
          }
        }
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.warn('⚠️ [RecommendationV3Service] KPI identification returned empty/invalid result, using defaults');
        const normalizePercent = (value: number | null | undefined) => this.normalizePercent(value);
        const normalizeSentiment100 = (value: number | null | undefined) =>
          value === null || value === undefined ? null : Math.max(0, Math.min(100, ((value + 1) / 2) * 100));

        const defaultKpis: IdentifiedKPI[] = [
          {
            kpiName: 'Visibility Index',
            kpiDescription: 'Overall brand visibility across AI responses.',
            currentValue: normalizePercent(context.visibilityIndex) ?? 0,
            targetValue: Math.min(100, (normalizePercent(context.visibilityIndex) || 20) + 10),
            displayOrder: 0
          },
          {
            kpiName: 'SOA %',
            kpiDescription: 'Share of Answers for your brand compared to competitors.',
            currentValue: normalizePercent(context.shareOfAnswers) ?? 0,
            targetValue: Math.min(100, (normalizePercent(context.shareOfAnswers) || 15) + 5),
            displayOrder: 1
          }
        ];

        const sentiment = normalizeSentiment100(context.sentimentScore);
        if (sentiment !== null) {
          defaultKpis.push({
            kpiName: 'Sentiment Score',
            kpiDescription: 'Brand sentiment across AI citations.',
            currentValue: sentiment,
            targetValue: Math.min(100, sentiment + 5),
            displayOrder: 2
          });
        }

        parsed = defaultKpis;
      }

      const kpis: IdentifiedKPI[] = parsed.map((kpi: any, index: number) => ({
        kpiName: String(kpi.kpiName || 'Unknown KPI'),
        kpiDescription: String(kpi.kpiDescription || ''),
        currentValue: typeof kpi.currentValue === 'number' ? kpi.currentValue : undefined,
        targetValue: typeof kpi.targetValue === 'number' ? kpi.targetValue : undefined,
        displayOrder: index
      }));

      console.log(`✅ [RecommendationV3Service] Identified ${kpis.length} KPIs`);

      // Inject "Technical Health" KPI if Domain Readiness audit is poor
      if (context.domainAuditResult && context.domainAuditResult.overallScore < 70) {
        console.log(`⚠️ [RecommendationV3Service] Domain Health is poor (${context.domainAuditResult.overallScore}/100), injecting Technical Health KPI`);
        kpis.unshift({
          kpiName: 'Technical Health',
          kpiDescription: 'Your domain readiness score is low. Fixing technical foundations is a prerequisite for AEO success.',
          currentValue: context.domainAuditResult.overallScore,
          targetValue: 80,
          displayOrder: -1 // Ensure it comes first
        });
      }

      return kpis;

    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error identifying KPIs:', error);
      return [];
    }
  }

  /**
   * Generate recommendations directly (simplified prompt, no KPI identification)
   */
  private async generateRecommendationsDirect(
    context: BrandContextV3,
    kpis: IdentifiedKPI[] = []
  ): Promise<RecommendationV3[]> {
    const normalizePercent = (value: number | null | undefined) => this.normalizePercent(value);
    const normalizeSentiment100 = (value: number | null | undefined) =>
      value === null || value === undefined ? null : Math.max(0, Math.min(100, ((value + 1) / 2) * 100));

    // Build brand metrics summary
    const brandLines: string[] = [];
    const brandVisibility = normalizePercent(context.visibilityIndex ?? null);
    if (brandVisibility !== null) {
      brandLines.push(`- Visibility: ${Math.round(brandVisibility * 10) / 10}`);
    }
    const brandSoa = normalizePercent(context.shareOfAnswers ?? null);
    if (brandSoa !== null) {
      brandLines.push(`- SOA: ${Math.round(brandSoa * 10) / 10}%`);
    }
    const brandSentiment = normalizeSentiment100(context.sentimentScore ?? null);
    if (brandSentiment !== null) {
      brandLines.push(`- Sentiment: ${Math.round(brandSentiment * 10) / 10}`);
    }

    // Log available sources for debugging (top 10 from Citations Sources page)
    if (context.sourceMetrics && context.sourceMetrics.length > 0) {
      console.log(`📊 [RecommendationV3Service] Top 10 sources from Citations Sources page (${context.sourceMetrics.length} total):`,
        context.sourceMetrics.map(s => `${s.domain} (Value: ${s.impactScore}, Citations: ${s.citations})`).join(', '));
    } else {
      console.warn('⚠️ [RecommendationV3Service] No sourceMetrics available in context');
    }

    // Format source metrics (Top Citation Sources) - include actual data for LLM reference
    // Create a numbered list with EXACT domain names that must be used
    // Use only top 10 sources (same as Citations Sources page)
    const sourceSummary = context.sourceMetrics && context.sourceMetrics.length > 0
      ? context.sourceMetrics.slice(0, 10).map((s, idx) => {
        const visibility = normalizePercent(s.visibility);
        const soa = normalizePercent(s.soa);
        const sentiment = normalizeSentiment100(s.sentiment);
        const parts: string[] = [`${idx + 1}. ${s.domain}`, `(${s.citations} citations, Impact ${s.impactScore}/10`];
        if (Number.isFinite(s.mentionRate)) parts.push(`Mention Rate ${Math.round(s.mentionRate * 10) / 10}%`);
        if (soa !== null) parts.push(`SOA ${soa}%`);
        if (sentiment !== null) parts.push(`Sentiment ${Math.round(sentiment * 10) / 10}`);
        if (visibility !== null) parts.push(`Visibility ${visibility}`);

        // Add top competitor info if available (critical for Battleground strategies)
        if (s.topCompetitor) {
          parts.push(`Dominant Competitor: ${s.topCompetitor.name} (${Math.round(s.topCompetitor.soa * 100)}% SOA)`);
        }

        parts.push(')');
        return parts.join(', ');
      }).join('\n  ')
      : 'No source data available';

    // Create a simple list of exact domain names for strict matching (top 10 only)
    // Note: These sources are already filtered to exclude competitor domains (Layer 1)
    const exactDomains = context.sourceMetrics && context.sourceMetrics.length > 0
      ? context.sourceMetrics.slice(0, 10).map(s => s.domain)
      : [];

    // LAYER 1: Use aggregated competitor metrics instead of competitor names
    // This prevents the LLM from being primed with competitor names
    const competitorContext = context._competitorAvgMetrics && context._competitorAvgMetrics.count > 0
      ? `Industry Benchmark (${context._competitorAvgMetrics.count} competitors analyzed):
- Average Visibility: ${context._competitorAvgMetrics.visibility !== undefined ? Math.round(context._competitorAvgMetrics.visibility * 10) / 10 : 'N/A'}
- Average SOA: ${context._competitorAvgMetrics.soa !== undefined ? Math.round(context._competitorAvgMetrics.soa * 10) / 10 : 'N/A'}%
- Average Sentiment: ${context._competitorAvgMetrics.sentiment !== undefined ? Math.round(context._competitorAvgMetrics.sentiment * 10) / 10 : 'N/A'}`
      : 'No industry benchmark data available';

    // Phase 7: Graph Algorithm Insights
    // This injects specific "Opportunity Gaps" found by the Knowledge Graph
    const graphContext = context.graphInsights?.opportunityGaps && context.graphInsights.opportunityGaps.length > 0
      ? `CONFIRMED COMPETITOR WEAKNESSES (Use these for 'Battleground' comparisons):
${context.graphInsights.opportunityGaps.map(g => `- Weakness: "${g.topic}" (Score: ${g.score.toFixed(1)})\n  Context: ${g.context}\n  Evidence: "${g.evidence[0] || 'N/A'}"`).join('\n')}`
      : 'No graph insights available.';

    const lowDataMode = context._dataMaturity === 'low_data';
    const lowDataGuidance = lowDataMode
      ? `\nLOW-DATA MODE (important):\n- The brand has limited evidence/signals. Avoid making strong assumptions.\n- Prefer owned-site actions and foundational improvements that reliably create measurable signals.\n- If recommending external work, keep it conservative and tied to the provided safe sources list.\n- Use “audit/verify/optimize” language where you suspect basics already exist.\n`
      : '';

    const prompt = `You are a Brand/AEO expert. Generate 8-12 actionable recommendations to improve brand performance. Return ONLY a JSON array.

RULES
- citationSource MUST be EXACTLY one of the domains from the "Available Citation Sources" list below
- DO NOT use any domain that is not in the list - this is critical
- Use numeric scores as provided (0–100 scales). Do NOT add % signs except for expectedBoost
- expectedBoost should use percent style like "+5-10%"
- confidence is integer 0-100
- timeline is a range ("2-4 weeks", "4-6 weeks")
- focusArea must be: "visibility", "soa", or "sentiment"
- priority must be: "High", "Medium", or "Low"
- effort must be: "Low", "Medium", or "High"
- **PUBLISHING RULE**: Publishing content on a competitor's website is NOT an option. Do not suggest guest posting, commenting, or any form of content placement on domains that belong to competitors.
- **COMPETITOR EXCLUSION**: Competitor sources have already been filtered out from the available citation sources list.
- **STRATEGIC COMPARISONS**: You CAN mention competitors in the action, reason, or explanation IF it is for differentiation or comparison (e.g., "Create a comparison guide: Us vs. [Competitor]").
- **NO PROMOTION**: Do NOT recommend promoting competitors. Never suggest sending users to a competitor's website. Publishing content on a competitor's domain is strictly forbidden.
${lowDataGuidance}

Brand Performance
- Name: ${context.brandName}
- Industry: ${context.industry || 'Not specified'}
${brandLines.join('\n')}

${competitorContext}

Known Competitors (for comparison context only):
${context.competitors && context.competitors.length > 0 ? context.competitors.map(c => `- ${c.name}`).join('\n') : 'No specific competitors identified.'}
    
${graphContext}

Voice of Customer & Strategic Context (Use this to better understand *why* the brand wins or loses):
- Top Keywords: ${context.topKeywords?.map(k => `${k.keyword} (${k.count})`).join(', ') || 'N/A'}
- Strategic Narrative: ${context.strategicNarrative || 'N/A'}
- Customer Quotes:
${context.keyQuotes?.map(q => `  > ${q}`).join('\n') || '  (No quotes available)'}

Available Citation Sources (you MUST use ONLY these exact domains - copy them EXACTLY):
These are the top sources from the Citations Sources page, sorted by Value score (composite of Visibility, SOA, Sentiment, and Citations).
Competitor sources have been automatically excluded from this list.
${exactDomains.length > 0 ? exactDomains.map((d, i) => `${i + 1}. ${d}`).join('\n') : 'No sources available'}

Source Details:
  ${sourceSummary}

Your Task:
Generate 8-12 recommendations. Each recommendation should:
1. Have a clear action (what to do)
2. Specify a citation source/domain from the "Available Citation Sources" list above - use the EXACT domain name as shown (e.g., if the list shows "example.com", use "example.com" exactly)
3. Have a focus area (visibility/soa/sentiment) based on brand metrics
4. Have priority (High/Medium/Low) and effort (Low/Medium/High)
5. Include reason (why this matters), explanation (4-5 sentences), expectedBoost, timeline, confidence
6. Include focusSources, contentFocus, kpi ("Visibility Index" | "SOA %" | "Sentiment Score")
7. **CRITICAL**: Use the "Voice of Customer" data (Quotes & Keywords) to write compelling reasons. Explain *why* this action addresses a specific gap found in the narrative or keywords.
8. **STRATEGIC ATTACK**: Check 'CONFIRMED COMPETITOR WEAKNESSES'. If a competitor is weak in an area (e.g., 'Durability'), explicitly recommend highlighting your brand's strength in that specific area as a differentiating factor.

IMPORTANT: Do NOT generate impactScore, mentionRate, soa, sentiment, visibilityScore, or citationCount. These will be automatically filled from the source data.

Return ONLY a JSON array like:
[
  {
    "action": "Create FAQ content on reddit.com about enterprise security",
    "citationSource": "reddit.com",
    "focusArea": "visibility",
    "priority": "High",
    "effort": "Medium",
    "kpi": "Visibility Index",
    "reason": "Reddit has high citation volume but low visibility for this brand",
    "explanation": "Reddit is a high-traffic platform with significant citation opportunities. Creating structured FAQ content will improve citation opportunities and brand mentions in AI responses.",
    "expectedBoost": "+5-10%",
    "focusSources": "reddit.com, stackoverflow.com",
    "contentFocus": "Technical FAQs and troubleshooting guides",
    "timeline": "2-4 weeks",
    "confidence": 75
  }
]

Respond only with the JSON array.`;

    // Log the prompt to terminal
    console.log(prompt);

    try {
      let content: string | null = null;
      let providerUsed = 'none';

      // Try Ollama first (if enabled for this brand)
      const useOllama = await shouldUseOllama(context.brandId);
      if (useOllama) {
        try {
          console.log('🦙 [RecommendationV3Service] Attempting Ollama API (primary for this brand)...');
          const ollamaStartTime = Date.now();

          const systemMessage = 'You are a Senior Marketing Strategist & AEO Expert. You provide confident, direct, and high-impact strategic advice. Avoid generic fluff. Connect every recommendation to the Voice of Customer data provided. Respond only with valid JSON arrays.';
          const ollamaResponse = await callOllamaAPI(systemMessage, prompt, context.brandId);

          // Ollama returns JSON string, may need parsing
          let parsedContent = ollamaResponse;

          // Remove markdown code blocks if present
          if (parsedContent.includes('```json')) {
            parsedContent = parsedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          } else if (parsedContent.includes('```')) {
            parsedContent = parsedContent.replace(/```\s*/g, '');
          }

          // Extract JSON array if wrapped in other text
          const jsonMatch = parsedContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            parsedContent = jsonMatch[0];
          }

          content = parsedContent;
          if (content) {
            providerUsed = 'ollama';
            const ollamaDuration = Date.now() - ollamaStartTime;
            console.log(`✅ [RecommendationV3Service] Ollama API succeeded (primary provider) in ${ollamaDuration}ms`);
          } else {
            console.warn('⚠️ [RecommendationV3Service] Ollama returned empty content');
          }
        } catch (e: any) {
          console.error('❌ [RecommendationV3Service] Ollama API failed:', e.message || e);
          console.log('🔄 [RecommendationV3Service] Falling back to OpenRouter...');
        }
      }

      // Try OpenRouter if Ollama not enabled or failed
      if (!content) {
        try {
          console.log('🚀 [RecommendationV3Service] Attempting OpenRouter API (primary/fallback)...');
          const openRouterStartTime = Date.now();

          // Add timeout wrapper for OpenRouter call
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('OpenRouter request timeout after 180 seconds')), 180000);
          });

          const openRouterPromise = openRouterCollectorService.executeQuery({
            collectorType: 'content',
            prompt,
            maxTokens: 8000,
            temperature: 0.5,
            topP: 0.9,
            enableWebSearch: false
          });

          const or = await Promise.race([openRouterPromise, timeoutPromise]) as any;
          const openRouterDuration = Date.now() - openRouterStartTime;

          content = or.response;
          if (content) {
            providerUsed = 'openrouter';
            console.log(`✅ [RecommendationV3Service] OpenRouter API succeeded in ${openRouterDuration}ms`);
          } else {
            console.warn('⚠️ [RecommendationV3Service] OpenRouter returned empty content');
          }
        } catch (e: any) {
          console.error('❌ [RecommendationV3Service] OpenRouter API failed:', e.message || e);
          if (e.message?.includes('timeout')) {
            console.error('⏱️ [RecommendationV3Service] OpenRouter request timed out, trying Cerebras fallback...');
          }
        }
      }

      // Fallback to Cerebras if both Ollama and OpenRouter failed
      if (!content && this.cerebrasApiKey) {
        try {
          console.log('🔄 [RecommendationV3Service] OpenRouter failed, trying Cerebras fallback...');
          const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.cerebrasApiKey}`
            },
            body: JSON.stringify({
              model: this.cerebrasModel,
              messages: [
                {
                  role: 'system',
                  content: 'You are a senior Brand/AEO expert. Generate actionable recommendations. Respond only with valid JSON arrays.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              max_tokens: 8000,
              temperature: 0.5
            })
          });

          if (response.ok) {
            const data = await response.json() as CerebrasChatResponse;
            content = data?.choices?.[0]?.message?.content || null;
            if (content) {
              providerUsed = 'cerebras';
              console.log('✅ [RecommendationV3Service] Cerebras fallback succeeded (using Cerebras)');
            } else {
              console.warn('⚠️ [RecommendationV3Service] Cerebras returned empty content');
            }
          } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`❌ [RecommendationV3Service] Cerebras fallback failed: ${response.status} - ${errorText.substring(0, 200)}`);
          }
        } catch (e) {
          console.error('❌ [RecommendationV3Service] Cerebras fallback failed:', e);
        }
      } else if (!content && !this.cerebrasApiKey) {
        console.log('⚠️ [RecommendationV3Service] OpenRouter failed and Cerebras API key not configured');
      }

      console.log(`📊 [RecommendationV3Service] Provider used for recommendations: ${providerUsed}`);

      if (!content) {
        console.error('❌ [RecommendationV3Service] Failed to get recommendations from LLM (both OpenRouter and Cerebras failed)');
        return [];
      }

      console.log(`📊 [RecommendationV3Service] Successfully received response from ${providerUsed}, length: ${content.length} chars`);
      // Log raw response for debugging
      console.log('📝 [RecommendationV3Service] Raw recommendations response (first 500 chars):', content.substring(0, 500));

      // Parse JSON response - reuse the same robust parsing logic
      let cleaned = content.trim();

      // Remove markdown code blocks
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      // Try to extract JSON array if there's extra text
      let jsonStart = cleaned.indexOf('[');
      let jsonEnd = cleaned.lastIndexOf(']');

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }

      // Try parsing with robust error handling
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseError) {
        console.error('❌ [RecommendationV3Service] JSON parse error. Attempting to fix...');
        console.error('Cleaned content (first 1000 chars):', cleaned.substring(0, 1000));

        // Try to fix common JSON issues
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
        cleaned = cleaned.replace(/\}\s*\}\s*\]/g, '}]');
        cleaned = cleaned.replace(/(\})\s*\}(\s*\])/g, '$1$2');

        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          cleaned = arrayMatch[0];
        }

        const lastBraceIndex = cleaned.lastIndexOf('}');
        const lastBracketIndex = cleaned.lastIndexOf(']');
        if (lastBraceIndex !== -1 && lastBracketIndex !== -1 && lastBraceIndex < lastBracketIndex) {
          const beforeBracket = cleaned.substring(lastBraceIndex, lastBracketIndex);
          const braceCount = (beforeBracket.match(/\}/g) || []).length;
          if (braceCount > 1) {
            cleaned = cleaned.substring(0, lastBraceIndex) +
              cleaned.substring(lastBraceIndex).replace(/\}/g, '').replace(/\]/, '}]');
          }
        }

        try {
          parsed = JSON.parse(cleaned);
        } catch (secondError) {
          console.error('❌ [RecommendationV3Service] Failed to parse JSON after fixes:', secondError);
          console.error('Cleaned content (last 200 chars):', cleaned.substring(Math.max(0, cleaned.length - 200)));

          // Last resort: try to manually extract array elements
          try {
            const elements: any[] = [];
            const elementMatches = cleaned.match(/\{[^}]*"action"[^}]*\}/g);
            if (elementMatches && elementMatches.length > 0) {
              for (const match of elementMatches) {
                try {
                  const element = JSON.parse(match);
                  elements.push(element);
                } catch (e) {
                  // Skip malformed elements
                }
              }
              if (elements.length > 0) {
                console.log(`⚠️ [RecommendationV3Service] Manually extracted ${elements.length} recommendations from malformed JSON`);
                parsed = elements;
              } else {
                throw secondError;
              }
            } else {
              throw secondError;
            }
          } catch (manualError) {
            console.error('Full content length:', content.length);
            console.error('Cleaned content length:', cleaned.length);
            return [];
          }
        }
      }

      if (!Array.isArray(parsed)) {
        console.error('❌ [RecommendationV3Service] Recommendations response is not an array. Type:', typeof parsed);
        return [];
      }

      // Map recommendations and enrich with actual source data
      const recommendations: RecommendationV3[] = parsed.map((rec: any) => {
        // Find matching source from context to get real metrics
        const citationSource = String(rec.citationSource || '').toLowerCase().replace(/^www\./, '').trim();
        const matchingSource = context.sourceMetrics?.find(s => {
          const sourceDomain = s.domain.toLowerCase().replace(/^www\./, '').trim();
          return sourceDomain === citationSource || sourceDomain.includes(citationSource) || citationSource.includes(sourceDomain);
        });

        if (!matchingSource) {
          console.warn(`⚠️ [RecommendationV3Service] No matching source found for "${rec.citationSource}" in sourceMetrics`);
        }

        // Values from source-attribution service are already in correct format:
        // - mentionRate: 0-100 (percentage)
        // - soa: 0-100 (percentage)  
        // - sentiment: normalized value (check source-attribution service format)
        // - visibility: 0-100 (already fixed to integer)
        const formatValue = (value: number | null | undefined, decimals: number = 1): string | null => {
          if (value === null || value === undefined) return null;
          return String(Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals));
        };

        return {
          action: String(rec.action || ''),
          citationSource: String(rec.citationSource || ''),
          focusArea: rec.focusArea === 'soa' ? 'soa' : rec.focusArea === 'sentiment' ? 'sentiment' : 'visibility',
          priority: rec.priority === 'High' ? 'High' : rec.priority === 'Low' ? 'Low' : 'Medium',
          effort: rec.effort === 'High' ? 'High' : rec.effort === 'Low' ? 'Low' : 'Medium',
          kpi: rec.kpi || 'Unknown',
          reason: rec.reason,
          explanation: rec.explanation || rec.reason,
          expectedBoost: rec.expectedBoost,
          // Use actual source data from source-attribution service (exact same as Citations Sources page)
          impactScore: matchingSource ? formatValue(matchingSource.impactScore, 1) : null,
          mentionRate: matchingSource && Number.isFinite(matchingSource.mentionRate)
            ? formatValue(matchingSource.mentionRate, 1) // Already 0-100 from source-attribution service
            : null,
          soa: matchingSource && matchingSource.soa !== null && matchingSource.soa !== undefined
            ? formatValue(matchingSource.soa, 1) // Already 0-100 from source-attribution service
            : null,
          sentiment: matchingSource && matchingSource.sentiment !== null && matchingSource.sentiment !== undefined
            ? formatValue(matchingSource.sentiment, 2) // Sentiment from source-attribution is raw avg (typically -1 to 1), format to 2 decimals
            : null,
          visibilityScore: matchingSource && matchingSource.visibility !== null && matchingSource.visibility !== undefined
            ? String(Math.round(matchingSource.visibility)) // Visibility is already 0-100 from source-attribution service, round to integer
            : null,
          citationCount: matchingSource ? matchingSource.citations : 0,
          focusSources: rec.focusSources || rec.citationSource,
          contentFocus: rec.contentFocus || rec.action,
          timeline: rec.timeline || '2-4 weeks',
          confidence: rec.confidence || 70,
          source: 'ai_generated' as const // Mark as AI-generated recommendation
        };
      });

      // Log source data matching for debugging
      const matchedSources = recommendations.filter(r => r.impactScore !== null).length;
      const unmatchedSources = recommendations.length - matchedSources;
      console.log(`✅ [RecommendationV3Service] Generated ${recommendations.length} recommendations`);
      console.log(`📊 [RecommendationV3Service] Source data matched: ${matchedSources}, unmatched: ${unmatchedSources}`);

      // Note: competitor filtering, quality contract, and deterministic ranking are applied
      // in `generateRecommendations()` via `postProcessRecommendations()`.
      return recommendations;

    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Phase 2: Generate recommendations for each KPI (2-3 per KPI) - DEPRECATED, kept for reference
   */
  private async generateRecommendationsForKPIs(
    context: BrandContextV3,
    kpis: IdentifiedKPI[]
  ): Promise<RecommendationV3[]> {
    const normalizePercent = (value: number | null | undefined) => this.normalizePercent(value);
    const normalizeSentiment100 = (value: number | null | undefined) =>
      value === null || value === undefined ? null : Math.max(0, Math.min(100, ((value + 1) / 2) * 100));

    // Build context summary
    const brandLines: string[] = [];
    const brandVisibility = normalizePercent(context.visibilityIndex ?? null);
    if (brandVisibility !== null) {
      brandLines.push(`- Visibility: ${Math.round(brandVisibility * 10) / 10}`);
    }
    const brandSoa = normalizePercent(context.shareOfAnswers ?? null);
    if (brandSoa !== null) {
      brandLines.push(`- SOA: ${Math.round(brandSoa * 10) / 10}%`);
    }
    const brandSentiment = normalizeSentiment100(context.sentimentScore ?? null);
    if (brandSentiment !== null) {
      brandLines.push(`- Sentiment: ${Math.round(brandSentiment * 10) / 10}`);
    }

    const sourceSummary = context.sourceMetrics && context.sourceMetrics.length > 0
      ? context.sourceMetrics.slice(0, 8).map(s => {
        const visibility = normalizePercent(s.visibility);
        const soa = normalizePercent(s.soa);
        const parts: string[] = [`${s.domain}:`, `${s.citations} citations`, `Impact ${s.impactScore}/10`];
        if (Number.isFinite(s.mentionRate)) parts.push(`Mention Rate ${Math.round(s.mentionRate * 10) / 10}%`);
        if (soa !== null) parts.push(`SOA ${soa}%`);
        return parts.join(', ');
      }).join('\n  ')
      : 'No source data available';

    // Format KPIs for prompt
    const kpisList = kpis.map((kpi, idx) =>
      `[KPI ${idx + 1}] ${kpi.kpiName}\n  Current: ${kpi.currentValue ?? 'N/A'}\n  Target: ${kpi.targetValue ?? 'N/A'}\n  Why: ${kpi.kpiDescription}`
    ).join('\n\n');

    // Extract competitor names for explicit exclusion
    const competitorNames = context.competitors && context.competitors.length > 0
      ? context.competitors.map(c => c.name).filter(Boolean)
      : [];

    const prompt = `You are a Brand/AEO expert. Generate 2-3 actionable recommendations for EACH identified KPI below.

Return ONLY a JSON array. Each recommendation must:
- Be specific and actionable
- Target one of the identified KPIs
- Reference actual citation sources from the "Top Citation Sources" list
- Include effort level (Low/Medium/High) and priority (High/Medium/Low)
- **CRITICAL**: Do NOT mention any competitor names in your recommendations. Do NOT include competitor names in the action, reason, explanation, contentFocus, or any other field. Focus solely on the brand's own strategies and improvements.
${competitorNames.length > 0 ? `- **EXPLICIT EXCLUSION**: The following competitor names must NOT appear anywhere in your recommendations: ${competitorNames.join(', ')}` : ''}

Brand
- Name: ${context.brandName}
- Industry: ${context.industry || 'Not specified'}
${brandLines.join('\n')}

Top Citation Sources (use only these domains)
  ${sourceSummary}

Identified KPIs:
${kpisList}

Your Task:
For EACH KPI above, generate 2-3 recommendations. Each recommendation should:
1. Have a clear action (what to do)
2. Specify a citation source/domain from the "Top Citation Sources" list
3. Have a focus area (visibility/soa/sentiment) matching the KPI
4. Have priority (High/Medium/Low) and effort (Low/Medium/High)
5. Include the KPI name it targets

Return ONLY a JSON array like:
[
  {
    "action": "Create FAQ content on reddit.com about enterprise security",
    "citationSource": "reddit.com",
    "focusArea": "visibility",
    "priority": "High",
    "effort": "Medium",
    "kpi": "Visibility Index",
    "reason": "Reddit has high citation volume but low visibility for this brand",
    "expectedBoost": "+5-10%"
  }
]

Format requirements:
- citationSource must be from "Top Citation Sources" list
- focusArea must be: "visibility", "soa", or "sentiment"
- priority must be: "High", "Medium", or "Low"
- effort must be: "Low", "Medium", or "High"
- kpi must match one of the KPI names from the list above

Respond only with the JSON array.`;

    try {
      let content: string | null = null;

      // Try OpenRouter first (primary)
      try {
        console.log('🚀 [RecommendationV3Service] Attempting OpenRouter API (primary) for KPI-based recommendations...');
        const or = await openRouterCollectorService.executeQuery({
          collectorType: 'content',
          prompt,
          maxTokens: 8000,
          temperature: 0.5,
          topP: 0.9,
          enableWebSearch: false
        });
        content = or.response;
        if (content) {
          console.log('✅ [RecommendationV3Service] OpenRouter API succeeded (primary provider) for KPI-based recommendations');
        } else {
          console.warn('⚠️ [RecommendationV3Service] OpenRouter returned empty content');
        }
      } catch (e) {
        console.error('❌ [RecommendationV3Service] OpenRouter API failed:', e);
      }

      // Fallback to Cerebras if OpenRouter failed
      if (!content && this.cerebrasApiKey) {
        try {
          console.log('🔄 [RecommendationV3Service] OpenRouter failed, trying Cerebras fallback for KPI-based recommendations...');
          const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.cerebrasApiKey}`
            },
            body: JSON.stringify({
              model: this.cerebrasModel,
              messages: [
                {
                  role: 'system',
                  content: 'You are a senior Brand/AEO expert. Generate actionable recommendations. Respond only with valid JSON arrays.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              max_tokens: 8000,
              temperature: 0.5
            })
          });

          if (response.ok) {
            const data = await response.json() as CerebrasChatResponse;
            content = data?.choices?.[0]?.message?.content || null;
            if (content) {
              console.log('✅ [RecommendationV3Service] Cerebras fallback succeeded for KPI-based recommendations');
            }
          } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`❌ [RecommendationV3Service] Cerebras fallback failed: ${response.status} - ${errorText.substring(0, 200)}`);
          }
        } catch (e) {
          console.error('❌ [RecommendationV3Service] Cerebras fallback failed:', e);
        }
      }

      if (!content) {
        console.error('❌ [RecommendationV3Service] Failed to get recommendations from LLM');
        return [];
      }

      // Log raw response for debugging
      console.log('📝 [RecommendationV3Service] Raw recommendations response (first 500 chars):', content.substring(0, 500));

      // Parse JSON response - try multiple extraction strategies
      let cleaned = content.trim();

      // Remove markdown code blocks
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      // Try to extract JSON array if there's extra text
      let jsonStart = cleaned.indexOf('[');
      let jsonEnd = cleaned.lastIndexOf(']');

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }

      // Try parsing
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseError) {
        console.error('❌ [RecommendationV3Service] JSON parse error. Attempting to fix...');
        console.error('Cleaned content (first 1000 chars):', cleaned.substring(0, 1000));

        // Try to fix common JSON issues
        // Remove trailing commas before closing brackets
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

        // Fix extra closing braces before closing bracket (e.g., "  }\n  }\n]")
        // This happens when LLM adds an extra closing brace
        cleaned = cleaned.replace(/\}\s*\}\s*\]/g, '}]');

        // Remove any extra closing braces right before the closing bracket
        // Match pattern: whitespace + } + whitespace + } + whitespace + ]
        cleaned = cleaned.replace(/(\})\s*\}(\s*\])/g, '$1$2');

        // Try to extract just the array part more aggressively
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          cleaned = arrayMatch[0];
        }

        // Final cleanup: remove any standalone closing braces before ]
        // This handles cases like: "  }\n  }\n]" -> "  }\n]"
        const lastBraceIndex = cleaned.lastIndexOf('}');
        const lastBracketIndex = cleaned.lastIndexOf(']');
        if (lastBraceIndex !== -1 && lastBracketIndex !== -1 && lastBraceIndex < lastBracketIndex) {
          // Check if there are multiple closing braces before the bracket
          const beforeBracket = cleaned.substring(lastBraceIndex, lastBracketIndex);
          const braceCount = (beforeBracket.match(/\}/g) || []).length;
          if (braceCount > 1) {
            // Remove extra braces, keep only one
            cleaned = cleaned.substring(0, lastBraceIndex) +
              cleaned.substring(lastBraceIndex).replace(/\}/g, '').replace(/\]/, '}]');
          }
        }

        try {
          parsed = JSON.parse(cleaned);
        } catch (secondError) {
          console.error('❌ [RecommendationV3Service] Failed to parse JSON after fixes:', secondError);
          console.error('Cleaned content (last 200 chars):', cleaned.substring(Math.max(0, cleaned.length - 200)));

          // Last resort: try to manually extract array elements with improved parsing
          try {
            const elements: any[] = [];

            // Strategy 1: Try to extract complete objects using a more sophisticated approach
            // Find all object starts (opening braces followed by quotes and "action")
            const objectStarts: number[] = [];
            let searchIndex = 0;
            while (true) {
              const actionIndex = cleaned.indexOf('"action"', searchIndex);
              if (actionIndex === -1) break;

              // Find the opening brace before "action"
              let braceIndex = actionIndex;
              while (braceIndex >= 0 && cleaned[braceIndex] !== '{') {
                braceIndex--;
              }
              if (braceIndex >= 0) {
                objectStarts.push(braceIndex);
              }
              searchIndex = actionIndex + 1;
            }

            // For each object start, try to extract the complete object
            for (const startIndex of objectStarts) {
              try {
                // Find the matching closing brace
                let depth = 0;
                let inString = false;
                let escapeNext = false;
                let endIndex = -1; // Use -1 to indicate not found

                for (let i = startIndex; i < cleaned.length; i++) {
                  const char = cleaned[i];

                  if (escapeNext) {
                    escapeNext = false;
                    continue;
                  }

                  if (char === '\\') {
                    escapeNext = true;
                    continue;
                  }

                  if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                  }

                  if (!inString) {
                    if (char === '{') {
                      depth++;
                    } else if (char === '}') {
                      depth--;
                      if (depth === 0) {
                        endIndex = i;
                        break;
                      }
                    }
                  }
                }

                if (endIndex > startIndex) {
                  const objectStr = cleaned.substring(startIndex, endIndex + 1);
                  try {
                    const element = JSON.parse(objectStr);
                    // Validate it has required fields
                    if (element.action && element.citationSource) {
                      elements.push(element);
                    }
                  } catch (e) {
                    // Try to fix common issues in this object
                    let fixedStr = objectStr;
                    // Close unterminated strings (handle cases like: "timeline": "2-4 we)
                    fixedStr = fixedStr.replace(/: "([^"]*)$/gm, ': "$1"');
                    // Remove trailing commas
                    fixedStr = fixedStr.replace(/,(\s*[}\]])/g, '$1');
                    // Ensure object is properly closed
                    if (!fixedStr.trim().endsWith('}')) {
                      const openCount = (fixedStr.match(/\{/g) || []).length;
                      const closeCount = (fixedStr.match(/\}/g) || []).length;
                      const missing = openCount - closeCount;
                      if (missing > 0) {
                        fixedStr = fixedStr.trim() + '}'.repeat(missing);
                      }
                    }
                    try {
                      const element = JSON.parse(fixedStr);
                      if (element.action && element.citationSource) {
                        elements.push(element);
                      }
                    } catch (e2) {
                      // Skip this object
                    }
                  }
                } else if (endIndex === -1) {
                  // Object is incomplete/truncated (no closing brace found), try to salvage it
                  const incompleteStr = cleaned.substring(startIndex);
                  let fixedStr = incompleteStr;

                  // Close any unterminated strings (handle cases like: "timeline": "2-4 we)
                  fixedStr = fixedStr.replace(/: "([^"]*)$/gm, ': "$1"');
                  // Remove trailing commas
                  fixedStr = fixedStr.replace(/,(\s*$)/g, '');
                  // Add missing closing braces
                  const openCount = (fixedStr.match(/\{/g) || []).length;
                  const closeCount = (fixedStr.match(/\}/g) || []).length;
                  const missing = openCount - closeCount;
                  if (missing > 0) {
                    fixedStr = fixedStr.trim() + '}'.repeat(missing);
                  }

                  try {
                    const element = JSON.parse(fixedStr);
                    if (element.action && element.citationSource) {
                      elements.push(element);
                    }
                  } catch (e3) {
                    // Skip incomplete object
                  }
                }
              } catch (e) {
                // Skip this object
              }
            }

            // Strategy 2: If Strategy 1 didn't work, try regex-based extraction (fallback)
            if (elements.length === 0) {
              const elementMatches = cleaned.match(/\{[^{}]*"action"[^{}]*\}/g);
              if (elementMatches && elementMatches.length > 0) {
                for (const match of elementMatches) {
                  try {
                    const element = JSON.parse(match);
                    if (element.action && element.citationSource) {
                      elements.push(element);
                    }
                  } catch (e) {
                    // Skip malformed elements
                  }
                }
              }
            }

            if (elements.length > 0) {
              console.log(`⚠️ [RecommendationV3Service] Manually extracted ${elements.length} recommendation(s) from malformed/truncated JSON`);
              parsed = elements;
            } else {
              throw secondError;
            }
          } catch (manualError) {
            console.error('❌ [RecommendationV3Service] Manual extraction also failed');
            console.error('Full content length:', content.length);
            console.error('Cleaned content length:', cleaned.length);
            return [];
          }
        }
      }

      if (!Array.isArray(parsed)) {
        console.error('❌ [RecommendationV3Service] Recommendations response is not an array. Type:', typeof parsed);
        return [];
      }

      const recommendations: RecommendationV3[] = parsed.map((rec: any) => {
        // Find matching KPI
        const matchingKpi = kpis.find(k => k.kpiName === rec.kpi);

        // Determine kpi: use rec.kpi if provided, otherwise match by focusArea, otherwise default
        let kpiValue = rec.kpi || matchingKpi?.kpiName;
        if (!kpiValue) {
          // Fallback based on focusArea
          const focusArea = rec.focusArea === 'soa' ? 'soa' : rec.focusArea === 'sentiment' ? 'sentiment' : 'visibility';
          if (focusArea === 'soa') kpiValue = 'SOA %';
          else if (focusArea === 'sentiment') kpiValue = 'Sentiment Score';
          else kpiValue = 'Visibility Index';
        }

        return {
          action: String(rec.action || ''),
          citationSource: String(rec.citationSource || ''),
          focusArea: rec.focusArea === 'soa' ? 'soa' : rec.focusArea === 'sentiment' ? 'sentiment' : 'visibility',
          priority: rec.priority === 'High' ? 'High' : rec.priority === 'Low' ? 'Low' : 'Medium',
          effort: rec.effort === 'High' ? 'High' : rec.effort === 'Low' ? 'Low' : 'Medium',
          kpi: kpiValue,
          reason: rec.reason,
          expectedBoost: rec.expectedBoost,
          timeline: rec.timeline || '2-4 weeks',
          confidence: rec.confidence || 70
        };
      });

      // Link recommendations to KPIs
      recommendations.forEach(rec => {
        const matchingKpi = kpis.find(k => k.kpiName === rec.kpi);
        if (matchingKpi && matchingKpi.id) {
          rec.kpiId = matchingKpi.id;
        }
      });

      console.log(`✅ [RecommendationV3Service] Generated ${recommendations.length} recommendations`);
      return recommendations;

    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Generate recommendations directly (no KPI identification step)
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

      // Step 2: Generate recommendations (cold-start templates OR LLM)
      let recommendations: RecommendationV3[] = [];

      // Phase 1: Identify KPIs (newly integrated)
      console.log('📊 [RecommendationV3Service] Phase 1: Identifying key KPIs...');
      const kpis = await this.identifyKPIs(context);
      console.log(`✅ [RecommendationV3Service] Identified ${kpis.length} KPI(s)`);

      if (flags.coldStartMode && context._dataMaturity === 'cold_start') {
        console.log('🧊 [RecommendationV3Service] Step 2: Using cold-start baseline recommendations (template-driven)...');
        const templates = generateColdStartRecommendations({ brandName: context.brandName, industry: context.industry });
        console.log(`   📋 Generated ${templates.length} cold-start template(s)`);
        // Already-done checks + personalization (AI rewrite + prune)
        recommendations = await this.personalizeColdStartRecommendations(context, templates);
        console.log(`✅ [RecommendationV3Service] Cold-start personalization produced ${recommendations.length} recommendation(s)`);
        if (recommendations.length === 0) {
          console.error(`❌ [RecommendationV3Service] Cold-start personalization returned 0 recommendations! Falling back to templates.`);
          recommendations = templates;
        }
      } else {
        console.log('📝 [RecommendationV3Service] Step 2: Generating recommendations with LLM...');
        const llmStartTime = Date.now();
        recommendations = await this.generateRecommendationsDirect(context, kpis);
        console.log(`✅ [RecommendationV3Service] LLM generation completed in ${Date.now() - llmStartTime}ms, produced ${recommendations.length} recommendation(s)`);
        if (recommendations.length === 0) {
          console.error(`❌ [RecommendationV3Service] LLM generation returned 0 recommendations!`);
        }
      }

      // Step 2.5: Inject Domain Readiness Recommendations (with AI personalization)
      if (context.domainAuditResult) {
        console.log('🔧 [RecommendationV3Service] Step 2.5: Generating Domain Readiness recommendations...');
        const domainRecsRaw = this.generateDomainReadinessRecommendations(context);
        if (domainRecsRaw.length > 0) {
          console.log(`   📋 Generated ${domainRecsRaw.length} raw domain readiness recommendation(s)`);

          // Personalize domain readiness recommendations through AI
          console.log('   🤖 Personalizing domain readiness recommendations with AI...');
          const domainRecs = await this.personalizeDomainReadinessRecommendations(context, domainRecsRaw);
          console.log(`   ✅ Adding ${domainRecs.length} personalized technical recommendations derived from Domain Audit`);
          recommendations = [...domainRecs, ...recommendations];
        } else {
          console.log('   ✨ No critical domain readiness issues found to convert to recommendations.');
        }
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
