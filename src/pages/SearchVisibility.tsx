import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Layout } from '../components/Layout/Layout';
import { VisibilityTabs } from '../components/Visibility/VisibilityTabs';
import { ChartControls } from '../components/Visibility/ChartControls';
import { VisibilityChart } from '../components/Visibility/VisibilityChart';
import { VisibilityTable } from '../components/Visibility/VisibilityTable';
import { KpiToggle } from '../components/Visibility/KpiToggle';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';
import { useCachedData } from '../hooks/useCachedData';
import '../styles/visibility.css';

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

interface LlmTopic {
  topic: string;
  occurrences: number;
  share: number;
  visibility: number;
  mentions: number;
}

interface LlmVisibilitySlice {
  provider: string;
  share: number;
  shareOfSearch?: number;
  visibility?: number;
  delta?: number;
  color?: string;
  brandPresenceCount?: number;
  totalQueries?: number;
  topTopic?: string | null;
  topTopics?: LlmTopic[];
}

interface VisibilityComparisonEntry {
  entity: string;
  isBrand: boolean;
  mentions: number;
  share: number;
}

interface CompetitorVisibilityEntry {
  competitor: string;
  mentions: number;
  share: number;
  visibility: number;
  brandPresencePercentage?: number;
  topTopics?: Array<{
    topic: string;
    occurrences: number;
    share: number;
    visibility: number;
    mentions: number;
  }>;
  collectors?: Array<{
    collectorType: string;
    mentions: number;
  }>;
}

interface BrandSummary {
  visibility: number;
  share: number;
  brandPresencePercentage: number;
  topTopics?: Array<{
    topic: string;
    occurrences: number;
    share: number;
    visibility: number;
  }>;
}

interface DashboardPayload {
  llmVisibility?: LlmVisibilitySlice[];
  visibilityComparison?: VisibilityComparisonEntry[];
  competitorVisibility?: CompetitorVisibilityEntry[];
  brandSummary?: BrandSummary;
}

interface ModelData {
  id: string;
  name: string;
  score: number;
  shareOfSearch: number;
  sentiment?: number | null;
  shareOfSearchChange?: number;
  topTopic: string;
  change?: number;
  referenceCount: number;
  brandPresencePercentage: number;
  data: number[];
  shareData?: number[];
  sentimentData?: number[];
  topTopics?: LlmTopic[];
  color?: string;
  isBrand?: boolean;
}

const chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const normalizeId = (label: string) => label.toLowerCase().replace(/\s+/g, '-');

const buildTimeseries = (value: number) => Array(chartLabels.length).fill(Math.max(0, Math.round(value)));

// Helper to format date for chart labels (e.g., "Jan 15" or "Mon 15")
const formatDateLabel = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + 'T00:00:00Z')
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
    const dayNum = date.getDate()
    return `${dayName} ${dayNum}`
  } catch {
    return dateStr
  }
}

const getDateRangeForTimeframe = (timeframe: string) => {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(end);
  switch (timeframe) {
    case 'monthly':
      start.setUTCDate(start.getUTCDate() - 29);
      break;
    case 'ytd':
      start.setUTCMonth(0, 1);
      break;
    case 'weekly':
    default:
      start.setUTCDate(start.getUTCDate() - 6);
      break;
  }
  start.setUTCHours(0, 0, 0, 0);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString()
  };
};

