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
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '../../store/dashboardStore';
import { Layout } from '../../components/Layout/Layout';
import { HelpButton } from '../../components/common/HelpButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import {
  MessageSquare,
  Activity,
  Target,
  Eye,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Info as InfoIcon,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { getLatestGenerationV3 } from '../../api/recommendationsV3Api';
import { useDashboardData } from '../dashboard/hooks/useDashboardData';
import { Link } from 'react-router-dom';
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
import { KpiToggle, MetricType } from '../../components/Visibility/KpiToggle';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { useAuthStore } from '../../store/authStore';
import { getLLMIcon } from '../../components/Visibility/LLMIcons';
import '../../styles/visibility.css';
import { formatDateLabel } from '../../utils/dateFormatting';
import { AnalyzePrefetcher } from './AnalyzePrefetcher';
import { EducationalContentDrawer, KpiType as DrawerKpiType } from '../../components/EducationalDrawer/EducationalContentDrawer';



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
    brandPresence?: number[];
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
  metadata?: {
    logo?: string;
    domain?: string;
  };
  sentiment?: number | null;
  timeSeries?: {
    dates: string[];
    visibility: number[];
    share: number[];
    sentiment: (number | null)[];
    brandPresencePercentage?: number[];
    isRealData?: boolean[];
  };
}

