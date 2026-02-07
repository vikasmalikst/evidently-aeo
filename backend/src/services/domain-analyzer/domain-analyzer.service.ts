/**
 * Domain Analyzer Service
 * 
 * Analyzes web domains using LLM to provide rich classification data for
 * source-action alignment in opportunity recommendations.
 * 
 * Features:
 * - LLM-based domain analysis
 * - 30-day caching to reduce costs
 * - Batch analysis support
 * - Fallback to hardcoded classification on failures
 */

import { supabaseAdmin } from '../../config/database';
import { recommendationLLMService } from '../recommendations/recommendation-llm.service';

// ============================================================================
// Types
// ============================================================================

export type DomainType = 'brand_owned' | 'competitor' | 'social_platform' | 'industry_media' | 'third_party';
export type ContributionModel = 'direct_publish' | 'earned_media' | 'paid_placement' | 'community';

export interface DomainClassification {
    domain: string;
    type: DomainType;
    acceptedContentTypes: string[];
    contributionModel: ContributionModel;
    recommendedActions: string[];
    restrictions: string[];
    confidence: number;
    analysisDate: Date;
}

interface LLMDomainAnalysisResponse {
    domain: string;
    type: DomainType;
    acceptedContentTypes: string[];
    contributionModel: ContributionModel;
    recommendedActions: string[];
    restrictions: string[];
    confidence: number;
}

// ============================================================================
// Service
// ============================================================================

export class DomainAnalyzerService {
    /**
     * Analyze multiple domains with caching
     */
    async analyzeDomains(
        domains: string[],
        brandDomain: string,
        competitorDomains: string[],
        brandId: string
    ): Promise<Map<string, DomainClassification>> {
        console.log(`[DomainAnalyzer] Analyzing ${domains.length} domains for brand ${brandId}`);

        const result = new Map<string, DomainClassification>();
        const domainsToAnalyze: string[] = [];

        // Step 1: Check cache for each domain
        for (const domain of domains) {
            const cached = await this.getCachedClassification(domain, brandId);
            if (cached) {
                console.log(`[DomainAnalyzer] Cache HIT for ${domain}`);
                result.set(domain, cached);
            } else {
                console.log(`[DomainAnalyzer] Cache MISS for ${domain}`);
                domainsToAnalyze.push(domain);
            }
        }

        // Step 2: Analyze uncached domains with LLM
        if (domainsToAnalyze.length > 0) {
            console.log(`[DomainAnalyzer] Analyzing ${domainsToAnalyze.length} uncached domains with LLM`);

            try {
                const analyzed = await this.analyzeWithLLM(domainsToAnalyze, brandDomain, competitorDomains, brandId);

                // Store in cache and add to result
                for (const classification of analyzed) {
                    await this.cacheClassification(classification, brandId);
                    result.set(classification.domain, classification);
                }
            } catch (error) {
                console.error('[DomainAnalyzer] LLM analysis failed, falling back to hardcoded classification:', error);

                // Fallback to hardcoded classification
                for (const domain of domainsToAnalyze) {
                    const fallback = this.hardcodedClassification(domain, brandDomain, competitorDomains);
                    result.set(domain, fallback);
                }
            }
        }

        console.log(`[DomainAnalyzer] Successfully classified ${result.size} domains`);
        return result;
    }

    /**
     * Get cached classification from database
     */
    private async getCachedClassification(domain: string, brandId: string): Promise<DomainClassification | null> {
        const { data, error } = await supabaseAdmin
            .from('domain_classifications')
            .select('classification, updated_at')
            .eq('domain', domain)
            .eq('brand_id', brandId)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error || !data) {
            return null;
        }

