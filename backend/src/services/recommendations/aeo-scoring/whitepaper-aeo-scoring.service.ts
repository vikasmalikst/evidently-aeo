import { IAEOScoringService, AEOScoreResult } from './base-aeo-scoring.interface';

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
                    text = parsed.sections.map((s: any) => `${s.title}\n${s.content}`).join('\n\n');

                    // Count sections as H2s
                    h2Count = parsed.sections.length;

                    // Check titles for H3-like depth or nested cues? 
                    // Usually V4 is flat sections, so let's check content for valid markdown H3s OR if sections > 5 treat as deep enough
                    const contentH3 = (text.match(/#{3}\s|class="h3"|<h3/gi) || []).length;
                    h3Count = contentH3;
                } else if (parsed.content) {
                    text = parsed.content;
                }
            }
        } catch (e) {
            // Raw text fallback
        }

        // If not V4, use Regex
        if (h2Count === 0) {
            h2Count = (text.match(/#{2}\s|class="h2"|<h2/gi) || []).length;
            h3Count = (text.match(/#{3}\s|class="h3"|<h3/gi) || []).length;
        }

        // 1. Executive Summary / Primary Answer (20 pts)
        // Whitepapers must have a summary for AEO.
        const answerScore = this.scoreExecutiveSummary(text);

        // 2. Structural Depth (10 pts)
        // Needs deep hierarchy (H2, H3).
        const structureScore = this.scoreStructuralDepth(h2Count, h3Count);

        // 3. Data & Citation Density (20 pts)
        // Higher threshold than articles.
        const dataScore = this.scoreDataDensity(text);

        // 4. Methodology & Authority Signals (10 pts)
        const authorityScore = this.scoreMethodology(text);

        // 5. Concept/Problem Definition (10 pts)
        const definitionScore = this.scoreProblemDefinition(text);

        // 6. Anti-Marketing Penalty
        const marketingPenalty = this.calculateMarketingPenalty(text);

        // Total Calculation (Max 70 distributed)
        // 20 + 10 + 20 + 10 + 10 = 70.
        let total = answerScore.score + structureScore.score + dataScore.score + authorityScore.score + definitionScore.score;

        // Apply penalty
        total = Math.max(0, total + marketingPenalty.score);

        return {
            totalScore: Math.min(70, total),
            breakdown: {
                primaryAnswer: answerScore, // Map generic key
                chunkability: structureScore, // Map generic key
                authority: dataScore, // Map generic key
                explanationDepth: authorityScore, // Map generic key (Using depth for methodology)
                conceptClarity: definitionScore, // Map generic key
                antiMarketing: marketingPenalty
            }
        };
    }

    // --- Dimension Scorers ---

    // 1. Executive Summary (20)
    private scoreExecutiveSummary(text: string) {
        // Look for "Executive Summary", "Key Findings", "Abstract", "Management Summary"
        // And it ideally should be at the start (first 20% of text).
        const firstPart = text.slice(0, Math.floor(text.length * 0.3));
        const patterns = [/executive summary/i, /key findings/i, /abstract/i, /management summary/i, /overview/i];

        const hasSummary = patterns.some(p => p.test(firstPart));

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No 'Executive Summary' found. Essential for whitepapers.";

        if (hasSummary) {
            score = 20;
            status = 'good';
            feedback = "Executive summary detected.";
        } else {
            // Fallback: Check for bullet points early on?
            const hasBullets = (firstPart.match(/^[-*•]/m) || []).length > 2;
            if (hasBullets) {
                score = 10;
                status = 'warning';
                feedback = "Bullet points found early, but explicit 'Executive Summary' is better.";
            }
        }

        return { score, max: 20, status, feedback };
    }

    // 2. Structural Depth (10)
    private scoreStructuralDepth(h2Count: number, h3Count: number) {
        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Structure is flat. Use H2 and H3 for hierarchy.";

        // For V4 JSON, sections are effectively H2s. 
        // We relax the H3 requirement if there are enough H2 sections (>=5) as that implies depth.
        if (h2Count >= 4 && (h3Count >= 2 || h2Count >= 6)) {
            score = 10;
            status = 'good';
            feedback = "Deep, well-structured hierarchy.";
        } else if (h2Count >= 3) {
            score = 5;
            status = 'warning';
            feedback = "Basic structure present. Add subsections (H3) for granular AEO.";
        }

        return { score, max: 10, status, feedback };
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

    // 4. Methodology & Authority Signals (10)
    private scoreMethodology(text: string) {
        // "Methodology", "We analyzed", "Our approach", "Datasets"
        const patterns = [/methodology/i, /we analyzed/i, /our approach/i, /data sources/i, /participants/i];
        const matches = patterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No methodology signal detected.";

        if (matches >= 1) {
            score = 10;
            status = 'good';
            feedback = "Methodology/Approach referenced.";
        } else {
            // Check for "Expert" signals
            if (/expert/i.test(text) || /author/i.test(text)) {
                score = 5;
                status = 'warning';
                feedback = "Expertise mentioned, but explicit 'Methodology' section preferred.";
            }
        }

        return { score, max: 10, status, feedback };
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
