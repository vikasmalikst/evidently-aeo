export const MAX_SCRAPABILITY_SCORE = 80;

export interface AEOScoreBreakdown {
    // Generic / Article
    primaryAnswer?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    // chunkability removed in favor of V2 universal metric
    conceptClarity?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    explanationDepth?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    comparison?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    authority?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    antiMarketing?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };

    // Expert Community Response Specific
    questionRelevance?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    earlyAnswerSignal?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    experienceSignals?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    informationalDensity?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    toneTrust?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    contextualReasoning?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    semanticClarity?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    followUpReadiness?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    verifiability?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };

    // Comparison Table Specific
    comparisonIntent?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    tableStructure?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    attributeQuality?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    neutralFactuality?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    semanticConsistency?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    contextualInterpretation?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    edgeCaseCoverage?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    timeliness?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    llmReadiness?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    // Social Media Thread Specific
    openingAnswerQuality?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    threadStructure?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    informationalDensity_sm?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string }; // _sm suffix to avoid conflict if desired, or reuse generic
    languageTone_sm?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    llmParsability?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    semanticClarity_sm?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    comparativeReasoning_sm?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    completenessOfExplanation?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    trustAuthoritySignals?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    followUpReadiness_sm?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };

    // V2 Metrics (Universal)
    chunkability?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    fleschReadability?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
    freshness?: { score: number; max: number; status: 'good' | 'warning' | 'error'; feedback: string };
}

export interface AEOScoreResult {
    totalScore: number;
    breakdown: AEOScoreBreakdown;
}

export interface IAEOScoringService {
    calculateScrapabilityScore(content: string): AEOScoreResult;
}
