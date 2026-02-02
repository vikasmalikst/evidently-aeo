import { opportunityIdentifierService, Opportunity, OpportunityResponse } from '../opportunity-identifier/opportunity-identifier.service';
import { sourceAttributionService } from '../../services/source-attribution.service';
import { supabase } from '../../config/supabase';
import * as crypto from 'crypto';

export interface CompetitorInsight {
    competitorName: string;
    totalGaps: number;
    metrics: {
        soa: { gapCount: number; percentage: number };
        sentiment: { gapCount: number; percentage: number };
        visibility: { gapCount: number; percentage: number };
    };
    primaryWeakness: string;
    opportunities: Opportunity[];
}

export interface TopicGapStat {
    topic: string;
    avgGap: number;
    gapDensity: number; // % of queries in this topic that have gaps
    criticalCount: number;
    primaryWeakness: string;
    leadingCompetitor: string;
}

export interface VolumeContext {
    totalQueries: number;
    gapPercentage: number;
    criticalPercentage: number;
    healthScore: number;
    gapCount: number;
    criticalCount: number;
}

export interface CitationSourceStat {
    name: string;
    url: string;
    type: string;
    percentCitations: number; // Calculated as (sourceCitations / totalCitations) * 100
    sentiment: number;
    soa: number;
    mentionRate: number;
}

export interface ExecutiveSummaryData {
    volumeContext: VolumeContext;
    competitorInsights: CompetitorInsight[];
    topicGaps: TopicGapStat[];
    topQueries: Opportunity[];
    topCitationSources: CitationSourceStat[];
    dateRange: { start: string; end: string };
    topicLeadership: {
        visibility: number;
        soa: number;
        sentiment: number;
        presence: number;
    };
}

export class ExecutiveSummaryService {

    /**
     * Generate the data payload for the Executive Summary
     */
    async generateSummaryData(brandId: string, customerId: string, days: number = 7): Promise<ExecutiveSummaryData> {
        // 1. Get Base Data
        const response: OpportunityResponse = await opportunityIdentifierService.identifyOpportunities({
            brandId,
            customerId,
            days
        });

        const totalQueries = response.totalAnalyzedQueries || 1; // Prevent div by zero
        const opportunities = response.opportunities;

        // 2. Calculate Volume Context
        const volumeContext = this.calculateVolumeContext(response, totalQueries);

        // 3. Cluster Data
        const competitorInsights = this.aggregateCompetitorInsights(opportunities, totalQueries);
        const topicGaps = this.aggregateTopicGaps(opportunities, totalQueries);
        const topQueries = this.getTopQueries(opportunities);

        // 4. Citation Analysis
        const topCitationSources = await this.aggregateTopCitationSources(brandId, customerId, response.dateRange);

        // 5. Topic Leadership
        const topicLeadership = await opportunityIdentifierService.getTopicLeadershipStats({
            brandId,
            customerId,
            days
        });

        return {
            volumeContext,
            competitorInsights,
            topicGaps,
            topQueries,
            topCitationSources,
            dateRange: response.dateRange,
            topicLeadership
        };
    }

    /**
     * Smart Caching Methods
     */

    public generateDataHash(data: ExecutiveSummaryData): string {
        // Hash the "Input" data (Stats) to detect changes.
        // We use JSON stringify, but need deterministic key order ideally.
        // For simplicity, JSON.stringify is usually stable enough if object construction is distinct.
        // A safer way is to hash key components.
        // Let's hash the full object for safety.
        return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    }

    public async getLatestReport(brandId: string, date: Date = new Date()): Promise<any | null> {
        // Find record for this brand on this date (UTC date part)
        // Since we store report_date as DATE, we can match string 'YYYY-MM-DD'
        const dateStr = date.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('executive_summaries')
            .select('*')
            .eq('brand_id', brandId)
            .eq('report_date', dateStr)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            console.error('[ExecSummary] Failed to fetch latest report:', error);
            return null;
        }

