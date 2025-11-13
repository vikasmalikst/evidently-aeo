import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Layout } from '../components/Layout/Layout';
import { TopicSelectionModal } from '../components/Topics/TopicSelectionModal';
import { mockPromptsData } from '../data/mockPromptsData';
import { mockSourcesData } from '../data/mockSourcesData';
import { mockCitationSourcesData } from '../data/mockCitationSourcesData';
import type { Topic } from '../types/topic';
import { featureFlags } from '../config/featureFlags';
import { onboardingUtils } from '../utils/onboardingUtils';
import {
  TrendingUp,
  MessageSquare,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Activity,
  Target,
  Eye,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getLLMIcon } from '../components/Visibility/LLMIcons';
import { apiClient } from '../lib/apiClient';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface BrandSummary {
  id: string;
  name: string;
  slug?: string | null;
}

interface DashboardScoreMetric {
  label: string;
  value: number;
  delta: number;
  description: string;
}

interface DashboardPayload {
  brandId: string;
  brandName: string;
  brandSlug?: string;
  customerId: string;
  dateRange: {
    start: string;
    end: string;
  };
  totalQueries: number;
  totalResponses: number;
  trendPercentage: number;
  visibilityPercentage: number;
  sentimentScore: number;
  scores: DashboardScoreMetric[];
}

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-31');
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [showTopicModal, setShowTopicModal] = useState(false);

  const getBrandData = () => {
    const brandInfo = localStorage.getItem('onboarding_brand');
    if (brandInfo) {
      try {
        const parsed = JSON.parse(brandInfo);
        return { name: parsed.name || 'Your Brand', industry: parsed.industry || 'Technology' };
      } catch (e) {
        return { name: 'Your Brand', industry: 'Technology' };
      }
    }
    return { name: 'Your Brand', industry: 'Technology' };
  };

  useEffect(() => {
    // Skip setup check if feature flag is set (for testing)
    if (featureFlags.skipSetupCheck || featureFlags.skipOnboardingCheck) {
      console.log('🚀 Skipping setup check (feature flag enabled)');
      return;
    }

    // Force setup if feature flag is set
    if (featureFlags.forceSetup || featureFlags.forceOnboarding) {
      console.log('🚀 Forcing setup (feature flag enabled)');
      navigate('/setup');
      return;
    }

    const hasCompletedSetup = onboardingUtils.isOnboardingComplete();
    const hasCompletedTopicSelection = onboardingUtils.getOnboardingTopics();
    const hasCompletedPromptSelection = onboardingUtils.getOnboardingPrompts();

    console.log('Dashboard useEffect - Checking flow:', {
      hasCompletedSetup,
      hasCompletedTopicSelection: !!hasCompletedTopicSelection,
      hasCompletedPromptSelection: !!hasCompletedPromptSelection
    });

    // Redirect to setup if not complete
    if (!hasCompletedSetup) {
      console.log('No setup - redirecting to /setup');
      navigate('/setup');
      return;
    }

    // Testing mode (only in development)
    if (featureFlags.enableTestingMode && featureFlags.isDevelopment) {
      console.log('🧪 Testing mode enabled - showing topic modal');
      const timer = setTimeout(() => {
        setShowTopicModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Production flow: Check for incomplete steps
    if (!hasCompletedTopicSelection) {
      console.log('No topics - showing topic modal in 500ms');
      const timer = setTimeout(() => {
        setShowTopicModal(true);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!hasCompletedPromptSelection) {
      console.log('No prompts - redirecting to /prompt-selection in 500ms');
      const timer = setTimeout(() => {
        navigate('/prompt-selection');
      }, 500);
      return () => clearTimeout(timer);
    } else {
      console.log('All setup complete - showing full dashboard');
    }
  }, [navigate]);

  const handleTopicsSelected = (selectedTopics: Topic[]) => {
    localStorage.setItem('onboarding_topics', JSON.stringify(selectedTopics));
    setShowTopicModal(false);
    navigate('/prompt-selection');
  };

  const handleTopicModalClose = () => {
    setShowTopicModal(false);
  };

  const displayName = user?.fullName || user?.email?.split('@')[0] || 'there';

  const criticalAlerts = mockSourcesData.insights.warnings.length;
  const brandPages = [
    { id: 1, title: 'Product Features Page', url: 'your-brand.com/features', impactScore: 8.5, delta: 1.2 },
    { id: 2, title: 'Pricing & Plans', url: 'your-brand.com/pricing', impactScore: 9.2, delta: 0.8 },
    { id: 3, title: 'Case Studies & Success Stories', url: 'your-brand.com/case-studies', impactScore: 7.8, delta: -0.5 },
    { id: 4, title: 'Integration Documentation', url: 'your-brand.com/docs/integrations', impactScore: 6.9, delta: 0.3 },
    { id: 5, title: 'Product Comparison Guide', url: 'your-brand.com/compare', impactScore: 8.1, delta: -1.1 },
  ];

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let cancelled = false;

    const fetchDashboard = async () => {
      setDashboardLoading(true);
      setDashboardError(null);

      try {
        const brandsResponse = await apiClient.request<ApiResponse<BrandSummary[]>>('/brands');

        if (!brandsResponse.success) {
          throw new Error(brandsResponse.error || brandsResponse.message || 'Failed to load brands.');
        }

        const brands = brandsResponse.data ?? [];

        if (brands.length === 0) {
          throw new Error('No brands found for this account. Please add a brand to view the dashboard.');
        }

        const primaryBrand = brands[0];

        const dashboardResponse = await apiClient.request<ApiResponse<DashboardPayload>>(
          `/brands/${primaryBrand.id}/dashboard`
        );

        if (!dashboardResponse.success || !dashboardResponse.data) {
          throw new Error(
            dashboardResponse.error || dashboardResponse.message || 'Failed to load dashboard data.'
          );
        }

        if (!cancelled) {
          setDashboardData(dashboardResponse.data);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load dashboard data.';
        if (!cancelled) {
          setDashboardError(message);
          setDashboardData(null);
        }
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [authLoading, reloadKey]);

  const handleRetryFetch = () => {
    setReloadKey((prev) => prev + 1);
  };

  if (dashboardLoading) {
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

  if (dashboardError || !dashboardData) {
    return (
      <Layout>
        <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="max-w-xl mx-auto bg-white border border-[#fadddb] rounded-lg shadow-sm p-6 text-center">
            <h2 className="text-[18px] font-semibold text-[#1a1d29] mb-2">Unable to load dashboard</h2>
            <p className="text-[13px] text-[#64748b] mb-4">
              {dashboardError ?? 'Dashboard data is currently unavailable.'}
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

  const findScore = (label: string) =>
    dashboardData?.scores?.find((metric) => metric.label.toLowerCase() === label.toLowerCase());

  const formatNumber = (value: number, decimals = 1): string => {
    const fixed = value.toFixed(decimals);
    if (decimals === 0) {
      return fixed;
    }
    return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  };

  const formatMetricValue = (metric: DashboardScoreMetric | undefined, suffix = '%'): string => {
    if (!metric) {
      return '—';
    }
    return `${formatNumber(metric.value, 1)}${suffix}`;
  };

  const computeTrend = (delta?: number) => {
    if (!delta) {
      return { direction: 'stable' as const, value: 0 };
    }
    return {
      direction: delta > 0 ? ('up' as const) : ('down' as const),
      value: Number(Math.abs(delta).toFixed(1))
    };
  };

  const visibilityMetric = findScore('Visibility Index');
  const shareMetric = findScore('Share of Answers');
  const sentimentMetric = findScore('Sentiment Score');

  const metricCards: Array<MetricCardProps & { key: string }> = [
    {
      key: 'visibility-index',
      title: 'Visibility Index',
      value: formatMetricValue(visibilityMetric),
      subtitle: `Across ${formatNumber(dashboardData.totalQueries, 0)} queries`,
      trend: computeTrend(visibilityMetric?.delta),
      icon: <Eye size={20} />,
      color: '#498cf9',
      linkTo: '/search-visibility'
    },
    {
      key: 'share-of-answers',
      title: 'Share of Answers',
      value: formatMetricValue(shareMetric),
      subtitle: 'Share across tracked queries',
      trend: computeTrend(shareMetric?.delta),
      icon: <Target size={20} />,
      color: '#06c686',
      linkTo: '/ai-sources'
    },
    {
      key: 'sentiment-score',
      title: 'Sentiment Score',
      value: formatMetricValue(sentimentMetric),
      subtitle: 'Normalized 0-100 sentiment',
      trend: computeTrend(sentimentMetric?.delta),
      icon: <MessageSquare size={20} />,
      color: '#00bcdc',
      linkTo: '/prompts'
    },
    {
      key: 'tracked-queries',
      title: 'Tracked Queries',
      value: formatNumber(dashboardData.totalQueries, 0),
      subtitle: `Total responses: ${formatNumber(dashboardData.totalResponses, 0)}`,
      trend: computeTrend(dashboardData.trendPercentage),
      icon: <Activity size={20} />,
      color: '#7c3aed',
      linkTo: '/topics'
    }
  ];

  const overviewSubtitle = dashboardData.brandName
    ? `Here's your AI visibility performance overview for ${dashboardData.brandName}`
    : `Here's your AI visibility performance overview`;

  return (
    <Layout>
      <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        {criticalAlerts > 0 && (
          <div className="bg-[#fff8f0] border border-[#f9db43] rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle size={20} className="text-[#fa8a40] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-1">
                {criticalAlerts} Alert{criticalAlerts > 1 ? 's' : ''} Requiring Attention
              </h3>
              {mockSourcesData.insights.warnings.map((warning, idx) => (
                <p key={idx} className="text-[13px] text-[#393e51]">
                  <span className="font-medium">{warning.source}:</span> {warning.message}
                </p>
              ))}
            </div>
            <Link
              to="/search-sources"
              className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
            >
              View Details
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-[32px] font-bold text-[#1a1d29] mb-2">
            Welcome back, {displayName}
          </h1>
          <p className="text-[15px] text-[#393e51]">
            {overviewSubtitle}
          </p>
        </div>

        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-semibold text-[#1a1d29]">
              Key Insights & Recommendations
            </h2>
            <div className="flex items-center gap-3">
              <label className="text-[13px] text-[#64748b] font-medium">Date Range:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-[#e8e9ed] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc]"
              />
              <span className="text-[13px] text-[#64748b]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-[#e8e9ed] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-white border-[#e8e9ed]">
              <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-4">Source Type Distribution</h3>
              <StackedRacingChart data={mockCitationSourcesData.sourceTypeDistribution} />
            </div>

            <div className="p-4 rounded-lg border bg-white border-[#e8e9ed]">
              <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-4">LLM Visibility (7 Days)</h3>
              <div className="flex gap-6 items-center">
                <div className="flex flex-col items-center gap-2">
                  <div style={{ width: '130px', height: '130px' }} className="flex-shrink-0">
                    <LLMVisibilityDonut data={mockSourcesData.sources.slice(0, 5)} />
                  </div>
                  <span className="text-[11px] font-medium text-[#64748b]">Total Visibility</span>
                </div>
                <div className="flex-1 space-y-2">
                  {mockSourcesData.sources.slice(0, 5).map((source) => (
                    <div key={source.id} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: source.color }}
                      />
                      <div className="flex-shrink-0">
                        {getLLMIcon(source.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-medium text-[#1a1d29]">{source.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-semibold text-[#1a1d29]">
                          {(source.mentionRate * 100).toFixed(0)}%
                        </span>
                        <span className={`flex items-center text-[11px] font-semibold ${
                          source.trendDirection === 'up' ? 'text-[#06c686]' : 'text-[#f94343]'
                        }`}>
                          {source.trendDirection === 'up' ? (
                            <ChevronUp size={12} strokeWidth={2.5} />
                          ) : (
                            <ChevronDown size={12} strokeWidth={2.5} />
                          )}
                          {Math.abs(source.trendPercent)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[#e8e9ed]">
            <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-3">Recommended Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {mockSourcesData.insights.recommendations.slice(0, 4).map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-[#f9f9fb] rounded-lg">
                  <CheckCircle size={16} className="text-[#06c686] flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-[#393e51]">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-5 mb-6">
          {metricCards.map(({ key, ...cardProps }) => (
            <MetricCard key={key} {...cardProps} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5 mb-6">
          <div className="col-span-2">
            <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-semibold text-[#1a1d29]">
                  Top Brand Sources
                </h2>
                <Link
                  to="/ai-sources"
                  className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
                >
                  View All
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e8e9ed]">
                      <th className="text-left py-3 px-3 text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                        Page Title
                      </th>
                      <th className="text-left py-3 px-3 text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                        Page URL
                      </th>
                      <th className="text-center py-3 px-3 text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                        Impact Score
                      </th>
                      <th className="text-center py-3 px-3 text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandPages.map((page) => (
                      <tr key={page.id} className="border-b border-[#f4f4f6] last:border-0 hover:bg-[#f9f9fb] transition-colors">
                        <td className="py-3 px-3">
                          <span className="text-[14px] font-medium text-[#1a1d29]">{page.title}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[13px] text-[#64748b]">{page.url}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center justify-center">
                            <span className="text-[14px] font-semibold text-[#1a1d29]">
                              {page.impactScore.toFixed(1)}
                            </span>
                            <span className="text-[12px] text-[#64748b] ml-1">/10</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className={`inline-flex items-center gap-1 text-[13px] font-semibold ${
                            page.delta > 0 ? 'text-[#06c686]' : 'text-[#f94343]'
                          }`}>
                            {page.delta > 0 ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                            {Math.abs(page.delta).toFixed(1)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-semibold text-[#1a1d29]">
                Quick Actions
              </h2>
            </div>

            <div className="space-y-3">
              <ActionCard
                title="Analyze Prompts"
                description="Review AI responses to tracked queries"
                link="/prompts"
                icon={<MessageSquare size={18} />}
                color="#498cf9"
              />
              <ActionCard
                title="Track Keywords"
                description="Monitor keyword impact and associations"
                link="/keywords"
                icon={<Activity size={18} />}
                color="#06c686"
              />
              <ActionCard
                title="Citation Sources"
                description="Explore domains citing your brand"
                link="/ai-sources"
                icon={<ExternalLink size={18} />}
                color="#fa8a40"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-6">
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-semibold text-[#1a1d29]">
                Top Performing Topics
              </h2>
              <Link
                to="/prompts"
                className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
              >
                View All
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-3">
              {mockPromptsData.slice(0, 5).map((topic) => {
                const promptCount = topic.prompts.length || 1;
                const avgVolume = topic.prompts.reduce((sum, p) => sum + p.volume, 0) / promptCount;
                const avgSent = topic.prompts.reduce((sum, p) => sum + p.sentiment, 0) / promptCount;

                return (
                  <div key={topic.id} className="flex items-center justify-between py-2 border-b border-[#f4f4f6] last:border-0">
                    <div className="flex-1">
                      <h3 className="text-[14px] font-medium text-[#1a1d29] mb-1">{topic.name}</h3>
                      <p className="text-[12px] text-[#64748b]">{topic.prompts.length} prompts tracked</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-semibold text-[#1a1d29]">{avgVolume.toFixed(1)}%</div>
                      <div className="text-[12px] text-[#64748b]">Avg volume</div>
                    </div>
                    <div className="ml-4">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                        avgSent >= 4.5 ? 'bg-[#e6f7f1]' : avgSent >= 3.5 ? 'bg-[#fff8e6]' : 'bg-[#fff0f0]'
                      }`}>
                        <span className={`text-[14px] font-semibold ${
                          avgSent >= 4.5 ? 'text-[#06c686]' : avgSent >= 3.5 ? 'text-[#f9db43]' : 'text-[#f94343]'
                        }`}>
                          {avgSent.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-semibold text-[#1a1d29]">
                Partnership Opportunities
              </h2>
              <Link
                to="/ai-sources"
                className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
              >
                View All
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-3">
              {mockCitationSourcesData.insights.partnershipOpportunities.map((opp) => (
                <div key={opp.rank} className="p-3 bg-[#f9f9fb] rounded-lg border border-[#e8e9ed]">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#00bcdc] text-white text-[12px] font-semibold flex items-center justify-center">
                        {opp.rank}
                      </div>
                      <h3 className="text-[14px] font-medium text-[#1a1d29]">{opp.source}</h3>
                    </div>
                    <div className={`flex items-center gap-1 text-[12px] font-medium ${
                      opp.trend.direction === 'up' ? 'text-[#06c686]' : 'text-[#64748b]'
                    }`}>
                      {opp.trend.direction === 'up' && <TrendingUp size={12} />}
                      {opp.trend.percent}%
                    </div>
                  </div>
                  <p className="text-[12px] text-[#64748b] mb-2">{opp.recommendation}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748b] bg-white px-2 py-1 rounded">
                      {opp.type}
                    </span>
                    <span className="text-[12px] font-medium text-[#1a1d29]">{opp.usage}% usage</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(() => {
        console.log('Rendering modal check - showTopicModal:', showTopicModal);
        return showTopicModal && (
          <TopicSelectionModal
            brandName={getBrandData().name}
            industry={getBrandData().industry}
            onNext={handleTopicsSelected}
            onBack={() => {}}
            onClose={handleTopicModalClose}
          />
        );
      })()}
    </Layout>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend: { direction: 'up' | 'down' | 'stable'; value: number };
  icon: React.ReactNode;
  color: string;
  linkTo: string;
}

const MetricCard = ({ title, value, subtitle, trend, icon, color, linkTo }: MetricCardProps) => (
  <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5 flex flex-col">
    <div className="flex items-center gap-3 mb-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="text-[14px] font-semibold text-[#1a1d29]">{title}</div>
    </div>
    <div className="flex items-end gap-2 mb-1">
      <div className="text-[28px] font-bold text-[#1a1d29] leading-none">{value}</div>
      {trend.direction !== 'stable' && (
        <div className={`flex items-center gap-0.5 text-[11px] font-semibold pb-1 ${
          trend.direction === 'up' ? 'text-[#06c686]' : 'text-[#f94343]'
        }`}>
          {trend.direction === 'up' ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    <div className="text-[12px] text-[#64748b] mb-auto">{subtitle}</div>
    <div className="mt-4 pt-3 border-t border-[#e8e9ed]">
      <Link
        to={linkTo}
        className="text-[12px] text-[#64748b] hover:text-[#00bcdc] transition-colors"
      >
        See analysis →
      </Link>
    </div>
  </div>
);

interface ActionCardProps {
  title: string;
  description: string;
  link: string;
  icon: React.ReactNode;
  color: string;
}

const ActionCard = ({ title, description, link, icon, color }: ActionCardProps) => (
  <Link
    to={link}
    className="block p-3 border border-[#e8e9ed] rounded-lg hover:border-[#00bcdc] hover:bg-[#f9fbfc] transition-all group"
  >
    <div className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[14px] font-medium text-[#1a1d29] mb-1 group-hover:text-[#00bcdc] transition-colors">
          {title}
        </h3>
        <p className="text-[12px] text-[#64748b]">{description}</p>
      </div>
      <ArrowRight size={16} className="text-[#c6c9d2] group-hover:text-[#00bcdc] transition-colors flex-shrink-0 mt-1" />
    </div>
  </Link>
);

interface StackedRacingChartProps {
  data: Array<{
    type: string;
    count: number;
    percentage: number;
    color: string;
  }>;
}

const StackedRacingChart = ({ data }: StackedRacingChartProps) => {
  const chartData = {
    labels: [''],
    datasets: data.map((item) => ({
      label: item.type,
      data: [item.percentage],
      backgroundColor: item.color,
      borderWidth: 0,
      barPercentage: 1,
      categoryPercentage: 0.9,
    })),
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        max: 100,
        display: false,
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        display: false,
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.x}%`;
          },
        },
      },
    },
  };

  return (
    <div>
      <div style={{ height: '40px' }}>
        <Bar data={chartData} options={options} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-[#64748b] truncate">{item.type}</div>
              <div className="text-[13px] font-semibold text-[#1a1d29]">{item.percentage}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface LLMVisibilityDonutProps {
  data: Array<{
    id: number | string;
    name: string;
    mentionRate: number;
    color: string;
  }>;
}

const LLMVisibilityDonut = ({ data }: LLMVisibilityDonutProps) => {
  const chartData = {
    labels: data.map(item => item.name),
    datasets: [
      {
        data: data.map(item => item.mentionRate * 100),
        backgroundColor: data.map(item => item.color),
        borderWidth: 0,
        borderRadius: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '65%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.label}: ${context.parsed.toFixed(1)}%`;
          },
        },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
};
