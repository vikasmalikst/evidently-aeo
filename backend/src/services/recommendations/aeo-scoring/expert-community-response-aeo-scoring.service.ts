import { IAEOScoringService, AEOScoreResult } from './base-aeo-scoring.interface';

/**
 * Expert Community Response AEO Scoring Service (v2)
 * 
 * Aligned with 'Expert Community Response' criteria from reference doc.
 * Focuses on authenticity, first-hand experience, and direct answer delivery.
 */
export class ExpertCommunityResponseAEOScoringService implements IAEOScoringService {

    public calculateScrapabilityScore(content: string): AEOScoreResult {
        const text = content || '';

        // 1. Question Relevance & Targeting (15)
        const relevanceScore = this.scoreQuestionRelevance(text);

        // 2. Early Answer Signal (15)
        const earlyAnswerScore = this.scoreEarlyAnswer(text);

        // 3. First-Hand Expertise Signals (15)
        const expertiseScore = this.scoreExpertise(text);

        // 4. Informational Density (15)
        const densityScore = this.scoreInformationalDensity(text);

        // 5. Neutral, Trustable Tone (10)
        const toneScore = this.scoreTone(text);

        // 6. Comparative & Contextual Reasoning (10)
        const reasoningScore = this.scoreReasoning(text);

        // 7. Semantic & Terminology Clarity (10)
        const clarityScore = this.scoreSemanticClarity(text);

        // 8. Follow-Up Answer Readiness (10)
        const followUpScore = this.scoreFollowUpReadiness(text);

        // 9. Reference & Verifiability (Bonus +5)
        const verificationScore = this.scoreVerifiability(text);

        // Total Calculation (Total 100 + 5 bonus)
        // Base max is 100.
        let total = relevanceScore.score + earlyAnswerScore.score + expertiseScore.score +
            densityScore.score + toneScore.score + reasoningScore.score +
            clarityScore.score + followUpScore.score + verificationScore.score;

        // Cap at 100 (visual) but allow bonus internally if needed, logic says 100 total + 5 bonus.
        // We will return the raw sum up to 105.

        return {
            totalScore: Math.min(105, total),
            breakdown: {
                questionRelevance: relevanceScore,
                earlyAnswerSignal: earlyAnswerScore,
                experienceSignals: expertiseScore,
                informationalDensity: densityScore,
                toneTrust: toneScore,
                contextualReasoning: reasoningScore,
                semanticClarity: clarityScore,
                followUpReadiness: followUpScore,
                verifiability: verificationScore
            }
        };
    }

    // --- Dimension Scorers ---

    // 1. Question Relevance & Targeting (15)
    private scoreQuestionRelevance(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // Hard to know original question, but can look for "re-stating" signals
        // "To answer your question", "Regarding [keyword]", "The issue with..."
        const patterns = [
            /to answer/i, /regarding/i, /the issue is/i, /you asked/i,
            /your question/i, /specifically/i, /in this case/i
        ];
        const matches = patterns.filter(p => p.test(text)).length;

        let score = 5; // Base score for effort
        let status: 'good' | 'warning' | 'error' = 'warning';
        let feedback = "Restate or reference the specific user question.";

        if (matches >= 2) {
            score = 15;
            status = 'good';
            feedback = "Directly addresses the user context.";
        } else if (matches >= 1) {
            score = 10;
            status = 'good';
            feedback = "References the question context.";
        }

        return { score, max: 15, status, feedback };
    }

    // 2. Early Answer Signal (15)
    private scoreEarlyAnswer(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // First 6 sentences (increased from 3 to allow for "The Question" header section)
        const sentences = text.match(/[^.!?]+[.!?]/g) || [text];
        const firstBlock = sentences.slice(0, 6).join(' ');

        const directness = /yes|no|it depends|do this|don't|start by|the best way|my recommendation/i.test(firstBlock);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Answer effectively starts late. Put the 'Bottom Line' first.";

        if (directness) {
            score = 15;
            status = 'good';
            feedback = "Strong early answer signal.";
        } else {
            // Check for hedging
            const hedging = /maybe|i guess|possibly|might/i.test(firstBlock);
            if (hedging) {
                score = 5;
                status = 'error';
                feedback = "Using hedging language ('maybe', 'guess') destroys early trust.";
            } else {
                score = 8;
                status = 'warning';
                feedback = "Opening is neutral. Be more declarative.";
            }
        }

        return { score, max: 15, status, feedback };
    }

