/**
 * Executive Summary Generation Service
 * 
 * Generates executive summaries using rule-based triggers + LLM supplementation.
 * Uses OpenRouter with GPT-OSS-20b model (same as content generation).
 */

import axios from 'axios';
import type {
    ExecutiveSummaryInput,
    SummaryFact,
    BrandPerformanceData,
    ReportDataSnapshot,
} from './types';

export class ExecutiveSummaryService {
    private openRouterApiKey = process.env['OPENROUTER_API_KEY'];
    private openRouterModel = 'openai/gpt-oss-20b'; // As confirmed by user
    private maxTokens = 1000; // User-specified limit

    /**
     * Generate executive summary from report data
     */
    async generateExecutiveSummary(reportData: ReportDataSnapshot, userFeedback?: string): Promise<string> {
        console.log('📝 [EXEC-SUMMARY] Generating executive summary');

        // Step 1: Detect rule-based triggers
        const summaryFacts = this.detectRuleBasedTriggers(reportData);
        console.log(`📝 [EXEC-SUMMARY] Detected ${summaryFacts.length} summary facts`);

        // Step 2: Prepare input for LLM
        const summaryInput: ExecutiveSummaryInput = {
            current_metrics: reportData.brand_performance.current,
            previous_metrics: reportData.brand_performance.previous,
            deltas: reportData.brand_performance.deltas,
            summary_facts: summaryFacts,
            top_movers: {
                biggest_gain: reportData.top_movers.queries.gains[0] || this.getEmptyTopMover(),
                biggest_loss: reportData.top_movers.queries.losses[0] || this.getEmptyTopMover(),
            },
            competitive_threats: this.identifyCompetitiveThreats(reportData.competitive_landscape),
            traffic_impact: reportData.traffic_attribution ? {
                sessions_change: reportData.traffic_attribution.deltas.sessions.percentage,
                conversions_change: reportData.traffic_attribution.deltas.conversions.percentage,
            } : undefined,
            user_feedback: userFeedback,
        };

        // Step 3: Generate summary using LLM
        const summary = await this.generateWithLLM(summaryInput);

        return summary;
    }

