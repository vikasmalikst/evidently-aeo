/**
 * Strategy Generation Service
 * 
 * Takes content templates from frontend and enriches them with LLM-powered strategic guidance.
 * Uses OpenRouter to generate contextual, brand-specific content strategies.
 */

import { supabaseAdmin } from '../../config/supabase';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';

// Import templates from frontend (we'll reference them, not duplicate)
export type ContentTemplateType = 'article' | 'whitepaper' | 'short_video' | 'expert_community_response' | 'podcast' | 'comparison_table' | 'social_media_thread';

export interface StructureSection {
    id: string;
    title: string;
    content: string;
    sectionType: string;
}

export interface StrategyPlan {
    recommendationId: string;
    contentType: ContentTemplateType;
    primaryEntity: string;
    targetChannel: string;
    brandContext: {
        name: string;
        competitors?: string[];
    };
    structure: StructureSection[];
    strategicGuidance: {
        keyFocus: string;
        aeoTargets: string[];
        toneGuidelines: string;
        differentiation: string;
    };
    contextFiles?: {
        id: string;
        name: string;
        content: string;
        uploadedAt: string;
    }[];
}

export class StrategyGenerationService {
    /**
     * Generate an enriched strategy based on recommendation and templates
     */
    async generateStrategy({
        recommendationId,
        customerId,
        templateSections,
        contentType,
        customInstructions
    }: {
        recommendationId: string;
        customerId: string;
        templateSections: StructureSection[];
        contentType: ContentTemplateType;
        customInstructions?: string;
    }): Promise<{ success: boolean; data?: StrategyPlan; error?: string }> {
        try {
            // 1. Fetch recommendation data
            const { data: rec, error: recError } = await supabaseAdmin
                .from('recommendations')
                .select('*')
                .eq('id', recommendationId)
                .eq('customer_id', customerId)
                .single();

            if (recError || !rec) {
                return { success: false, error: 'Recommendation not found' };
            }

            // 2. Fetch brand data
            const { data: brand } = await supabaseAdmin
                .from('brands')
                .select('*')
                .eq('id', rec.brand_id)
                .single();

            // 3. Build strategy enrichment prompt
            const prompt = this.buildStrategyPrompt({
                recommendation: rec,
                brand: brand || { name: 'Brand' },
                templateSections,
                contentType,
                customInstructions
            });

            console.log(`🧠 [StrategyService] Generating strategy for ${recommendationId} (${contentType})`);

            // 4. Call LLM for strategy enrichment
            const response = await openRouterCollectorService.executeQuery({
                collectorType: 'content',
                prompt,
                maxTokens: 2000,
                temperature: 0.5,
                model: 'meta-llama/llama-3.3-70b-instruct'
            });

            if (!response.response) {
                return { success: false, error: 'LLM returned empty response' };
            }

            // 5. Parse strategy plan
            const strategyPlan = this.parseStrategyResponse(
                response.response,
                {
                    recommendationId,
                    contentType,
                    templateSections,
                    brand: brand?.name || 'Brand',
                    action: rec.action,
                    channel: rec.channel
                }
            );

            if (!strategyPlan) {
                return { success: false, error: 'Failed to parse strategy response' };
            }

            // 6. Save to database
            await this.saveStrategy(recommendationId, customerId, strategyPlan);

            console.log(`✅ [StrategyService] Strategy generated for ${recommendationId}`);
            return { success: true, data: strategyPlan };

        } catch (error: any) {
            console.error('❌ [StrategyService] Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Build the LLM prompt for strategy enrichment
     */
    private buildStrategyPrompt({
        recommendation,
        brand,
        templateSections,
        contentType,
        customInstructions
    }: any): string {
        const templatesJson = JSON.stringify(templateSections, null, 2);

        return `You are a content strategy expert helping ${brand.name} create an optimized content plan.

RECOMMENDATION CONTEXT:
Action: ${recommendation.action}
Target Channel: ${recommendation.channel}
Content Type: ${contentType}
Primary Query/Topic: ${recommendation.query || recommendation.action}

BRAND CONTEXT:
Brand Name: ${brand.name}
${brand.industry ? `Industry: ${brand.industry}` : ''}
${brand.description ? `About: ${brand.description}` : ''}

TEMPLATE STRUCTURE:
The content will follow this proven structure:
${templatesJson}

${customInstructions ? `\nCUSTOM REQUIREMENTS:\n${customInstructions}\n` : ''}

YOUR TASK:
Generate a strategic content plan by enriching the template with:

1. **Key Focus**: What is the #1 thing this content must accomplish?
2. **AEO Targets**: 3-5 specific entities or topics to emphasize for Answer Engine Optimization
3. **Tone Guidelines**: How should ${brand.name} sound in this content? (e.g., authoritative, friendly, technical)
4. **Differentiation**: What makes ${brand.name}'s approach unique compared to competitors?
5. **Section-Specific Guidance**: For each template section, provide 2-3 bullet points of strategic guidance

Return your response in this JSON format:
\`\`\`json
{
  "strategicGuidance": {
    "keyFocus": "string",
    "aeoTargets": ["entity1", "entity2", "entity3"],
    "toneGuidelines": "string",
    "differentiation": "string"
  },
  "sectionGuidance": [
    {
      "sectionId": "string",
      "sectionTitle": "string",
      "guidance": ["point 1", "point 2", "point 3"]
    }
  ]
}
\`\`\`

Focus on actionable, specific guidance. Avoid generic advice.`;
    }

    /**
     * Parse LLM response into StrategyPlan
     */
    private parseStrategyResponse(
        llmResponse: string,
        context: {
            recommendationId: string;
            contentType: ContentTemplateType;
            templateSections: StructureSection[];
            brand: string;
            action: string;
            channel: string;
        }
    ): StrategyPlan | null {
        try {
            // Extract JSON from response
            const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/) || llmResponse.match(/{[\s\S]*}/);
            if (!jsonMatch) {
                console.error('❌ No JSON found in LLM response');
                return null;
            }

            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

            // Enrich template sections with LLM guidance
            const enrichedSections = context.templateSections.map(section => {
                const sectionGuidance = parsed.sectionGuidance?.find(
                    (g: any) => g.sectionId === section.id || g.sectionTitle === section.title
                );

                return {
                    ...section,
                    strategicGuidance: sectionGuidance?.guidance || []
                };
            });

            return {
                recommendationId: context.recommendationId,
                contentType: context.contentType,
                primaryEntity: context.action,
                targetChannel: context.channel,
                brandContext: {
                    name: context.brand
                },
                structure: enrichedSections,
                strategicGuidance: {
                    keyFocus: parsed.strategicGuidance.keyFocus || '',
                    aeoTargets: parsed.strategicGuidance.aeoTargets || [],
                    toneGuidelines: parsed.strategicGuidance.toneGuidelines || '',
                    differentiation: parsed.strategicGuidance.differentiation || ''
                }
            };
        } catch (error) {
            console.error('❌ Error parsing strategy response:', error);
            return null;
        }
    }

    /**
     * Save strategy to database
     */
    private async saveStrategy(
        recommendationId: string,
        customerId: string,
        strategy: StrategyPlan
    ): Promise<void> {
        // Delete existing strategy plan for this recommendation (if any)
        await supabaseAdmin
            .from('recommendation_generated_contents')
            .delete()
            .eq('recommendation_id', recommendationId)
            .eq('content_type', 'strategy_plan');

        // Insert new strategy plan
        const { error } = await supabaseAdmin
            .from('recommendation_generated_contents')
            .insert({
                recommendation_id: recommendationId,
                customer_id: customerId,
                content_type: 'strategy_plan',
                content: JSON.stringify(strategy),
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('❌ Error saving strategy:', error);
            throw error;
        }

        console.log(`✅ [StrategyService] Saved strategy for ${recommendationId}`);
    }

    /**
     * Add context file to strategy
     */
    async addContextFile(
        recommendationId: string,
        customerId: string,
        file: {
            name: string;
            content: string;
        }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Fetch existing strategy
            const { data: existing } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('content')
                .eq('recommendation_id', recommendationId)
                .eq('content_type', 'strategy_plan')
                .maybeSingle();

            if (!existing) {
                return { success: false, error: 'No strategy found. Generate strategy first.' };
            }

            const strategy: StrategyPlan = JSON.parse(existing.content);

            // Add context file
            if (!strategy.contextFiles) {
                strategy.contextFiles = [];
            }

            strategy.contextFiles.push({
                id: `file_${Date.now()}`,
                name: file.name,
                content: file.content,
                uploadedAt: new Date().toISOString()
            });

            // Save updated strategy
            await this.saveStrategy(recommendationId, customerId, strategy);

            console.log(`✅ [StrategyService] Added context file: ${file.name}`);
            return { success: true };

        } catch (error: any) {
            console.error('❌ Error adding context file:', error);
            return { success: false, error: error.message };
        }
    }
}

export const strategyGenerationService = new StrategyGenerationService();
