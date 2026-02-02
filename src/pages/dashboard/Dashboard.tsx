import { useMemo } from 'react';
import { Layout } from '../../components/Layout/Layout';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import {
  MessageSquare,
  Activity,
  Target,
  Eye
} from 'lucide-react';
import { useDashboardData } from './hooks/useDashboardData';
import { useOnboardingOrchestrator } from '../../hooks/useOnboardingOrchestrator';
import { getBrandData, formatMetricValue, computeTrend, formatNumber } from './utils';
import { MetricCard } from './components/MetricCard';
import { TopBrandSources } from './components/TopBrandSources';
import { TopTopics } from './components/TopTopics';
import { RecommendedActions } from './components/RecommendedActions';
import { DateRangeSelector } from './components/DateRangeSelector';
import { StackedRacingChart } from './components/StackedRacingChart';
import { LLMVisibilityTable } from './components/LLMVisibilityTable';
import { EmptyState } from './components/EmptyState';
import { InfoTooltip } from './components/InfoTooltip';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { prefetchOnIdle } from '../../lib/prefetch';
import { QueryTagFilter } from '../../components/common/QueryTagFilter';
import { useDashboardStore } from '../../store/dashboardStore';
import type { DashboardScoreMetric, LLMVisibilitySliceUI } from './types';
import type { ApiResponse, DashboardPayload } from './types';

