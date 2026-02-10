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
            await this.saveStrategy(recommendationId, customerId, rec.generation_id, rec.brand_id, strategyPlan);

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

        return `You are a content strategist helping ${brand.name} create content for: "${recommendation.action}".

**Context:**
- Brand: ${brand.name}${brand.industry ? ` (${brand.industry})` : ''}
- Topic/Action: ${recommendation.action}
- Channel: ${recommendation.channel}
- Content Type: ${contentType}

**Your Task:**
Enrich the provided template JSON.
1. Update each section's "title" to be specific and engaging for this topic.
2. Update each section's "content" by appending 1-2 sentences of strategic guidance relevant to the brand and topic.

**Input Template:**
${templatesJson}

**Output Requirements:**
- Return ONLY valid JSON.
- Return an ARRAY of objects (same structure as input).
- Do NOT add new sections.
- Do NOT remove sections.
- Use \\n for line breaks in strings.
- Do NOT include any markdown formatting (like \`\`\`json). Just the raw JSON array.

**Example Output Format:**
[
  {
    "id": "section_id",
    "title": "New Engaging Title",
    "content": "Original content description...\\n\\nStrategic Tip: Focus on...",
    "sectionType": "original_type"
  }
]

${customInstructions ? `\nAdditional instructions: ${customInstructions}` : ''}`;
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
            // Extract JSON from response (look for array)
            const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.error('❌ No JSON array found in LLM response');
                console.error('LLM Response:', llmResponse.substring(0, 500));
                return null;
            }

            const jsonString = jsonMatch[0];

            console.log('📝 Parsing enriched template JSON array...');

            let enrichedSections: StructureSection[];
            try {
                enrichedSections = JSON.parse(jsonString);
            } catch (parseError: any) {
                console.error('❌ JSON parse failed:', parseError.message);
                console.error('Problematic JSON (first 1000 chars):', jsonString.substring(0, 1000));
                return null;
            }

            if (!Array.isArray(enrichedSections)) {
                console.error('❌ Response is not an array');
                return null;
            }

            console.log(`✅ Parsed ${enrichedSections.length} enriched sections`);

            // Use the enriched sections directly, ensuring we keep all original properties if missing
            const finalSections = context.templateSections.map(original => {
                const enriched = enrichedSections.find(e => e.id === original.id);
                if (enriched) {
                    return {
                        ...original,
                        title: enriched.title || original.title,
                        content: enriched.content || original.content
                    };
                }
                return original;
            });

            return {
                recommendationId: context.recommendationId,
                contentType: context.contentType,
                primaryEntity: context.action,
                targetChannel: context.channel,
                brandContext: {
                    name: context.brand
                },
                structure: finalSections,
                strategicGuidance: {
                    keyFocus: '',
                    aeoTargets: [],
                    toneGuidelines: '',
                    differentiation: ''
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
        generationId: string,
        brandId: string,
        strategy: StrategyPlan
    ): Promise<void> {
        // Check for existing strategy to preserve context files
        const { data: existing } = await supabaseAdmin
            .from('recommendation_generated_contents')
            .select('content')
            .eq('recommendation_id', recommendationId)
            .eq('content_type', 'strategy_plan')
            .maybeSingle();

        if (existing) {
            try {
                const existingPlan = JSON.parse(existing.content);
                if (existingPlan.contextFiles && Array.isArray(existingPlan.contextFiles) && existingPlan.contextFiles.length > 0) {
                    console.log(`📦 [StrategyService] Preserving ${existingPlan.contextFiles.length} context files`);
                    // If the new strategy doesn't have context files (it shouldn't), copy them over
                    if (!strategy.contextFiles) {
                        strategy.contextFiles = existingPlan.contextFiles;
                    } else {
                        // If it somehow has them, maybe merge? But simplified: keep existing if new is empty
                        // For now, assuming new strategy from LLM has no context files
                        strategy.contextFiles = existingPlan.contextFiles;
                    }
                }
            } catch (e) {
                console.warn('⚠️ Failed to parse existing strategy to preserve files', e);
            }
        }

        // Delete existing strategy plan for this recommendation (if any)
        await supabaseAdmin
            .from('recommendation_generated_contents')
            .delete()
            .eq('recommendation_id', recommendationId)
            .eq('content_type', 'strategy_plan');

        // Insert new strategy plan with ALL required fields
        const { error } = await supabaseAdmin
            .from('recommendation_generated_contents')
            .insert({
                recommendation_id: recommendationId,
                customer_id: customerId,
                generation_id: generationId,
                brand_id: brandId,
                status: 'generated',
                content_type: 'strategy_plan',
                content: JSON.stringify(strategy),
                model_provider: 'openrouter',
                model_name: 'meta-llama/llama-3.3-70b-instruct',
                prompt: 'strategy_enrichment',
                metadata: {
                    is_strategy_plan: true,
                    content_type: strategy.contentType,
                    has_strategic_guidance: true
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('❌ Error saving strategy:', error);
            throw error;
        }

        console.log(`✅ [StrategyService] Saved strategy for ${recommendationId}`);
    }

    /**
     * Parse context file content
     */
    private async parseContextFile(buffer: Buffer, mimeType: string): Promise<string> {
        try {
            if (mimeType === 'application/pdf') {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const pdf = require('pdf-parse/dist/node/cjs/index.cjs');
                const data = await pdf(buffer);
                return data.text;
            } else {
                // Assume text/plain or similar
                return buffer.toString('utf-8');
            }
        } catch (error) {
            console.error('❌ Error parsing file:', error);
            throw new Error('Failed to parse file content');
        }
    }

    /**
     * Add context file to strategy
     */
    async addContextFile(
        recommendationId: string,
        customerId: string,
        file: {
            name: string;
            buffer: Buffer;
            mimeType: string;
            size: number;
        }
    ): Promise<{ success: boolean; error?: string; data?: any }> {
        try {
            // Fetch recommendation to get generation_id
            const { data: rec, error: recError } = await supabaseAdmin
                .from('recommendations')
                .select('generation_id, brand_id')
                .eq('id', recommendationId)
                .eq('customer_id', customerId)
                .single();

            if (recError || !rec) {
                return { success: false, error: 'Recommendation not found' };
            }

            // Parse file content
            const extractedText = await this.parseContextFile(file.buffer, file.mimeType);

            // Fetch existing strategy
            let { data: existing } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('content, id')
                .eq('recommendation_id', recommendationId)
                .eq('content_type', 'strategy_plan')
                .maybeSingle();

            // If no strategy exists, create a dummy one to hold context files
            // This supports the "Step 2" upload flow even if strategy wasn't explicitly generated
            let strategy: StrategyPlan;

            if (!existing) {
                strategy = {
                    recommendationId,
                    contentType: 'article', // Default, will be updated if strategy is generated
                    primaryEntity: '',
                    targetChannel: '',
                    brandContext: { name: '' },
                    structure: [],
                    strategicGuidance: {
                        keyFocus: '',
                        aeoTargets: [],
                        toneGuidelines: '',
                        differentiation: ''
                    },
                    contextFiles: []
                };
            } else {
                strategy = JSON.parse(existing.content);
            }

            // Add context file
            if (!strategy.contextFiles) {
                strategy.contextFiles = [];
            }

            const newFile = {
                id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                content: extractedText, // Storing parsed text for LLM context
                uploadedAt: new Date().toISOString()
            };

            strategy.contextFiles.push(newFile);

            // Save updated/new strategy
            // Using upsert logic here
            // Delete existing strategy plan for this recommendation (if any)
            await supabaseAdmin
                .from('recommendation_generated_contents')
                .delete()
                .eq('recommendation_id', recommendationId)
                .eq('content_type', 'strategy_plan');

            // Insert new strategy plan
            await supabaseAdmin
                .from('recommendation_generated_contents')
                .insert({
                    recommendation_id: recommendationId,
                    customer_id: customerId,
                    generation_id: rec.generation_id,
                    brand_id: rec.brand_id,
                    status: 'generated',
                    content_type: 'strategy_plan',
                    content: JSON.stringify(strategy),
                    model_provider: 'openrouter',
                    model_name: 'meta-llama/llama-3.3-70b-instruct',
                    prompt: 'strategy_enrichment',
                    metadata: {
                        is_strategy_plan: true,
                        content_type: strategy.contentType,
                        has_strategic_guidance: true
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            console.log(`✅ [StrategyService] Added context file: ${file.name}`);
            return { success: true, data: { file: newFile } };

        } catch (error: any) {
            console.error('❌ Error adding context file:', error);
            return { success: false, error: error.message };
        }
    }
}

export const strategyGenerationService = new StrategyGenerationService();