    // 3. First-Hand Expertise Signals (15)
    private scoreExpertise(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // "I have", "We found", "In my experience", "years of"
        const patterns = [
            /I (have|used|tested|managed|built|run)/i,
            /in my (experience|view|opinion)/i,
            /we (found|discovered|saw)/i,
            /years of/i,
            /personally/i,
            /my team/i
        ];
        const matches = patterns.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Lacks 'I-statements' or proof of lived experience.";

        if (matches >= 3) {
            score = 15;
            status = 'good';
            feedback = "Excellent first-hand expertise signals.";
        } else if (matches >= 1) {
            score = 8;
            status = 'warning';
            feedback = "Some first-hand signals, but could be stronger.";
        } else {
            score = 0;
            status = 'error';
            feedback = "Reads like generic advice. Use 'I' and 'My experience'.";
        }

        return { score, max: 15, status, feedback };
    }

    // 4. Informational Density (15)
    private scoreInformationalDensity(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // Proxy: Average sentence length (too short = fluff, too long = confusing) + Unique words
        // Better proxy: Paragraphs. Giant wall of text = bad. 
        // 1 paragraph per idea.

        const paragraphs = text.split(/\n\s*\n/).length;
        const wordCount = text.split(/\s+/).length;

        // Ideal: ~50-80 words per paragraph?
        const densityRatio = wordCount / (paragraphs || 1);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Structure is weak (wall of text).";

        if (densityRatio > 150) {
            score = 5;
            status = 'error';
            feedback = "Paragraphs are too long. Break them up for density scanning.";
        } else if (paragraphs >= 3) {
            score = 15;
            status = 'good';
            feedback = "Good information chunking.";
        } else if (paragraphs >= 2) {
            score = 10;
            status = 'warning';
            feedback = "Acceptable density.";
        }

        return { score, max: 15, status, feedback };
    }

    // 5. Neutral, Trustable Tone (10)
    private scoreTone(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        const promo = /buy|sign up|check out|best|amazing|revolutionary/i.test(text);

        if (promo) {
            return { score: 0, max: 10, status: 'error', feedback: "Tone is too promotional." };
        }

        // Defensive? "Actually," "You are wrong"
        const defensive = /you are wrong|actually|clearly/i.test(text);
        if (defensive) {
            return { score: 5, max: 10, status: 'warning', feedback: "Tone sounds defensive or condescending." };
        }

        return { score: 10, max: 10, status: 'good', feedback: "Tone is neutral and helpful." };
    }

    // 6. Comparative & Contextual Reasoning (10)
    private scoreReasoning(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // "Because", "This means", "However"
        const reasoningWords = [/because/i, /due to/i, /therefore/i, /however/i, /on the other hand/i, /depends on/i];
        const matches = reasoningWords.filter(p => p.test(text)).length;

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Lacks 'why' logic. Explain your reasoning.";

        if (matches >= 3) {
            score = 10;
            status = 'good';
            feedback = "Strong contextual reasoning.";
        } else if (matches >= 1) {
            score = 5;
            status = 'warning';
            feedback = "Minimal reasoning found.";
        }

        return { score, max: 10, status, feedback };
    }

    // 7. Semantic & Terminology Clarity (10)
    private scoreSemanticClarity(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // No slang, caps lock, excessive emoji
        const caps = (text.match(/[A-Z]{4,}/g) || []).length;
        const emoji = (text.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;

        if (caps > 2 || emoji > 3) {
            return { score: 5, max: 10, status: 'warning', feedback: "Reduce caps locks or emojis for authority." };
        }

        // Check for specific domain terms? Hard without context. 
        // Assume good if no bad signals.
        return { score: 10, max: 10, status: 'good', feedback: "Clean terminology." };
    }

    // 8. Follow-Up Answer Readiness (10)
    private scoreFollowUpReadiness(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // "Also", "Note that", "Keep in mind", "If you run into"
        const anticipation = [/also/i, /note that/i, /keep in mind/i, /alternatively/i, /if you/i];
        const matches = anticipation.filter(p => p.test(text)).length;

        if (matches >= 2) {
            return { score: 10, max: 10, status: 'good', feedback: "Proactively addresses potential follow-ups." };
        }
        return { score: 5, max: 10, status: 'warning', feedback: "Could anticipate next steps/questions better." };
    }

    // 9. Reference & Verifiability (Bonus +5)
    private scoreVerifiability(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        const refs = /http|www\.|source:|according to|reference/i.test(text);
        if (refs) {
            return { score: 5, max: 5, status: 'good', feedback: "Includes external verification/links." };
        }
        return { score: 0, max: 5, status: 'warning', feedback: "No specific references found (Bonus)." };
    }
}
