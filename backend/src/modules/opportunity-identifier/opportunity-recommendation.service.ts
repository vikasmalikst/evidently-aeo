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
import { domainAnalyzerService } from '../../services/domain-analyzer/domain-analyzer.service';

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

        // 4. Take TOP 10 opportunities (sorted by priority score)
        const top10Opportunities = allOpportunities.slice(0, 10);
        console.log(`📊 Selected top ${top10Opportunities.length} opportunities from ${allOpportunities.length} total`);

        // 5. Extract unique domains from top 10 opportunities
        const uniqueDomains = this.extractUniqueDomains(top10Opportunities);
        console.log(`🌐 Extracted ${uniqueDomains.length} unique domains from top opportunities`);

        // 6. Analyze domains with LLM (with caching)
        console.log('🔬 Analyzing domains...');
        const domainClassifications = await domainAnalyzerService.analyzeDomains(
            uniqueDomains,
            brandDomain || '',
            competitorDomains,
            brandId
        );
        console.log(`✅ Successfully classified ${domainClassifications.size} domains`);

        // 7. Construct Prompt with Rich Domain Context
        console.log(`📝 Processing ${top10Opportunities.length} opportunities with enriched domain context...`);

        // 8. Execute LLM Call
        const systemMessage = `Act like a world's best SEO + AEO (Answer Engine Optimization) Expert working for ${brand.name}. Respond ONLY with a valid JSON array.`;

        console.log(`🚀 Calling LLM for ${top10Opportunities.length} items...`);
        const prompt = opportunityPromptService.constructBatchPrompt(
            brand.name,
            top10Opportunities,
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
        const recommendations = await this.saveRecommendationsToDb(brandId, customerId, llmResults, top10Opportunities);

        return {
            success: true,
            recommendationsCount: recommendations.length,
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
                query_id: opp?.queryId // Link back to the original query
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
}

export const opportunityRecommendationService = new OpportunityRecommendationService();
