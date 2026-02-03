import { IAEOScoringService, AEOScoreResult } from './base-aeo-scoring.interface';

/**
 * Article AEO Scoring Service (v1)
 * 
 * Implements the "AI Scrapability" scoring layer (70 points) for Articles.
 * Focuses on text structure, clarity, and authority signals suitable for written content.
 */
export class ArticleAEOScoringService implements IAEOScoringService {

    public calculateScrapabilityScore(content: string): AEOScoreResult {
        let text = content || '';
        let sections: any[] = [];

        // V4/JSON Parsing
        try {
            // Strip markdown code blocks if present
            let jsonText = text.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            if (jsonText.startsWith('{')) {
                const parsed = JSON.parse(jsonText);
                if (parsed.sections && Array.isArray(parsed.sections)) {
                    sections = parsed.sections;
                    // Reconstruct text for general analysis
                    text = parsed.sections.map((s: any) => `${s.title}\n${s.content}`).join('\n\n');
                } else if (parsed.content) {
                    text = parsed.content;
                }
            }
        } catch (e) {
            // Raw text fallback
        }

        // 1. Primary Answer Presence (20 pts) - Increased from 15
        const answerScore = this.scorePrimaryAnswer(text, sections);

        // 2. Concept Definition (10 pts)
        const conceptScore = this.scoreConceptDefinition(text);

        // 3. Explanation Depth (10 pts)
        const explanationScore = this.scoreExplanationDepth(text);

        // 4. Comparison Readiness (10 pts)
        const comparisonScore = this.scoreComparisonReadiness(text);

        // 5. Authority Signals (20 pts) - Increased from 15
        const authorityScore = this.scoreAuthoritySignals(text);

        // 6. Anti-Marketing (Negative scoring)
        const marketingPenalty = this.calculateMarketingPenalty(text);

        // Total Calculation (Max 70)
        // 20 + 10 + 10 + 10 + 20 = 70 (chunkability removed, points redistributed)
        let total = answerScore.score + conceptScore.score + explanationScore.score + comparisonScore.score + authorityScore.score;

        // Apply penalty
        total = Math.max(0, total + marketingPenalty.score);

        return {
            totalScore: Math.min(70, total),
            breakdown: {
                primaryAnswer: answerScore,
                // chunkability removed - no longer relevant for v4.0 JSON
                conceptClarity: conceptScore,
                explanationDepth: explanationScore,
                comparison: comparisonScore,
                authority: authorityScore,
                antiMarketing: marketingPenalty
            }
        };
    }

    // --- Dimension Scorers ---

    private scorePrimaryAnswer(text: string, sections: any[] = []) {
        // Check first section title if it exists
        const firstSectionTitle = sections.length > 0 ? sections[0].title : '';
        const firstQuarter = text.slice(0, Math.floor(text.length * 0.25));

        const hasDirectAnswerKey = /TL;?DR|Summary|Key Takeaways|In short|Quick Answer|Direct Answer|Executive Summary/i.test(firstQuarter) ||
            /Direct Answer/i.test(firstSectionTitle);

        const hasEarlyQuestion = /\?/.test(firstQuarter);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No primary answer detected early in the content.";

        if (hasDirectAnswerKey) {
            score = 20; // Increased from 15
            status = 'good';
            feedback = "Direct answer/summary found early. Excellent for AI/Snippets.";
        } else if (hasEarlyQuestion) {
            score = 10; // Increased from 8
            status = 'warning';
            feedback = "Question detected, but lacking an explicit 'Summary' or 'TL;DR' section.";
        }

        return { score, max: 20, status, feedback }; // Max increased from 15
    }

    // Chunkability removed - no longer relevant for v4.0 JSON content

    private scoreConceptDefinition(text: string) {
        const definitionPatterns = [
            /is defined as/i, /refers to/i, /means/i, /simply put/i, /in simple terms/i, /what is/i, /: /
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
            /because/i, /due to/i, /as a result/i, /consequently/i, /reason for/i, /how does/i, /why does/i, /therefore/i, /thus/i
        ];
        const matches = causalPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Content feels descriptive solely, missing 'why' and 'how'.";

        if (matches >= 3) {
            score = 10;
            status = 'good';
            feedback = "Deep explanation logic detected.";
        } else if (matches >= 1) {
            score = 5;
            status = 'warning';
            feedback = "Some explanation logic, but try to explain 'why' more.";
        }

        return { score, max: 10, status, feedback };
    }

    private scoreComparisonReadiness(text: string) {
        const comparisonPatterns = [
            / vs /i, /versus/i, /unlike/i, /contrary to/i, /similar to/i, /compared to/i, /alternatively/i, /trade-off/i, /however/i, /while/i
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
            /\d+%/, /\$\d+/, /study/i, /research/i, /according to/i, /\d{4}/, /\[\d+\]/, /data/i, /analysis/i
        ];
        const matches = dataPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Lacks specific data points or citations.";

        if (matches >= 3) {
            score = 20; // Increased from 15
            status = 'good';
            feedback = "High density of authority signals (data/citations).";
        } else if (matches >= 1) {
            score = 10; // Increased from 8
            status = 'warning';
            feedback = "Some data present, but could be more specific.";
        }

        return { score, max: 20, status, feedback }; // Max increased from 15
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
