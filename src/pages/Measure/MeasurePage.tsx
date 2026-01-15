/**
 * Measure Page - Combined Dashboard KPIs + Search Visibility
 * 
 * This page follows the "Full Loop" flow from the Landing Page:
 * Measure → Analyze → Improve → Executive Reporting
 * 
 * Combines:
 * 1. Header with brand logo, date range selector, brand switcher
 * 2. 4 KPI Cards (Visibility Score, Share of Answers, Sentiment Score, Brand Presence)
 * 3. Search Visibility content (KPI selector, charts, LLM table)
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/Layout/Layout';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import {
  MessageSquare,
  Activity,
  Target,
  Eye
} from 'lucide-react';
import { useDashboardData } from '../dashboard/hooks/useDashboardData';
import { useOnboardingOrchestrator } from '../../hooks/useOnboardingOrchestrator';
import { formatMetricValue, computeTrend, formatNumber } from '../dashboard/utils';
import { MetricCard } from '../dashboard/components/MetricCard';
import { DateRangeSelector } from '../dashboard/components/DateRangeSelector';
import { DashboardSkeleton } from '../dashboard/components/DashboardSkeleton';
import { useCachedData } from '../../hooks/useCachedData';
import type { DashboardScoreMetric } from '../dashboard/types';

// Search Visibility components
import { ChartControls } from '../../components/Visibility/ChartControls';
import { VisibilityChart } from '../../components/Visibility/VisibilityChart';
import { VisibilityTable } from '../../components/Visibility/VisibilityTable';
import { KpiToggle } from '../../components/Visibility/KpiToggle';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { useAuthStore } from '../../store/authStore';
import { getLLMIcon } from '../../components/Visibility/LLMIcons';
import '../../styles/visibility.css';
import { formatDateLabel } from '../../utils/dateFormatting';

type MetricType = 'visibility' | 'share' | 'brandPresence' | 'sentiment';

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
  totalCollectorResults?: number;
  topTopic?: string | null;
  topTopics?: LlmTopic[];
  sentiment?: number | null;
  timeSeries?: {
    dates: string[];
    visibility: number[];
    share: number[];
    sentiment: (number | null)[];
    isRealData?: boolean[];
  };
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
  sentiment?: number | null;
  timeSeries?: {
    dates: string[];
    visibility: number[];
    share: number[];
    sentiment: (number | null)[];
    isRealData?: boolean[];
  };
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
  competitorVisibility?: CompetitorVisibilityEntry[];
  brandSummary?: BrandSummary;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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
  brandPresenceData?: number[];
  topTopics?: LlmTopic[];
  color?: string;
  isBrand?: boolean;
  isRealData?: boolean[];
}

const chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const normalizeId = (label: string) => label.toLowerCase().replace(/\s+/g, '-');
const buildTimeseries = (value: number) => Array(chartLabels.length).fill(Math.max(0, Math.round(value)));

const parseMetricType = (value: string | null): MetricType | null => {
  if (value === 'visibility' || value === 'share' || value === 'brandPresence' || value === 'sentiment') {
    return value;
  }
  return null;
};

// Get default date range (last 7 days)
const getDefaultDateRange = () => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    start: formatDate(start),
    end: formatDate(end)
  };
};

export const MeasurePage = () => {
  const pageLoadStart = useRef(performance.now());
  const [searchParams, setSearchParams] = useSearchParams();
  const kpiParam = searchParams.get('kpi');
  const selectedKpi = parseMetricType(kpiParam) || 'visibility';
  
  // Chart state
  const [chartType, setChartType] = useState('line');
  const [region, setRegion] = useState('us');
  const [llmFilters, setLlmFilters] = useState<string[]>([]);
  const [allLlmOptions, setAllLlmOptions] = useState<Array<{ value: string; label: string; color?: string }>>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isSelectionInitialized, setIsSelectionInitialized] = useState(false);
  const [metricType, setMetricType] = useState<MetricType>(() => parseMetricType(searchParams.get('kpi')) ?? 'visibility');
  const [brandModels, setBrandModels] = useState<ModelData[]>([]);
  const [competitorModels, setCompetitorModels] = useState<ModelData[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const kpiSectionRef = useRef<HTMLDivElement | null>(null);

  // Date range state
  const defaultDateRange = getDefaultDateRange();
  const [visibilityStartDate, setVisibilityStartDate] = useState<string>(defaultDateRange.start);
  const [visibilityEndDate, setVisibilityEndDate] = useState<string>(defaultDateRange.end);
  
  // Dashboard data hook
  const {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    brands,
    brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand,
    dashboardData,
    dashboardErrorMsg,
    shouldShowLoading,
    handleRetryFetch,
    isDataCollectionInProgress,
  } = useDashboardData();

  const authLoading = useAuthStore((state) => state.isLoading);

  // Orchestrate automated onboarding steps
  useOnboardingOrchestrator(selectedBrandId);

  // Build visibility API endpoint
  const visibilityEndpoint = useMemo(() => {
    if (!selectedBrandId || !visibilityStartDate || !visibilityEndDate) return null;
    const startISO = new Date(visibilityStartDate).toISOString();
    const endISO = new Date(visibilityEndDate + 'T23:59:59').toISOString();
    const params = new URLSearchParams({ startDate: startISO, endDate: endISO });
    // Filter by collector on backend so visibility/sentiment reflect the selected LLMs
    if (llmFilters.length > 0) {
      // We need to pass the label (e.g. "GPT-4") not the normalized ID (e.g. "gpt-4")
      // Map selected IDs back to labels
      const selectedLabels = llmFilters
        .map(id => allLlmOptions.find(opt => opt.value === id)?.label)
        .filter(Boolean); // remove undefined
      
      if (selectedLabels.length > 0) {
        params.append('collectors', selectedLabels.join(','));
      }
    }

    return `/brands/${selectedBrandId}/dashboard?${params.toString()}`;
  }, [selectedBrandId, visibilityStartDate, visibilityEndDate, reloadToken, llmFilters, allLlmOptions]);

  // Fetch visibility data
  const { data: visibilityResponse, loading: visibilityLoading, error: visibilityError, refetch: refetchVisibility } = useCachedData<ApiResponse<DashboardPayload>>(
    visibilityEndpoint,
    {},
    { requiresAuth: true },
    { enabled: !!visibilityEndpoint }
  );

  // Process visibility data into chart models
  const processedData = useMemo(() => {
    if (!visibilityResponse?.data) {
      return { brandModels: [], competitorModels: [], llmOptions: [] };
    }

    const data = visibilityResponse.data;
    const llmSlices = data.llmVisibility ?? [];
    const competitors = data.competitorVisibility ?? [];
    const brandSum = data.brandSummary;

    // Build chart date labels from first LLM slice with timeSeries
    let chartDateLabels = chartLabels;
    const firstSliceWithDates = llmSlices.find(s => s.timeSeries?.dates?.length);
    if (firstSliceWithDates?.timeSeries?.dates) {
      chartDateLabels = firstSliceWithDates.timeSeries.dates.map(d => formatDateLabel(d));
    }

    // Build brand models from LLM visibility
    const brandModelData: ModelData[] = llmSlices.map((slice) => {
      const topTopicLabel = slice.topTopics?.[0]?.topic ?? slice.topTopic ?? '—';
      const visData = slice.timeSeries?.visibility ?? buildTimeseries(slice.visibility ?? 0);
      const shareData = slice.timeSeries?.share ?? buildTimeseries((slice.shareOfSearch ?? slice.share ?? 0) * 100);
      const sentData = slice.timeSeries?.sentiment ?? buildTimeseries(slice.sentiment ?? 0);
      const brandPresenceData = buildTimeseries(
        slice.totalCollectorResults && slice.totalCollectorResults > 0
          ? Math.min(100, Math.round(((slice.brandPresenceCount ?? 0) / slice.totalCollectorResults) * 100))
          : 0
      );
      const isRealData = slice.timeSeries?.isRealData;

      return {
        id: normalizeId(slice.provider),
        name: slice.provider,
        score: slice.visibility ?? 0,
        shareOfSearch: slice.shareOfSearch ?? slice.share ?? 0,
        sentiment: slice.sentiment ?? null,
        shareOfSearchChange: slice.delta ?? 0,
        topTopic: topTopicLabel,
        change: slice.delta ?? 0,
        referenceCount: 0,
        brandPresencePercentage: slice.totalCollectorResults && slice.totalCollectorResults > 0
          ? Math.min(100, Math.round(((slice.brandPresenceCount ?? 0) / slice.totalCollectorResults) * 100))
          : 0,
        data: visData,
        shareData,
        sentimentData: sentData,
        brandPresenceData,
        topTopics: slice.topTopics ?? [],
        color: slice.color,
        isBrand: false,
        isRealData
      };
    });

    // Build competitor models
    const competitorModelData: ModelData[] = [];
    if (brandSum) {
      const brandName = selectedBrand?.name || 'Your Brand';
      const topTopic = brandSum.topTopics?.[0]?.topic ?? '—';
      competitorModelData.push({
        id: normalizeId(brandName),
        name: brandName,
        score: brandSum.visibility,
        shareOfSearch: brandSum.share,
        sentiment: null,
        shareOfSearchChange: 0,
        topTopic,
        change: 0,
        referenceCount: 0,
        brandPresencePercentage: brandSum.brandPresencePercentage ?? 0,
        data: buildTimeseries(brandSum.visibility),
        shareData: buildTimeseries(brandSum.share * 100),
        brandPresenceData: buildTimeseries(brandSum.brandPresencePercentage ?? 0),
        topTopics: brandSum.topTopics?.map(t => ({ ...t, mentions: 0 })) ?? [],
        isBrand: true
      });
    }
    competitors.forEach((comp) => {
      const topTopic = comp.topTopics?.[0]?.topic ?? '—';
      const visData = comp.timeSeries?.visibility ?? buildTimeseries(comp.visibility);
      const shareData = comp.timeSeries?.share ?? buildTimeseries(comp.share * 100);
      const sentData = comp.timeSeries?.sentiment ?? buildTimeseries(comp.sentiment ?? 0);
      const brandPresenceData = buildTimeseries(comp.brandPresencePercentage ?? 0);
      const isRealData = comp.timeSeries?.isRealData;

      competitorModelData.push({
        id: normalizeId(comp.competitor),
        name: comp.competitor,
        score: comp.visibility,
        shareOfSearch: comp.share,
        sentiment: comp.sentiment ?? null,
        shareOfSearchChange: 0,
        topTopic,
        change: 0,
        referenceCount: comp.mentions,
        brandPresencePercentage: comp.brandPresencePercentage ?? 0,
        data: visData,
        shareData,
        sentimentData: sentData,
        brandPresenceData,
        topTopics: comp.topTopics ?? [],
        isBrand: false,
        isRealData
      });
    });

    // LLM filter options
    const llmOptions = [
      { value: 'all', label: 'All' },
      ...llmSlices.map(s => ({ value: normalizeId(s.provider), label: s.provider, color: s.color }))
    ];

    return { brandModels: brandModelData, competitorModels: competitorModelData, llmOptions, chartDateLabels };
  }, [visibilityResponse, selectedBrand]);

  // Update state when processed data changes
  useEffect(() => {
    setBrandModels(processedData.brandModels);
    setCompetitorModels(processedData.competitorModels);
    
    // Only update options if we have them, to prevent partial updates from wiping the list
    // OR if we are currently viewing "All" (no filters), so we can capture the full list.
    if (llmFilters.length === 0 && processedData.llmOptions.length > 0) {
      setAllLlmOptions(processedData.llmOptions);
    } else if (allLlmOptions.length === 0 && processedData.llmOptions.length > 0) {
       // fallback initialization
       setAllLlmOptions(processedData.llmOptions);
    }
    
    if (processedData.brandModels.length > 0 || processedData.competitorModels.length > 0) {
      setIsSelectionInitialized(false);
    }
  }, [processedData]);

  // Current models based on active tab
  const currentModels = competitorModels;
  const llmOptions = allLlmOptions;
  const chartDateLabels = processedData.chartDateLabels || chartLabels;

  // Model selection logic
  useEffect(() => {
    const availableModels = currentModels;
    setSelectedModels((previous) => {
      const stillValid = previous.filter((id) => availableModels.some((model) => model.id === id));
      if (stillValid.length > 0) return stillValid;
      return availableModels.map((model) => model.id);
    });
  }, [currentModels]);



  useEffect(() => {
    if (currentModels.length > 0 && selectedModels.length > 0) {
      const hasValidSelection = selectedModels.some(id => currentModels.some(m => m.id === id));
      if (hasValidSelection) setIsSelectionInitialized(true);
    } else if (visibilityResponse && !visibilityLoading && currentModels.length === 0) {
      setIsSelectionInitialized(true);
    }
  }, [selectedModels, currentModels, visibilityResponse, visibilityLoading]);

  const handleModelToggle = useCallback((modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  }, []);

  // Sync metricType with URL kpi param
  useEffect(() => {
    const kpi = parseMetricType(searchParams.get('kpi'));
    if (kpi && kpi !== metricType) {
      setMetricType(kpi);
    }
  }, [searchParams]);

  const handleKpiSelect = (kpi: MetricType) => {
    setSearchParams({ kpi });
    setMetricType(kpi);
  };

  // Chart data
  const chartData = useMemo(() => ({
    labels: chartDateLabels,
    datasets: currentModels.map((model) => ({
      id: model.id,
      label: model.name,
      data: metricType === 'visibility'
        ? model.data
        : metricType === 'share'
          ? (model.shareData ?? model.data)
          : metricType === 'brandPresence'
            ? (model.brandPresenceData ?? buildTimeseries(model.brandPresencePercentage ?? 0))
            : (model.sentimentData ?? model.data).map((v) => v ?? 0),
      isRealData: model.isRealData
    }))
  }), [currentModels, metricType, chartDateLabels]);

  // Dashboard KPI metrics
  const findScore = (label: string, data: typeof dashboardData): DashboardScoreMetric | undefined =>
    data?.scores?.find((metric) => metric.label.toLowerCase() === label.toLowerCase());

  const visibilityMetric = findScore('Visibility Index', dashboardData);
  const shareMetric = findScore('Share of Answers', dashboardData);
  const sentimentMetric = findScore('Sentiment Score', dashboardData);
  const brandPresenceRows = dashboardData?.brandPresenceRows ?? 0;
  const totalBrandRows = dashboardData?.totalBrandRows ?? 0;
  const brandPresencePercentage = totalBrandRows > 0 
    ? Math.min(100, Math.round((brandPresenceRows / totalBrandRows) * 100))
    : 0;
  const competitorEntries = useMemo(
    () => dashboardData?.competitorVisibility ?? [],
    [dashboardData?.competitorVisibility]
  );
  const brandLabel = selectedBrand?.name ?? dashboardData?.brandName ?? 'Your Brand';

  const toSentimentDisplay = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return value;
  };

  const metricCards = useMemo(
    () => {
      const comparisonSuffix = {
        visibility: '',
        share: '%',
        sentiment: '',
        brandPresence: '%'
      };

      const buildComparisons = (metric: 'visibility' | 'share' | 'sentiment' | 'brandPresence') => {
        const brandValue =
          metric === 'visibility'
            ? visibilityMetric?.value ?? null
            : metric === 'share'
              ? shareMetric?.value ?? null
              : metric === 'sentiment'
                ? toSentimentDisplay(sentimentMetric?.value) ?? null
                : brandPresencePercentage ?? null;

        const competitorValues = competitorEntries
          .map((entry) => {
            const value =
              metric === 'visibility'
                ? entry.visibility
                : metric === 'share'
                  ? entry.share
                  : metric === 'sentiment'
                    ? toSentimentDisplay(entry.sentiment)
                    : entry.brandPresencePercentage;

            if (!Number.isFinite(value)) return null;

            return { label: entry.competitor, value: value as number, isBrand: false };
          })
          .filter(Boolean) as Array<{ label: string; value: number; isBrand: boolean }>;

        const combined = [
          ...(brandValue !== null && Number.isFinite(brandValue)
            ? [{ label: brandLabel, value: brandValue as number, isBrand: true }]
            : []),
          ...competitorValues
        ];

        const ranked = combined.sort((a, b) => b.value - a.value).slice(0, 3);

        if (brandValue !== null && Number.isFinite(brandValue) && !ranked.some((item) => item.isBrand)) {
          return [...ranked, { label: brandLabel, value: brandValue as number, isBrand: true }].slice(0, 4);
        }

        return ranked;
      };

      return [
        {
          key: 'visibility',
          title: 'Visibility Score',
          value: formatMetricValue(visibilityMetric, ''),
          subtitle: '',
          trend: computeTrend(visibilityMetric?.delta),
          icon: <Eye size={20} />,
          color: '#498cf9',
          linkTo: '/measure?kpi=visibility',
          comparisons: buildComparisons('visibility'),
          comparisonSuffix: comparisonSuffix.visibility,
          description: 'How prominent is your brand in LLM answers.(based on number of appearances and positions)',
          isActive: selectedKpi === 'visibility'
        },
        {
          key: 'share',
          title: 'Share of Answers',
          value: formatMetricValue(shareMetric),
          subtitle: '',
          trend: computeTrend(shareMetric?.delta),
          icon: <Target size={20} />,
          color: '#06c686',
          linkTo: '/measure?kpi=share',
          comparisons: buildComparisons('share'),
          comparisonSuffix: comparisonSuffix.share,
          description: '% of time you brand appeaars compared to your defined competitors. ',
          isActive: selectedKpi === 'share'
        },
        {
          key: 'sentiment',
          title: 'Sentiment Score',
          value: sentimentMetric ? formatNumber(sentimentMetric.value, 1) : '—',
          subtitle: '',
          trend: computeTrend(sentimentMetric?.delta),
          icon: <MessageSquare size={20} />,
          color: '#00bcdc',
          linkTo: '/measure?kpi=sentiment',
          comparisons: buildComparisons('sentiment'),
          comparisonSuffix: comparisonSuffix.sentiment,
          description: 'Tone of the answers cited by LLMs from Brand\'s perspective (scaled 1-100)',
          isActive: selectedKpi === 'sentiment'
        },
        {
          key: 'brandPresence',
          title: 'Brand Presence',
          value: `${brandPresencePercentage}%`,
          subtitle: '',
          trend: computeTrend(dashboardData?.trendPercentage),
          icon: <Activity size={20} />,
          color: '#7c3aed',
          linkTo: '/measure?kpi=brandPresence',
          comparisons: buildComparisons('brandPresence'),
          comparisonSuffix: comparisonSuffix.brandPresence,
          description: '% of Answers that mention your brand\'s name in the answers.',
          isActive: selectedKpi === 'brandPresence'
        }
      ];
    },
    [
      visibilityMetric,
      shareMetric,
      sentimentMetric,
      brandPresencePercentage,
      dashboardData?.trendPercentage,
      competitorEntries,
      brandLabel,
      selectedKpi
    ]
  );

  const handleRetry = useCallback(() => {
    setReloadToken((prev) => prev + 1);
    refetchVisibility();
  }, [refetchVisibility]);

  // Loading states
  const combinedLoading = authLoading || visibilityLoading;
  const dataLoading = combinedLoading && (!visibilityResponse || !visibilityResponse.data);
  const selectionInitializing = !isSelectionInitialized && currentModels.length > 0;

  if (isDataCollectionInProgress && !dashboardData) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  const overviewSubtitle = (selectedBrand?.name ?? dashboardData?.brandName)
    ? `Here's your AI visibility performance overview for ${selectedBrand?.name ?? dashboardData?.brandName}`
    : `Here's your AI visibility performance overview`;

  const isLoadingView = shouldShowLoading || (!dashboardData && !dashboardErrorMsg);

  if (isLoadingView) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  if (brandsError || dashboardErrorMsg || !dashboardData) {
    const errorMessage =
      brandsError ||
      dashboardErrorMsg ||
      (brands.length === 0
        ? 'No brands found for this account. Please add a brand to view the dashboard.'
        : 'Dashboard data is currently unavailable.');
    return (
      <Layout>
        <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="max-w-xl mx-auto bg-white border border-[#fadddb] rounded-lg shadow-sm p-6 text-center">
            <h2 className="text-[18px] font-semibold text-[#1a1d29] mb-2">Unable to load dashboard</h2>
            <p className="text-[13px] text-[#64748b] mb-4">{errorMessage}</p>
            <button
              onClick={handleRetryFetch}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#00bcdc] text-white text-[13px] font-medium hover:bg-[#0096b0] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-[#6c7289]">
      {message}
    </div>
  );

  return (
    <Layout>
      <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        {/* Header Section */}
        <div className="flex items-start gap-6 mb-6">
          {selectedBrand && (
            <SafeLogo
              src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
              domain={selectedBrand.homepage_url || undefined}
              alt={selectedBrand.name}
              size={48}
              className="w-12 h-12 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-[32px] font-bold text-[#1a1d29]">AI Visibility Dashboard</h1>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-[15px] text-[#393e51]">{overviewSubtitle}</p>
                {brands.length > 1 && selectedBrandId && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="brand-selector" className="text-[12px] font-medium text-[#64748b] uppercase tracking-wide">
                      Brand
                    </label>
                    <select
                      id="brand-selector"
                      value={selectedBrandId}
                      onChange={(event) => selectBrand(event.target.value)}
                      className="text-[13px] border border-[#e8e9ed] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc] bg-white"
                    >
                      {brands.map((brandOption) => (
                        <option key={brandOption.id} value={brandOption.id}>{brandOption.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <DateRangeSelector
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                showComparisonInfo={false}
              />
            </div>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-4 gap-5 mb-6">
          {metricCards.map(({ key, isActive, ...cardProps }) => (
            <div 
              key={key} 
              className={`cursor-pointer transition-all duration-200 ${isActive ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 rounded-lg' : ''}`}
              onClick={() => handleKpiSelect(key as MetricType)}
            >
              <MetricCard {...cardProps} />
            </div>
          ))}
        </div>

        {/* Search Visibility Content */}
        <div className="flex flex-col gap-4">
          {/* Chart Section */}
          <div
            ref={kpiSectionRef}
            className="flex flex-col rounded-3xl border border-[#e4e7ec] bg-white shadow-[0_20px_45px_rgb(15_23_42_/_0.08)] overflow-hidden"
          >
            <div className="border-b border-[#e7ecff] bg-white p-6">
              <div className="flex flex-col gap-6">
                {/* KPI Toggle */}
                <div className="flex items-start justify-between gap-4">
                  <KpiToggle metricType={metricType} onChange={handleKpiSelect} />
                </div>

                {/* LLM Filter Section */}
                {llmOptions.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8690a8]">
                      LLM Filter
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLlmFilters([])}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${llmFilters.length === 0
                            ? 'bg-[#e6f7f0] border-[#12b76a] text-[#027a48]'
                            : 'bg-white border-[#e4e7ec] text-[#6c7289] hover:border-[#cfd4e3]'
                            }`}
                        >
                          All
                        </button>
                        {llmOptions
                          .filter((option) => option.value !== 'all')
                          .map((option) => {
                            const isActive = llmFilters.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  setLlmFilters((prev) =>
                                    prev.includes(option.value)
                                      ? prev.filter((v) => v !== option.value)
                                      : [...prev, option.value]
                                  )
                                }
                                className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${isActive
                                  ? 'bg-[#e6f7f0] border-[#12b76a] text-[#027a48] shadow-sm'
                                  : 'bg-white border-[#e4e7ec] text-[#1a1d29] hover:border-[#cfd4e3]'
                                  }`}
                                title={option.label}
                              >
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white">
                                  {getLLMIcon(option.label)}
                                </span>
                              </button>
                            );
                          })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <ChartControls
              startDate={visibilityStartDate}
              endDate={visibilityEndDate}
              onStartDateChange={setVisibilityStartDate}
              onEndDateChange={setVisibilityEndDate}
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
              selectedModels={selectedModels}
              loading={combinedLoading}
              activeTab="competitive"
              models={currentModels}
              metricType={metricType}
            />
          </div>

          {/* Table Section */}
          <div className="flex flex-col flex-1 bg-white rounded-lg overflow-hidden shadow-sm">
            {combinedLoading ? (
              <EmptyState message="Loading visibility data…" />
            ) : currentModels.length === 0 ? (
              <EmptyState message="No visibility records available for the selected brand yet." />
            ) : (
              <VisibilityTable
                activeTab="competitive"
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
