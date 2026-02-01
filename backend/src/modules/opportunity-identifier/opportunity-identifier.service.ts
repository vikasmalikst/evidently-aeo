/**
 * Opportunity Identifier Service
 * 
 * Analyzes brand performance across queries to identify improvement opportunities.
 * Classifies queries into 3 categories and applies appropriate thresholds.
 * 
 * Category 1: Query has Brand + Competitor name(s)
 * Category 2: Query has Brand name only
 * Category 3: Unbiased (no Brand or Competitor name)
 */

import { supabaseAdmin } from '../../config/database';
import { optimizedMetricsHelper } from '../../services/query-helpers/optimized-metrics.helper';

// ============================================================================
// Types
// ============================================================================

export type QueryCategory = 1 | 2 | 3;
export type MetricName = 'visibility' | 'soa' | 'sentiment';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Opportunity {
    id: string;
    queryId: string;
    queryText: string;
    queryCategory: QueryCategory;
    metricName: MetricName;
    brandValue: number;
    targetValue: number;
    gap: number;
    severity: Severity;
    priorityScore: number;
    competitor: string | null;
    topSources: Array<{ domain: string; url?: string; impactScore: number }>;
    responseCount: number;
    topic: string | null;
}

export interface OpportunitySummary {
    total: number;
    bySeverity: { critical: number; high: number; medium: number; low: number };
    byCategory: { 1: number; 2: number; 3: number };
    byMetric: { visibility: number; soa: number; sentiment: number };
}

export interface OpportunityResponse {
    opportunities: Opportunity[];
    summary: OpportunitySummary;
    dateRange: { start: string; end: string };
    totalAnalyzedQueries: number;
}

export interface OpportunityOptions {
    brandId: string;
    customerId: string;
    days?: number;
    collectors?: string[];
    topics?: string[];
}

// ============================================================================
// Thresholds Configuration
// ============================================================================

const THRESHOLDS = {
    category1: {
        // Brand + Competitor: relative comparison OR absolute minimum
        relative: { visibility: 3, soa: 3, sentiment: 3 }, // percentage points
        absolute: { visibility: 30, soa: 40, sentiment: 70 }
    },
    category2: {
        // Brand only: absolute thresholds
        absolute: { visibility: 30, soa: 50, sentiment: 60 }
    },
    category3: {
        // Unbiased: relative comparison against ANY competitor
        relative: { visibility: 3, soa: 5, sentiment: 5 }
    }
};

// ============================================================================
// Helper Functions
// ============================================================================



/**
 * Calculate severity based on gap size
 */
function calculateSeverity(gap: number): Severity {
    if (gap > 20) return 'Critical';
    if (gap > 10) return 'High';
    if (gap > 5) return 'Medium';
    return 'Low';
}

/**
 * Calculate priority score for sorting (higher = higher priority)
 */
function calculatePriorityScore(gap: number, metric: MetricName): number {
    const metricWeight: Record<MetricName, number> = {
        visibility: 1.2,
        soa: 1.0,
        sentiment: 0.8
    };
    return gap * metricWeight[metric];
}

/**
 * Classify query into Category 1, 2, or 3
 */
function classifyQuery(
    queryText: string,
    brandName: string,
    brandAliases: string[],
    competitors: string[]
): { category: QueryCategory; competitorsInQuery: string[] } {
    const queryLower = queryText.toLowerCase();

    // Build list of all brand terms (name + aliases)
    const allBrandTerms = [brandName, ...brandAliases].map(a => a.toLowerCase());

    // Check if brand is mentioned
    const hasBrand = allBrandTerms.some(alias => queryLower.includes(alias));

    // Find which competitors are mentioned
    const competitorsInQuery = competitors.filter(c =>
        queryLower.includes(c.toLowerCase())
    );

    if (hasBrand && competitorsInQuery.length > 0) {
        return { category: 1, competitorsInQuery };
    } else if (hasBrand) {
        return { category: 2, competitorsInQuery: [] };
    } else {
        // Unbiased - compare against all competitors
        return { category: 3, competitorsInQuery: competitors };
    }
}

