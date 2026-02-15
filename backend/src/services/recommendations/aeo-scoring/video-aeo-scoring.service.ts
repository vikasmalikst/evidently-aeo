import { IAEOScoringService, AEOScoreResult, MAX_SCRAPABILITY_SCORE } from './base-aeo-scoring.interface';

export class VideoAEOScoringService implements IAEOScoringService {
    public calculateScrapabilityScore(content: string): AEOScoreResult {
        const text = content || '';

        // v5.0 Video Strategy: Markdown Script
        // Structure: [H1] Title, [H2] The Hook (0:00-0:05), [Visual: ...], (Narrator): ...

        // 1. Hook Quality (15 pts)
        // Look for "Hook" section and < 5 seconds timestamp
        const hookScore = this.scoreHook(text);

        // 2. Direct Answer / Quick Win (20 pts)
        // Look for "Quick Win" or "Direct Answer" section
        const answerScore = this.scoreDirectAnswer(text);

        // 3. Explanation Depth & Steps (15 pts)
        // Look for "Steps" or numbered list in body
        const explanationScore = this.scoreExplanation(text);

        // 4. Visual Cues (15 pts)
        // Look for [Visual: ...] instructions
        const visualScore = this.scoreVisuals(text);

        // 5. Engagement / Social Signal (15 pts)
        // Look for CTA or "Social Signal" section
        const engagementScore = this.scoreEngagement(text);

        // 6. Anti-Marketing (Penalty)
        const marketingPenalty = this.calculateMarketingPenalty(text);

        // Total = 15 + 20 + 15 + 15 + 15 = 80
        let total = hookScore.score + answerScore.score + explanationScore.score + visualScore.score + engagementScore.score;
        total = Math.max(0, total + marketingPenalty.score);

        return {
            totalScore: Math.min(MAX_SCRAPABILITY_SCORE, total),
            breakdown: {
                primaryAnswer: answerScore, // Mapped to primary answer
                // Mapping specific video metrics to generic interface keys where possible
                conceptClarity: hookScore, // Hook maps to concept clarity (clarity of intent)
                explanationDepth: explanationScore,
                comparison: visualScore, // Visuals map to comparison slot (visual comparison)
                authority: engagementScore, // Engagement maps to authority (social proof)
                antiMarketing: marketingPenalty
            }
        };
    }

    private scoreHook(text: string) {
        // Look for [H2] The Hook or (0:00-0:05)
        // v5 prompt generates: [H2] The Hook (0:00-0:05)
        const hasHookHeader = /##\s*The Hook/i.test(text);
        const hasTimestamp = /\(0:00-0:05\)/.test(text);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No Hook section detected (0:00-0:05).";

        if (hasHookHeader && hasTimestamp) {
            score = 15;
            status = 'good';
            feedback = "Strong Hook with timestamp detected.";
        } else if (hasHookHeader) {
            score = 10;
            status = 'warning';
            feedback = "Hook section found, but check timestamps.";
        }

        return { score, max: 15, status, feedback };
    }

    private scoreDirectAnswer(text: string) {
        // Look for "Quick Win", "Direct Answer"
        const hasQuickWin = /##\s*(The Quick Win|Direct Answer)/i.test(text);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No 'Quick Win' or immediate answer section found.";

        if (hasQuickWin) {
            score = 20;
            status = 'good';
            feedback = "Immediate value ('Quick Win') identified.";
        }

        return { score, max: 20, status, feedback };
    }

    private scoreExplanation(text: string) {
        // Look for numbered steps 1., 2., 3. or "The Steps" section
        const hasStepsHeader = /##\s*The Steps/i.test(text);
        const hasList = (text.match(/^\d+\.\s/gm) || []).length >= 3;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No clear steps or explanation structure.";

        if (hasStepsHeader && hasList) {
            score = 15;
            status = 'good';
            feedback = "Clear step-by-step explanation.";
        } else if (hasList) {
            score = 10;
            status = 'warning';
            feedback = "Steps found, but define a clearer section header.";
        }

        return { score, max: 15, status, feedback };
    }

    private scoreVisuals(text: string) {
        // Look for [Visual: ...] or (Visual) patterns
        const visualCount = (text.match(/\[Visual:|\[Scene:|Visual Direction:/gi) || []).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Script lacks visual directions for the editor.";

        if (visualCount >= 3) {
            score = 15;
            status = 'good';
            feedback = "Excellent visual direction density.";
        } else if (visualCount >= 1) {
            score = 8;
            status = 'warning';
            feedback = "Some visuals, but add more cues.";
        }

        return { score, max: 15, status, feedback };
    }

    private scoreEngagement(text: string) {
        // Look for CTA, "Social Signal", or question mark at end
        const hasSignal = /##\s*(The Social Signal|Call to Action|CTA)/i.test(text);
        const hasQuestion = /\?/.test(text.slice(-200));

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No engagement trigger found.";

        if (hasSignal) {
            score = 15;
            status = 'good';
            feedback = "Clear social engagement signal.";
        } else if (hasQuestion) {
            score = 10;
            status = 'warning';
            feedback = "Ends with question, but explicit Social Signal section helps.";
        }

        return { score, max: 15, status, feedback };
    }

    private calculateMarketingPenalty(text: string) {
        // Check for "Link in bio" spam or overly salesy "Buy now"
        const patterns = [/link in bio/i, /buy now/i, /click the link/i];
        const count = patterns.filter(p => p.test(text)).length;

        if (count >= 2) return { score: -10, max: 0, status: 'error' as const, feedback: "Too many sales CTAs." };
        return { score: 0, max: 0, status: 'good' as const, feedback: "Tone is content-first." };
    }
}
