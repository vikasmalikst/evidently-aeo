
import { supabaseAdmin } from '../../config/database';
import { OptimizedMetricsHelper } from '../query-helpers/optimized-metrics.helper';
import { sourceAttributionService } from '../source-attribution.service';
import {
    buildCompetitorExclusionList,
    filterCompetitorSources,
} from './competitor-filter.service';
import { domainReadinessService } from '../domain-readiness/domain-readiness.service';
import { graphRecommendationService } from './graph-recommendation.service';
import { BrandContextV3 } from './recommendation.types';

export class RecommendationContextService {
    /**
     * Phase 0: Gather Initial Context
     * Fetches brand data, metrics, competitors, and qualitative insights
     */
    async gatherContext(
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
                console.error('❌ [RecommendationContextService] Brand not found:', brandError);
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
                    console.log(`🏷️ [RecommendationContextService] Brand domain extracted: ${brandDomain} (from ${brand.homepage_url})`);
                } catch (e) {
                    // Fallback: use homepage_url directly if URL parsing fails
                    brandDomain = brand.homepage_url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
                    console.log(`🏷️ [RecommendationContextService] Brand domain extracted (fallback): ${brandDomain}`);
                }
            } else {
                console.warn(`⚠️ [RecommendationContextService] No homepage_url found for brand ${brandId}, brand whitelist may not work correctly`);
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
                console.log('   ⚡ [RecommendationContextService] Using optimized queries (metric_facts + brand_metrics)');
            } else {
                console.log('   📋 [RecommendationContextService] Using legacy queries (extracted_positions)');
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
            const { data: competitors, error: competitorError } = await supabaseAdmin
                .from('brand_competitors')
                .select('id, competitor_name, competitor_url, metadata')
                .eq('brand_id', brandId)
                .order('priority', { ascending: true })
                .limit(10);

            if (competitorError) {
                console.error(`❌ [RecommendationContextService] Error fetching competitors:`, competitorError);
            }

            // Debug: Log raw competitor data
            if (competitors && competitors.length > 0) {
                console.log(`🔍 [RecommendationContextService] Found ${competitors.length} active competitor(s)`);
            } else {
                console.warn(`⚠️ [RecommendationContextService] No active competitors found for brand ${brandId}`);
            }

            // Build competitor exclusion list
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
                        // Legacy: Query from old competitors table
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

            // Source attribution
            console.log('📊 [RecommendationContextService] Fetching source data using source-attribution service...');
            const sourceAttributionStartTime = Date.now();

            const sourceAttributionResponse = await sourceAttributionService.getSourceAttribution(
                brandId,
                customerId,
                { start: currentStartDate, end: currentEndDate }
            );

            console.log(`✅ [RecommendationContextService] Fetched ${sourceAttributionResponse.sources.length} sources in ${Date.now() - sourceAttributionStartTime}ms`);

            const sourceMetrics: BrandContextV3['sourceMetrics'] = [];

            if (sourceAttributionResponse.sources && sourceAttributionResponse.sources.length > 0) {
                // Sort by value and take top 10
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
                        sentiment: Math.round((source.sentiment || 0) * 100) / 100,
                        citations: source.citations,
                        impactScore: Math.round((source.value || 0) * 10) / 10,
                        visibility: source.visibility ? Math.round(source.visibility) : 0
                    });
                }

                // Layer 1 filter
                const filteredSourceMetrics = filterCompetitorSources(sourceMetrics, competitorExclusionList);
                sourceMetrics.length = 0;
                sourceMetrics.push(...filteredSourceMetrics);
            } else {
                console.warn('⚠️ [RecommendationContextService] No sources found');
            }

            // Aggregated competitor metrics
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
                brandDomain: brandDomain,
                brandSummary: (brand as any).summary || undefined,
                industry: brand.industry || undefined,
                visibilityIndex,
                shareOfAnswers,
                sentimentScore,
                trends,
                competitors: competitorData,
                sourceMetrics: sourceMetrics.slice(0, 10),
                _competitorExclusionList: competitorExclusionList,
                _competitorAvgMetrics: {
                    visibility: competitorAvgVisibility,
                    soa: competitorAvgSoa,
                    sentiment: competitorAvgSentiment,
                    count: competitorData.length
                },
                domainAuditResult: await domainReadinessService.getLatestAudit(brand.id),
                graphInsights: await this.runGraphAnalysis(brandId, brand.name, competitors?.map(c => c.competitor_name) || []),
                ...(await this.getQualitativeContext(brandId, customerId, currentStartDate))
            };

        } catch (error) {
            console.error('❌ [RecommendationContextService] Error gathering context:', error);
            return null;
        }
    }

    /**
     * Run Graph Algorithms (PageRank, Louvain) and Store Snapshot
     */
    private async runGraphAnalysis(
        brandId: string,
        brandName: string,
        competitorNames: string[]
    ): Promise<BrandContextV3['graphInsights']> {
        try {
            console.log('🕸️ [RecommendationContextService] Running Graph Analysis...');
            const graphStartTime = Date.now();

            // 1. Fetch Consolidated Analysis Data
            const { data: cacheData, error } = await supabaseAdmin
                .from('consolidated_analysis_cache')
                .select(`
            collector_result_id, 
            keywords, 
            sentiment, 
            products, 
            quotes,
            narrative, 
            collector_results!inner(brand_id)
          `)
                .eq('collector_results.brand_id', brandId)
                .limit(2000);

            if (error || !cacheData || cacheData.length === 0) {
                console.warn('⚠️ [RecommendationContextService] No data found for Graph Analysis', error);
                return undefined;
            }

            // 2. Transform Data
            const graphResults = cacheData.map(row => ({
                id: row.collector_result_id,
                analysis: {
                    keywords: row.keywords || [],
                    sentiment: row.sentiment || {},
                    products: row.products || {},
                    quotes: row.quotes || [],
                    citations: {}
                } as any,
                competitorNames
            }));

            // 3. Build & Run Graph
            graphRecommendationService.buildGraph(brandName, graphResults);
            graphRecommendationService.runAlgorithms();

            // 4. Extract Insights
            const opportunityGaps = competitorNames.flatMap(c => graphRecommendationService.getOpportunityGaps(c));
            const battlegrounds = competitorNames.flatMap(c => graphRecommendationService.getBattlegrounds(brandName, c));
            const strongholds = competitorNames.flatMap(c => graphRecommendationService.getCompetitorStrongholds(c));
            const keywordQuadrantData = graphRecommendationService.getKeywordQuadrantData();

            // 5. Store Snapshot in DB
            const snapshot = {
                brand_id: brandId,
                keyword_quadrant_data: keywordQuadrantData,
                opportunity_gaps: opportunityGaps,
                battlegrounds: battlegrounds,
                strongholds: strongholds,
                source: 'recommendation_engine'
            };

            const { error: insertError } = await supabaseAdmin
                .from('recommendations_v3_graph_insights')
                .insert(snapshot);

            if (insertError) {
                console.warn('⚠️ [RecommendationContextService] Failed to store Graph Snapshot:', insertError.message);
            } else {
                console.log(`✅ [RecommendationContextService] Stored Graph Snapshot with ${opportunityGaps.length} gaps found.`);
            }

            console.log(`🕸️ [RecommendationContextService] Graph Analysis completed in ${Date.now() - graphStartTime}ms`);

            return {
                opportunityGaps: opportunityGaps.slice(0, 5),
                battlegrounds: battlegrounds.slice(0, 5),
                competitorStrongholds: strongholds.slice(0, 5)
            };

        } catch (e) {
            console.error('❌ [RecommendationContextService] Graph Analysis Failed:', e);
            return undefined;
        }
    }

    /**
     * Fetch Qualitative Context
     */
    private async getQualitativeContext(
        brandId: string,
        customerId: string,
        startDate: string
    ): Promise<Partial<BrandContextV3>> {
        try {
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
                console.warn('⚠️ [RecommendationContextService] Error fetching qualitative context:', error.message);
                return {};
            }

            if (!data || data.length === 0) {
                return {};
            }

            return {
                topKeywords: this.aggregateKeywords(data),
                strategicNarrative: this.aggregateNarratives(data),
                keyQuotes: this.extractTopQuotes(data)
            };
        } catch (err) {
            console.error('❌ [RecommendationContextService] Unexpected error in getQualitativeContext:', err);
            return {};
        }
    }

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
            .slice(0, 10);
    }

    private aggregateNarratives(data: any[]): string {
        const narratives = new Set<string>();

        data.forEach(row => {
            if (row.narrative && row.narrative.brand_summary) {
                narratives.add(row.narrative.brand_summary);
            }
        });

        return Array.from(narratives).slice(0, 3).join(' ');
    }

    private extractTopQuotes(data: any[]): string[] {
        const quotes: string[] = [];

        data.forEach(row => {
            if (Array.isArray(row.quotes)) {
                row.quotes.forEach((q: any) => {
                    if (q && q.text && q.text.length > 20) {
                        quotes.push(`"${q.text}" (${q.sentiment})`);
                    }
                });
            }
        });

        return quotes.slice(0, 5);
    }
}

export const recommendationContextService = new RecommendationContextService();