        return data;
    }

    public async upsertReport(
        brandId: string,
        brandName: string,
        customerId: string,
        inputData: ExecutiveSummaryData,
        llmResponse: any
    ): Promise<void> {
        const dateStr = new Date().toISOString().split('T')[0];
        const hash = this.generateDataHash(inputData);

        // Normalize LLM response payload
        const finalLlmResponse = typeof llmResponse === 'string'
            ? { text: llmResponse }
            : llmResponse;

        // Upsert logic:
        // We want to update if (brand_id, report_date) exists
        const { error } = await supabase
            .from('executive_summaries')
            .upsert({
                brand_id: brandId,
                brand_name: brandName,
                customer_id: customerId || null, // Handle potential undefined
                report_date: dateStr,
                analyzed_date_range: inputData.dateRange,
                input_data: inputData,
                llm_response: finalLlmResponse,
                data_hash: hash,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'brand_id, report_date'
            });

        if (error) {
            console.error('[ExecSummary] Failed to upsert report:', error);
            throw new Error('Failed to save Executive Summary');
        }
    }

    private calculateVolumeContext(response: OpportunityResponse, totalQueries: number): VolumeContext {
        const opportunities = response.opportunities;
        const summary = response.summary;

        // Count unique queries with gaps
        const uniqueGapQueries = new Set(opportunities.map(o => o.queryId)).size;

        // Count unique queries with "Critical" gaps
        const uniqueCriticalQueries = new Set(
            opportunities.filter(o => o.severity === 'Critical').map(o => o.queryId)
        ).size;

        const gapPercentage = Math.round((uniqueGapQueries / totalQueries) * 100);
        const criticalPercentage = Math.round((uniqueCriticalQueries / totalQueries) * 100);

        // Simple Health Score: 100 - (Gap% weighted by severity?) 
        // Or just 100 - Gap%. Let's do a slightly weighted one.
        // Critical worth 3x, High 2x, Medium 1x.
        // But keep it simple for now as per strategy: (Total - Unique Critical) / Total is too lenient?
        // Strategy said: (Total - Unique Critical/High) / Total * 100 
        const severeQueries = new Set(
            opportunities.filter(o => o.severity === 'Critical' || o.severity === 'High').map(o => o.queryId)
        ).size;

        const healthScore = Math.max(0, Math.round(((totalQueries - severeQueries) / totalQueries) * 100));

        return {
            totalQueries,
            gapPercentage,
            criticalPercentage,
            healthScore,
            gapCount: uniqueGapQueries,
            criticalCount: uniqueCriticalQueries
        };
    }

    private aggregateCompetitorInsights(opportunities: Opportunity[], totalQueries: number): CompetitorInsight[] {
        const compMap = new Map<string, {
            totalGaps: number;
            metrics: {
                soa: { count: number };
                sentiment: { count: number };
                visibility: { count: number };
            };
            opportunities: Opportunity[];
        }>();

        // 1. Group opportunities by competitor
        for (const op of opportunities) {
            // Only care about categorized gaps where a competitor is identified
            if (!op.competitor) continue;

            const compName = op.competitor;
            if (!compMap.has(compName)) {
                compMap.set(compName, {
                    totalGaps: 0,
                    metrics: {
                        soa: { count: 0 },
                        sentiment: { count: 0 },
                        visibility: { count: 0 }
                    },
                    opportunities: []
                });
            }

            const stats = compMap.get(compName)!;
            stats.totalGaps++;
            stats.opportunities.push(op);

            // Increment metric counters
            if (op.metricName === 'soa') stats.metrics.soa.count++;
            if (op.metricName === 'sentiment') stats.metrics.sentiment.count++;
            if (op.metricName === 'visibility') stats.metrics.visibility.count++;
        }

        // 2. Transform into Insight Objects
        const results: CompetitorInsight[] = [];
        for (const [compName, stats] of compMap) {
            // Calculate primary weakness
            let primaryWeakness = 'visibility';
            let maxCount = stats.metrics.visibility.count;

            if (stats.metrics.soa.count > maxCount) { // SOA is simpler weakness to fix or more critical? Just max count for now.
                primaryWeakness = 'soa';
                maxCount = stats.metrics.soa.count;
            }
            if (stats.metrics.sentiment.count > maxCount) {
                primaryWeakness = 'sentiment';
            }

            results.push({
                competitorName: compName,
                totalGaps: stats.totalGaps,
                metrics: {
                    soa: {
                        gapCount: stats.metrics.soa.count,
                        percentage: Math.round((stats.metrics.soa.count / totalQueries) * 100)
                    },
                    sentiment: {
                        gapCount: stats.metrics.sentiment.count,
                        percentage: Math.round((stats.metrics.sentiment.count / totalQueries) * 100)
                    },
                    visibility: {
                        gapCount: stats.metrics.visibility.count,
                        percentage: Math.round((stats.metrics.visibility.count / totalQueries) * 100)
                    }
                },
                primaryWeakness,
                // Top 50 opportunities for this competitor, sorted by gap size
                opportunities: stats.opportunities.sort((a, b) => b.gap - a.gap).slice(0, 50)
            });
        }

        // Sort competitors by total gaps (Most threatening first), then name
        return results.sort((a, b) => {
            if (b.totalGaps !== a.totalGaps) return b.totalGaps - a.totalGaps;
            return a.competitorName.localeCompare(b.competitorName);
        });
    }

    private aggregateTopicGaps(opportunities: Opportunity[], totalQueries: number): TopicGapStat[] {
        const topicMap = new Map<string, {
            gaps: number;
            totalGapValue: number;
            critical: number;
            competitors: Map<string, number>;
            metrics: { visibility: number; soa: number; sentiment: number };
        }>();

        for (const op of opportunities) {
            const topic = op.topic || 'Uncategorized';
            if (!topicMap.has(topic)) {
                topicMap.set(topic, {
                    gaps: 0,
                    totalGapValue: 0,
                    critical: 0,
                    competitors: new Map(),
                    metrics: { visibility: 0, soa: 0, sentiment: 0 }
                });
            }

            const stats = topicMap.get(topic)!;
            stats.gaps++;
            stats.totalGapValue += op.gap;
            if (op.severity === 'Critical') stats.critical++;
            stats.metrics[op.metricName]++;

            if (op.competitor) {
                stats.competitors.set(op.competitor, (stats.competitors.get(op.competitor) || 0) + 1);
            }
        }

        const result: TopicGapStat[] = [];
        for (const [topic, stats] of topicMap) {
            // Find leading competitor (the one causing most pain)
            let leader = 'Various';
            let maxCount = 0;
            for (const [comp, count] of stats.competitors) {
                if (count > maxCount) {
                    maxCount = count;
                    leader = comp;
                }
            }

            // Primary weakness
            let weakness = 'visibility';
            if (stats.metrics.soa > stats.metrics.visibility) weakness = 'soa';
            if (stats.metrics.sentiment > stats.metrics.visibility && stats.metrics.sentiment > stats.metrics.soa) weakness = 'sentiment';

            result.push({
                topic,
                avgGap: Math.round((stats.totalGapValue / stats.gaps) * 10) / 10,
                gapDensity: Math.round((stats.gaps / totalQueries) * 100), // This is rough, ideally per-topic query count
                criticalCount: stats.critical,
                primaryWeakness: weakness,
                leadingCompetitor: leader
            });
        }

        return result.sort((a, b) => {
            if (b.avgGap !== a.avgGap) return b.avgGap - a.avgGap;
            return a.topic.localeCompare(b.topic);
        });
    }

    private getTopQueries(opportunities: Opportunity[]): Opportunity[] {
        // Explicitly sort by gap (desc) then specific query text (asc) for stability
        return [...opportunities]
            .sort((a, b) => {
                if (b.gap !== a.gap) return b.gap - a.gap;
                return a.queryText.localeCompare(b.queryText);
            })
            .slice(0, 10);
    }
    private async aggregateTopCitationSources(
        brandId: string,
        customerId: string,
        dateRange: { start: string; end: string }
    ): Promise<CitationSourceStat[]> {
        const sourceData = await sourceAttributionService.getSourceAttribution(
            brandId,
            customerId,
            dateRange
        );

        if (!sourceData || !sourceData.sources || sourceData.sources.length === 0) return [];

        // totalCitations can be derived from summing up citations of all sources 
        // OR using the maxCitations if we want relative to max (but user asked for % of total).
        // Let's sum them up.
        const totalCitations = sourceData.sources.reduce((sum, s) => sum + (s.citations || 0), 0);

        return sourceData.sources
            .map(s => ({
                name: s.name,
                url: s.url,
                type: s.type,
                percentCitations: totalCitations > 0 ? Math.round(((s.citations || 0) / totalCitations) * 100) : 0,
                sentiment: Math.round(s.sentiment),
                soa: Math.round(s.soa),
                mentionRate: Math.round(s.mentionRate)
            }))
            .sort((a, b) => b.percentCitations - a.percentCitations)
            .slice(0, 10); // Top 10
    }
}

export const executiveSummaryService = new ExecutiveSummaryService();
