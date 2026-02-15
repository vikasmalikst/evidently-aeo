import { IAEOScoringService, AEOScoreResult, MAX_SCRAPABILITY_SCORE } from './base-aeo-scoring.interface';

export class PodcastAEOScoringService implements IAEOScoringService {
    public calculateScrapabilityScore(content: string): AEOScoreResult {
        const text = content || '';

        // v5.0 Podcast Strategy
        // Structure: Intro, Core Insight, Deep Dive, Context, Takeaways

        // 1. Structure Check (20 pts)
        // Look for the 5 key sections
        const structureScore = this.scoreStructure(text);

        // 2. Core Insight Definition (20 pts)
        const insightScore = this.scoreInsight(text);

        // 3. Discussion Depth (15 pts)
        const depthScore = this.scoreDepth(text);

        // 4. Actionable Takeaways (15 pts)
        const takeawaysScore = this.scoreTakeaways(text);

        // 5. Host/Guest Dynamics (10 pts)
        const dynamicScore = this.scoreDynamics(text);

        // 6. Anti-Marketing (Penalty)
        const marketingPenalty = this.calculateMarketingPenalty(text);

        // Total = 20 + 20 + 15 + 15 + 10 = 80
        let total = structureScore.score + insightScore.score + depthScore.score + takeawaysScore.score + dynamicScore.score;
        total = Math.max(0, total + marketingPenalty.score);

        return {
            totalScore: Math.min(MAX_SCRAPABILITY_SCORE, total),
            breakdown: {
                primaryAnswer: insightScore, // Insight maps to primary answer
                chunkability: structureScore,
                explanationDepth: depthScore,
                authority: takeawaysScore, // Takeaways map to authority (value prop)
                conceptClarity: dynamicScore, // Dynamics map to clarity (format quality)
                antiMarketing: marketingPenalty
            }
        };
    }

    private scoreStructure(text: string) {
        // Check for sections: Intro, Core Insight, Deep Dive, Nuance, Takeaways
        const sections = [
            /##\s*Introduction/i,
            /##\s*The Core Insight/i,
            /##\s*Deep Dive/i,
            /##\s*Limitations/i,
            /##\s*Key Takeaways/i
        ];

        const count = sections.filter(p => p.test(text)).length;

        if (count >= 4) return { score: 20, max: 20, status: 'good' as const, feedback: "Complete podcast structure." };
        if (count >= 2) return { score: 10, max: 20, status: 'warning' as const, feedback: "Missing key podcast sections." };
        return { score: 5, max: 20, status: 'error' as const, feedback: "Structure undefined." };
    }

    private scoreInsight(text: string) {
        // Look for definition in Core Insight section
        const hasInsight = /##\s*The Core Insight[\s\S]{0,500}(defined as|means|is the concept)/i.test(text);

        if (hasInsight) return { score: 20, max: 20, status: 'good' as const, feedback: "Clear core concept definition." };
        return { score: 10, max: 20, status: 'warning' as const, feedback: "Define the core concept more explicitly." };
    }

    private scoreDepth(text: string) {
        // Look for dialogue length or 'Deep Dive' content
        const deepDiveMatch = text.match(/##\s*Deep Dive([\s\S]*?)##/i);
        const length = deepDiveMatch ? deepDiveMatch[1].length : 0;

        if (length > 500) return { score: 15, max: 15, status: 'good' as const, feedback: "Substantial deep dive discussion." };
        return { score: 7, max: 15, status: 'warning' as const, feedback: "Expand the deep dive section." };
    }

    private scoreTakeaways(text: string) {
        const hasTakeaways = /##\s*Key Takeaways/i.test(text);
        const hasList = (text.match(/##\s*Key Takeaways[\s\S]*\d\./) || []).length > 0;

        if (hasTakeaways && hasList) return { score: 15, max: 15, status: 'good' as const, feedback: "Actionable takeaways listed." };
        return { score: 5, max: 15, status: 'warning' as const, feedback: "List specific takeaways at the end." };
    }

    private scoreDynamics(text: string) {
        // Look for Host: / Guest: markers
        const hasHost = /Host:/i.test(text);
        const hasGuest = /Guest:/i.test(text);

        if (hasHost && hasGuest) return { score: 10, max: 10, status: 'good' as const, feedback: "Clear speaker labels." };
        return { score: 0, max: 10, status: 'error' as const, feedback: "Use 'Host:' and 'Guest:' labels." };
    }

    private calculateMarketingPenalty(text: string) {
        if (/sponsor/i.test(text) && /buy now/i.test(text)) return { score: -10, max: 0, status: 'warning' as const, feedback: "Too promotional." };
        return { score: 0, max: 0, status: 'good' as const, feedback: "Tone is educational." };
    }
}
