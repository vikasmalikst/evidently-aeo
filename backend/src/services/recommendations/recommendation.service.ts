/**
 * Recommendation Engine Service (Enhanced v2)
 * 
 * Generates AI-powered, DATA-DRIVEN recommendations for improving brand visibility, SOA, and sentiment.
 * Uses Cerebras API with QWEN model.
 * 
 * KEY PRINCIPLES:
 * - Every recommendation MUST reference actual detected problems with real numbers
 * - NO generic advice - only recommendations that address specific data issues
 * - Analyzes: Overall metrics, Per-LLM performance, Citation source metrics, Topics
 * - If no problems detected, returns empty array (no fallbacks)
 * 
 * Data Sources Analyzed:
 * 1. Overall brand metrics (visibility, SOA, sentiment) vs competitors
 * 2. LLM-specific performance (ChatGPT, Claude, Perplexity, Gemini, etc.)
 * 3. Citation source metrics (Impact Score, Mention Rate, SOA, Sentiment, Citations)
 * 4. Topic-level performance gaps
 */

import { getCerebrasKey, getCerebrasModel } from '../../utils/api-key-resolver';
import { supabaseAdmin } from '../../config/database';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Single recommendation from the LLM
 */
export interface Recommendation {
  action: string;           // What to do
  reason: string;           // Short rationale that references a detected problem
  explanation: string;      // Longer rationale (4-5 sentences) explaining the recommendation
  citationSource: string;   // Primary citation source that should be prioritized
  impactScore: string;      // Impact score for the source (from citation source data)
  mentionRate: string;      // Mention rate for the source
  soa: string;              // SOA derived from source data
  sentiment: string;        // Sentiment derived from source data
  visibilityScore: string;  // Visibility score derived from source data
  citationCount: number;    // Number of citations for the source
  focusSources: string;     // Human-readable description of which sources to focus on
  contentFocus: string;     // Content generation focus/strategy for the recommendation
  kpi: string;              // Which KPI it impacts (Visibility Index, SOA %, Sentiment Score, etc.)
  expectedBoost: string;    // Expected improvement (e.g., "+5-10%")
  effort: 'Low' | 'Medium' | 'High';
  timeline: string;         // Estimated time (e.g., "2-4 weeks")
  confidence: number;       // 0-100%
  priority: 'High' | 'Medium' | 'Low';
  focusArea: 'visibility' | 'soa' | 'sentiment';
}

/**
 * Response from the recommendation service
 */
export interface RecommendationResponse {
  success: boolean;
  recommendations: Recommendation[];
  message?: string;
  generatedAt?: string;
  brandId?: string;
  brandName?: string;
  problemsDetected?: number;
}

/**
 * Minimal shape of the Cerebras chat completion response we rely on
 */
type CerebrasChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

/**
 * Detected problem from data analysis
 */
interface DetectedProblem {
  id: string;                    // Unique identifier for reference
  type: 'visibility' | 'soa' | 'sentiment' | 'source_coverage' | 'topic_gap' | 'llm_specific' | 'source_impact';
  severity: 'high' | 'medium' | 'low';
  category: 'llm' | 'source' | 'topic' | 'overall';
  
  // Core metrics
  metric: string;                // "Visibility Index", "SOA %", "Sentiment", "Impact Score"
  currentValue: number | string;
  benchmarkValue?: number | string;
  benchmarkSource?: string;      // "Competitor: Acme", "LLM Average", "Source: reddit.com"
  gap?: string;                  // "-26%", "+0.3"
  
  // Context
  llm?: string;                  // "ChatGPT", "Claude", "Perplexity"
  source?: string;               // "reddit.com", "techcrunch.com"
  topic?: string;                // "enterprise security"
  citations?: number;            // Citation count for sources
  impactScore?: number;          // Impact score for sources
  
  description: string;           // Human-readable summary with actual numbers
}

/**
 * LLM-specific metrics
 */
interface LLMMetrics {
  llm: string;
  visibility: number | null;
  soa: number | null;
  sentiment: number | null;
  responseCount: number;
}

/**
 * Source-specific metrics
 */
interface SourceMetrics {
  domain: string;
  mentionRate: number;
  soa: number;
  sentiment: number;
  citations: number;
  impactScore: number;
  visibility: number;
}

/**
 * Brand context with detected problems
 */
interface BrandContext {
  brandId: string;
  brandName: string;
  industry?: string;
  
  // Overall metrics
  visibilityIndex?: number;
  shareOfAnswers?: number;
  sentimentScore?: number;
  
  // Competitor comparison
  competitors?: Array<{
    name: string;
    visibilityIndex?: number;
    shareOfAnswers?: number;
    sentimentScore?: number;
  }>;
  
  // LLM-specific metrics
  llmMetrics?: LLMMetrics[];
  
  // Source metrics
  sourceMetrics?: SourceMetrics[];
  
  // Topic metrics
  topicMetrics?: Array<{
    name: string;
    soa?: number;
    sentiment?: number;
    competitorAvgSoa?: number;
  }>;
  
