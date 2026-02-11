import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';

export interface StrategicAngle {
    targetAudience: string;
    primaryPainPoint: string;
    theHook: string;
    competitorCounterStrike?: string;
}

export class StrategyPlanner {

    /**
     * Generates a "Strategic Angle" before the main content is planned.
     * This ensures the content has a specific point of view, audience, and counter-narrative.
     */
    async generateStrategicAngle(
        brandContext: { name: string; industry?: string; competitors?: string[] },
        topic: string,
        contentType: string
    ): Promise<StrategicAngle> {

        try {
            const prompt = this.buildAnglePrompt(brandContext, topic, contentType);

            console.log(`🧠 [StrategyPlanner] Generating strategic angle for: "${topic}"`);

            const response = await openRouterCollectorService.executeQuery({
                collectorType: 'content',
                prompt,
                maxTokens: 1000,
                temperature: 0.7, // Slightly higher for creativity in the angle
                model: 'openai/gpt-oss-20b'
            });

            if (!response.response) {
                throw new Error('Empty response from Strategy Planner');
            }

            const angle = this.parseAngleResponse(response.response);
            console.log(`✅ [StrategyPlanner] Strategic Angle Generated: "${angle.theHook.substring(0, 50)}..."`);
            return angle;

        } catch (error) {
            console.error('⚠️ [StrategyPlanner] Failed to generate strategic angle, using fallback.', error);
            // Fallback to generic angle if LLM fails
            return {
                targetAudience: 'General Industry Professionals',
                primaryPainPoint: 'Need for efficiency and better results',
                theHook: `${brandContext.name} offers a superior modern solution.`,
                competitorCounterStrike: ''
            };
        }
    }

    private buildAnglePrompt(brand: { name: string; industry?: string; competitors?: string[] }, topic: string, contentType: string): string {
        const competitors = brand.competitors && brand.competitors.length > 0
            ? brand.competitors.join(', ')
            : "standard industry alternatives";

        return `You are a World-Class Content Strategist for ${brand.name}.
        
**Task:** 
Define the high-level strategic angle for a piece of content about: "${topic}" (${contentType}).

**Brand Context:**
- Name: ${brand.name}
- Industry: ${brand.industry || 'Unknown'}
- Competitors: ${competitors}

**Requirements:**
1. **Target Audience:** Be hyper-specific (e.g., "Overworked DevOps Engineers", not "Tech People").
2. **Primary Pain Point:** What KEEPS THEM UP AT NIGHT regarding this topic?
3. **The Hook:** What is the unique, contrarian, or "insider" perspective ${brand.name} can take? Avoid generic "We are better".
4. **Competitor Counter-Strike:** How do competitors (${competitors}) usually fail at this? How does ${brand.name} succeed where they fail?

**Output Format:**
Return ONLY a VALID JSON object (no markdown, no extra text):
{
  "targetAudience": "...",
  "primaryPainPoint": "...",
  "theHook": "...",
  "competitorCounterStrike": "..."
}`;
    }

    private parseAngleResponse(response: string): StrategicAngle {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found');
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                targetAudience: parsed.targetAudience || 'Target Audience',
                primaryPainPoint: parsed.primaryPainPoint || 'Pain Point',
                theHook: parsed.theHook || 'Strategic Hook',
                competitorCounterStrike: parsed.competitorCounterStrike || ''
            };
        } catch (e) {
            console.warn('⚠️ [StrategyPlanner] JSON parse failed, returning raw text as hook.');
            return {
                targetAudience: 'Target Audience',
                primaryPainPoint: 'Pain Point',
                theHook: response.substring(0, 200), // Fallback
                competitorCounterStrike: ''
            };
        }
    }
}

export const strategyPlanner = new StrategyPlanner();
