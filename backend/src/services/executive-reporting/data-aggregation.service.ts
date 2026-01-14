/**
 * Executive Reporting Data Aggregation Service
 * 
 * Core service for aggregating all metrics needed for executive reports.
 * Fetches data from various sources and compiles into structured format.
 */

import { supabase } from '../../config/supabase';
import type {
    ReportDataSnapshot,
    BrandPerformanceData,
    LLMPerformanceData,
    CompetitiveLandscapeData,
    DomainReadinessData,
    ActionsImpactData,
    TopMoversData,
    TrendDataPoint,
    TopMoverItem,
    CompetitorMetrics,
} from './types';

export class DataAggregationService {
    /**
     * Main method to aggregate all report data
     */
    async aggregateReportData(
        brandId: string,
        periodStart: Date,
        periodEnd: Date,
        comparisonStart: Date,
        comparisonEnd: Date
    ): Promise<ReportDataSnapshot> {
        console.log(`📊 [EXEC-REPORT] Aggregating data for brand ${brandId}`);
        console.log(`📊 Current period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
        console.log(`📊 Comparison period: ${comparisonStart.toISOString()} to ${comparisonEnd.toISOString()}`);

        const [
            brandPerformance,
            llmPerformance,
            competitiveLandscape,
            domainReadiness,
            actionsImpact,
            topMovers,
        ] = await Promise.all([
            this.aggregateBrandPerformance(brandId, periodStart, periodEnd, comparisonStart, comparisonEnd),
            this.aggregateLLMPerformance(brandId, periodStart, periodEnd),
            this.aggregateCompetitiveLandscape(brandId, periodStart, periodEnd),
            this.aggregateDomainReadiness(brandId, periodStart, periodEnd),
            this.aggregateActionsImpact(brandId, periodStart, periodEnd),
            this.calculateTopMovers(brandId, periodStart, periodEnd, comparisonStart, comparisonEnd),
        ]);

        return {
            brand_performance: brandPerformance,
            llm_performance: llmPerformance,
            competitive_landscape: competitiveLandscape,
            domain_readiness: domainReadiness,
            actions_impact: actionsImpact,
            top_movers: topMovers,
        };
    }

    /**
     * Aggregate brand performance metrics
     */
    async aggregateBrandPerformance(
        brandId: string,
        periodStart: Date,
        periodEnd: Date,
        comparisonStart: Date,
        comparisonEnd: Date
    ): Promise<BrandPerformanceData> {
        console.log(`📈 [EXEC-REPORT] Aggregating brand performance for ${brandId}`);

        // Fetch current period metrics
        const currentMetrics = await this.fetchPeriodMetrics(brandId, periodStart, periodEnd);

        // Fetch comparison period metrics
        const previousMetrics = await this.fetchPeriodMetrics(brandId, comparisonStart, comparisonEnd);

        // Calculate deltas
        const deltas = {
            visibility: this.calculateDelta(currentMetrics.visibility, previousMetrics.visibility),
            average_position: this.calculateDelta(currentMetrics.average_position, previousMetrics.average_position),
            appearance_rate: this.calculateDelta(currentMetrics.appearance_rate, previousMetrics.appearance_rate),
            share_of_answer: this.calculateDelta(currentMetrics.share_of_answer, previousMetrics.share_of_answer),
            sentiment: this.calculateDelta(currentMetrics.sentiment, previousMetrics.sentiment),
        };

        // Fetch 12-week trends
        const twelveWeekTrends = await this.fetch12WeekTrends(brandId, periodEnd);

        return {
            current: currentMetrics,
            previous: previousMetrics,
            deltas,
            twelve_week_trends: twelveWeekTrends,
        };
    }

    /**
     * Fetch metrics for a specific time period
     */
    private async fetchPeriodMetrics(brandId: string, startDate: Date, endDate: Date) {
        // First, fetch the customer_id for this brand
        const { data: brandData, error: brandError } = await supabase
            .from('brands')
            .select('customer_id')
            .eq('id', brandId)
            .single();

        if (brandError || !brandData) {
            console.error('❌ [EXEC-REPORT] Error fetching brand customer_id:', brandError);
            return {
                visibility: 0,
                average_position: 0,
                appearance_rate: 0,
                share_of_answer: 0,
                sentiment: 0,
            };
        }

        const customerId = brandData.customer_id;

        // Use OptimizedMetricsHelper to properly join metric_facts with brand_metrics and brand_sentiment
        const { OptimizedMetricsHelper } = await import('../query-helpers/optimized-metrics.helper');
        const helper = new OptimizedMetricsHelper(supabase);

        const result = await helper.fetchBrandMetricsByDateRange({
            brandId,
            customerId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            includeSentiment: true,
        });

        if (!result.success || !result.data) {
            console.error('❌ [EXEC-REPORT] Error fetching period metrics:', result.error);
            return {
                visibility: 0,
                average_position: 0,
                appearance_rate: 0,
                share_of_answer: 0,
                sentiment: 0,
            };
        }

        const data = result.data;

        // Aggregate metrics across the period
        const visibilityValues = data.map(d => d.visibility_index).filter(v => v != null) as number[];
        const shareValues = data.map(d => d.share_of_answers).filter(v => v != null) as number[];
        const sentimentValues = data.map(d => d.sentiment_score).filter(v => v != null) as number[];
        const brandPresenceCount = data.filter(d => d.has_brand_presence).length;

        const visibility = visibilityValues.length > 0
            ? visibilityValues.reduce((sum, v) => sum + v, 0) / visibilityValues.length * 100
            : 0;
        const shareOfAnswer = shareValues.length > 0
            ? shareValues.reduce((sum, v) => sum + v, 0) / shareValues.length
            : 0;
        const sentiment = sentimentValues.length > 0
            ? sentimentValues.reduce((sum, v) => sum + v, 0) / sentimentValues.length
            : 0;
        const appearanceRate = data.length > 0
            ? (brandPresenceCount / data.length) * 100
            : 0;

        // Calculate average position from brand_first_position
        const positionValues = data.map(d => d.brand_first_position).filter(p => p != null && p > 0) as number[];
        const averagePosition = positionValues.length > 0
            ? positionValues.reduce((sum, p) => sum + p, 0) / positionValues.length
            : 0;

        return {
            visibility: Number(visibility.toFixed(2)),
            average_position: Number(averagePosition.toFixed(2)),
            appearance_rate: Number(appearanceRate.toFixed(2)),
            share_of_answer: Number(shareOfAnswer.toFixed(2)),
            sentiment: Number(sentiment.toFixed(2)),
        };
    }

    /**
     * Fetch 12-week rolling trends
     */
    private async fetch12WeekTrends(brandId: string, endDate: Date): Promise<{
        visibility: TrendDataPoint[];
        average_position: TrendDataPoint[];
        appearance_rate: TrendDataPoint[];
        share_of_answer: TrendDataPoint[];
        sentiment: TrendDataPoint[];
    }> {
        const trends = {
            visibility: [] as TrendDataPoint[],
            average_position: [] as TrendDataPoint[],
            appearance_rate: [] as TrendDataPoint[],
            share_of_answer: [] as TrendDataPoint[],
            sentiment: [] as TrendDataPoint[],
        };

        // Calculate start date (12 weeks before end date)
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - (12 * 7));

        // Fetch weekly aggregated data
        for (let week = 0; week < 12; week++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(weekStart.getDate() + (week * 7));

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            const weekMetrics = await this.fetchPeriodMetrics(brandId, weekStart, weekEnd);

            trends.visibility.push({
                week_start: weekStart.toISOString().split('T')[0],
                week_end: weekEnd.toISOString().split('T')[0],
                value: weekMetrics.visibility,
            });

            trends.average_position.push({
                week_start: weekStart.toISOString().split('T')[0],
                week_end: weekEnd.toISOString().split('T')[0],
                value: weekMetrics.average_position,
            });

            trends.appearance_rate.push({
                week_start: weekStart.toISOString().split('T')[0],
                week_end: weekEnd.toISOString().split('T')[0],
                value: weekMetrics.appearance_rate,
            });

            trends.share_of_answer.push({
                week_start: weekStart.toISOString().split('T')[0],
                week_end: weekEnd.toISOString().split('T')[0],
                value: weekMetrics.share_of_answer,
            });

            trends.sentiment.push({
                week_start: weekStart.toISOString().split('T')[0],
                week_end: weekEnd.toISOString().split('T')[0],
                value: weekMetrics.sentiment,
            });
        }

        return trends;
    }

    /**
     * Aggregate LLM-specific performance
     */
    /**
     * Aggregate LLM-specific performance
     */
    async aggregateLLMPerformance(
        brandId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<LLMPerformanceData> {
        console.log(`🤖 [EXEC-REPORT] Aggregating LLM performance for ${brandId}`);

        // First, fetch the customer_id for this brand
        const { data: brandData, error: brandError } = await supabase
            .from('brands')
            .select('customer_id')
            .eq('id', brandId)
            .single();

        if (brandError || !brandData) {
            console.error('❌ [EXEC-REPORT] Error fetching brand customer_id:', brandError);
            return {
                by_llm: {},
                twelve_week_trends_by_llm: {},
            };
        }

        const customerId = brandData.customer_id;

        // Use OptimizedMetricsHelper
        const { OptimizedMetricsHelper } = await import('../query-helpers/optimized-metrics.helper');
        const helper = new OptimizedMetricsHelper(supabase);

        const result = await helper.fetchBrandMetricsByDateRange({
            brandId,
            customerId,
            startDate: periodStart.toISOString(),
            endDate: periodEnd.toISOString(),
            includeSentiment: true,
        });

        if (!result.success || !result.data) {
            console.error('❌ [EXEC-REPORT] Error fetching LLM performance metrics:', result.error);
            return {
                by_llm: {},
                twelve_week_trends_by_llm: {},
            };
        }

        // Group by collector_type (LLM)
        const byLLM: Record<string, any> = {};
        const llmGroups: Record<string, any[]> = {};

        result.data.forEach(row => {
            const llm = row.collector_type || 'Unknown';
            if (!llmGroups[llm]) {
                llmGroups[llm] = [];
            }
            llmGroups[llm].push(row);
        });

        // Calculate metrics for each LLM
        for (const [llmName, rows] of Object.entries(llmGroups)) {
            const visibilityValues = rows.map(r => r.visibility_index).filter(v => v != null) as number[];
            const shareValues = rows.map(r => r.share_of_answers).filter(v => v != null) as number[];
            const positionValues = rows.map(r => r.brand_first_position).filter(p => p != null && p > 0) as number[];
            const sentimentValues = rows.map(r => r.sentiment_score).filter(v => v != null) as number[];
            const brandPresenceCount = rows.filter(r => r.has_brand_presence).length;

            const visibility = visibilityValues.length > 0
                ? visibilityValues.reduce((sum, v) => sum + v, 0) / visibilityValues.length * 100
                : 0;
            const shareOfAnswer = shareValues.length > 0
                ? shareValues.reduce((sum, v) => sum + v, 0) / shareValues.length
                : 0;
            const averagePosition = positionValues.length > 0
                ? positionValues.reduce((sum, p) => sum + p, 0) / positionValues.length
                : 0;
            const appearanceRate = rows.length > 0
                ? (brandPresenceCount / rows.length) * 100
                : 0;
            const sentiment = sentimentValues.length > 0
                ? sentimentValues.reduce((sum, v) => sum + v, 0) / sentimentValues.length
                : 0;

            byLLM[llmName] = {
                visibility: Number(visibility.toFixed(2)),
                average_position: Number(averagePosition.toFixed(2)),
                appearance_rate: Number(appearanceRate.toFixed(2)),
                share_of_answer: Number(shareOfAnswer.toFixed(2)),
                sentiment: Number(sentiment.toFixed(2)),
            };
        }

        // TODO: Fetch 12-week trends per LLM (simplified for now)
        const twelveWeekTrendsByLLM: Record<string, any> = {};

        return {
            by_llm: byLLM,
            twelve_week_trends_by_llm: twelveWeekTrendsByLLM,
        };
    }

    /**
     * Aggregate competitive landscape
     */
    async aggregateCompetitiveLandscape(
        brandId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<CompetitiveLandscapeData> {
        console.log(`🤖 [EXEC-REPORT] Aggregating competitive landscape for ${brandId}`);

        // First, fetch the customer_id for this brand
        const { data: brandData, error: brandError } = await supabase
            .from('brands')
            .select('customer_id, name')
            .eq('id', brandId)
            .single();

        const brandUrl = brandData?.name.toLowerCase().includes('sandisk') ? 'sandisk.com' : '';
        if (brandError || !brandData) {
            console.error('❌ [EXEC-REPORT] Error fetching brand data:', brandError);
            return {
                competitors: [],
                twelve_week_trends: {
                    brand: { visibility: [], share_of_answer: [] },
                    competitors: {},
                },
            };
        }

        const customerId = brandData.customer_id;
        const brandName = brandData.name || 'Brand';

        // Use OptimizedMetricsHelper
        const { OptimizedMetricsHelper } = await import('../query-helpers/optimized-metrics.helper');
        const helper = new OptimizedMetricsHelper(supabase);

        // 1. Fetch Brand Metrics
        const brandResult = await helper.fetchBrandMetricsByDateRange({
            brandId,
            customerId,
            startDate: periodStart.toISOString(),
            endDate: periodEnd.toISOString(),
            includeSentiment: true,
        });

        const landscape: any[] = [];

        if (brandResult.success && brandResult.data) {
            const rows = brandResult.data;
            const visibilityValues = rows.map(r => r.visibility_index).filter(v => v != null) as number[];
            const shareValues = rows.map(r => r.share_of_answers).filter(v => v != null) as number[];
            const sentimentValues = rows.map(r => r.sentiment_score).filter(v => v != null) as number[];

            // Calculate averages
            const visibility = visibilityValues.length > 0
                ? visibilityValues.reduce((sum, v) => sum + v, 0) / visibilityValues.length * 100
                : 0;
            const shareOfAnswer = shareValues.length > 0
                ? shareValues.reduce((sum, v) => sum + v, 0) / shareValues.length
                : 0;
            const sentiment = sentimentValues.length > 0
                ? sentimentValues.reduce((sum, v) => sum + v, 0) / sentimentValues.length
                : 0;

            landscape.push({
                name: brandName,
                is_brand: true,
                current: {
                    visibility: Number(visibility.toFixed(2)),
                    share_of_answer: Number(shareOfAnswer.toFixed(2)),
                    sentiment: Number(sentiment.toFixed(2)),
                    average_position: 0,
                    appearance_rate: 0
                },
                deltas: {
                    share_of_answer: { percentage: 0 },
                    visibility: { percentage: 0 }
                },
                website_url: brandUrl
            });
        }

        // 2. Fetch Active Competitors
        const { data: competitors, error: compError } = await supabase
            .from('brand_competitors')
            .select('id, competitor_name')
            .eq('brand_id', brandId);

        if (competitors) {
            for (const competitor of competitors) {
                try {
                    const compMetrics = await helper.fetchCompetitorMetricsByDateRange({
                        competitorId: competitor.id,
                        brandId,
                        customerId,
                        startDate: periodStart.toISOString(),
                        endDate: periodEnd.toISOString(),
                        includeSentiment: false // Disabled - table relationship broken
                    });

                    if (compMetrics.success && compMetrics.data) {
                        const rows = compMetrics.data;
                        const visibilityValues = rows.map(r => r.visibility_index).filter(v => v != null) as number[];
                        const shareValues = rows.map(r => r.share_of_answers).filter(v => v != null) as number[];
                        const sentimentValues = rows.map(r => r.sentiment_score).filter(v => v != null) as number[];

                        const visibility = visibilityValues.length > 0
                            ? visibilityValues.reduce((sum, v) => sum + v, 0) / visibilityValues.length * 100
                            : 0;
                        const shareOfAnswer = shareValues.length > 0
                            ? shareValues.reduce((sum, v) => sum + v, 0) / shareValues.length
                            : 0;
                        const sentiment = sentimentValues.length > 0
                            ? sentimentValues.reduce((sum, v) => sum + v, 0) / sentimentValues.length
                            : 0;

                        landscape.push({
                            name: competitor.competitor_name,
                            is_brand: false,
                            current: {
                                visibility: Number(visibility.toFixed(2)),
                                share_of_answer: Number(shareOfAnswer.toFixed(2)),
                                sentiment: Number(sentiment.toFixed(2)),
                                average_position: 0,
                                appearance_rate: 0
                            },
                            deltas: {
                                share_of_answer: { percentage: 0 },
                                visibility: { percentage: 0 }
                            },
                            website_url: '' // Not available in database
                        });
                    }
                } catch (e) {
                    console.error('Error fetching competitor metrics', e);
                }
            }
        }

        // TODO: Fetch 12-week trends for brand and competitors
        const twelveWeekTrends = {
            brand: { visibility: [], share_of_answer: [] },
            competitors: {},
        };

        return {
            competitors: landscape.sort((a, b) => (b.current.visibility || 0) - (a.current.visibility || 0)),
            twelve_week_trends: twelveWeekTrends,
        };
    }

    /**
     * Aggregate domain readiness metrics from domain_readiness_results table
     */
    async aggregateDomainReadiness(
        brandId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<DomainReadinessData> {
        console.log(`🔍 [EXEC-REPORT] Aggregating domain readiness for ${brandId}`);

        // Fetch latest domain readiness result from domain_readiness_audits table
        // NOTE: Updated from domain_readiness_results to domain_readiness_audits to match DomainReadinessService
        const { data: latestResult, error } = await supabase
            .from('domain_readiness_audits')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !latestResult) {
            console.warn('⚠️ [EXEC-REPORT] No domain readiness data found in domain_readiness_audits');
            return {
                overall_score: 0,
                previous_overall_score: 0,
                score_delta: { absolute: 0, percentage: 0 },
                sub_scores: {},
                twelve_week_trend: [],
                key_deficiencies: [],
            };
        }

        // Extract scores from the JSONB scores column
        const scores = latestResult.scores as Record<string, any> | null;

        // Use the overall_score directly from DB as it is already weighted correctly
        let overallScore = latestResult.overall_score || 0;
        const subScores: Record<string, { score: number; label: string }> = {};

        // Map known category keys to friendly labels
        const categoryLabels: Record<string, string> = {
            technicalCrawlability: 'Technical',
            contentQuality: 'Content',
            semanticStructure: 'Semantic',
            accessibilityAndBrand: 'Access & Brand',
            aeoOptimization: 'AEO',
            botAccess: 'LLM Bot Access', // Updated to match key in DomainReadinessService
            llmBotAccess: 'LLM Bot Access', // Keep for backward compatibility if needed
        };

        if (scores && typeof scores === 'object') {
            Object.entries(scores).forEach(([key, value]: [string, any]) => {
                const scoreValue = typeof value === 'number' ? value : (value?.score || value?.value || 0);
                // Allow 0 scores if valid
                if (typeof scoreValue === 'number') {
                    subScores[key] = {
                        score: Math.round(scoreValue),
                        label: categoryLabels[key] || key.replace(/([A-Z])/g, ' $1').trim(),
                    };
                }
            });

            // Fallback: If overall_score was 0 or missing but we have subscores, calculate simple average (though this shouldn't happen with valid audits)
            if (overallScore === 0 && Object.keys(subScores).length > 0) {
                const values = Object.values(subScores).map(s => s.score);
                overallScore = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
            }
        }

        // Backfill: If botAccess is missing from subScores but we have bot_access data, calculate it
        if (!subScores['botAccess'] && latestResult.bot_access && Array.isArray(latestResult.bot_access) && latestResult.bot_access.length > 0) {
            const allowed = latestResult.bot_access.filter((b: any) => b.allowed).length;
            const total = latestResult.bot_access.length;
            const score = Math.round((allowed / total) * 100);

            subScores['botAccess'] = {
                score: score,
                label: 'LLM Bot Access'
            };

            // NOTE: We do NOT update overallScore here to preserve historical integrity of the audit score at the time it was run.
            // Future audits will have botAccess included in the weighted overallScore.
        }

        // Fetch previous result for comparison from domain_readiness_audits
        const { data: previousResult } = await supabase
            .from('domain_readiness_audits')
            .select('overall_score')
            .eq('brand_id', brandId)
            .lt('created_at', latestResult.created_at)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const previousScore = previousResult?.overall_score || 0;
        const scoreDelta = this.calculateDelta(overallScore, previousScore);

        // TODO: Fetch 12-week readiness trend
        const twelveWeekTrend: TrendDataPoint[] = [];

        return {
            overall_score: overallScore,
            previous_overall_score: previousScore,
            score_delta: scoreDelta,
            sub_scores: subScores,
            twelve_week_trend: twelveWeekTrend,
            key_deficiencies: [],
        };
    }

    /**
     * Aggregate actions and impact metrics
     */
    async aggregateActionsImpact(
        brandId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<ActionsImpactData> {
        console.log(`⚡ [EXEC-REPORT] Aggregating actions impact for ${brandId}`);

        // Fetch recommendations within period
        const { data: recommendations, error } = await supabase
            .from('recommendations')
            .select('*')
            .eq('brand_id', brandId)
            .gte('created_at', periodStart.toISOString())
            .lte('created_at', periodEnd.toISOString());

        if (error) {
            console.error('❌ [EXEC-REPORT] Error fetching recommendations:', error);
        }

        const provided = recommendations?.length || 0;
        const approved = recommendations?.filter(r => r.status === 'approved').length || 0;
        const implemented = recommendations?.filter(r => r.status === 'implemented').length || 0;

        // TODO: Calculate average impact from implemented recommendations
        const averageImpact = {
            visibility: null,
            share_of_answer: null,
            sentiment: null,
            average_position: null,
            mention_frequency: null,
        };

        return {
            recommendations: {
                provided,
                approved,
                content_generated: approved, // Approximation
                implemented,
            },
            average_impact: averageImpact,
        };
    }

    /**
     * Calculate top movers (queries, topics, sources)
     */
    async calculateTopMovers(
        brandId: string,
        periodStart: Date,
        periodEnd: Date,
        comparisonStart: Date,
        comparisonEnd: Date
    ): Promise<TopMoversData> {
        console.log(`📊 [EXEC-REPORT] Calculating top movers for ${brandId}`);

        // Fetch customerId
        const { data: brandData } = await supabase.from('brands').select('customer_id').eq('id', brandId).single();
        const customerId = brandData?.customer_id;

        if (!customerId) {
            return {
                queries: { gains: [], losses: [] },
                topics: { gains: [], losses: [] },
                sources: { gains: [], losses: [] },
            };
        }

        const { OptimizedMetricsHelper } = await import('../query-helpers/optimized-metrics.helper');
        const helper = new OptimizedMetricsHelper(supabase);

        // Fetch metrics for both periods
        const [current, previous] = await Promise.all([
            helper.fetchBrandMetricsByDateRange({
                brandId,
                customerId,
                startDate: periodStart.toISOString(),
                endDate: periodEnd.toISOString(),
                includeSentiment: false
            }),
            helper.fetchBrandMetricsByDateRange({
                brandId,
                customerId,
                startDate: comparisonStart.toISOString(),
                endDate: comparisonEnd.toISOString(),
                includeSentiment: false
            })
        ]);

        // Helper to aggregate data by query_id
        const aggregateByQuery = (data: any[]) => {
            const map = new Map<any, { soa: number, vis: number, query_id: any, count: number }>();

            data.forEach(row => {
                if (!row.query_id) return;
                const prev = map.get(row.query_id) || { soa: 0, vis: 0, query_id: row.query_id, count: 0 };

                map.set(row.query_id, {
                    soa: prev.soa + (row.share_of_answers || 0),
                    vis: prev.vis + (row.visibility_index || 0),
                    query_id: row.query_id,
                    count: prev.count + 1
                });
            });

            const result = new Map<any, { soa: number, vis: number }>();
            map.forEach((val, key) => {
                result.set(key, {
                    soa: val.soa / val.count,
                    vis: val.vis / val.count
                });
            });
            return result;
        };

        const currentMap = aggregateByQuery(current.data || []);
        const previousMap = aggregateByQuery(previous.data || []);

        // Calculate deltas
        const deltas: any[] = [];
        currentMap.forEach((curr, qid) => {
            const prev = previousMap.get(qid) || { soa: 0, vis: 0 };
            // Only include if significant change or sufficient visibility
            if (curr.vis > 0 || prev.vis > 0) {
                deltas.push({
                    query_id: qid,
                    change_soa: curr.soa - prev.soa,
                    current_soa: curr.soa,
                    previous_soa: prev.soa,
                    change_vis: curr.vis - prev.vis,
                    current_vis: curr.vis,
                    previous_vis: prev.vis
                });
            }
        });

        // Top 5 Gains and Losses
        deltas.sort((a, b) => b.change_soa - a.change_soa);
        const gains = deltas.filter(d => d.change_soa > 0).slice(0, 5);

        const losses = deltas
            .filter(d => d.change_soa < 0)
            .sort((a, b) => a.change_soa - b.change_soa) // Sort by most negative first
            .slice(0, 5);

        // Fetch Query Texts
        const queryIds = [...gains, ...losses].map(d => d.query_id);
        const queryTextMap = new Map<any, string>();

        if (queryIds.length > 0) {
            const { data: queries } = await supabase
                .from('queries')
                .select('id, query_text')
                .in('id', queryIds);

            queries?.forEach(q => queryTextMap.set(q.id, q.query_text));
        }

        const formatItem = (items: any[]) => items.map(i => ({
            name: queryTextMap.get(i.query_id) || `Query #${i.query_id}`,
            id: String(i.query_id),
            changes: {
                share_of_answer: {
                    absolute: Number(i.change_soa.toFixed(2)),
                    percentage: i.previous_soa ? Number(((i.change_soa / i.previous_soa) * 100).toFixed(2)) : 0
                },
                visibility: {
                    absolute: Number(i.change_vis.toFixed(2)),
                    percentage: i.previous_vis ? Number(((i.change_vis / i.previous_vis) * 100).toFixed(2)) : 0
                }
            }
        }));

        // === Top 3 Citation Sources by Impact Score ===
        const { data: topSources } = await supabase
            .from('recommendations')
            .select('citation_source, impact_score')
            .eq('brand_id', brandId)
            .not('citation_source', 'is', null)
            .not('impact_score', 'is', null)
            .order('impact_score', { ascending: false })
            .limit(10);

        const sourcesWithScores = (topSources || [])
            .filter(s => s.citation_source && s.impact_score)
            .slice(0, 3)
            .map(s => ({
                name: s.citation_source,
                id: s.citation_source,
                changes: {
                    impact_score: {
                        absolute: Number(s.impact_score) || 0,
                        percentage: 0
                    }
                }
            }));

        // === Top Topic by combined SOA/Visibility and Sentiment ===
        // Aggregate current data by topic
        const topicMap = new Map<string, { soa: number, vis: number, sentiment: number, count: number }>();
        (current.data || []).forEach((row: any) => {
            if (!row.topic) return;
            const prev = topicMap.get(row.topic) || { soa: 0, vis: 0, sentiment: 0, count: 0 };
            topicMap.set(row.topic, {
                soa: prev.soa + (row.share_of_answers || 0),
                vis: prev.vis + (row.visibility_index || 0),
                sentiment: prev.sentiment + (row.sentiment_score || 0),
                count: prev.count + 1
            });
        });

        // Calculate combined score and rank topics
        const topicScores: { name: string; score: number; soa: number; vis: number; sentiment: number }[] = [];
        topicMap.forEach((val, topic) => {
            const avgSoa = val.soa / val.count;
            const avgVis = val.vis / val.count;
            const avgSentiment = val.sentiment / val.count;
            // Combined score: weighted sum (SOA 40%, Visibility 40%, Sentiment 20%)
            const combinedScore = (avgSoa * 0.4) + (avgVis * 0.4) + ((avgSentiment + 1) / 2 * 0.2);
            topicScores.push({
                name: topic,
                score: combinedScore,
                soa: avgSoa,
                vis: avgVis,
                sentiment: avgSentiment
            });
        });

        topicScores.sort((a, b) => b.score - a.score);
        const topTopics = topicScores.slice(0, 3).map(t => ({
            name: t.name,
            id: t.name,
            changes: {
                combined_score: {
                    absolute: Number(t.score.toFixed(2)),
                    percentage: 0
                }
            }
        }));

        return {
            queries: {
                gains: formatItem(gains),
                losses: formatItem(losses),
            },
            topics: {
                gains: topTopics as any,
                losses: [],
            },
            sources: {
                gains: sourcesWithScores as any,
                losses: [],
            },
        };
    }

    // ===== Helper Methods =====

    /**
     * Calculate delta (absolute and percentage change)
     */
    private calculateDelta(current: number, previous: number): { absolute: number; percentage: number } {
        const absolute = current - previous;
        const percentage = previous !== 0 ? (absolute / previous) * 100 : 0;

        return {
            absolute: Number(absolute.toFixed(2)),
            percentage: Number(percentage.toFixed(2)),
        };
    }

    /**
     * Aggregate a specific metric from data array
     */
    private aggregateMetric(data: any[], metricField: string): number {
        if (!data || data.length === 0) return 0;

        const values = data.map(d => d[metricField]).filter(v => v != null);
        if (values.length === 0) return 0;

        const sum = values.reduce((acc, val) => acc + val, 0);
        return Number((sum / values.length).toFixed(2));
    }

    /**
     * Group collector results by LLM (collector_type)
     */
    private groupByLLM(results: any[]): Record<string, any[]> {
        const groups: Record<string, any[]> = {};

        results.forEach(result => {
            const llm = result.collector_type || 'Unknown';
            if (!groups[llm]) groups[llm] = [];
            groups[llm].push(result);
        });

        return groups;
    }

    /**
     * Calculate LLM-specific metrics (simplified)
     */
    private calculateLLMVisibility(results: any[]): number {
        // Simplified: count results with brand mentioned
        const withMention = results.filter(r => r.raw_answer && r.raw_answer.length > 0);
        return results.length > 0 ? (withMention.length / results.length) * 100 : 0;
    }

    private calculateLLMAvgPosition(results: any[]): number {
        // TODO: Calculate average position from extracted positions
        return 0;
    }

    private calculateLLMAppearanceRate(results: any[]): number {
        // TODO: Calculate appearance rate
        return 0;
    }

    private calculateLLMSOA(results: any[]): number {
        // TODO: Calculate share of answer
        return 0;
    }

    /**
     * Fetch competitor metrics for a period
     */
    private async fetchCompetitorMetrics(
        brandId: string,
        competitorName: string,
        startDate: Date,
        endDate: Date
    ) {
        // TODO: Fetch competitor metrics from extracted_positions or optimized tables
        return {
            visibility: 0,
            average_position: 0,
            appearance_rate: 0,
            share_of_answer: 0,
            sentiment: 0,
        };
    }
}

export const dataAggregationService = new DataAggregationService();
