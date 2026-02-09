/**
 * Opportunity Prompt Service
 * 
 * Constructs complex prompts for the LLM to convert performance opportunities
 * into actionable AEO recommendations.
 */

import { Opportunity } from './opportunity-identifier.service';
import { DomainClassification } from './domain-analyzer.service';

export interface OpportunityRecommendationLLMResponse {
    Recommendation: string;
    Channel: string;
    ContentType: 'Short-form Video Script' | 'Social Media Thread' | 'Technical Comparison Table' | 'Interactive Tool/Calculator' | 'Expert Community Response' | 'Data-Driven White Paper' | 'Article' | 'Podcast' | 'Expert Articles';
    ThoughtProcess: string;
    ContentTitle: string;
    Timeline: string;
    Effort: 'Low' | 'Medium' | 'High';
    ExpectedBoost: string;
    Confidence: number;
    Amplification: string;
    queryId: string; // Mapping back to the source query
}

export class OpportunityPromptService {
    /**
     * DEPRECATED: Old hardcoded classification (kept as fallback reference only)
     * Classify source domain to determine valid actions
    */
    private classifySource(domain: string, brandDomain?: string, competitorDomains: string[] = []): string {
        const d = domain.toLowerCase();

        if (brandDomain && (d === brandDomain.toLowerCase() || d.endsWith('.' + brandDomain.toLowerCase()))) {
            return 'Brand Owned';
        }

        if (competitorDomains.some(c => d.includes(c.toLowerCase()))) {
            return 'Competitor';
        }

        const socialPlatforms = ['linkedin', 'twitter', 'x.com', 'facebook', 'instagram', 'reddit', 'quora', 'youtube', 'tiktok', 'medium', 'pinterest', 'g2', 'capterra', 'trustradius'];
        if (socialPlatforms.some(p => d.includes(p))) {
            return 'Social/Review Platform';
        }

        const mediaKeywords = ['news', 'times', 'journal', 'daily', 'post', 'herald', 'chronicle', 'gazette', 'tribune', 'times', 'magazine', 'fierce', 'pharma', 'biotech', 'clinical', 'medscape', 'statnews', 'techcrunch', 'forbes', 'bloomberg', 'reuters'];
        if (mediaKeywords.some(k => d.includes(k))) {
            return 'Industry Media';
        }

        return 'Third-Party Site';
    }

    /**
     * Format source context using LLM-analyzed domain classifications
     */
    private formatSourceContext(
        domain: string,
        queryId: string,
        domainClassifications?: Map<string, Map<string, DomainClassification>>
    ): string {
        if (!domainClassifications || !domainClassifications.has(queryId)) {
            return domain;
        }

        const queryAnalysis = domainClassifications.get(queryId)!;
        if (!queryAnalysis.has(domain)) {
            return domain;
        }

        const classification = queryAnalysis.get(domain)!;

        let context = `${domain}`;

        // Add best content types if available
        if (classification.bestContentTypes && classification.bestContentTypes.length > 0) {
            context += ` | Best Fits: [${classification.bestContentTypes.join(', ')}]`;
        }

        // Add interaction model/verb
        if (classification.recommendedActionVerb) {
            context += ` | Interaction: ${classification.recommendedActionVerb} (${classification.contributionModel})`;
        }

        // Add reasoning context
        if (classification.whyThisFit) {
            context += ` | Context: ${classification.whyThisFit}`;
        }

        return context;
    }

