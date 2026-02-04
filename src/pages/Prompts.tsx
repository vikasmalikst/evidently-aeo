import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { PromptFilters } from '../components/Prompts/PromptFilters';
import { PromptsList } from '../components/Prompts/PromptsList';
import { ResponseViewer } from '../components/Prompts/ResponseViewer';
import { useCachedData } from '../hooks/useCachedData';
import { useManualBrandDashboard } from '../manual-dashboard';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import { PromptAnalyticsPayload, PromptEntry } from '../types/prompts';
import { getActiveCompetitors, ManagedCompetitor } from '../api/competitorManagementApi';
import { KpiToggle } from '../components/Visibility/KpiToggle';
import { KpiType } from '../components/EducationalDrawer/EducationalContentDrawer';
import { EducationalContentDrawer } from '../components/EducationalDrawer/EducationalContentDrawer';
import { DateRangePicker } from '../components/DateRangePicker/DateRangePicker';
import { getLLMIcon } from '../components/Visibility/LLMIcons';
import { motion } from 'framer-motion';

// Performance logging
const perfLog = (label: string, startTime: number) => {
  const duration = performance.now() - startTime;
  console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
  return duration;
};

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

import { getDefaultDateRange } from './dashboard/utils';
import { useDashboardStore } from '../store/dashboardStore';
import { QueryTagFilter } from '../components/common/QueryTagFilter';
import { apiClient } from '../lib/apiClient';