  // The key output: detected problems
  detectedProblems: DetectedProblem[];
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class RecommendationService {
  private cerebrasApiKey: string | null;
  private cerebrasModel: string;

  constructor() {
    this.cerebrasApiKey = getCerebrasKey();
    this.cerebrasModel = getCerebrasModel();
    
    if (!this.cerebrasApiKey) {
      console.warn('⚠️ [RecommendationService] CEREBRAS_API_KEY not configured');
    }
    console.log(`🤖 [RecommendationService] Initialized with model: ${this.cerebrasModel}`);
  }

  /**
   * Generate recommendations for a brand
   */
  async generateRecommendations(
    brandId: string,
    customerId: string
  ): Promise<RecommendationResponse> {
    console.log(`📊 [RecommendationService] Generating data-driven recommendations for brand: ${brandId}`);

    if (!this.cerebrasApiKey) {
      console.error('❌ [RecommendationService] CEREBRAS_API_KEY not configured');
      return {
        success: false,
        recommendations: [],
        message: 'AI service not configured. Please contact support.'
      };
    }

    try {
      // Step 1: Gather brand context and detect problems
      const context = await this.gatherBrandContext(brandId, customerId);
      
      if (!context) {
        return {
          success: false,
          recommendations: [],
          message: 'No recommendations generated at this time.'
        };
      }

      console.log(`📈 [RecommendationService] Brand: ${context.brandName}, Problems detected: ${context.detectedProblems.length}`);

      // If no problems detected, return empty (no fallbacks)
      if (context.detectedProblems.length === 0) {
        return {
          success: true,
          recommendations: [],
          message: 'No recommendations generated at this time.',
          generatedAt: new Date().toISOString(),
          brandId: context.brandId,
          brandName: context.brandName,
          problemsDetected: 0
        };
      }

      // Step 2: Build prompt with detected problems
      const prompt = this.buildPrompt(context);

      // Step 3: Call Cerebras API
      const recommendations = await this.callCerebrasAPI(prompt);

      if (!recommendations || recommendations.length === 0) {
        return {
          success: true,
          recommendations: [],
          message: 'No recommendations generated at this time.',
          generatedAt: new Date().toISOString(),
          brandId: context.brandId,
          brandName: context.brandName,
          problemsDetected: context.detectedProblems.length
        };
      }

      console.log(`✅ [RecommendationService] Generated ${recommendations.length} data-driven recommendations`);

      return {
        success: true,
        recommendations,
        generatedAt: new Date().toISOString(),
        brandId: context.brandId,
        brandName: context.brandName,
        problemsDetected: context.detectedProblems.length
      };

    } catch (error) {
      console.error('❌ [RecommendationService] Error:', error);
      return {
        success: false,
        recommendations: [],
        message: 'No recommendations generated at this time.'
      };
    }
  }

  /**
   * Gather brand context and detect problems from actual data
   */
  private async gatherBrandContext(
    brandId: string,
    customerId: string
  ): Promise<BrandContext | null> {
    try {
      // Get brand info
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name, industry, summary')
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .single();

      if (brandError || !brand) {
        console.error('❌ [RecommendationService] Brand not found:', brandError);
        return null;
      }

      const detectedProblems: DetectedProblem[] = [];
      let problemCounter = 1;

      // Date range: last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      // ========================================
      // 1. OVERALL BRAND METRICS
      // ========================================
      const { data: overallMetrics } = await supabaseAdmin
        .from('extracted_positions')
        .select('visibility_index, share_of_answers_brand, sentiment_score')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      let visibilityIndex: number | undefined;
      let shareOfAnswers: number | undefined;
      let sentimentScore: number | undefined;

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

      // Detect overall problems
      if (visibilityIndex !== undefined && visibilityIndex < 40) {
        detectedProblems.push({
          id: `P${problemCounter++}`,
          type: 'visibility',
          severity: visibilityIndex < 25 ? 'high' : 'medium',
          category: 'overall',
          metric: 'Visibility Index',
          currentValue: Math.round(visibilityIndex * 10) / 10,
          benchmarkValue: 50,
          benchmarkSource: 'Recommended Threshold',
          gap: `${Math.round(visibilityIndex - 50)}%`,
          description: `Overall visibility index is ${Math.round(visibilityIndex * 10) / 10}%, which is below the recommended 50% threshold`
        });
      }

      if (shareOfAnswers !== undefined && shareOfAnswers < 30) {
        detectedProblems.push({
          id: `P${problemCounter++}`,
          type: 'soa',
          severity: shareOfAnswers < 20 ? 'high' : 'medium',
          category: 'overall',
          metric: 'Share of Answers',
          currentValue: Math.round(shareOfAnswers * 10) / 10,
          benchmarkValue: 35,
          benchmarkSource: 'Recommended Threshold',
          gap: `${Math.round(shareOfAnswers - 35)}%`,
          description: `Share of Answers is ${Math.round(shareOfAnswers * 10) / 10}%, below the recommended 35% threshold`
        });
      }

      if (sentimentScore !== undefined && sentimentScore < 0.3) {
        detectedProblems.push({
          id: `P${problemCounter++}`,
          type: 'sentiment',
          severity: sentimentScore < 0.1 ? 'high' : 'medium',
          category: 'overall',
          metric: 'Sentiment Score',
          currentValue: Math.round(sentimentScore * 100) / 100,
          benchmarkValue: 0.4,
          benchmarkSource: 'Positive Threshold',
          gap: `${Math.round((sentimentScore - 0.4) * 100) / 100}`,
          description: `Sentiment score is ${Math.round(sentimentScore * 100) / 100} (scale: -1 to +1), which is ${sentimentScore < 0.1 ? 'neutral/negative' : 'weakly positive'}`
        });
      }

      // ========================================
      // 2. COMPETITOR COMPARISON
      // ========================================
      const { data: competitors } = await supabaseAdmin
        .from('competitors')
        .select('id, name')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .limit(5);

      const competitorData: BrandContext['competitors'] = [];
      
      if (competitors && competitors.length > 0) {
        for (const comp of competitors) {
          const { data: compMetrics } = await supabaseAdmin
            .from('extracted_positions')
            .select('visibility_index, share_of_answers_brand, sentiment_score')
            .eq('competitor_id', comp.id)
            .gte('created_at', startDate)
            .lte('created_at', endDate);

          let compVis: number | undefined;
          let compSoa: number | undefined;
          let compSent: number | undefined;

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

          competitorData.push({
            name: comp.name,
            visibilityIndex: compVis,
            shareOfAnswers: compSoa,
            sentimentScore: compSent
          });

          // Detect gaps vs this competitor
          if (visibilityIndex !== undefined && compVis !== undefined && compVis > visibilityIndex + 10) {
            detectedProblems.push({
              id: `P${problemCounter++}`,
              type: 'visibility',
              severity: (compVis - visibilityIndex) > 20 ? 'high' : 'medium',
              category: 'overall',
              metric: 'Visibility Index',
              currentValue: Math.round(visibilityIndex * 10) / 10,
              benchmarkValue: Math.round(compVis * 10) / 10,
              benchmarkSource: `Competitor: ${comp.name}`,
              gap: `${Math.round(visibilityIndex - compVis)}%`,
              description: `Your visibility (${Math.round(visibilityIndex * 10) / 10}%) is ${Math.round(compVis - visibilityIndex)}% below ${comp.name} (${Math.round(compVis * 10) / 10}%)`
            });
          }

          if (shareOfAnswers !== undefined && compSoa !== undefined && compSoa > shareOfAnswers + 10) {
            detectedProblems.push({
              id: `P${problemCounter++}`,
              type: 'soa',
              severity: (compSoa - shareOfAnswers) > 15 ? 'high' : 'medium',
              category: 'overall',
              metric: 'Share of Answers',
              currentValue: Math.round(shareOfAnswers * 10) / 10,
              benchmarkValue: Math.round(compSoa * 10) / 10,
              benchmarkSource: `Competitor: ${comp.name}`,
              gap: `${Math.round(shareOfAnswers - compSoa)}%`,
              description: `Your SOA (${Math.round(shareOfAnswers * 10) / 10}%) is ${Math.round(compSoa - shareOfAnswers)}% below ${comp.name} (${Math.round(compSoa * 10) / 10}%)`
            });
          }
        }
      }

      // ========================================
      // 3. LLM-SPECIFIC METRICS
      // ========================================
      const { data: llmData } = await supabaseAdmin
        .from('collector_results')
        .select('collector_type, id')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const llmMetrics: LLMMetrics[] = [];
      const llmGroups = new Map<string, string[]>();

      if (llmData && llmData.length > 0) {
        // Group collector_result IDs by LLM type
        for (const row of llmData) {
          if (row.collector_type) {
            const existing = llmGroups.get(row.collector_type) || [];
            existing.push(row.id);
            llmGroups.set(row.collector_type, existing);
          }
        }

        // Get metrics per LLM
        for (const [llmType, resultIds] of llmGroups.entries()) {
          if (resultIds.length === 0) continue;

          const { data: llmPositions } = await supabaseAdmin
            .from('extracted_positions')
            .select('visibility_index, share_of_answers_brand, sentiment_score')
            .eq('brand_id', brandId)
            .in('collector_result_id', resultIds);

          let llmVis: number | null = null;
          let llmSoa: number | null = null;
          let llmSent: number | null = null;

          if (llmPositions && llmPositions.length > 0) {
            const validVis = llmPositions.filter(m => m.visibility_index != null);
            const validSoa = llmPositions.filter(m => m.share_of_answers_brand != null);
            const validSent = llmPositions.filter(m => m.sentiment_score != null);

            if (validVis.length > 0) {
              llmVis = validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length;
            }
            if (validSoa.length > 0) {
              llmSoa = validSoa.reduce((sum, m) => sum + (m.share_of_answers_brand || 0), 0) / validSoa.length;
            }
            if (validSent.length > 0) {
              llmSent = validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length;
            }
          }

          llmMetrics.push({
            llm: llmType,
            visibility: llmVis,
            soa: llmSoa,
            sentiment: llmSent,
            responseCount: resultIds.length
          });
        }

        // Calculate average across LLMs for comparison
        const avgLlmVis = llmMetrics.filter(l => l.visibility !== null).reduce((sum, l) => sum + (l.visibility || 0), 0) / Math.max(llmMetrics.filter(l => l.visibility !== null).length, 1);
        const avgLlmSoa = llmMetrics.filter(l => l.soa !== null).reduce((sum, l) => sum + (l.soa || 0), 0) / Math.max(llmMetrics.filter(l => l.soa !== null).length, 1);
        const avgLlmSent = llmMetrics.filter(l => l.sentiment !== null).reduce((sum, l) => sum + (l.sentiment || 0), 0) / Math.max(llmMetrics.filter(l => l.sentiment !== null).length, 1);

        // Detect LLM-specific problems
        for (const llm of llmMetrics) {
          // Visibility gap vs average
          if (llm.visibility !== null && avgLlmVis > 0 && llm.visibility < avgLlmVis - 15) {
            detectedProblems.push({
              id: `P${problemCounter++}`,
              type: 'llm_specific',
              severity: (avgLlmVis - llm.visibility) > 25 ? 'high' : 'medium',
              category: 'llm',
              metric: 'Visibility Index',
              currentValue: Math.round(llm.visibility * 10) / 10,
              benchmarkValue: Math.round(avgLlmVis * 10) / 10,
              benchmarkSource: 'Average across other LLMs',
              gap: `${Math.round(llm.visibility - avgLlmVis)}%`,
              llm: llm.llm,
              description: `${llm.llm} visibility is ${Math.round(llm.visibility * 10) / 10}% vs ${Math.round(avgLlmVis * 10) / 10}% average (${Math.round(avgLlmVis - llm.visibility)}% below)`
            });
          }

          // SOA gap vs average
          if (llm.soa !== null && avgLlmSoa > 0 && llm.soa < avgLlmSoa - 10) {
            detectedProblems.push({
              id: `P${problemCounter++}`,
              type: 'llm_specific',
              severity: (avgLlmSoa - llm.soa) > 15 ? 'high' : 'medium',
              category: 'llm',
              metric: 'Share of Answers',
              currentValue: Math.round(llm.soa * 10) / 10,
              benchmarkValue: Math.round(avgLlmSoa * 10) / 10,
              benchmarkSource: 'Average across other LLMs',
              gap: `${Math.round(llm.soa - avgLlmSoa)}%`,
              llm: llm.llm,
              description: `${llm.llm} SOA is ${Math.round(llm.soa * 10) / 10}% vs ${Math.round(avgLlmSoa * 10) / 10}% average (${Math.round(avgLlmSoa - llm.soa)}% below)`
            });
          }

          // Sentiment gap vs average
          if (llm.sentiment !== null && avgLlmSent > 0 && llm.sentiment < avgLlmSent - 0.2) {
            detectedProblems.push({
              id: `P${problemCounter++}`,
              type: 'llm_specific',
              severity: (avgLlmSent - llm.sentiment) > 0.3 ? 'high' : 'medium',
              category: 'llm',
              metric: 'Sentiment Score',
              currentValue: Math.round(llm.sentiment * 100) / 100,
              benchmarkValue: Math.round(avgLlmSent * 100) / 100,
              benchmarkSource: 'Average across other LLMs',
              gap: `${Math.round((llm.sentiment - avgLlmSent) * 100) / 100}`,
              llm: llm.llm,
              description: `${llm.llm} sentiment is ${Math.round(llm.sentiment * 100) / 100} vs ${Math.round(avgLlmSent * 100) / 100} average (${llm.sentiment < 0.1 ? 'much less favorable' : 'less favorable'})`
            });
          }

          // Zero visibility in specific LLM
          if (llm.visibility !== null && llm.visibility < 5 && llm.responseCount >= 5) {
            detectedProblems.push({
              id: `P${problemCounter++}`,
              type: 'llm_specific',
              severity: 'high',
              category: 'llm',
              metric: 'Visibility Index',
              currentValue: Math.round(llm.visibility * 10) / 10,
              llm: llm.llm,
              description: `Brand has very low visibility (${Math.round(llm.visibility * 10) / 10}%) in ${llm.llm} responses (based on ${llm.responseCount} queries)`
            });
          }
        }
      }

      // ========================================
      // 4. CITATION SOURCE METRICS
      // ========================================
      const { data: citations } = await supabaseAdmin
        .from('extracted_citations')
        .select('domain, collector_result_id')
        .eq('brand_id', brandId)
        .gte('created_at', startDate);

      const sourceMetrics: SourceMetrics[] = [];
      const sourceMap = new Map<string, { domain: string; collectorIds: Set<string>; count: number }>();

      if (citations && citations.length > 0) {
        // Aggregate by domain
        for (const cit of citations) {
          if (cit.domain) {
            const normalized = cit.domain.toLowerCase().replace(/^www\./, '');
            const existing = sourceMap.get(normalized) || { domain: normalized, collectorIds: new Set(), count: 0 };
            if (cit.collector_result_id) {
              existing.collectorIds.add(cit.collector_result_id);
            }
            existing.count++;
            sourceMap.set(normalized, existing);
          }
        }

        // Get total collector results for mention rate calculation
        const { count: totalResults } = await supabaseAdmin
          .from('collector_results')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brandId)
          .gte('created_at', startDate);

        const totalCollectorResults = totalResults || 1;

        // Calculate metrics per source
        for (const [domain, sourceData] of sourceMap.entries()) {
          if (sourceData.count < 3) continue; // Skip low-volume sources

          const collectorIds = Array.from(sourceData.collectorIds);
          
          // Get SOA and sentiment for results citing this source
          const { data: sourcePositions } = await supabaseAdmin
            .from('extracted_positions')
            .select('share_of_answers_brand, sentiment_score, visibility_index')
            .eq('brand_id', brandId)
            .in('collector_result_id', collectorIds.slice(0, 100)); // Limit for performance

          let sourceSoa = 0;
          let sourceSentiment = 0;
          let sourceVisibility = 0;

          if (sourcePositions && sourcePositions.length > 0) {
            const validSoa = sourcePositions.filter(p => p.share_of_answers_brand != null);
            const validSent = sourcePositions.filter(p => p.sentiment_score != null);
            const validVis = sourcePositions.filter(p => p.visibility_index != null);

            if (validSoa.length > 0) {
              sourceSoa = validSoa.reduce((sum, p) => sum + (p.share_of_answers_brand || 0), 0) / validSoa.length;
            }
            if (validSent.length > 0) {
              sourceSentiment = validSent.reduce((sum, p) => sum + (p.sentiment_score || 0), 0) / validSent.length;
            }
            if (validVis.length > 0) {
              sourceVisibility = validVis.reduce((sum, p) => sum + (p.visibility_index || 0), 0) / validVis.length;
            }
          }

          const mentionRate = (sourceData.collectorIds.size / totalCollectorResults) * 100;
          
          // Calculate impact score: 35% SOA + 35% Visibility + 30% Usage
          const maxUsage = Math.max(...Array.from(sourceMap.values()).map(s => s.count));
          const usageNorm = maxUsage > 0 ? (sourceData.count / maxUsage) * 10 : 0;
          const soaNorm = (sourceSoa / 100) * 10;
          const visNorm = (sourceVisibility / 100) * 10;
          const impactScore = (0.35 * soaNorm + 0.35 * visNorm + 0.3 * usageNorm);

          sourceMetrics.push({
            domain,
            mentionRate: Math.round(mentionRate * 10) / 10,
            soa: Math.round(sourceSoa * 10) / 10,
            sentiment: Math.round(sourceSentiment * 100) / 100,
            citations: sourceData.count,
            impactScore: Math.round(impactScore * 10) / 10,
            visibility: Math.round(sourceVisibility * 10) / 10
          });
        }

        // Sort by citations (most cited first)
        sourceMetrics.sort((a, b) => b.citations - a.citations);

        // Calculate averages for comparison
        const avgSourceSoa = sourceMetrics.reduce((sum, s) => sum + s.soa, 0) / Math.max(sourceMetrics.length, 1);
        const avgSourceSentiment = sourceMetrics.reduce((sum, s) => sum + s.sentiment, 0) / Math.max(sourceMetrics.length, 1);

        // Detect source-specific problems
        for (const source of sourceMetrics.slice(0, 10)) { // Top 10 sources
          // Low SOA on high-citation source
          if (source.citations >= 10 && source.soa < avgSourceSoa - 10) {
            detectedProblems.push({
              id: `P${problemCounter++}`,
              type: 'source_impact',
              severity: source.citations >= 20 ? 'high' : 'medium',
              category: 'source',
              metric: 'Share of Answers',
              currentValue: source.soa,
              benchmarkValue: Math.round(avgSourceSoa * 10) / 10,
              benchmarkSource: 'Average across sources',
              gap: `${Math.round(source.soa - avgSourceSoa)}%`,
              source: source.domain,
              citations: source.citations,
              impactScore: source.impactScore,
              description: `On ${source.domain} (${source.citations} citations), SOA is ${source.soa}% vs ${Math.round(avgSourceSoa * 10) / 10}% average (${Math.round(avgSourceSoa - source.soa)}% below)`
            });
          }

          // Negative sentiment on source
          if (source.citations >= 5 && source.sentiment < 0) {
            detectedProblems.push({
              id: `P${problemCounter++}`,
              type: 'sentiment',
              severity: source.sentiment < -0.2 ? 'high' : 'medium',
              category: 'source',
              metric: 'Sentiment Score',
              currentValue: source.sentiment,
              benchmarkValue: Math.round(avgSourceSentiment * 100) / 100,
              benchmarkSource: 'Average across sources',
              source: source.domain,
              citations: source.citations,
              description: `Sentiment on ${source.domain} is ${source.sentiment} (negative) vs ${Math.round(avgSourceSentiment * 100) / 100} average (${source.citations} citations)`
            });
          }

          // Low impact score despite high citations
          if (source.citations >= 15 && source.impactScore < 3) {
            detectedProblems.push({
              id: `P${problemCounter++}`,
              type: 'source_impact',
              severity: 'medium',
              category: 'source',
              metric: 'Impact Score',
              currentValue: source.impactScore,
              benchmarkValue: 5,
              benchmarkSource: 'Target Impact Score',
              source: source.domain,
              citations: source.citations,
              impactScore: source.impactScore,
              description: `${source.domain} has ${source.citations} citations but low impact score (${source.impactScore}/10) - opportunity to improve brand presence`
            });
          }
        }
      }

      // ========================================
      // 5. TOPIC-LEVEL METRICS
      // ========================================
      const { data: topics } = await supabaseAdmin
        .from('brand_topics')
        .select('id, topic_name')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .limit(10);

      const topicMetrics: BrandContext['topicMetrics'] = [];

      if (topics && topics.length > 0) {
        // Get topic-level performance (simplified - would need proper topic-result mapping)
        for (const topic of topics) {
          topicMetrics.push({
            name: topic.topic_name
          });
        }
      }

      // Sort problems by severity and limit to most important ones
      detectedProblems.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      // Keep top 15 problems max
      const topProblems = detectedProblems.slice(0, 15);

      console.log(`🔍 [RecommendationService] Detected ${topProblems.length} problems for ${brand.name}`);

      return {
        brandId: brand.id,
        brandName: brand.name,
        industry: brand.industry || undefined,
        visibilityIndex,
        shareOfAnswers,
        sentimentScore,
        competitors: competitorData,
        llmMetrics,
        sourceMetrics: sourceMetrics.slice(0, 10),
        topicMetrics,
        detectedProblems: topProblems
      };

    } catch (error) {
      console.error('❌ [RecommendationService] Error gathering context:', error);
      return null;
    }
  }

