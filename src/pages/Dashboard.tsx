import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useManualBrandDashboard } from '../manual-dashboard';
import { Layout } from '../components/Layout/Layout';
import { TopicSelectionModal } from '../components/Topics/TopicSelectionModal';
import type { Topic } from '../types/topic';
import { featureFlags } from '../config/featureFlags';
import { onboardingUtils } from '../utils/onboardingUtils';
import {
  TrendingUp,
  MessageSquare,
  ExternalLink,
  CheckCircle,
  ArrowRight,
  Activity,
  Target,
  Eye,
  ChevronUp,
  ChevronDown,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getLLMIcon } from '../components/Visibility/LLMIcons';
import { useCachedData } from '../hooks/useCachedData';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface DashboardScoreMetric {
  label: string;
  value: number;
  delta: number;
  description: string;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'content' | 'technical' | 'distribution' | 'monitoring';
}

interface CollectorSummary {
  collectorType?: string;
  status: 'completed' | 'failed' | 'pending' | 'running';
  successRate: number;
  completed: number;
  failed: number;
  lastRunAt?: string | null;
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
  queriesWithBrandPresence: number;
  collectorResultsWithBrandPresence: number;
  brandPresenceRows: number;
  totalBrandRows: number;
  totalResponses: number;
  trendPercentage: number;
  visibilityPercentage: number;
  sentimentScore: number;
  scores: DashboardScoreMetric[];
  sourceDistribution: Array<{
    label: string;
    percentage: number;
    color?: string;
  }>;
  topSourcesDistribution?: Array<{
    label: string;
    percentage: number;
    color?: string;
  }>;
  llmVisibility: Array<{
    provider: string;
    share: number;
    shareOfSearch?: number;
    visibility?: number;
    delta: number;
    brandPresenceCount: number;
    totalQueries?: number;
    color?: string;
    topTopic?: string | null;
    topTopics?: Array<{
      topic: string;
      occurrences: number;
      share: number;
      visibility: number;
      mentions: number;
    }>;
  }>;
  actionItems?: ActionItem[];
  collectorSummaries?: CollectorSummary[];
  topBrandSources: Array<{
    id: string;
    title: string;
    url: string;
    urls?: string[]; // All cited URLs for this domain
    domain: string;
    impactScore: number | null;
    change: number | null;
    visibility: number;
    share: number;
    usage: number;
  }>;
  topTopics: Array<{
    topic: string;
    promptsTracked: number;
    averageVolume: number;
    sentimentScore: number | null;
    avgVisibility?: number | null;
    avgShare?: number | null;
    brandPresencePercentage?: number | null;
  }>;
}

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const formatDateForInput = (date: Date): string => date.toISOString().split('T')[0];

const getDefaultDateRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return {
    start: formatDateForInput(start),
    end: formatDateForInput(end)
  };
};

interface InfoTooltipProps {
  description: string;
}

const InfoTooltip = ({ description }: InfoTooltipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        className="flex items-center justify-center w-4 h-4 rounded-full text-[#64748b] hover:text-[#1a1d29] transition-colors focus:outline-none"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        aria-label="More information"
      >
        <Info size={14} />
      </button>
      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#1a1d29] text-white text-[12px] rounded-lg shadow-lg z-[100] pointer-events-none">
          <div className="whitespace-normal leading-relaxed">{description}</div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1a1d29]"></div>
        </div>
      )}
    </div>
  );
};

interface UrlTooltipProps {
  url: string;
  fullUrl: string;
}

interface UrlTooltipProps {
  url: string;
  fullUrl: string;
  urls?: string[]; // All cited URLs for this domain
}

