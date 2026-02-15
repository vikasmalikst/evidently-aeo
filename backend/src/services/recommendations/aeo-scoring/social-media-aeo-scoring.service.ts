import { IAEOScoringService, AEOScoreResult, MAX_SCRAPABILITY_SCORE } from './base-aeo-scoring.interface';

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
        // v5.0 Content Strategy: Flat Markdown with "## Post 1", "## Post 2" or numbered items
        // Heuristic: Split by "## Post" or double newlines with numbers if headers missing
        const postSplit = text.split(/##\s*Post/i);
        if (postSplit.length > 1) {
            posts = postSplit.slice(1); // Skip preamble
        } else {
            // Fallback: split by double newlines
            posts = text.split('\n\n').filter(p => p.length > 20);
        }

        // Rescaled for 80pts Total:
        // 1. Opening Answer Quality (10)
        const openingAnswer = this.scoreOpeningAnswer(posts, text);

        // 2. Thread Structure (10)
        const structureScore = this.scoreThreadStructure(posts);

        // 3. Informational Density (10)
        const densityScore = this.scoreInfoDensity(text);

        // 4. Language & Tone (5)
        const toneScore = this.scoreTone(text);

        // 5. LLM Parsability (10)
        const parsabilityScore = this.scoreParsability(text);

        // 6. Semantic Clarity (5)
        const clarityScore = this.scoreClarity(text);

        // 7. Comparative Reasoning (10)
        const reasoningScore = this.scoreReasoning(text);

        // 8. Completeness (10)
        const completenessScore = this.scoreCompleteness(text);

        // 9. Trust (5)
        const trustScore = this.scoreTrust(text);

        // 10. Follow-Up (5)
        const followUpScore = this.scoreFollowUpReadiness(text);

        // Total = 10+10+10+5+10+5+10+10+5+5 = 80
        let total = openingAnswer.score + structureScore.score + densityScore.score +
            toneScore.score + parsabilityScore.score + clarityScore.score +
            reasoningScore.score + completenessScore.score + trustScore.score + followUpScore.score;

        return {
            totalScore: Math.min(MAX_SCRAPABILITY_SCORE, total),
            breakdown: {
                // Suffix _sm keys to match interface if needed, or map strictly
                // Interface defines generic keys. Let's map best effort.
                primaryAnswer: openingAnswer,
                chunkability: structureScore,
                conceptClarity: clarityScore,
                explanationDepth: reasoningScore,
                authority: trustScore,
                // Add custom ones as extended properties if supported, or map to closest
                // For now, mapping to generics where possible, but interface might limit us.
                // We'll trust the Any typing on breakdown in some contexts, strictly satisfying interface though:
                antiMarketing: { score: 0, max: 0, status: 'good' as const, feedback: "N/A" },
                informationalDensity_sm: densityScore, // Custom for SM
                languageTone_sm: toneScore, // Custom for SM
                llmParsability: parsabilityScore, // Custom for SM
                completenessOfExplanation: completenessScore, // Custom for SM
                followUpReadiness_sm: followUpScore // Custom for SM
            }
        };
    }

    private scoreOpeningAnswer(posts: string[], text: string) {
        // Check first post or first 50 words
        const firstSegment = posts.length > 0 ? posts[0] : text.slice(0, 300);
        const hasHook = /🧵|Thread|👇|Here's how|Stop doing|My strategy/i.test(firstSegment);

        if (hasHook) return { score: 10, max: 10, status: 'good' as const, feedback: "Strong hook detected." };
        return { score: 5, max: 10, status: 'warning' as const, feedback: "Weak hook." };
    }

    private scoreThreadStructure(posts: string[]) {
        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Thread structure undefined.";

        if (posts.length >= 4) {
            score += 10;
            status = 'good';
            feedback = "Good thread length and segmentation.";
        } else if (posts.length >= 2) {
            score += 5;
            status = 'warning';
            feedback = "Thread is too short for deep explanation. Add more posts.";
        }

        return { score, max: 10, status, feedback };
    }

    private scoreInfoDensity(text: string) {
        // Look for numbers, specific terms, constraints
        const specificPatterns = [/\d+/, /step/i, /first/i, /second/i, /because/i, /requires/i];
        const matchCount = specificPatterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Content feels fluffy. Add concrete details.";

        if (matchCount >= 4) {
            score = 10;
            status = 'good';
            feedback = "High informational density.";
        } else if (matchCount >= 2) {
            score = 5;
            status = 'warning';
            feedback = "Moderate density. Add more specific data/steps.";
        }

        return { score, max: 10, status, feedback };
    }

    private scoreTone(text: string) {
        // Negative penalties for promo
        const promo = /click link|bio|subscribe|follow me/i.test(text);
        if (promo) {
            return { score: 0, max: 5, status: 'warning' as const, feedback: "Promotional language detected. Keep it neutral." };
        }
        return { score: 5, max: 5, status: 'good' as const, feedback: "Neutral, expert tone." };
    }

    private scoreParsability(text: string) {
        // Check post length (ideal ~200 chars) - now using overall text length as posts are less reliable
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
        let score = 0;

        if (wordCount > 100 && wordCount < 1000) { // Aim for a reasonable total length
            score = 10;
            return { score, max: 10, status: 'good' as const, feedback: "Good overall length for parsing." };
        }
        return { score: 5, max: 10, status: 'warning' as const, feedback: "Content is either too short or too long." };
    }

    private scoreClarity(text: string) {
        const definitions = /is a|refers to|defined as|means/i.test(text);
        if (definitions) {
            return { score: 5, max: 5, status: 'good' as const, feedback: "Clear semantic definitions found." };
        }
        return { score: 2, max: 5, status: 'warning' as const, feedback: "Define key terms explicitly for better clarity." };
    }

    private scoreReasoning(text: string) {
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

    private scoreTrust(text: string) {
        const trustSignals = /limitations|assumptions|constraints|fail|note/i.test(text);
        if (trustSignals) return { score: 5, max: 5, status: 'good' as const, feedback: "Honest assessment of limitations detected." };
        return { score: 2, max: 5, status: 'warning' as const, feedback: "Add limitations/constraints to build trust." };
    }

    private scoreFollowUpReadiness(text: string) {
        if (/\?/.test(text.slice(-200))) { // Question near end
            return { score: 5, max: 5, status: 'good' as const, feedback: "Anticipates follow-up questions." };
        }
        return { score: 0, max: 5, status: 'warning' as const, feedback: "No clear follow-up/FAQ section detected." };
    }
}
