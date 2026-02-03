import { IAEOScoringService, AEOScoreResult } from './base-aeo-scoring.interface';

export class VideoAEOScoringService implements IAEOScoringService {
    public calculateScrapabilityScore(content: string): AEOScoreResult {
        let totalScore = 0;
        const maxScore = 100;
        const breakdown: AEOScoreResult['breakdown'] = {
            primaryAnswer: { score: 0, max: 20, status: 'warning', feedback: "Missing clear direct answer." },
            // chunkability removed - not relevant for video structure
            conceptClarity: { score: 0, max: 20, status: 'warning', feedback: "Missing Hook or setup." },
            explanationDepth: { score: 0, max: 20, status: 'warning', feedback: "Missing Takeaway or detailed explanation." },
            comparison: { score: 0, max: 10, status: 'warning', feedback: "No clear sections detected." },
            authority: { score: 0, max: 15, status: 'warning', feedback: "Missing authority signals." },
            antiMarketing: { score: 0, max: 0, status: 'good', feedback: "N/A" }
        };

        // Rescale to max 70pts (Backend Portion)
        // 1. Concept Clarity (Hook) - 20pts (increased from 15)
        if (/hook/i.test(content) || /\[0-[0-9]+s\]/i.test(content)) {
            breakdown.conceptClarity.score = 20;
            breakdown.conceptClarity.status = 'good';
            breakdown.conceptClarity.feedback = "Clear Hook/Intro detected.";
            totalScore += 20;
        }

        // 2. Primary Answer (Answer/Direct Response) - 15pts
        if (/answer/i.test(content) || /direct answer/i.test(content)) {
            breakdown.primaryAnswer.score = 15;
            breakdown.primaryAnswer.status = 'good';
            breakdown.primaryAnswer.feedback = "Direct Answer section detected.";
            totalScore += 15;
        }

        // 3. Explanation Depth (Explanation/Body) - 20pts (includes Takeaway/Outro scoring)
        let explanationScore = 0;
        if (/explanation/i.test(content) || /body/i.test(content)) {
            explanationScore += 15;
        }
        // Include Takeaway/Outro as part of explanation depth
        if (/takeaway/i.test(content) || /outro/i.test(content) || /conclusion/i.test(content)) {
            explanationScore += 5;
        }
        if (explanationScore > 0) {
            breakdown.explanationDepth.score = explanationScore;
            breakdown.explanationDepth.status = explanationScore >= 15 ? 'good' : 'warning';
            breakdown.explanationDepth.feedback = explanationScore >= 15
                ? "Detailed Explanation with Takeaway detected."
                : "Partial explanation found.";
            totalScore += explanationScore;
        }

        // 4. Comparisons (Check for comparative language) - 5pts
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

        // 5. Authority (Production Tips) - 15pts (increased from 10)
        if (/production/i.test(content) || /visual/i.test(content) || /camera/i.test(content)) {
            breakdown.authority.score = 15;
            breakdown.authority.status = 'good';
            breakdown.authority.feedback = "Production guidelines included.";
            totalScore += 15;
        }

        return {
            totalScore,
            breakdown
        };
    }
}
