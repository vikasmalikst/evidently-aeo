import { useEffect, useMemo, useState, useCallback } from 'react';
import { Layout } from '../components/Layout/Layout';
import { VisibilityTabs } from '../components/Visibility/VisibilityTabs';
import { ChartControls } from '../components/Visibility/ChartControls';
import { VisibilityChart } from '../components/Visibility/VisibilityChart';
import { VisibilityTable } from '../components/Visibility/VisibilityTable';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/apiClient';
import '../styles/visibility.css';

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
  collectors?: Array<{
    collectorType: string;
    mentions: number;
  }>;
}

interface DashboardPayload {
  llmVisibility?: LlmVisibilitySlice[];
  visibilityComparison?: VisibilityComparisonEntry[];
  competitorVisibility?: CompetitorVisibilityEntry[];
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
  topTopics?: LlmTopic[];
  color?: string;
}

const chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const normalizeId = (label: string) => label.toLowerCase().replace(/\s+/g, '-');

const buildTimeseries = (value: number) => Array(chartLabels.length).fill(Math.max(0, Math.round(value)));

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
  const [activeTab, setActiveTab] = useState<'brand' | 'competitive'>('brand');
  const [timeframe, setTimeframe] = useState('weekly');
  const [chartType, setChartType] = useState('line');
  const [region, setRegion] = useState('us');
  const [stacked, setStacked] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [brandModels, setBrandModels] = useState<ModelData[]>([]);
  const [competitorModels, setCompetitorModels] = useState<ModelData[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const authLoading = useAuthStore((state) => state.isLoading);
  const {
    brands,
    selectedBrandId,
    selectedBrand,
    isLoading: brandsLoading,
    selectBrand,
    error: brandsError
  } = useManualBrandDashboard();

  const dateRange = useMemo(() => getDateRangeForTimeframe(timeframe), [timeframe]);

  useEffect(() => {
    if (authLoading || brandsLoading || !selectedBrandId) {
      return;
    }

    let cancelled = false;

    const fetchVisibility = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        });
        const endpoint = `/brands/${selectedBrandId}/dashboard?${params.toString()}`;
        const response = await apiClient.request<ApiResponse<DashboardPayload>>(
          endpoint
        );

        if (!response.success || !response.data) {
          throw new Error(response.error || response.message || 'Failed to load visibility data.');
        }

        if (cancelled) {
          return;
        }

        const llmSlices = response.data.llmVisibility ?? [];
        const llmModels = llmSlices.map((slice) => {
          const totalQueries = slice.totalQueries ?? 0;
          const brandPresenceCount = slice.brandPresenceCount ?? 0;
          // Brand Presence % = (queries with brand presence / total queries) * 100, capped at 100%
          const brandPresencePercentage = totalQueries > 0 
            ? Math.min(100, Math.round((brandPresenceCount / totalQueries) * 100))
            : 0;
          
          return {
            id: normalizeId(slice.provider),
            name: slice.provider,
            score: Math.round(slice.visibility ?? 0), // Use visibility, not share
            shareOfSearch: Math.round(slice.shareOfSearch ?? slice.share ?? 0),
            shareOfSearchChange: slice.delta ? Math.round(slice.delta) : 0,
            topTopic:
              slice.topTopic ??
              slice.topTopics?.[0]?.topic ??
              '—',
            change: slice.delta ? Math.round(slice.delta) : 0,
            referenceCount: brandPresenceCount,
            brandPresencePercentage,
            data: buildTimeseries(slice.visibility ?? 0),
            topTopics: slice.topTopics ?? [],
            color: slice.color // Include color from backend
          };
        });

        const competitorEntries = response.data.competitorVisibility ?? [];

        const competitorModels = competitorEntries.map((entry) => ({
          id: normalizeId(entry.competitor),
          name: entry.competitor,
          score: Math.round(entry.visibility ?? 0),
          shareOfSearch: Math.round(entry.share ?? 0),
          topTopic: '—',
          change: 0,
          referenceCount: entry.mentions ?? 0,
          brandPresencePercentage: 0, // Not applicable for competitors
          data: buildTimeseries(entry.visibility ?? 0),
          topTopics: []
        }));

        setBrandModels(llmModels);
        setCompetitorModels(competitorModels);
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : 'Failed to load visibility data.';
        if (!cancelled) {
          setError(message);
          setBrandModels([]);
          setCompetitorModels([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchVisibility();

    return () => {
      cancelled = true;
    };
  }, [authLoading, brandsLoading, selectedBrandId, dateRange.startDate, dateRange.endDate, reloadToken]);

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
    labels: chartLabels,
    datasets: currentModels.map((model) => ({
      id: model.id,
      label: model.name,
      data: model.data
    }))
  }), [currentModels]);

  const combinedLoading = authLoading || brandsLoading || loading;
  const combinedError = brandsError || error;

  const handleRetry = useCallback(() => {
    setError(null);
    setReloadToken((prev) => prev + 1);
  }, []);

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
          {combinedError && !combinedLoading && (
            <div className="bg-white border border-[#f2b8b5] rounded-lg p-6 text-center">
              <p className="text-sm text-[#b42318] mb-3">{combinedError}</p>
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
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              chartType={chartType}
              onChartTypeChange={setChartType}
              region={region}
              onRegionChange={setRegion}
              stacked={stacked}
              onStackedChange={setStacked}
            />

            <VisibilityChart
              data={chartData}
              chartType={chartType}
              timeframe={timeframe}
              selectedModels={selectedModels}
              loading={combinedLoading}
              activeTab={activeTab}
              models={currentModels}
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