export const SearchVisibility = () => {
  const pageLoadStart = useRef(performance.now());
  const [activeTab, setActiveTab] = useState<'brand' | 'competitive'>('brand');
  const [timeframe, setTimeframe] = useState('weekly');
  const [chartType, setChartType] = useState('line');
  const [region, setRegion] = useState('us');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [metricType, setMetricType] = useState<'visibility' | 'share' | 'sentiment'>('visibility');
  const [brandModels, setBrandModels] = useState<ModelData[]>([]);
  const [competitorModels, setCompetitorModels] = useState<ModelData[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const authLoading = useAuthStore((state) => state.isLoading);
  const {
    brands,
    selectedBrandId,
    selectedBrand,
    isLoading: brandsLoading,
    selectBrand
  } = useManualBrandDashboard();

  const dateRange = useMemo(() => getDateRangeForTimeframe(timeframe), [timeframe]);

  // Build endpoint
  const visibilityEndpoint = useMemo(() => {
    const endpointStart = performance.now();
    if (!selectedBrandId) return null;
    const params = new URLSearchParams({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    });
    const endpoint = `/brands/${selectedBrandId}/dashboard?${params.toString()}`;
    perfLog('SearchVisibility: Endpoint computation', endpointStart);
    return endpoint;
  }, [selectedBrandId, dateRange.startDate, dateRange.endDate, reloadToken]);

  // Use cached data hook
  const fetchStart = useRef(performance.now());
  const {
    data: response,
    loading,
    error: fetchError,
    refetch: refetchVisibility
  } = useCachedData<ApiResponse<DashboardPayload>>(
    visibilityEndpoint,
    {},
    { requiresAuth: true },
    { enabled: !authLoading && !brandsLoading && !!visibilityEndpoint, refetchOnMount: false }
  );

  // Log fetch completion
  useEffect(() => {
    if (response && !loading) {
      perfLog('SearchVisibility: Data fetch complete', fetchStart.current);
      fetchStart.current = performance.now();
    }
  }, [response, loading]);

  // Process response data - moved to useMemo for better performance
  const processedData = useMemo(() => {
    const processStart = performance.now();
    if (!response?.success || !response.data) {
      return { brandModels: [], competitorModels: [], chartDateLabels: chartLabels };
    }

    const llmSlices = response.data.llmVisibility ?? [];
    
    // Extract date labels from time-series data (if available)
    // Try brand visibility first, then competitor visibility
    let chartDateLabels: string[] = chartLabels
    if (llmSlices.length > 0 && llmSlices[0].timeSeries?.dates && llmSlices[0].timeSeries.dates.length > 0) {
      chartDateLabels = llmSlices[0].timeSeries.dates.map(formatDateLabel)
    } else if (competitorEntries.length > 0 && competitorEntries[0].timeSeries?.dates && competitorEntries[0].timeSeries.dates.length > 0) {
      chartDateLabels = competitorEntries[0].timeSeries.dates.map(formatDateLabel)
    }
    
    const llmModels = llmSlices.map((slice) => {
      const totalQueries = slice.totalQueries ?? 0;
      const brandPresenceCount = slice.brandPresenceCount ?? 0;
      // Brand Presence % = (collector results with brand presence / total collector results) * 100
      // Use totalCollectorResults if available (more accurate), otherwise fall back to totalQueries
      const totalCollectorResults = slice.totalCollectorResults ?? totalQueries;
      const brandPresencePercentage = totalCollectorResults > 0 
        ? Math.min(100, Math.round((brandPresenceCount / totalCollectorResults) * 100))
        : 0;
      
      const visibilityValue = slice.visibility ?? 0;
      const shareValue = slice.shareOfSearch ?? slice.share ?? 0;
      const sentimentValue = slice.sentiment ?? null;
      // Convert sentiment from -1 to 1 scale to 0-100 scale for display
      const sentimentDisplayValue = sentimentValue !== null ? ((sentimentValue + 1) / 2) * 100 : null;
      
      return {
        id: normalizeId(slice.provider),
        name: slice.provider,
        score: Math.round(visibilityValue), // Use visibility, not share
        shareOfSearch: Math.round(shareValue),
        sentiment: sentimentDisplayValue,
        shareOfSearchChange: slice.delta ? Math.round(slice.delta) : 0,
        topTopic:
          slice.topTopic ??
          slice.topTopics?.[0]?.topic ??
          '—',
        change: slice.delta ? Math.round(slice.delta) : 0,
        referenceCount: brandPresenceCount,
        brandPresencePercentage,
        // Use time-series data from backend if available, otherwise fallback to flat line
        data: slice.timeSeries?.visibility && slice.timeSeries.visibility.length > 0
          ? slice.timeSeries.visibility
          : buildTimeseries(visibilityValue),
        shareData: slice.timeSeries?.share && slice.timeSeries.share.length > 0
          ? slice.timeSeries.share
          : buildTimeseries(shareValue),
        sentimentData: slice.timeSeries?.sentiment && slice.timeSeries.sentiment.length > 0
          ? slice.timeSeries.sentiment.map(s => s !== null ? ((s + 1) / 2) * 100 : null)
          : (sentimentDisplayValue !== null ? buildTimeseries(sentimentDisplayValue) : undefined),
        topTopics: (slice.topTopics ?? []).map(topic => ({
          topic: topic.topic,
          occurrences: topic.occurrences,
          share: Math.round(topic.share * 10) / 10, // Round to 1 decimal place
          visibility: Math.round(topic.visibility * 10) / 10, // Round to 1 decimal place
          mentions: topic.mentions
        })),
        color: slice.color // Include color from backend
      };
    });

    const competitorEntries = response.data.competitorVisibility ?? [];

    // Create brand summary model for competitive view
    const brandSummary = response.data.brandSummary;
    console.log('[SearchVisibility] brandSummary from API:', brandSummary);
    console.log('[SearchVisibility] llmModels count:', llmModels.length);
    console.log('[SearchVisibility] selectedBrand:', selectedBrand);
    
    // Calculate brand summary from llmVisibility if brandSummary is not available
    const calculateBrandSummary = () => {
      if (brandSummary) {
        return {
          visibility: brandSummary.visibility ?? 0,
          share: brandSummary.share ?? 0,
          brandPresencePercentage: brandSummary.brandPresencePercentage ?? 0,
          topTopics: brandSummary.topTopics ?? []
        };
      }
      
      // Fallback: calculate from llmVisibility
      if (llmModels.length > 0) {
        const totalVisibility = llmModels.reduce((sum, model) => sum + model.score, 0) / llmModels.length;
        const totalShare = llmModels.reduce((sum, model) => sum + model.shareOfSearch, 0) / llmModels.length;
        const totalBrandPresence = llmModels.reduce((sum, model) => sum + model.brandPresencePercentage, 0) / llmModels.length;
        
        // Get top topics from all LLM models
        const allTopics = new Map<string, { occurrences: number; share: number; visibility: number; mentions: number }>();
        llmModels.forEach(model => {
          model.topTopics?.forEach(topic => {
            const existing = allTopics.get(topic.topic) || { occurrences: 0, share: 0, visibility: 0, mentions: 0 };
            allTopics.set(topic.topic, {
              occurrences: existing.occurrences + topic.occurrences,
              share: existing.share + topic.share,
              visibility: existing.visibility + topic.visibility,
              mentions: existing.mentions + topic.mentions
            });
          });
        });
        
        const topTopics = Array.from(allTopics.entries())
          .map(([topic, stats]) => ({
            topic,
            occurrences: stats.occurrences,
            share: stats.share / llmModels.length,
            visibility: stats.visibility / llmModels.length,
            mentions: stats.mentions
          }))
          .sort((a, b) => b.occurrences - a.occurrences || b.share - a.share)
          .slice(0, 5);
        
        return {
          visibility: totalVisibility,
          share: totalShare,
          brandPresencePercentage: totalBrandPresence,
          topTopics
        };
      }
      
      // If no data available, return empty summary (will show zeros)
      return {
        visibility: 0,
        share: 0,
        brandPresencePercentage: 0,
        topTopics: []
      };
    };
    
    const brandData = calculateBrandSummary();
    // Get brand name from response or selectedBrand
    const brandName = (response.data as any)?.brandName ?? selectedBrand?.name ?? 'Your Brand';
    
    // Get brand presence count from response data
    const queriesWithBrandPresence = (response.data as any)?.queriesWithBrandPresence ?? 0;
    
    // Always create brand row if we have a selected brand ID
    const brandVisibilityValue = brandData.visibility ?? 0;
    const brandShareValue = brandData.share ?? 0;
    // Get brand sentiment from response (if available)
    const brandSentimentRaw = (response.data as any)?.sentimentScore ?? null;
    const brandSentimentDisplay = brandSentimentRaw !== null ? ((brandSentimentRaw + 1) / 2) * 100 : null;
    
    // Aggregate time-series from all LLM models for brand summary
    let brandTimeSeries: { dates: string[], visibility: number[], share: number[], sentiment: (number | null)[] } | undefined
    if (llmModels.length > 0 && llmModels[0].data && llmModels[0].data.length > 0) {
      // Use the dates from first model (all should have same dates)
      const dates = llmSlices[0]?.timeSeries?.dates || []
      if (dates.length > 0) {
        const visibility: number[] = []
        const share: number[] = []
        const sentiment: (number | null)[] = []
        
        // For each day, average across all collectors
        dates.forEach((_, dayIndex) => {
          const dayVisibilities = llmModels
            .map(model => model.data[dayIndex])
            .filter(v => v !== undefined && v !== null) as number[]
          const dayShares = llmModels
            .map(model => model.shareData?.[dayIndex])
            .filter(v => v !== undefined && v !== null) as number[]
          const daySentiments = llmModels
            .map(model => {
              const s = model.sentimentData?.[dayIndex]
              return s !== undefined && s !== null ? s : null
            })
            .filter(s => s !== null) as number[]
          
          visibility.push(dayVisibilities.length > 0 
            ? Math.round(dayVisibilities.reduce((sum, v) => sum + v, 0) / dayVisibilities.length)
            : 0)
          share.push(dayShares.length > 0
            ? Math.round(dayShares.reduce((sum, v) => sum + v, 0) / dayShares.length)
            : 0)
          sentiment.push(daySentiments.length > 0
            ? Math.round(daySentiments.reduce((sum, v) => sum + v, 0) / daySentiments.length)
            : null)
        })
        
        brandTimeSeries = { dates, visibility, share, sentiment }
      }
    }
    
    const brandCompetitiveModel = selectedBrandId ? {
      id: 'brand',
      name: brandName,
      score: Math.round(brandVisibilityValue),
      shareOfSearch: Math.round(brandShareValue),
      sentiment: brandSentimentDisplay,
      topTopic: brandData.topTopics?.[0]?.topic ?? '—',
      change: 0,
      referenceCount: queriesWithBrandPresence,
      brandPresencePercentage: Math.round(brandData.brandPresencePercentage ?? 0),
      // Use aggregated brand time-series if available, otherwise fallback to flat line
      data: brandTimeSeries?.visibility && brandTimeSeries.visibility.length > 0
        ? brandTimeSeries.visibility
        : buildTimeseries(brandVisibilityValue),
      shareData: brandTimeSeries?.share && brandTimeSeries.share.length > 0
        ? brandTimeSeries.share
        : buildTimeseries(brandShareValue),
      sentimentData: brandTimeSeries?.sentiment && brandTimeSeries.sentiment.length > 0
        ? brandTimeSeries.sentiment
        : (brandSentimentDisplay !== null ? buildTimeseries(brandSentimentDisplay) : undefined),
      topTopics: brandData.topTopics?.map(topic => ({
        topic: topic.topic,
        occurrences: topic.occurrences,
        share: Math.round(topic.share * 10) / 10, // Round to 1 decimal place
        visibility: Math.round(topic.visibility * 10) / 10, // Round to 1 decimal place
        mentions: (topic as any).mentions ?? topic.occurrences
      })) ?? [],
      isBrand: true
    } : null;

    const competitorModelsData = competitorEntries.map((entry) => {
      const competitorVisibilityValue = entry.visibility ?? 0;
      const competitorShareValue = entry.share ?? 0;
      const competitorSentimentRaw = entry.sentiment ?? null;
      const competitorSentimentDisplay = competitorSentimentRaw !== null ? ((competitorSentimentRaw + 1) / 2) * 100 : null;
      
      return {
        id: normalizeId(entry.competitor),
        name: entry.competitor,
        score: Math.round(competitorVisibilityValue),
        shareOfSearch: Math.round(competitorShareValue),
        sentiment: competitorSentimentDisplay,
        topTopic: entry.topTopics?.[0]?.topic ?? '—',
        change: 0,
        referenceCount: entry.mentions ?? 0,
        brandPresencePercentage: Math.round(entry.brandPresencePercentage ?? 0),
        // Use time-series data from backend if available, otherwise fallback to flat line
        data: entry.timeSeries?.visibility && entry.timeSeries.visibility.length > 0
          ? entry.timeSeries.visibility
          : buildTimeseries(competitorVisibilityValue),
        shareData: entry.timeSeries?.share && entry.timeSeries.share.length > 0
          ? entry.timeSeries.share
          : buildTimeseries(competitorShareValue),
        sentimentData: entry.timeSeries?.sentiment && entry.timeSeries.sentiment.length > 0
          ? entry.timeSeries.sentiment.map(s => s !== null ? ((s + 1) / 2) * 100 : null)
          : (competitorSentimentDisplay !== null ? buildTimeseries(competitorSentimentDisplay) : undefined),
        topTopics: entry.topTopics?.map(topic => ({
          topic: topic.topic,
          occurrences: topic.occurrences,
          share: Math.round(topic.share * 10) / 10, // Round to 1 decimal place
          visibility: Math.round(topic.visibility * 10) / 10, // Round to 1 decimal place
          mentions: topic.mentions
        })) ?? [],
        isBrand: false
      };
    });

    // Prepend brand model to competitor models if available
    const allCompetitorModels = brandCompetitiveModel 
      ? [brandCompetitiveModel, ...competitorModelsData]
      : competitorModelsData;

    perfLog('SearchVisibility: Data processing', processStart);
    
    return {
      brandModels: llmModels,
      competitorModels: allCompetitorModels,
      chartDateLabels
    };
  }, [response, selectedBrandId, selectedBrand]);

  // Update state from processed data (batched update)
  const [chartDateLabels, setChartDateLabels] = useState<string[]>(chartLabels);
  
  useEffect(() => {
    setBrandModels(processedData.brandModels);
    setCompetitorModels(processedData.competitorModels);
    setChartDateLabels(processedData.chartDateLabels || chartLabels);
  }, [processedData]);

  // Log page render completion
  useEffect(() => {
    if (!loading && brandModels.length > 0) {
      perfLog('SearchVisibility: Page fully rendered', pageLoadStart.current);
    }
  }, [loading, brandModels.length]);

  const currentModels = activeTab === 'brand' ? brandModels : competitorModels;

  useEffect(() => {
    const availableModels = currentModels;
    setSelectedModels((previous) => {
      const stillValid = previous.filter((id) => availableModels.some((model) => model.id === id));
      if (stillValid.length > 0) {
        return stillValid;
      }
      return availableModels.slice(0, 5).map((model) => model.id);
    });
  }, [activeTab, currentModels]);

  const handleModelToggle = useCallback((modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  }, []);

  const chartData = useMemo(() => ({
    labels: chartDateLabels,
    datasets: currentModels.map((model) => ({
      id: model.id,
      label: model.name,
      data: metricType === 'visibility' 
        ? model.data 
        : metricType === 'share' 
          ? (model.shareData ?? model.data)
          : (model.sentimentData ?? model.data)
    }))
  }), [currentModels, metricType]);

  const combinedLoading = authLoading || brandsLoading || loading;

  const handleRetry = useCallback(() => {
    setReloadToken((prev) => prev + 1);
    refetchVisibility();
  }, [refetchVisibility]);

  const error = fetchError?.message || (response && !response.success ? (response.error || response.message || 'Failed to load visibility data.') : null);

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-[#6c7289]">
      {message}
    </div>
  );

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden bg-[#f4f4f6]">
        <div className="flex-shrink-0 bg-white border-b border-[#dcdfe5]">
          <div className="px-8 pt-8 pb-0">
            <h1 className="text-3xl font-bold text-[#1a1d29] mb-2">
              Answer Engine Visibility
            </h1>
            <p className="text-base text-[#6c7289] max-w-2xl mb-6">
              Monitor your brand's presence across AI answer engines including ChatGPT, Claude,
              Gemini, and Perplexity. Track visibility trends and compare your performance
              against competitors.
            </p>
            {brands.length > 1 && selectedBrandId && (
              <div className="flex items-center gap-2 mb-6">
                <label
                  htmlFor="brand-selector"
                  className="text-xs font-semibold text-[#6c7289] uppercase tracking-wide"
                >
                  Brand
                </label>
                <select
                  id="brand-selector"
                  value={selectedBrandId}
                  onChange={(event) => selectBrand(event.target.value)}
                  className="text-sm border border-[#dcdfe5] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#06b6d4]"
                >
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedBrand && (
              <p className="text-sm text-[#8b90a7]">
                Viewing data for <span className="font-medium text-[#1a1d29]">{selectedBrand.name}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col flex-1 gap-4 overflow-hidden p-4">
          {error && !combinedLoading && (
            <div className="bg-white border border-[#f2b8b5] rounded-lg p-6 text-center">
              <p className="text-sm text-[#b42318] mb-3">{error}</p>
              <button
                onClick={handleRetry}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#06b6d4] rounded-lg hover:bg-[#0d7c96] transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          <div className="flex flex-col flex-[0_0_60%] rounded-3xl border border-[#e4e7ec] bg-white shadow-[0_20px_45px_rgb(15_23_42_/_0.08)] overflow-hidden">
            <div className="border-b border-[#e7ecff] bg-white p-6">
              <div className="flex flex-col gap-6">
                <KpiToggle metricType={metricType} onChange={setMetricType} />
                <div className="flex flex-col gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8690a8]">
                    View Mode
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center bg-white">
                      <VisibilityTabs activeTab={activeTab} onTabChange={setActiveTab} />
                    </div>
                    <p className="text-xs text-[#8c94b6] md:text-right max-w-xs md:max-w-sm pt-1">
                      {activeTab === 'brand'
                        ? 'Focus on how each collector sees your brand.'
                        : 'Benchmark the selected KPI against competitors.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <ChartControls
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              chartType={chartType}
              onChartTypeChange={setChartType}
              region={region}
              onRegionChange={setRegion}
              brands={brands}
              selectedBrandId={selectedBrandId}
              onBrandChange={selectBrand}
            />

            <VisibilityChart
              data={chartData}
              chartType={chartType}
              timeframe={timeframe}
              selectedModels={selectedModels}
              loading={combinedLoading}
              activeTab={activeTab}
              models={currentModels}
              metricType={metricType}
            />
          </div>

          <div className="flex flex-col flex-1 bg-white rounded-lg overflow-hidden shadow-sm">
            {combinedLoading ? (
              <EmptyState message="Loading visibility data…" />
            ) : currentModels.length === 0 ? (
              <EmptyState message="No visibility records available for the selected brand yet." />
            ) : (
              <VisibilityTable
                activeTab={activeTab}
                models={currentModels}
                selectedModels={selectedModels}
                onModelToggle={handleModelToggle}
                loading={combinedLoading}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
