/**
 * Regenerate Content Service
 * 
 * Handles content regeneration based on user feedback.
 * Uses OpenRouter GPT-OSS-20b model for fast regeneration.
 * Enforces one-time regeneration limit per recommendation.
 */

import { supabaseAdmin } from '../../config/database';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';

export interface RegenerateContentRequest {
    feedback: string;
}

export interface RegenerateContentResponse {
    success: boolean;
    data?: {
        content: any;
        regenRetry: number;
    };
    error?: string;
}

class RegenerateContentService {
    /**
     * Regenerate content for a recommendation based on user feedback
     */
    async regenerateContent(
        recommendationId: string,
        customerId: string,
        feedback: string
    ): Promise<RegenerateContentResponse> {
        try {
            // 1. Fetch recommendation and validate ownership
            const { data: rec, error: recError } = await supabaseAdmin
                .from('recommendations')
                .select('*')
                .eq('id', recommendationId)
                .eq('customer_id', customerId)
                .single();

            if (recError || !rec) {
                return {
                    success: false,
                    error: 'Recommendation not found or unauthorized'
                };
            }

            // 2. Check regeneration limit
            const currentRetry = rec.regen_retry || 0;
            if (currentRetry >= 1) {
                return {
                    success: false,
                    error: 'Content has already been regenerated. Only one regeneration per recommendation is allowed.'
                };
            }

            // 3. Fetch existing generated content
            const { data: existingContent, error: contentError } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('*')
                .eq('recommendation_id', recommendationId)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (contentError || !existingContent) {
                return {
                    success: false,
                    error: 'No existing content found to regenerate'
                };
            }

            // 4. Fetch brand context
            const { data: brand } = await supabaseAdmin
                .from('brands')
                .select('id, name, industry, summary')
                .eq('id', rec.brand_id)
                .eq('customer_id', customerId)
                .single();

            // 5. Build regeneration prompt
            const projectContext = `You are generating content for AnswerIntel (Evidently): a platform that helps brands improve their visibility in AI answers.
We track brand performance across AI models (visibility, Share of Answers, sentiment) and citation sources.
Your content should help the customer's brand improve the targeted KPI by executing the recommendation.`;

            const recommendationContext = `Brand
- Name: ${brand?.name || 'Unknown'}
- Industry: ${brand?.industry || 'Unknown'}
- Summary: ${brand?.summary || 'N/A'}

Recommendation
- Action: ${rec.action}
- KPI: ${rec.kpi}
- Focus area: ${rec.focus_area}
- Priority: ${rec.priority}
- Effort: ${rec.effort}
- Timeline: ${rec.timeline}
- Expected boost: ${rec.expected_boost || 'TBD'}

Evidence & metrics
- Citation source: ${rec.citation_source}
- Impact score: ${rec.impact_score}
- Mention rate: ${rec.mention_rate}
- Visibility: ${rec.visibility_score}
- SOA: ${rec.soa}
- Sentiment: ${rec.sentiment}
- Citations: ${rec.citation_count}

Focus
- Focus sources: ${rec.focus_sources}
- Content focus: ${rec.content_focus}

Reason
${rec.reason}

Explanation
${rec.explanation}`;

            // Parse existing content
            let existingContentParsed: any;
            try {
                existingContentParsed = typeof existingContent.content === 'string'
                    ? JSON.parse(existingContent.content)
                    : existingContent.content;
            } catch {
                existingContentParsed = existingContent.content;
            }

            const existingContentStr = typeof existingContentParsed === 'object'
                ? JSON.stringify(existingContentParsed, null, 2)
                : String(existingContentParsed);

            const regenerationPrompt = `${projectContext}

${recommendationContext}

TASK: Regenerate the content based on specific user feedback.

EXISTING CONTENT:
${existingContentStr}

USER FEEDBACK:
${feedback}

INSTRUCTIONS:
- Keep the same JSON structure and format as the existing content
- Apply the user's feedback to improve the content
- Maintain the same version, recommendationId, brandName, and targetSource fields
- Focus on addressing the specific feedback provided
- Do NOT invent new facts, customer names, or metrics
- Return ONLY valid JSON, no markdown code blocks, no explanations
- Escape newlines as \\n in JSON strings

Return the complete regenerated JSON object:`;

            // 6. Call OpenRouter with GPT-OSS-20b (fastest model)
            console.log(`🔄 [RegenerateContentService] Regenerating content for ${recommendationId}...`);

            const orResponse = await openRouterCollectorService.executeQuery({
                collectorType: 'content',
                prompt: regenerationPrompt,
                maxTokens: 2600,
                temperature: 0.5,
                topP: 0.9,
                enableWebSearch: false,
                model: 'openai/gpt-oss-20b' // Fast and cost-effective for regeneration
            });

            let regeneratedContent = orResponse.response;

            // 7. Parse and clean the response
            if (!regeneratedContent) {
                return {
                    success: false,
                    error: 'Failed to regenerate content - empty response from LLM'
                };
            }

            // Remove markdown code blocks if present
            if (regeneratedContent.includes('```json')) {
                regeneratedContent = regeneratedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            } else if (regeneratedContent.includes('```')) {
                regeneratedContent = regeneratedContent.replace(/```\s*/g, '');
            }

            // Extract JSON object if wrapped in other text
            const jsonMatch = regeneratedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                regeneratedContent = jsonMatch[0];
            }

            // Validate JSON
            let parsedRegenContent: any;
            try {
                parsedRegenContent = JSON.parse(regeneratedContent);
            } catch (parseError) {
                console.error('❌ [RegenerateContentService] Failed to parse regenerated content:', parseError);
                return {
                    success: false,
                    error: 'Failed to parse regenerated content - invalid JSON'
                };
            }

            // 8. Update the content in database
            const now = new Date().toISOString();

            const { data: updatedContent, error: updateError } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .update({
                    content: JSON.stringify(parsedRegenContent, null, 2),
                    updated_at: now,
                    metadata: {
                        ...existingContent.metadata,
                        regenerated: true,
                        regeneration_feedback: feedback,
                        regenerated_at: now
                    }
                })
                .eq('id', existingContent.id)
                .select('*')
                .single();

            if (updateError) {
                console.error('❌ [RegenerateContentService] Failed to update content:', updateError);
                return {
                    success: false,
                    error: 'Failed to save regenerated content'
                };
            }

            // 9. Increment regen_retry counter
            const { error: retryUpdateError } = await supabaseAdmin
                .from('recommendations')
                .update({
                    regen_retry: currentRetry + 1,
                    updated_at: now
                })
                .eq('id', recommendationId)
                .eq('customer_id', customerId);

            if (retryUpdateError) {
                console.error('❌ [RegenerateContentService] Failed to update regen_retry:', retryUpdateError);
                // Don't fail the request, content was already updated
            }

            console.log(`✅ [RegenerateContentService] Successfully regenerated content for ${recommendationId}`);

            return {
                success: true,
                data: {
                    content: parsedRegenContent,
                    regenRetry: currentRetry + 1
                }
            };

        } catch (error: any) {
            console.error('❌ [RegenerateContentService] Unexpected error:', error);
            return {
                success: false,
                error: error.message || 'An unexpected error occurred'
            };
        }
    }
}

export const regenerateContentService = new RegenerateContentService();
