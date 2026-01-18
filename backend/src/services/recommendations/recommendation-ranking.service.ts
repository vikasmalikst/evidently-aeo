import type { RecommendationV3 } from './recommendation-v3.service';

type SourceMetric = {
  domain: string;
  citations: number;
  impactScore: number;
  soa: number;
  visibility: number;
  mentionRate: number;
  sentiment: number;
};

export type RankingInputs = {
  sourceMetrics?: SourceMetric[];
};

const effortToNumber: Record<string, number> = {
  Low: 1,
  Medium: 2,
  High: 3
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function normalizeCitations(citations: number): number {
  // Log-ish scaling to reduce dominance of huge domains.
  const x = Math.max(0, citations);
  return clamp01(Math.log10(1 + x) / 3); // ~1 at 999 citations
}

function normalizeImpact(impactScore: number): number {
  // Source attribution uses 0-10.
  return clamp01((impactScore ?? 0) / 10);
}

function normalizePercent100(x: number): number {
  return clamp01((x ?? 0) / 100);
}


function computeConfidence(m: SourceMetric | undefined, isTemplate: boolean): number {
  if (isTemplate) return 45;
  if (!m) return 55;
  if (m.citations >= 100) return 85;
  if (m.citations >= 50) return 78;
  if (m.citations >= 20) return 70;
  return 62;
}

function getStrategicRole(m: SourceMetric | undefined): RecommendationV3['strategicRole'] {
  if (!m) return 'Standard';

  const impact = normalizeImpact(m.impactScore); // 0-1
  const soa = m.soa / 100; // 0-1

  // Battleground: High Impact (>0.7), Low SOA (<0.2)
  if (impact >= 0.7 && soa <= 0.2) return 'Battleground';

  // Stronghold: High SOA (>0.5)
  if (soa >= 0.5) return 'Stronghold';

  // Opportunity: High Impact (>0.6), Moderate SOA (0.2-0.5)
  if (impact >= 0.6 && soa > 0.2 && soa < 0.5) return 'Opportunity';

  return 'Standard';
}

function calculateScore(m: SourceMetric | undefined, role: RecommendationV3['strategicRole'], isTemplate: boolean, priority: string): number {
  if (isTemplate) {
    // Template baseline (legacy logic)
    return priority === 'High' ? 0.45 : priority === 'Medium' ? 0.28 : 0.16;
  }

  if (!m) return 0.15; // Weak evidence

  const cit = normalizeCitations(m.citations);
  const imp = normalizeImpact(m.impactScore);
  const soa = normalizePercent100(m.soa);

  let roleBoost = 1.0;

  // Strategic weighting
  switch (role) {
    case 'Battleground':
      roleBoost = 1.5; // Top priority: Fight for high-value gaps
      break;
    case 'Opportunity':
      roleBoost = 1.2; // Growth area
      break;
    case 'Stronghold':
      roleBoost = 0.8; // Maintain, but less urgent than failing
      break;
    default:
      roleBoost = 1.0;
  }

  // Base Opportunity: (Impact + Citations) * (Uncaptured Share)
  // We heavily weight uncaptured share (1 - soa) to drive "growth" actions
  const baseScore = (cit * 0.4 + imp * 0.6) * (1 - soa);

  return clamp01(baseScore * roleBoost);
}

export function rankRecommendationsV3(
  recommendations: RecommendationV3[],
  inputs: RankingInputs
): RecommendationV3[] {
  const metrics = inputs.sourceMetrics ?? [];
  const metricsByDomain = new Map(metrics.map(m => [m.domain, m]));

  const scored = recommendations.map(rec => {
    const m = metricsByDomain.get(rec.citationSource || '');
    const isTemplate = rec.citationSource === 'owned-site' || rec.citationSource === 'directories';

    const effort = effortToNumber[rec.effort] ?? 2;

    // 1. Determine Strategic Role
    const strategicRole = isTemplate ? 'Standard' : getStrategicRole(m);

    // 2. Calculate Opportunity Score
    const opportunity = calculateScore(m, strategicRole, isTemplate, rec.priority);

    // 3. Final Ranking Score = Opportunity / Effort
    // We dampen the effort penalty slightly so high-value/hard tasks don't disappear
    const score = opportunity / Math.pow(effort, 0.8);

    // 4. Derive Priority Label (for UI)
    const priority =
      isTemplate ? rec.priority : score >= 0.30 ? 'High' : score >= 0.15 ? 'Medium' : 'Low';

    const confidence = computeConfidence(m, isTemplate);

    return {
      rec: {
        ...rec,
        priority, // Updated priority
        confidence,
        strategicRole, // NEW: Assign role
        calculatedScore: Math.round(score * 1000) / 1000
      },
      score
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.rec);
}


