export interface AEOScoreBreakdown {
    primaryAnswer: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    chunkability: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    conceptClarity: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    explanationDepth: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    comparison: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    authority: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    antiMarketing: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
}

export interface AEOScoreResult {
    totalScore: number;
    breakdown: AEOScoreBreakdown;
}

export interface IAEOScoringService {
    calculateScrapabilityScore(content: string): AEOScoreResult;
}
