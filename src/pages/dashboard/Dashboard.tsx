import { useMemo } from 'react';
import { Layout } from '../../components/Layout/Layout';
import { TopicSelectionModal } from '../../components/Topics/TopicSelectionModal';
import {
  MessageSquare,
  Activity,
  Target,
  Eye
} from 'lucide-react';
import { useDashboardData } from './hooks/useDashboardData';
import { getBrandData, formatMetricValue, computeTrend, formatNumber } from './utils';
import { KeyInsights } from './components/KeyInsights';
import { MetricCard } from './components/MetricCard';
import { TopBrandSources } from './components/TopBrandSources';
import { TopTopics } from './components/TopTopics';
import type { DashboardScoreMetric } from './types';

export const Dashboard = () => {
  const {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    showTopicModal,
    brands,
    brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand,
    dashboardData,
    dashboardErrorMsg,
    shouldShowLoading,
    handleRetryFetch,
    handleTopicsSelected,
    handleTopicModalClose
  } = useDashboardData();

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

  const metricCards = useMemo(
    () => [
      {
        key: 'visibility-index',
        title: 'Visibility Score',
        value: formatMetricValue(visibilityMetric, ''),
        subtitle: '',
        trend: computeTrend(visibilityMetric?.delta),
        icon: <Eye size={20} />,
        color: '#498cf9',
        linkTo: '/search-visibility',
        description:
          'Measures your brand\'s average prominence across all AI-generated answers. Higher scores indicate your brand appears more prominently in responses, calculated as the average position-weighted visibility across all queries.'
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
        description:
          'Represents your brand\'s share of the total answer space across all AI models. This metric shows what percentage of all mentions (your brand + competitors) belong to your brand, indicating your relative market presence.'
      },
      {
        key: 'sentiment-score',
        title: 'Sentiment Score',
        value: sentimentMetric ? formatNumber(sentimentMetric.value * 100, 0) : '—',
        subtitle: '',
        trend: computeTrend(sentimentMetric?.delta),
        icon: <MessageSquare size={20} />,
        color: '#00bcdc',
        linkTo: '/search-visibility?kpi=sentiment',
        description:
          'Average sentiment of how your brand is discussed in AI-generated answers. Scores range from -1 (very negative) to +1 (very positive), with 0 being neutral. This reflects overall brand perception across all queries.'
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
        description:
          'Percentage of queries where your brand appears in AI-generated answers. Calculated as (queries with brand presence / total queries) × 100. Higher percentages indicate your brand is mentioned more frequently across different queries.'
      }
    ],
    [visibilityMetric, shareMetric, sentimentMetric, brandPresencePercentage, dashboardData?.trendPercentage]
  );

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
        <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-10 flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full border-2 border-t-transparent border-[#00bcdc] animate-spin mb-4" />
            <p className="text-[14px] text-[#64748b]">Loading dashboard insights…</p>
          </div>
        </div>
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
        <div className="mb-6">
          <h1 className="text-[32px] font-bold text-[#1a1d29] mb-2">
            AI Visibility Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-[15px] text-[#393e51]">
              {overviewSubtitle}
            </p>
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
                    <option key={brandOption.id} value={brandOption.id}>
                      {brandOption.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <KeyInsights
          dashboardData={dashboardData}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        <div className="grid grid-cols-4 gap-5 mb-6">
          {metricCards.map(({ key, ...cardProps }) => (
            <MetricCard key={key} {...cardProps} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5 mb-6">
          <TopBrandSources brandPages={brandPages} />
          <TopTopics topTopics={topTopics} />
        </div>
      </div>

      {showTopicModal && (
          <TopicSelectionModal
            brandName={getBrandData().name}
            industry={getBrandData().industry}
            onNext={handleTopicsSelected}
            onBack={() => {}}
            onClose={handleTopicModalClose}
          />
      )}
    </Layout>
  );
};

