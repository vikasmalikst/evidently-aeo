/**
 * Strategy Generation Service
 * 
 * Takes content templates from frontend and enriches them with LLM-powered strategic guidance.
 * Uses OpenRouter to generate contextual, brand-specific content strategies.
 */

import { supabaseAdmin } from '../../config/supabase';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';
import { strategyPlanner } from './strategy-planner.service';

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



// ... (imports remain same)

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

            // 2.5 Fetch existing strategy to retrieve uploaded context files
            let existingContextFiles: any[] = [];
            const { data: existingStrategyRow } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('content')
                .eq('recommendation_id', recommendationId)
                .eq('content_type', 'strategy_plan')
                .maybeSingle();

            if (existingStrategyRow) {
                try {
                    const existingPlan = JSON.parse(existingStrategyRow.content) as StrategyPlan;
                    if (existingPlan.contextFiles && existingPlan.contextFiles.length > 0) {
                        existingContextFiles = existingPlan.contextFiles;
                    }
                } catch (e) {
                    console.error('⚠️ [StrategyService] Error parsing existing strategy for context:', e);
                }
            }

            // 3. Build Unified Prompt
            const prompt = this.buildUnifiedPrompt({
                brand: brand || { name: 'Brand', industry: 'Unknown', competitors: [] },
                topic: rec.action,
                contentType,
                templateSections
            });

            console.log(`🧠 [StrategyService] Generating UNIFIED strategy for ${recommendationId} (${contentType})`);

            // 4. Call LLM for strategy enrichment
            const response = await openRouterCollectorService.executeQuery({
                collectorType: 'content',
                prompt,
                maxTokens: 10000,
                temperature: 0.7, // Higher temp for creativity in angle
                model: 'openai/gpt-oss-20b' // Using consistent model
            });

            if (!response.response) {
                return { success: false, error: 'LLM returned empty response' };
            }

            // 5. Parse Unified Response
            console.log('🤖 [StrategyService] Raw LLM Response:', response.response);
            const strategyPlan = this.parseUnifiedResponse(
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

            // 5.5 Preserve context files
            if (existingContextFiles.length > 0) {
                strategyPlan.contextFiles = existingContextFiles;
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
     * Build the Unified Logic Prompt
     */
    private buildUnifiedPrompt({
        brand,
        topic,
        contentType,
        templateSections
    }: any): string {
        const competitors = (brand.competitors || []).join(', ') || 'Standard Industry Competitors';
        const templatesJson = JSON.stringify(templateSections, null, 2);

        return `You are a World-Class Content Strategist for ${brand.name}.
Your goal is to plan a high-performance piece of content about: "${topic}" (${contentType}).

You must perform two distinct steps in a single output:
1. **STRATEGIC PLANNING:** Define the target audience, their pain points, and a unique hook.
2. **EXECUTION PLANNING:** Rewrite the provided content structure to align perfectly with that strategy.

**Brand Context:**
- Name: ${brand.name}
- Industry: ${brand.industry || 'Unknown Industry'}
- Competitors: ${competitors}

**Step 1: Strategic Angle (The "Brain")**
Analyze the topic and brand to define:
- **Target Audience:** Be hyper-specific (e.g., "Budget-conscious renovators", not "Homeowners").
- **Primary Pain Point:** What strictly KEEPS THEM UP AT NIGHT regarding this topic?
- **The Hook:** What is the unique, contrarian, or "insider" perspective ${brand.name} can take?
- **Competitor Counter-Strike:** How do competitors (${competitors}) usually fail at this? How does ${brand.name} succeed?

**Step 2: Execution Plan (The "Hands")**
Rewrite the provided content structure template below.
- **Rules:**
  - You are NOT just copying the template. You are customizing every instruction to hit the specific Audience and Hook defined in Step 1.
  - **IMPORTANT:** If a section is a 'comparison_table', the 'content' field MUST be a valid Markdown table (using | separators). Do NOT write a paragraph describing the table. Write the actual table.
  - Use \\n for line breaks.

**Input Template:**
${templatesJson}

**Output Requirements:**
Return a SINGLE JSON object with this exact schema:
{
  "strategic_angle": {
    "targetAudience": "...",
    "primaryPainPoint": "...",
    "theHook": "...",
    "competitorCounterStrike": "..."
  },
  "sections": [
    {
      "id": "section_id",
      "title": "Optimized Title...",
      "content": "Detailed instruction...",
      "sectionType": "original_type"
    }
  ]
}
`;
    }

    /**
     * Parse Unified LLM response into StrategyPlan
     */
    private parseUnifiedResponse(
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
            const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('❌ No JSON object found in LLM response');
                return null;
            }

            const jsonString = jsonMatch[0];
            const parsed = JSON.parse(jsonString);

            if (!parsed.strategic_angle || !parsed.sections) {
                console.error('❌ Invalid JSON structure: missing strategic_angle or sections');
                return null;
            }

            const { strategic_angle, sections } = parsed;
            console.log('📦 [StrategyService] Parsed Sections:', JSON.stringify(sections, null, 2));
            console.log('📦 [StrategyService] Parsed Angle:', JSON.stringify(strategic_angle, null, 2));

            // Map enriched sections to original IDs
            console.log('🔍 [StrategyService] Mapping sections...');
            const finalSections = context.templateSections.map(original => {
                const enriched = sections.find((e: any) => e.id === original.id);
                console.log(`   🔸 Checking ID: "${original.id}" -> Found match? ${!!enriched}`);
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
                    keyFocus: strategic_angle.theHook || 'Strategic Focus',
                    aeoTargets: [strategic_angle.targetAudience || 'Target Audience'],
                    toneGuidelines: `Address pain point: ${strategic_angle.primaryPainPoint || 'Pain Point'} `,
                    differentiation: strategic_angle.competitorCounterStrike || ''
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
                    console.log(`📦[StrategyService] Preserving ${existingPlan.contextFiles.length} context files`);
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

        console.log(`✅[StrategyService] Saved strategy for ${recommendationId}`);
    }

    /**
     * Parse context file content
     */
    private async parseContextFile(buffer: Buffer, mimeType: string): Promise<string> {
        try {
            if (mimeType === 'application/pdf') {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { PDFParse } = require('pdf-parse');
                const parser = new PDFParse({ data: buffer });
                const result = await parser.getText();
                return result.text;
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

            console.log(`✅[StrategyService] Added context file: ${file.name}`);
            return { success: true, data: { file: newFile } };

        } catch (error: any) {
            console.error('❌ Error adding context file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove a previously uploaded context file from a strategy plan.
     * This is used by the Step 2 UI when the user deletes a document.
     */
    async removeContextFile(
        recommendationId: string,
        customerId: string,
        fileId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Fetch existing strategy plan for this recommendation
            const { data: existing, error: fetchError } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('id, content')
                .eq('recommendation_id', recommendationId)
                .eq('content_type', 'strategy_plan')
                .eq('customer_id', customerId)
                .maybeSingle();

            if (fetchError) {
                console.error('❌ [StrategyService] Error fetching strategy for context removal:', fetchError);
                return { success: false, error: 'Failed to load strategy plan' };
            }

            if (!existing) {
                return { success: false, error: 'Strategy plan not found' };
            }

            let strategy: StrategyPlan;
            try {
                strategy = JSON.parse(existing.content);
            } catch (e) {
                console.error('❌ [StrategyService] Failed to parse existing strategy when removing context file:', e);
                return { success: false, error: 'Corrupted strategy plan content' };
            }

            if (!strategy.contextFiles || !Array.isArray(strategy.contextFiles)) {
                return { success: false, error: 'No context files found for this strategy' };
            }

            const beforeCount = strategy.contextFiles.length;
            strategy.contextFiles = strategy.contextFiles.filter(f => f.id !== fileId);

            if (strategy.contextFiles.length === beforeCount) {
                return { success: false, error: 'Context file not found' };
            }

            const { error: updateError } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .update({
                    content: JSON.stringify(strategy),
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .eq('customer_id', customerId);

            if (updateError) {
                console.error('❌ [StrategyService] Error updating strategy after context removal:', updateError);
                return { success: false, error: 'Failed to update strategy plan' };
            }

            console.log(`✅[StrategyService] Removed context file ${fileId} from recommendation ${recommendationId}`);
            return { success: true };
        } catch (error: any) {
            console.error('❌ [StrategyService] Error removing context file:', error);
            return { success: false, error: error.message || 'Unexpected error removing context file' };
        }
    }
}

export const strategyGenerationService = new StrategyGenerationService();
