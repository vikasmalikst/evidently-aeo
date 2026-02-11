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
    researchQueries?: string[];
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

            // 2.75 Generate Strategic Angle (Audience, Hook, Counter-Strike)
            // This is the new "Brain" of the operation
            let strategicAngle;
            try {
                // Use the imported strategyPlanner instance directly
                strategicAngle = await strategyPlanner.generateStrategicAngle(
                    {
                        name: brand?.name || 'Brand',
                        industry: brand?.industry,
                        competitors: brand?.competitors // Assuming brand object has this, if not we'll need to fetch or defaulting in the service
                    },
                    rec.action,
                    contentType
                );

                console.log('🔌 [StrategyService] Strategic Angle Generated & Injected:', JSON.stringify(strategicAngle, null, 2));

            } catch (e) {
                console.warn('⚠️ [StrategyService] Strategy Planner failed, proceeding with defaults', e);
                strategicAngle = {
                    targetAudience: 'General Audience',
                    primaryPainPoint: 'Unspecified',
                    theHook: 'Standard Industry Perspective'
                };
            }

            // 3. Build strategy enrichment prompt
            const prompt = this.buildStrategyPrompt({
                recommendation: rec,
                brand: brand || { name: 'Brand' },
                templateSections,
                contentType,
                customInstructions,
                strategicAngle // Pass the angle to the prompt builder
            });

            console.log(`🧠 [StrategyService] Generating strategy for ${recommendationId} (${contentType})`);
            console.log('📋 [StrategyService] Full Prompt Preview (First 500 chars):', prompt.substring(0, 500));

            // 4. Call LLM for strategy enrichment
            const response = await openRouterCollectorService.executeQuery({
                collectorType: 'content',
                prompt,
                maxTokens: 6000, // Reasoning alone takes 3000+, increased to 6000
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

            if (strategyPlan && strategicAngle) {
                // Attach the strategic angle to the plan object if your interface supports it
                // For now, we'll embed it into the "strategicGuidance" field as a summary
                strategyPlan.strategicGuidance = {
                    keyFocus: strategicAngle.theHook,
                    aeoTargets: [strategicAngle.targetAudience],
                    toneGuidelines: `Address pain point: ${strategicAngle.primaryPainPoint}`,
                    differentiation: strategicAngle.competitorCounterStrike || ''
                };
            }

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
     * Build the LLM prompt for strategy enrichment
     */
    private buildStrategyPrompt({
        recommendation,
        brand,
        templateSections,
        contentType,
        customInstructions,
        strategicAngle
    }: any): string {
        const templatesJson = JSON.stringify(templateSections, null, 2);

        // Incorporate the strategic angle into the prompt context
        const angleContext = strategicAngle ? `
**STRATEGIC DIRECTION (CRITICAL):**
- **Target Audience:** ${strategicAngle.targetAudience}
- **Primary Pain Point:** ${strategicAngle.primaryPainPoint}
- **The Hook (Unique Angle):** ${strategicAngle.theHook}
${strategicAngle.competitorCounterStrike ? `- **Competitor Counter-Strike:** ${strategicAngle.competitorCounterStrike}` : ''}
` : '';

        return `You are a World-Class Content Strategist for ${brand.name}.
Your goal is to plan a high-performance piece of content about: "${recommendation.action}".

**Context:**
- Brand: ${brand.name}${brand.industry ? ` (${brand.industry})` : ''}
- Channel: ${recommendation.channel}
- Content Type: ${contentType}
${angleContext}

**Your Task:**
Rewrite the provided content structure to align with the **STRATEGIC DIRECTION** above. 
You are NOT just copying the template. You are customizing every instruction to hit the specific Audience and Hook defined above.

1. **Update "title":** Make it specific to the ${strategicAngle?.targetAudience || 'audience'} and promise to solve the "${strategicAngle?.primaryPainPoint || 'pain point'}".
2. **Update "content":** Replace the generic instructions with specific guidance that forces the writer to address the **Competitor Counter-Strike** and **Hook**. 
   - *Example:* Instead of "Explain X", say "Explain X by contrasting it with [Competitor]'s failure to do Y."

**Task 3: Generate Research Queries (CRITICAL)**
You must generate exactly 3 web search queries to retrieve real-time facts.
RULES:
1. Keep queries SHORT (5-12 words).
2. Each query must serve a DIFFERENT purpose:
   - Query 1 (Topic Authority): Recent data, stats, benchmarks for "${recommendation.action}" (include 2026).
   - Query 2 (Brand Evidence): Facts about ${brand.name} related to this topic (case studies, prices, features).
   - Query 3 (Competitive Landscape): Comparisons or market context.

**Input Template:**
${templatesJson}

**Output Requirements:**
- Return ONLY valid JSON.
- Return a JSON object with two keys:
  1. "structure": Array of section objects (same as input)
  2. "research_queries": Array of exactly 3 strings based on the rules above.
- Do NOT return a top-level Array.
- Use \\n for line breaks.

**Example Output Format:**
{
  "structure": [
    {
      "id": "section_id",
      "title": "Specific Title...",
      "content": "Detailed instruction...",
      "sectionType": "original_type"
    }
  ],
  "research_queries": [
    "AI translation ROI enterprise statistics 2026",
    "${brand.name} enterprise features case studies",
    "${brand.name} vs competitors enterprise comparison"
  ]
}
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
            // Updated to look for JSON object OR array (legacy fallback)
            const jsonMatch = llmResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.error('❌ No JSON found in LLM response');
                console.error('LLM Response:', llmResponse.substring(0, 500));
                return null;
            }

            const jsonString = jsonMatch[0];
            console.log(`📝 Parsing JSON (Start: ${jsonString.substring(0, 50)}...)`);

            let parsed: any;
            try {
                parsed = JSON.parse(jsonString);
            } catch (parseError: any) {
                console.warn('⚠️ Standard JSON parse failed, attempting to sanitize...', parseError.message);

                try {
                    // 1. Remove non-printable control characters (except common whitespace) GLOBALLY
                    // eslint-disable-next-line no-control-regex
                    let sanitized = jsonString.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');

                    // 2. Escape unescaped newlines/tabs ONLY within double quotes
                    // Regex to match string literals: "..."
                    sanitized = sanitized.replace(/"((?:[^"\\]|\\.)*)"/g, (match, content) => {
                        // Replace unescaped newlines with \n, tabs with \t within the string content
                        const newContent = content
                            .replace(/(?<!\\)\n/g, '\\n')
                            .replace(/(?<!\\)\t/g, '\\t')
                            .replace(/(?<!\\)\r/g, '\\r');
                        return `"${newContent}"`;
                    });

                    parsed = JSON.parse(sanitized);
                    console.log('✅ Sanitized JSON parsed successfully');
                } catch (retryError: any) {
                    console.error('❌ Sanitized JSON parse also failed:', retryError.message);
                    console.error('Problematic JSON snippet:', jsonString.substring(1600, 1800)); // Around the reported error index
                    return null;
                }
            }

            let enrichedSections: StructureSection[] = [];
            let researchQueries: string[] = [];

            if (Array.isArray(parsed)) {
                // Legacy format (just the sections array)
                enrichedSections = parsed;
            } else if (parsed.structure && Array.isArray(parsed.structure)) {
                // New format (object with structure + research_queries)
                enrichedSections = parsed.structure;
                researchQueries = parsed.research_queries || [];
            } else {
                console.error('❌ Invalid JSON structure (neither array nor object with structure)');
                return null;
            }

            console.log(`✅ Parsed ${enrichedSections.length} enriched sections and ${researchQueries.length} research queries`);

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
                researchQueries: researchQueries.length > 0 ? researchQueries : undefined,
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

            console.log(`✅ [StrategyService] Added context file: ${file.name}`);
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

            console.log(`✅ [StrategyService] Removed context file ${fileId} from recommendation ${recommendationId}`);
            return { success: true };
        } catch (error: any) {
            console.error('❌ [StrategyService] Error removing context file:', error);
            return { success: false, error: error.message || 'Unexpected error removing context file' };
        }
    }
}

export const strategyGenerationService = new StrategyGenerationService();
