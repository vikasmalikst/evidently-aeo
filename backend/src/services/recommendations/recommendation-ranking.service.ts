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

function baseOpportunityFromSource(m: SourceMetric | undefined): number {
  if (!m) return 0.15; // weak evidence
  const cit = normalizeCitations(m.citations);
  const imp = normalizeImpact(m.impactScore);
  const soa = normalizePercent100(m.soa);
  // Opportunity is higher when citations+impact are high and SOA is low.
  return clamp01((cit * 0.5 + imp * 0.5) * (1 - soa));
}

function computeConfidence(m: SourceMetric | undefined, isTemplate: boolean): number {
  if (isTemplate) return 45;
  if (!m) return 55;
  if (m.citations >= 100) return 85;
  if (m.citations >= 50) return 78;
  if (m.citations >= 20) return 70;
  return 62;
}

export function rankRecommendationsV3(
  recommendations: RecommendationV3[],
  inputs: RankingInputs
): RecommendationV3[] {
  const metrics = inputs.sourceMetrics ?? [];
  const metricsByDomain = new Map(metrics.map(m => [m.domain, m]));

  const scored = recommendations.map(rec => {
    const m = metricsByDomain.get(rec.citationSource || '');
    // Template detection: non-domain citationSource markers
    const isTemplate = rec.citationSource === 'owned-site' || rec.citationSource === 'directories';

    const effort = effortToNumber[rec.effort] ?? 2;

    // For cold-start templates, keep the template's priority and score them in a stable way.
    // (Otherwise they'd all get "Low" because there is no sourceMetrics evidence.)
    const templateBase =
      rec.priority === 'High' ? 0.45 : rec.priority === 'Medium' ? 0.28 : 0.16;

    const opportunity = isTemplate ? templateBase : baseOpportunityFromSource(m);
    const score = opportunity / effort;

    // Determine priority buckets (only override for non-template recommendations)
    const priority =
      isTemplate ? rec.priority : score >= 0.35 ? 'High' : score >= 0.2 ? 'Medium' : 'Low';

    const confidence = computeConfidence(m, isTemplate);

    return {
      rec: {
        ...rec,
        priority,
        confidence,
        calculatedScore: Math.round(score * 1000) / 1000
      },
      score
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.rec);
}


