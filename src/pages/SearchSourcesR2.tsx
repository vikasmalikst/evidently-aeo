import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/Layout/Layout';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import { HelpButton } from '../components/common/HelpButton';
import { useCachedData } from '../hooks/useCachedData';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';
import { useDashboardStore } from '../store/dashboardStore';
import { getLLMIcon } from '../components/Visibility/LLMIcons';
import { EnhancedSource, SourceData, ApiResponse, SourceAttributionResponse } from '../types/citation-sources';
import { computeEnhancedSources, normalizeDomain } from '../utils/citationAnalysisUtils';
import { ValueScoreTable, type ValueScoreSource } from '../components/SourcesR2/ValueScoreTable';
import { SummaryCards } from '../components/SourcesR2/SummaryCards';
import { ImpactScoreTrendsChart } from '../components/SourcesR2/ImpactScoreTrendsChart';
import { DateRangePicker } from '../components/DateRangePicker/DateRangePicker';
import { QueryTagFilter } from '../components/common/QueryTagFilter';
import { getDefaultDateRange } from './dashboard/utils';
import { KeyTakeaways } from '../components/SourcesR2/KeyTakeaways';
import { generateKeyTakeaways, type KeyTakeaway } from '../utils/SourcesTakeawayGenerator';
import { SourceTypeDistribution } from '../components/SourcesR2/SourceTypeDistribution';
import { EducationalContentDrawer, type KpiType } from '../components/EducationalDrawer/EducationalContentDrawer';



const hardcodedLlmOptions = [
  { value: 'ChatGPT', label: 'ChatGPT' },
  { value: 'Perplexity', label: 'Perplexity' },
  { value: 'Claude', label: 'Claude' },
  { value: 'Google AIO', label: 'Google AIO' },
  { value: 'Copilot', label: 'Copilot' },
  { value: 'Gemini', label: 'Gemini' },
  { value: 'Grok', label: 'Grok' },
  { value: 'Meta AI', label: 'Meta AI' },
];