export const Prompts = () => {
  const pageLoadStart = useRef(performance.now());
  const [selectedPrompt, setSelectedPrompt] = useState<PromptEntry | null>(null);
  const navigate = useNavigate();
  const [selectedLLMs, setSelectedLLMs] = useState<string[]>([]);
  const [hoveredLlmIndex, setHoveredLlmIndex] = useState<number | null>(null); // State for hover effect
  const { queryTags, startDate, endDate, setStartDate, setEndDate } = useDashboardStore();
  const [allCompetitors, setAllCompetitors] = useState<ManagedCompetitor[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [metricType, setMetricType] = useState<'visibility' | 'sentiment' | 'mentions' | 'position' | 'share'>('visibility');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKpiType, setDrawerKpiType] = useState<KpiType>('visibility');
  const { brands, selectedBrandId, selectedBrand, isLoading: brandsLoading, selectBrand } = useManualBrandDashboard();
  const [isResponsePinned, setIsResponsePinned] = useState(false);
  const [isResponseVisible, setIsResponseVisible] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [recommendationMap, setRecommendationMap] = useState<Record<string, string>>({});

  // Fetch recommendation map for Red Flag
  useEffect(() => {
    if (!selectedBrandId) return;

    const fetchMap = async () => {
      try {
        const response = await apiClient.get<ApiResponse<{ map: Record<string, string> }>>(
          `/brands/${selectedBrandId}/recommendations/map`
        );
        if (response.success && response.data) {
          setRecommendationMap(response.data.map || {});
        }
      } catch (err) {
        console.error('Failed to fetch recommendation map:', err);
      }
    };

    fetchMap();
  }, [selectedBrandId]);

  const handlePromptSelect = (prompt: PromptEntry) => {
    setSelectedPrompt(prompt);
    setIsResponseVisible(true);
  };

  // Build endpoint - always fetch all prompts with all responses (filtering happens client-side)
  // NOTE: We use a two-step approach to handle "All" selection correctly:
  // 1. First request (no collectors param) to get available collectors
  // 2. Subsequent requests explicitly pass collectors to ensure consistent aggregation
  const promptsEndpoint = useMemo(() => {
    const endpointStart = performance.now();
    if (!selectedBrandId || brandsLoading) return null;
    const params = new URLSearchParams({
      startDate: startDate ? new Date(startDate + 'T00:00:00').toISOString() : '',
      endDate: endDate ? new Date(endDate + 'T23:59:59.999').toISOString() : ''
    });

    if (selectedCompetitors.length > 0) {
      params.set('competitors', selectedCompetitors.join(','));
    }

    if (queryTags && queryTags.length > 0) {
      params.set('queryTags', queryTags.join(','));
    }

    // Filter by collector on backend so visibility/sentiment reflect the selected LLMs
    if (selectedLLMs.length > 0) {
      // Explicitly selected models: pass them as comma-separated list
      params.set('collectors', selectedLLMs.join(','));
    }
    // When "All" is selected (empty array), don't pass collectors parameter
    // Backend will return data aggregated across all collectors

    // IMPORTANT (perf):
    // Keep the endpoint stable on mount to maximize cache hits and avoid double-fetches.

    const endpoint = `/brands/${selectedBrandId}/prompts?${params.toString()}`;
    perfLog('Prompts: Endpoint computation', endpointStart);
    return endpoint;
  }, [selectedBrandId, startDate, endDate, brandsLoading, selectedLLMs, selectedCompetitors, queryTags]);

  // Use cached data hook
  const fetchStart = useRef(performance.now());
  const {
    data: response,
    loading,
    error: fetchError
  } = useCachedData<ApiResponse<PromptAnalyticsPayload>>(
    promptsEndpoint,
    {},
    { requiresAuth: true },
    { enabled: !!promptsEndpoint, refetchOnMount: false }
  );

  // Log fetch completion
  useEffect(() => {
    if (response && !loading) {
      perfLog('Prompts: Data fetch complete', fetchStart.current);
      fetchStart.current = performance.now();
    }
  }, [response, loading]);

  // Fetch competitors when brand changes
  useEffect(() => {
    if (selectedBrandId) {
      getActiveCompetitors(selectedBrandId)
        .then(data => {
          setAllCompetitors(data.competitors || []);
          // Default to all competitors selected
          if (data.competitors && data.competitors.length > 0) {
            setSelectedCompetitors(data.competitors.map(c => c.name.toLowerCase()));
          } else {
            setSelectedCompetitors([]);
          }
        })
        .catch(err => {
          console.error('Failed to fetch competitors:', err);
        });
    } else {
      setAllCompetitors([]);
      setSelectedCompetitors([]);
    }
  }, [selectedBrandId]);

  const handleReorderCompetitors = (newOrder: string[]) => {
    setSelectedCompetitors(newOrder);
  };

  // Extract available collectors from response
  const llmOptions = useMemo(() => {
    if (!response?.success || !response.data) {
      return [];
    }
    return response.data.collectors ?? [];
  }, [response]);

  // Helper functions for PromptsList
  const getMetricLabel = (type: typeof metricType) => {
    switch (type) {
      case 'visibility': return 'Visibility';
      case 'sentiment': return 'Sentiment';
      case 'mentions': return 'Mentions';
      case 'position': return 'Avg Position';
      case 'share': return 'Share of Answers';
      default: return type;
    }
  };

  const formatMetricValue = (value: number, type: typeof metricType) => {
    if (value === null || isNaN(value)) return 'N/A';
    switch (type) {
      case 'visibility': return `${value.toFixed(1)}%`;
      case 'sentiment': return value.toFixed(2);
      case 'mentions':
      case 'position': return Math.round(value).toString();
      case 'share': return `${value.toFixed(1)}%`;
      default: return value.toString();
    }
  };

  const getMetricValue = (item: PromptEntry, type: typeof metricType) => {
    switch (type) {
      case 'visibility': return item.visibilityScore;
      case 'sentiment': return item.sentimentScore;
      case 'mentions': return item.mentions;
      case 'position': return item.averagePosition;
      case 'share': return item.soaScore;
      default: return null;
    }
  };

  const getCompetitorMetricValue = (competitorSoaMap: Record<string, number>, type: typeof metricType, competitorId: string) => {
    switch (type) {
      case 'share': return competitorSoaMap[competitorId];
      default: return null; // Other metrics are not directly available per competitor in this context
    }
  };

  // Process response data with performance logging
  const topics = useMemo(() => {
    const start = performance.now();
    if (!response?.success || !response.data) {
      return [];
    }
    const payload = response.data;
    const filtered = (payload.topics ?? []).filter((topic) => topic.prompts.length > 0);
    perfLog('Prompts: Topics processing', start);
    return filtered;
  }, [response]);

  // Keep selected LLMs in sync with available options
  // Remove any selected LLMs that are no longer available
  useEffect(() => {
    if (llmOptions.length === 0) {
      if (selectedLLMs.length > 0) {
        setSelectedLLMs([]);
      }
      return;
    }

    // Filter out any selected LLMs that are no longer in available options
    const validSelected = selectedLLMs.filter(llm => llmOptions.includes(llm));
    if (validSelected.length !== selectedLLMs.length) {
      setSelectedLLMs(validSelected);
    }
  }, [llmOptions, selectedLLMs]);

  // Set selected prompt
  useEffect(() => {
    const flattenedPrompts = topics.flatMap((topic) => topic.prompts);
    setSelectedPrompt((previous) => {
      if (!flattenedPrompts.length) {
        return null;
      }
      if (previous) {
        const stillExists = flattenedPrompts.find((prompt) => prompt.id === previous.id);
        if (stillExists) {
          return stillExists;
        }
      }
      return flattenedPrompts[0];
    });
  }, [topics]);

  const error = fetchError?.message || (response && !response.success ? (response.error || response.message || 'Failed to load prompts.') : null);


  // Log page render completion
  useEffect(() => {
    if (!loading && topics.length > 0) {
      perfLog('Prompts: Page fully rendered', pageLoadStart.current);
    }
  }, [loading, topics.length]);

  const handleLLMChange = (llms: string[]) => {
    setSelectedLLMs(llms);
  };

  const handleHelpClick = (key: string) => {
    setDrawerKpiType(key as KpiType);
    setDrawerOpen(true);
  };

  if (loading && (!response || !response.data)) {
    return (
      <Layout>
        <LoadingScreen message="Loading prompts..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-6">
            {selectedBrand && (
              <SafeLogo
                src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                domain={selectedBrand.homepage_url || undefined}
                alt={selectedBrand.name}
                size={48}
                className="w-12 h-12 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
                Prompts
              </h1>
              <p className="text-[var(--text-caption)]">
                Analyze AI responses to tracked prompts across topics and platforms
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', flexShrink: 0, alignSelf: 'flex-end', marginBottom: '-4px' }}>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              showComparisonInfo={false}
              className="flex-shrink-0"
            />

            <QueryTagFilter variant="outline" className="border-gray-300/60 shadow-sm" />

            {/* LLM Selector/Filter Icons */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">LLMs</span>
                <div className="relative flex items-center bg-[#f1f5f9] rounded-xl p-1 gap-0.5">
                  {/* "All" Button */}
                  <button
                    type="button"
                    onClick={() => handleLLMChange([])}
                    onMouseEnter={() => setHoveredLlmIndex(-1)}
                    onMouseLeave={() => setHoveredLlmIndex(null)}
                    className="relative px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors z-10 cursor-pointer border-0"
                  >
                    {hoveredLlmIndex === -1 && (
                      <motion.span
                        className="absolute inset-0 bg-white/80 rounded-lg -z-10 shadow-sm"
                        layoutId="llm-filter-hover"
                        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                      />
                    )}
                    <span className={`relative z-10 ${selectedLLMs.length === 0 ? 'text-[#1a1d29] font-bold' : 'text-[#64748b]'}`}>
                      All
                    </span>
                  </button>

                  {/* Individual LLM Buttons */}
                  {llmOptions.map((model, index) => {
                    const isActive = selectedLLMs.includes(model);
                    return (
                      <button
                        key={model}
                        type="button"
                        onClick={() => {
                          const newSelection = isActive
                            ? selectedLLMs.filter(m => m !== model)
                            : [...selectedLLMs, model];
                          handleLLMChange(newSelection);
                        }}
                        onMouseEnter={() => setHoveredLlmIndex(index)}
                        onMouseLeave={() => setHoveredLlmIndex(null)}
                        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors z-10 cursor-pointer border-0"
                        title={model}
                      >
                        {hoveredLlmIndex === index && (
                          <motion.span
                            className="absolute inset-0 bg-white/80 rounded-lg -z-10 shadow-sm"
                            layoutId="llm-filter-hover"
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                          />
                        )}
                        <span className={`relative z-10 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                          {getLLMIcon(model)}
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

        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <KpiToggle
            metricType={metricType as any}
            onChange={(value) => setMetricType(value as any)}
            allowedMetricTypes={['visibility', 'share', 'sentiment', 'mentions', 'position']}
            onHelpClick={handleHelpClick}
          />

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <span className="text-xs font-semibold text-[var(--text-caption)]">Heatmap</span>
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showHeatmap ? 'bg-[var(--accent-primary)]' : 'bg-gray-200'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showHeatmap ? 'translate-x-4' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>

        <PromptFilters
          llmOptions={llmOptions}
          selectedLLMs={selectedLLMs}
          onLLMChange={handleLLMChange}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          competitors={allCompetitors}
          selectedCompetitors={selectedCompetitors}
          onSelectedCompetitorsChange={setSelectedCompetitors}
        />

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-[#fcdada] bg-[#fff5f5] text-sm text-[#b42323]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-10 gap-6">
          <div className={isResponseVisible || isResponsePinned ? "col-span-6" : "col-span-10"}>
            <PromptsList
              topics={topics}
              selectedPromptId={selectedPrompt?.id ?? null}
              onPromptSelect={handlePromptSelect}
              loading={loading}
              selectedLLMs={selectedLLMs}
              competitors={allCompetitors}
              selectedCompetitors={selectedCompetitors}
              onReorderCompetitors={handleReorderCompetitors}
              metricType={metricType}
              showHeatmap={showHeatmap}
              brandLogo={selectedBrand?.metadata?.logo || selectedBrand?.metadata?.brand_logo}
              brandName={selectedBrand?.name}
              brandDomain={selectedBrand?.homepage_url || undefined}
              recommendationMap={recommendationMap}
            />
          </div>

          {(isResponseVisible || isResponsePinned) && (
            <div className="col-span-4 transition-all">
              <ResponseViewer
                prompt={selectedPrompt}
                selectedLLMs={selectedLLMs}
                isPinned={isResponsePinned}
                onPinToggle={() => setIsResponsePinned(!isResponsePinned)}
                onClose={() => {
                  setIsResponseVisible(false);
                  setIsResponsePinned(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
      <EducationalContentDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        kpiType={drawerKpiType}
      />
    </Layout>
  );
};