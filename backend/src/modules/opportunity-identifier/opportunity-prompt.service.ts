/**
 * Opportunity Prompt Service
 * 
 * Constructs complex prompts for the LLM to convert performance opportunities
 * into actionable AEO recommendations.
 */

import { Opportunity } from './opportunity-identifier.service';
import { DomainClassification } from '../../services/domain-analyzer/domain-analyzer.service';

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
     * Construct a batched prompt for converting opportunities into recommendations
     */
    /**
     * Format source context using LLM-analyzed domain classifications
     */
    private formatSourceContext(domain: string, domainClassifications?: Map<string, DomainClassification>): string {
        if (!domainClassifications || !domainClassifications.has(domain)) {
            return domain;
        }

        const classification = domainClassifications.get(domain)!;
        const parts = [
            domain,
            this.formatDomainType(classification.type),
            `Publishes: ${classification.acceptedContentTypes.join(', ')}`,
            `Model: ${this.formatContributionModel(classification.contributionModel)}`,
            `Actions: ${classification.recommendedActions.join(', ')}`
        ];

        if (classification.restrictions.length > 0) {
            parts.push(`Restrictions: ${classification.restrictions.join(', ')}`);
        }

        return parts.join(' | ');
    }

    /**
     * Format domain type for display
     */
    private formatDomainType(type: string): string {
        const typeMap: Record<string, string> = {
            'brand_owned': 'Brand Owned',
            'competitor': 'Competitor',
            'social_platform': 'Social Platform',
            'industry_media': 'Industry Media',
            'third_party': 'Third-Party Site'
        };
        return typeMap[type] || type;
    }

    /**
     * Format contribution model for display
     */
    private formatContributionModel(model: string): string {
        const modelMap: Record<string, string> = {
            'direct_publish': 'Direct Publish',
            'earned_media': 'Earned Media',
            'paid_placement': 'Paid Placement',
            'community': 'Community'
        };
        return modelMap[model] || model;
    }

    /**
     * DEPRECATED: Old hardcoded classification (kept as fallback)
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
     * Construct a batched prompt for converting opportunities into recommendations
     */
    constructBatchPrompt(
        brandName: string,
        opportunities: Opportunity[],
        competitorDomains: string[],
        brandDomain?: string,
        domainClassifications?: Map<string, DomainClassification>
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
                        const enrichedContext = this.formatSourceContext(s.domain, domainClassifications);
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
Available Sources: ${q.sources.join(', ') || 'No specific sources identified'}`;
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


6. **SOURCE REALITY CHECK (CRITICAL):**
   Each source listed above includes detailed information about:
   - **Type**: Whether it's brand-owned, competitor, social platform, industry media, or third-party
   - **Publishes**: What content formats they accept
   - **Model**: How content gets published (direct, earned media, paid, community)
   - **Actions**: Specific feasible actions for that platform
   - **Restrictions**: What you CANNOT do on that platform
   
   **YOU MUST:**
   - Only suggest actions that are listed in the "Actions" for each source
   - Respect all "Restrictions" mentioned for each source
   - Match your ContentType to what's listed in "Publishes" for the chosen Channel
   - NEVER suggest editing or publishing directly on competitor sites or third-party sites unless "Direct Publish" is the model
   - For "Earned Media" sources, focus on pitching, outreach, or buying placements
   - For "Community" sources, focus on posting, engaging, and organic content

CONTENT TYPE OPTIONS:
- Short-form Video Script (Best for rapid answers, visual explanations, and increasing dwell time)
- Social Media Thread (X/Threads)
- Technical Comparison Table (Specialized for AEO comparison queries)
- Expert Community Response (Reddit/Quora/StackOverflow)
- Data-Driven White Paper (In-depth research)
- Article (Standard SEO/AEO long-form content)
- Podcast (Conversational audio)
- Expert Articles (Highly authoritative thought leadership)

For each recommendation, return a JSON object with these EXACT fields:
- Recommendation: (The primary task/action - MUST be actionable based on source type)
- Channel: (The target domain where content will be published)
- ContentType: (One of the options above)
- ThoughtProcess: (Reasoning for this choice, EXPLICITLY mentioning why this action fits the source type)
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
