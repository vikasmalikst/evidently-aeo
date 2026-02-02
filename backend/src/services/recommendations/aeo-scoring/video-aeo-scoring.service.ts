import { IAEOScoringService, AEOScoreResult } from './base-aeo-scoring.interface';

export class VideoAEOScoringService implements IAEOScoringService {
    public calculateScrapabilityScore(content: string): AEOScoreResult {
        let totalScore = 0;
        const maxScore = 100;
        const breakdown: AEOScoreResult['breakdown'] = {
            primaryAnswer: { score: 0, max: 20, status: 'warning', feedback: "Missing clear direct answer." },
            chunkability: { score: 0, max: 20, status: 'warning', feedback: "Content is monolithic." },
            conceptClarity: { score: 0, max: 20, status: 'warning', feedback: "Missing Hook or setup." },
            explanationDepth: { score: 0, max: 20, status: 'warning', feedback: "Missing Takeaway or detailed explanation." },
            comparison: { score: 0, max: 10, status: 'warning', feedback: "No clear sections detected." },
            authority: { score: 0, max: 10, status: 'warning', feedback: "Missing authority signals." },
            antiMarketing: { score: 0, max: 0, status: 'good', feedback: "N/A" }
        };

        // Rescale to max 70pts (Backend Portion)
        // 1. Concept Clarity (Hook) - 15pts
        if (/hook/i.test(content) || /\[0-[0-9]+s\]/i.test(content)) {
            breakdown.conceptClarity.score = 15;
            breakdown.conceptClarity.status = 'good';
            breakdown.conceptClarity.feedback = "Clear Hook/Intro detected.";
            totalScore += 15;
        }

        // 2. Primary Answer (Answer/Direct Response) - 15pts
        if (/answer/i.test(content) || /direct answer/i.test(content)) {
            breakdown.primaryAnswer.score = 15;
            breakdown.primaryAnswer.status = 'good';
            breakdown.primaryAnswer.feedback = "Direct Answer section detected.";
            totalScore += 15;
        }

        // 3. Explanation Depth (Explanation/Body) - 15pts
        if (/explanation/i.test(content) || /body/i.test(content)) {
            breakdown.explanationDepth.score = 15;
            breakdown.explanationDepth.status = 'good';
            breakdown.explanationDepth.feedback = "Detailed Explanation detected.";
            totalScore += 15;
        }

        // 4. Chunkability (Takeaway/Outro) - 10pts
        if (/takeaway/i.test(content) || /outro/i.test(content) || /conclusion/i.test(content)) {
            breakdown.chunkability.score = 10;
            breakdown.chunkability.status = 'good';
            breakdown.chunkability.feedback = "Clear Takeaway/Outro detected.";
            totalScore += 10;
        }

        // 5. Comparisons (Check for comparative language) - 5pts
        // Look for explicit comparison keywords separate from structure
        if (/combin|compar|versus|unlike|differs|similar/i.test(content) || /competitor/i.test(content)) {
            breakdown.comparison.score = 5;
            breakdown.comparison.status = 'good';
            breakdown.comparison.feedback = "Comparative language found.";
            totalScore += 5;
        } else {
            breakdown.comparison.score = 2; // Partial credit
            breakdown.comparison.status = 'warning';
            breakdown.comparison.feedback = "Consider adding direct comparisons.";
            totalScore += 2;
        }

        // 6. Authority (Production Tips) - 10pts
        if (/production/i.test(content) || /visual/i.test(content) || /camera/i.test(content)) {
            breakdown.authority.score = 10;
            breakdown.authority.status = 'good';
            breakdown.authority.feedback = "Production guidelines included.";
            totalScore += 10;
        }

        return {
            totalScore,
            breakdown
        };
    }
}
