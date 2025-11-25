/**
 * API Key Resolver
 * 
 * Maps numbered API keys to specific operations with fallback logic:
 * 
 * CEREBRAS_API_KEY_1 -> Position Extraction (fallback: CEREBRAS_API_KEY)
 * CEREBRAS_API_KEY_2 -> Sentiment Scoring (fallback: CEREBRAS_API_KEY)
 * GOOGLE_GEMINI_API_KEY_3 -> Citation Categorization (fallback: GOOGLE_GEMINI_API_KEY)
 * CEREBRAS_API_KEY_3 -> Keyword Generation (fallback: CEREBRAS_API_KEY)
 * CEREBRAS_API_KEY_4 -> Topic/Query Generation (fallback: CEREBRAS_API_KEY)
 */

/**
 * Get API key for Position Extraction
 * Uses CEREBRAS_API_KEY_1, falls back to CEREBRAS_API_KEY
 */
export function getPositionExtractionKey(): string | null {
  return process.env.CEREBRAS_API_KEY_1 || process.env.CEREBRAS_API_KEY || null;
}

/**
 * Get API key for Sentiment Scoring
 * Uses CEREBRAS_API_KEY_2, falls back to CEREBRAS_API_KEY
 */
export function getSentimentScoringKey(): string | null {
  return process.env.CEREBRAS_API_KEY_2 || process.env.CEREBRAS_API_KEY || null;
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
export function getCerebrasModel(defaultModel: string = 'qwen-3-235b-a22b-instruct-2507'): string {
  return process.env.CEREBRAS_MODEL || defaultModel;
}