interface BrandSummary {
  visibility: number;
  share: number;
  sentiment?: number | null;
  brandPresencePercentage: number;
  topTopics?: Array<{
    topic: string;
    occurrences: number;
    share: number;
    visibility: number;
  }>;
  timeSeries?: {
    dates: string[];
    visibility: number[];
    share: number[];
    sentiment: (number | null)[];
    brandPresencePercentage?: number[];
    isRealData?: boolean[];
  };
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
  logo?: string;
  domain?: string;
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

// Use centralized getDefaultDateRange from dashboard/utils
import { getDefaultDateRange as getDashboardDefaultDateRange } from '../dashboard/utils';

export const MeasurePage = () => {
  const pageLoadStart = useRef(performance.now());
  const [searchParams, setSearchParams] = useSearchParams();
  const kpiParam = searchParams.get('kpi');
  const selectedKpi = parseMetricType(kpiParam) || 'visibility';

  // Chart state
  const [chartType, setChartType] = useState('line');
  const [region, setRegion] = useState('us');
  // Replaced local state with global store
  const { llmFilters, setLlmFilters } = useDashboardStore();
  const [allLlmOptions, setAllLlmOptions] = useState<Array<{ value: string; label: string; color?: string }>>([]);
  const [hoveredLlmIndex, setHoveredLlmIndex] = useState<number | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isSelectionInitialized, setIsSelectionInitialized] = useState(false);
  const [metricType, setMetricType] = useState<MetricType>(() => parseMetricType(searchParams.get('kpi')) ?? 'visibility');
  const [brandModels, setBrandModels] = useState<ModelData[]>([]);
  const [competitorModels, setCompetitorModels] = useState<ModelData[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const kpiSectionRef = useRef<HTMLDivElement | null>(null);
  const [opportunitiesCount, setOpportunitiesCount] = useState<number>(0);


  // Educational Drawer State
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [helpKpi, setHelpKpi] = useState<DrawerKpiType | null>(null);

  const handleHelpClick = useCallback((kpi: DrawerKpiType) => {
    setHelpKpi(kpi);
    setIsHelpDrawerOpen(true);
  }, []);

  // Date range state
  // const defaultDateRange = getDefaultDateRange(); // Removed local default
  // const [visibilityStartDate, setVisibilityStartDate] = useState<string>(defaultDateRange.start);
  // const [visibilityEndDate, setVisibilityEndDate] = useState<string>(defaultDateRange.end);

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

  useEffect(() => {
    if (!selectedBrandId) return;

    const fetchOpportunities = async () => {
      try {
        const response = await getLatestGenerationV3(selectedBrandId);
        if (response.success && response.data?.recommendations) {
          // Count only recommendations that are not completed (Step 1-3)
          const pendingCount = response.data.recommendations.filter(r => !r.isCompleted).length;
          setOpportunitiesCount(pendingCount);
        } else {
          setOpportunitiesCount(0);
        }
      } catch (err) {
        console.error('Error fetching opportunities count:', err);
        setOpportunitiesCount(0);
      }
    };

    fetchOpportunities();
  }, [selectedBrandId]);

  // Replaced local setLlmFilters logic with global store updates
  // Since setLlmFilters is now from store, we don't need the callback form `prev => ...` logic
  // inside the handlers if we just pass the new array.
  // But wait, the handlers below use (prev => ...).
  // Zustand set functions usually don't take a callback based on *current* state unless we wrap it.
  // We should likely update the handlers to calculate the new array.

  const authLoading = useAuthStore((state) => state.isLoading);

  // Orchestrate automated onboarding steps
  useOnboardingOrchestrator(selectedBrandId);

  // Process dashboard data into chart models
  const processedData = useMemo(() => {
    if (!dashboardData) {
      return { brandModels: [], competitorModels: [], llmOptions: [] };
    }

    const data = dashboardData;
    const llmSlices = data.llmVisibility ?? [];
    const competitors = data.competitorVisibility ?? [];
    const brandSum = data.brandSummary;

    // Build unified date range from all sources to ensure alignment
    // Collect all date arrays from LLM slices, brand summary, and competitors
    const allDateArrays: string[][] = [];

    llmSlices.forEach(slice => {
      if (slice.timeSeries?.dates?.length) {
        allDateArrays.push(slice.timeSeries.dates);
      }
    });

    if (brandSum?.timeSeries?.dates?.length) {
      allDateArrays.push(brandSum.timeSeries.dates);
    }

    competitors.forEach(comp => {
      if (comp.timeSeries?.dates?.length) {
        allDateArrays.push(comp.timeSeries.dates);
      }
    });

    // Find the longest date array (should be the complete range)
    // All arrays should have the same length after the backend fix, but we'll use the longest as the master
    let masterDates: string[] = [];
    let maxLength = 0;

    allDateArrays.forEach(dateArray => {
      if (dateArray.length > maxLength) {
        maxLength = dateArray.length;
        masterDates = dateArray;
      }
    });

    // Validate that all date arrays have the same length
    if (allDateArrays.length > 1) {
      const lengths = allDateArrays.map(arr => arr.length);
      const uniqueLengths = new Set(lengths);
      if (uniqueLengths.size > 1) {
        console.warn('[MeasurePage] ⚠️ Date array length mismatch detected:', {
          llmSlices: llmSlices.map(s => s.timeSeries?.dates?.length ?? 0),
          brandSummary: brandSum?.timeSeries?.dates?.length ?? 0,
          competitors: competitors.map(c => c.timeSeries?.dates?.length ?? 0),
          lengths: Array.from(uniqueLengths)
        });
      }
    }

    // Build chart date labels from master dates (or first LLM slice as fallback)
    let chartDateLabels = chartLabels;
    if (masterDates.length > 0) {
      chartDateLabels = masterDates.map(d => formatDateLabel(d));
    } else {
      const firstSliceWithDates = llmSlices.find(s => s.timeSeries?.dates?.length);
      if (firstSliceWithDates?.timeSeries?.dates) {
        chartDateLabels = firstSliceWithDates.timeSeries.dates.map(d => formatDateLabel(d));
      }
    }

    // Helper function to align data array with master dates
    // If dates don't match, align by date string matching
    const alignDataArray = (
      sourceDates: string[] | undefined,
      sourceData: number[] | (number | null)[] | undefined,
      masterDates: string[],
      fallbackValue: number | (number | null) = 0
    ): number[] | (number | null)[] => {
      if (!sourceDates || !sourceData || sourceDates.length === 0) {
        return Array(masterDates.length).fill(fallbackValue);
      }

      // If lengths match and first/last dates match, assume alignment is correct
      if (sourceDates.length === masterDates.length &&
        sourceDates[0] === masterDates[0] &&
        sourceDates[sourceDates.length - 1] === masterDates[masterDates.length - 1]) {
        return sourceData;
      }

      // Otherwise, align by matching dates
      const aligned: (number | null)[] = [];
      masterDates.forEach(masterDate => {
        const sourceIndex = sourceDates.indexOf(masterDate);
        if (sourceIndex !== -1 && sourceIndex < sourceData.length) {
          aligned.push(sourceData[sourceIndex] as number | null);
        } else {
          aligned.push(fallbackValue as number | null);
        }
      });
      return aligned;
    };

    // Build brand models from LLM visibility
    const brandModelData: ModelData[] = llmSlices.map((slice) => {
      const topTopicLabel = slice.topTopics?.[0]?.topic ?? slice.topTopic ?? '—';

      // Align data arrays with master dates to ensure proper chart rendering
      const sliceDates = slice.timeSeries?.dates;
      const visData = masterDates.length > 0 && sliceDates
        ? alignDataArray(sliceDates, slice.timeSeries?.visibility, masterDates, slice.visibility ?? 0)
        : (slice.timeSeries?.visibility ?? buildTimeseries(slice.visibility ?? 0));
      const shareData = masterDates.length > 0 && sliceDates
        ? alignDataArray(sliceDates, slice.timeSeries?.share, masterDates, (slice.shareOfSearch ?? slice.share ?? 0) * 100)
        : (slice.timeSeries?.share ?? buildTimeseries((slice.shareOfSearch ?? slice.share ?? 0) * 100));
      const sentData = masterDates.length > 0 && sliceDates
        ? alignDataArray(sliceDates, slice.timeSeries?.sentiment, masterDates, slice.sentiment ?? 0)
        : (slice.timeSeries?.sentiment ?? buildTimeseries(slice.sentiment ?? 0));
      const brandPresenceData = masterDates.length > 0 && sliceDates
        ? alignDataArray(sliceDates, slice.timeSeries?.brandPresence, masterDates,
          slice.totalCollectorResults && slice.totalCollectorResults > 0
            ? Math.min(100, Math.round(((slice.brandPresenceCount ?? 0) / slice.totalCollectorResults) * 100))
            : 0)
        : (slice.timeSeries?.brandPresence ?? buildTimeseries(
          slice.totalCollectorResults && slice.totalCollectorResults > 0
            ? Math.min(100, Math.round(((slice.brandPresenceCount ?? 0) / slice.totalCollectorResults) * 100))
            : 0
        ));
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

      // Align brand summary data arrays with master dates
      const brandDates = brandSum.timeSeries?.dates;
      const brandVisData = masterDates.length > 0 && brandDates
        ? alignDataArray(brandDates, brandSum.timeSeries?.visibility, masterDates, brandSum.visibility)
        : (brandSum.timeSeries?.visibility ?? buildTimeseries(brandSum.visibility));
      const brandShareData = masterDates.length > 0 && brandDates
        ? alignDataArray(brandDates, brandSum.timeSeries?.share, masterDates, brandSum.share * 100)
        : (brandSum.timeSeries?.share ?? buildTimeseries(brandSum.share * 100));
      const brandSentData = masterDates.length > 0 && brandDates
        ? alignDataArray(brandDates, brandSum.timeSeries?.sentiment, masterDates, brandSum.sentiment ?? 0)
        : (brandSum.timeSeries?.sentiment ?? buildTimeseries(brandSum.sentiment ?? 0));
      const brandIsRealData = brandSum.timeSeries?.isRealData;

      competitorModelData.push({
        id: normalizeId(brandName),
        name: brandName,
        score: brandSum.visibility,
        shareOfSearch: brandSum.share,
        sentiment: brandSum.sentiment ?? null,
        shareOfSearchChange: 0,
        topTopic,
        change: 0,
        referenceCount: 0,
        brandPresencePercentage: brandSum.brandPresencePercentage ?? 0,
        data: brandVisData,
        shareData: brandShareData,
        sentimentData: brandSentData,
        brandPresenceData: brandSum.timeSeries?.brandPresencePercentage ?? buildTimeseries(brandSum.brandPresencePercentage ?? 0),
        topTopics: brandSum.topTopics?.map(t => ({ ...t, mentions: 0 })) ?? [],
        isBrand: true,
        isRealData: brandIsRealData,
        logo: selectedBrand?.metadata?.logo || selectedBrand?.metadata?.brand_logo,
        domain: selectedBrand?.homepage_url || undefined
      });
    }
    competitors.forEach((comp) => {
      const topTopic = comp.topTopics?.[0]?.topic ?? '—';

      // Align competitor data arrays with master dates
      const compDates = comp.timeSeries?.dates;
      const visData = masterDates.length > 0 && compDates
        ? alignDataArray(compDates, comp.timeSeries?.visibility, masterDates, comp.visibility)
        : (comp.timeSeries?.visibility ?? buildTimeseries(comp.visibility));
      const shareData = masterDates.length > 0 && compDates
        ? alignDataArray(compDates, comp.timeSeries?.share, masterDates, comp.share * 100)
        : (comp.timeSeries?.share ?? buildTimeseries(comp.share * 100));
      const sentData = masterDates.length > 0 && compDates
        ? alignDataArray(compDates, comp.timeSeries?.sentiment, masterDates, comp.sentiment ?? 0)
        : (comp.timeSeries?.sentiment ?? buildTimeseries(comp.sentiment ?? 0));
      const brandPresenceData = masterDates.length > 0 && compDates
        ? alignDataArray(compDates, comp.timeSeries?.brandPresencePercentage, masterDates, comp.brandPresencePercentage ?? 0)
        : (comp.timeSeries?.brandPresencePercentage ?? buildTimeseries(comp.brandPresencePercentage ?? 0));
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
        isRealData,
        logo: comp.metadata?.logo,
        domain: comp.metadata?.domain
      });
    });

    // LLM filter options
    const llmOptions = [
      { value: 'all', label: 'All' },
      ...llmSlices.map(s => ({ value: normalizeId(s.provider), label: s.provider, color: s.color }))
    ];

    return { brandModels: brandModelData, competitorModels: competitorModelData, llmOptions, chartDateLabels };
  }, [dashboardData, selectedBrand]);

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

