/**
 * Executive Reporting Data Aggregation Service
 * 
 * Core service for aggregating all metrics needed for executive reports.
 * Fetches data from various sources and compiles into structured format.
 */

import { supabaseAdmin } from '../../config/database';
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
import { SourceAttributionService } from '../source-attribution.service';

const sourceAttributionService = new SourceAttributionService();

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
        const { data: brandData, error: brandError } = await supabaseAdmin
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
        const helper = new OptimizedMetricsHelper(supabaseAdmin);

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
        const { data: brandData, error: brandError } = await supabaseAdmin
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
        const helper = new OptimizedMetricsHelper(supabaseAdmin);

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
        console.log(`\n🤖 [EXEC-REPORT] ========== AGGREGATING COMPETITIVE LANDSCAPE ==========`);
        console.log(`[EXEC-REPORT] Brand ID: ${brandId}`);
        console.log(`[EXEC-REPORT] Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

        // First, fetch the customer_id for this brand
        const { data: brandData, error: brandError } = await supabaseAdmin
            .from('brands')
            .select('customer_id, name, homepage_url, metadata')
            .eq('id', brandId)
            .single();

        const brandUrl = brandData?.metadata?.domain || brandData?.homepage_url || (brandData?.name.toLowerCase().includes('sandisk') ? 'sandisk.com' : '');
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
        const helper = new OptimizedMetricsHelper(supabaseAdmin);

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

            // Calculate average position from brand_positions JSONB array
            const positionValues: number[] = [];
            rows.forEach(r => {
                const positions = r.brand_positions || [];
                if (Array.isArray(positions) && positions.length > 0) {
                    // Average positions within this row
                    const avgPos = positions.reduce((sum: number, pos: any) => sum + Number(pos), 0) / positions.length;
                    positionValues.push(avgPos);
                } else if (r.brand_first_position != null) {
                    // Fallback to first position if array is empty but first pos exists
                    positionValues.push(Number(r.brand_first_position));
                }
            });

            console.log(`[EXEC-REPORT] Brand data points: vis=${visibilityValues.length}, soa=${shareValues.length}, sent=${sentimentValues.length}, pos=${positionValues.length}`);

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
            const averagePosition = positionValues.length > 0
                ? positionValues.reduce((sum, v) => sum + v, 0) / positionValues.length
                : 0;

            console.log(`[EXEC-REPORT] Brand aggregated values: vis=${visibility.toFixed(2)}, soa=${shareOfAnswer.toFixed(2)}, sent=${sentiment.toFixed(2)}, avgPos=${averagePosition.toFixed(2)}`);

            landscape.push({
                name: brandName,
                is_brand: true,
                current: {
                    visibility: Number(visibility.toFixed(2)),
                    share_of_answer: Number(shareOfAnswer.toFixed(2)),
                    sentiment: Number(sentiment.toFixed(2)),
                    average_position: Number(averagePosition.toFixed(2)),
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
        const { data: competitors, error: compError } = await supabaseAdmin
            .from('brand_competitors')
            .select('id, competitor_name, competitor_url, metadata')
            .eq('brand_id', brandId);

        console.log(`[EXEC-REPORT] Found ${competitors?.length || 0} competitors`);

        if (competitors) {
            for (const competitor of competitors) {
                console.log(`[EXEC-REPORT] Processing competitor: ${competitor.competitor_name} (${competitor.id})`);
                try {
                    const compMetrics = await helper.fetchCompetitorMetricsByDateRange({
                        competitorId: competitor.id,
                        brandId,
                        customerId,
                        startDate: periodStart.toISOString(),
                        endDate: periodEnd.toISOString(),
                        includeSentiment: true
                    });

                    console.log(`[EXEC-REPORT] Competitor metrics result: success=${compMetrics.success}, rows=${compMetrics.data?.length || 0}`);

                    if (compMetrics.success && compMetrics.data) {
                        const rows = compMetrics.data;
                        const visibilityValues = rows.map(r => r.visibility_index).filter(v => v != null) as number[];
                        const shareValues = rows.map(r => r.share_of_answers).filter(v => v != null) as number[];
                        const sentimentValues = rows.map(r => r.sentiment_score).filter(v => v != null) as number[];

                        // Calculate average position from competitor_positions JSONB array
                        const positionValues: number[] = [];
                        rows.forEach(r => {
                            const positions = r.competitor_positions || [];
                            if (Array.isArray(positions) && positions.length > 0) {
                                // Average positions within this row
                                const avgPos = positions.reduce((sum: number, pos: any) => sum + Number(pos), 0) / positions.length;
                                positionValues.push(avgPos);
                            }
                        });

                        console.log(`[EXEC-REPORT] ${competitor.competitor_name} data points: vis=${visibilityValues.length}, soa=${shareValues.length}, sent=${sentimentValues.length}, pos=${positionValues.length}`);

                        const visibility = visibilityValues.length > 0
                            ? visibilityValues.reduce((sum, v) => sum + v, 0) / visibilityValues.length * 100
                            : 0;
                        const shareOfAnswer = shareValues.length > 0
                            ? shareValues.reduce((sum, v) => sum + v, 0) / shareValues.length
                            : 0;
                        const sentiment = sentimentValues.length > 0
                            ? sentimentValues.reduce((sum, v) => sum + v, 0) / sentimentValues.length
                            : 0;
                        const averagePosition = positionValues.length > 0
                            ? positionValues.reduce((sum, v) => sum + v, 0) / positionValues.length
                            : 0;

                        console.log(`[EXEC-REPORT] ${competitor.competitor_name} aggregated: vis=${visibility.toFixed(2)}, soa=${shareOfAnswer.toFixed(2)}, sent=${sentiment.toFixed(2)}, avgPos=${averagePosition.toFixed(2)}`);

                        landscape.push({
                            name: competitor.competitor_name,
                            is_brand: false,
                            current: {
                                visibility: Number(visibility.toFixed(2)),
                                share_of_answer: Number(shareOfAnswer.toFixed(2)),
                                sentiment: Number(sentiment.toFixed(2)),
                                average_position: Number(averagePosition.toFixed(2)),
                                appearance_rate: 0
                            },
                            deltas: {
                                share_of_answer: { percentage: 0 },
                                visibility: { percentage: 0 }
                            },
                            website_url: competitor.metadata?.domain || competitor.competitor_url || ''
                        });
                    } else {
                        console.log(`[EXEC-REPORT] ${competitor.competitor_name}: Failed to fetch metrics or no data`);
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
        const { data: latestResult, error } = await supabaseAdmin
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

        // Map known category keys to friendly labels
        const categoryLabels: Record<string, string> = {
            technicalCrawlability: 'Technical',
            contentQuality: 'Content',
            semanticStructure: 'Semantic',
            accessibilityAndBrand: 'Access & Brand',
            aeoOptimization: 'AEO',
            botAccess: 'LLM Bot Access',
            llmBotAccess: 'LLM Bot Access',
        };

        // Extraction helper for scores from audit result
        const extractSubScores = (audit: any): Record<string, number> => {
            if (!audit) return {};
            const auditScores: Record<string, number> = {};
            const rawScores = audit.scores || {};

            if (rawScores && typeof rawScores === 'object') {
                Object.entries(rawScores).forEach(([key, value]: [string, any]) => {
                    const scoreValue = typeof value === 'number' ? value : (value?.score || value?.value || 0);
                    auditScores[key] = Math.round(scoreValue);
                });
            }

            // Fallback for botAccess if missing but data exists
            if (!auditScores['botAccess'] && audit.bot_access && Array.isArray(audit.bot_access) && audit.bot_access.length > 0) {
                const allowed = audit.bot_access.filter((b: any) => b.allowed).length;
                const total = audit.bot_access.length;
                auditScores['botAccess'] = Math.round((allowed / total) * 100);
            }

            return auditScores;
        };

        const currentSubScoresRaw = extractSubScores(latestResult);

        // Fetch previous result for comparison from domain_readiness_audits
        const { data: previousResult } = await supabaseAdmin
            .from('domain_readiness_audits')
            .select('*')
            .eq('brand_id', brandId)
            .lt('created_at', latestResult.created_at)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const previousSubScoresRaw = extractSubScores(previousResult);

        const subScores: DomainReadinessData['sub_scores'] = {};

        // Merge and calculate deltas for all categories found in current or previous
        const allCategories = new Set([
            ...Object.keys(currentSubScoresRaw),
            ...Object.keys(previousSubScoresRaw)
        ]);

        allCategories.forEach(key => {
            const currentScore = currentSubScoresRaw[key] || 0;
            const previousScore = previousSubScoresRaw[key] || 0;

            subScores[key] = {
                score: currentScore,
                previous_score: previousScore,
                delta: this.calculateDelta(currentScore, previousScore),
                label: categoryLabels[key] || key.replace(/([A-Z])/g, ' $1').trim(),
            };
        });

        const overallScore = latestResult.overall_score || 0;
        const previousOverallScore = previousResult?.overall_score || 0;
        const scoreDelta = this.calculateDelta(overallScore, previousOverallScore);

        // TODO: Fetch 12-week readiness trend
        const twelveWeekTrend: TrendDataPoint[] = [];

        return {
            overall_score: overallScore,
            previous_overall_score: previousOverallScore,
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

        // Fetch Pipeline: created within period OR active status
        // We fetch all recent recommendations to show the full pipeline state
        // 1. Get the latest generation ID for this brand to match UI "Latest Run" view
        const { data: latestGen, error: latestGenError } = await supabaseAdmin
            .from('recommendations')
            .select('generation_id, created_at')
            .eq('brand_id', brandId)
            .not('generation_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (latestGenError) {
            console.error('❌ [EXEC-REPORT] Error fetching latest generation:', latestGenError);
        }

        const latestGenerationId = latestGen?.generation_id;
        console.log(`🔎 [EXEC-REPORT] Latest Generation ID for ${brandId}: ${latestGenerationId}`);
        if (latestGen) {
            console.log(`🔎 [EXEC-REPORT] Found generation from: ${latestGen.created_at}`);
        }

        // 2. Fetch recommendations for the LATEST generation only
        let query = supabaseAdmin
            .from('recommendations')
            .select('*')
            .eq('brand_id', brandId);

        if (latestGenerationId) {
            query = query.eq('generation_id', latestGenerationId);
        } else {
            // Fallback if no generation ID found (shouldn't happen for active brands)
            query = query.order('created_at', { ascending: false }).limit(50);
        }

        const { data: recommendations, error } = await query;

        if (error) {
            console.error('❌ [EXEC-REPORT] Error fetching recommendations:', error);
        }

        const recs = recommendations || [];
        const startIso = periodStart.toISOString();
        const endIso = periodEnd.toISOString();

        // Count statuses based on Current Snapshot (matching Improve page UI tabs)
        // 1. Generated: Total distinct recommendations generated
        const generated = recs.length;

        // 2. Pending: Pending review and not moving forward yet
        const needs_review = recs.filter(r =>
            (r.review_status === 'pending_review' || !r.review_status) &&
            !r.is_completed &&
            !r.is_approved &&
            !r.is_content_generated
        ).length;

        // 3. Approved: Approved but waiting for content
        const approved = recs.filter(r =>
            (r.is_approved === true || r.review_status === 'approved') &&
            !r.is_content_generated &&
            !r.is_completed
        ).length;

        // 4. Content: Content generated but not implemented
        const content_generated = recs.filter(r =>
            r.is_content_generated === true &&
            !r.is_completed
        ).length;

        // 5. Implemented: Completed recommendations
        const implemented = recs.filter(r =>
            r.is_completed === true
        ).length;

        // 6. Rejected: Rejected recommendations
        const rejected = recs.filter(r =>
            r.review_status === 'rejected'
        ).length;

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
                generated,
                approved,
                rejected,
                needs_review,
                content_generated,
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
        const { data: brandData } = await supabaseAdmin.from('brands').select('customer_id').eq('id', brandId).single();
        const customerId = brandData?.customer_id;

        if (!customerId) {
            return {
                queries: { gains: [], losses: [] },
                topics: { gains: [], losses: [] },
                sources: {
                    visibility_gains: [],
                    visibility_losses: [],
                    soa_gains: [],
                    soa_losses: [],
                    sentiment_gains: [],
                    sentiment_losses: [],
                    position_gains: [],
                    position_losses: [],
                },
            };
        }

        const { OptimizedMetricsHelper } = await import('../query-helpers/optimized-metrics.helper');
        const helper = new OptimizedMetricsHelper(supabaseAdmin);

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
        const queryIds = [...gains, ...losses].map(d => String(d.query_id));
        const queryTextMap = new Map<string, string>();

        console.log(`[EXEC-REPORT] Fetching query texts for ${queryIds.length} queries`);

        if (queryIds.length > 0) {
            const { data: queries, error: queryError } = await supabaseAdmin
                .from('generated_queries')
                .select('id, query_text')
                .in('id', queryIds);

            if (queryError) {
                console.error('[EXEC-REPORT] Error fetching query texts:', queryError);
            } else {
                console.log(`[EXEC-REPORT] Fetched ${queries?.length || 0} query texts`);
                queries?.forEach(q => {
                    const queryId = String(q.id);
                    queryTextMap.set(queryId, q.query_text);
                    console.log(`[EXEC-REPORT] Mapped query ${queryId.substring(0, 8)}... -> "${q.query_text?.substring(0, 50)}..."`);
                });
            }
        }

        const formatItem = (items: any[]) => items.map(i => {
            const queryId = String(i.query_id);
            const queryText = queryTextMap.get(queryId);

            return {
                name: queryText || `Query #${queryId}`,
                query_text: queryText || undefined,
                id: queryId,
                impact_score: Math.round(i.current_vis || 0),
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
            };
        });

        // === Top Topic by combined SOA/Visibility and Sentiment ===
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

        const topicScores: { name: string; score: number; soa: number; vis: number; sentiment: number }[] = [];
        topicMap.forEach((val, topic) => {
            const avgSoa = val.soa / val.count;
            const avgVis = val.vis / val.count;
            const avgSentiment = val.sentiment / val.count;
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
            impact_score: Math.round(t.score * 100), // Convert decimal score to 0-100
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
            sources: await this.aggregateSourceMovers(brandId, periodStart, periodEnd, comparisonStart, comparisonEnd),
        };
    }

    /**
     * Aggregates citation source movers across all 8 metrics
     */
    private async aggregateSourceMovers(
        brandId: string,
        currentStart: Date,
        currentEnd: Date,
        comparisonStart: Date,
        comparisonEnd: Date
    ): Promise<TopMoversData['sources']> {
        const { data: brandData } = await supabaseAdmin.from('brands').select('customer_id').eq('id', brandId).single();
        const customerId = brandData?.customer_id;

        if (!customerId) {
            return {
                visibility_gains: [],
                visibility_losses: [],
                soa_gains: [],
                soa_losses: [],
                sentiment_gains: [],
                sentiment_losses: [],
                position_gains: [],
                position_losses: [],
            };
        }

        const sourceAttribution = await sourceAttributionService.getSourceAttribution(
            brandId,
            customerId,
            { start: currentStart.toISOString(), end: currentEnd.toISOString() },
            { start: comparisonStart.toISOString(), end: comparisonEnd.toISOString() }
        );

        const sources = sourceAttribution.sources;

        const getMovers = (outputKey: string, sourceKey: string, changeField: string, isGain: boolean): TopMoverItem[] => {
            const items = sources.filter(s => {
                const change = s[changeField] || 0;
                return isGain ? change > 0 : change < 0;
            });

            // Sort by Value (Impact Score) descending, then by magnitude of change
            items.sort((a, b) => {
                const valDiff = (b.value || 0) - (a.value || 0);
                if (Math.abs(valDiff) > 0.01) return valDiff;
                const changeA = Math.abs(a[changeField] || 0);
                const changeB = Math.abs(b[changeField] || 0);
                return changeB - changeA;
            });

            return items.slice(0, 3).map(s => {
                const absolute = s[changeField] || 0;
                const previous = (s[sourceKey] || 0) - absolute;
                const percentage = previous !== 0 ? (absolute / Math.abs(previous)) * 100 : 0;

                return {
                    name: s.name,
                    id: s.name,
                    impact_score: s.value ? Math.round(s.value) : 0,
                    changes: {
                        [outputKey]: {
                            absolute: Number(absolute.toFixed(2)),
                            percentage: Number(percentage.toFixed(2)),
                        }
                    }
                };
            });
        };

        // Visibility
        const visibility_gains = getMovers('visibility', 'visibility', 'visibilityChange', true);
        const visibility_losses = getMovers('visibility', 'visibility', 'visibilityChange', false);

        // SOA
        const soa_gains = getMovers('soa', 'soa', 'soaChange', true);
        const soa_losses = getMovers('soa', 'soa', 'soaChange', false);

        // Sentiment
        const sentiment_gains = getMovers('sentiment', 'sentiment', 'sentimentChange', true);
        const sentiment_losses = getMovers('sentiment', 'sentiment', 'sentimentChange', false);

        // Position - Inverted logic: Gain is negative change (rank 5 -> 1 is change of -4)
        const position_gains = sources
            .filter(s => (s.averagePositionChange || 0) < 0) // Improvement
            .sort((a, b) => (b.value || 0) - (a.value || 0)) // Sort by Impact
            .slice(0, 3)
            .map(s => {
                const absolute = s.averagePositionChange || 0;
                return {
                    name: s.name,
                    id: s.name,
                    impact_score: s.value ? Math.round(s.value) : 0,
                    changes: {
                        average_position: {
                            absolute: Number(absolute.toFixed(2)),
                            percentage: 0
                        }
                    }
                };
            });

        const position_losses = sources
            .filter(s => (s.averagePositionChange || 0) > 0) // Decline
            .sort((a, b) => (b.value || 0) - (a.value || 0)) // Sort by Impact
            .slice(0, 3)
            .map(s => {
                const absolute = s.averagePositionChange || 0;
                return {
                    name: s.name,
                    id: s.name,
                    impact_score: s.value ? Math.round(s.value) : 0,
                    changes: {
                        average_position: {
                            absolute: Number(absolute.toFixed(2)),
                            percentage: 0
                        }
                    }
                };
            });

        return {
            visibility_gains,
            visibility_losses,
            soa_gains,
            soa_losses,
            sentiment_gains,
            sentiment_losses,
            position_gains,
            position_losses,
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