  /**
   * Build prompt with detected problems requiring data-driven recommendations
   */
  private buildPrompt(context: BrandContext): string {
    // Format detected problems for the prompt
    const problemsList = context.detectedProblems.map(p => {
      let problemText = `[${p.id}] ${p.description}`;
      if (p.llm) problemText += ` | LLM: ${p.llm}`;
      if (p.source) problemText += ` | Source: ${p.source}`;
      if (p.citations) problemText += ` | Citations: ${p.citations}`;
      return problemText;
    }).join('\n');

    // Format LLM metrics summary
    const llmSummary = context.llmMetrics && context.llmMetrics.length > 0
      ? context.llmMetrics.map(l => 
          `${l.llm}: Visibility ${l.visibility !== null ? Math.round(l.visibility * 10) / 10 + '%' : 'N/A'}, SOA ${l.soa !== null ? Math.round(l.soa * 10) / 10 + '%' : 'N/A'}, Sentiment ${l.sentiment !== null ? Math.round(l.sentiment * 100) / 100 : 'N/A'} (${l.responseCount} responses)`
        ).join('\n  ')
      : 'No LLM-specific data available';

    // Format source metrics summary
    const sourceSummary = context.sourceMetrics && context.sourceMetrics.length > 0
      ? context.sourceMetrics.slice(0, 8).map(s =>
          `${s.domain}: ${s.citations} citations, Impact ${s.impactScore}/10, Mention Rate ${s.mentionRate}%, SOA ${s.soa}%, Sentiment ${s.sentiment}, Visibility ${s.visibility}%`
        ).join('\n  ')
      : 'No source data available';

    // Format competitor summary
    const competitorSummary = context.competitors && context.competitors.length > 0
      ? context.competitors.map(c => {
          const parts = [c.name];
          if (c.visibilityIndex !== undefined) parts.push(`Vis: ${Math.round(c.visibilityIndex * 10) / 10}%`);
          if (c.shareOfAnswers !== undefined) parts.push(`SOA: ${Math.round(c.shareOfAnswers * 10) / 10}%`);
          if (c.sentimentScore !== undefined) parts.push(`Sent: ${Math.round(c.sentimentScore * 100) / 100}`);
          return parts.join(' | ');
        }).join('\n  ')
      : 'No competitor data';

    return `You are a senior Brand/AEO (Answer Engine Optimization) expert. You have been given ACTUAL DATA about a brand's performance. Your task is to generate SPECIFIC, DATA-DRIVEN content generation strategies and recommendations that prioritize the highest-leverage citation sources.

## CRITICAL RULES - READ CAREFULLY
1. Each recommendation MUST directly address one of the detected problems listed below.
2. The "reason" field MUST reference the problem ID (e.g., "[P1]") and include the ACTUAL NUMBERS from the data.
3. Every recommendation must explain: (a) what specific problem it solves, (b) why this action will help based on the data, and (c) which source + content pairing will move the metric.
4. When a problem references a specific LLM or source, the recommendation must stay focused on that entity.
5. Use the citation source metrics (domain, impact score, mention rate, SOA, sentiment, citations, visibility) to decide where to invest.
6. Generate ONLY as many recommendations as there are addressable problems (max 10).

## Brand Information
- Brand Name: ${context.brandName}
- Industry: ${context.industry || 'Not specified'}
- Overall Visibility: ${context.visibilityIndex !== undefined ? Math.round(context.visibilityIndex * 10) / 10 + '%' : 'N/A'}
- Overall SOA: ${context.shareOfAnswers !== undefined ? Math.round(context.shareOfAnswers * 10) / 10 + '%' : 'N/A'}
- Overall Sentiment: ${context.sentimentScore !== undefined ? Math.round(context.sentimentScore * 100) / 100 : 'N/A'}

## Competitor Metrics
  ${competitorSummary}

## Performance by AI Engine (LLM)
  ${llmSummary}

## Top Citation Sources (with metrics)
  ${sourceSummary}

## Content Generation Strategy Guidance (be ultra-specific, topic-first)
1. Use the citation source data above when identifying which source and content combo to recommend.
2. Stay anchored to the topic in the detected problem. Name the topic explicitly and propose a concrete asset for it (e.g., "Create a collection page for vacation wear", "Write a blog on 'Comprehensive guide for summer essentials'", "Get a linen-pants-focused backlink from Vogue", "Contribute to r/fashion with trendy insights").
3. Describe which sources should be prioritized ("focusSources") and what content pieces or themes should be produced ("contentFocus") — keep both tightly tied to the topic.
4. Tie your recommendation back to the metrics in the source data (impact score, mention rate, SOA, sentiment, citations, visibility) and the detected problem you are solving.
5. Craft a concise explanation (4-5 sentences) that explains why investing in that specific source + topic-focused content will move the targeted KPI. Avoid generic advice like "improve your content" — always specify the asset type, topic, and source.

## DETECTED PROBLEMS (${context.detectedProblems.length} issues found)
${problemsList}

## Your Task
For each detected problem above, generate ONE specific recommendation that:
1. References the problem ID in the reason (e.g., "[P1]").
2. Includes actual numbers from the problem description.
3. Explains WHY this action will improve the specific metric.
4. Ties the action to a citation source and a content focus, both explicitly linked to the topic in the problem.

Respond with a JSON array. Each object must have:
- action: Specific action to take (1-2 sentences, be specific to the problem).
- reason: Reference problem ID + actual data + why this helps (e.g., "[P1] Your ChatGPT visibility is 32% vs 58% average. ChatGPT prioritizes structured content with clear headers...").
- explanation: A 4-5 sentence rationale that explains why investing in the cited source + content focus will improve the selected KPI.
- citationSource: The primary citation source (domain) you recommend investing in.
- impactScore: Impact score (from the source data) for that citation source.
- mentionRate: Mention rate (%) for that source.
- soa: Source-level SOA (%).
- sentiment: Source-level sentiment score.
- visibilityScore: Source-level visibility score.
- citationCount: Number of citations for the source.
- focusSources: What sources to prioritize (can be multiple, tied to data from the top citation sources).
- contentFocus: What content types or topics to focus on when addressing the problem.
- kpi: "Visibility Index", "SOA %", or "Sentiment Score".
- expectedBoost: Realistic estimate (e.g., "+10-15%").
- effort: "Low", "Medium", or "High".
- timeline: Realistic timeline (e.g., "2-4 weeks").
- confidence: 0-100 (how confident you are this will work).
- priority: "High", "Medium", or "Low".
- focusArea: "visibility", "soa", or "sentiment".

RESPOND ONLY WITH THE JSON ARRAY. No markdown, no explanation.`;
  }

