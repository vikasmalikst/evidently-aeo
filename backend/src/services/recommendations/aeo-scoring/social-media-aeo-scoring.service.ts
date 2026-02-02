import { IAEOScoringService, AEOScoreResult } from './base-aeo-scoring.interface';

/**
 * Social Media Thread AEO Scoring Service
 * 
 * Implements the scoring logic for Social Media Threads (X/LinkedIn) as defined in social-media-scoring.md.
 * Evaluates scrapability, structure, and informational density.
 * Total Score: 100 (+5 Bonus)
 */
export class SocialMediaAEOScoringService implements IAEOScoringService {

    public calculateScrapabilityScore(content: string): AEOScoreResult {
        let text = content || '';
        let sections: any[] = [];
        let posts: string[] = [];

        // Parse V4/JSON structure
        try {
            if (text.trim().startsWith('{')) {
                const parsed = JSON.parse(text);
                if (parsed.sections && Array.isArray(parsed.sections)) {
                    sections = parsed.sections;
                    // Reconstruct text for regex analysis
                    text = parsed.sections.map((s: any) => `${s.title}\n${s.content}`).join('\n\n');
                    // Treat each section as a post for analysis
                    posts = parsed.sections.map((s: any) => s.content);
                } else if (parsed.content) {
                    text = parsed.content;
                }
            }
        } catch (e) {
            // Raw text fallback - try to split by numbered lists or double newlines
            posts = text.split(/\n\d+\.?\s+/).filter(p => p.trim().length > 0);
        }

        // 1. Opening Answer Quality (15)
        const openingAnswer = this.scoreOpeningAnswer(sections, text);

        // 2. Thread Structure & Coherence (15)
        const structure = this.scorestructure(sections, posts);

        // 3. Informational Density (15)
        const density = this.scoreInformationalDensity(text);

        // 4. Language & Tone (10)
        const tone = this.scoreTone(text);

        // 5. LLM Parsability (15)
        const parsability = this.scoreParsability(text, posts);

        // 6. Semantic Clarity (10)
        const clarity = this.scoreSemanticClarity(text);

        // 7. Comparative Reasoning (10)
        const comparison = this.scoreComparativeReasoning(text);

        // 8. Completeness of Explanation (10)
        const completeness = this.scoreCompleteness(text);

        // 9. Trust & Authority Signals (10)
        const trust = this.scoreTrustSignals(text);

        // 10. Follow-Up Readiness (Bonus +5)
        const followUp = this.scoreFollowUpReadiness(text);

        // Total Calculation (Max 100 + 5)
        let total = openingAnswer.score + structure.score + density.score + tone.score +
            parsability.score + clarity.score + comparison.score + completeness.score +
            trust.score + followUp.score;

        // Cap at 100 for standard scoring, unless we want to show >100. 
        // The interface often expects a max, let's treat it as a % or raw score.
        // The base interface implies we usually sum up to a specific max. 
        // Let's cap at 100 for consistency, or return the raw total if the UI handles it.
        // Assuming standard behavior is to cap at max defined in UI or here.

        return {
            totalScore: Math.min(100, total),
            breakdown: {
                openingAnswerQuality: openingAnswer,
                threadStructure: structure,
                informationalDensity_sm: density,
                languageTone_sm: tone,
                llmParsability: parsability,
                semanticClarity_sm: clarity,
                comparativeReasoning_sm: comparison,
                completenessOfExplanation: completeness,
                trustAuthoritySignals: trust,
                followUpReadiness_sm: followUp
            }
        };
    }

    private scoreOpeningAnswer(sections: any[], text: string) {
        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No clear opening answer found.";

        const firstSection = sections.length > 0 ? sections[0] : null;
        if (firstSection && /answer|hook|opening|opener/i.test(firstSection.id || firstSection.title)) {
            // Check if it has a direct answer
            if (firstSection.content.length > 50 && !/\?$/.test(firstSection.content.trim())) {
                score += 15; // Max score if structure is perfect
                status = 'good';
                feedback = "Strong opening answer detected in first post.";
            } else {
                score += 5;
                status = 'warning';
                feedback = "Opening post exists but lacks a direct declarative answer.";
            }
        } else {
            // Regex fallback for raw text
            if (/^.{0,100}(answer|is|means|refers to)/i.test(text)) {
                score += 8;
                status = 'warning';
                feedback = "Opening likely contains answer, but structure is unclear.";
            }
        }

        return { score, max: 15, status, feedback };
    }