/**
 * Generate a unique opportunity ID
 */
function generateOpportunityId(queryId: string, metric: MetricName, competitor: string | null): string {
    const competitorSuffix = competitor ? `-${competitor.toLowerCase().replace(/\s+/g, '_')}` : '';
    return `${queryId}-${metric}${competitorSuffix}`;
}

// ============================================================================
// Main Service Class
// ============================================================================

export class OpportunityIdentifierService {
    /**
     * Identify opportunities for a brand
     */
    async identifyOpportunities(options: OpportunityOptions): Promise<OpportunityResponse> {
        const { brandId, customerId, days = 14, collectors } = options;

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const startIso = startDate.toISOString();
        const endIso = endDate.toISOString();

        console.log(`[OpportunityIdentifier] Analyzing ${days} days for brand ${brandId}`);

        // Step 1: Fetch brand info and competitors
        const [brandResult, competitorsResult] = await Promise.all([
            supabaseAdmin
                .from('brands')
                .select('id, name, metadata')
                .eq('id', brandId)
                .single(),
            supabaseAdmin
                .from('brand_competitors')
                .select('id, competitor_name')
                .eq('brand_id', brandId)
        ]);

        if (brandResult.error || !brandResult.data) {
            throw new Error(`Brand not found: ${brandResult.error?.message}`);
        }

        const brand = brandResult.data;
        const brandAliases = this.extractAliases(brand.metadata);
        const competitors = (competitorsResult.data || []).map(c => c.competitor_name);
        const competitorMap = new Map((competitorsResult.data || []).map(c => [c.competitor_name.toLowerCase(), c.id]));

        console.log(`[OpportunityIdentifier] Brand: ${brand.name}, Aliases: ${brandAliases.length}, Competitors: ${competitors.length}`);

        // Step 2: Fetch all queries with metrics in date range
        const queriesWithMetrics = await this.fetchQueriesWithMetrics(
            brandId,
            customerId,
            startIso,
            endIso,
            collectors
        );

        console.log(`[OpportunityIdentifier] Found ${queriesWithMetrics.length} queries with metrics`);

        // Step 3: Fetch competitor metrics for comparison
        const competitorMetrics = await this.fetchCompetitorMetrics(
            brandId,
            customerId,
            startIso,
            endIso
        );

        // Step 4: Identify opportunities
        const opportunities: Opportunity[] = [];

        for (const query of queriesWithMetrics) {
            // Skip if no data
            if (!query.queryText) continue;

            // Classify query
            const classification = classifyQuery(
                query.queryText,
                brand.name,
                brandAliases,
                competitors
            );

            // Get competitor metrics for this query
            const queryCompetitorMetrics = competitorMetrics.get(query.queryId) || new Map();

            // Identify opportunities based on category
            const queryOpportunities = this.evaluateQuery(
                query,
                classification,
                queryCompetitorMetrics
            );

            // Fetch top sources for queries with opportunities
            if (queryOpportunities.length > 0) {
                const topSources = await this.getTopCitationSources(
                    brandId,
                    customerId,
                    query.queryId,
                    startIso,
                    endIso
                );

                // Attach sources to each opportunity
                for (const opp of queryOpportunities) {
                    opp.topSources = topSources;
                }
            }

            opportunities.push(...queryOpportunities);
        }

        // Step 5: Sort by priority score
        opportunities.sort((a, b) => b.priorityScore - a.priorityScore);

        // Step 6: Build summary
        const summary = this.buildSummary(opportunities);

        console.log(`[OpportunityIdentifier] Identified ${opportunities.length} opportunities`);

        return {
            opportunities,
            summary,
            dateRange: { start: startIso, end: endIso },
            totalAnalyzedQueries: queriesWithMetrics.length
        };
    }