    /**
     * Detect rule-based triggers for significant events
     */
    detectRuleBasedTriggers(reportData: ReportDataSnapshot): SummaryFact[] {
        const facts: SummaryFact[] = [];
        const { brand_performance, competitive_landscape, traffic_attribution } = reportData;

        // Rule 1: Visibility change > +15%
        if (brand_performance.deltas.visibility.percentage > 15) {
            facts.push({
                type: 'visibility_gain',
                severity: 'high',
                description: `Significant visibility improvement of ${brand_performance.deltas.visibility.percentage.toFixed(1)}%`,
                metrics: {
                    percentage_change: brand_performance.deltas.visibility.percentage,
                    absolute_change: brand_performance.deltas.visibility.absolute,
                    current_value: brand_performance.current.visibility,
                },
            });
        }

        // Rule 2: Visibility change < -15%
        if (brand_performance.deltas.visibility.percentage < -15) {
            facts.push({
                type: 'visibility_loss',
                severity: 'high',
                description: `Significant visibility decline of ${Math.abs(brand_performance.deltas.visibility.percentage).toFixed(1)}%`,
                metrics: {
                    percentage_change: brand_performance.deltas.visibility.percentage,
                    absolute_change: brand_performance.deltas.visibility.absolute,
                    current_value: brand_performance.current.visibility,
                },
            });
        }

        // Rule 3: Sentiment shift > +0.5
        if (brand_performance.deltas.sentiment.absolute > 0.5) {
            facts.push({
                type: 'sentiment_shift',
                severity: 'medium',
                description: `Material sentiment improvement of +${brand_performance.deltas.sentiment.absolute.toFixed(2)}`,
                metrics: {
                    absolute_change: brand_performance.deltas.sentiment.absolute,
                    current_value: brand_performance.current.sentiment,
                },
            });
        }

        // Rule 4: Sentiment shift < -0.5
        if (brand_performance.deltas.sentiment.absolute < -0.5) {
            facts.push({
                type: 'sentiment_shift',
                severity: 'high',
                description: `Material sentiment deterioration of ${brand_performance.deltas.sentiment.absolute.toFixed(2)}`,
                metrics: {
                    absolute_change: brand_performance.deltas.sentiment.absolute,
                    current_value: brand_performance.current.sentiment,
                },
            });
        }

        // Rule 5: Competitor SOA gain > 10 percentage points
        competitive_landscape.competitors.forEach(competitor => {
            if (competitor.deltas.share_of_answer.absolute > 10) {
                facts.push({
                    type: 'competitive_threat',
                    severity: 'high',
                    description: `${competitor.name} gained ${competitor.deltas.share_of_answer.absolute.toFixed(1)} percentage points in SOA`,
                    metrics: {
                        competitor: competitor.name,
                        soa_gain: competitor.deltas.share_of_answer.absolute,
                        current_soa: competitor.current.share_of_answer,
                    },
                });
            }
        });

        // Rule 6: Large traffic changes (if GA data available)
        if (traffic_attribution) {
            if (traffic_attribution.deltas.sessions.percentage > 20) {
                facts.push({
                    type: 'traffic_change',
                    severity: 'high',
                    description: `AEO traffic increased by ${traffic_attribution.deltas.sessions.percentage.toFixed(1)}%`,
                    metrics: {
                        sessions_change: traffic_attribution.deltas.sessions.percentage,
                        conversions_change: traffic_attribution.deltas.conversions.percentage,
                    },
                });
            } else if (traffic_attribution.deltas.sessions.percentage < -20) {
                facts.push({
                    type: 'traffic_change',
                    severity: 'high',
                    description: `AEO traffic decreased by ${Math.abs(traffic_attribution.deltas.sessions.percentage).toFixed(1)}%`,
                    metrics: {
                        sessions_change: traffic_attribution.deltas.sessions.percentage,
                        conversions_change: traffic_attribution.deltas.conversions.percentage,
                    },
                });
            }
        }

        // Rule 7: Large SOA changes
        if (brand_performance.deltas.share_of_answer.percentage > 15) {
            facts.push({
                type: 'visibility_gain',
                severity: 'high',
                description: `Strong SOA growth of ${brand_performance.deltas.share_of_answer.percentage.toFixed(1)}%`,
                metrics: {
                    percentage_change: brand_performance.deltas.share_of_answer.percentage,
                    current_value: brand_performance.current.share_of_answer,
                },
            });
        } else if (brand_performance.deltas.share_of_answer.percentage < -15) {
            facts.push({
                type: 'visibility_loss',
                severity: 'high',
                description: `Concerning SOA decline of ${Math.abs(brand_performance.deltas.share_of_answer.percentage).toFixed(1)}%`,
                metrics: {
                    percentage_change: brand_performance.deltas.share_of_answer.percentage,
                    current_value: brand_performance.current.share_of_answer,
                },
            });
        }

        // Sort by severity
        return facts.sort((a, b) => {
            const severityOrder = { high: 3, medium: 2, low: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
    }

    /**
     * Generate summary using LLM (OpenRouter GPT-OSS-20b)
     */
    private async generateWithLLM(input: ExecutiveSummaryInput): Promise<string> {
        if (!this.openRouterApiKey) {
            console.warn('⚠️ [EXEC-SUMMARY] OpenRouter API key not configured, using fallback summary');
            return this.generateFallbackSummary(input);
        }

        const prompt = this.buildPrompt(input);

        try {
            console.log('🌐 [EXEC-SUMMARY] Calling OpenRouter for summary generation');

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: this.openRouterModel,
                    messages: [
                        {
                            role: 'system',
                            content: `You are a senior executive reporting assistant. Your goal is to generate high-impact, data-grounded bullet points for C-level executives. 
                            
${input.user_feedback ? 'IMPORTANT: This is a REGENERATION request. You MUST prioritize the user\'s specific feedback and instructions provided below while maintaining the integrity of the data.' : 'Generate a concise summary of the brand\'s AEO performance based on the provided metrics.'}`,
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    max_tokens: this.maxTokens,
                    temperature: 0.3, // Low temperature for consistency
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openRouterApiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': process.env['OPENROUTER_SITE_URL'] || 'https://evidentlyaeo.com',
                        'X-Title': process.env['OPENROUTER_SITE_TITLE'] || 'EvidentlyAEO',
                    },
                }
            );

            const content = response.data?.choices?.[0]?.message?.content;

            if (!content) {
                console.error('❌ [EXEC-SUMMARY] No content in OpenRouter response');
                return this.generateFallbackSummary(input);
            }

            // Parse and validate the LLM response
            const summary = this.parseAndValidateSummary(content);
            return summary;

        } catch (error) {
            console.error('❌ [EXEC-SUMMARY] Error calling OpenRouter:', error);
            return this.generateFallbackSummary(input);
        }
    }

    /**
     * Build LLM prompt
     */
    private buildPrompt(input: ExecutiveSummaryInput): string {
        const summaryFactsText = input.summary_facts
            .map(fact => `- ${fact.description}`)
            .join('\n');

        const competitiveThreatsText = input.competitive_threats
            .map(c => `${c.name}: SOA ${c.current.share_of_answer.toFixed(1)}% (${c.deltas.share_of_answer.absolute > 0 ? '+' : ''}${c.deltas.share_of_answer.absolute.toFixed(1)}%)`)
            .join(', ');

        const basePrompt = `You are generating an executive-level summary for AEO performance.

Input data:
- Current period metrics:
  - Visibility: ${input.current_metrics.visibility.toFixed(1)}%
  - Share of Answer: ${input.current_metrics.share_of_answer.toFixed(1)}%
  - Sentiment: ${input.current_metrics.sentiment.toFixed(2)}
  - Avg Position: ${input.current_metrics.average_position.toFixed(1)}

- Changes vs previous period:
  - Visibility: ${input.deltas.visibility.percentage > 0 ? '+' : ''}${input.deltas.visibility.percentage.toFixed(1)}%
  - Share of Answer: ${input.deltas.share_of_answer.percentage > 0 ? '+' : ''}${input.deltas.share_of_answer.percentage.toFixed(1)}%
  - Sentiment: ${input.deltas.sentiment.absolute > 0 ? '+' : ''}${input.deltas.sentiment.absolute.toFixed(2)}

- Key summary facts:
${summaryFactsText || '(No significant events detected)'}

- Top movers:
  - Biggest gain: ${input.top_movers.biggest_gain.name || 'N/A'}
  - Biggest loss: ${input.top_movers.biggest_loss.name || 'N/A'}

- Competitive landscape:
${competitiveThreatsText || 'No competitor data available'}

${input.traffic_impact ? `- Traffic impact:\n  - Sessions: ${input.traffic_impact.sessions_change > 0 ? '+' : ''}${input.traffic_impact.sessions_change.toFixed(1)}%\n  - Conversions: ${input.traffic_impact.conversions_change > 0 ? '+' : ''}${input.traffic_impact.conversions_change.toFixed(1)}%` : ''}`;

        if (input.user_feedback) {
            return `${basePrompt}

CRITICAL: REGENERATION TASK
The user has provided the following feedback on the current summary:
"${input.user_feedback}"

INSTRUCTIONS FOR REGENERATION:
1. You MUST directly address and incorporate the user's feedback above. This is your HIGHEST priority.
2. If the feedback specifies a tone (e.g., "aggressive", "professional", "concise"), you MUST adopt that tone.
3. If the feedback asks to focus on a specific metric or event, you MUST make that the primary focus.
4. Maintain the 3-5 bullet point format.
5. Each bullet must still be data-grounded and under 25 words.
6. Do NOT mention "the user feedback", "per your request", or "I have updated" in the bullets; just provide the updated summary content directly.

Format as plain bullet points (start each with "-").`;
        }

        return `${basePrompt}

Generate 3-5 bullet points for senior leadership:
- Each bullet must be under 25 words
- Use plain business language (no jargon)
- Every statement must reference specific metrics from the input above
- Do not speculate or add information not present in the data
- Focus on: biggest wins, important risks, competitive threats, strategic focus

Format as plain bullet points (start each with "-"). Do NOT use JSON or any other format.`;
    }

    /**
     * Parse and validate LLM summary response
     */
    private parseAndValidateSummary(content: string): string {
        // Split into lines and filter for bullet points
        const lines = content.split('\n').filter(line => line.trim().length > 0);

        let bullets: string[] = [];

        // Extract bullet points
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
                const bullet = trimmed.substring(1).trim();
                if (bullet.length > 0) {
                    bullets.push(bullet);
                }
            }
        }

        // Limit to 3-5 bullets
        bullets = bullets.slice(0, 5);

        // If we have fewer than 3, pad with generic statement  
        if (bullets.length < 3) {
            bullets.push('Continue monitoring AEO performance metrics for additional insights.');
        }

        // Format as bullet points
        return bullets.map(b => `• ${b}`).join('\n');
    }

