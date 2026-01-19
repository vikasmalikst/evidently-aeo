/**
 * Context Builder Service
 * 
 * Gathers brand context including metrics, trends, competitors, and source data
 * for use in KPI identification and recommendation generation.
 */

import { supabaseAdmin } from '../../../config/database';
import { OptimizedMetricsHelper } from '../../query-helpers/optimized-metrics.helper';
import { sourceAttributionService } from '../../source-attribution.service';
import { graphRecommendationService } from '../graph-recommendation.service';
import type { BrandContextV3 } from './types';

export class ContextBuilderService {
  private optimizedMetricsHelper: OptimizedMetricsHelper;

  constructor() {
    this.optimizedMetricsHelper = new OptimizedMetricsHelper(supabaseAdmin);
  }

  /**
   * Gather brand context for KPI identification
   */
  async gatherBrandContext(
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
        console.error('❌ [ContextBuilder] Brand not found:', brandError);
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

      if (USE_OPTIMIZED_RECOMMENDATIONS) {
        console.log('   ⚡ [Context Builder] Using optimized queries (metric_facts + brand_metrics)');
      } else {
        console.log('   📋 [Context Builder] Using legacy queries (extracted_positions)');
      }

      // Get overall brand metrics (current and previous periods)
      const { visibilityIndex, shareOfAnswers, sentimentScore } =
        await this.getBrandMetrics(brandId, customerId, currentStartDate, currentEndDate, USE_OPTIMIZED_RECOMMENDATIONS);

      const { visibilityIndex: prevVisibilityIndex, shareOfAnswers: prevShareOfAnswers, sentimentScore: prevSentimentScore } =
        await this.getBrandMetrics(brandId, customerId, previousStartDate, previousEndDate, USE_OPTIMIZED_RECOMMENDATIONS);

      // Calculate trends
      const trends = {
        visibility: this.calculateTrend(visibilityIndex, prevVisibilityIndex),
        soa: this.calculateTrend(shareOfAnswers, prevShareOfAnswers),
        sentiment: this.calculateTrend(sentimentScore, prevSentimentScore)
      };

      // Get competitors
      const competitors = await this.getCompetitorMetrics(
        brandId,
        customerId,
        currentStartDate,
        currentEndDate,
        USE_OPTIMIZED_RECOMMENDATIONS
      );

      // Get source metrics from source-attribution service (same as Citations Sources page)
      const sourceMetrics = await this.getSourceMetrics(
        brandId,
        customerId,
        currentStartDate,
        currentEndDate
      );

      // Phase 7: Get Graph Insights (Opportunity Gaps)
      const graphInsights = await this.getGraphInsights(
        brandId,
        brand.name,
        currentStartDate,
        competitors.map(c => c.name)
      );

      return {
        brandId,
        brandName: brand.name,
        industry: brand.industry || undefined,
        visibilityIndex,
        shareOfAnswers,
        sentimentScore,
        trends,
        competitors,
        sourceMetrics,
        // Phase 1: Context Enrichment - Qualitative Context
        ...(await this.getQualitativeContext(brandId, customerId, currentStartDate)),
        // Phase 7: Graph Insights
        graphInsights
      };

    } catch (error) {
      console.error('❌ [ContextBuilder] Error gathering brand context:', error);
      return null;
    }
  }

  /**
   * Get brand metrics for a date range
   */
  private async getBrandMetrics(
    brandId: string,
    customerId: string,
    startDate: string,
    endDate: string,
    useOptimized: boolean
  ): Promise<{ visibilityIndex?: number; shareOfAnswers?: number; sentimentScore?: number }> {
    if (useOptimized) {
      const result = await this.optimizedMetricsHelper.fetchBrandMetricsByDateRange({
        brandId,
        customerId,
        startDate,
        endDate,
        includeSentiment: true,
      });

      if (result.success && result.data.length > 0) {
        const validVis = result.data.filter(m => m.visibility_index != null);
        const validSoa = result.data.filter(m => m.share_of_answers != null);
        const validSent = result.data.filter(m => m.sentiment_score != null);

        return {
          visibilityIndex: validVis.length > 0
            ? validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length
            : undefined,
          shareOfAnswers: validSoa.length > 0
            ? validSoa.reduce((sum, m) => sum + (m.share_of_answers || 0), 0) / validSoa.length
            : undefined,
          sentimentScore: validSent.length > 0
            ? validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length
            : undefined
        };
      }
    } else {
      const { data: metrics } = await supabaseAdmin
        .from('extracted_positions')
        .select('visibility_index, share_of_answers_brand, sentiment_score')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (metrics && metrics.length > 0) {
        const validVis = metrics.filter(m => m.visibility_index != null);
        const validSoa = metrics.filter(m => m.share_of_answers_brand != null);
        const validSent = metrics.filter(m => m.sentiment_score != null);

        return {
          visibilityIndex: validVis.length > 0
            ? validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length
            : undefined,
          shareOfAnswers: validSoa.length > 0
            ? validSoa.reduce((sum, m) => sum + (m.share_of_answers_brand || 0), 0) / validSoa.length
            : undefined,
          sentimentScore: validSent.length > 0
            ? validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length
            : undefined
        };
      }
    }

    return {};
  }

  /**
   * Get competitor metrics
   */
  private async getCompetitorMetrics(
    brandId: string,
    customerId: string,
    startDate: string,
    endDate: string,
    useOptimized: boolean
  ): Promise<BrandContextV3['competitors']> {
    const { data: competitors } = await supabaseAdmin
      .from('brand_competitors')
      .select('id, competitor_name')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(5);

    const competitorData: BrandContextV3['competitors'] = [];

    if (competitors && competitors.length > 0) {
      for (const comp of competitors) {
        let compVis: number | undefined;
        let compSoa: number | undefined;
        let compSent: number | undefined;

        if (useOptimized) {
          const result = await this.optimizedMetricsHelper.fetchCompetitorMetricsByDateRange({
            competitorId: comp.id,
            brandId,
            customerId,
            startDate,
            endDate,
            includeSentiment: true,
          });

          if (result.success && result.data.length > 0) {
            const validVis = result.data.filter(m => m.visibility_index != null);
            const validSoa = result.data.filter(m => m.share_of_answers != null);
            const validSent = result.data.filter(m => m.sentiment_score != null);

            compVis = validVis.length > 0
              ? validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length
              : undefined;
            compSoa = validSoa.length > 0
              ? validSoa.reduce((sum, m) => sum + (m.share_of_answers || 0), 0) / validSoa.length
              : undefined;
            compSent = validSent.length > 0
              ? validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length
              : undefined;
          }
        } else {
          // Legacy path
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
                .gte('created_at', startDate)
                .lte('created_at', endDate);

              if (compMetrics && compMetrics.length > 0) {
                const validVis = compMetrics.filter(m => m.visibility_index != null);
                const validSoa = compMetrics.filter(m => m.share_of_answers_brand != null);
                const validSent = compMetrics.filter(m => m.sentiment_score != null);

                compVis = validVis.length > 0
                  ? validVis.reduce((sum, m) => sum + (m.visibility_index || 0), 0) / validVis.length
                  : undefined;
                compSoa = validSoa.length > 0
                  ? validSoa.reduce((sum, m) => sum + (m.share_of_answers_brand || 0), 0) / validSoa.length
                  : undefined;
                compSent = validSent.length > 0
                  ? validSent.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / validSent.length
                  : undefined;
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

    return competitorData;
  }

  /**
   * Get source metrics from source-attribution service
   */
  private async getSourceMetrics(
    brandId: string,
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<BrandContextV3['sourceMetrics']> {
    console.log('📊 [ContextBuilder] Fetching source data using source-attribution service...');
    const sourceAttributionStartTime = Date.now();

    const sourceAttributionResponse = await sourceAttributionService.getSourceAttribution(
      brandId,
      customerId,
      { start: startDate, end: endDate }
    );

    console.log(`✅ [ContextBuilder] Fetched ${sourceAttributionResponse.sources.length} sources in ${Date.now() - sourceAttributionStartTime}ms`);

    const sourceMetrics: BrandContextV3['sourceMetrics'] = [];

    if (sourceAttributionResponse.sources && sourceAttributionResponse.sources.length > 0) {
      // Use top 10 sources sorted by value score (same as Citations Sources page)
      const topSources = sourceAttributionResponse.sources
        .sort((a, b) => {
          const valueDiff = (b.value || 0) - (a.value || 0);
          if (Math.abs(valueDiff) > 0.01) return valueDiff;
          return b.mentionRate - a.mentionRate;
        })
        .slice(0, 10);


      // Calculate start time for competitor metrics fetching
      const compMetricsStart = Date.now();

      // Fetch competitor metrics for these sources efficiently
      const domains = topSources.map(s => s.name.toLowerCase().replace(/^www\./, '').trim());

      // We need to find the top competitor for each of these domains
      // Query extracted_positions for competitor data on these domains
      const { data: compPositions } = await supabaseAdmin
        .from('extracted_positions')
        .select(`
          domain,
          competitor_id,
          share_of_answers_brand,
          sentiment_score,
          competitors!inner(name)
        `)
        .eq('brand_id', brandId) // Only get competitors for this brand
        .in('domain', domains)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('competitor_id', 'is', null);

      console.log(`✅ [ContextBuilder] Fetched ${compPositions?.length || 0} competitor positions for source analysis in ${Date.now() - compMetricsStart}ms`);

      // Group by domain -> competitor -> avg metrics
      const domainCompMap = new Map<string, Array<{ name: string; soa: number; sentiment: number; count: number }>>();

      if (compPositions) {
        for (const pos of compPositions) {
          const domain = pos.domain.toLowerCase().replace(/^www\./, '').trim();
          // Type assertion since we used inner join but TS might not know
          const compName = (pos.competitors as any)?.name || 'Unknown';

          if (!domainCompMap.has(domain)) {
            domainCompMap.set(domain, []);
          }

          const domainComps = domainCompMap.get(domain)!;
          let compEntry = domainComps.find(c => c.name === compName);

          if (!compEntry) {
            compEntry = { name: compName, soa: 0, sentiment: 0, count: 0 };
            domainComps.push(compEntry);
          }

          compEntry.soa += (pos.share_of_answers_brand || 0);
          compEntry.sentiment += (pos.sentiment_score || 0);
          compEntry.count++;
        }
      }

      for (const source of topSources) {
        let topCompetitor: { name: string; soa: number; sentiment: number } | undefined;

        const cleanDomain = source.name.toLowerCase().replace(/^www\./, '').trim();
        const domainComps = domainCompMap.get(cleanDomain);

        if (domainComps && domainComps.length > 0) {
          // Average out the metrics
          const averagedComps = domainComps.map(c => ({
            name: c.name,
            soa: c.soa / c.count,
            sentiment: c.sentiment / c.count
          }));

          // Sort by SOA descending to find the dominant competitor
          averagedComps.sort((a, b) => b.soa - a.soa);

          // Pick the winner if they have significant presence (> 5% SOA)
          if (averagedComps[0].soa > 0.05) {
            topCompetitor = averagedComps[0];
          }
        }

        sourceMetrics.push({
          domain: cleanDomain,
          mentionRate: Math.round(source.mentionRate * 10) / 10,
          soa: Math.round(source.soa * 10) / 10,
          sentiment: Math.round(source.sentiment * 100) / 100,
          citations: source.citations,
          impactScore: Math.round((source.value || 0) * 10) / 10,
          visibility: source.visibility ? Math.round(source.visibility) : 0,
          topCompetitor
        });
      }
    }

    return sourceMetrics;
  }

  /**
   * Calculate trend between current and previous period
   */
  private calculateTrend(
    current: number | undefined,
    previous: number | undefined
  ): { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' } | undefined {
    if (current === undefined || previous === undefined || previous === 0) return undefined;
    const changePercent = ((current - previous) / previous) * 100;
    const direction: 'up' | 'down' | 'stable' = Math.abs(changePercent) < 2 ? 'stable' : (changePercent > 0 ? 'up' : 'down');
    return {
      current,
      previous,
      changePercent: Math.round(changePercent * 10) / 10,
      direction
    };
  }


  /**
   * Phase 1: Fetch Qualitative Context (Keywords, Quotes, Narrative)
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
        console.warn('⚠️ [ContextBuilder] Error fetching qualitative context:', error.message);
        return {};
      }

      if (!data || data.length === 0) {
        return {};
      }

      console.log(`🧠 [ContextBuilder] Fetched ${data.length} analysis records for qualitative context`);

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
      console.error('❌ [ContextBuilder] Unexpected error in getQualitativeContext:', err);
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
   * Phase 7: Fetch Data & Run Graph Algorithms
   */
  private async getGraphInsights(
    brandId: string,
    brandName: string,
    startDate: string,
    competitorNames: string[]
  ): Promise<BrandContextV3['graphInsights']> {
    try {
      // 1. Fetch Raw Data (Consolidated Analysis + Metadata)
      // Limit to 2000 for performance (Graphology can handle 4k, but start safe)
      const { data, error } = await supabaseAdmin
        .from('consolidated_analysis_cache')
        .select(`
            collector_result_id,
            products,
            sentiment,
            keywords,
            quotes,
            collector_results!inner(brand_id, created_at)
          `)
        .eq('collector_results.brand_id', brandId)
        .gte('collector_results.created_at', startDate)
        .order('created_at', { ascending: false, foreignTable: 'collector_results' })
        .limit(2000);

      if (error || !data || data.length === 0) {
        console.warn('⚠️ [ContextBuilder] No data for Graph Analysis:', error?.message);
        return undefined;
      }

      console.log(`🧠 [ContextBuilder] Running Graph Analysis on ${data.length} records...`);

      // 2. Build Graph
      const graphInput = data.map(row => ({
        id: row.collector_result_id,
        analysis: {
          products: row.products,
          sentiment: row.sentiment,
          keywords: row.keywords,
          quotes: row.quotes,
          citations: {} // Not used in graph
        },
        competitorNames: competitorNames
      }));

      graphRecommendationService.buildGraph(brandName, graphInput);

      // 3. Run Algorithms
      graphRecommendationService.runAlgorithms();

      // 4. Extract Insights
      // For each competitor, find opportunity gaps
      const allGaps: any[] = [];
      for (const comp of competitorNames) {
        const gaps = graphRecommendationService.getOpportunityGaps(comp);
        allGaps.push(...gaps);
      }

      // Sort globally by score
      const topGaps = allGaps.sort((a, b) => b.score - a.score).slice(0, 5);

      if (topGaps.length > 0) {
        console.log(`🚀 [ContextBuilder] Found ${topGaps.length} Opportunity Gaps via Graph`);
      }

      return {
        opportunityGaps: topGaps
      };

    } catch (err) {
      console.error('❌ [ContextBuilder] Graph Analysis Failed:', err);
      return undefined;
    }
  }
}

export const contextBuilderService = new ContextBuilderService();