    /**
     * Fetch queries with aggregated brand metrics
     */
    private async fetchQueriesWithMetrics(
        brandId: string,
        customerId: string,
        startDate: string,
        endDate: string,
        collectors?: string[]
    ): Promise<Array<{
        queryId: string;
        queryText: string;
        topic: string | null;
        visibility: number | null;
        soa: number | null;
        sentiment: number | null;
        responseCount: number;
    }>> {
        // Build collector filter if provided
        let collectorTypes: string[] | undefined;
        if (collectors && collectors.length > 0) {
            collectorTypes = this.resolveCollectorTypes(collectors);
        }



        // Query metric_facts joined with brand_metrics and brand_sentiment
        // Note: Use left join for brand_metrics/sentiment since they may not exist for all rows
        let query = supabaseAdmin
            .from('metric_facts')
            .select(`
        query_id,
        topic,
        collector_type,
        processed_at,
        generated_queries(query_text),
        brand_metrics(visibility_index, share_of_answers),
        brand_sentiment(sentiment_score)
      `)
            .eq('brand_id', brandId)
            .eq('customer_id', customerId)
            .gte('processed_at', startDate)
            .lte('processed_at', endDate);

        if (collectorTypes) {
            query = query.in('collector_type', collectorTypes);
        }

        const { data, error } = await query;



        if (error) {
            console.error('[OpportunityIdentifier] Error fetching metrics:', error);
            throw new Error(`Failed to fetch metrics: ${error.message}`);
        }

        // Aggregate by query_id
        const queryAggregates = new Map<string, {
            queryText: string;
            topic: string | null;
            visibilityValues: number[];
            soaValues: number[];
            sentimentValues: number[];
            count: number;
        }>();

        for (const row of (data || [])) {
            const queryId = row.query_id;
            if (!queryId) continue;

            const queryText = (row.generated_queries as any)?.query_text;
            if (!queryText) continue;

            if (!queryAggregates.has(queryId)) {
                queryAggregates.set(queryId, {
                    queryText,
                    topic: row.topic,
                    visibilityValues: [],
                    soaValues: [],
                    sentimentValues: [],
                    count: 0
                });
            }

            const agg = queryAggregates.get(queryId)!;
            agg.count++;

            // Collect brand metrics
            const brandMetrics = row.brand_metrics as any;
            if (brandMetrics) {
                if (brandMetrics.visibility_index != null) {
                    // Convert 0-1 to 0-100
                    agg.visibilityValues.push(brandMetrics.visibility_index * 100);
                }
                if (brandMetrics.share_of_answers != null) {
                    agg.soaValues.push(brandMetrics.share_of_answers);
                }
            }

            // Collect sentiment
            const brandSentiment = row.brand_sentiment as any;
            if (brandSentiment?.sentiment_score != null) {
                agg.sentimentValues.push(brandSentiment.sentiment_score);
            }
        }

        // Calculate averages
        const results: Array<{
            queryId: string;
            queryText: string;
            topic: string | null;
            visibility: number | null;
            soa: number | null;
            sentiment: number | null;
            responseCount: number;
        }> = [];

        for (const [queryId, agg] of queryAggregates) {
            results.push({
                queryId,
                queryText: agg.queryText,
                topic: agg.topic,
                visibility: agg.visibilityValues.length > 0
                    ? this.average(agg.visibilityValues)
                    : null,
                soa: agg.soaValues.length > 0
                    ? this.average(agg.soaValues)
                    : null,
                sentiment: agg.sentimentValues.length > 0
                    ? this.average(agg.sentimentValues)
                    : null,
                responseCount: agg.count
            });
        }

        return results;
    }

