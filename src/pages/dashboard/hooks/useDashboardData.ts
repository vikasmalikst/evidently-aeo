import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useManualBrandDashboard } from '../../../manual-dashboard';
import { useCachedData } from '../../../hooks/useCachedData';
import { featureFlags } from '../../../config/featureFlags';
import { onboardingUtils } from '../../../utils/onboardingUtils';
import type { Topic } from '../../../types/topic';
import type { ApiResponse, DashboardPayload } from '../types';
import { getDefaultDateRange } from '../utils';
import { apiClient } from '../../../lib/apiClient';

export const useDashboardData = () => {
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
  const [isDataCollectionInProgress, setIsDataCollectionInProgress] = useState(false);
  const [progressData, setProgressData] = useState<{
    queries: { total: number; completed: number };
    scoring: { positions: boolean; sentiments: boolean; citations: boolean };
    currentOperation: 'collecting' | 'scoring' | 'finalizing';
  } | null>(null);
  
  const {
    brands,
    isLoading: brandsLoading,
    error: brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand
  } = useManualBrandDashboard();
  
  console.log('[DASHBOARD] Initial state set at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms');

  useEffect(() => {
    if (!brandsLoading && brands.length > 0) {
      console.log('[DASHBOARD] Brands loaded at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms', '- Brands:', brands.length, '- Selected brand ID:', selectedBrandId);
    } else if (brandsLoading) {
      console.log('[DASHBOARD] Brands loading... at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms');
    }
  }, [brandsLoading, brands.length, selectedBrandId]);

  useEffect(() => {
    if (brandsLoading || brands.length === 0) {
      return;
    }

    const locationState = location.state as { autoSelectBrandId?: string; fromOnboarding?: boolean } | null;
    
    if (locationState?.autoSelectBrandId && locationState.fromOnboarding) {
      const brandToSelect = locationState.autoSelectBrandId;
      const brandExists = brands.some(brand => brand.id === brandToSelect);
      
      if (brandExists && selectedBrandId !== brandToSelect) {
        console.log(`[DASHBOARD] Auto-selecting brand from onboarding: ${brandToSelect}`);
        selectBrand(brandToSelect);
        window.history.replaceState({}, document.title);
      } else if (!brandExists) {
        const latestBrand = brands[0];
        if (latestBrand && selectedBrandId !== latestBrand.id) {
          console.log(`[DASHBOARD] Brand ${brandToSelect} not found, selecting latest brand: ${latestBrand.id}`);
          selectBrand(latestBrand.id);
          window.history.replaceState({}, document.title);
        }
      }
    } else if (locationState?.fromOnboarding && !selectedBrandId && brands.length > 0) {
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

    if (featureFlags.skipSetupCheck || featureFlags.skipOnboardingCheck) {
      console.log('🚀 Skipping setup check (feature flag enabled)');
      return () => clearTimer();
    }

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

    if (featureFlags.enableTestingMode && featureFlags.isDevelopment) {
      console.log('🧪 Testing mode enabled - showing topic modal');
      timer = setTimeout(() => {
        setShowTopicModal(true);
      }, 500);
      return () => clearTimer();
    }

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
    if (reloadKey > 0) {
      params.set('cacheBust', String(reloadKey));
    }
    const endpoint = `/brands/${selectedBrandId}/dashboard?${params.toString()}`;
    console.log('[DASHBOARD] Endpoint computed at', performance.now(), '- Time since mount:', (performance.now() - pageMountTime.current).toFixed(2) + 'ms', '- Endpoint:', endpoint);
    return endpoint;
  }, [selectedBrandId, startDate, endDate, reloadKey]);

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
    { 
      enabled: !!dashboardEndpoint, 
      refetchOnMount: false,
      refetchInterval: 60000 // Refresh dashboard data every 60 seconds
    }
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

  const handleRetryFetch = () => {
    setReloadKey((prev) => prev + 1);
    refetchDashboard();
  };

  const brandSelectionPending = !selectedBrandId && brandsLoading;
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
      setIsDataCollectionInProgress(false);
      setProgressData(null);
      return;
    }

    const storageKey = `data_collection_in_progress_${selectedBrandId}`;
    const inProgress = localStorage.getItem(storageKey) === 'true';
    setIsDataCollectionInProgress(inProgress);

    if (!inProgress) {
      setProgressData(null);
      return;
    }

    let isMounted = true;

    const checkProgress = async () => {
      try {
        console.log(`[DASHBOARD] Checking progress for brand: ${selectedBrandId}`);
        const data = await apiClient.request<ApiResponse<{
          queries: { total: number; completed: number };
          scoring: { positions: boolean; sentiments: boolean; citations: boolean };
          currentOperation: 'collecting' | 'scoring' | 'finalizing';
        }>>(
          `/brands/${selectedBrandId}/onboarding-progress`,
          {},
          { requiresAuth: true }
        );

        if (!isMounted) {
          console.log('[DASHBOARD] Component unmounted, skipping progress update');
          return;
        }

        if (!data?.success || !data?.data) {
          console.warn('[DASHBOARD] Progress check failed or no data:', data);
          return;
        }

        const progressUpdate = {
          queries: data.data.queries,
          scoring: data.data.scoring,
          currentOperation: data.data.currentOperation || 'collecting'
        };

        console.log('[DASHBOARD] Progress update received:', {
          queries: `${progressUpdate.queries.completed}/${progressUpdate.queries.total}`,
          scoring: {
            positions: progressUpdate.scoring.positions,
            sentiments: progressUpdate.scoring.sentiments,
            citations: progressUpdate.scoring.citations
          },
          operation: progressUpdate.currentOperation
        });

        // Update progress data
        setProgressData(progressUpdate);

        // Check if complete
        const isComplete =
          data.data.queries.completed >= data.data.queries.total &&
          data.data.scoring.positions &&
          data.data.scoring.sentiments &&
          data.data.scoring.citations;

        if (isComplete) {
          console.log('[DASHBOARD] ✅ Data collection complete!');
          localStorage.removeItem(storageKey);
          setIsDataCollectionInProgress(false);
          // Trigger immediate dashboard data refresh when collection completes
          console.log('[DASHBOARD] Refreshing dashboard data after completion...');
          refetchDashboard().catch((err) => {
            console.error('[DASHBOARD] Error refreshing dashboard after completion:', err);
          });
          // Keep progress data for a moment to show completion, then clear
          setTimeout(() => {
            if (isMounted) {
              console.log('[DASHBOARD] Clearing progress data after completion display');
              setProgressData(null);
            }
          }, 3000);
        }
      } catch (error) {
        // Only log non-critical errors
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();
          if (!errorMsg.includes('fetch') && 
              !errorMsg.includes('json') && 
              !errorMsg.includes('unexpected token') &&
              !errorMsg.includes('doctype')) {
            console.error('[DASHBOARD] Error checking data collection progress:', error);
          }
        }
      }
    };

    // Poll every 20 seconds for progress updates
    const interval = window.setInterval(() => {
      checkProgress().catch((err) => {
        // Only log non-critical errors
        if (err instanceof Error) {
          const errorMsg = err.message.toLowerCase();
          if (!errorMsg.includes('fetch') && 
              !errorMsg.includes('json') && 
              !errorMsg.includes('unexpected token') &&
              !errorMsg.includes('doctype')) {
            console.error('[DASHBOARD] Error in progress polling interval:', err);
          }
        }
      });
    }, 20000);
    // Initial check after 2 seconds
    const initialTimeout = setTimeout(() => {
      checkProgress().catch((err) => {
        // Only log non-critical errors
        if (err instanceof Error) {
          const errorMsg = err.message.toLowerCase();
          if (!errorMsg.includes('fetch') && 
              !errorMsg.includes('json') && 
              !errorMsg.includes('unexpected token') &&
              !errorMsg.includes('doctype')) {
            console.error('[DASHBOARD] Error in initial progress check:', err);
          }
        }
      });
    }, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [selectedBrandId]);

  return {
    pageMountTime,
    authLoading,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    reloadKey,
    navigate,
    location,
    showTopicModal,
    setShowTopicModal,
    isDataCollectionInProgress,
    setIsDataCollectionInProgress,
    progressData,
    brands,
    brandsLoading,
    brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand,
    dashboardData,
    dashboardErrorMsg,
    dashboardLoading,
    shouldShowLoading,
    handleRetryFetch,
    handleTopicsSelected,
    handleTopicModalClose
  };
};