    /**
     * Construct a batched prompt for converting opportunities into recommendations
     */
    constructBatchPrompt(
        brandName: string,
        opportunities: Opportunity[],
        competitorDomains: string[],
        brandDomain?: string,
        domainClassifications?: Map<string, Map<string, DomainClassification>>
    ): string {
        // Group unique queries
        const queryMap = new Map<string, any>();
        opportunities.forEach(opp => {
            if (!queryMap.has(opp.queryId)) {
                queryMap.set(opp.queryId, {
                    id: opp.queryId,
                    queryText: opp.queryText,
                    topic: opp.topic,
                    metrics: [],
                    competitors: [],
                    sources: opp.topSources.map(s => {
                        const enrichedContext = this.formatSourceContext(s.domain, opp.queryId, domainClassifications);
                        return enrichedContext;
                    })
                });
            }
            const q = queryMap.get(opp.queryId);
            if (!q.metrics.includes(opp.metricName)) {
                q.metrics.push(opp.metricName);
            }
            if (opp.competitor && !q.competitors.includes(opp.competitor)) {
                q.competitors.push(opp.competitor);
            }
        });

        const queryList = Array.from(queryMap.values()).map((q, idx) => {
            return `--- Query ${idx + 1} ---
ID: ${q.id}
Text: "${q.queryText}"
Topic: ${q.topic || 'Not specified'}
KPIs to Improve: ${q.metrics.join(', ')}
Competitors to Target: ${q.competitors.length > 0 ? q.competitors.join(', ') : 'General (Brand Only)'}
Available Sources:
${q.sources.map((s: string) => `   - ${s}`).join('\n') || '   - No specific sources identified'}`;
        }).join('\n\n');

        const competitorList = competitorDomains.join(', ');

        return `Act like a world's best SEO + AEO (Answer Engine Optimization) Expert working for ${brandName}. Your job is to improve your Brand's presence across in LLMs (Answer Engine Optimization), increase engagement, drive traffic, and improve the overall visibility of ${brandName} in the AI innovation space.

You will review the following opportunities identified for your brand:

${queryList}

Your ultimate goal is to come up with one recommendation for each query to improve the specified KPIs.

RULES:
1. Generate exactly ONE high-impact recommendation per unique query provided.
2. The "Channel" (citationSource domain) MUST NOT be any of the following competitor domains: ${competitorList}.
3. Respect the purpose and suitability of content type for each channel.
4. Content MUST be optimized for LLM scraping and AEO impact.
5. VARY YOUR CONTENT TYPES: Do not use the same content type for every recommendation. Mix Short-forms videos, Comparison tables, and Articles based on the specific query nuance.



6. **SOURCE ANALYSIS & CONTENT TYPE SELECTION:**
   For EACH query, review the "Available Sources" list. Each source now includes specific analysis:
   - **Best Fits**: The content types that actually work on that platform.
   - **Interaction**: How you get content there (Publish vs Pitch vs Post).
   
   **Your Process:**
   1. SELECT a source from the list (or your own site) that aligns with the query intent.
   2. RESPECT the "Interaction" model provided. If it says "Pitch", you cannot "Publish".
   3. CHOOSE a ContentType from the "Best Fits" list provided for that source.
   
   **Key Constraints:**
   - **Competitor domains** (${competitorList}): NEVER use these. 
   - **Your Site** (${brandDomain}): Always a valid option for "Direct Publishing".
   
   **Priority:**
   1. High-authority "Best Fit" sources (e.g., Pitching a data study to TechCruch)
   2. Your Own Site (Direct control)
   3. Relevant Niche Communities (Reddit/Quora)

7. **GAP-FOCUSED RECOMMENDATIONS:**
   Each query represents a PERFORMANCE GAP where ${brandName} is underperforming on specific KPIs (Visibility, Share of Answers, Sentiment).
   
   Your recommendations MUST:
   - EXPLICITLY address how the content will close the identified gap
   - Reference the specific KPIs that need improvement
   - Explain what competitive advantage this content will provide
   - Describe the specific value/information the content will deliver


CONTENT TYPE OPTIONS:
- Short-form Video Script (Best for rapid answers, visual explanations, and increasing dwell time)
- Social Media Thread (X/Threads)
- Technical Comparison Table (Specialized for AEO comparison queries)
- Expert Community Response (Reddit/Quora/StackOverflow)
- Data-Driven White Paper (In-depth research)
- Article (Standard SEO/AEO long-form content)
- Podcast (Conversational audio)


For each recommendation, return a JSON object with these EXACT fields:
- Recommendation: (A detailed, comprehensive action statement describing: (1) the specific content piece to create, (2) the target platform where it will be published, and (3) the key components/elements it will include. Be thorough and specific about the content itself, but do NOT include reasoning about why it matters or how it closes gaps here)
- Channel: (The target domain where content will be published)
- ContentType: (One of the options above)
- ThoughtProcess: (Comprehensive reasoning that explains: (1) why this action fits the source type and interaction model, (2) how this content will close the identified performance gap in the KPIs (Visibility, Share of Answers, Sentiment), (3) what competitive advantage it provides, and (4) why it matters for this specific query)
- ContentTitle: (Optimized headline for LLM scraping)
- Timeline: (Estimated time, e.g., "2-3 Weeks")
- Effort: (Low, Medium, or High)
- ExpectedBoost: (Specific estimate for Visibility, SOA, and Sentiment)
- Confidence: (Integer 0-100 indicating likelihood of success)
- Amplification: (Strategic advice for cross-channel reuse)
- queryId: (The ID provided above in the ID field for the query)

Return the output as a valid JSON array of objects.`;
    }
}

export const opportunityPromptService = new OpportunityPromptService();
