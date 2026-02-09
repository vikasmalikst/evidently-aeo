/**
 * Opportunity Recommendation Service
 * 
 * Orchestrates the conversion of identified opportunities into actionable recommendations.
 */

import { supabaseAdmin } from '../../config/database';
import { opportunityIdentifierService } from './opportunity-identifier.service';
import { opportunityPromptService, OpportunityRecommendationLLMResponse } from './opportunity-prompt.service';
import { recommendationLLMService } from '../../services/recommendations/recommendation-llm.service';
import { RecommendationV3 } from '../../services/recommendations/recommendation.types';
import { buildCompetitorExclusionList } from '../../services/recommendations/competitor-filter.service';
import { domainAnalyzerService, QuerySourceContext } from './domain-analyzer.service';

export class OpportunityRecommendationService {
    /**
     * Convert opportunities to recommendations for a brand
     */
    async convertToRecommendations(brandId: string, customerId: string): Promise<any> {
        console.log(`🎯 [OpportunityRecommendationService] Starting conversion for brand: ${brandId}`);

        // 1. Fetch Brand Info
        const { data: brand, error: brandError } = await supabaseAdmin
            .from('brands')
            .select('name, homepage_url, industry')
            .eq('id', brandId)
            .single();

        if (brandError || !brand) {
            throw new Error(`Brand not found: ${brandError?.message}`);
        }

        // 2. Fetch Competitors for Exclusion List
        const { data: competitors } = await supabaseAdmin
            .from('brand_competitors')
            .select('id, competitor_name, competitor_url, metadata')
            .eq('brand_id', brandId);

        const brandDomain = brand.homepage_url ? brand.homepage_url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '') : undefined;
        const exclusionList = buildCompetitorExclusionList(competitors || [], brandDomain, brand.name);
        const competitorDomains = Array.from(exclusionList.domains);


        // 3. Identify Opportunities
        console.log('🔍 Identifying opportunities...');
        const response = await opportunityIdentifierService.identifyOpportunities({ brandId, customerId });
        const allOpportunities = response.opportunities;

        if (!allOpportunities || allOpportunities.length === 0) {
            console.log('📭 No opportunities found.');
            return { success: true, message: 'No opportunities identified.', recommendations: [] };
        }

        // 4. Select opportunities covering top N unique queries
        // (We include ALL opportunities for each selected query so the prompt can aggregate all metrics/competitors)
        const uniqueQueryCount = new Set(allOpportunities.map(o => o.queryId)).size;
        const targetQueries = Math.min(10, uniqueQueryCount); // Max 10, or less if fewer queries exist
        const topOpportunities = this.selectOpportunitiesForTopQueries(allOpportunities, targetQueries);
        console.log(`📊 Selected ${topOpportunities.length} opportunities covering ${targetQueries} unique queries from ${allOpportunities.length} total (${uniqueQueryCount} unique queries available)`);

        // 5. Build Query Contexts from top opportunities (deduplicated by query)
        console.log('📝 Building unique query contexts for analysis...');
        const queryContextMap = new Map<string, QuerySourceContext>();

        topOpportunities.forEach(opp => {
            if (!queryContextMap.has(opp.queryId)) {
                queryContextMap.set(opp.queryId, {
                    queryId: opp.queryId,
                    queryText: opp.queryText,
                    domains: opp.topSources?.map(s => s.domain).filter(d => d) || []
                });
            }
        });

        const queryContexts = Array.from(queryContextMap.values());
        console.log(`📋 Created ${queryContexts.length} unique query contexts from ${topOpportunities.length} opportunities`);

        // 6. Analyze queries with LLM (contextual analysis)
        console.log(`🔬 Analyzing ${queryContexts.length} unique queries...`);
        const domainClassifications = await domainAnalyzerService.analyzeQueries(
            queryContexts,
            brandDomain || '',
            competitorDomains,
            brand.name
        );
        console.log(`✅ Successfully analyzed sources across queries`);

        // 7. Construct Prompt with Rich Domain Context
        console.log(`📝 Processing ${topOpportunities.length} opportunities with enriched domain context...`);

        // 8. Execute LLM Call
        const systemMessage = `Act like a world's best SEO + AEO (Answer Engine Optimization) Expert working for ${brand.name}. Respond ONLY with a valid JSON array.`;

        console.log(`🚀 Calling LLM for ${topOpportunities.length} items...`);
        const prompt = opportunityPromptService.constructBatchPrompt(
            brand.name,
            topOpportunities,
            competitorDomains,
            brandDomain,
            domainClassifications
        );


        let llmResults: OpportunityRecommendationLLMResponse[] = [];
        try {
            const result = await recommendationLLMService.executePrompt<OpportunityRecommendationLLMResponse>(
                brandId,
                prompt,
                systemMessage,
                32000 // Increased token limit for large batch
            );
            llmResults = result || [];

            // Log the LLM response for debugging
            console.log('[OpportunityRecommendation] ========================================');
            console.log('[OpportunityRecommendation] LLM RESPONSE (Recommendations):');
            console.log('[OpportunityRecommendation] ========================================');
            console.log(JSON.stringify(llmResults, null, 2));
            console.log('[OpportunityRecommendation] ========================================');

        } catch (err) {
            console.error(`❌ LLM transformation failed:`, err);
            return { success: false, message: 'LLM generation failed.' };
        }

