import { IAEOScoringService, AEOScoreResult } from './base-aeo-scoring.interface';

/**
 * Article AEO Scoring Service (v1)
 * 
 * Implements the "AI Scrapability" scoring layer (70 points) for Articles.
 * Focuses on text structure, clarity, and authority signals suitable for written content.
 */
export class ArticleAEOScoringService implements IAEOScoringService {

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

        // 7. Anti-Marketing (Negative scoring)
        const marketingPenalty = this.calculateMarketingPenalty(text);

        // Total Calculation
        let total = answerScore.score + chunkScore.score + conceptScore.score + explanationScore.score + comparisonScore.score + authorityScore.score;

        // Apply penalty
        total = Math.max(0, total + marketingPenalty.score);

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
        const firstQuarter = text.slice(0, Math.floor(text.length * 0.25));
        const hasDirectAnswerKey = /TL;?DR|Summary|Key Takeaways|In short|Quick Answer/i.test(firstQuarter);
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
        const definitionPatterns = [
            /is defined as/i, /refers to/i, /means/i, /simply put/i, /in simple terms/i, /what is/i
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
        const causalPatterns = [
            /because/i, /due to/i, /as a result/i, /consequently/i, /reason for/i, /how does/i, /why does/i
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
        const comparisonPatterns = [
            / vs /i, /versus/i, /unlike/i, /contrary to/i, /similar to/i, /compared to/i, /alternatively/i, /trade-off/i
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
        const dataPatterns = [
            /\d+%/, /\$\d+/, /study/i, /research/i, /according to/i, /\d{4}/
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
        const fluffPatterns = [
            /sign up/i, /buy now/i, /click here/i, /subscribe/i, /leading/i, /best-in-class/i, /revolutionary/i
        ];
        let penaltyCount = 0;
        fluffPatterns.forEach(p => {
            const match = text.match(new RegExp(p, 'gi'));
            if (match) penaltyCount += match.length;
        });

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'good';
        let feedback = "Tone is neutral and objective.";

        if (penaltyCount >= 5) {
            score = -15;
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
