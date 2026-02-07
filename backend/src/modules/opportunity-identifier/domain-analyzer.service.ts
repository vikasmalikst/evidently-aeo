/**
 * Domain Analyzer Service
 * 
 * Analyzes web domains in the context of specific queries using LLM to provide
 * query-specific content type recommendations for opportunity identification.
 * 
 * Features:
 * - Query-contextual domain analysis
 * - LLM-based content type recommendations
 * - Tailored suggestions based on query intent and source capabilities
 */

import { recommendationLLMService } from '../../services/recommendations/recommendation-llm.service';

// ============================================================================
// Types
// ============================================================================

export type ContributionModel = 'direct_publish' | 'earned_media' | 'paid_placement' | 'community';

export interface DomainClassification {
    domain: string;
    bestContentTypes: string[]; // Contextual content types (e.g., "Article", "White Paper")
    contributionModel: ContributionModel;
    recommendedActionVerb: string; // e.g., "Pitch", "Post"
    whyThisFit: string; // Reasoning
    analysisDate: Date;
}

export interface QuerySourceContext {
    queryId: string;
    queryText: string;
    domains: string[];
}

interface LLMQueryAnalysisResponse {
    queryId: string;
    domain: string;
    bestContentTypes: string[];
    contributionModel: ContributionModel;
    recommendedActionVerb: string;
    whyThisFit: string;
}

// ============================================================================
// Service
// ============================================================================

export class DomainAnalyzerService {
    /**
     * Analyze domains within the context of specific queries
     * Returns query-specific recommendations for each domain
     */
    async analyzeQueries(
        queries: QuerySourceContext[],
        brandDomain: string,
        competitorDomains: string[],
        brandName: string
    ): Promise<Map<string, Map<string, DomainClassification>>> {
        console.log(`[DomainAnalyzer] Analyzing ${queries.length} queries with source context`);

        const resultMap = new Map<string, Map<string, DomainClassification>>();

        try {
            const analyses = await this.analyzeQueriesWithLLM(queries, brandDomain, competitorDomains, brandName);

            for (const analysis of analyses) {
                if (!resultMap.has(analysis.queryId)) {
                    resultMap.set(analysis.queryId, new Map());
                }

                const classification: DomainClassification = {
                    domain: analysis.domain,
                    bestContentTypes: analysis.bestContentTypes,
                    contributionModel: analysis.contributionModel,
                    recommendedActionVerb: analysis.recommendedActionVerb,
                    whyThisFit: analysis.whyThisFit,
                    analysisDate: new Date(),
                };

                resultMap.get(analysis.queryId)!.set(analysis.domain, classification);
            }

            return resultMap;
        } catch (error) {
            console.error('[DomainAnalyzer] Query analysis failed:', error);
            // Return empty map on failure
            return resultMap;
        }
    }

    /**
     * Analyze multiple queries via LLM
     */
    private async analyzeQueriesWithLLM(
        queries: QuerySourceContext[],
        brandDomain: string,
        competitorDomains: string[],
        brandName: string
    ): Promise<LLMQueryAnalysisResponse[]> {
        const prompt = this.constructQueryAnalysisPrompt(queries, brandDomain, competitorDomains, brandName);

        try {
            const response = await recommendationLLMService.executePrompt<LLMQueryAnalysisResponse>(
                brandName,
                prompt,
                `You are an expert Content Strategist for ${brandName}. Return ONLY valid JSON array.`,
                32000
            );

            // Log the LLM response for debugging
            console.log('[DomainAnalyzer] ========================================');
            console.log('[DomainAnalyzer] LLM RESPONSE (Domain Analysis):');
            console.log('[DomainAnalyzer] ========================================');
            console.log(JSON.stringify(response, null, 2));
            console.log('[DomainAnalyzer] ========================================');

            return response || [];
        } catch (error) {
            console.error('[DomainAnalyzer] LLM call failed:', error);
            throw error;
        }
    }

    private constructQueryAnalysisPrompt(
        queries: QuerySourceContext[],
        brandDomain: string,
        competitorDomains: string[],
        brandName: string
    ): string {
        const queryBlocks = queries.map((q, idx) => {
            return `### Query ${idx + 1} (ID: ${q.queryId})
Query: "${q.queryText}"
Sources to Analyze:
${q.domains.map(d => `- ${d}`).join('\n')}`;
        }).join('\n\n');

        return `You are analyzing content opportunities for ${brandName} (${brandDomain}).
        
For each Query below, analyze the specific "Sources to Analyze".
Your goal is to determine REALISTICALLY what content actions ${brandName} can take on each source.

Context:
- Brand Domain: ${brandDomain}
- Competitor Domains: ${competitorDomains.join(', ')}

CRITICAL RULES FOR REALISTIC ANALYSIS:

1. **Brand Domain (${brandDomain})**: 
   - contributionModel: "direct_publish"
   - recommendedActionVerb: "Publish"
   - bestContentTypes: ANY content type that fits the query
   
2. **Competitor Domains** (${competitorDomains.join(', ')}):
   - contributionModel: "direct_publish"
   - recommendedActionVerb: "Monitor/Counter"
   - bestContentTypes: [] (empty array)
   - whyThisFit: "Competitor content should be monitored"

3. **Community Platforms** (reddit.com, quora.com, stackoverflow.com, forums, discussion boards):
   - contributionModel: "community"
   - recommendedActionVerb: "Post"
   - bestContentTypes: ["Discussion thread", "Expert Answer", "Community Response", "AMA"]
   
4. **Media/Editorial Sites** (blogs, magazines, news sites like housebeautiful.com, dezeen.com, etc.):
   - contributionModel: "earned_media"
   - recommendedActionVerb: "Pitch"
   - bestContentTypes: ["Article", "Feature", "Guest Post", "Expert Quote"]
   - Note: You must PITCH these - you cannot publish directly!

5. **Video Platforms** (YouTube, TikTok - if brand has channel):
   - contributionModel: "direct_publish"
   - recommendedActionVerb: "Publish"
   - bestContentTypes: ["Short-form Video", "Tutorial", "Product Demo"]

6. **Other Third-Party Commercial Sites** (victorianplumbing.co.uk, ratedpeople.com, etc.):
   - These are NOT opportunities for ${brandName} to publish content
   - contributionModel: "earned_media"
   - recommendedActionVerb: "Monitor/Counter"
   - bestContentTypes: [] (empty array)
   - whyThisFit: "Third-party commercial site - can only monitor or seek partnerships"

For EACH source in EACH query, return a JSON object:
{
  "queryId": "The ID of the query",
  "domain": "The source domain",
  "bestContentTypes": ["Content types ONLY if you can realistically create/publish there"],
  "contributionModel": "direct_publish" | "community" | "earned_media",
  "recommendedActionVerb": "Pitch" | "Post" | "Publish" | "Monitor/Counter",
  "whyThisFit": "Brief reasoning explaining WHY this is realistic for this platform"
}

QUERIES TO ANALYZE:

${queryBlocks}

IMPORTANT:
- Return a single flat JSON array containing analysis for ALL sources across ALL queries.
- If a source appears in multiple queries, analyze it separately for EACH query context.
- BE REALISTIC: Don't suggest "Publish" actions on sites where ${brandName} has no control!
- Use "Monitor/Counter" for sites where you can't publish (competitors, third-party commercial sites).
- Use "Pitch" for editorial/media sites where you need to earn coverage.
- Use "Post" for community platforms where anyone can participate.
`;

    }
}

export const domainAnalyzerService = new DomainAnalyzerService();
