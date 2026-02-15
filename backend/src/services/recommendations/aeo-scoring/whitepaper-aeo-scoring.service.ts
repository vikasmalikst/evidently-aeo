import { IAEOScoringService, AEOScoreResult, MAX_SCRAPABILITY_SCORE } from './base-aeo-scoring.interface';

/**
 * Whitepaper AEO Scoring Service
 * 
 * Target: High-authority, data-driven, long-form content.
 * Focus: Executive Summary, Data Density, Methodology, Structure.
 */
export class WhitepaperAEOScoringService implements IAEOScoringService {

    public calculateScrapabilityScore(content: string): AEOScoreResult {
        let text = content || '';
        let h2Count = 0;
        let h3Count = 0;

        // V4/JSON Parsing
        try {
            if (text.trim().startsWith('{')) {
                const parsed = JSON.parse(text);
                if (parsed.sections && Array.isArray(parsed.sections)) {
                    // Reconstruct text for general analysis

                    // v5.0 Content Strategy: Flat Markdown Analysis
                    // 1. Executive Summary / Primary Answer (20 pts)
                    const answerScore = this.scoreExecutiveSummary(text);

                    // 2. Structural Depth (15 pts) - Increased from 10
                    const structureScore = this.scoreStructuralDepth(text);

                    // 3. Data & Citation Density (20 pts)
                    const dataScore = this.scoreDataDensity(text);

                    // 4. Methodology & Authority (15 pts) - Increased from 10
                    const authorityScore = this.scoreMethodology(text);

                    // 5. Problem Definition (10 pts)
                    const definitionScore = this.scoreProblemDefinition(text);

                    // 6. Anti-Marketing (Penalty)
                    const marketingPenalty = this.calculateMarketingPenalty(text);

                    // Total Calculation (Max 80)
                    // 20 + 15 + 20 + 15 + 10 = 80
                    let total = answerScore.score + structureScore.score + dataScore.score + authorityScore.score + definitionScore.score;

                    // Apply penalty
                    total = Math.max(0, total + marketingPenalty.score);

                    return {
                        totalScore: Math.min(MAX_SCRAPABILITY_SCORE, total),
                        breakdown: {
                            primaryAnswer: answerScore,
                            authority: dataScore, // Mapping data density to generic 'authority'
                            explanationDepth: authorityScore, // Mapping methodology to generic 'explanationDepth'
                            conceptClarity: structureScore, // Mapping structure to generic 'conceptClarity'
                            comparison: definitionScore, // Mapping definition to generic 'comparison'
                            antiMarketing: marketingPenalty
                        }
                    };
                }
            }
        } catch (e) {
            // Fallback to flat text analysis if JSON parsing fails or is not applicable
            // This block is intentionally left empty for now, as the current implementation
            // only handles the JSON structure and the rest of the method is for flat text.
            // A full implementation would have a separate path here.
        }

        // If we reach here, either JSON parsing failed, or the content was not JSON,
        // or the JSON structure didn't match the expected 'sections' format.
        // In a complete implementation, this would trigger the flat markdown analysis.
        // For now, we'll return a default or error score.
        return {
            totalScore: 0,
            breakdown: {
                primaryAnswer: { score: 0, max: 20, status: 'error', feedback: 'Content not in expected JSON format or flat text analysis not yet implemented.' },
                authority: { score: 0, max: 20, status: 'error', feedback: 'Content not in expected JSON format or flat text analysis not yet implemented.' },
                explanationDepth: { score: 0, max: 15, status: 'error', feedback: 'Content not in expected JSON format or flat text analysis not yet implemented.' },
                conceptClarity: { score: 0, max: 15, status: 'error', feedback: 'Content not in expected JSON format or flat text analysis not yet implemented.' },
                comparison: { score: 0, max: 10, status: 'error', feedback: 'Content not in expected JSON format or flat text analysis not yet implemented.' },
                antiMarketing: { score: 0, max: 0, status: 'good', feedback: 'N/A' }
            }
        };
    }

    // --- Dimension Scorers ---

