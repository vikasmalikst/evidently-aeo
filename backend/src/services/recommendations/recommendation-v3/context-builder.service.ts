/**
 * Context Builder Service
 * 
 * Gathers brand context including metrics, trends, competitors, and source data
 * for use in KPI identification and recommendation generation.
 */

import { supabaseAdmin } from '../../../config/database';
import { OptimizedMetricsHelper } from '../../query-helpers/optimized-metrics.helper';
import { sourceAttributionService } from '../../source-attribution.service';
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

      return {
        brandId,
        brandName: brand.name,
        industry: brand.industry || undefined,
        visibilityIndex,
        shareOfAnswers,
        sentimentScore,
        trends,
        competitors,
        sourceMetrics
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

      for (const source of topSources) {
        sourceMetrics.push({
          domain: source.name.toLowerCase().replace(/^www\./, '').trim(),
          mentionRate: Math.round(source.mentionRate * 10) / 10,
          soa: Math.round(source.soa * 10) / 10,
          sentiment: Math.round(source.sentiment * 100) / 100,
          citations: source.citations,
          impactScore: Math.round((source.value || 0) * 10) / 10,
          visibility: source.visibility ? Math.round(source.visibility) : 0
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
}

export const contextBuilderService = new ContextBuilderService();

