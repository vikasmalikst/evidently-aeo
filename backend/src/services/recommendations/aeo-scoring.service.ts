/**
 * AEO Scoring Service
 * 
 * Implements the "AI Scrapability" scoring layer (70 points) for AEO.
 * This is a heuristic-based v1 implementation focusing on:
 * - Primary Answer Presence
 * - Chunkability (Structure)
 * - Concept Definition & Clarity
 * - Explanation Depth
 * - Comparison Readiness
 * - Authority Signals
 * - Anti-Marketing Discipline
 */

export interface AEOScoreResult {
    totalScore: number; // Max 70 (for this layer)
    breakdown: {
        primaryAnswer: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
        chunkability: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
        conceptClarity: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
        explanationDepth: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
        comparison: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
        authority: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
        antiMarketing: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    };
}

export class AEOScoringService {

    public calculateScrapabilityScore(content: string): AEOScoreResult {
        const text = content || '';

        // 1. Primary Answer Presence (15 pts)
        const answerScore = this.scorePrimaryAnswer(text);

        // 2. Chunkability (10 pts)
        const chunkScore = this.scoreChunkability(text);

        // 3. Concept Definition (10 pts)
        const conceptScore = this.scoreConceptDefinition(text);

        // 4. Explanation Depth (10 pts)
        const explanationScore = this.scoreExplanationDepth(text);

        // 5. Comparison Readiness (10 pts)
        const comparisonScore = this.scoreComparisonReadiness(text);

        // 6. Authority Signals (15 pts)
        const authorityScore = this.scoreAuthoritySignals(text);

        // 7. Anti-Marketing (Negative scoring, up to -20 penalty, but regulated here)
        // We treat this as a deduction from a perfect score or a specific component.
        // For simplicity in the breakdown, we'll assign it a value that reduces the total.
        // However, the interface asks for a breakdown structure. Let's frame it as a "Compliance" score (max 0, min -20)?
        // Or better, we start with 0 and subtract.
        const marketingPenalty = this.calculateMarketingPenalty(text);

        // Total Calculation
        // Base max = 15 + 10 + 10 + 10 + 10 + 15 = 70.
        let total = answerScore.score + chunkScore.score + conceptScore.score + explanationScore.score + comparisonScore.score + authorityScore.score;

        // Apply penalty
        total = Math.max(0, total + marketingPenalty.score); // Penalty score is negative

        return {
            totalScore: total,
            breakdown: {
                primaryAnswer: answerScore,
                chunkability: chunkScore,
                conceptClarity: conceptScore,
                explanationDepth: explanationScore,
                comparison: comparisonScore,
                authority: authorityScore,
                antiMarketing: marketingPenalty
            }
        };
    }

    // --- Dimension Scorers ---

    private scorePrimaryAnswer(text: string) {
        // Heuristic: explicit answer signals in the first 25% of content.
        // Look for "TL;DR", "Summary", "Answer:", or a question followed immediately by a short paragraph.
        const firstQuarter = text.slice(0, Math.floor(text.length * 0.25));
        const hasDirectAnswerKey = /TL;?DR|Summary|Key Takeaways|In short|Quick Answer/i.test(firstQuarter);

        // Look for a question mark in early text followed by content
        // This is a weak heuristic but works for v1
        const hasEarlyQuestion = /\?/.test(firstQuarter);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No primary answer detected early in the content.";

        if (hasDirectAnswerKey) {
            score = 15;
            status = 'good';
            feedback = "Direct answer/summary found early. Excellent for AI/Snippets.";
        } else if (hasEarlyQuestion) {
            score = 8;
            status = 'warning';
            feedback = "Question detected, but lacking an explicit 'Summary' or 'TL;DR' section.";
        }

        return { score, max: 15, status, feedback };
    }