export const Dashboard = () => {
  const { queryTags } = useDashboardStore();
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
    progressData
  } = useDashboardData();

  // Orchestrate automated onboarding steps (Domain Audit -> Recommendations)
  useOnboardingOrchestrator(selectedBrand);

  // Progress UI is now accessed via the Header bell (minimizable modal)
  // so we no longer render a separate full-screen processing state here.

  const handleBrandSelectFocus = () => {
    if (brands.length <= 1 || !selectedBrandId || !startDate || !endDate) {
      return;
    }

    const otherBrands = brands.filter((brand) => brand.id !== selectedBrandId);

    // Prefetch all other brands when dropdown is focused
    otherBrands.forEach((brand, index) => {
      // Small delay to avoid blocking UI
      setTimeout(() => {
        const params = new URLSearchParams({
          startDate,
          endDate,
        });
        const endpoint = `/brands/${brand.id}/dashboard?${params.toString()}`;

        prefetchOnIdle<ApiResponse<DashboardPayload>>(
          endpoint,
          {},
          { requiresAuth: true },
          500 // 500ms timeout
        );

        console.debug(`[DASHBOARD] Prefetched on focus for brand: ${brand.name}`);
      }, index * 100); // 100ms stagger between prefetches
    });
  };

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
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
    return value; // values are already in 1-100 range
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

            if (!Number.isFinite(value)) {
              return null;
            }

            return {
              label: entry.competitor,
              value: value as number,
              isBrand: false
            };
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
          key: 'visibility-index',
          title: 'Visibility Score',
          value: formatMetricValue(visibilityMetric, ''),
          subtitle: '',
          trend: computeTrend(visibilityMetric?.delta),
          icon: <Eye size={20} />,
          color: '#498cf9',
          linkTo: '/search-visibility',
          comparisons: buildComparisons('visibility'),
          comparisonSuffix: comparisonSuffix.visibility,
          metricType: 'visibility' as const,
          description: 'How prominent is your brand in LLM answers.(based on number of appearances and positions)'
        },
        {
          key: 'share-of-answers',
          title: 'Share of Answers',
          value: formatMetricValue(shareMetric),
          subtitle: '',
          trend: computeTrend(shareMetric?.delta),
          icon: <Target size={20} />,
          color: '#06c686',
          linkTo: '/search-visibility?kpi=share',
          comparisons: buildComparisons('share'),
          comparisonSuffix: comparisonSuffix.share,
          metricType: 'share' as const,
          description: '% of time you brand appeaars compared to your defined competitors. '
        },
        {
          key: 'sentiment-score',
          title: 'Sentiment Score',
          value: sentimentMetric ? formatNumber(sentimentMetric.value, 1) : '—',
          subtitle: '',
          trend: computeTrend(sentimentMetric?.delta),
          icon: <MessageSquare size={20} />,
          color: '#00bcdc',
          linkTo: '/search-visibility?kpi=sentiment',
          comparisons: buildComparisons('sentiment'),
          comparisonSuffix: comparisonSuffix.sentiment,
          metricType: 'sentiment' as const,
          description: 'Tone of the answers cited by LLMs from Brand\'s perspective (scaled 1-100)'
        },
        {
          key: 'brand-presence',
          title: 'Brand Presence',
          value: `${brandPresencePercentage}%`,
          subtitle: '',
          trend: computeTrend(dashboardData?.trendPercentage),
          icon: <Activity size={20} />,
          color: '#7c3aed',
          linkTo: '/search-visibility?kpi=brandPresence',
          comparisons: buildComparisons('brandPresence'),
          comparisonSuffix: comparisonSuffix.brandPresence,
          metricType: 'brandPresence' as const,
          description: '% of Answers that mention your brand\'s name in the answers.'
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
      brandLabel
    ]
  );

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

  const brandPages = dashboardData?.topBrandSources ?? [];
  const topTopics = dashboardData?.topTopics ?? [];

  // NOW we can do conditional returns AFTER all hooks
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
            <p className="text-[13px] text-[#64748b] mb-4">
              {errorMessage}
            </p>
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

  return (
    <Layout>
      <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
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
              <h1 className="text-[32px] font-bold text-[#1a1d29]">
                AI Visibility Dashboard
              </h1>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[15px] text-[#393e51]">
                {overviewSubtitle}
              </p>
              <div className="flex items-center gap-3">
                <QueryTagFilter variant="outline" className="border-gray-300/60 shadow-sm" />
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
        </div>

        <div className="grid grid-cols-4 gap-5 mb-6">
          {metricCards.map(({ key, ...cardProps }) => (
            <MetricCard key={key} {...cardProps} queryTags={queryTags} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5 mb-6">
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[18px] font-semibold text-[#1a1d29]">Source Type Distribution</h2>
              <InfoTooltip description="Shows the breakdown of citation sources by category (Editorial, Corporate, Reference, UGC, Social, Institutional). This helps you understand where your brand is being cited across different types of content sources in AI-generated answers. Click on any bar to see the top 5 sources for that source type." />
            </div>
            {(() => {
              const sourceSlices = (dashboardData?.sourceDistribution ?? [])
                .map((slice): { type: string; percentage: number; color: string } => ({
                  type: slice.label,
                  percentage: slice.percentage,
                  color: slice.color || '#64748b'
                }))
                .filter((slice) => Number.isFinite(slice.percentage) && slice.percentage >= 0);
              const hasSourceData = sourceSlices.length > 0;
              return hasSourceData ? (
                <StackedRacingChart
                  data={sourceSlices}
                  topSourcesByType={dashboardData?.topSourcesByType}
                />
              ) : (
                <EmptyState message="No source distribution data available for this period." />
              );
            })()}
          </div>

          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[18px] font-semibold text-[#1a1d29]">LLM Visibility (7 Days)</h2>
              <InfoTooltip description="Displays your brand's visibility score and brand presence percentage across different AI models (ChatGPT, Gemini, Claude, etc.) over the last 7 days. Visibility score measures prominence, while brand presence shows the percentage of queries where your brand appears." />
            </div>
            {(() => {
              const llmSlices: LLMVisibilitySliceUI[] = (dashboardData?.llmVisibility ?? [])
                .map((slice): LLMVisibilitySliceUI => {
                  const totalQueries = slice.totalQueries ?? 0;
                  const brandPresenceCount = slice.brandPresenceCount ?? 0;
                  const totalCollectorResults = slice.totalCollectorResults ?? totalQueries;
                  const brandPresencePercentage = totalCollectorResults > 0
                    ? Math.min(100, Math.round((brandPresenceCount / totalCollectorResults) * 100))
                    : 0;

                  return {
                    provider: slice.provider,
                    share: slice.shareOfSearch ?? slice.share,
                    shareOfSearch: slice.shareOfSearch ?? slice.share,
                    visibility: slice.visibility ?? 0,
                    sentiment: slice.sentiment ?? null,
                    delta: slice.delta ?? 0,
                    brandPresenceCount: brandPresencePercentage,
                    color: slice.color || '#64748b',
                    topTopic: slice.topTopic ?? null,
                    topTopics: slice.topTopics
                  };
                })
                .filter((slice) => Number.isFinite(slice.visibility ?? 0) && (slice.visibility ?? 0) >= 0);
              const hasLlmData = llmSlices.length > 0;
              return hasLlmData ? (
                <LLMVisibilityTable llmSlices={llmSlices} />
              ) : (
                <EmptyState message="No LLM visibility data available for this period." />
              );
            })()}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-6">
          <TopBrandSources brandPages={brandPages} />
          <TopTopics topTopics={topTopics} />
        </div>

        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5 mb-6">
          <RecommendedActions actionItems={dashboardData?.actionItems ?? []} />
        </div>
      </div>

    </Layout>
  );
};