export const SearchSourcesR2 = () => {
  const [searchParams] = useSearchParams();
  const authLoading = useAuthStore((state) => state.isLoading);
  const { selectedBrandId, selectedBrand, isLoading: brandsLoading } = useManualBrandDashboard();
  const { llmFilters, setLlmFilters, queryTags, startDate, endDate, setStartDate, setEndDate } = useDashboardStore();

  // Filter available LLM options based on brand metadata
  const availableLlmOptions = useMemo(() => {
    if (!selectedBrand?.metadata?.ai_models && !selectedBrand?.metadata?.collectors) {
      return hardcodedLlmOptions;
    }

    const activeModels: string[] = (selectedBrand.metadata?.ai_models || selectedBrand.metadata?.collectors || [])
      .map((m: any) => String(m).toLowerCase());

    if (activeModels.length === 0) return hardcodedLlmOptions;

    return hardcodedLlmOptions.filter(opt => {
      const optLower = opt.value.toLowerCase();
      // Check for fuzzy match
      return activeModels.some(active => {
        if (active.includes(optLower) || optLower.includes(active)) return true;
        // Special case mappings
        if (optLower === 'google aio' && (active.includes('google') || active.includes('sge'))) return true;
        if (optLower === 'copilot' && active.includes('bing')) return true;
        if (optLower === 'meta ai' && (active.includes('llama') || active.includes('meta'))) return true;
        return false;
      });
    });
  }, [selectedBrand]);

  // Read date range from URL params if available
  const urlStartDate = searchParams.get('startDate');
  const urlEndDate = searchParams.get('endDate');
  const highlightSource = searchParams.get('highlightSource');

  // Clean up selected filters if they suggest a model that isn't available anymore
  useEffect(() => {
    const validValues = new Set(availableLlmOptions.map(o => o.value));
    const validFilters = llmFilters.filter(f => validValues.has(f));
    if (validFilters.length !== llmFilters.length) {
      setLlmFilters(validFilters);
    }
  }, [availableLlmOptions, llmFilters, setLlmFilters]);

  const [activeQuadrant, setActiveQuadrant] = useState<EnhancedSource['quadrant'] | null>(null);
  const [selectedTrendSources, setSelectedTrendSources] = useState<string[]>([]);
  const [trendMetric, setTrendMetric] = useState<'impactScore' | 'mentionRate' | 'soa' | 'sentiment' | 'citations'>('impactScore');
  const [sourceSearchQuery, setSourceSearchQuery] = useState<string>(() => highlightSource || '');
  const [hasInitializedTrendSelection, setHasInitializedTrendSelection] = useState(false);
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [helpKpi, setHelpKpi] = useState<KpiType | null>(null);
  const [hoveredLlmIndex, setHoveredLlmIndex] = useState<number | null>(null);

  const handleHelpClick = (kpi: KpiType) => {
    setHelpKpi(kpi);
    setIsHelpDrawerOpen(true);
  };

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
  }, [urlStartDate, urlEndDate, startDate, endDate, highlightSource, sourceSearchQuery, setStartDate, setEndDate]);

  const sourcesEndpoint = useMemo(() => {
    if (!selectedBrandId) return null;
    const params = new URLSearchParams({
      startDate,
      endDate
    });

    if (llmFilters && llmFilters.length > 0) {
      params.append('collectors', llmFilters.join(','));
    }

    if (queryTags && queryTags.length > 0) {
      params.append('queryTags', queryTags.join(','));
    }

    return `/brands/${selectedBrandId}/sources?${params.toString()}`;
  }, [selectedBrandId, startDate, endDate, llmFilters, queryTags]);

  const { data: response, loading, error } = useCachedData<ApiResponse<SourceAttributionResponse>>(
    sourcesEndpoint,
    {},
    { requiresAuth: true },
    { enabled: !authLoading && !brandsLoading && !!sourcesEndpoint, refetchOnMount: false }
  );

  const sourceData: SourceData[] = response?.success && response.data ? response.data.sources : [];

  // Dynamically filter LLM options based on available data from API
  // This old logic is now superseded by availableLlmOptions
  // const llmOptions = useMemo(() => {
  //   // If response is loading or availableModels property is missing (legacy backend), fallback to hardcoded
  //   if (!response?.success || !response.data || response.data.availableModels === undefined) {
  //     return hardcodedLlmOptions;
  //   }

  //   const availableModels = response.data.availableModels;

  //   // If backend returns empty array, it means no models found in data.
  //   // However, if we have no data at all, we might want to show all options?
  //   // User requirement: "only show those collecters... for which the brand's data was collected"
  //   // So if empty, we return empty.
  //   if (!availableModels || availableModels.length === 0) {
  //      // If sourceData is also empty, it means truly no data. 
  //      // If we return empty here, the filter bar will only show "All".
  //      return [];
  //   }

  //   // Normalize to handle case sensitivity
  //   const availableSet = new Set(availableModels.map(m => m.toLowerCase()));

  //   return hardcodedLlmOptions.filter(opt => availableSet.has(opt.value.toLowerCase()));
  // }, [response]);

  const [processedSources, setProcessedSources] = useState<EnhancedSource[] | null>(null);

  useEffect(() => {
    setProcessedSources(null);
    setActiveQuadrant(null);
    if (!sourceData.length) return;

    const compute = () => {
      setProcessedSources(computeEnhancedSources(sourceData));
    };

    const requestIdle = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout?: number }) => number)
      | undefined;
    const cancelIdle = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;

    if (requestIdle) {
      const id = requestIdle(compute, { timeout: 1500 });
      return () => cancelIdle?.(id);
    }

    const t = window.setTimeout(compute, 50);
    return () => window.clearTimeout(t);
  }, [sourceData]);

  const isProcessedReady = !!processedSources;

  const urlByName = useMemo(() => {
    return new Map(sourceData.map((s) => [s.name, s.url] as const));
  }, [sourceData]);

  const rawTableSources: ValueScoreSource[] = useMemo(() => {
    return sourceData.map((s) => ({
      name: s.name,
      type: s.type,
      mentionRate: s.mentionRate,
      soa: s.soa,
      sentiment: s.sentiment,
      citations: s.citations,
      valueScore: typeof s.value === 'number' && Number.isFinite(s.value) ? s.value : 0,
      quadrant: '—'
    }));
  }, [sourceData]);

  const processedTableSources: ValueScoreSource[] = useMemo(() => {
    if (!processedSources) return [];
    return processedSources.map((s) => ({
      name: s.name,
      type: s.type,
      mentionRate: s.mentionRate,
      soa: s.soa,
      sentiment: s.sentiment,
      citations: s.citations,
      valueScore: s.valueScore,
      quadrant: s.quadrant
    }));
  }, [processedSources]);


  const sourcesForFilters = isProcessedReady ? processedTableSources : rawTableSources;


  const keyTakeaways = useMemo(() => {
    // Generate takeaways from the most complete data available
    // We combine sourceData (metrics+changes) with processedSources (quadrant+valueScore)
    if (!sourceData.length) return [];

    // Create a map of quadrant/value by name from processed sources
    const enrichmentMap = new Map();
    if (processedSources) {
      processedSources.forEach(p => {
        enrichmentMap.set(p.name, { quadrant: p.quadrant, valueScore: p.valueScore });
      });
    }

    const combinedSources = sourceData.map(s => {
      const enriched = enrichmentMap.get(s.name);
      return {
        ...s,
        quadrant: enriched?.quadrant || '—',
        valueScore: enriched?.valueScore || 0
      };
    });

    return generateKeyTakeaways(combinedSources);
  }, [processedSources, sourceData]);

  const quadrantCounts = useMemo(() => {
    if (!processedSources) {
      return { priority: 0, reputation: 0, growth: 0, monitor: 0 };
    }
    return processedSources.reduce(
      (acc, s) => {
        acc[s.quadrant] = (acc[s.quadrant] || 0) + 1;
        return acc;
      },
      { priority: 0, reputation: 0, growth: 0, monitor: 0 } as Record<string, number>
    );
  }, [processedSources]);

  const quadrantFilteredSources = useMemo(() => {
    if (!isProcessedReady || !activeQuadrant) return sourcesForFilters;
    return sourcesForFilters.filter((s) => s.quadrant === activeQuadrant);
  }, [sourcesForFilters, isProcessedReady, activeQuadrant]);

  const searchFilteredSources = useMemo(() => {
    const base = quadrantFilteredSources;
    if (!sourceSearchQuery.trim()) return base;
    const q = sourceSearchQuery.trim().toLowerCase();
    const filtered = base.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(q);
      const urlMatch = urlByName.get(s.name)?.toLowerCase().includes(q);
      return nameMatch || !!urlMatch;
    });

    if (highlightSource) {
      const highlighted = filtered.find((s) => {
        const normalizedName = normalizeDomain(s.name);
        const normalizedHighlight = normalizeDomain(highlightSource);
        return (
          normalizedName === normalizedHighlight ||
          s.name.toLowerCase().includes(highlightSource.toLowerCase()) ||
          highlightSource.toLowerCase().includes(s.name.toLowerCase())
        );
      });

      if (highlighted) {
        const others = filtered.filter((s) => s.name !== highlighted.name);
        return [highlighted, ...others];
      }
    }

    return filtered;
  }, [quadrantFilteredSources, sourceSearchQuery, urlByName, highlightSource]);

  const displayedSources = searchFilteredSources;

  // Initialize default trends selection (top 10 by Impact score) when sources load / brand changes
  useEffect(() => {
    if (!selectedBrandId) {
      setSelectedTrendSources([]);
      setHasInitializedTrendSelection(false);
      return;
    }
    if (hasInitializedTrendSelection) return;
    const sourcesForInit = (isProcessedReady ? processedTableSources : rawTableSources);
    if (!sourcesForInit.length) return;

    const top10 = [...sourcesForInit]
      .sort((a, b) => b.valueScore - a.valueScore)
      .slice(0, 10)
      .map((s) => s.name);
    setSelectedTrendSources(top10);
    setHasInitializedTrendSelection(true);
  }, [selectedBrandId, hasInitializedTrendSelection, isProcessedReady, processedTableSources, rawTableSources]);

  // Fetch Impact Score trends data (follows selected date range)
  const trendsEndpoint = useMemo(() => {
    if (!selectedBrandId) return null;
    const params = new URLSearchParams({
      metric: trendMetric,
      startDate,
      endDate
    });
    if (selectedTrendSources.length > 0) {
      params.set('sources', selectedTrendSources.slice(0, 10).join(','));
    }

    if (llmFilters && llmFilters.length > 0) {
      params.append('collectors', llmFilters.join(','));
    }

    return `/brands/${selectedBrandId}/sources/impact-score-trends?${params.toString()}`;
  }, [selectedBrandId, selectedTrendSources, trendMetric, startDate, endDate, llmFilters]);

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
      if (!sourcesForFilters.length) return [];

      const byName = new Map(sourcesForFilters.map((s) => [s.name, s.valueScore] as const));
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
  }, [trendsResponse, sourcesForFilters, selectedTrendSources]);

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
        return 'Citations';
      case 'impactScore':
      default:
        return 'Impact Score';
    }
  }, [trendMetric]);







  const totalCitations = useMemo(() => {
    const list = isProcessedReady ? processedSources : sourceData;
    return list?.reduce((acc, s) => acc + (s.citations || 0), 0) || 0;
  }, [isProcessedReady, processedSources, sourceData]);

  const isLoading = authLoading || brandsLoading || loading;
  const errorMessage = error
    ? typeof error === 'string'
      ? error
      : error.message || 'Something went wrong while loading sources.'
    : null;

  return (
    <Layout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 20,
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        minHeight: '100vh'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 14,
          boxShadow: '0 8px 18px rgba(15,23,42,0.06)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {selectedBrand && (
              <SafeLogo
                src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                domain={selectedBrand.homepage_url || undefined}
                alt={selectedBrand.name}
                size={36}
                className="w-9 h-9 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>Citations Sources</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: 12, lineHeight: 1.4 }}>Analyze your brand's performance across various citation sources used by LLMs.</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              showComparisonInfo={false}
              className="flex-shrink-0"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <QueryTagFilter variant="outline" className="border-gray-300/60 shadow-sm h-[36px]" />

              {/* LLM Filters */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wide">LLMs</span>
                <div className="relative flex items-center bg-[#f1f5f9] rounded-lg p-0.5 gap-0.5">
                  {/* "All" Button */}
                  <button
                    type="button"
                    onClick={() => setLlmFilters([])}
                    onMouseEnter={() => setHoveredLlmIndex(-1)}
                    onMouseLeave={() => setHoveredLlmIndex(null)}
                    className="relative px-3 h-[36px] flex items-center rounded-md text-[13px] font-medium transition-colors z-10 cursor-pointer border-0"
                  >
                    {hoveredLlmIndex === -1 && (
                      <motion.span
                        className="absolute inset-0 bg-white/80 rounded-md -z-10 shadow-sm"
                        layoutId="llm-filter-hover"
                        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                      />
                    )}
                    <span className={`relative z-10 ${llmFilters.length === 0 ? 'text-[#1a1d29] font-bold' : 'text-[#64748b]'}`}>
                      All
                    </span>
                  </button>

                  {/* Individual LLM Buttons */}
                  {availableLlmOptions.map((opt, index) => {
                    const isActive = llmFilters.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const newFilters = llmFilters.includes(opt.value)
                            ? llmFilters.filter((v) => v !== opt.value)
                            : [...llmFilters, opt.value];
                          setLlmFilters(newFilters);
                        }}
                        onMouseEnter={() => setHoveredLlmIndex(index)}
                        onMouseLeave={() => setHoveredLlmIndex(null)}
                        className="relative flex items-center justify-center w-[36px] h-[36px] rounded-md transition-colors z-10 cursor-pointer border-0"
                        title={opt.label}
                      >
                        {hoveredLlmIndex === index && (
                          <motion.span
                            className="absolute inset-0 bg-white/80 rounded-md -z-10 shadow-sm"
                            layoutId="llm-filter-hover"
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                          />
                        )}
                        <span className={`relative z-10 ${isActive ? 'opacity-100' : 'opacity-60'}`} style={{ fontSize: '20px' }}>
                          {getLLMIcon(opt.label)}
                        </span>
                        {isActive && (
                          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#06b6d4] rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecdd3', borderRadius: 12, padding: 12 }}>
            {errorMessage}
          </div>
        )}

        <KeyTakeaways takeaways={keyTakeaways} isLoading={isLoading && !sourcesForFilters.length} />

        <SourceTypeDistribution
          sources={sourceData}
          isLoading={isLoading && !sourcesForFilters.length}
          onHelpClick={() => handleHelpClick('source-distribution')}
        />

        {isProcessedReady ? (
          <SummaryCards
            counts={quadrantCounts}
            active={activeQuadrant}
            onSelect={(key) => {
              setActiveQuadrant(key as EnhancedSource['quadrant'] | null);
            }}
            onHelpClick={(key) => handleHelpClick(`source-${key}` as any)}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { label: 'Priority Partnerships', color: '#06c686' },
              { label: 'Reputation Management', color: '#f97373' },
              { label: 'Growth Opportunities', color: '#498cf9' },
              { label: 'Monitor', color: '#cbd5e1' }
            ].map((meta) => (
              <div
                key={meta.label}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: '#fff',
                  boxShadow: '0 8px 18px rgba(15,23,42,0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color }} />
                  <span style={{ fontSize: 13, color: '#475569', fontWeight: 700 }}>{meta.label}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#cbd5e1' }}>—</div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>sources</div>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, color: '#94a3b8', textAlign: 'center', boxShadow: '0 8px 18px rgba(15,23,42,0.05)' }}>
            Loading sources…
          </div>
        ) : sourceData.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, color: '#94a3b8', textAlign: 'center', boxShadow: '0 8px 18px rgba(15,23,42,0.05)' }}>
            No source data available for the selected range.
          </div>
        ) : (
          <>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: sourceSearchQuery || !isProcessedReady ? 12 : 0 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={sourceSearchQuery}
                    onChange={(e) => setSourceSearchQuery(e.target.value)}
                    placeholder="🔍 Search sources by domain or name..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      paddingLeft: '16px',
                      borderRadius: 10,
                      border: '2px solid #e5e7eb',
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                      fontWeight: 500
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                {sourceSearchQuery && (
                  <button
                    onClick={() => setSourceSearchQuery('')}
                    style={{
                      padding: '12px 18px',
                      borderRadius: 10,
                      border: '2px solid #e5e7eb',
                      background: '#fff',
                      color: '#64748b',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
              {sourceSearchQuery && (
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, background: '#f8fafc', padding: '6px 12px', borderRadius: 6, display: 'inline-block' }}>
                  {displayedSources.length} source{displayedSources.length !== 1 ? 's' : ''} matching "{sourceSearchQuery}"
                </div>
              )}
              {!isProcessedReady && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>
                  ⏳ Loading categories in the background. Sorting and category filters will be enabled shortly.
                </div>
              )}
            </div>
            <ValueScoreTable
              sources={displayedSources}
              maxHeight="520px"
              disableSorting={!isProcessedReady}
              pagination={{ pageSize: 10 }}
              trendSelection={{
                selectedNames: trendSelectedSet,
                maxSelected: 10,
                onToggle: toggleTrendSource,
                onDeselectAll: deselectAllTrendSources
              }}
              highlightedSourceName={highlightSource}
              onHelpClick={(key) => handleHelpClick(key as any)}
              totalCitations={totalCitations}
            />
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 8px 18px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Impact Score Trends</h3>
                    <HelpButton
                      onClick={() => handleHelpClick('trend-chart-guide')}
                      label="Impact Score Trends Guide"
                      size={14}
                    />
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                    Top 10 sources - Daily trends for the last 7 days
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>Metric</span>
                  <select
                    value={trendMetric}
                    onChange={(e) => setTrendMetric(e.target.value as any)}
                    style={{
                      height: 38,
                      padding: '0 14px',
                      borderRadius: 8,
                      border: '2px solid #e5e7eb',
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
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
                <div style={{ padding: 32, color: '#94a3b8', textAlign: 'center', fontSize: 14 }}>
                  Loading trends data...
                </div>
              ) : trendsError ? (
                <div style={{ padding: 32, color: '#ef4444', textAlign: 'center', fontSize: 14 }}>
                  Error loading trends data. Please try again.
                </div>
              ) : (
                <ImpactScoreTrendsChart sources={impactScoreTrendsData} dates={trendDates} maxSources={10} yAxisLabel={trendMetricLabel} />
              )}
            </div>

            {/* Recommended Actions Section */}

          </>
        )}
      </div>
      <EducationalContentDrawer
        isOpen={isHelpDrawerOpen}
        onClose={() => setIsHelpDrawerOpen(false)}
        kpiType={helpKpi}
      />
    </Layout>
  );
};