  const prevModelIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const availableModels = currentModels;
    const currentIds = availableModels.map(m => m.id);
    const prevIds = prevModelIdsRef.current;
    const newIds = currentIds.filter(id => !prevIds.includes(id));

    prevModelIdsRef.current = currentIds;

    setSelectedModels((previous) => {
      const stillValid = previous.filter((id) => availableModels.some((model) => model.id === id));
      const combined = [...new Set([...stillValid, ...newIds])];

      if (combined.length === 0 && availableModels.length > 0) {
        return availableModels.map(m => m.id);
      }

      return combined;
    });
  }, [currentModels]);



  useEffect(() => {
    if (currentModels.length > 0 && selectedModels.length > 0) {
      const hasValidSelection = selectedModels.some(id => currentModels.some(m => m.id === id));
      if (hasValidSelection) setIsSelectionInitialized(true);
    } else if (dashboardData && !shouldShowLoading && currentModels.length === 0) {
      setIsSelectionInitialized(true);
    }
  }, [selectedModels, currentModels, dashboardData, shouldShowLoading]);

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
    const newParams = new URLSearchParams(searchParams);
    newParams.set('kpi', kpi);
    setSearchParams(newParams);
    setMetricType(kpi);
  };

  // Chart data
  const chartData = useMemo(() => {
    const expectedLength = chartDateLabels.length;

    return {
      labels: chartDateLabels,
      datasets: currentModels.map((model) => {
        // Get the appropriate data array based on metric type
        let dataArray: (number | null)[] = [];
        if (metricType === 'visibility') {
          dataArray = model.data;
        } else if (metricType === 'share') {
          dataArray = model.shareData ?? model.data;
        } else if (metricType === 'brandPresence') {
          dataArray = model.brandPresenceData ?? buildTimeseries(model.brandPresencePercentage ?? 0);
        } else {
          dataArray = (model.sentimentData ?? model.data).map((v) => v ?? 0);
        }

        // Validate array length matches date labels
        if (dataArray.length !== expectedLength) {
          console.warn(`[MeasurePage] ⚠️ Data array length mismatch for ${model.name}: expected ${expectedLength}, got ${dataArray.length}. Padding or truncating.`);
          // Pad with last value or truncate to match
          if (dataArray.length < expectedLength) {
            const lastValue = dataArray.length > 0 ? dataArray[dataArray.length - 1] : 0;
            dataArray = [...dataArray, ...Array(expectedLength - dataArray.length).fill(lastValue)];
          } else {
            dataArray = dataArray.slice(0, expectedLength);
          }
        }

        return {
          id: model.id,
          label: model.name,
          data: dataArray,
          isRealData: model.isRealData
        };
      })
    };
  }, [currentModels, metricType, chartDateLabels]);

  // Helper to find specific score metrics
  const findScore = (label: string, data: typeof dashboardData): DashboardScoreMetric | undefined =>
    data?.scores?.find((metric) => metric.label.toLowerCase() === label.toLowerCase());

  // Dashboard KPI metrics - Derived from Filtered Data (dashboardData)
  const filteredBrandSummary = dashboardData?.brandSummary;

  const visibilityMetricValue = filteredBrandSummary?.visibility ?? findScore('Visibility Index', dashboardData)?.value;
  // Share from brandSummary is already a 0-1 float, so multiply by 100 for display
  // BUT if the value is already > 1 (like 4.4 meaning 440%), don't multiply again
  const rawShare = filteredBrandSummary?.share;
  const shareMetricValue = rawShare !== undefined
    ? (rawShare > 1 ? rawShare : rawShare * 100) // If > 1, it's already a percentage
    : findScore('Share of Answers', dashboardData)?.value;

  // Re-map sentiment from slices if needed
  const calculatedSentiment = useMemo(() => {
    if (!dashboardData?.llmVisibility?.length) return undefined;
    const slices = dashboardData.llmVisibility;
    const valid = slices.filter(s => s.sentiment != null);
    if (!valid.length) return undefined;
    const sum = valid.reduce((acc, s) => acc + (s.sentiment || 0), 0);
    return sum / valid.length;
  }, [dashboardData]);

  const sentimentMetricValueFinal = calculatedSentiment ?? findScore('Sentiment Score', dashboardData)?.value;

  const brandPresencePercentage = filteredBrandSummary?.brandPresencePercentage ??
    (dashboardData?.totalBrandRows ? Math.min(100, Math.round((dashboardData.brandPresenceRows / dashboardData.totalBrandRows) * 100)) : 0);

  // Construct metrics matching DashboardScoreMetric interface
  const visibilityMetric: DashboardScoreMetric = {
    value: visibilityMetricValue || 0,
    delta: 0,
    label: 'Visibility Index',
    description: 'Visibility Index'
  };
  const shareMetric: DashboardScoreMetric = {
    value: shareMetricValue || 0,
    delta: 0,
    label: 'Share of Answers',
    description: 'Share of Answers'
  };
  const sentimentMetric: DashboardScoreMetric = {
    value: sentimentMetricValueFinal || 0,
    delta: 0,
    label: 'Sentiment Score',
    description: 'Sentiment Score'
  };

  const brandPresenceRows = dashboardData?.brandPresenceRows ?? 0;
  const totalBrandRows = dashboardData?.totalBrandRows ?? 0;
  // brandPresencePercentage is defined above


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

        return brandValue !== null && Number.isFinite(brandValue)
          ? [{ label: brandLabel, value: brandValue as number, isBrand: true }]
          : [];
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
          isActive: selectedKpi === 'visibility',
          onHelpClick: () => handleHelpClick('visibility'),
          metricType: 'visibility' as const,
          hideComparisonHeader: true
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
          isActive: selectedKpi === 'share',
          onHelpClick: () => handleHelpClick('share'),
          metricType: 'share' as const,
          hideComparisonHeader: true
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
          isActive: selectedKpi === 'sentiment',
          onHelpClick: () => handleHelpClick('sentiment'),
          metricType: 'sentiment' as const,
          hideComparisonHeader: true
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
          isActive: selectedKpi === 'brandPresence',
          onHelpClick: () => handleHelpClick('brandPresence'),
          metricType: 'brandPresence' as const,
          hideComparisonHeader: true
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
      brandLabel,
      selectedKpi,
      handleHelpClick
    ]
  );

  const handleRetry = useCallback(() => {
    handleRetryFetch();
  }, [handleRetryFetch]);

  // Loading states
  const combinedLoading = authLoading || shouldShowLoading;
  const dataLoading = combinedLoading && !dashboardData;
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
            {/* Title Row */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[28px] font-bold text-[#1a1d29]">AI Visibility Dashboard</h1>
                <p className="text-[14px] text-[#64748b] mt-0.5">{overviewSubtitle}</p>
              </div>

              {/* Date Range - Top Right */}
              <DateRangeSelector
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                showComparisonInfo={false}
              />
            </div>

            {/* Filters Row - Below Title */}
            <div className="flex items-center gap-6 mt-4">
              {/* LLM Filters - Icons Only with Smooth Hover Animation */}
              {llmOptions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-[#64748b] uppercase tracking-wide">LLMs</span>
                  <div className="relative flex items-center bg-[#f1f5f9] rounded-xl p-1 gap-0.5">
                    {/* "All" Button */}
                    <button
                      type="button"
                      onClick={() => setLlmFilters([])}
                      onMouseEnter={() => setHoveredLlmIndex(-1)}
                      onMouseLeave={() => setHoveredLlmIndex(null)}
                      className="relative px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors z-10"
                    >
                      {/* Animated Background Pill */}
                      {hoveredLlmIndex === -1 && (
                        <motion.span
                          className="absolute inset-0 bg-white/80 rounded-lg -z-10 shadow-sm"
                          layoutId="llm-filter-hover"
                          transition={{
                            type: "spring",
                            bounce: 0,
                            duration: 0.4
                          }}
                        />
                      )}
                      <span className={`relative z-10 ${llmFilters.length === 0 ? 'text-[#1a1d29] font-semibold' : 'text-[#64748b]'}`}>
                        All
                      </span>
                    </button>

                    {/* Individual LLM Buttons */}
                    {llmOptions
                      .filter((opt) => opt.value !== 'all')
                      .map((opt, index) => {
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
                            className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors z-10"
                            title={opt.label}
                          >
                            {/* Animated Background Pill */}
                            {hoveredLlmIndex === index && (
                              <motion.span
                                className="absolute inset-0 bg-white/80 rounded-lg -z-10 shadow-sm"
                                layoutId="llm-filter-hover"
                                transition={{
                                  type: "spring",
                                  bounce: 0,
                                  duration: 0.4
                                }}
                              />
                            )}
                            <span className={`relative z-10 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                              {getLLMIcon(opt.label)}
                            </span>
                            {/* Active indicator dot */}
                            {isActive && (
                              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#06b6d4] rounded-full" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* "See analysis" Button next to filters */}
              <Link to="/analyze/citation-sources">
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0, 188, 220, 0.2)" }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-1.5 px-4 h-9 bg-[#00bcdc] text-white text-[12px] font-bold rounded-xl shadow-sm hover:shadow-md hover:bg-[#0096b0] transition-all duration-300 group"
                >
                  <span>See Analysis</span>
                  <ChevronRight size={14} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
              </Link>
            </div>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-4 gap-5 mb-6">
          {shouldShowLoading ? (
            // Show skeleton cards when loading
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-[#e4e7ec] shadow-sm animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/5"></div>
                </div>
              </div>
            ))
          ) : (
            metricCards.map(({ key, isActive, ...cardProps }) => (
              <div
                key={key}
                className={`cursor-pointer transition-all duration-200 ${isActive ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 rounded-lg' : ''}`}
                onClick={(e) => {
                  // Only trigger if we're not clicking a button/link inside the card
                  if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
                    return;
                  }
                  handleKpiSelect(key as MetricType);
                }}
              >
                <MetricCard {...cardProps} />
              </div>
            ))
          )}
        </div>

        {/* Opportunities Highlight Card */}
        {opportunitiesCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Link to="/improve/discover" className="block">
              <div className="bg-white border border-[#e4e7ec] rounded-2xl p-4 flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-[#00bcdc]/30 transition-all duration-300 group">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00bcdc] to-[#0096b0] flex items-center justify-center text-white shadow-lg shadow-[#00bcdc]/20 group-hover:scale-105 transition-transform duration-300">
                    <Sparkles size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#1a1d29] flex items-center gap-2">
                      We've identified <span className="text-[#00bcdc] px-1.5 py-0.5 bg-[#00bcdc]/5 rounded-lg">{opportunitiesCount} Opportunities</span> to elevate LLM performance
                    </h3>
                    <p className="text-[13px] text-[#64748b] mt-0.5">Strategically improve {selectedBrand?.name ?? 'your brand'}'s visibility, sentiment, and share across AI answer engines.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pr-2">
                  <div className="flex flex-col items-end mr-3">
                    <span className="text-[14px] font-bold text-[#00bcdc]">Start Optimizing</span>
                    <span className="text-[11px] text-[#94a3b8] font-medium uppercase tracking-wider">Refine & Improve</span>
                  </div>
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      boxShadow: [
                        "0 0 0 0px rgba(0, 188, 220, 0)",
                        "0 0 0 6px rgba(0, 188, 220, 0.1)",
                        "0 0 0 0px rgba(0, 188, 220, 0)"
                      ]
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      ease: "easeInOut"
                    }}
                    className="w-8 h-8 rounded-full bg-[#00bcdc]/10 flex items-center justify-center text-[#00bcdc] group-hover:bg-[#00bcdc] group-hover:text-white transition-all duration-300"
                  >
                    <ChevronRight size={20} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                  </motion.div>
                </div>
              </div>
            </Link>
          </motion.div>
        )}

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
                  <KpiToggle metricType={metricType} onChange={handleKpiSelect} allowedMetricTypes={['visibility', 'share', 'brandPresence', 'sentiment']} />
                  <HelpButton
                    onClick={() => handleHelpClick('trend-analysis')}
                    label="How to read this chart"
                    size={20}
                    className="flex-shrink-0"
                  />
                </div>

              </div>

            </div>

            <ChartControls
              startDate={startDate} // Use global date
              endDate={endDate}
              onStartDateChange={setStartDate} // Use global setter
              onEndDateChange={setEndDate}
              hideDateRange={true} // Hide local picker
              chartType={chartType}
              onChartTypeChange={setChartType}
              region={region}
              onRegionChange={setRegion}
              brands={brands}
              selectedBrandId={selectedBrandId}
              onBrandChange={selectBrand}
              compareMode={false} // Explicit boolean
              showComparison={false} // Explicit boolean
            />

            <div className="border-t border-[#e7ecff] p-6 bg-[#f9f9fb]/50 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={metricType}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="w-full h-full"
                >
                  <VisibilityChart
                    data={chartData}
                    chartType={chartType}
                    selectedModels={selectedModels}
                    loading={!!combinedLoading}
                    activeTab="competitive"
                    models={currentModels}
                    metricType={metricType}
                    completedRecommendations={dashboardData?.completedRecommendations}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Table Section */}
          <div className="flex flex-col flex-1 bg-white rounded-lg overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
              <h3 className="font-semibold text-gray-900">Detailed Breakdown</h3>
              <HelpButton
                onClick={() => handleHelpClick('table-guide')}
                label="How to use this table"
                size={20}
              />
            </div>
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
                loading={!!combinedLoading}
              />
            )}
          </div>
        </div>
      </div>
      {selectedBrandId && <AnalyzePrefetcher brandId={selectedBrandId} />}

      <EducationalContentDrawer
        isOpen={isHelpDrawerOpen}
        onClose={() => setIsHelpDrawerOpen(false)}
        kpiType={helpKpi}
      />
    </Layout >
  );
};