const UrlTooltip = ({ url, fullUrl, urls }: UrlTooltipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const hasMultipleUrls = urls && urls.length > 1;

  // If multiple URLs, show dropdown; otherwise show single link
  if (hasMultipleUrls) {
    return (
      <div className="relative inline-flex items-center">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="text-[12px] text-[#00bcdc] hover:text-[#0096b0] font-medium flex items-center gap-1 transition-colors"
        >
          <ExternalLink size={12} />
          View URL ({urls.length})
        </button>
        {showDropdown && (
          <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[90vw] bg-white border border-[#e8e9ed] rounded-lg shadow-lg z-[100] overflow-hidden">
            <div className="p-2 max-h-64 overflow-y-auto">
              <div className="text-[11px] text-[#64748b] font-medium mb-2 px-2 py-1">
                Select URL to visit:
              </div>
              {urls.map((urlItem, index) => {
                const fullUrlItem = urlItem.startsWith('http') ? urlItem : `https://${urlItem}`;
                return (
                  <a
                    key={index}
                    href={fullUrlItem}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3 py-2 text-[12px] text-[#1a1d29] hover:bg-[#f9f9fb] rounded transition-colors break-all"
                    onClick={() => setShowDropdown(false)}
                  >
                    <div className="flex items-center gap-2">
                      <ExternalLink size={12} className="flex-shrink-0 text-[#00bcdc]" />
                      <span className="truncate" title={urlItem}>
                        {urlItem.replace(/^https?:\/\//, '')}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
        {/* Click outside to close */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  // Single URL - show tooltip on hover
  return (
    <div className="relative inline-flex items-center">
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] text-[#00bcdc] hover:text-[#0096b0] font-medium flex items-center gap-1 transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <ExternalLink size={12} />
        View URL
      </a>
      {showTooltip && (
        <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[90vw] p-2.5 bg-[#1a1d29] text-white text-[11px] rounded-lg shadow-lg z-[100] pointer-events-none break-all">
          <div className="whitespace-normal leading-relaxed" style={{ wordBreak: 'break-all' }}>
            {url}
          </div>
          <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1a1d29]"></div>
        </div>
      )}
    </div>
  );
};

export const Dashboard = () => {
  const pageMountTime = useRef(performance.now());
  console.log('[DASHBOARD] Component mounting at', performance.now());
  
  const authLoading = useAuthStore((state) => state.isLoading);
  const defaultDateRange = useMemo(getDefaultDateRange, []);
  const [startDate, setStartDate] = useState(defaultDateRange.start);
  const [endDate, setEndDate] = useState(defaultDateRange.end);
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [showTopicModal, setShowTopicModal] = useState(false);
  // Check if data collection is still in progress - must be declared before any conditional returns
  const [isDataCollectionInProgress, setIsDataCollectionInProgress] = useState(false);
  
  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS
  const {
    brands,
    isLoading: brandsLoading,
    error: brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand
  } = useManualBrandDashboard();
  
  console.log('[DASHBOARD] Initial state set at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms');

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
    if (!brandsLoading && brands.length > 0) {
      console.log('[DASHBOARD] Brands loaded at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms', '- Brands:', brands.length, '- Selected brand ID:', selectedBrandId);
    } else if (brandsLoading) {
      console.log('[DASHBOARD] Brands loading... at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms');
    }
  }, [brandsLoading, brands.length, selectedBrandId]);

  // Auto-select brand when coming from onboarding
  useEffect(() => {
    if (brandsLoading || brands.length === 0) {
      return;
    }

    const locationState = location.state as { autoSelectBrandId?: string; fromOnboarding?: boolean } | null;
    
    if (locationState?.autoSelectBrandId && locationState.fromOnboarding) {
      const brandToSelect = locationState.autoSelectBrandId;
      
      // Check if the brand exists in the brands list
      const brandExists = brands.some(brand => brand.id === brandToSelect);
      
      if (brandExists && selectedBrandId !== brandToSelect) {
        console.log(`[DASHBOARD] Auto-selecting brand from onboarding: ${brandToSelect}`);
        selectBrand(brandToSelect);
        // Clear the location state to prevent re-selecting on re-renders
        window.history.replaceState({}, document.title);
      } else if (!brandExists) {
        // If brand doesn't exist yet, select the latest brand (first in list, as they're sorted by created_at desc)
        const latestBrand = brands[0];
        if (latestBrand && selectedBrandId !== latestBrand.id) {
          console.log(`[DASHBOARD] Brand ${brandToSelect} not found, selecting latest brand: ${latestBrand.id}`);
          selectBrand(latestBrand.id);
          window.history.replaceState({}, document.title);
        }
      }
    } else if (locationState?.fromOnboarding && !selectedBrandId && brands.length > 0) {
      // If coming from onboarding but no specific brandId, select the latest brand
      const latestBrand = brands[0];
      if (latestBrand) {
        console.log(`[DASHBOARD] From onboarding, selecting latest brand: ${latestBrand.id}`);
        selectBrand(latestBrand.id);
        window.history.replaceState({}, document.title);
      }
    }
  }, [brands, brandsLoading, selectedBrandId, selectBrand, location.state]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
      }
    };

    // Skip setup check if feature flag is set (for testing)
    if (featureFlags.skipSetupCheck || featureFlags.skipOnboardingCheck) {
      console.log('🚀 Skipping setup check (feature flag enabled)');
      return () => clearTimer();
    }

    // Force setup if feature flag is set
    if (featureFlags.forceSetup || featureFlags.forceOnboarding) {
      console.log('🚀 Forcing setup (feature flag enabled)');
      navigate('/setup');
      return () => clearTimer();
    }

    if (brandsLoading) {
      return () => clearTimer();
    }

    const hasBackendBrands = brands.length > 0;
    const hasCompletedSetup = onboardingUtils.isOnboardingComplete();
    const hasCompletedTopicSelection = onboardingUtils.getOnboardingTopics();
    const hasCompletedPromptSelection = onboardingUtils.getOnboardingPrompts();

    console.log('Dashboard useEffect - Checking flow:', {
      hasBackendBrands,
      hasCompletedSetup,
      hasCompletedTopicSelection: !!hasCompletedTopicSelection,
      hasCompletedPromptSelection: !!hasCompletedPromptSelection
    });

    // Redirect to setup if not complete (only when brand data is absent)
    if (!hasBackendBrands && !hasCompletedSetup) {
      console.log('No setup - redirecting to /setup');
      navigate('/setup');
      return () => clearTimer();
    }

    if (hasBackendBrands) {
      console.log('✅ Backend brands found - skipping onboarding modal');
      setShowTopicModal(false);
      return () => clearTimer();
    }

    // Testing mode (only in development)
    if (featureFlags.enableTestingMode && featureFlags.isDevelopment) {
      console.log('🧪 Testing mode enabled - showing topic modal');
      timer = setTimeout(() => {
        setShowTopicModal(true);
      }, 500);
      return () => clearTimer();
    }

    // Production flow: Check for incomplete steps
    if (!hasCompletedTopicSelection) {
      console.log('No topics - showing topic modal in 500ms');
      timer = setTimeout(() => {
        setShowTopicModal(true);
      }, 500);
      return () => clearTimer();
    } else if (!hasCompletedPromptSelection) {
      console.log('No prompts - redirecting to /prompt-selection in 500ms');
      timer = setTimeout(() => {
        navigate('/prompt-selection');
      }, 500);
      return () => clearTimer();
    } else {
      console.log('All setup complete - showing full dashboard');
    }

    return () => clearTimer();
  }, [brands, brandsLoading, navigate]);

  const handleTopicsSelected = (selectedTopics: Topic[]) => {
    localStorage.setItem('onboarding_topics', JSON.stringify(selectedTopics));
    setShowTopicModal(false);
    navigate('/prompt-selection');
  };

  const handleTopicModalClose = () => {
    setShowTopicModal(false);
  };

  // Build endpoint with current params
  const dashboardEndpoint = useMemo(() => {
    const endpointStart = performance.now();
    if (!selectedBrandId || !startDate || !endDate) {
      console.log('[DASHBOARD] Endpoint computation skipped - missing params at', endpointStart, '- Time since mount:', (endpointStart - pageMountTime.current).toFixed(2) + 'ms');
      return null;
    }
    const params = new URLSearchParams({
      startDate,
      endDate
    });
    const endpoint = `/brands/${selectedBrandId}/dashboard?${params.toString()}`;
    console.log('[DASHBOARD] Endpoint computed at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms', '- Endpoint:', endpoint);
    return endpoint;
  }, [selectedBrandId, startDate, endDate, reloadKey]);

  // Use cached data hook
  // Enable the hook as soon as we have an endpoint, even if auth is still loading
  // The API client will handle auth requirements
  const dataFetchStart = useRef(performance.now());
  const {
    data: dashboardResponse,
    loading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard
  } = useCachedData<ApiResponse<DashboardPayload>>(
    dashboardEndpoint,
    {},
    { requiresAuth: true },
    { enabled: !!dashboardEndpoint, refetchOnMount: false }
  );
  
  useEffect(() => {
    if (dashboardEndpoint) {
      console.log('[DASHBOARD] useCachedData hook called at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms', '- Loading:', dashboardLoading, '- Has data:', !!dashboardResponse, '- Auth loading:', authLoading, '- Selected brand ID:', selectedBrandId);
    } else {
      console.log('[DASHBOARD] No endpoint yet at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms', '- Auth loading:', authLoading, '- Selected brand ID:', selectedBrandId, '- Brands loading:', brandsLoading);
    }
  }, [dashboardEndpoint, dashboardLoading, dashboardResponse, authLoading, selectedBrandId, brandsLoading]);
  
  useEffect(() => {
    if (dashboardResponse && !dashboardLoading) {
      const fetchDuration = performance.now() - dataFetchStart.current;
      console.log('[DASHBOARD] ✅ Data fetch completed at', performance.now(), '- Fetch duration:', fetchDuration.toFixed(2) + 'ms', '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms', '- Success:', dashboardResponse.success);
      dataFetchStart.current = performance.now();
    }
  }, [dashboardResponse, dashboardLoading]);

  const dataProcessStart = useRef(performance.now());
  const dashboardData: DashboardPayload | null = dashboardResponse?.success ? dashboardResponse.data || null : null;
  const dashboardErrorMsg: string | null = dashboardResponse?.success 
    ? null 
    : (dashboardError?.message || dashboardResponse?.error || dashboardResponse?.message || null);
  
  useEffect(() => {
    if (dashboardData) {
      const processDuration = performance.now() - dataProcessStart.current;
      console.log('[DASHBOARD] ✅ Data processed at', performance.now(), '- Process duration:', processDuration.toFixed(2) + 'ms', '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms');
      dataProcessStart.current = performance.now();
    }
  }, [dashboardData]);

  const actionItems: ActionItem[] = dashboardData?.actionItems ?? [];
  const brandPages = dashboardData?.topBrandSources ?? [];
  const topTopics = dashboardData?.topTopics ?? [];


  const handleRetryFetch = () => {
    setReloadKey((prev) => prev + 1);
    refetchDashboard();
  };

  const brandSelectionPending = !selectedBrandId && brandsLoading;
  // Only show loading if we don't have data yet - if we have cached data, show it even if loading (background refresh)
  // Also check if we're coming from onboarding - in that case, show data even if scoring is incomplete
  const locationState = location.state as { fromOnboarding?: boolean } | null;
  const fromOnboarding = locationState?.fromOnboarding || false;
  const shouldShowLoading = (authLoading || brandSelectionPending || (dashboardLoading && !dashboardData && !fromOnboarding));
  
  useEffect(() => {
    if (!shouldShowLoading && dashboardData) {
      const totalTime = performance.now() - pageMountTime.current;
      console.log('[DASHBOARD] ✅✅✅ PAGE FULLY LOADED at', performance.now(), '- TOTAL TIME:', totalTime.toFixed(2) + 'ms');
      console.log('[DASHBOARD] Breakdown:', {
        'Time to brands load': brands.length > 0 ? 'N/A' : 'Waiting...',
        'Time to endpoint ready': dashboardEndpoint ? 'Ready' : 'Waiting...',
        'Time to data fetch': dashboardResponse ? 'Complete' : 'Waiting...',
        'Time to data process': dashboardData ? 'Complete' : 'Waiting...',
        'Total time': totalTime.toFixed(2) + 'ms'
      });
    }
  }, [shouldShowLoading, dashboardData, brands.length, dashboardEndpoint, dashboardResponse]);

  useEffect(() => {
    if (!selectedBrandId) {
      return;
    }

    const storageKey = `data_collection_in_progress_${selectedBrandId}`;
    const inProgress = localStorage.getItem(storageKey) === 'true';
    setIsDataCollectionInProgress(inProgress);

    if (!inProgress) {
      return;
    }

    let isMounted = true;

    const checkProgress = async () => {
      try {
        const response = await fetch(`/api/brands/${selectedBrandId}/onboarding-progress`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        });

        if (!isMounted || !response.ok) {
          return;
        }

        const data = await response.json();
        if (!data?.success || !data?.data || !isMounted) {
          return;
        }

        const isComplete =
          data.data.queries.completed >= data.data.queries.total &&
          data.data.scoring.positions &&
          data.data.scoring.sentiments &&
          data.data.scoring.citations;

        if (isComplete) {
          localStorage.removeItem(storageKey);
          setIsDataCollectionInProgress(false);
        }
      } catch (error) {
        console.error('Error checking data collection progress:', error);
      }
    };

    const interval = window.setInterval(checkProgress, 30000);
    checkProgress();

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [selectedBrandId]);

  if (shouldShowLoading) {
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

  const findScore = (label: string) =>
    dashboardData.scores.find((metric) => metric.label.toLowerCase() === label.toLowerCase());

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
  const brandPresenceRows = dashboardData?.brandPresenceRows ?? 0;
  const totalBrandRows = dashboardData?.totalBrandRows ?? 0;
  // Brand Presence % = (rows where competitor_name is null AND has_brand_presence is true) / (rows where competitor_name is null) * 100, capped at 100%
  const brandPresencePercentage = totalBrandRows > 0 
    ? Math.min(100, Math.round((brandPresenceRows / totalBrandRows) * 100))
    : 0;

  const metricCards: Array<MetricCardProps & { key: string }> = [
    {
      key: 'visibility-index',
      title: 'Visibility Index',
      value: formatMetricValue(visibilityMetric, ''),
      subtitle: '',
      trend: computeTrend(visibilityMetric?.delta),
      icon: <Eye size={20} />,
      color: '#498cf9',
      linkTo: '/search-visibility',
      description: 'Measures your brand\'s average prominence across all AI-generated answers. Higher scores indicate your brand appears more prominently in responses, calculated as the average position-weighted visibility across all queries.'
    },
    {
      key: 'share-of-answers',
      title: 'Share of Answers',
      value: formatMetricValue(shareMetric),
      subtitle: '',
      trend: computeTrend(shareMetric?.delta),
      icon: <Target size={20} />,
      color: '#06c686',
      linkTo: '/ai-sources',
      description: 'Represents your brand\'s share of the total answer space across all AI models. This metric shows what percentage of all mentions (your brand + competitors) belong to your brand, indicating your relative market presence.'
    },
    {
      key: 'sentiment-score',
      title: 'Sentiment Score',
      value: formatMetricValue(sentimentMetric, ''),
      subtitle: '',
      trend: computeTrend(sentimentMetric?.delta),
      icon: <MessageSquare size={20} />,
      color: '#00bcdc',
      linkTo: '/prompts',
      description: 'Average sentiment of how your brand is discussed in AI-generated answers. Scores range from -1 (very negative) to +1 (very positive), with 0 being neutral. This reflects overall brand perception across all queries.'
    },
    {
      key: 'brand-presence',
      title: 'Brand Presence',
      value: `${brandPresencePercentage}%`,
      subtitle: '',
      trend: computeTrend(dashboardData.trendPercentage),
      icon: <Activity size={20} />,
      color: '#7c3aed',
      linkTo: '/topics',
      description: 'Percentage of queries where your brand appears in AI-generated answers. Calculated as (queries with brand presence / total queries) × 100. Higher percentages indicate your brand is mentioned more frequently across different queries.'
    }
  ];

  const overviewSubtitle = (selectedBrand?.name ?? dashboardData.brandName)
    ? `Here's your AI visibility performance overview for ${selectedBrand?.name ?? dashboardData.brandName}`
    : `Here's your AI visibility performance overview`;

  const llmSlices: LLMVisibilitySliceUI[] = (dashboardData?.llmVisibility ?? [])
    .map((slice): LLMVisibilitySliceUI => {
      const totalQueries = slice.totalQueries ?? 0;
      const brandPresenceCount = slice.brandPresenceCount ?? 0;
      // Brand Presence % = (queries with brand presence / total queries) * 100, capped at 100%
      const brandPresencePercentage = totalQueries > 0 
        ? Math.min(100, Math.round((brandPresenceCount / totalQueries) * 100))
        : 0;
      
      return {
        provider: slice.provider,
        share: slice.shareOfSearch ?? slice.share,
        shareOfSearch: slice.shareOfSearch ?? slice.share,
        visibility: slice.visibility ?? 0,
        delta: slice.delta ?? 0,
        brandPresenceCount: brandPresencePercentage, // Store percentage instead of count
        color: slice.color || '#64748b',
        topTopic: slice.topTopic ?? null,
        topTopics: slice.topTopics
      };
    })
    .filter((slice) => Number.isFinite(slice.visibility ?? 0) && (slice.visibility ?? 0) >= 0);

  const sourceSlices = (dashboardData?.sourceDistribution ?? [])
    .map((slice): { type: string; percentage: number; color: string } => ({
      type: slice.label,
      percentage: slice.percentage,
      color: slice.color || '#64748b'
    }))
    .filter((slice) => Number.isFinite(slice.percentage) && slice.percentage >= 0);

  const hasLlmData = llmSlices.length > 0;
  const hasSourceData = sourceSlices.length > 0;
  const collectorSummaries: CollectorSummary[] = dashboardData?.collectorSummaries ?? [];

  return (
    <Layout>
      <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        {/* Data Collection In Progress Banner */}
        {isDataCollectionInProgress && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white animate-pulse" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-1">
                Your remaining data is being collected and scored
              </h3>
              <p className="text-[13px] text-[#64748b]">
                We're still processing some of your queries in the background. Your dashboard will update automatically as new data becomes available. You'll be notified when everything is complete.
              </p>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem(`data_collection_in_progress_${selectedBrandId}`);
                setIsDataCollectionInProgress(false);
              }}
              className="flex-shrink-0 text-[#64748b] hover:text-[#1a1d29] transition-colors"
              aria-label="Dismiss notification"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

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
                max={endDate}
                onChange={(e) => {
                  const value = e.target.value;
                  setStartDate(value);
                  if (value && endDate && value > endDate) {
                    setEndDate(value);
                  }
                }}
                className="px-3 py-1.5 border border-[#e8e9ed] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc]"
              />
              <span className="text-[13px] text-[#64748b]">to</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => {
                  const value = e.target.value;
                  setEndDate(value);
                  if (value && startDate && value < startDate) {
                    setStartDate(value);
                  }
                }}
                className="px-3 py-1.5 border border-[#e8e9ed] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-white border-[#e8e9ed]">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-[14px] font-semibold text-[#1a1d29]">Source Type Distribution</h3>
                <InfoTooltip description="Shows the breakdown of citation sources by category (Editorial, Corporate, Reference, UGC, Social, Institutional). This helps you understand where your brand is being cited across different types of content sources in AI-generated answers." />
              </div>
              {hasSourceData ? (
                <StackedRacingChart data={sourceSlices} />
              ) : (
                <EmptyState message="No source distribution data available for this period." />
              )}
            </div>

            <div className="p-4 rounded-lg border bg-white border-[#e8e9ed]">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-[14px] font-semibold text-[#1a1d29]">LLM Visibility (7 Days)</h3>
                <InfoTooltip description="Displays your brand's visibility score and brand presence percentage across different AI models (ChatGPT, Gemini, Claude, etc.) over the last 7 days. Visibility score measures prominence, while brand presence shows the percentage of queries where your brand appears." />
              </div>
              {hasLlmData ? (
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="text-[#64748b] uppercase text-[11px] tracking-wide">
                      <th className="py-2 font-medium">LLM</th>
                      <th className="py-2 font-medium text-right">Visibility</th>
                      <th className="py-2 font-medium text-right">Brand Presence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {llmSlices.map((slice) => (
                      <tr key={slice.provider} className="border-t border-[#f0f0f3]">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">{getLLMIcon(slice.provider)}</div>
                            <span className="text-[#1a1d29] font-medium">{slice.provider}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right text-[#1a1d29] font-semibold">
                          {Math.round(slice.visibility ?? 0)}
                          {slice.delta !== 0 && (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold ml-2 ${
                                slice.delta > 0 ? 'text-[#06c686]' : 'text-[#f94343]'
                              }`}
                            >
                              {slice.delta > 0 ? (
                                <ChevronUp size={12} strokeWidth={2.5} />
                              ) : (
                                <ChevronDown size={12} strokeWidth={2.5} />
                              )}
                              {Math.abs(slice.delta).toFixed(1)} pts
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right text-[#1a1d29] font-semibold">
                          {slice.brandPresenceCount}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState message="No LLM visibility data available for this period." />
              )}
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[#e8e9ed]">
            <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-3">Recommended Actions</h3>
            {actionItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {actionItems.slice(0, 4).map((item: ActionItem) => (
                  <div key={item.id} className="flex items-start gap-2 p-3 bg-[#f9f9fb] rounded-lg">
                    <CheckCircle size={16} className="text-[#06c686] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] text-[#1a1d29] font-medium">{item.title}</p>
                      <p className="text-[12px] text-[#64748b]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No tailored recommendations yet. Check back after more data is collected." />
            )}
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
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-semibold text-[#1a1d29]">
                    Top Brand Sources
                  </h2>
                  <InfoTooltip description="Lists the web pages and sources where your brand is most frequently cited in AI-generated answers. Impact Score reflects how prominently your brand appears, helping you identify high-value content partnerships and citation opportunities." />
                </div>
                <Link
                  to="/search-sources"
                  className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
                >
                  View All
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="space-y-3">
                {brandPages.length > 0 ? (
                  brandPages.map((page) => {
                    const hasImpactScore =
                      typeof page.impactScore === 'number' && Number.isFinite(page.impactScore);
                    const impactLabel = hasImpactScore
                      ? page.impactScore!.toFixed(1)
                      : '—';
                    const hasChange =
                      typeof page.change === 'number' && Number.isFinite(page.change);
                    const changeValue = hasChange ? page.change! : 0;
                    const changeLabel = hasChange ? Math.abs(changeValue).toFixed(1) : '—';
                    const changeClass = hasChange
                      ? changeValue > 0
                        ? 'text-[#06c686]'
                        : changeValue < 0
                        ? 'text-[#f94343]'
                        : 'text-[#64748b]'
                      : 'text-[#64748b]';
                    const rawUrl =
                      (typeof page.url === 'string' && page.url.trim().length > 0
                        ? page.url.trim()
                        : typeof page.domain === 'string'
                        ? `https://${page.domain}`
                        : '') || '';
                    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
                    const displayUrl = rawUrl.replace(/^https?:\/\//, '') || '—';
                    const title =
                      (typeof page.title === 'string' && page.title.trim().length > 0
                        ? page.title.trim()
                        : page.domain) || 'Unknown Source';
                    const domain = page.domain || displayUrl.split('/')[0] || '—';

                    return (
                      <div
                        key={page.id}
                        className="group flex items-center justify-between p-4 bg-white border border-[#e8e9ed] rounded-lg hover:border-[#00bcdc] hover:shadow-sm transition-all"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="text-[14px] font-semibold text-[#1a1d29] truncate">
                              {title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[12px] text-[#64748b] font-medium">
                              {domain}
                            </span>
                            <UrlTooltip url={displayUrl} fullUrl={fullUrl} urls={page.urls} />
                          </div>
                        </div>
                        <div className="flex items-center gap-6 flex-shrink-0">
                          <div className="text-center min-w-[80px]">
                            <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1">
                              Impact
                            </div>
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="text-[16px] font-bold text-[#1a1d29]">
                                {impactLabel}
                              </span>
                              {hasImpactScore && (
                                <span className="text-[11px] text-[#64748b]">/10</span>
                              )}
                            </div>
                          </div>
                          <div className="text-center min-w-[70px]">
                            <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1">
                              Change
                            </div>
                            <div className={`inline-flex items-center gap-1 text-[14px] font-semibold ${changeClass}`}>
                              {hasChange ? (
                                <>
                                  {changeValue > 0 && <ChevronUp size={14} />}
                                  {changeValue < 0 && <ChevronDown size={14} />}
                                  {changeValue === 0 ? '0.0' : changeLabel}
                                </>
                              ) : (
                                <span className="text-[#64748b]">—</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-[13px] text-[#64748b] border border-dashed border-[#e8e9ed] rounded-lg">
                    No branded sources detected for this period.
                  </div>
                )}
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
                link="/search-sources"
                icon={<ExternalLink size={18} />}
                color="#fa8a40"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-6">
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-semibold text-[#1a1d29]">
                  Top Performing Topics
                </h2>
                <InfoTooltip description="Shows topics where your brand performs best. Visibility Score measures how prominently your brand appears in AI answers. Brand Presence shows what percentage of queries include your brand. Sentiment indicates how positively your brand is discussed (0-5 scale, higher is better)." />
              </div>
              <Link
                to="/topics"
                className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
              >
                View All
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-3">
              {topTopics.length > 0 ? (
                topTopics.map((topic) => {
                  // Only show if we have actual data - no fallbacks
                  const visibility = Number.isFinite(topic.avgVisibility) && topic.avgVisibility !== undefined 
                    ? topic.avgVisibility 
                    : null;
                  const brandPresence = Number.isFinite(topic.brandPresencePercentage) && topic.brandPresencePercentage !== undefined
                    ? topic.brandPresencePercentage 
                    : null;
                  const sentimentScore = topic.sentimentScore !== null && topic.sentimentScore !== undefined && Number.isFinite(topic.sentimentScore)
                    ? topic.sentimentScore
                    : null;
                  
                  // Sentiment color coding for -1 to 1 scale
                  const getSentimentColor = (score: number | null) => {
                    if (score === null) return { bg: 'bg-[#f4f4f6]', text: 'text-[#64748b]', label: 'No Data' };
                    if (score >= 0.5) return { bg: 'bg-[#e6f7f1]', text: 'text-[#06c686]', label: 'Very Positive' };
                    if (score >= 0.1) return { bg: 'bg-[#fff8e6]', text: 'text-[#f9db43]', label: 'Positive' };
                    if (score >= -0.1) return { bg: 'bg-[#fff4e6]', text: 'text-[#fa8a40]', label: 'Neutral' };
                    if (score >= -0.5) return { bg: 'bg-[#fff0f0]', text: 'text-[#f94343]', label: 'Negative' };
                    return { bg: 'bg-[#ffe6e6]', text: 'text-[#d32f2f]', label: 'Very Negative' };
                  };
                  const sentimentStyle = getSentimentColor(sentimentScore);

                  return (
                    <div
                      key={topic.topic}
                      className="group p-4 bg-white border border-[#e8e9ed] rounded-lg hover:border-[#00bcdc] hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0 mr-4">
                          <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-1.5 truncate">
                            {topic.topic}
                          </h3>
                          <p className="text-[12px] text-[#64748b]">
                            {topic.promptsTracked} {topic.promptsTracked === 1 ? 'query' : 'queries'} tracked
                          </p>
                        </div>
                        {sentimentScore !== null && (
                          <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${sentimentStyle.bg} flex-shrink-0`}>
                            <div className="text-center">
                              <span className={`text-[16px] font-bold ${sentimentStyle.text} block leading-none`}>
                                {sentimentScore > 0 ? '+' : ''}{sentimentScore.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#f4f4f6]">
                        <div className="text-center">
                          <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1.5">
                            Visibility
                          </div>
                          {visibility !== null ? (
                            <>
                              <div className="text-[16px] font-bold text-[#1a1d29]">
                                {visibility.toFixed(0)}
                              </div>
                              <div className="text-[10px] text-[#64748b] mt-0.5">score</div>
                            </>
                          ) : (
                            <div className="text-[13px] text-[#64748b]">—</div>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1.5">
                            Brand Presence
                          </div>
                          {brandPresence !== null ? (
                            <>
                              <div className="text-[16px] font-bold text-[#1a1d29]">
                                {brandPresence.toFixed(0)}%
                              </div>
                              <div className="text-[10px] text-[#64748b] mt-0.5">of queries</div>
                            </>
                          ) : (
                            <div className="text-[13px] text-[#64748b]">—</div>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1.5">
                            Sentiment
                          </div>
                          {sentimentScore !== null ? (
                            <>
                              <div className={`text-[13px] font-semibold ${sentimentStyle.text}`}>
                                {sentimentStyle.label}
                              </div>
                              <div className="text-[10px] text-[#64748b] mt-0.5">
                                {sentimentScore > 0 ? '+' : ''}{sentimentScore.toFixed(2)}
                              </div>
                            </>
                          ) : (
                            <div className="text-[13px] text-[#64748b]">—</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-[13px] text-[#64748b] border border-dashed border-[#e8e9ed] rounded-lg">
                  We haven't detected enough topic data for this window yet.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-semibold text-[#1a1d29]">
                  Partnership Opportunities
                </h2>
                <InfoTooltip description="Highlights AI models (collectors) where your brand has strong presence and success rates. These represent potential partnership opportunities or areas where your brand is performing well in AI-generated answers. Success rate indicates how often your brand appears when queried." />
              </div>
              <Link
                to="/ai-sources"
                className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
              >
                View All
                <ArrowRight size={14} />
              </Link>
            </div>

            {collectorSummaries.length > 0 ? (
              <div className="space-y-3">
                {collectorSummaries.slice(0, 6).map((summary: CollectorSummary, index) => (
                  <div key={summary.collectorType ?? index} className="p-3 bg-[#f9f9fb] rounded-lg border border-[#e8e9ed]">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#00bcdc] text-white text-[12px] font-semibold flex items-center justify-center">
                          {index + 1}
                        </div>
                        <h3 className="text-[14px] font-medium text-[#1a1d29] capitalize">
                          {summary.collectorType?.replace(/[-_]/g, ' ') ?? 'Unknown Collector'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 text-[12px] font-medium text-[#64748b]">
                        <TrendingUp size={12} className="text-[#06c686]" />
                        {Math.round(summary.successRate ?? 0)}% success
                      </div>
                    </div>
                    <p className="text-[12px] text-[#64748b] mb-2">
                      {summary.completed} completed · {summary.failed} failed · Last run{' '}
                      {summary.lastRunAt ? new Date(summary.lastRunAt).toLocaleDateString() : 'N/A'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b] bg-white px-2 py-1 rounded">
                        Status: {summary.status}
                      </span>
                      <span className="text-[12px] font-medium text-[#1a1d29]">
                        {summary.completed}/{summary.completed + summary.failed} runs successful
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No partnership opportunities identified yet." />
            )}
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
  description?: string;
}

const MetricCard = ({ title, value, subtitle, trend, icon, color, linkTo, description }: MetricCardProps) => (
  <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5 flex flex-col">
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-1">
        <div className="text-[14px] font-semibold text-[#1a1d29]">{title}</div>
        {description && <InfoTooltip description={description} />}
      </div>
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
    {subtitle && <div className="text-[12px] text-[#64748b] mb-auto">{subtitle}</div>}
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

const EmptyState = ({ message }: { message: string }) => (
  <div className="py-6 text-center text-[13px] text-[#64748b] bg-white border border-dashed border-[#e8e9ed] rounded-lg">
    {message}
  </div>
);

interface StackedRacingChartProps {
  data: Array<{
    type: string;
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
        caretSize: 0,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.x}`;
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

interface LLMVisibilitySliceUI {
  provider: string;
  share: number;
  shareOfSearch?: number;
  visibility?: number;
  delta: number;
  brandPresenceCount: number;
  color: string;
  topTopic?: string | null;
  topTopics?: Array<{
    topic: string;
    occurrences: number;
    share: number;
    visibility: number;
    mentions: number;
  }>;
}
