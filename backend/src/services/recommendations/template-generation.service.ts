/**
 * Template Generation Service (Step 1 of 2-Step Workflow)
 * 
 * Generates the "TemplatePlan" JSON which acts as the architectural blueprint
 * for the final content. This step focuses on AEO structure, headings, and rules,
 * WITHOUT generating the actual prose.
 */

import { supabaseAdmin } from '../../config/database';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';
import { RecommendationV3, TemplatePlan, BrandContextV3, ContextFile } from './recommendation.types';
const pdf = require('pdf-parse');

interface ServiceResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface GenerateTemplateRequest {
    recommendationId: string;
    customerId: string;
    channel?: string; // e.g. 'article_site', 'youtube', 'linkedin'
    customInstructions?: string;
    force?: boolean;
}

export interface GenerateTemplateResponse {
    success: boolean;
    data?: TemplatePlan;
    error?: string;
}

class TemplateGenerationService {

    /**
     * Generates a TemplatePlan for a specific recommendation
     */
    async generateTemplatePlan(request: GenerateTemplateRequest): Promise<GenerateTemplateResponse> {
        const { recommendationId, customerId, channel = 'article_site', customInstructions } = request;

        try {
            // 1. Fetch Context
            const { data: rec, error: recError } = await supabaseAdmin
                .from('recommendations')
                .select('*')
                .eq('id', recommendationId)
                .eq('customer_id', customerId)
                .single();

            if (recError || !rec) {
                return { success: false, error: 'Recommendation not found' };
            }

            // 1b. Check for Existing Plan (unless forced)
            if (!request.force) {
                const { data: existingPlan } = await supabaseAdmin
                    .from('recommendation_generated_contents')
                    .select('content')
                    .eq('recommendation_id', recommendationId)
                    .eq('content_type', 'template_plan')
                    .maybeSingle();

                if (existingPlan && existingPlan.content) {
                    try {
                        const parsed = JSON.parse(existingPlan.content);
                        if (parsed && parsed.structure) {
                            // Ensure recommendationId is set
                            parsed.recommendationId = recommendationId;
                            console.log(`♻️ [TemplateService] Returning Existing Plan for ${rec.id}`);
                            console.log(`📋 [TemplateService] Cached plan has: targetChannel=${parsed.targetChannel}, primary_entity=${parsed.primary_entity}, aeo_extraction_targets=${!!parsed.aeo_extraction_targets}`);
                            return { success: true, data: parsed };
                        }
                    } catch (e) {
                        console.warn('⚠️ [TemplateService] Failed to parse existing plan, regenerating.');
                    }
                }
            }

            const { data: brand } = await supabaseAdmin
                .from('brands')
                .select('*')
                .eq('id', rec.brand_id)
                .single();

            // 2. Select Base Skeleton (Hardcoded for MVP reliability, can be dynamic later)
            // Use snake_case from DB result
            const skeleton = this.getBaseSkeleton(channel, rec.action, brand?.name || 'Brand', rec.asset_type);

            // 3. Build Prompt
            const prompt = this.buildPlannerPrompt(rec, brand, skeleton, channel, customInstructions);

            // 4. Call LLM (GPT-OSS-20B via OpenRouter)
            console.log(`🏗️ [TemplateService] Generating Plan for ${rec.id} (${channel})`);
            const response = await openRouterCollectorService.executeQuery({
                collectorType: 'content',
                prompt: prompt,
                maxTokens: 1500, // Plans are smaller than full content
                temperature: 0.4, // Lower temperature for structural adherence
                model: 'meta-llama/llama-3.3-70b-instruct' // Using a reliable OSS model
            });

            if (!response.response) {
                return { success: false, error: 'LLM returned empty response' };
            }

            // 5. Parse & Validate
            const plan = this.parseAndValidatePlan(response.response);
            if (!plan) {
                return { success: false, error: 'Failed to parse generated plan' };
            }

            // 5b. Ensure recommendationId is set on the plan
            plan.recommendationId = recommendationId;

            console.log(`✨ [TemplateService] Generated NEW plan for ${rec.id}`);
            console.log(`📋 [TemplateService] New plan has: targetChannel=${plan.targetChannel}, primary_entity=${plan.primary_entity}, aeo_extraction_targets=${!!plan.aeo_extraction_targets}`);

            // 6. Save as "Draft" Content (so it persists)
            // We store it as a special content_type 'template_plan' in the same table
            await this.savePlanToDb(recommendationId, customerId, plan);

            return { success: true, data: plan };

        } catch (error: any) {
            console.error('❌ [TemplateService] Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update an existing template plan
     */
    async updateTemplatePlan(
        recommendationId: string,
        customerId: string,
        updatedPlan: TemplatePlan
    ): Promise<ServiceResponse<TemplatePlan>> {
        try {
            // Validate the plan structure
            if (!updatedPlan.structure || !Array.isArray(updatedPlan.structure)) {
                return { success: false, error: 'Invalid plan structure' };
            }

            // Ensure recommendationId is set
            updatedPlan.recommendationId = recommendationId;

            console.log(`💾 [TemplateService] Updating plan for ${recommendationId}`);

            // Save to database
            await this.savePlanToDb(recommendationId, customerId, updatedPlan);

            return { success: true, data: updatedPlan };
        } catch (error: any) {
            console.error('❌ [TemplateService] Error updating plan:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Parse uploaded context file (PDF/Text)
     */
    async parseContextFile(buffer: Buffer, mimetype: string): Promise<string> {
        try {
            console.log(`📂 [TemplateService] Parsing file with mime: ${mimetype}`);

            if (mimetype === 'application/pdf') {
                const result = await pdf(buffer);
                return result.text;
            } else if (mimetype === 'text/plain' || mimetype === 'text/markdown' || mimetype === 'application/json') {
                return buffer.toString('utf-8');
            } else {
                // Try as text for other types
                return buffer.toString('utf-8');
            }
        } catch (error: any) {
            console.error('❌ [TemplateService] Error parsing context file:', error);
            throw new Error(`Failed to parse file: ${error.message}`);
        }
    }

    /**
     * Update the additional_context field (Quick Notes) of an existing plan
     */
    async updatePlanContext(
        recommendationId: string,
        customerId: string,
        contextText: string
    ): Promise<ServiceResponse<TemplatePlan>> {
        try {
            // Fetch existing plan
            const { data: existingPlan } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('content')
                .eq('recommendation_id', recommendationId)
                .eq('content_type', 'template_plan')
                .maybeSingle();

            if (!existingPlan || !existingPlan.content) {
                return { success: false, error: 'No existing plan found for this recommendation' };
            }

            // Parse and update
            const plan: TemplatePlan = JSON.parse(existingPlan.content);
            plan.additional_context = contextText;

            // Save back to DB
            await this.savePlanToDb(recommendationId, customerId, plan);

            console.log(`✅ [TemplateService] Updated quick notes for ${recommendationId} (${contextText.length} chars)`);
            return { success: true, data: plan };
        } catch (error: any) {
            console.error('❌ [TemplateService] Error updating plan context:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add a parsed file to the plan's context_files array
     */
    async addContextFile(
        recommendationId: string,
        customerId: string,
        file: { buffer: Buffer; originalName: string; mimeType: string; size: number }
    ): Promise<ServiceResponse<TemplatePlan>> {
        try {
            // 1. Parse content
            const extractedText = await this.parseContextFile(file.buffer, file.mimeType);

            // 2. Create ContextFile object
            const newFile: ContextFile = {
                id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: file.originalName,
                type: file.mimeType,
                size: file.size,
                content: extractedText,
                uploadedAt: new Date().toISOString()
            };

            // 3. Fetch existing plan
            const { data: existingPlan } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('content')
                .eq('recommendation_id', recommendationId)
                .eq('content_type', 'template_plan')
                .maybeSingle();

            if (!existingPlan || !existingPlan.content) {
                return { success: false, error: 'No existing plan found for this recommendation' };
            }

            const plan: TemplatePlan = JSON.parse(existingPlan.content);

            // 4. Append to context_files
            if (!plan.context_files) {
                plan.context_files = [];
            }
            plan.context_files.push(newFile);

            // 5. Save back to DB
            await this.savePlanToDb(recommendationId, customerId, plan);

            console.log(`✅ [TemplateService] Added context file ${newFile.name} to ${recommendationId}`);
            return { success: true, data: plan };

        } catch (error: any) {
            console.error('❌ [TemplateService] Error adding context file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove a context file from the plan
     */
    async removeContextFile(
        recommendationId: string,
        customerId: string,
        fileId: string
    ): Promise<ServiceResponse<TemplatePlan>> {
        try {
            // 1. Fetch existing plan
            const { data: existingPlan } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('content')
                .eq('recommendation_id', recommendationId)
                .eq('content_type', 'template_plan')
                .maybeSingle();

            if (!existingPlan || !existingPlan.content) {
                return { success: false, error: 'No existing plan found for this recommendation' };
            }

            const plan: TemplatePlan = JSON.parse(existingPlan.content);

            // 2. Remove file
            if (plan.context_files) {
                const initialLength = plan.context_files.length;
                plan.context_files = plan.context_files.filter(f => f.id !== fileId);

                if (plan.context_files.length === initialLength) {
                    return { success: false, error: 'File not found in context' };
                }
            } else {
                return { success: false, error: 'No context files to remove' };
            }

            // 3. Save back to DB
            await this.savePlanToDb(recommendationId, customerId, plan);

            console.log(`✅ [TemplateService] Removed context file ${fileId} from ${recommendationId}`);
            return { success: true, data: plan };

        } catch (error: any) {
            console.error('❌ [TemplateService] Error removing context file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Persist the plan to the DB
     */
    private async savePlanToDb(recId: string, customerId: string, plan: TemplatePlan) {
        // Check for existing plan
        const { data: existing } = await supabaseAdmin
            .from('recommendation_generated_contents')
            .select('id')
            .eq('recommendation_id', recId)
            .eq('content_type', 'template_plan')
            .maybeSingle();

        const payload = {
            recommendation_id: recId,
            customer_id: customerId,
            brand_id: plan.recommendationId ? undefined : undefined, // We need brand_id from somewhere if strictly required, but usually Rec has it. 
            // Actually, we should fetch brand_id from rec above or easier: just ensure table constraint allows it.
            // For now, let's trust the service has access to the record if needed, but here we just follow schema.
            content_type: 'template_plan',
            content: JSON.stringify(plan, null, 2),
            status: 'generated',
            model_provider: 'openrouter',
            model_name: 'llama-3.3-70b-instruct',
            metadata: { is_plan: true, version: '1.0' },
            updated_at: new Date().toISOString()
        };

        // We need to fetch the brand_id and generation_id correctly to insert.
        // Re-fetching strictly for the insert payload if needed, or assume update.
        // To be safe, let's do an upsert logic based on what we know.
        // Getting generation_id from the recommendation is vital.

        // Quick fetch to ensure we have all FKs
        const { data: rec } = await supabaseAdmin.from('recommendations').select('brand_id, generation_id').eq('id', recId).single();

        if (rec) {
            const fullPayload = {
                ...payload,
                brand_id: rec.brand_id,
                generation_id: rec.generation_id,
                created_at: existing ? undefined : new Date().toISOString()
            };

            if (existing) {
                await supabaseAdmin.from('recommendation_generated_contents').update(fullPayload).eq('id', existing.id);
            } else {
                await supabaseAdmin.from('recommendation_generated_contents').insert(fullPayload);
            }
        }
    }

    private extractTopicFromAction(action: string): string {
        // Extract the main topic/keyword from the action
        // Example: "[Expert Community Response] Post an Expert Community Response on Reddit..." -> "Space-Saving Kitchen Designs"

        // Try to extract from title/quoted text first
        const titleMatch = action.match(/titled\s+["']([^"']+)["']/i) || action.match(/["']([^"']+)["']/);
        if (titleMatch && titleMatch[1]) {
            return titleMatch[1].replace(/\s*–.*$/, '').trim(); // Remove subtitle after dash
        }

        // Fallback: remove bracketed prefixes and take first meaningful phrase
        const cleaned = action.replace(/^\[.*?\]\s*/, '').replace(/^(Post|Create|Write|Publish)\s+(an?\s+)?/i, '');
        const firstSentence = cleaned.split(/[.;]|\son\s/i)[0].trim();
        return firstSentence.substring(0, 80); // Limit length
    }

    private getBaseSkeleton(channel: string, action: string, brandName: string, assetType?: string): any {
        const topic = this.extractTopicFromAction(action);
        const actionLower = action.toLowerCase();

        // 1. YouTube / Video
        if (assetType === 'video' || channel.includes('youtube')) {
            return {
                version: '1.0',
                recommendationId: '',
                targetChannel: channel,
                content_type: 'video',
                primary_entity: topic,
                action_description: action,
                aeo_extraction_targets: {
                    snippet: { required: true, instruction: 'Video description snippet' },
                    list: { required: false, instruction: '' },
                    table: { required: false, instruction: '' }
                },
                structure: [
                    { id: 'intro', type: 'section', text_template: 'Video Intro: Hook & Promise', instructions: ['Start with a visual hook', 'State the problem clearly'] },
                    { id: 'step1', type: 'section', text_template: 'Step 1: The Setup', instructions: ['Explain the first step'] },
                    { id: 'cta', type: 'cta', text_template: 'Call to Action', instructions: ['Ask to subscribe'] }
                ],
                embedded_placeholders: {
                    fact_pack_slot: true,
                    sources_slot: true,
                    voice_rules_slot: true,
                    banned_claims_slot: true
                }
            };
        }

        // 2. Expert Community Response (Reddit, Quora, Forums)
        if (assetType === 'expert_community_response' || actionLower.includes('expert community response') || actionLower.includes('reddit') || actionLower.includes('quora')) {
            return {
                version: '1.0',
                recommendationId: '',
                targetChannel: channel,
                content_type: 'expert_community_response',
                primary_entity: topic,
                action_description: action,
                aeo_extraction_targets: {
                    snippet: { required: true, instruction: 'Target specific question snippet' },
                    list: { required: false, instruction: '' },
                    table: { required: false, instruction: '' }
                },
                structure: [
                    { id: 'intro', type: 'section', text_template: 'Hook & Empathy', instructions: ['Acknowledge the user\'s pain point', 'State personal experience ("I\'ve faced this too...")', 'No marketing fluff initially'] },
                    { id: 'answer', type: 'section', text_template: 'The Core Solution', instructions: ['Direct, actionable advice', 'Solve the problem immediately'] },
                    { id: 'evidence', type: 'section', text_template: 'Why this works (Evidence)', instructions: ['Share specific results or logic', `Mention how ${brandName} approaches this (subtly)`] },
                    { id: 'engagement', type: 'cta', text_template: 'Closing Question', instructions: ['Ask an open-ended question to drive comments', 'Do NOT use a hard sales pitch'] }
                ],
                embedded_placeholders: {
                    fact_pack_slot: true,
                    sources_slot: true,
                    voice_rules_slot: true,
                    banned_claims_slot: true
                }
            };
        }

        // 3. Comprehensive Guide / How-to
        if (assetType === 'guide' || actionLower.includes('guide') || actionLower.includes('how to') || actionLower.includes('tutorial')) {
            return {
                version: '1.0',
                recommendationId: '',
                targetChannel: channel,
                content_type: 'guide',
                primary_entity: topic,
                action_description: action,
                aeo_extraction_targets: {
                    snippet: { required: true, instruction: 'Definitive step-by-step list' },
                    list: { required: true, instruction: 'Step-by-step process' },
                    table: { required: false, instruction: '' }
                },
                structure: [
                    { id: 'h1', type: 'heading', heading_level: 1, text_template: `The Ultimate Guide to {TOPIC}`, instructions: [`Include ${brandName}`, 'Focus on "Ultimate" or "Complete"'] },
                    { id: 'intro', type: 'section', text_template: 'Introduction', instructions: ['Who is this for?', 'What will you learn?', 'Time estimate'] },
                    { id: 'prerequisites', type: 'section', text_template: 'Prerequisites & Tools', instructions: ['List everything needed before starting'] },
                    { id: 'steps', type: 'heading', heading_level: 2, text_template: 'Step-by-Step Instructions', instructions: ['Break down the core methodology'] },
                    { id: 'troubleshooting', type: 'faq', text_template: 'Common Pitfalls', instructions: ['Address 3 common mistakes'] },
                    { id: 'conclusion', type: 'cta', text_template: 'Summary & Next Steps', instructions: ['Recap key learnings', `CTA for ${brandName}`] }
                ],
                embedded_placeholders: {
                    fact_pack_slot: true,
                    sources_slot: true,
                    voice_rules_slot: true,
                    banned_claims_slot: true
                }
            };
        }

        // 4. Comparison / Buying Guide
        if (assetType === 'comparison' || actionLower.includes('vs') || actionLower.includes('best') || actionLower.includes('comparison') || actionLower.includes('review')) {
            return {
                version: '1.0',
                recommendationId: '',
                targetChannel: channel,
                content_type: 'comparison',
                primary_entity: topic,
                action_description: action,
                aeo_extraction_targets: {
                    snippet: { required: true, instruction: 'Winner declaration' },
                    list: { required: true, instruction: 'Top 5 list' },
                    table: { required: true, instruction: 'Feature comparison table' }
                },
                structure: [
                    { id: 'h1', type: 'heading', heading_level: 1, text_template: `{TOPIC}: Top Picks for 2026`, instructions: [`Include ${brandName} if applicable`, 'Must mention 2026'] },
                    { id: 'intro', type: 'section', text_template: 'Why this matters', instructions: ['Explain the category importance', 'Who needs this?'] },
                    { id: 'criteria', type: 'section', text_template: 'Evaluation Criteria', instructions: ['How we judged (Price, Features, Support)'] },
                    { id: 'top_pick', type: 'heading', heading_level: 2, text_template: 'Start with the Winner', instructions: ['Direct recommendation'] },
                    { id: 'comparison_table', type: 'section', text_template: 'Comparison Matrix', instructions: ['Create a comparison table or list'] },
                    { id: 'verdict', type: 'section', text_template: 'Final Verdict', instructions: ['Summary decision matrix'] }
                ],
                embedded_placeholders: {
                    fact_pack_slot: true,
                    sources_slot: true,
                    voice_rules_slot: true,
                    banned_claims_slot: true
                }
            };
        }

        // 5. Default Article / Blog Post
        let contentType = 'article';
        if (actionLower.includes('blog')) contentType = 'blog_post';

        return {
            version: '1.0',
            recommendationId: '',
            targetChannel: channel,
            content_type: contentType,
            primary_entity: topic,
            action_description: action,
            aeo_extraction_targets: {
                snippet: { required: true, instruction: 'Optimize for direct answer box' },
                list: { required: false, instruction: '' },
                table: { required: false, instruction: '' }
            },
            structure: [
                { id: 'h1', type: 'heading', heading_level: 1, text_template: `How to {ACTION_TOPIC} in 2026`, instructions: [`Include ${brandName}`, 'Must mention 2026'] },
                { id: 'answer', type: 'heading', heading_level: 2, text_template: 'Direct Answer', instructions: ['40-60 words bold answer', 'Start with entity name', 'Define the core concept immediately'] },
                { id: 'benefits', type: 'heading', heading_level: 2, text_template: 'Key Benefits', instructions: ['List 3 key benefits', 'Focus on value'] },
                { id: 'how_to', type: 'heading', heading_level: 2, text_template: 'Actionable Steps', instructions: ['Provide practical advice'] },
                { id: 'faq', type: 'faq', text_template: 'People Also Ask', instructions: ['Generate 3 PAA questions based on the topic'] }
            ],
            embedded_placeholders: {
                fact_pack_slot: true,
                sources_slot: true,
                voice_rules_slot: true,
                banned_claims_slot: true
            }
        };
    }

    private buildPlannerPrompt(rec: RecommendationV3, brand: any, skeleton: any, channel: string, customInstructions?: string): string {
        return `You are the Content Architect for ${brand.name}.
    
    TASK: Flesh out this Content Plan.
    1.  Use the provided Skeleton as a base - KEEP ALL FIELDS (version, targetChannel, primary_entity, aeo_extraction_targets, structure).
    2.  Rewrite 'text_template' (Headings) in the structure array to be specific to: "${rec.action}" and KPI: "${rec.kpi}".
    3.  Add specific 'instructions' for the writer based on the Brand Summary: "${brand?.summary || 'Standard brand profile'}".
    4.  Ensure H1 includes "2026".
    5.  ${customInstructions ? `USER INSTRUCTIONS: ${customInstructions}` : ''}

    SKELETON (JSON):
    ${JSON.stringify(skeleton, null, 2)}

    OUTPUT: Return ONLY valid JSON matching the 'TemplatePlan' interface. You MUST include ALL fields from the skeleton (version, targetChannel, primary_entity, aeo_extraction_targets, structure). Do NOT omit any top-level fields.`;
    }

    private parseAndValidatePlan(text: string): TemplatePlan | null {
        try {
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            console.log(`🔍 [TemplateService] Raw LLM response (first 500 chars): ${text.substring(0, 500)}`);
            const json = JSON.parse(cleaned);
            console.log(`🔍 [TemplateService] Parsed JSON keys: ${Object.keys(json).join(', ')}`);
            console.log(`🔍 [TemplateService] Has targetChannel: ${!!json.targetChannel}, Has primary_entity: ${!!json.primary_entity}, Has aeo_extraction_targets: ${!!json.aeo_extraction_targets}`);
            // Basic schema check
            if (!json.structure || !Array.isArray(json.structure)) return null;
            return json;
        } catch (e) {
            console.error(`❌ [TemplateService] Failed to parse plan:`, e);
            return null;
        }
    }
}

export const templateGenerationService = new TemplateGenerationService();
