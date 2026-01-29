import { IAEOScoringService, AEOScoreResult } from './base-aeo-scoring.interface';

export class VideoAEOScoringService implements IAEOScoringService {
    public calculateScrapabilityScore(content: string): AEOScoreResult {
        // TODO: Implement Video/Transcript scoring (Timestamps, verbal framing, etc.)
        return {
            totalScore: 0,
            breakdown: {
                primaryAnswer: { score: 0, max: 15, status: 'warning', feedback: "Video scoring not yet implemented." },
                chunkability: { score: 0, max: 10, status: 'warning', feedback: "Not implemented" },
                conceptClarity: { score: 0, max: 10, status: 'warning', feedback: "Not implemented" },
                explanationDepth: { score: 0, max: 10, status: 'warning', feedback: "Not implemented" },
                comparison: { score: 0, max: 10, status: 'warning', feedback: "Not implemented" },
                authority: { score: 0, max: 15, status: 'warning', feedback: "Not implemented" },
                antiMarketing: { score: 0, max: 0, status: 'good', feedback: "Not implemented" }
            }
        };
    }
}
