import type { RecommendationV3 } from './recommendation.types';

export type QualityResult = {
  ok: boolean;
  reasons: string[];
};

const DEFAULT_BANNED_PHRASES = [
  'improve seo',
  'create content',
  'enhance visibility',
  'optimize marketing',
  'build presence',
  'increase awareness'
];

function hasNumber(text: string): boolean {
  return /\d/.test(text);
}

function containsBannedPhrase(text: string, banned: string[]): string | null {
  const lower = (text || '').toLowerCase();
  for (const phrase of banned) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

function looksLikeSuccessCriteria(text: string): boolean {
  const lower = (text || '').toLowerCase();
  return (
    lower.includes('success criteria') ||
    lower.includes('success =') ||
    lower.includes('success:') ||
    lower.includes('measure success') ||
    lower.includes('within ') // crude but practical
  );
}

/**
 * Deterministic minimum quality contract.
 *
 * We avoid schema changes by checking for required info in existing fields
 * (action/reason/explanation/expectedBoost/timeline/citationSource).
 */
export function validateRecommendationV3(
  rec: RecommendationV3,
  opts?: { bannedPhrases?: string[] }
): QualityResult {
  const reasons: string[] = [];
  const banned = opts?.bannedPhrases ?? DEFAULT_BANNED_PHRASES;
  const strictGapReference = false; // enable later once LLM reliably includes numeric gaps in text

  const action = (rec.action || '').trim();
  const reason = (rec.reason || '').trim();
  const explanation = (rec.explanation || '').trim();
  const citationSource = (rec.citationSource || '').trim();
  const expectedBoost = (rec.expectedBoost || '').trim();
  const timeline = (rec.timeline || '').trim();

  // Required: non-empty action + citationSource + KPI/focusArea
  if (!action) reasons.push('Missing action');
  if (!citationSource) reasons.push('Missing citationSource');
  if (!rec.focusArea) reasons.push('Missing focusArea');
  if (!rec.kpi) reasons.push('Missing kpi');

  // Must not be generic
  const bannedHit = containsBannedPhrase(`${action} ${reason} ${explanation}`, banned);
  if (bannedHit) reasons.push(`Contains generic/banned phrase: "${bannedHit}"`);

  // Gap reference: require at least one numeric reference in reason or explanation if available
  // (Cold-start templates may not have numeric gaps, so allow if citationSource is "owned-site"/"directories")
  const isColdStartStyle = citationSource === 'owned-site' || citationSource === 'directories';
  if (strictGapReference && !isColdStartStyle && !(hasNumber(reason) || hasNumber(explanation))) {
    reasons.push('Missing numeric gap reference in reason/explanation');
  }

  // Success criteria: prefer explicit success criteria marker, otherwise require expectedBoost + timeline
  const hasSuccess = looksLikeSuccessCriteria(explanation) || looksLikeSuccessCriteria(reason);
  if (!hasSuccess) {
    if (!expectedBoost) reasons.push('Missing expectedBoost');
    if (!timeline) reasons.push('Missing timeline');
  }

  return { ok: reasons.length === 0, reasons };
}

export function filterLowQualityRecommendationsV3(
  recommendations: RecommendationV3[],
  opts?: { bannedPhrases?: string[] }
): { kept: RecommendationV3[]; removed: Array<{ recommendation: RecommendationV3; reasons: string[] }> } {
  const kept: RecommendationV3[] = [];
  const removed: Array<{ recommendation: RecommendationV3; reasons: string[] }> = [];

  for (const rec of recommendations) {
    const res = validateRecommendationV3(rec, opts);
    if (res.ok) kept.push(rec);
    else removed.push({ recommendation: rec, reasons: res.reasons });
  }

  return { kept, removed };
}


