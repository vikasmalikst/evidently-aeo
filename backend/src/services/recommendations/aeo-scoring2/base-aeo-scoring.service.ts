import { IAEOScoringService, AEOScoreResult } from '../aeo-scoring/base-aeo-scoring.interface';

/**
 * Base AEO Scoring Service V2
 * 
 * Implements the core scoring logic for:
 * 1. Chunkability (35 pts)
 * 2. Flesch Readability (35 pts)
 * 3. Freshness (30 pts)
 * 
 * Total: 100 pts
 */
export class BaseAEOScoringService implements IAEOScoringService {

    public calculateScrapabilityScore(content: string): AEOScoreResult {
        const text = content || '';

        // 1. Chunkability (35 pts)
        const chunkScore = this.scoreChunkability(text);

        // 2. Flesch Readability (35 pts)
        const readabilityScore = this.scoreFleschReadability(text);

        // 3. Freshness (30 pts)
        const freshnessScore = this.scoreFreshness(text);

        const total = chunkScore.score + readabilityScore.score + freshnessScore.score;

        return {
            totalScore: Math.min(100, total),
            breakdown: {
                chunkability: chunkScore,
                fleschReadability: readabilityScore,
                freshness: freshnessScore
            }
        };
    }

    // --- 1. Chunkability (35 pts) ---
    private scoreChunkability(text: string) {
        // Count Structural Elements
        const h2Count = (text.match(/^##\s/gm) || []).length;
        const h3Count = (text.match(/^###\s/gm) || []).length;
        const listItems = (text.match(/^(\s*[-*]|\s*\d+\.)\s/gm) || []).length;
        const tableRows = (text.match(/^\|/gm) || []).length;

        // Total "chunks" = headers + lists + rows
        // We want a healthy mix. 
        // 5+ headers is good.
        // 10+ list items is good.
        // 3+ table rows is good.

        let score = 0;
        let details = [];

        if (h2Count + h3Count >= 5) {
            score += 15;
            details.push("Good header structure");
        } else if (h2Count + h3Count >= 3) {
            score += 10;
            details.push("Basic header structure");
        } else {
            details.push("Lack of headers");
        }

        if (listItems >= 10) {
            score += 10;
            details.push("Good use of lists");
        } else if (listItems >= 5) {
            score += 5;
            details.push("Some lists found");
        }

        if (tableRows >= 3) {
            score += 10;
            details.push("Table data present");
        }

        // Cap at 35
        score = Math.min(35, score);

        // Define status
        let status: 'good' | 'warning' | 'error' = 'error';
        if (score >= 25) status = 'good';
        else if (score >= 15) status = 'warning';

        return {
            score,
            max: 35,
            status,
            feedback: details.join(', ') || "Content looks like a wall of text."
        };
    }

    // --- 2. Flesch Readability (35 pts) ---
    private scoreFleschReadability(text: string) {
        // Flesch-Kincaid Reading Ease Formula:
        // 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)

        const cleanText = text.replace(/[^a-zA-Z0-9.!?\s]/g, '');
        const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = cleanText.split(/\s+/).filter(w => w.trim().length > 0);

        const totalSentences = Math.max(1, sentences.length);
        const totalWords = Math.max(1, words.length);

        let totalSyllables = 0;
        words.forEach(word => {
            totalSyllables += this.countSyllables(word);
        });

        const asl = totalWords / totalSentences; // Average Sentence Length
        const asw = totalSyllables / totalWords; // Average Syllables per Word

        const fleschScore = 206.835 - (1.015 * asl) - (84.6 * asw);

        // Map Flesch (0-100) to our Points (0-35)
        // 60-70 is standard plain English. 
        // 90-100 is very easy (5th grade).
        // 0-30 is very difficult (university).

        // We want 60+ to be "Good".
        let points = 0;
        let feedback = "";
        let status: 'good' | 'warning' | 'error' = 'error';

        if (fleschScore >= 60) {
            points = 35;
            status = 'good';
            feedback = `Score: ${Math.round(fleschScore)}. Easy to read (Standard/Plain English).`;
        } else if (fleschScore >= 50) {
            points = 25;
            status = 'warning';
            feedback = `Score: ${Math.round(fleschScore)}. Fairly difficult. Simplify sentences.`;
        } else if (fleschScore >= 30) {
            points = 15;
            status = 'warning';
            feedback = `Score: ${Math.round(fleschScore)}. Difficult. Use shorter words.`;
        } else {
            points = 5;
            status = 'error';
            feedback = `Score: ${Math.round(fleschScore)}. Very confusing. Rewrite completely.`;
        }

        return { score: points, max: 35, status, feedback };
    }

    // Helper: Approximate Syllable Counter
    private countSyllables(word: string): number {
        word = word.toLowerCase();
        if (word.length <= 3) return 1;

        word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
        word = word.replace(/^y/, '');

        const syllables = word.match(/[aeiouy]{1,2}/g);
        return syllables ? syllables.length : 1;
    }

    // --- 3. Freshness (30 pts) ---
    private scoreFreshness(text: string) {
        // Check for current/future years
        const currentYear = new Date().getFullYear();
        const nextYear = currentYear + 1;
        const yearRegex = new RegExp(`\\b(${currentYear}|${nextYear})\\b`, 'g');

        const hasRecentYear = yearRegex.test(text);

        // Check for freshness keywords
        const freshnessKeywords = /updated|latest|new|current|as of|recent|trend|202[0-9]/i;
        const hasKeywords = freshnessKeywords.test(text);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "Content appears outdated.";

        if (hasRecentYear) {
            score = 30;
            status = 'good';
            feedback = `References current/next year (${currentYear}/${nextYear}).`;
        } else if (hasKeywords) {
            score = 15;
            status = 'warning';
            feedback = "Some freshness signals, but no specific current year found.";
        }

        return { score, max: 30, status, feedback };
    }
}
