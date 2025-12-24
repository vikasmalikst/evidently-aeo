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
  
  // Workflow flags
  isApproved?: boolean;
  isContentGenerated?: boolean;
  isCompleted?: boolean;
  completedAt?: string;
  kpiBeforeValue?: number;
  kpiAfterValue?: number;
}

/**
 * Response from V3 recommendation service
 */
export interface RecommendationV3Response {
  success: boolean;
  generationId?: string;
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
interface BrandContextV3 {
  brandId: string;
  brandName: string;
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
  }>;
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
      // Get brand info
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name, industry, summary')
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .single();

      if (brandError || !brand) {
        console.error('❌ [RecommendationV3Service] Brand not found:', brandError);
        return null;
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

      // Get competitors
      const { data: competitors } = await supabaseAdmin
        .from('competitors')
        .select('id, name')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .limit(5);

      const competitorData: BrandContextV3['competitors'] = [];
      
      if (competitors && competitors.length > 0) {
        for (const comp of competitors) {
          // TODO: Migrate competitor metrics query to new schema
          // For now, using legacy query for competitor-specific metrics
          // This requires querying competitor_metrics joined with metric_facts for date filtering
          const { data: compMetrics } = await supabaseAdmin
            .from('extracted_positions')
            .select('visibility_index, share_of_answers_brand, sentiment_score')
            .eq('competitor_id', comp.id)
            .gte('created_at', currentStartDate)
            .lte('created_at', currentEndDate);

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
        }
      }

      // Get source metrics from citations table (following same pattern as source-attribution.service.ts)
      // Limit to avoid performance issues with large datasets
      console.log('📊 [RecommendationV3Service] Fetching citations from database...');
      const citationsStartTime = Date.now();
      const { data: citations, error: citationsError } = await supabaseAdmin
        .from('citations')
        .select('domain, collector_result_id, usage_count')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('created_at', currentStartDate)
        .lte('created_at', currentEndDate)
        .limit(10000); // Limit to prevent query timeout with very large datasets
      
      if (citationsError) {
        console.error('❌ [RecommendationV3Service] Error fetching citations:', citationsError);
      } else {
        console.log(`✅ [RecommendationV3Service] Fetched ${citations?.length || 0} citations in ${Date.now() - citationsStartTime}ms`);
      }

      const sourceMetrics: BrandContextV3['sourceMetrics'] = [];
      const sourceMap = new Map<string, { domain: string; collectorIds: Set<number>; count: number }>();

      if (citations && citations.length > 0) {
        // Group citations by domain (normalized, following source-attribution pattern)
        for (const cit of citations) {
          if (cit.domain) {
            const normalized = cit.domain.toLowerCase().replace(/^www\./, '').trim();
            if (!normalized || normalized === 'unknown') continue;
            
            const existing = sourceMap.get(normalized) || { domain: normalized, collectorIds: new Set<number>(), count: 0 };
            if (cit.collector_result_id && typeof cit.collector_result_id === 'number') {
              existing.collectorIds.add(cit.collector_result_id);
            }
            // Use usage_count if available, otherwise count as 1
            existing.count += cit.usage_count || 1;
            sourceMap.set(normalized, existing);
          }
        }

        // Get total collector results for mention rate calculation
        const { count: totalResults } = await supabaseAdmin
          .from('collector_results')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brandId)
          .eq('customer_id', customerId)
          .gte('created_at', currentStartDate)
          .lte('created_at', currentEndDate);

        const totalCollectorResults = totalResults || 1;

        // Batch fetch all positions at once instead of per-domain (much faster)
        console.log('📊 [RecommendationV3Service] Collecting unique collector_result_ids...');
        const allCollectorIds = Array.from(new Set(
          Array.from(sourceMap.values())
            .flatMap(s => Array.from(s.collectorIds))
            .filter((id): id is number => typeof id === 'number')
        ));
        
        console.log(`📊 [RecommendationV3Service] Found ${allCollectorIds.length} unique collector_result_ids across ${sourceMap.size} domains`);
        
        // Fetch all positions in batches to avoid query size limits
        const positionsStartTime = Date.now();
        const allPositionsMap = new Map<number, Array<{
          share_of_answers_brand: number | null;
          sentiment_score: number | null;
          visibility_index: number | null;
        }>>();
        
        if (USE_OPTIMIZED_RECOMMENDATIONS) {
          // Use optimized helper to fetch brand metrics
          const batchSize = 100;
          for (let i = 0; i < allCollectorIds.length; i += batchSize) {
            const batch = allCollectorIds.slice(i, i + batchSize);
            const result = await optimizedMetricsHelper.fetchBrandMetrics({
              collectorResultIds: batch,
              brandId,
              customerId,
              includeSentiment: true,
            });
            
            if (result.success && result.data.length > 0) {
              for (const pos of result.data) {
                if (pos.collector_result_id) {
                  if (!allPositionsMap.has(pos.collector_result_id)) {
                    allPositionsMap.set(pos.collector_result_id, []);
                  }
                  allPositionsMap.get(pos.collector_result_id)!.push({
                    share_of_answers_brand: pos.share_of_answers,
                    sentiment_score: pos.sentiment_score,
                    visibility_index: pos.visibility_index
                  });
                }
              }
            }
          }
        } else {
          // Legacy path
          const batchSize = 100;
          for (let i = 0; i < allCollectorIds.length; i += batchSize) {
            const batch = allCollectorIds.slice(i, i + batchSize);
            const { data: batchPositions } = await supabaseAdmin
              .from('extracted_positions')
              .select('collector_result_id, share_of_answers_brand, sentiment_score, visibility_index')
              .eq('brand_id', brandId)
              .in('collector_result_id', batch);
            
            if (batchPositions) {
              for (const pos of batchPositions) {
                if (pos.collector_result_id) {
                  if (!allPositionsMap.has(pos.collector_result_id)) {
                    allPositionsMap.set(pos.collector_result_id, []);
                  }
                  allPositionsMap.get(pos.collector_result_id)!.push({
                    share_of_answers_brand: pos.share_of_answers_brand,
                    sentiment_score: pos.sentiment_score,
                    visibility_index: pos.visibility_index
                  });
                }
              }
            }
          }
        }
        console.log(`✅ [RecommendationV3Service] Fetched positions for ${allPositionsMap.size} collector_result_ids in ${Date.now() - positionsStartTime}ms`);

        // First pass: Calculate all source metrics and find max values for normalization
        console.log('📊 [RecommendationV3Service] Calculating metrics for each domain...');
        const sourceMetricsData: Array<{
          domain: string;
          mentionRate: number;
          soa: number;
          sentiment: number;
          citations: number;
          visibility: number;
          rawSentiment: number; // For max calculation
        }> = [];
        
        for (const [domain, sourceData] of sourceMap.entries()) {
          const collectorIds = Array.from(sourceData.collectorIds);
          
          if (collectorIds.length === 0) continue;
          
          // Get positions for this domain's collector_result_ids from pre-fetched map
          const sourcePositions: Array<{
            share_of_answers_brand: number | null;
            sentiment_score: number | null;
            visibility_index: number | null;
          }> = [];
          
          for (const collectorId of collectorIds) {
            const positions = allPositionsMap.get(collectorId);
            if (positions) {
              sourcePositions.push(...positions);
            }
          }

          let sourceSoa = 0;
          let sourceSentiment = 0;
          let sourceVisibility = 0;

          if (sourcePositions.length > 0) {
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
          
          sourceMetricsData.push({
            domain,
            mentionRate: Math.round(mentionRate * 10) / 10,
            soa: Math.round(sourceSoa * 10) / 10,
            sentiment: Math.round(sourceSentiment * 100) / 100,
            citations: sourceData.count,
            visibility: Math.round(sourceVisibility * 10) / 10,
            rawSentiment: sourceSentiment // Keep raw for max calculation
          });
        }
        
        // Calculate max values for normalization (same as Citations Sources page)
        // Citations Sources page (source-attribution.service.ts lines 687-689):
        // - Calculates average sentiment per source first
        // - Then finds max of those averages
        const maxCitations = Math.max(...sourceMetricsData.map(s => s.citations), 1);
        const avgSentimentPerSource = sourceMetricsData
          .map(s => s.rawSentiment)
          .filter(s => s !== 0 && s !== null && s !== undefined);
        const maxSentiment = avgSentimentPerSource.length > 0 ? Math.max(...avgSentimentPerSource.map(Math.abs), 1) : 1;
        
        // Second pass: Calculate Value score using normalized values (same as Citations Sources page)
        for (const sourceData of sourceMetricsData) {
          // Normalize exactly as Citations Sources page does (source-attribution.service.ts lines 715-720)
          const normalizedVisibility = Math.min(100, Math.max(0, sourceData.visibility)); // Already 0-100
          const normalizedSOA = Math.min(100, Math.max(0, sourceData.soa)); // Already 0-100
          
          // Sentiment normalization: Citations Sources page normalizes relative to max sentiment in dataset
          // source-attribution.service.ts line 718: (avgSentiment / maxSentiment) * 100
          // Note: sentiment_score is in -1 to 1 range, Citations Sources uses absolute values for normalization
          const normalizedSentiment = maxSentiment > 0 
            ? Math.min(100, Math.max(0, (Math.abs(sourceData.rawSentiment) / maxSentiment) * 100))
            : 0;
          
          const normalizedCitations = maxCitations > 0 ? Math.min(100, (sourceData.citations / maxCitations) * 100) : 0;
          
          // Value score: 25% each for 4 metrics (since we don't have topics, distribute the 20% topics weight)
          // This ensures top sources match Citations Sources page ranking
          const valueScore = (
            (normalizedVisibility * 0.25) +
            (normalizedSOA * 0.25) +
            (normalizedSentiment * 0.25) +
            (normalizedCitations * 0.25)
          );

          sourceMetrics.push({
            domain: sourceData.domain,
            mentionRate: sourceData.mentionRate,
            soa: sourceData.soa,
            sentiment: sourceData.sentiment,
            citations: sourceData.citations,
            impactScore: Math.round(valueScore * 10) / 10, // Store as impactScore for compatibility (this is the Value score)
            visibility: sourceData.visibility
          });
        }
        
        // Sort by Value score (same as Citations Sources page): Value descending, then mentionRate as tiebreaker
        // This matches source-attribution.service.ts line 789: sources.sort((a, b) => (b.value || 0) - (a.value || 0) || b.mentionRate - a.mentionRate)
        sourceMetrics.sort((a, b) => {
          const valueDiff = (b.impactScore - a.impactScore);
          if (Math.abs(valueDiff) > 0.01) return valueDiff; // Value score difference
          return b.mentionRate - a.mentionRate; // Tiebreaker: mention rate
        });
        
        // Take top 10 only (matching Citations Sources page top sources)
        const top10Sources = sourceMetrics.slice(0, 10);
        console.log(`✅ [RecommendationV3Service] Processed ${sourceMetrics.length} sources, top 10 will be used for recommendations`);
        console.log(`📊 [RecommendationV3Service] Top 10 sources by Value score (matching Citations Sources page):`);
        top10Sources.forEach((s, idx) => {
          console.log(`  ${idx + 1}. ${s.domain} - Value: ${s.impactScore}, Citations: ${s.citations}, SOA: ${s.soa}%, Visibility: ${s.visibility}, Sentiment: ${s.sentiment}`);
        });
        
        // Use only top 10
        sourceMetrics.length = 0;
        sourceMetrics.push(...top10Sources);
      } else {
        console.warn('⚠️ [RecommendationV3Service] No citations found for this brand in the date range');
      }

      return {
        brandId: brand.id,
        brandName: brand.name,
        industry: brand.industry || undefined,
        visibilityIndex,
        shareOfAnswers,
        sentimentScore,
        trends,
        competitors: competitorData,
        sourceMetrics: sourceMetrics.slice(0, 10) // Already sorted by Value score (top 10 only)
      };

    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error gathering context:', error);
      return null;
    }
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

