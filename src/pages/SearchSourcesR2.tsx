import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { useCachedData } from '../hooks/useCachedData';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';
import type { EnhancedSource } from '../components/SourcesR2/EnhancedQuadrantMatrix';
import { ValueScoreTable } from '../components/SourcesR2/ValueScoreTable';
import { SummaryCards } from '../components/SourcesR2/SummaryCards';
import { ImpactScoreTrendsChart } from '../components/SourcesR2/ImpactScoreTrendsChart';
import { DateRangePicker } from '../components/DateRangePicker/DateRangePicker';
import { fetchRecommendations, type Recommendation } from '../api/recommendationsApi';

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

const valueScoreForSource = (src: SourceData, maxCitations: number, maxTopics: number, maxSentiment: number): number => {
  // Use raw sentiment value, normalize relative to max sentiment in dataset (no fixed range normalization)
  const sentimentNorm = maxSentiment > 0 ? Math.min(100, (src.sentiment / maxSentiment) * 100) : 0;
  const citationsNorm = maxCitations > 0 ? (src.citations / maxCitations) * 100 : 0;
  const topicsNorm = maxTopics > 0 ? (src.topics.length / maxTopics) * 100 : 0;
  return (
    src.mentionRate * 0.3 +
    src.soa * 0.3 +
    sentimentNorm * 0.2 +
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
  maxCitations: number,
  maxSentiment: number
): EnhancedSource['quadrant'] => {
  const mentionNorm = mention / 100;
  const soaNorm = soa / 100;
  // Use raw sentiment value, normalize relative to max sentiment in dataset (no fixed range normalization)
  const sentimentNorm = maxSentiment > 0 ? Math.min(1, sentiment / maxSentiment) : 0;
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

const normalizeDomain = (value: string | null | undefined): string => {
  if (!value) return '';
  const raw = value.trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).hostname.replace(/^www\./, '');
    } catch {
      return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }
  }
  return raw.replace(/^www\./, '').split('/')[0];
};