    /**
     * Fetch competitor metrics grouped by query
     */
    private async fetchCompetitorMetrics(
        brandId: string,
        customerId: string,
        startDate: string,
        endDate: string
    ): Promise<Map<string, Map<string, { visibility: number | null; soa: number | null; sentiment: number | null }>>> {
        // Query competitor_metrics joined with metric_facts
        const { data, error } = await supabaseAdmin
            .from('metric_facts')
            .select(`
        query_id,
        competitor_metrics(
          visibility_index,
          share_of_answers,
          brand_competitors(competitor_name)
        ),
        competitor_sentiment(
          sentiment_score,
          brand_competitors(competitor_name)
        )
      `)
            .eq('brand_id', brandId)
            .eq('customer_id', customerId)
            .gte('processed_at', startDate)
            .lte('processed_at', endDate);

        if (error) {
            console.error('[OpportunityIdentifier] Error fetching competitor metrics:', error);
            return new Map();
        }

        // Aggregate by query_id -> competitor_name
        const queryCompetitorMap = new Map<string, Map<string, {
            visibilityValues: number[];
            soaValues: number[];
            sentimentValues: number[];
        }>>();

        for (const row of (data || [])) {
            const queryId = row.query_id;
            if (!queryId) continue;

            if (!queryCompetitorMap.has(queryId)) {
                queryCompetitorMap.set(queryId, new Map());
            }
            const compMap = queryCompetitorMap.get(queryId)!;

            // Process competitor metrics
            const compMetrics = (row.competitor_metrics || []) as any[];
            for (const cm of compMetrics) {
                const compName = cm.brand_competitors?.competitor_name;
                if (!compName) continue;

                if (!compMap.has(compName)) {
                    compMap.set(compName, { visibilityValues: [], soaValues: [], sentimentValues: [] });
                }
                const agg = compMap.get(compName)!;

                if (cm.visibility_index != null) {
                    agg.visibilityValues.push(cm.visibility_index * 100);
                }
                if (cm.share_of_answers != null) {
                    agg.soaValues.push(cm.share_of_answers);
                }
            }

            // Process competitor sentiment
            const compSentiments = (row.competitor_sentiment || []) as any[];
            for (const cs of compSentiments) {
                const compName = cs.brand_competitors?.competitor_name;
                if (!compName) continue;

                if (!compMap.has(compName)) {
                    compMap.set(compName, { visibilityValues: [], soaValues: [], sentimentValues: [] });
                }
                const agg = compMap.get(compName)!;

                if (cs.sentiment_score != null) {
                    agg.sentimentValues.push(cs.sentiment_score);
                }
            }
        }

        // Calculate averages
        const result = new Map<string, Map<string, { visibility: number | null; soa: number | null; sentiment: number | null }>>();

        for (const [queryId, compMap] of queryCompetitorMap) {
            const avgMap = new Map<string, { visibility: number | null; soa: number | null; sentiment: number | null }>();

            for (const [compName, agg] of compMap) {
                avgMap.set(compName, {
                    visibility: agg.visibilityValues.length > 0 ? this.average(agg.visibilityValues) : null,
                    soa: agg.soaValues.length > 0 ? this.average(agg.soaValues) : null,
                    sentiment: agg.sentimentValues.length > 0 ? this.average(agg.sentimentValues) : null
                });
            }

            result.set(queryId, avgMap);
        }

        return result;
    }