      if (!Array.isArray(parsed)) {
        console.error('❌ [RecommendationV3Service] KPI response is not an array. Type:', typeof parsed);
        return [];
      }

      const kpis: IdentifiedKPI[] = parsed.map((kpi: any, index: number) => ({
        kpiName: String(kpi.kpiName || 'Unknown KPI'),
        kpiDescription: String(kpi.kpiDescription || ''),
        currentValue: typeof kpi.currentValue === 'number' ? kpi.currentValue : undefined,
        targetValue: typeof kpi.targetValue === 'number' ? kpi.targetValue : undefined,
        displayOrder: index
      }));

      console.log(`✅ [RecommendationV3Service] Identified ${kpis.length} KPIs`);
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
    context: BrandContextV3
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
          parts.push(')');
          return parts.join(', ');
        }).join('\n  ')
      : 'No source data available';
    
    // Create a simple list of exact domain names for strict matching (top 10 only)
    const exactDomains = context.sourceMetrics && context.sourceMetrics.length > 0
      ? context.sourceMetrics.slice(0, 10).map(s => s.domain)
      : [];

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

Brand Performance
- Name: ${context.brandName}
- Industry: ${context.industry || 'Not specified'}
${brandLines.join('\n')}

Available Citation Sources (you MUST use ONLY these exact domains - copy them EXACTLY):
These are the top 10 sources from the Citations Sources page, sorted by Value score (composite of Visibility, SOA, Sentiment, and Citations).
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

    try {
      let content: string | null = null;
      let providerUsed = 'none';

      // Try OpenRouter first (primary) with timeout protection
      try {
        console.log('🚀 [RecommendationV3Service] Attempting OpenRouter API (primary)...');
        const openRouterStartTime = Date.now();
        
        // Add timeout wrapper for OpenRouter call
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OpenRouter request timeout after 90 seconds')), 90000);
        });
        
        const openRouterPromise = openRouterCollectorService.executeQuery({
          collectorType: 'content',
          prompt,
          maxTokens: 4000,
          temperature: 0.5,
          topP: 0.9,
          enableWebSearch: false
        });
        
        const or = await Promise.race([openRouterPromise, timeoutPromise]) as any;
        const openRouterDuration = Date.now() - openRouterStartTime;
        
        content = or.response;
        if (content) {
          providerUsed = 'openrouter';
          console.log(`✅ [RecommendationV3Service] OpenRouter API succeeded (primary provider) in ${openRouterDuration}ms`);
        } else {
          console.warn('⚠️ [RecommendationV3Service] OpenRouter returned empty content');
        }
      } catch (e: any) {
        console.error('❌ [RecommendationV3Service] OpenRouter API failed:', e.message || e);
        if (e.message?.includes('timeout')) {
          console.error('⏱️ [RecommendationV3Service] OpenRouter request timed out, trying Cerebras fallback...');
        }
      }

      // Fallback to Cerebras if OpenRouter failed
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
              max_tokens: 4000,
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

        const normalizePercent = (value: number | null | undefined) => {
          if (value === null || value === undefined) return null;
          return Math.round(value * 10) / 10;
        };

        const normalizeSentiment100 = (value: number | null | undefined) => {
          if (value === null || value === undefined) return null;
          return Math.round(Math.max(0, Math.min(100, ((value + 1) / 2) * 100)) * 10) / 10;
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
          // Use actual source data, not LLM-generated values
          impactScore: matchingSource ? String(normalizePercent(matchingSource.impactScore) || matchingSource.impactScore) : null,
          mentionRate: matchingSource && Number.isFinite(matchingSource.mentionRate) 
            ? String(normalizePercent(matchingSource.mentionRate)) 
            : null,
          soa: matchingSource && matchingSource.soa !== null && matchingSource.soa !== undefined
            ? String(normalizePercent(matchingSource.soa))
            : null,
          sentiment: matchingSource && matchingSource.sentiment !== null && matchingSource.sentiment !== undefined
            ? String(normalizeSentiment100(matchingSource.sentiment))
            : null,
          visibilityScore: matchingSource && matchingSource.visibility !== null && matchingSource.visibility !== undefined
            ? String(normalizePercent(matchingSource.visibility))
            : null,
          citationCount: matchingSource ? matchingSource.citations : 0,
          focusSources: rec.focusSources || rec.citationSource,
          contentFocus: rec.contentFocus || rec.action,
          timeline: rec.timeline || '2-4 weeks',
          confidence: rec.confidence || 70
        };
      });

      // Log source data matching for debugging
      const matchedSources = recommendations.filter(r => r.impactScore !== null).length;
      const unmatchedSources = recommendations.length - matchedSources;
      console.log(`✅ [RecommendationV3Service] Generated ${recommendations.length} recommendations`);
      console.log(`📊 [RecommendationV3Service] Source data matched: ${matchedSources}, unmatched: ${unmatchedSources}`);
      
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

    const prompt = `You are a Brand/AEO expert. Generate 2-3 actionable recommendations for EACH identified KPI below.

Return ONLY a JSON array. Each recommendation must:
- Be specific and actionable
- Target one of the identified KPIs
- Reference actual citation sources from the "Top Citation Sources" list
- Include effort level (Low/Medium/High) and priority (High/Medium/Low)

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
          maxTokens: 4000,
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
              max_tokens: 4000,
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
          
          // Last resort: try to manually extract array elements
          try {
            const elements: any[] = [];
            // For recommendations, look for objects with "action" field
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

      const recommendations: RecommendationV3[] = parsed.map((rec: any) => {
        // Find matching KPI
        const matchingKpi = kpis.find(k => k.kpiName === rec.kpi);
        
        return {
          action: String(rec.action || ''),
          citationSource: String(rec.citationSource || ''),
          focusArea: rec.focusArea === 'soa' ? 'soa' : rec.focusArea === 'sentiment' ? 'sentiment' : 'visibility',
          priority: rec.priority === 'High' ? 'High' : rec.priority === 'Low' ? 'Low' : 'Medium',
          effort: rec.effort === 'High' ? 'High' : rec.effort === 'Low' ? 'Low' : 'Medium',
          kpi: rec.kpi || matchingKpi?.kpiName,
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

    // OpenRouter is now primary, Cerebras is fallback
    console.log('📊 [RecommendationV3Service] Using OpenRouter as primary provider (Cerebras as fallback)');

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

      // Step 2: Generate recommendations directly (no KPI identification)
      console.log('📝 [RecommendationV3Service] Step 2: Generating recommendations with LLM...');
      const llmStartTime = Date.now();
      const recommendations = await this.generateRecommendationsDirect(context);
      console.log(`✅ [RecommendationV3Service] LLM generation completed in ${Date.now() - llmStartTime}ms`);

      if (recommendations.length === 0) {
        return {
          success: false,
          kpis: [],
          recommendations: [],
          message: 'No recommendations generated at this time.'
        };
      }

      // Step 3: Save to database (no KPIs) - this will add IDs to recommendations
      const generationId = await this.saveToDatabase(brandId, customerId, [], recommendations, context);

      if (!generationId) {
        return {
          success: false,
          kpis: [],
          recommendations: [],
          message: 'Failed to save recommendations to database.'
        };
      }

      // Verify all recommendations have IDs before returning
      const recommendationsWithIds = recommendations.filter(rec => rec.id);
      if (recommendationsWithIds.length !== recommendations.length) {
        console.warn(`⚠️ [RecommendationV3Service] ${recommendations.length - recommendationsWithIds.length} recommendations missing IDs`);
      }
      console.log(`✅ [RecommendationV3Service] Returning ${recommendationsWithIds.length} recommendations with IDs`);

      return {
        success: true,
        generationId,
        kpis: [],
        recommendations: recommendationsWithIds, // Only return recommendations with IDs
        generatedAt: new Date().toISOString(),
        brandId: context.brandId,
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
            industry: context.industry
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

      // Save recommendations
      const recommendationsToInsert = recommendations.map((rec, index) => {
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
          calculated_score: null,
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

      // Map database IDs back to recommendations
      if (insertedRecommendations && insertedRecommendations.length === recommendations.length) {
        for (let i = 0; i < recommendations.length; i++) {
          if (insertedRecommendations[i]?.id) {
            recommendations[i].id = insertedRecommendations[i].id;
            console.log(`✅ [RecommendationV3Service] Mapped ID ${insertedRecommendations[i].id} to recommendation ${i + 1}`);
          }
        }
      } else {
        console.warn(`⚠️ [RecommendationV3Service] ID count mismatch: ${insertedRecommendations?.length || 0} inserted vs ${recommendations.length} recommendations`);
      }

      console.log(`💾 [RecommendationV3Service] Saved ${kpis.length} KPIs and ${recommendations.length} recommendations`);
      return generationId;

    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error saving to database:', error);
      return null;
    }
  }
}

export const recommendationV3Service = new RecommendationV3Service();