        const classification = data.classification as any;
        return {
            ...classification,
            analysisDate: new Date(data.updated_at)
        };
    }

    /**
     * Cache classification in database
     */
    private async cacheClassification(classification: DomainClassification, brandId: string): Promise<void> {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days cache

        const { error } = await supabaseAdmin
            .from('domain_classifications')
            .upsert({
                domain: classification.domain,
                brand_id: brandId,
                classification: {
                    type: classification.type,
                    acceptedContentTypes: classification.acceptedContentTypes,
                    contributionModel: classification.contributionModel,
                    recommendedActions: classification.recommendedActions,
                    restrictions: classification.restrictions,
                    confidence: classification.confidence
                },
                updated_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString()
            }, {
                onConflict: 'domain,brand_id'
            });

        if (error) {
            console.error(`[DomainAnalyzer] Failed to cache classification for ${classification.domain}:`, error);
        }
    }

    /**
     * Analyze domains using LLM
     */
    private async analyzeWithLLM(
        domains: string[],
        brandDomain: string,
        competitorDomains: string[],
        brandId: string
    ): Promise<DomainClassification[]> {
        const prompt = this.constructAnalysisPrompt(domains, brandDomain, competitorDomains);

        const systemMessage = `You are a domain classification expert. Respond ONLY with a valid JSON array of domain classifications.`;

        const llmResponse = await recommendationLLMService.executePrompt<LLMDomainAnalysisResponse>(
            brandId,
            prompt,
            systemMessage,
            8000
        );

        if (!llmResponse || !Array.isArray(llmResponse)) {
            throw new Error('Invalid LLM response for domain analysis');
        }

        // Map LLM response to DomainClassification, ensuring domain field exists
        const classifications: DomainClassification[] = [];

        for (let i = 0; i < llmResponse.length; i++) {
            const response = llmResponse[i];

            // If LLM included domain, use it; otherwise use original domain by index
            const domain = response.domain || domains[i];

            if (!domain) {
                console.warn(`[DomainAnalyzer] Skipping response ${i} - no domain found`);
                continue;
            }

            classifications.push({
                domain: domain,
                type: response.type,
                acceptedContentTypes: response.acceptedContentTypes || [],
                contributionModel: response.contributionModel,
                recommendedActions: response.recommendedActions || [],
                restrictions: response.restrictions || [],
                confidence: response.confidence || 50,
                analysisDate: new Date()
            });
        }

        return classifications;
    }

    /**
     * Construct LLM prompt for domain analysis
     */
    private constructAnalysisPrompt(domains: string[], brandDomain: string, competitorDomains: string[]): string {
        const domainList = domains.map((d, idx) => `${idx + 1}. ${d}`).join('\n');
        const competitorList = competitorDomains.join(', ');

        return `You are analyzing web domains to categorize them for content marketing and AEO recommendations.

Brand Context:
- Brand Domain: ${brandDomain}
- Competitor Domains: ${competitorList}

For EACH domain below, analyze and return:
1. domain: The exact domain name from the list (REQUIRED)
2. type: "brand_owned" | "competitor" | "social_platform" | "industry_media" | "third_party"
3. acceptedContentTypes: Array of content formats they publish (e.g., ["Article", "Video", "Podcast"])
4. contributionModel: "direct_publish" | "earned_media" | "paid_placement" | "community"
5. recommendedActions: Array of feasible actions (e.g., ["Pitch guest post", "Buy sponsored content"])
6. restrictions: Array of limitations (e.g., ["Editorial approval required", "No promotional content"])
7. confidence: Number 0-100 indicating certainty

Domains to analyze:
${domainList}

Return ONLY a valid JSON array of objects, one per domain IN THE SAME ORDER. Use your knowledge of these platforms' editorial policies and content models.

CRITICAL: Each object MUST include the "domain" field with the exact domain name.

IMPORTANT RULES:
- If domain matches brand domain, type MUST be "brand_owned"
- If domain matches competitor domains, type MUST be "competitor"
- For social platforms (LinkedIn, Twitter, Reddit, etc.), use type "social_platform" and contributionModel "community"
- For news/media sites, use type "industry_media" and contributionModel "earned_media"
- Be specific about restrictions (e.g., "No self-promotion" for Reddit, "Editorial approval" for TechCrunch)
- Only suggest actions that are actually feasible on the platform`;
    }

    /**
     * Fallback hardcoded classification (used when LLM fails)
     */
    private hardcodedClassification(
        domain: string,
        brandDomain: string,
        competitorDomains: string[]
    ): DomainClassification {
        const d = domain.toLowerCase();

        // Brand owned
        if (d === brandDomain.toLowerCase() || d.endsWith('.' + brandDomain.toLowerCase())) {
            return {
                domain,
                type: 'brand_owned',
                acceptedContentTypes: ['Article', 'Video', 'Podcast', 'White Paper'],
                contributionModel: 'direct_publish',
                recommendedActions: ['Publish new content', 'Optimize existing pages', 'Add schema markup'],
                restrictions: [],
                confidence: 100,
                analysisDate: new Date()
            };
        }

        // Competitor
        if (competitorDomains.some(c => d.includes(c.toLowerCase()))) {
            return {
                domain,
                type: 'competitor',
                acceptedContentTypes: [],
                contributionModel: 'earned_media',
                recommendedActions: ['Create counter-content on your site', 'Target same keywords'],
                restrictions: ['Cannot directly modify'],
                confidence: 100,
                analysisDate: new Date()
            };
        }

        // Social platforms
        const socialPlatforms = ['linkedin', 'twitter', 'x.com', 'facebook', 'instagram', 'reddit', 'quora', 'youtube', 'tiktok', 'medium', 'pinterest', 'g2', 'capterra', 'trustradius'];
        if (socialPlatforms.some(p => d.includes(p))) {
            return {
                domain,
                type: 'social_platform',
                acceptedContentTypes: ['Post', 'Article', 'Video', 'Comment'],
                contributionModel: 'community',
                recommendedActions: ['Post organic content', 'Engage in discussions', 'Run ads'],
                restrictions: ['Platform controls distribution', 'Community guidelines apply'],
                confidence: 80,
                analysisDate: new Date()
            };
        }

        // Industry media
        const mediaKeywords = ['news', 'times', 'journal', 'daily', 'post', 'herald', 'chronicle', 'gazette', 'tribune', 'magazine', 'fierce', 'pharma', 'biotech', 'clinical', 'medscape', 'statnews', 'techcrunch', 'forbes', 'bloomberg', 'reuters'];
        if (mediaKeywords.some(k => d.includes(k))) {
            return {
                domain,
                type: 'industry_media',
                acceptedContentTypes: ['Article', 'Guest Post', 'Expert Commentary'],
                contributionModel: 'earned_media',
                recommendedActions: ['Pitch newsworthy story', 'Request expert quote', 'Buy sponsored content'],
                restrictions: ['Editorial approval required', 'News value needed'],
                confidence: 70,
                analysisDate: new Date()
            };
        }

        // Default: third party
        return {
            domain,
            type: 'third_party',
            acceptedContentTypes: ['Article', 'Guest Post'],
            contributionModel: 'earned_media',
            recommendedActions: ['Outreach for guest post', 'Request backlink'],
            restrictions: ['Requires owner approval'],
            confidence: 50,
            analysisDate: new Date()
        };
    }
}

export const domainAnalyzerService = new DomainAnalyzerService();