        if (llmResults.length === 0) {
            console.error('❌ LLM returned no recommendations.');
            return { success: false, message: 'LLM generation failed (empty response).' };
        }

        // 9. Map to Database Schema and Save
        console.log(`💾 Saving ${llmResults.length} recommendations to database...`);
        const recommendations = await this.saveRecommendationsToDb(brandId, customerId, llmResults, topOpportunities);

        console.log(`✅ Successfully converted and saved ${recommendations.length} recommendations`);

        return {
            success: true,
            message: `Generated ${recommendations.length} recommendations from ${topOpportunities.length} opportunities.`,
            recommendations
        };
    }

    /**
     * Extract unique domains from opportunities' topSources
     */
    private extractUniqueDomains(opportunities: any[]): string[] {
        const domainsSet = new Set<string>();

        for (const opp of opportunities) {
            if (opp.topSources && Array.isArray(opp.topSources)) {
                for (const source of opp.topSources) {
                    if (source.domain) {
                        domainsSet.add(source.domain);
                    }
                }
            }
        }

        return Array.from(domainsSet);
    }

    /**
     * Select all opportunities for the top N unique queries
     * (Keeps all opportunities per query so metrics/competitors can be aggregated in prompt)
     */
    private selectOpportunitiesForTopQueries(opportunities: any[], targetUniqueQueries: number): any[] {
        const seenQueries = new Set<string>();
        const selectedQueryIds = new Set<string>();

        // First pass: identify which queries to include
        for (const opp of opportunities) {
            if (seenQueries.size >= targetUniqueQueries) {
                break;
            }
            if (!seenQueries.has(opp.queryId)) {
                seenQueries.add(opp.queryId);
                selectedQueryIds.add(opp.queryId);
            }
        }

        // Second pass: include ALL opportunities for selected queries
        return opportunities.filter(opp => selectedQueryIds.has(opp.queryId));
    }

    /**
     * Map LLM response to RecommendationV3 schema and save to database
     */
    private async saveRecommendationsToDb(
        brandId: string,
        customerId: string,
        llmrecs: OpportunityRecommendationLLMResponse[],
        opportunities: any[]
    ): Promise<RecommendationV3[]> {
        // Create a generation record
        const { data: generation, error: genError } = await supabaseAdmin
            .from('recommendation_generations')
            .insert({
                brand_id: brandId,
                customer_id: customerId,
                status: 'completed',
                metadata: { source: 'opportunity_to_rec_pipeline', count: llmrecs.length }
            })
            .select('id')
            .single();

        if (genError || !generation) {
            throw new Error(`Failed to create generation record: ${genError?.message}`);
        }

        const generationId = generation.id;

        // Map LLM results to RecommendationV3
        const toInsert = llmrecs.map((l, index) => {
            // Find matching opportunity for metadata if needed
            const opp = opportunities.find(o => o.queryId === l.queryId);

            // Derive target competitors from all opportunities associated with this query
            const relatedOpps = opportunities.filter(o => o.queryId === l.queryId);
            const targetCompetitors = Array.from(new Set(
                relatedOpps
                    .map(o => o.competitor)
                    .filter((c): c is string => c !== null)
            ));

            // Map focusArea and kpi based on opportunity or LLM response
            let focusArea: 'visibility' | 'soa' | 'sentiment' = 'visibility';
            if (opp?.metricName?.toLowerCase().includes('soa') || opp?.metricName?.toLowerCase().includes('answer')) focusArea = 'soa';
            if (opp?.metricName?.toLowerCase().includes('sentiment')) focusArea = 'sentiment';

            return {
                generation_id: generationId,
                brand_id: brandId,
                customer_id: customerId,
                action: `[${l.ContentType}] ${l.Recommendation}`,
                citation_source: l.Channel,
                focus_area: focusArea,
                priority: opp?.severity === 'Critical' ? 'High' : (opp?.severity === 'Medium' ? 'Medium' : 'Low'),
                effort: l.Effort,
                reason: l.ThoughtProcess,
                explanation: `[${l.ContentType}] ${l.ThoughtProcess}`,
                content_focus: l.ContentTitle,
                expected_boost: l.ExpectedBoost,
                timeline: l.Timeline,
                confidence: l.Confidence,
                focus_sources: l.Amplification,
                kpi: opp?.metricName || 'Visibility Index',
                display_order: index,
                is_approved: false,
                competitors_target: targetCompetitors,
                query_id: opp?.queryId, // Link back to the original query
                asset_type: this.normalizeContentType(l.ContentType)
            };
        });

        const { data: inserted, error: insertError } = await supabaseAdmin
            .from('recommendations')
            .insert(toInsert)
            .select('*');

        if (insertError) {
            throw new Error(`Failed to insert recommendations: ${insertError.message}`);
        }

        return inserted as unknown as RecommendationV3[];
    }

    private normalizeContentType(rawType: string): string {
        const t = (rawType || '').toLowerCase();
        if (t.includes('video')) return 'video';
        if (t.includes('comparison')) return 'comparison';
        if (t.includes('expert community') || t.includes('reddit') || t.includes('forum')) return 'expert_community_response';
        if (t.includes('white paper') || t.includes('guide') || t.includes('tutorial')) return 'guide';
        return 'article';
    }
}

export const opportunityRecommendationService = new OpportunityRecommendationService();