    // 1. Executive Summary (20)
    private scoreExecutiveSummary(text: string) {
        // Look for implicit or explicit summary at the start
        // Matches: "Executive Summary", "Abstract", "Key Findings", or "Bottom Line"
        const firstQuarter = text.slice(0, Math.floor(text.length * 0.3));
        const hasSummaryHeader = /##\s*(Executive Summary|Abstract|Key Findings|Key Takeaways|Overview|Management Summary)/i.test(firstQuarter);

        // Also check if text starts with a blockquote which is a common Abstract format in v5 templates
        const hasBlockquoteStart = /^\s*>/m.test(firstQuarter);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No Executive Summary or Abstract detected.";

        if (hasSummaryHeader || hasBlockquoteStart) {
            score = 20;
            status = 'good';
            feedback = "Executive Summary identified.";
        } else {
            // Fallback: Check for robust definition paragraph
            if (/defined as|refers to/i.test(firstQuarter)) {
                score = 10;
                status = 'warning';
                feedback = "Definition found, but formal Executive Summary heading is preferred.";
            }
        }
        return { score, max: 20, status, feedback };
    }

    private scoreStructuralDepth(text: string) {
        // Count Markdown Headers in flat text
        const h2Count = (text.match(/^##\s/gm) || []).length;
        const h3Count = (text.match(/^###\s/gm) || []).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Whitepaper lacks deep structure (H2/H3).";

        if (h2Count >= 4 && h3Count >= 2) {
            score = 15;
            status = 'good';
            feedback = "Excellent structural depth (Multiple H2s and H3s).";
        } else if (h2Count >= 3) {
            score = 8;
            status = 'warning';
            feedback = "Good macro structure, but add more subsections (H3) for detail.";
        }

        return { score, max: 15, status, feedback };
    }

    // 3. Data & Citation Density (20)
    private scoreDataDensity(text: string) {
        // %, $, Years, "study", "survey", "report", brackets [1]
        const dataPatterns = [/\d+%/, /\$\d+/, /study/i, /survey/i, /report/i, /data/i, /\[\d+\]/];
        const matches = text.match(new RegExp(dataPatterns.map(p => p.source).join('|'), 'gi')) || [];
        const count = matches.length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Lacks data density. Whitepapers need stats/citations.";

        if (count >= 10) {
            score = 20;
            status = 'good';
            feedback = "High data density. excellent for authority.";
        } else if (count >= 5) {
            score = 10;
            status = 'warning';
            feedback = "Some data present. Add more specific stats.";
        }

        return { score, max: 20, status, feedback };
    }

    // 4. Methodology & Authority Signals (15)
    private scoreMethodology(text: string) {
        const methodologyPatterns = [/methodology/i, /framework/i, /approach/i, /research/i, /analysis/i, /method/i];
        const hasMethodology = methodologyPatterns.some(p => p.test(text));

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No methodology or framework described.";

        if (hasMethodology) {
            score = 15;
            status = 'good';
            feedback = "Methodology or framework clearly described.";
        }

        return { score, max: 15, status, feedback };
    }

    // 5. Concept/Problem Definition (10)
    private scoreProblemDefinition(text: string) {
        // "Problem", "Challenge", "Opportunity", "Landscape"
        const problemPatterns = [/problem/i, /challenge/i, /pain point/i, /landscape/i, /current state/i];
        const hasProblem = problemPatterns.some(p => p.test(text));

        if (hasProblem) {
            return { score: 10, max: 10, status: 'good' as const, feedback: "Clear problem/landscape definition." };
        }
        return { score: 0, max: 10, status: 'warning' as const, feedback: "Define the 'Challenge' or 'Problem' space explicitly." };
    }

    // 6. Marketing Penalty
    private calculateMarketingPenalty(text: string) {
        const fluffPatterns = [
            /sign up/i, /buy now/i, /limited time/i, /subscribe/i, /book a demo/i, /contact sales/i
        ];
        let penaltyCount = 0;
        fluffPatterns.forEach(p => {
            const match = text.match(new RegExp(p, 'gi'));
            if (match) penaltyCount += match.length;
        });

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'good';
        let feedback = "Tone is professional.";

        if (penaltyCount >= 3) {
            score = -10;
            status = 'error';
            feedback = "Too many sales CTAs (Book Demo/Sign up). Remove for AEO.";
        }

        return { score, max: 0, status, feedback };
    }
}
