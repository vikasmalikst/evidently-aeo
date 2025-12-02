import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Layout } from '../components/Layout/Layout';
import { VisibilityTabs } from '../components/Visibility/VisibilityTabs';
import { ChartControls } from '../components/Visibility/ChartControls';
import { VisibilityChart } from '../components/Visibility/VisibilityChart';
import { VisibilityTable } from '../components/Visibility/VisibilityTable';
import DatePickerMultiView from '../components/DatePicker/DatePickerMultiView';
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
  shareOfSearchChange?: number;
  topTopic: string;
  change?: number;
  referenceCount: number;
  brandPresencePercentage: number;
  data: number[];
  shareData?: number[];
  topTopics?: LlmTopic[];
  color?: string;
  isBrand?: boolean;
}

const normalizeId = (label: string) => label.toLowerCase().replace(/\s+/g, '-');

// Generate date labels based on date range and period type
const generateDateLabels = (startDate: Date, endDate: Date, periodType: 'daily' | 'weekly' | 'monthly'): string[] => {
  const labels: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  // Safety check
  if (isNaN(current.getTime()) || isNaN(end.getTime()) || current > end) {
    console.warn('[generateDateLabels] Invalid date range:', { startDate, endDate });
    return [];
  }
  
  if (periodType === 'daily') {
    while (current <= end) {
      labels.push(current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      current.setDate(current.getDate() + 1);
      // Safety limit to prevent infinite loops
      if (labels.length > 365) break;
    }
  } else if (periodType === 'weekly') {
    // Start from the beginning of the week containing startDate
    const weekStart = new Date(current);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    while (weekStart <= end) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > end) weekEnd.setTime(end.getTime());
      
      // Only include weeks that overlap with the date range
      if (weekStart <= end && weekEnd >= current) {
        labels.push(`${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      }
      weekStart.setDate(weekStart.getDate() + 7);
      // Safety limit
      if (labels.length > 104) break; // Max 2 years of weeks
    }
  } else if (periodType === 'monthly') {
    // Start from the beginning of the month containing startDate
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    
    while (monthStart <= end) {
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      if (monthEnd > end) monthEnd.setTime(end.getTime());
      
      // Only include months that overlap with the date range
      if (monthStart <= end && monthEnd >= current) {
        labels.push(monthStart.toLocaleDateString('en-US', { month: 'short' }));
      }
      monthStart.setMonth(monthStart.getMonth() + 1);
      // Safety limit
      if (labels.length > 24) break; // Max 2 years of months
    }
  }
  
  return labels;
};

// Generate date range label for display
const generateDateRangeLabel = (startDate: Date, endDate: Date, periodType: 'daily' | 'weekly' | 'monthly'): string => {
  const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  if (periodType === 'daily') {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `Last ${days} days`;
  } else if (periodType === 'weekly') {
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return `Last ${weeks} weeks`;
  } else if (periodType === 'monthly') {
    const months = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return `Last ${months} months`;
  }
  
  return `${start} - ${end}`;
};

// Build timeseries data for a value across date range
const buildTimeseries = (value: number, dateLabels: string[]) => {
  return Array(dateLabels.length).fill(Math.max(0, Math.round(value)));
};

export const SearchVisibility = () => {
  const pageLoadStart = useRef(performance.now());
  const [activeTab, setActiveTab] = useState<'brand' | 'competitive'>('brand');
  const [chartType, setChartType] = useState('line');
  const [region, setRegion] = useState('us');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [metricType, setMetricType] = useState<'visibility' | 'share'>('visibility');
  const [brandModels, setBrandModels] = useState<ModelData[]>([]);
  const [competitorModels, setCompetitorModels] = useState<ModelData[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  
  // Date range state - using DatePickerMultiView
  const [datePeriodType, setDatePeriodType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [selectedDateRange, setSelectedDateRange] = useState<{ startDate: Date; endDate: Date } | null>(() => {
    // Default to last 8 weeks
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 56); // 8 weeks ago
    // Start of week
    start.setDate(start.getDate() - start.getDay());
    return { startDate: start, endDate: end };
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const authLoading = useAuthStore((state) => state.isLoading);
  const {
    brands,
    selectedBrandId,
    selectedBrand,
    isLoading: brandsLoading,
    selectBrand
  } = useManualBrandDashboard();

  // Calculate date range from selected date range
  const dateRange = useMemo(() => {
    if (!selectedDateRange) {
      // Fallback to default range (last 8 weeks)
      const end = new Date();
      end.setUTCHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 56); // 8 weeks ago
      start.setDate(start.getDate() - start.getDay()); // Start of week
      start.setUTCHours(0, 0, 0, 0);
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      };
    }
    
    // Use the selected date range directly
    const start = new Date(selectedDateRange.startDate);
    start.setUTCHours(0, 0, 0, 0);
    
    const end = new Date(selectedDateRange.endDate);
    end.setUTCHours(23, 59, 59, 999);
    
    // Validate date range
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('[SearchVisibility] Invalid date range:', { start, end });
      // Fallback to default
      const defaultEnd = new Date();
      defaultEnd.setUTCHours(23, 59, 59, 999);
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 56);
      defaultStart.setDate(defaultStart.getDate() - defaultStart.getDay());
      defaultStart.setUTCHours(0, 0, 0, 0);
      return {
        startDate: defaultStart.toISOString(),
        endDate: defaultEnd.toISOString()
      };
    }
    
    // Ensure start is before end
    if (start.getTime() > end.getTime()) {
      console.warn('[SearchVisibility] Start date after end date, swapping');
      const temp = start;
      start.setTime(end.getTime());
      end.setTime(temp.getTime());
    }
    
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  }, [selectedDateRange]);
  
  // Generate date labels for chart
  const chartLabels = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return [];
    
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    
    // Ensure dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn('[SearchVisibility] Invalid date range:', { start: dateRange.startDate, end: dateRange.endDate });
      return [];
    }
    
    return generateDateLabels(start, end, datePeriodType);
  }, [dateRange, datePeriodType]);
  
  // Generate date range label for display
  const dateRangeLabel = useMemo(() => {
    return generateDateRangeLabel(
      new Date(dateRange.startDate),
      new Date(dateRange.endDate),
      datePeriodType
    );
  }, [dateRange, datePeriodType]);

  // Build endpoint
  const visibilityEndpoint = useMemo(() => {
    const endpointStart = performance.now();
    if (!selectedBrandId || !dateRange.startDate || !dateRange.endDate) return null;
    
    // Extract just the date part (YYYY-MM-DD) from ISO string for API
    const startDateStr = dateRange.startDate.split('T')[0];
    const endDateStr = dateRange.endDate.split('T')[0];
    
    const params = new URLSearchParams({
      startDate: startDateStr,
      endDate: endDateStr
    });
    const endpoint = `/brands/${selectedBrandId}/dashboard?${params.toString()}`;
    perfLog('SearchVisibility: Endpoint computation', endpointStart);
    console.log('[SearchVisibility] API endpoint:', endpoint, 'Date range:', { startDateStr, endDateStr });
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
      console.log('[SearchVisibility] No response data available');
      return { brandModels: [], competitorModels: [] };
    }

    // Don't block processing if chartLabels is empty - use a default length
    // This prevents blank screens during date range transitions
    const labelsToUse = chartLabels && chartLabels.length > 0 
      ? chartLabels 
      : ['Period 1']; // Fallback to single period if labels not ready yet

    const llmSlices = response.data.llmVisibility ?? [];
    console.log('[SearchVisibility] Processing data:', {
      llmSlicesCount: llmSlices.length,
      chartLabelsCount: labelsToUse.length,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate }
    });
    const llmModels = llmSlices.map((slice) => {
      const totalQueries = slice.totalQueries ?? 0;
      const brandPresenceCount = slice.brandPresenceCount ?? 0;
      // Brand Presence % = (queries with brand presence / total queries) * 100, capped at 100%
      const brandPresencePercentage = totalQueries > 0 
        ? Math.min(100, Math.round((brandPresenceCount / totalQueries) * 100))
        : 0;
      
      const visibilityValue = slice.visibility ?? 0;
      const shareValue = slice.shareOfSearch ?? slice.share ?? 0;
      
      return {
        id: normalizeId(slice.provider),
        name: slice.provider,
        score: Math.round(visibilityValue), // Use visibility, not share
        shareOfSearch: Math.round(shareValue),
        shareOfSearchChange: slice.delta ? Math.round(slice.delta) : 0,
        topTopic:
          slice.topTopic ??
          slice.topTopics?.[0]?.topic ??
          '—',
        change: slice.delta ? Math.round(slice.delta) : 0,
        referenceCount: brandPresenceCount,
        brandPresencePercentage,
        data: buildTimeseries(visibilityValue, labelsToUse),
        shareData: buildTimeseries(shareValue, labelsToUse),
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
    const brandCompetitiveModel = selectedBrandId ? {
      id: 'brand',
      name: brandName,
      score: Math.round(brandVisibilityValue),
      shareOfSearch: Math.round(brandShareValue),
      topTopic: brandData.topTopics?.[0]?.topic ?? '—',
      change: 0,
      referenceCount: queriesWithBrandPresence,
      brandPresencePercentage: Math.round(brandData.brandPresencePercentage ?? 0),
      data: buildTimeseries(brandVisibilityValue, labelsToUse),
      shareData: buildTimeseries(brandShareValue, labelsToUse),
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
      
      return {
        id: normalizeId(entry.competitor),
        name: entry.competitor,
        score: Math.round(competitorVisibilityValue),
        shareOfSearch: Math.round(competitorShareValue),
        topTopic: entry.topTopics?.[0]?.topic ?? '—',
        change: 0,
        referenceCount: entry.mentions ?? 0,
        brandPresencePercentage: Math.round(entry.brandPresencePercentage ?? 0),
        data: buildTimeseries(competitorVisibilityValue, labelsToUse),
        shareData: buildTimeseries(competitorShareValue, labelsToUse),
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
      competitorModels: allCompetitorModels
    };
  }, [response, selectedBrandId, selectedBrand, chartLabels]);

  // Update state from processed data (batched update)
  useEffect(() => {
    setBrandModels(processedData.brandModels);
    setCompetitorModels(processedData.competitorModels);
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
    // Only update selectedModels if we have models available
    // Don't clear selections if models are temporarily empty during data fetch
    if (availableModels.length === 0) {
      // Keep existing selections if models are empty (might be loading)
      return;
    }
    
    setSelectedModels((previous) => {
      const stillValid = previous.filter((id) => availableModels.some((model) => model.id === id));
      if (stillValid.length > 0) {
        return stillValid;
      }
      // Default to first 5 models if no previous selections
      return availableModels.slice(0, 5).map((model) => model.id);
    });
  }, [activeTab, currentModels]);

  const handleModelToggle = useCallback((modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  }, []);

  const chartData = useMemo(() => {
    // Use chartLabels if available, otherwise use labels from first model's data length
    const labels = chartLabels && chartLabels.length > 0 
      ? chartLabels 
      : (currentModels.length > 0 && currentModels[0]?.data?.length > 0
          ? currentModels[0].data.map((_, i) => `Period ${i + 1}`)
          : []);
    
    return {
      labels,
      datasets: currentModels.map((model) => ({
        id: model.id,
        label: model.name,
        data: metricType === 'visibility' ? model.data : (model.shareData ?? model.data)
      }))
    };
  }, [currentModels, metricType, chartLabels]);
  
  // Handle date picker callbacks
  const handleDateSelect = useCallback((date: Date) => {
    // This is called when a single date is selected, but we need a range
    // For now, just update the end date to the selected date
    if (selectedDateRange) {
      setSelectedDateRange({
        startDate: selectedDateRange.startDate,
        endDate: date
      });
    }
  }, [selectedDateRange]);
  
  const handleDateRangeApply = useCallback((startDate: Date, endDate: Date | null) => {
    // Normalize dates to start/end of day
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    
    const normalizedEnd = endDate ? new Date(endDate) : new Date(startDate);
    normalizedEnd.setHours(23, 59, 59, 999);
    
    console.log('[SearchVisibility] Applying date range:', {
      startDate: normalizedStart.toISOString(),
      endDate: normalizedEnd.toISOString(),
      periodType: datePeriodType
    });
    
    setSelectedDateRange({
      startDate: normalizedStart,
      endDate: normalizedEnd
    });
    setShowDatePicker(false);
  }, [datePeriodType]);
  
  const handleViewChange = useCallback((view: 'daily' | 'weekly' | 'monthly') => {
    setDatePeriodType(view);
  }, []);

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
          <VisibilityTabs activeTab={activeTab} onTabChange={setActiveTab} />
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

          <div className="flex flex-col flex-[0_0_60%] bg-white rounded-lg overflow-hidden shadow-sm">
            <ChartControls
              chartType={chartType}
              onChartTypeChange={setChartType}
              region={region}
              onRegionChange={setRegion}
              brands={brands}
              selectedBrandId={selectedBrandId}
              onBrandChange={selectBrand}
              metricType={metricType}
              onMetricTypeChange={setMetricType}
              dateRangeLabel={dateRangeLabel}
              onDatePickerClick={() => setShowDatePicker(true)}
            />

            {/* Date Picker Modal */}
            {showDatePicker && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    zIndex: 9998,
                  }}
                  onClick={() => setShowDatePicker(false)}
                />
                <div
                  style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 9999,
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    width: '900px',
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    minHeight: '500px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '20px 24px 24px 24px',
                      flex: 1,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                    }}
                  >
                    <DatePickerMultiView
                      onDateRangeSelect={handleDateSelect}
                      onViewChange={handleViewChange}
                      onApply={handleDateRangeApply}
                      onClose={() => setShowDatePicker(false)}
                      initialDate={selectedDateRange?.endDate || new Date()}
                      initialView={datePeriodType}
                    />
                  </div>
                </div>
              </>
            )}

            <VisibilityChart
              data={chartData}
              chartType={chartType}
              datePeriodType={datePeriodType}
              dateRangeLabel={dateRangeLabel}
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