    /**
     * Evaluate a query and return opportunities
     */
    private evaluateQuery(
        query: {
            queryId: string;
            queryText: string;
            topic: string | null;
            visibility: number | null;
            soa: number | null;
            sentiment: number | null;
            responseCount: number;
        },
        classification: { category: QueryCategory; competitorsInQuery: string[] },
        competitorMetrics: Map<string, { visibility: number | null; soa: number | null; sentiment: number | null }>
    ): Opportunity[] {
        const opportunities: Opportunity[] = [];
        const { category, competitorsInQuery } = classification;

        // Debug logging
        console.log(`[OpportunityEval] Query: "${query.queryText.substring(0, 60)}..." Category: ${category}`);
        console.log(`[OpportunityEval] Brand metrics - Vis: ${query.visibility?.toFixed(1)}, SoA: ${query.soa?.toFixed(1)}, Sent: ${query.sentiment?.toFixed(1)}`);

        const metrics: MetricName[] = ['visibility', 'soa', 'sentiment'];

        for (const metric of metrics) {
            const brandValue = query[metric];
            if (brandValue === null) continue; // Skip if no brand data

            if (category === 1) {
                // Category 1: Compare against specific competitors mentioned in query
                for (const compName of competitorsInQuery) {
                    const compMetrics = competitorMetrics.get(compName);
                    const compValue = compMetrics?.[metric];

                    // Check relative threshold (trailing competitor)
                    if (compValue !== null && (compValue - brandValue) > THRESHOLDS.category1.relative[metric]) {
                        const gap = compValue - brandValue;
                        opportunities.push({
                            id: generateOpportunityId(query.queryId, metric, compName),
                            queryId: query.queryId,
                            queryText: query.queryText,
                            queryCategory: 1,
                            metricName: metric,
                            brandValue: Math.round(brandValue * 10) / 10,
                            targetValue: Math.round(compValue * 10) / 10,
                            gap: Math.round(gap * 10) / 10,
                            severity: calculateSeverity(gap),
                            priorityScore: calculatePriorityScore(gap, metric),
                            competitor: compName,
                            topSources: [], // Will be filled later
                            responseCount: query.responseCount,
                            topic: query.topic
                        });
                    }
                }

                // Also check absolute thresholds
                if (brandValue < THRESHOLDS.category1.absolute[metric]) {
                    const target = THRESHOLDS.category1.absolute[metric];
                    const gap = target - brandValue;

                    // Avoid duplicates - only add if not already trailing any competitor
                    const alreadyTrailing = opportunities.some(
                        o => o.queryId === query.queryId && o.metricName === metric
                    );

                    if (!alreadyTrailing) {
                        opportunities.push({
                            id: generateOpportunityId(query.queryId, metric, null),
                            queryId: query.queryId,
                            queryText: query.queryText,
                            queryCategory: 1,
                            metricName: metric,
                            brandValue: Math.round(brandValue * 10) / 10,
                            targetValue: target,
                            gap: Math.round(gap * 10) / 10,
                            severity: calculateSeverity(gap),
                            priorityScore: calculatePriorityScore(gap, metric),
                            competitor: null, // Absolute threshold, no specific competitor
                            topSources: [],
                            responseCount: query.responseCount,
                            topic: query.topic
                        });
                    }
                }
            } else if (category === 2) {
                // Category 2: Brand only - check absolute thresholds
                const threshold = THRESHOLDS.category2.absolute[metric];
                console.log(`[OpportunityEval] Cat 2 - ${metric}: brandValue=${brandValue?.toFixed(1)}, threshold=${threshold}, triggers=${brandValue < threshold}`);

                if (brandValue < threshold) {
                    const target = threshold;
                    const gap = target - brandValue;

                    console.log(`[OpportunityEval] ✅ OPPORTUNITY FOUND: ${metric} gap=${gap.toFixed(1)}`);
                    opportunities.push({
                        id: generateOpportunityId(query.queryId, metric, null),
                        queryId: query.queryId,
                        queryText: query.queryText,
                        queryCategory: 2,
                        metricName: metric,
                        brandValue: Math.round(brandValue * 10) / 10,
                        targetValue: target,
                        gap: Math.round(gap * 10) / 10,
                        severity: calculateSeverity(gap),
                        priorityScore: calculatePriorityScore(gap, metric),
                        competitor: null,
                        topSources: [],
                        responseCount: query.responseCount,
                        topic: query.topic
                    });
                }
            } else if (category === 3) {
                // Category 3: Unbiased - compare against ANY competitor
                for (const [compName, compMetrics] of competitorMetrics) {
                    const compValue = compMetrics[metric];

                    if (compValue !== null && (compValue - brandValue) > THRESHOLDS.category3.relative[metric]) {
                        const gap = compValue - brandValue;

                        opportunities.push({
                            id: generateOpportunityId(query.queryId, metric, compName),
                            queryId: query.queryId,
                            queryText: query.queryText,
                            queryCategory: 3,
                            metricName: metric,
                            brandValue: Math.round(brandValue * 10) / 10,
                            targetValue: Math.round(compValue * 10) / 10,
                            gap: Math.round(gap * 10) / 10,
                            severity: calculateSeverity(gap),
                            priorityScore: calculatePriorityScore(gap, metric),
                            competitor: compName,
                            topSources: [],
                            responseCount: query.responseCount,
                            topic: query.topic
                        });
                    }
                }
            }
        }

        return opportunities;
    }

