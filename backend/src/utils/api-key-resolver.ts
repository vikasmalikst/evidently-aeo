

export function getPositionExtractionKey(): string | null {
  return process.env.CEREBRAS_API_KEY_1 || process.env.CEREBRAS_API_KEY || null;
}

/**
 * Get API key for Sentiment Scoring (Brand sentiment)
 * Uses CEREBRAS_API_KEY_5 ONLY (no fallback)
 */
export function getSentimentScoringKey(): string | null {
  return process.env.CEREBRAS_API_KEY_5 || null;
}

/**
 * Get API key for Competitor Sentiment Scoring
 * Uses CEREBRAS_API_KEY_4 ONLY (no fallback)
 */
export function getCompetitorSentimentScoringKey(): string | null {
  return process.env.CEREBRAS_API_KEY_4 || null;
}

/**
 * Get API key for Citation Categorization
 * Uses GOOGLE_GEMINI_API_KEY_3, falls back to GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY
 */
export function getCitationCategorizationKey(): string | null {
  return (
    process.env.GOOGLE_GEMINI_API_KEY_3 ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    null
  );
}

/**
 * Get API key for Keyword Generation
 * Uses CEREBRAS_API_KEY_3, falls back to CEREBRAS_API_KEY
 */
export function getKeywordGenerationKey(): string | null {
  return process.env.CEREBRAS_API_KEY_3 || process.env.CEREBRAS_API_KEY || null;
}

/**
 * Get API key for Topic/Query Generation
 * Uses CEREBRAS_API_KEY_4, falls back to CEREBRAS_API_KEY
 */
export function getTopicQueryGenerationKey(): string | null {
  return process.env.CEREBRAS_API_KEY_4 || process.env.CEREBRAS_API_KEY || null;
}

export const getBraveApiKey = (): string | null => {
  return process.env.BRAVE_API_KEY || null;
};

// Serper API key removed


/**
 * Get fallback Cerebras API key (generic)
 */
export function getCerebrasKey(): string | null {
  return process.env.CEREBRAS_API_KEY || null;
}

/**
 * Get fallback Gemini API key (generic)
 */
export function getGeminiKey(): string | null {
  return (
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    null
  );
}

/**
 * Get Gemini model name (supports both GOOGLE_GEMINI_MODEL and GEMINI_MODEL)
 */
export function getGeminiModel(defaultModel: string = 'gemini-1.5-flash'): string {
  return (
    process.env.GOOGLE_GEMINI_MODEL ||
    process.env.GEMINI_MODEL ||
    defaultModel
  );
}

/**
 * Get Cerebras model name
 */
export function getCerebrasModel(defaultModel: string = 'zai-glm-4.6'): string {
  return process.env.CEREBRAS_MODEL || defaultModel;
}