  /**
   * Call Cerebras API
   */
  private async callCerebrasAPI(prompt: string): Promise<Recommendation[]> {
    try {
      console.log('🚀 [RecommendationService] Calling Cerebras API...');

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
              content: 'You are a senior Brand/AEO expert. Generate data-driven recommendations based on actual metrics. Always reference specific problem IDs and include real numbers in your reasoning. Respond only with valid JSON arrays.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.5 // Lower temperature for more focused responses
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [RecommendationService] Cerebras API error:', response.status, errorText);
        return [];
      }

      const data = await response.json();
      
      const chatData = data as CerebrasChatResponse;

      if (!chatData.choices?.[0]?.message?.content) {
        console.error('❌ [RecommendationService] Invalid response structure');
        return [];
      }

      const content = chatData.choices[0].message.content;
      console.log('📝 [RecommendationService] Response length:', content?.length || 0);

      return this.parseRecommendations(content);

    } catch (error) {
      console.error('❌ [RecommendationService] Error calling API:', error);
      return [];
    }
  }

  /**
   * Parse and validate recommendations
   */
  private parseRecommendations(content: string): Recommendation[] {
    const safeString = (value: unknown, fallback = 'N/A') => {
      if (value === undefined || value === null) return fallback;
      const str = String(value).trim();
      return str.length === 0 ? fallback : str;
    };

    const safeNumber = (value: unknown, fallback = 0) => {
      if (typeof value === 'number' && !isNaN(value)) return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) return parsed;
      }
      return fallback;
    };

    try {
      let cleaned = content.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        console.warn('⚠️ [RecommendationService] Response is not an array');
        return [];
      }

      const validRecommendations: Recommendation[] = [];

      for (const rec of parsed) {
        if (!rec.action || typeof rec.action !== 'string') continue;
        if (!rec.reason || typeof rec.reason !== 'string') continue;
        const explanationText = typeof rec.explanation === 'string' ? rec.explanation.trim() : '';
        if (!explanationText) continue;

        const hasReference = /\[P\d+\]/.test(rec.reason);
        if (!hasReference) {
          console.warn('⚠️ [RecommendationService] Skipping recommendation without problem reference');
          continue;
        }

        const citationSource = safeString(
          rec.citationSource ?? rec.citation_source ?? rec.source ?? rec.domain ?? '',
          'N/A'
        );
        const impactScore = safeString(
          rec.impactScore ?? rec.impact_score ?? rec.impact ?? '',
          'N/A'
        );
        const mentionRate = safeString(
          rec.mentionRate ?? rec.mention_rate ?? rec.mention ?? '',
          'N/A'
        );
        const soa = safeString(
          rec.soa ?? rec.impact_soa ?? rec.source_soa ?? '',
          'N/A'
        );
        const sentiment = safeString(
          rec.sentiment ?? rec.sentimentScore ?? rec.sentiment_score ?? '',
          'N/A'
        );
        const visibilityScore = safeString(
          rec.visibilityScore ?? rec.visibility_score ?? rec.visibility ?? '',
          'N/A'
        );
        const citationCount = safeNumber(
          rec.citationCount ?? rec.citation_count ?? rec.citations ?? rec.citation ?? 0,
          0
        );
        const focusSources = safeString(
          rec.focusSources ?? rec.focus_sources ?? rec.focus_source ?? '',
          'N/A'
        );
        const contentFocus = safeString(
          rec.contentFocus ?? rec.content_focus ?? rec.content ?? '',
          'N/A'
        );

        const validRec: Recommendation = {
          action: rec.action.trim(),
          reason: rec.reason.trim(),
          explanation: explanationText,
          citationSource,
          impactScore,
          mentionRate,
          soa,
          sentiment,
          visibilityScore,
          citationCount,
          focusSources,
          contentFocus,
          kpi: this.normalizeKpi(rec.kpi),
          expectedBoost: (rec.expectedBoost || rec.expected_boost || 'TBD').trim(),
          effort: this.normalizeEffort(rec.effort),
          timeline: (rec.timeline || '2-4 weeks').trim(),
          confidence: this.normalizeConfidence(rec.confidence),
          priority: this.normalizePriority(rec.priority),
          focusArea: this.normalizeFocusArea(rec.focusArea || rec.focus_area)
        };

        validRecommendations.push(validRec);

        if (validRecommendations.length >= 10) break;
      }

      console.log(`✅ [RecommendationService] Parsed ${validRecommendations.length} valid recommendations`);
      return validRecommendations;

    } catch (error) {
      console.error('❌ [RecommendationService] Error parsing:', error);
      return [];
    }
  }

  private normalizeKpi(kpi: string | undefined): string {
    if (!kpi) return 'Visibility Index';
    const lower = kpi.toLowerCase();
    if (lower.includes('soa') || lower.includes('share')) return 'SOA %';
    if (lower.includes('sentiment')) return 'Sentiment Score';
    return 'Visibility Index';
  }

  private normalizeEffort(effort: string | undefined): 'Low' | 'Medium' | 'High' {
    if (!effort) return 'Medium';
    const lower = effort.toLowerCase();
    if (lower.includes('low')) return 'Low';
    if (lower.includes('high')) return 'High';
    return 'Medium';
  }

  private normalizeConfidence(confidence: number | string | undefined): number {
    if (confidence === undefined || confidence === null) return 70;
    const num = typeof confidence === 'string' ? parseFloat(confidence) : confidence;
    if (isNaN(num)) return 70;
    if (num > 100) return 100;
    if (num < 0) return 0;
    return Math.round(num);
  }

  private normalizePriority(priority: string | undefined): 'High' | 'Medium' | 'Low' {
    if (!priority) return 'Medium';
    const lower = priority.toLowerCase();
    if (lower.includes('high')) return 'High';
    if (lower.includes('low')) return 'Low';
    return 'Medium';
  }

  private normalizeFocusArea(focusArea: string | undefined): 'visibility' | 'soa' | 'sentiment' {
    if (!focusArea) return 'visibility';
    const lower = focusArea.toLowerCase();
    if (lower.includes('soa') || lower.includes('share')) return 'soa';
    if (lower.includes('sentiment')) return 'sentiment';
    return 'visibility';
  }
}

export const recommendationService = new RecommendationService();