    private scoreChunkability(text: string) {
        // Count headers (markdown # or html h1-h6)
        const headerCount = (text.match(/#{1,6}\s|class="h[1-6]"|<h[1-6]/gi) || []).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Content lacks structure (headings).";

        if (headerCount >= 5) {
            score = 10;
            status = 'good';
            feedback = "Good structural depth (5+ sections).";
        } else if (headerCount >= 2) {
            score = 5;
            status = 'warning';
            feedback = "Basic structure present, but could be more granular.";
        }

        return { score, max: 10, status, feedback };
    }

    private scoreConceptDefinition(text: string) {
        // Look for definition patterns
        const definitionPatterns = [
            /is defined as/i,
            /refers to/i,
            /means/i,
            /simply put/i,
            /in simple terms/i,
            /what is/i
        ];

        const matches = definitionPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No clear concept definitions found.";

        if (matches >= 2) {
            score = 10;
            status = 'good';
            feedback = "Clear definitions present.";
        } else if (matches >= 1) {
            score = 6;
            status = 'warning';
            feedback = "Some definitions found, could be more explicit.";
        }

        return { score, max: 10, status, feedback };
    }

    private scoreExplanationDepth(text: string) {
        // Look for causal connectives
        const causalPatterns = [
            /because/i,
            /due to/i,
            /as a result/i,
            /consequently/i,
            /reason for/i,
            /how does/i,
            /why does/i
        ];

        const matches = causalPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Content feels descriptive solely, missing 'why' and 'how'.";

        if (matches >= 4) {
            score = 10;
            status = 'good';
            feedback = "Deep explanation logic detected.";
        } else if (matches >= 2) {
            score = 5;
            status = 'warning';
            feedback = "Some explanation logic, but try to explain 'why' more.";
        }

        return { score, max: 10, status, feedback };
    }

    private scoreComparisonReadiness(text: string) {
        // Look for comparison markers
        const comparisonPatterns = [
            / vs /i,
            /versus/i,
            /unlike/i,
            /contrary to/i,
            /similar to/i,
            /compared to/i,
            /alternatively/i,
            /trade-off/i
        ];

        const matches = comparisonPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No comparisons or trade-offs found.";

        if (matches >= 3) {
            score = 10;
            status = 'good';
            feedback = "Strong comparative signals.";
        } else if (matches >= 1) {
            score = 5;
            status = 'warning';
            feedback = "Minimal comparisons found. Consisder adding trade-offs.";
        }

        return { score, max: 10, status, feedback };
    }

    private scoreAuthoritySignals(text: string) {
        // Look for data and specificity
        const dataPatterns = [
            /\d+%/, // Percentages
            /\$\d+/, // Money
            /study/i,
            /research/i,
            /according to/i,
            /\d{4}/ // Years (citations)
        ];

        const matches = dataPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Lacks specific data points or citations.";

        if (matches >= 4) {
            score = 15;
            status = 'good';
            feedback = "High density of authority signals (data/citations).";
        } else if (matches >= 2) {
            score = 8;
            status = 'warning';
            feedback = "Some data present, but could be more specific.";
        }

        return { score, max: 15, status, feedback };
    }

    private calculateMarketingPenalty(text: string) {
        // Penalize marketing fluff
        const fluffPatterns = [
            /sign up/i,
            /buy now/i,
            /click here/i,
            /subscribe/i,
            /leading/i,
            /best-in-class/i,
            /revolutionary/i
        ];

        // Count occurrences
        let penaltyCount = 0;
        fluffPatterns.forEach(p => {
            const match = text.match(new RegExp(p, 'gi'));
            if (match) penaltyCount += match.length;
        });

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'good';
        let feedback = "Tone is neutral and objective.";

        if (penaltyCount >= 5) {
            score = -15; // Cap at substantial penalty
            status = 'error';
            feedback = "Tone is too promotional/marketing-heavy.";
        } else if (penaltyCount >= 2) {
            score = -5;
            status = 'warning';
            feedback = "Avoid marketing calls-to-action (CTAs) in AEO content.";
        }

        return { score, max: 0, status, feedback };
    }
}

export const aeoScoringService = new AEOScoringService();