    /**
     * Generate fallback summary if LLM fails
     */
    private generateFallbackSummary(input: ExecutiveSummaryInput): string {
        const bullets: string[] = [];

        // Bullet 1: Visibility change
        if (input.deltas.visibility.percentage !== 0) {
            const direction = input.deltas.visibility.percentage > 0 ? 'increased' : 'decreased';
            bullets.push(`Brand visibility ${direction} ${Math.abs(input.deltas.visibility.percentage).toFixed(1)}% to ${input.current_metrics.visibility.toFixed(1)}%`);
        } else {
            bullets.push(`Brand visibility remained stable at ${input.current_metrics.visibility.toFixed(1)}%`);
        }

        // Bullet 2: SOA or sentiment
        if (Math.abs(input.deltas.share_of_answer.percentage) > 10) {
            const direction = input.deltas.share_of_answer.percentage > 0 ? 'grew' : 'declined';
            bullets.push(`Share of Answer ${direction} ${Math.abs(input.deltas.share_of_answer.percentage).toFixed(1)}% vs prior period`);
        } else if (Math.abs(input.deltas.sentiment.absolute) > 0.3) {
            const direction = input.deltas.sentiment.absolute > 0 ? 'improved' : 'declined';
            bullets.push(`Brand sentiment ${direction} by ${Math.abs(input.deltas.sentiment.absolute).toFixed(2)} points`);
        }

        // Bullet 3: Competitive threats or opportunities
        if (input.competitive_threats.length > 0) {
            const topThreat = input.competitive_threats[0];
            bullets.push(`${topThreat.name} gained ${topThreat.deltas.share_of_answer.absolute.toFixed(1)}% SOA, requires attention`);
        }

        // Bullet 4: Traffic impact (if available)
        if (input.traffic_impact) {
            const direction = input.traffic_impact.sessions_change > 0 ? 'increased' : 'decreased';
            bullets.push(`AEO-attributed traffic ${direction} ${Math.abs(input.traffic_impact.sessions_change).toFixed(1)}%`);
        }

        // Ensure we have at least 3 bullets
        while (bullets.length < 3) {
            bullets.push('Monitor key metrics and competitive landscape for emerging trends');
        }

        return bullets.slice(0, 5).map(b => `• ${b}`).join('\n');
    }

    /**
     * Identify competitive threats from landscape data
     */
    private identifyCompetitiveThreats(landscape: any): any[] {
        if (!landscape.competitors) return [];

        // Filter for competitors with significant gains
        return landscape.competitors
            .filter((c: any) => c.deltas.share_of_answer.absolute > 5 || c.deltas.visibility.absolute > 10)
            .sort((a: any, b: any) => b.deltas.share_of_answer.absolute - a.deltas.share_of_answer.absolute)
            .slice(0, 3);
    }

    /**
     * Get empty top mover placeholder
     */
    private getEmptyTopMover(): any {
        return {
            name: 'N/A',
            id: '',
            changes: {},
        };
    }
}

export const executiveSummaryService = new ExecutiveSummaryService();