    private scorestructure(sections: any[], posts: string[]) {
        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Thread structure undefined.";

        if (sections.length >= 4 || posts.length >= 4) {
            score += 15;
            status = 'good';
            feedback = "Good thread length and segmentation.";
        } else if (sections.length >= 2) {
            score += 8;
            status = 'warning';
            feedback = "Thread is too short for deep explanation. Add more posts.";
        }

        return { score, max: 15, status, feedback };
    }

    private scoreInformationalDensity(text: string) {
        // Look for numbers, specific terms, constraints
        const specificPatterns = [/\d+/, /step/i, /first/i, /second/i, /because/i, /requires/i];
        const matchCount = specificPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Content feels fluffy. Add concrete details.";

        if (matchCount >= 4) {
            score = 15;
            status = 'good';
            feedback = "High informational density.";
        } else if (matchCount >= 2) {
            score = 8;
            status = 'warning';
            feedback = "Moderate density. Add more specific data/steps.";
        }

        return { score, max: 15, status, feedback };
    }

    private scoreTone(text: string) {
        // Negative penalties for promo
        const promo = /click link|bio|subscribe|follow me/i.test(text);
        if (promo) {
            return { score: 0, max: 10, status: 'warning' as const, feedback: "Promotional language detected. Keep it neutral." };
        }
        return { score: 10, max: 10, status: 'good' as const, feedback: "Neutral, expert tone." };
    }

    private scoreParsability(text: string, posts: string[]) {
        // Check post length (ideal ~200 chars)
        const avgLength = posts.reduce((a, b) => a + b.length, 0) / (posts.length || 1);
        let score = 0;

        if (avgLength > 50 && avgLength < 350) {
            score = 15;
            return { score, max: 15, status: 'good' as const, feedback: "Excellent post length for parsing." };
        }
        return { score: 5, max: 15, status: 'warning' as const, feedback: "Posts are either too short or too long (aim for ~200 chars)." };
    }

    private scoreSemanticClarity(text: string) {
        const definitions = /is a|refers to|defined as|means/i.test(text);
        if (definitions) {
            return { score: 10, max: 10, status: 'good' as const, feedback: "Clear semantic definitions found." };
        }
        return { score: 4, max: 10, status: 'warning' as const, feedback: "Define key terms explicitly for better clarity." };
    }

    private scoreComparativeReasoning(text: string) {
        const comparisons = /vs|unlike|compared to|trade-off|however/i.test(text);
        if (comparisons) {
            return { score: 10, max: 10, status: 'good' as const, feedback: "Good comparative reasoning present." };
        }
        return { score: 3, max: 10, status: 'warning' as const, feedback: "Lack of comparison. Explain trade-offs/alternatives." };
    }

    private scoreCompleteness(text: string) {
        // Rough heuristic for "completeness" keywords
        const keywords = ['why', 'how', 'when', 'example'];
        const matches = keywords.filter(k => text.toLowerCase().includes(k)).length;

        if (matches >= 3) return { score: 10, max: 10, status: 'good' as const, feedback: "Comprehensive coverage." };
        return { score: 5, max: 10, status: 'warning' as const, feedback: "Missing key dimensions (Why/How/When)." };
    }

    private scoreTrustSignals(text: string) {
        const trustSignals = /limitations|assumptions|constraints|fail|note/i.test(text);
        if (trustSignals) return { score: 10, max: 10, status: 'good' as const, feedback: "Honest assessment of limitations detected." };
        return { score: 4, max: 10, status: 'warning' as const, feedback: "Add limitations/constraints to build trust." };
    }

    private scoreFollowUpReadiness(text: string) {
        if (/\?/.test(text.slice(-200))) { // Question near end
            return { score: 5, max: 5, status: 'good' as const, feedback: "Anticipates follow-up questions." };
        }
        return { score: 0, max: 5, status: 'warning' as const, feedback: "No clear follow-up/FAQ section detected." };
    }
}
