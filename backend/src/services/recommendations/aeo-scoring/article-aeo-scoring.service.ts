import { IAEOScoringService, AEOScoreResult, MAX_SCRAPABILITY_SCORE } from './base-aeo-scoring.interface';

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
                // Legacy v4 JSON handling path - currently minimal or unused for v5 scoring logic
                // If we want to support legacy JSON scoring here, we'd parse it.
                // For now, if it's JSON, we might want to fail or try to extract text.
                // Assuming v5 is primary focus:
                jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                // Fallback / TODO: Implement JSON parsing if needed, or just warn.
            }

            // Treat as Flat Markdown (v5.0)
            // Strip wrapping fences if present but process essentially as text
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```\w*\s*/, '').replace(/\s*```$/, '');
            }

            // Move scoring logic here to run on 'jsonText' (which is now cleaned text)
            const textToScore = jsonText;

            // 1. Primary Answer Presence (20 pts)
            const answerScore = this.scorePrimaryAnswer(textToScore);

            // 2. Chunkability / Structure (10 pts)
            const structureScore = this.scoreStructure(textToScore);

            // 3. Concept Definition (10 pts)
            const conceptScore = this.scoreConceptDefinition(textToScore);

            // 4. Explanation Depth (15 pts)
            const explanationScore = this.scoreExplanationDepth(textToScore);

            // 5. Comparison Readiness (10 pts)
            const comparisonScore = this.scoreComparisonReadiness(textToScore);

            // 6. Authority Signals (15 pts)
            const authorityScore = this.scoreAuthoritySignals(textToScore);

            // 7. Anti-Marketing (Penalty)
            const marketingPenalty = this.calculateMarketingPenalty(textToScore);

            // Total output
            let total = answerScore.score + structureScore.score + conceptScore.score + explanationScore.score + comparisonScore.score + authorityScore.score;
            total = Math.max(0, total + marketingPenalty.score);

            return {
                totalScore: Math.min(MAX_SCRAPABILITY_SCORE, total),
                breakdown: {
                    primaryAnswer: answerScore,
                    chunkability: structureScore,
                    conceptClarity: conceptScore,
                    explanationDepth: explanationScore,
                    comparison: comparisonScore,
                    authority: authorityScore,
                    antiMarketing: marketingPenalty
                }
            };

        } catch (e) {
            // Handle potential JSON parsing errors if this path were to be used for actual JSON parsing
            // For now, it seems the 'try' block is not fully utilized for error handling in the markdown path.
            // If no JSON is found, or if the markdown path is taken, this catch block might not be reached.
            console.error("Error during AEO scoring content parsing:", e);
            // Return a default or error score if parsing fails
            return {
                totalScore: 0,
                breakdown: {
                    primaryAnswer: { score: 0, max: 20, status: 'error', feedback: 'Content parsing error.' },
                    chunkability: { score: 0, max: 10, status: 'error', feedback: 'Content parsing error.' },
                    conceptClarity: { score: 0, max: 10, status: 'error', feedback: 'Content parsing error.' },
                    explanationDepth: { score: 0, max: 15, status: 'error', feedback: 'Content parsing error.' },
                    comparison: { score: 0, max: 10, status: 'error', feedback: 'Content parsing error.' },
                    authority: { score: 0, max: 15, status: 'error', feedback: 'Content parsing error.' },
                    antiMarketing: { score: 0, max: 0, status: 'error', feedback: 'Content parsing error.' }
                }
            };
        }

        // If neither '```json' nor '```' markdown block is found, or if the content is not structured as expected.
        // This part of the code would be reached if the initial `if/else if` conditions are not met.
        // For now, returning a default low score.
    }


    // --- Dimension Scorers ---

    private scorePrimaryAnswer(text: string) {
        // Heuristic: explicit answer signals in the first 25% of content.
        const firstQuarter = text.slice(0, Math.floor(text.length * 0.35)); // Extended window

        // 1. Look for Definition/Summary Headers
        const hasSummaryHeader = /##\s*(Executive Abstract|Abstract|Summary|Key Takeaways|TL;?DR|The Bottom Line|Direct Answer|Quick Answer|In Short)/i.test(firstQuarter);

        // 2. Look for "Snippet Style" formatting: H2 followed by Blockquote (>)
        // Matches: ## Header\n> or ## Header\n\n>
        const hasBlockquoteAnswer = /##\s*[^#\n]+\n+>/.test(firstQuarter);

        // 3. Look for bolded definition starts
        // Matches: **[Entity] is** or **The main reason**
        const hasBoldDefinition = /\*\*.*\*\*\s*(is|refers to|means|offers)/i.test(firstQuarter);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No primary answer detected early in the content.";

        if (hasSummaryHeader || hasBlockquoteAnswer) {
            score = 20;
            status = 'good';
            feedback = "Direct answer identified (Summary header or Blockquote). Excellent for Snippets.";
        } else if (hasBoldDefinition) {
            score = 15;
            status = 'warning';
            feedback = "Definition found, but considers adding a dedicated 'Executive Abstract' section.";
        } else {
            // Fallback: Check for question mark if no explicit header
            if (/\?/.test(firstQuarter)) {
                score = 5;
                feedback = "Question posing detected, but needs immediately following answer.";
            }
        }

        return { score, max: 20, status, feedback };
    }

    private scoreStructure(text: string) {
        // Count Markdown Headers (H2/H3)
        // v5.0 content uses ## for sections and ### for subsections
        const h2Count = (text.match(/^##\s/gm) || []).length;
        const h3Count = (text.match(/^###\s/gm) || []).length;
        const totalHeaders = h2Count + h3Count;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Content lacks structure (headers).";

        if (totalHeaders >= 5) {
            score = 10;
            status = 'good';
            feedback = `Good structural depth (${totalHeaders} sections).`;
        } else if (totalHeaders >= 3) {
            score = 5;
            status = 'warning';
            feedback = "Basic structure present, consider more sub-sections (H3).";
        }

        return { score, max: 10, status, feedback };
    }

    private scoreConceptDefinition(text: string) {
        // Expanded patterns for natural definitions
        const definitionPatterns = [
            /is defined as/i,
            /refers to/i,
            /means/i,
            /simply put/i,
            /in simple terms/i,
            /\bis a\b/i,
            /essentially/i,
            /core concept/i,
            /understood as/i
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
        // Score: 15 pts now (was 10)
        // Look for causal connectives
        const causalPatterns = [
            /because/i,
            /due to/i,
            /as a result/i,
            /consequently/i,
            /reason for/i,
            /how does/i,
            /why does/i,
            /therefore/i,
            /thus/i,
            /implies that/i,
            /which means/i
        ];

        const matches = causalPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Content is descriptive but lacks 'why' logic.";

        if (matches >= 3) { // Lowered threshold slightly for realism
            score = 15;
            status = 'good';
            feedback = "Deep explanation logic detected.";
        } else if (matches >= 1) {
            score = 7;
            status = 'warning';
            feedback = "Some explanation logic, but try to explain 'why' more.";
        }

        return { score, max: 15, status, feedback };
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
            /trade-off/i,
            /on the other hand/i,
            /in contrast/i,
            /however/i
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
        // Look for data and specificity with context
        // Matches: "2026", "25%", "$100", "Study", "Report"
        const dataPatterns = [
            /\d+%/, // Percentages
            /\$\d+/, // Money
            /\b(study|research|report|survey|analysis)\b/i, // Citations
            /according to/i,
            /\d{4}\s(trends|market|report|data|stats)/i, // Year with context (e.g. "2026 trends")
            /\[.*\]\(http.*\)/ // Markdown links
        ];

        const matches = dataPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Lacks specific data points, citations, or links.";

        if (matches >= 3) {
            score = 15;
            status = 'good';
            feedback = "High density of authority signals (data/citations).";
        } else if (matches >= 1) {
            score = 7;
            status = 'warning';
            feedback = "Some data present; add more specific stats or links.";
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