export const SearchSourcesR2 = () => {
  const [searchParams] = useSearchParams();
  const authLoading = useAuthStore((state) => state.isLoading);
  const { selectedBrandId, isLoading: brandsLoading } = useManualBrandDashboard();
  
  // Read date range from URL params if available
  const urlStartDate = searchParams.get('startDate');
  const urlEndDate = searchParams.get('endDate');
  const highlightSource = searchParams.get('highlightSource');
  
  const [startDate, setStartDate] = useState<string>(() => {
    if (urlStartDate) return urlStartDate;
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
    return start.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => urlEndDate || new Date().toISOString().split('T')[0]);
  const [activeQuadrant, setActiveQuadrant] = useState<EnhancedSource['quadrant'] | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [selectedTrendSources, setSelectedTrendSources] = useState<string[]>([]);
  const [trendMetric, setTrendMetric] = useState<'impactScore' | 'mentionRate' | 'soa' | 'sentiment' | 'citations'>('impactScore');
  const [sourceSearchQuery, setSourceSearchQuery] = useState<string>(() => highlightSource || '');
  const [hasInitializedTrendSelection, setHasInitializedTrendSelection] = useState(false);

  // Update date range from URL params and auto-search for highlighted source
  useEffect(() => {
    if (urlStartDate && urlStartDate !== startDate) {
      setStartDate(urlStartDate);
    }
    if (urlEndDate && urlEndDate !== endDate) {
      setEndDate(urlEndDate);
    }
    // Auto-populate search with highlighted source
    if (highlightSource && !sourceSearchQuery) {
      setSourceSearchQuery(highlightSource);
    }
  }, [urlStartDate, urlEndDate, startDate, endDate, highlightSource, sourceSearchQuery]);

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
    const maxSentiment = Math.max(...sourceData.map((s) => s.sentiment), 1);
    const mentionMedian = median(sourceData.map((s) => s.mentionRate));
    const soaMedian = median(sourceData.map((s) => s.soa));
    // Use raw sentiment values for median calculation (no normalization)
    const sentimentMedian = median(sourceData.map((s) => maxSentiment > 0 ? s.sentiment / maxSentiment : 0));
    const citationsMedian = median(sourceData.map((s) => (maxCitations > 0 ? s.citations / maxCitations : 0)));

    const compositeScores = sourceData.map((s) => {
      const mentionNorm = s.mentionRate / 100;
      const soaNorm = s.soa / 100;
      // Use raw sentiment value, normalize relative to max sentiment in dataset (no fixed range normalization)
      const sentimentNorm = maxSentiment > 0 ? Math.min(1, s.sentiment / maxSentiment) : 0;
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
      const valueScore = valueScoreForSource(s, maxCitations, maxTopics, maxSentiment);
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
        }, maxCitations, maxSentiment)
      };
    });
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

  const searchFilteredSources = useMemo(() => {
    const base = filteredSources;
    if (!sourceSearchQuery.trim()) return base;
    const q = sourceSearchQuery.trim().toLowerCase();
    const filtered = base.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(q);
      const urlMatch = sourceData.find((src) => src.name === s.name)?.url?.toLowerCase().includes(q);
      return nameMatch || urlMatch;
    });
    
    // If we have a highlighted source, prioritize it at the top
    if (highlightSource) {
      const highlighted = filtered.find((s) => {
        const normalizedName = normalizeDomain(s.name);
        const normalizedHighlight = normalizeDomain(highlightSource);
        return normalizedName === normalizedHighlight ||
               s.name.toLowerCase().includes(highlightSource.toLowerCase()) ||
               highlightSource.toLowerCase().includes(s.name.toLowerCase());
      });
      
      if (highlighted) {
        const others = filtered.filter(s => s.name !== highlighted.name);
        return [highlighted, ...others];
      }
    }
    
    return filtered;
  }, [filteredSources, sourceSearchQuery, sourceData, highlightSource]);

  const displayedSources = searchFilteredSources;

  // Initialize default trends selection (top 10 by Impact score) when sources load / brand changes
  useEffect(() => {
    if (!selectedBrandId) {
      setSelectedTrendSources([]);
      setHasInitializedTrendSelection(false);
      return;
    }
    if (hasInitializedTrendSelection) return;
    if (!enhancedSources.length) return;

    const top10 = [...enhancedSources]
      .sort((a, b) => b.valueScore - a.valueScore)
      .slice(0, 10)
      .map((s) => s.name);
    setSelectedTrendSources(top10);
    setHasInitializedTrendSelection(true);
  }, [selectedBrandId, enhancedSources, hasInitializedTrendSelection]);

  // Fetch Impact Score trends data (last 7 days, daily)
  const trendsEndpoint = useMemo(() => {
    if (!selectedBrandId) return null;
    const params = new URLSearchParams({ days: '7', metric: trendMetric });
    if (selectedTrendSources.length > 0) {
      params.set('sources', selectedTrendSources.slice(0, 10).join(','));
    }
    return `/brands/${selectedBrandId}/sources/impact-score-trends?${params.toString()}`;
  }, [selectedBrandId, selectedTrendSources, trendMetric]);

  const { 
    data: trendsResponse, 
    loading: trendsLoading, 
    error: trendsError 
  } = useCachedData<ApiResponse<{
    dates: string[];
    sources: Array<{
      name: string;
      data: number[];
    }>;
  }>>(
    trendsEndpoint,
    {},
    { requiresAuth: true },
    { enabled: !authLoading && !brandsLoading && !!trendsEndpoint, refetchOnMount: false }
  );

  // Prepare data for Impact Score trends chart - only show selected sources
  const impactScoreTrendsData = useMemo(() => {
    // If no sources are selected, return empty array
    if (selectedTrendSources.length === 0) {
      return [];
    }

    if (!trendsResponse?.success || !trendsResponse.data) {
      // Fallback to current sources if trends data not available
      if (!enhancedSources.length) return [];
      
      // Only use selected sources
      const selectedSet = new Set(selectedTrendSources);
      const byName = new Map(enhancedSources.map((s) => [s.name, s.valueScore] as const));
      return selectedTrendSources
        .filter(name => byName.has(name))
        .map((name) => ({
          name,
          valueScore: byName.get(name) ?? 0
        }));
    }

    // Use real trends data from API - filter to only selected sources
    const selectedSet = new Set(selectedTrendSources);
    return trendsResponse.data.sources
      .filter((source) => selectedSet.has(source.name))
      .map((source) => ({
        name: source.name,
        valueScore: source.data[source.data.length - 1] || 0, // Current value (last day)
        trendData: source.data // Historical data
      }));
  }, [trendsResponse, enhancedSources, selectedTrendSources]);

  const trendSelectedSet = useMemo(() => new Set(selectedTrendSources), [selectedTrendSources]);
  const toggleTrendSource = (name: string) => {
    setSelectedTrendSources((prev) => {
      const exists = prev.includes(name);
      if (exists) return prev.filter((n) => n !== name);
      if (prev.length >= 10) return prev; // hard limit
      return [...prev, name];
    });
  };
  const deselectAllTrendSources = () => {
    setSelectedTrendSources([]);
    setHasInitializedTrendSelection(true); // Mark as initialized so useEffect doesn't re-select
  };

  // Use dates from API response, or generate fallback
  const trendDates = useMemo(() => {
    if (trendsResponse?.success && trendsResponse.data?.dates) {
      return trendsResponse.data.dates;
    }
    // Fallback: generate last 7 days
    const dates: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return dates;
  }, [trendsResponse]);

  const trendMetricLabel = useMemo(() => {
    switch (trendMetric) {
      case 'mentionRate':
        return 'Mention Rate (%)';
      case 'soa':
        return 'SOA (%)';
      case 'sentiment':
        return 'Sentiment';
      case 'citations':
        return 'Citations (normalized)';
      case 'impactScore':
      default:
        return 'Impact Score';
    }
  }, [trendMetric]);

  // Load recommendations when brand changes
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!selectedBrandId) {
        setRecommendations([]);
        return;
      }

      setRecommendationsLoading(true);
      try {
        const response = await fetchRecommendations({ brandId: selectedBrandId });
        if (response.success && response.data?.recommendations) {
          setRecommendations(response.data.recommendations);
        } else {
          setRecommendations([]);
        }
      } catch (err) {
        console.error('Error loading recommendations:', err);
        setRecommendations([]);
      } finally {
        setRecommendationsLoading(false);
      }
    };

    loadRecommendations();
  }, [selectedBrandId]);

  // Map quadrant to citation category
  const getCategoryFromQuadrant = (quadrant: string | null): Recommendation['citationCategory'] | null => {
    if (!quadrant) return null;
    const mapping: Record<string, Recommendation['citationCategory']> = {
      priority: 'Priority Partnerships',
      reputation: 'Reputation Management',
      growth: 'Growth Opportunities',
      monitor: 'Monitor'
    };
    return mapping[quadrant] || null;
  };

  // Filter recommendations by selected category
  const filteredRecommendations = useMemo(() => {
    const selectedCategory = getCategoryFromQuadrant(activeQuadrant);
    
    if (!selectedCategory) return [];
    
    return recommendations.filter(rec => rec.citationCategory === selectedCategory);
  }, [recommendations, activeQuadrant]);

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
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Citations Sources</h1>
            <p style={{ margin: 0, color: '#475569' }}>Understand how your sources perform across visibility, share of answer, sentiment, and citations.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
          counts={quadrantCounts}
          active={activeQuadrant}
          onSelect={(key) => {
            setActiveQuadrant(key as EnhancedSource['quadrant'] | null);
          }}
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
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 8px 18px rgba(15,23,42,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <input
                  type="text"
                  value={sourceSearchQuery}
                  onChange={(e) => setSourceSearchQuery(e.target.value)}
                  placeholder="Search sources by domain or name..."
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    color: '#0f172a',
                    fontSize: 13,
                    outline: 'none',
                    transition: 'border-color 160ms ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0ea5e9';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                />
                {sourceSearchQuery && (
                  <button
                    onClick={() => setSourceSearchQuery('')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      background: '#f8fafc',
                      color: '#64748b',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 160ms ease'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {sourceSearchQuery && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                  {displayedSources.length} source{displayedSources.length !== 1 ? 's' : ''} matching "{sourceSearchQuery}"
                </div>
              )}
            </div>
            <ValueScoreTable
              sources={displayedSources}
              maxHeight="520px"
              trendSelection={{
                selectedNames: trendSelectedSet,
                maxSelected: 10,
                onToggle: toggleTrendSource,
                onDeselectAll: deselectAllTrendSources
              }}
              highlightedSourceName={highlightSource}
            />
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 10px 25px rgba(15,23,42,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Impact Score Trends</h3>
                  <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748b' }}>
                    Top 10 sources - Daily trends for the last 7 days
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Metric</span>
                  <select
                    value={trendMetric}
                    onChange={(e) => setTrendMetric(e.target.value as any)}
                    style={{
                      height: 34,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    <option value="impactScore">Impact Score</option>
                    <option value="mentionRate">Mention Rate</option>
                    <option value="soa">SOA</option>
                    <option value="sentiment">Sentiment</option>
                    <option value="citations">Citations</option>
                  </select>
                </div>
              </div>
              {trendsLoading ? (
                <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center' }}>
                  Loading trends data...
                </div>
              ) : trendsError ? (
                <div style={{ padding: 24, color: '#ef4444', textAlign: 'center' }}>
                  Error loading trends data. Please try again.
                </div>
              ) : (
                <ImpactScoreTrendsChart sources={impactScoreTrendsData} dates={trendDates} maxSources={10} yAxisLabel={trendMetricLabel} />
              )}
            </div>

            {/* Recommended Actions Section */}
            {activeQuadrant && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 10px 25px rgba(15,23,42,0.05)' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Recommended Actions</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#64748b' }}>
                  Actions tailored for {activeQuadrant === 'priority' ? 'Priority Partnerships' :
                       activeQuadrant === 'reputation' ? 'Reputation Management' :
                       activeQuadrant === 'growth' ? 'Growth Opportunities' : 'Monitor'}
                </p>
                
                {recommendationsLoading ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading recommendations...</div>
                ) : filteredRecommendations.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    No specific recommendations for this category. Generate recommendations on the Recommendations page to see tailored actions.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredRecommendations.slice(0, 5).map((rec, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 12,
                          background: '#f9fafb',
                          transition: 'border-color 160ms ease, box-shadow 160ms ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#0ea5e9';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(14,165,233,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ 
                            minWidth: 24, 
                            height: 24, 
                            borderRadius: '50%', 
                            background: '#0ea5e9', 
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ 
                                fontSize: 10, 
                                fontWeight: 700, 
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: rec.citationCategory === 'Priority Partnerships' ? '#06c686' :
                                          rec.citationCategory === 'Reputation Management' ? '#ef4444' :
                                          rec.citationCategory === 'Growth Opportunities' ? '#0ea5e9' : '#94a3b8',
                                color: '#fff',
                                marginRight: 8
                              }}>
                                {rec.citationCategory === 'Priority Partnerships' ? 'Priority' :
                                 rec.citationCategory === 'Reputation Management' ? 'Reputation' :
                                 rec.citationCategory === 'Growth Opportunities' ? 'Growth' : 'Monitor'}
                              </span>
                            </div>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>
                              {rec.action}
                            </h4>
                            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                              {rec.reason}
                            </p>
                            <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#64748b' }}>
                              <span>Effort: <strong>{rec.effort}</strong></span>
                              <span>Timeline: <strong>{rec.timeline}</strong></span>
                              <span>Expected: <strong style={{ color: '#06c686' }}>{rec.expectedBoost}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

