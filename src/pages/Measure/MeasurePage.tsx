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
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import {
  MessageSquare,
  Activity,
  Target,
  Eye
} from 'lucide-react';
import { useDashboardData } from '../dashboard/hooks/useDashboardData';
import { useOnboardingOrchestrator } from '../../hooks/useOnboardingOrchestrator';
import { getBrandData, formatMetricValue, computeTrend, formatNumber } from '../dashboard/utils';
import { MetricCard } from '../dashboard/components/MetricCard';
import { DateRangeSelector } from '../dashboard/components/DateRangeSelector';
import { DashboardSkeleton } from '../dashboard/components/DashboardSkeleton';
import { useCachedData } from '../../hooks/useCachedData';
import type { DashboardScoreMetric, LLMVisibilitySliceUI } from '../dashboard/types';
import type { ApiResponse, DashboardPayload } from '../dashboard/types';

// Note: Detailed chart components will be integrated from SearchVisibility in a future update
import { useManualBrandDashboard } from '../../manual-dashboard';
import '../../styles/visibility.css';

type MetricType = 'visibility' | 'share' | 'brandPresence' | 'sentiment';

const parseMetricType = (value: string | null): MetricType | null => {
  if (value === 'visibility' || value === 'share' || value === 'brandPresence' || value === 'sentiment') {
    return value;
  }
  return null;
};

export const MeasurePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const kpiParam = searchParams.get('kpi');
  const selectedKpi = parseMetricType(kpiParam) || 'visibility';
  
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
  useOnboardingOrchestrator(selectedBrandId);

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
          linkTo: '/measure?kpi=visibility',
          comparisons: buildComparisons('visibility'),
          comparisonSuffix: comparisonSuffix.visibility,
          description: 'How prominent is your brand in LLM answers.(based on number of appearances and positions)',
          isActive: selectedKpi === 'visibility'
        },
        {
          key: 'share-of-answers',
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
          key: 'sentiment-score',
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
          key: 'brand-presence',
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

  const handleKpiSelect = (kpi: MetricType) => {
    setSearchParams({ kpi });
  };

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
              <h1 className="text-[32px] font-bold text-[#1a1d29]">
                AI Visibility Dashboard
              </h1>
            </div>
            <div className="flex items-center justify-between gap-4">
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
              onClick={() => handleKpiSelect(key.replace('-index', '').replace('-of-answers', '').replace('-score', '').replace('-presence', '') as MetricType)}
            >
              <MetricCard {...cardProps} />
            </div>
          ))}
        </div>

        {/* Search Visibility Content */}
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm">
          {/* KPI Selector Tabs - now controlled by clicking on KPI cards above */}
          <div className="border-b border-[#e8e9ed] p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#64748b]">SELECT KPI</span>
              <div className="flex gap-2 ml-4">
                {[
                  { id: 'visibility', label: 'Visibility Score', icon: '📊' },
                  { id: 'share', label: 'Share of Answers', icon: '⏱' },
                  { id: 'brandPresence', label: 'Brand Presence', icon: '👁' },
                  { id: 'sentiment', label: 'Sentiment Score', icon: '❤️' },
                ].map((kpi) => (
                  <button
                    key={kpi.id}
                    onClick={() => handleKpiSelect(kpi.id as MetricType)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedKpi === kpi.id
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    {kpi.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart and Table Content - Pass data from dashboard */}
          <div className="p-6">
            <div className="text-center text-[#64748b] py-12">
              {/* The detailed chart content will be integrated from SearchVisibility */}
              <p className="text-sm">
                Detailed {selectedKpi === 'visibility' ? 'Visibility Score' : 
                          selectedKpi === 'share' ? 'Share of Answers' :
                          selectedKpi === 'brandPresence' ? 'Brand Presence' :
                          'Sentiment Score'} analysis
              </p>
              <p className="text-xs text-[#94a3b8] mt-2">
                Charts and LLM comparison table will load here
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
