import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout/Layout';
import { useCachedData } from '../hooks/useCachedData';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';
import { EnhancedQuadrantMatrix, EnhancedSource } from '../components/SourcesR2/EnhancedQuadrantMatrix';
import { ValueScoreTable } from '../components/SourcesR2/ValueScoreTable';
import { CorrelationHeatmap } from '../components/SourcesR2/CorrelationHeatmap';
import { SummaryCards } from '../components/SourcesR2/SummaryCards';
import { SourceRadar } from '../components/SourcesR2/SourceRadar';

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

const classifyQuadrant = (mention: number, soa: number, xMid: number, yMid: number): EnhancedSource['quadrant'] => {
  if (mention >= xMid && soa >= yMid) return 'priority';
  if (mention >= xMid && soa < yMid) return 'reputation';
  if (mention < xMid && soa >= yMid) return 'growth';
  return 'monitor';
};

const correlation = (arrX: number[], arrY: number[]) => {
  const n = Math.min(arrX.length, arrY.length);
  if (n === 0) return 0;
  const xMean = arrX.reduce((a, b) => a + b, 0) / n;
  const yMean = arrY.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = arrX[i] - xMean;
    const dy = arrY[i] - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
};

export const SearchSourcesR2 = () => {
  const authLoading = useAuthStore((state) => state.isLoading);
  const { selectedBrandId, brands, isLoading: brandsLoading } = useManualBrandDashboard();
  const [startDate, setStartDate] = useState<string>(() => {
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
    return start.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

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
    const xMid = sourceData.map((s) => s.mentionRate).sort((a, b) => a - b)[Math.floor(sourceData.length / 2)] || 0;
    const yMid = sourceData.map((s) => s.soa).sort((a, b) => a - b)[Math.floor(sourceData.length / 2)] || 0;

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
        quadrant: classifyQuadrant(s.mentionRate, s.soa, xMid, yMid)
      };
    });
  }, [sourceData]);

  const quadrantCounts = useMemo(() => {
    return enhancedSources.reduce(
      (acc, s) => {
        acc[s.quadrant] = (acc[s.quadrant] || 0) + 1;
        return acc;
      },
      { priority: 0, reputation: 0, growth: 0, monitor: 0 }
    );
  }, [enhancedSources]);

  const correlationMatrix = useMemo(() => {
    if (!sourceData.length) return { matrix: [], labels: [] };
    const labels = ['Mention Rate', 'SOA', 'Sentiment', 'Citations'];
    const cols = [
      sourceData.map((s) => s.mentionRate),
      sourceData.map((s) => s.soa),
      sourceData.map((s) => s.sentiment),
      sourceData.map((s) => s.citations)
    ];
    const matrix = cols.map((colX) => cols.map((colY) => correlation(colX, colY)));
    return { matrix, labels };
  }, [sourceData]);

  const radarSources = useMemo(() => {
    if (!sourceData.length) return [];
    return sourceData.map((s) => ({
      name: s.name,
      mentionRate: s.mentionRate,
      soa: s.soa,
      sentiment: s.sentiment,
      citations: s.citations,
      topicsCount: s.topics.length
    }));
  }, [sourceData]);

  const handleDateChange = (range: { start: string; end: string }) => {
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const isLoading = authLoading || brandsLoading || loading;

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 8px 18px rgba(15,23,42,0.05)' }}>
          <h1 style={{ margin: '0 0 6px 0', fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Search Sources R2</h1>
          <p style={{ margin: 0, color: '#475569' }}>Experimental view to validate enhanced source insights (Visibility, SOA, Sentiment, Citations)</p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecdd3', borderRadius: 12, padding: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <SummaryCards counts={quadrantCounts} />

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 12px 30px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Quadrant Matrix</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Visibility (Mention Rate) vs Share of Answer; bubble size = Sentiment</p>
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                Date range: {startDate} → {endDate}
              </div>
            </div>
            {isLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            ) : enhancedSources.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No source data available.</div>
            ) : (
              <EnhancedQuadrantMatrix
                sources={enhancedSources}
                xThreshold={enhancedSources.length ? enhancedSources.map((s) => s.mentionRate).sort((a, b) => a - b)[Math.floor(enhancedSources.length / 2)] : 0}
                yThreshold={enhancedSources.length ? enhancedSources.map((s) => s.soa).sort((a, b) => a - b)[Math.floor(enhancedSources.length / 2)] : 0}
              />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <ValueScoreTable sources={enhancedSources} />
            <CorrelationHeatmap matrix={correlationMatrix.matrix} labels={correlationMatrix.labels} />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 10px 25px rgba(15,23,42,0.05)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Source Performance Radar</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748b' }}>Top 5 sources across visibility, SOA, sentiment, citations, topics</p>
            <SourceRadar sources={radarSources} maxItems={5} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