    /**
     * Get top 2-3 citation sources for a query based on impact score
     */
    private async getTopCitationSources(
        brandId: string,
        customerId: string,
        queryId: string,
        startDate: string,
        endDate: string
    ): Promise<Array<{ domain: string; url?: string; impactScore: number }>> {
        // Fetch citations for this query
        const { data, error } = await supabaseAdmin
            .from('citations')
            .select('domain, url, usage_count')
            .eq('brand_id', brandId)
            .eq('customer_id', customerId)
            .eq('query_id', queryId)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('usage_count', { ascending: false })
            .limit(10);

        if (error || !data) {
            return [];
        }

        // Aggregate by domain
        const domainAggregates = new Map<string, { url: string; totalCount: number }>();

        for (const citation of data) {
            const domain = citation.domain || 'unknown';
            if (!domainAggregates.has(domain)) {
                domainAggregates.set(domain, { url: citation.url || '', totalCount: 0 });
            }
            domainAggregates.get(domain)!.totalCount += citation.usage_count || 1;
        }

        // Sort by total count (as proxy for impact score) and take top 3
        const sorted = Array.from(domainAggregates.entries())
            .sort((a, b) => b[1].totalCount - a[1].totalCount)
            .slice(0, 3);

        return sorted.map(([domain, data]) => ({
            domain,
            url: data.url,
            impactScore: data.totalCount
        }));
    }

    /**
     * Build summary statistics
     */
    private buildSummary(opportunities: Opportunity[]): OpportunitySummary {
        const summary: OpportunitySummary = {
            total: opportunities.length,
            bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
            byCategory: { 1: 0, 2: 0, 3: 0 },
            byMetric: { visibility: 0, soa: 0, sentiment: 0 }
        };

        for (const opp of opportunities) {
            // Count by severity
            switch (opp.severity) {
                case 'Critical': summary.bySeverity.critical++; break;
                case 'High': summary.bySeverity.high++; break;
                case 'Medium': summary.bySeverity.medium++; break;
                case 'Low': summary.bySeverity.low++; break;
            }

            // Count by category
            summary.byCategory[opp.queryCategory]++;

            // Count by metric
            summary.byMetric[opp.metricName]++;
        }

        return summary;
    }

    /**
     * Extract brand aliases from metadata
     */
    private extractAliases(metadata: any): string[] {
        if (!metadata) return [];

        let parsed = metadata;
        if (typeof metadata === 'string') {
            try {
                parsed = JSON.parse(metadata);
            } catch {
                return [];
            }
        }

        const aliases = parsed?.aliases || parsed?.brand_aliases || [];
        return Array.isArray(aliases) ? aliases : [];
    }

    /**
     * Calculate average of an array
     */
    private average(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    /**
     * Resolve frontend collector slugs to DB collector types
     */
    private resolveCollectorTypes(slugs: string[]): string[] {
        const mapping: Record<string, string[]> = {
            'chatgpt': ['ChatGPT'],
            'perplexity': ['Perplexity'],
            'claude': ['Claude'],
            'google_aio': ['Google AIO', 'Google SGE'],
            'copilot': ['Bing Copilot', 'Copilot'],
            'meta': ['Meta AI', 'Llama'],
            'gemini': ['Gemini'],
            'grok': ['Grok']
        };

        const resolved = new Set<string>();
        for (const slug of slugs) {
            const key = slug.toLowerCase().trim();
            if (mapping[key]) {
                mapping[key].forEach(v => resolved.add(v));
            } else {
                resolved.add(slug);
            }
        }

        return Array.from(resolved);
    }
}

// Export singleton instance
export const opportunityIdentifierService = new OpportunityIdentifierService();
