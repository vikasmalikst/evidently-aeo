import { useMemo, useState } from 'react';
import { Layout } from '../components/Layout/Layout';
import { useCachedData } from '../hooks/useCachedData';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';
import type { EnhancedSource } from '../components/SourcesR2/EnhancedQuadrantMatrix';
import { ValueScoreTable } from '../components/SourcesR2/ValueScoreTable';
import { SummaryCards } from '../components/SourcesR2/SummaryCards';
import { SourceRadar } from '../components/SourcesR2/SourceRadar';
import { DateRangePicker } from '../components/DateRangePicker/DateRangePicker';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface SourceData {
  name: string;
  url: string;
  type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional';
  mentionRate: number;
  mentionChange: number;
  soa: number;
  soaChange: number;
  sentiment: number;
  sentimentChange: number;
  citations: number;
  topics: string[];
  prompts: string[];
  pages: string[];
}

interface SourceAttributionResponse {
  sources: SourceData[];
  overallMentionRate: number;
  overallMentionChange: number;
  avgSentiment: number;
  avgSentimentChange: number;
}

type ViewMode = 'current' | 'newZones';

const median = (nums: number[]): number => {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const percentile = (nums: number[], p: number): number => {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
};

type NewZone = 'marketLeaders' | 'reputationRisks' | 'growthBets' | 'monitorImprove';

const classifyNewZone = (
  mentionPct: number,
  soaPct: number,
  sentimentPct: number,
  citationsPct: number,
  score: number,
  cutoffs: {
    scoreP75: number;
    scoreMedian: number;
    mentionMedian: number;
    soaMedian: number;
  }
): NewZone => {
  if (score >= cutoffs.scoreP75 && sentimentPct >= 50 && citationsPct >= 25) {
    return 'marketLeaders';
  }

  if ((mentionPct >= cutoffs.mentionMedian || soaPct >= cutoffs.soaMedian) && (sentimentPct < 50 || citationsPct < 20) && score < cutoffs.scoreP75) {
    return 'reputationRisks';
  }

  if (score >= cutoffs.scoreMedian && score < cutoffs.scoreP75 && (sentimentPct >= 55 || citationsPct >= 30) && mentionPct < cutoffs.mentionMedian) {
    return 'growthBets';
  }

  return 'monitorImprove';
};

const valueScoreForSource = (src: SourceData, maxCitations: number, maxTopics: number): number => {
  const sentimentPct = ((src.sentiment + 1) / 2) * 100; // -1..1 -> 0..100
  const citationsNorm = maxCitations > 0 ? (src.citations / maxCitations) * 100 : 0;
  const topicsNorm = maxTopics > 0 ? (src.topics.length / maxTopics) * 100 : 0;
  return (
    src.mentionRate * 0.3 +
    src.soa * 0.3 +
    sentimentPct * 0.2 +
    citationsNorm * 0.1 +
    topicsNorm * 0.1
  );
};

const classifyQuadrant = (
  mention: number,
  soa: number,
  sentiment: number,
  citations: number,
  thresholds: {
    mentionMedian: number;
    soaMedian: number;
    sentimentMedian: number;
    citationsMedian: number;
    compositeMedian: number;
    compositeTopQuartile: number;
  },
  maxCitations: number
): EnhancedSource['quadrant'] => {
  const mentionNorm = mention / 100;
  const soaNorm = soa / 100;
  const sentimentNorm = (sentiment + 1) / 2; // -1..1 -> 0..1
  const citationsNorm = maxCitations > 0 ? citations / maxCitations : 0;

  const compositeScore =
    mentionNorm * 0.35 +
    soaNorm * 0.35 +
    sentimentNorm * 0.2 +
    citationsNorm * 0.1;

  const visibilityStrong = mention >= thresholds.mentionMedian;
  const soaStrong = soa >= thresholds.soaMedian;
  const sentimentPositive = sentimentNorm >= thresholds.sentimentMedian;
  const citationsStrong = citationsNorm >= thresholds.citationsMedian;
  const compositeStrong = compositeScore >= thresholds.compositeTopQuartile;
  const compositeHealthy = compositeScore >= thresholds.compositeMedian;

  if (visibilityStrong && soaStrong && compositeStrong) return 'priority';
  if (visibilityStrong && (!sentimentPositive || !citationsStrong)) return 'reputation';
  if (!visibilityStrong && (sentimentPositive || citationsStrong) && compositeHealthy) return 'growth';
  return 'monitor';
};

export const SearchSourcesR2 = () => {
  const authLoading = useAuthStore((state) => state.isLoading);
  const { selectedBrandId, isLoading: brandsLoading } = useManualBrandDashboard();
  const [startDate, setStartDate] = useState<string>(() => {
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
    return start.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activeQuadrant, setActiveQuadrant] = useState<EnhancedSource['quadrant'] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('current');
  const [activeNewZone, setActiveNewZone] = useState<string | null>(null);

  const sourcesEndpoint = useMemo(() => {
    if (!selectedBrandId) return null;
    const params = new URLSearchParams({
      startDate,
      endDate
    });
    return `/brands/${selectedBrandId}/sources?${params.toString()}`;
  }, [selectedBrandId, startDate, endDate]);

  const { data: response, loading, error } = useCachedData<ApiResponse<SourceAttributionResponse>>(
    sourcesEndpoint,
    {},
    { requiresAuth: true },
    { enabled: !authLoading && !brandsLoading && !!sourcesEndpoint, refetchOnMount: false }
  );

  const sourceData: SourceData[] = response?.success && response.data ? response.data.sources : [];

  const enhancedSources = useMemo(() => {
    if (!sourceData.length) return [] as EnhancedSource[];

    const maxCitations = Math.max(...sourceData.map((s) => s.citations), 1);
    const maxTopics = Math.max(...sourceData.map((s) => s.topics.length), 1);
    const mentionMedian = median(sourceData.map((s) => s.mentionRate));
    const soaMedian = median(sourceData.map((s) => s.soa));
    const sentimentMedian = median(sourceData.map((s) => (s.sentiment + 1) / 2));
    const citationsMedian = median(sourceData.map((s) => (maxCitations > 0 ? s.citations / maxCitations : 0)));

    const compositeScores = sourceData.map((s) => {
      const mentionNorm = s.mentionRate / 100;
      const soaNorm = s.soa / 100;
      const sentimentNorm = (s.sentiment + 1) / 2;
      const citationsNorm = maxCitations > 0 ? s.citations / maxCitations : 0;
      return (
        mentionNorm * 0.35 +
        soaNorm * 0.35 +
        sentimentNorm * 0.2 +
        citationsNorm * 0.1
      );
    });

    const compositeMedian = median(compositeScores);
    const compositeTopQuartile = percentile(compositeScores, 75);

    return sourceData.map((s) => {
      const valueScore = valueScoreForSource(s, maxCitations, maxTopics);
      return {
        name: s.name,
        type: s.type,
        mentionRate: s.mentionRate,
        soa: s.soa,
        sentiment: s.sentiment,
        citations: s.citations,
        valueScore,
        quadrant: classifyQuadrant(s.mentionRate, s.soa, s.sentiment, s.citations, {
          mentionMedian,
          soaMedian,
          sentimentMedian,
          citationsMedian,
          compositeMedian,
          compositeTopQuartile
        }, maxCitations)
      };
    });
  }, [sourceData]);

  const newZoneSources = useMemo(() => {
    if (!sourceData.length) return [];

    const maxCitations = Math.max(...sourceData.map((s) => s.citations), 1);

    const sentimentPcts = sourceData.map((s) => ((s.sentiment + 1) / 2) * 100);
    const citationPcts = sourceData.map((s) => (maxCitations > 0 ? Math.min(100, (s.citations / maxCitations) * 100) : 0));
    const mentionPcts = sourceData.map((s) => s.mentionRate);
    const soaPcts = sourceData.map((s) => s.soa);

    const compositeScores = sourceData.map((s, idx) => {
      const sentimentPct = sentimentPcts[idx];
      const citationsPct = citationPcts[idx];
      return s.mentionRate * 0.35 + s.soa * 0.35 + sentimentPct * 0.2 + citationsPct * 0.1;
    });

    const scoreP75 = percentile(compositeScores, 75);
    const scoreMedian = median(compositeScores);
    const mentionMedian = median(mentionPcts);
    const soaMedian = median(soaPcts);

    const mapped = sourceData.map((s, idx) => {
      const sentimentPct = sentimentPcts[idx];
      const citationsPct = citationPcts[idx];
      const score = compositeScores[idx];
      const zone = classifyNewZone(
        s.mentionRate,
        s.soa,
        sentimentPct,
        citationsPct,
        score,
        { scoreP75, scoreMedian, mentionMedian, soaMedian }
      );

      return {
        name: s.name,
        type: s.type,
        mentionRate: s.mentionRate,
        soa: s.soa,
        sentiment: s.sentiment,
        citations: s.citations,
        valueScore: score,
        quadrant: zone as NewZone
      };
    });
    return mapped;
  }, [sourceData]);

  const filteredSources = useMemo(() => {
    if (!activeQuadrant) return enhancedSources;
    return enhancedSources.filter((s) => s.quadrant === activeQuadrant);
  }, [enhancedSources, activeQuadrant]);

  const quadrantCounts = useMemo(() => {
    return enhancedSources.reduce(
      (acc, s) => {
        acc[s.quadrant] = (acc[s.quadrant] || 0) + 1;
        return acc;
      },
      { priority: 0, reputation: 0, growth: 0, monitor: 0 }
    );
  }, [enhancedSources]);

  const filteredNewSources = useMemo(() => {
    if (!activeNewZone) return newZoneSources;
    return newZoneSources.filter((s) => s.quadrant === activeNewZone);
  }, [newZoneSources, activeNewZone]);

  const newZoneCounts = useMemo(() => {
    return newZoneSources.reduce(
      (acc, s) => {
        acc[s.quadrant] = (acc[s.quadrant] || 0) + 1;
        return acc;
      },
      {
        marketLeaders: 0,
        reputationRisks: 0,
        growthBets: 0,
        monitorImprove: 0
      } as Record<NewZone, number>
    );
  }, [newZoneSources]);

  const displayedSources = viewMode === 'current' ? filteredSources : filteredNewSources;

  const radarSources = useMemo(() => {
    if (!sourceData.length) return [];
    return displayedSources.map((s) => {
      const src = sourceData.find((sd) => sd.name === s.name);
      return {
        name: s.name,
        mentionRate: s.mentionRate,
        soa: s.soa,
        sentiment: s.sentiment,
        citations: s.citations,
        topicsCount: src ? src.topics.length : 0
      };
    });
  }, [displayedSources, sourceData]);

  const isLoading = authLoading || brandsLoading || loading;
  const errorMessage = error
    ? typeof error === 'string'
      ? error
      : error.message || 'Something went wrong while loading sources.'
    : null;

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 8px 18px rgba(15,23,42,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Search Sources</h1>
            <p style={{ margin: 0, color: '#475569' }}>Understand how your sources perform across visibility, share of answer, sentiment, and citations.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 4, display: 'flex', gap: 4 }}>
              {(['current', 'newZones'] as ViewMode[]).map((mode) => {
                const isActive = viewMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      setViewMode(mode);
                      setActiveQuadrant(null);
                      setActiveNewZone(null);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: isActive ? '#0ea5e9' : 'transparent',
                      color: isActive ? '#fff' : '#0f172a',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'background 160ms ease, color 160ms ease',
                      boxShadow: isActive ? '0 6px 14px rgba(14,165,233,0.35)' : 'none'
                    }}
                  >
                    {mode === 'current' ? 'Current View' : 'New Zone View'}
                  </button>
                );
              })}
            </div>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              showComparisonInfo={false}
              className="flex-shrink-0"
            />
          </div>
        </div>

        {errorMessage && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecdd3', borderRadius: 12, padding: 12 }}>
            {errorMessage}
          </div>
        )}

        <SummaryCards
          counts={viewMode === 'current' ? quadrantCounts : newZoneCounts}
          active={viewMode === 'current' ? activeQuadrant : activeNewZone}
          onSelect={(key) => {
            if (viewMode === 'current') {
              setActiveQuadrant(key as EnhancedSource['quadrant'] | null);
            } else {
              setActiveNewZone(key);
            }
          }}
          cardMetaOverride={
            viewMode === 'current'
              ? undefined
              : {
                  marketLeaders: { label: 'Market Leaders', color: '#0ea5e9' },
                  reputationRisks: { label: 'Reputation Risks', color: '#f97373' },
                  growthBets: { label: 'Growth Bets', color: '#6366f1' },
                  monitorImprove: { label: 'Monitor & Improve', color: '#cbd5e1' }
                }
          }
        />

        {isLoading ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, color: '#94a3b8', textAlign: 'center', boxShadow: '0 8px 18px rgba(15,23,42,0.05)' }}>
            Loading sources…
          </div>
        ) : enhancedSources.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, color: '#94a3b8', textAlign: 'center', boxShadow: '0 8px 18px rgba(15,23,42,0.05)' }}>
            No source data available for the selected range.
          </div>
        ) : (
          <>
            <ValueScoreTable sources={displayedSources} />
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 10px 25px rgba(15,23,42,0.05)' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Source Performance Radar</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748b' }}>Top sources across visibility, SOA, sentiment, citations, topics</p>
              <SourceRadar sources={radarSources} maxItems={5} />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

