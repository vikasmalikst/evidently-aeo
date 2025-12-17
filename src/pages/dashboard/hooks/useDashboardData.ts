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

  useEffect(() => {
    if (brandsLoading || brands.length === 0) {
      return;
    }

    const locationState = location.state as { autoSelectBrandId?: string; fromOnboarding?: boolean } | null;
    
    if (locationState?.autoSelectBrandId && locationState.fromOnboarding) {
      const brandToSelect = locationState.autoSelectBrandId;
      const brandExists = brands.some(brand => brand.id === brandToSelect);
      
      if (brandExists && selectedBrandId !== brandToSelect) {
        selectBrand(brandToSelect);
        window.history.replaceState({}, document.title);
      } else if (!brandExists) {
        const latestBrand = brands[0];
        if (latestBrand && selectedBrandId !== latestBrand.id) {
          selectBrand(latestBrand.id);
          window.history.replaceState({}, document.title);
        }
      }
    } else if (locationState?.fromOnboarding && !selectedBrandId && brands.length > 0) {
      const latestBrand = brands[0];
      if (latestBrand) {
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
      return () => clearTimer();
    }

    if (featureFlags.forceSetup || featureFlags.forceOnboarding) {
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

    if (!hasBackendBrands && !hasCompletedSetup) {
      navigate('/setup');
      return () => clearTimer();
    }

    if (hasBackendBrands) {
      setShowTopicModal(false);
      return () => clearTimer();
    }

    if (featureFlags.enableTestingMode && featureFlags.isDevelopment) {
      timer = setTimeout(() => {
        setShowTopicModal(true);
      }, 500);
      return () => clearTimer();
    }

    if (!hasCompletedTopicSelection) {
      timer = setTimeout(() => {
        setShowTopicModal(true);
      }, 500);
      return () => clearTimer();
    } else if (!hasCompletedPromptSelection) {
      timer = setTimeout(() => {
        navigate('/prompt-selection');
      }, 500);
      return () => clearTimer();
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
    if (!selectedBrandId || !startDate || !endDate) {
      return null;
    }
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    // Only bypass cache when we explicitly need freshest data.
    // Default behavior should leverage client cache for fast navigation.
    if (isDataCollectionInProgress || reloadKey > 0) {
      params.set('skipCache', 'true');
    }
    if (reloadKey > 0) {
      params.set('cacheBust', String(reloadKey));
    }
    const endpoint = `/brands/${selectedBrandId}/dashboard?${params.toString()}`;
    return endpoint;
  }, [selectedBrandId, startDate, endDate, reloadKey, isDataCollectionInProgress]);

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
      // Use more frequent refresh when data collection is in progress (15 seconds) or normal refresh (30 seconds)
      // This ensures dashboard updates quickly when async data arrives
      refetchInterval: isDataCollectionInProgress ? 15000 : 30000, // 15 seconds during collection, 30 seconds normally
      refetchOnMount: true
    }
  );
  
  // Check for recent data updates and trigger refresh when new data is detected
  useEffect(() => {
    if (!selectedBrandId || !dashboardEndpoint) return;
    
    const checkForNewData = async () => {
      try {
        // Check if there are collector_results with raw_answer updated in the last 2 minutes
        // This catches async BrightData responses that were just populated
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const response = await apiClient.request<ApiResponse<{ hasUpdates: boolean; count?: number }>>(
          `/brands/${selectedBrandId}/data-updates?since=${twoMinutesAgo}`,
          {},
          { requiresAuth: true }
        );
        
        if (response?.success && response.data?.hasUpdates) {
          // Trigger immediate refresh when new data is detected
          refetchDashboard().catch((err) => {
            console.error('[DASHBOARD] Error refreshing after detecting new data:', err);
          });
        }
      } catch (error) {
        // Silently fail - this is a background check, don't spam console
        if (error instanceof Error && !error.message.includes('aborted')) {
          console.debug('[DASHBOARD] Error checking for new data:', error);
        }
      }
    };
    
    // Check for new data every 20 seconds (between normal refresh intervals)
    const interval = setInterval(checkForNewData, 20000);
    
    return () => clearInterval(interval);
  }, [selectedBrandId, dashboardEndpoint, refetchDashboard]);
  
  useEffect(() => {
    if (dashboardResponse && !dashboardLoading) {
      const fetchDuration = performance.now() - dataFetchStart.current;
      console.info('[DASHBOARD] Data fetch completed', { durationMs: Number(fetchDuration.toFixed(2)), success: dashboardResponse.success });
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
      console.info('[DASHBOARD] Data processed', { durationMs: Number(processDuration.toFixed(2)) });
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
      console.info('[DASHBOARD] Page loaded', { totalTimeMs: Number(totalTime.toFixed(2)) });
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
          return;
        }

        if (!data?.success || !data?.data) {
          console.warn('[DASHBOARD] Progress check failed or no data');
          return;
        }

        const progressUpdate = {
          queries: data.data.queries,
          scoring: data.data.scoring,
          currentOperation: data.data.currentOperation || 'collecting'
        };

        // Update progress data
        setProgressData(progressUpdate);

        // Check if complete
        const isComplete =
          data.data.queries.completed >= data.data.queries.total &&
          data.data.scoring.positions &&
          data.data.scoring.sentiments &&
          data.data.scoring.citations;

        if (isComplete) {
          localStorage.removeItem(storageKey);
          setIsDataCollectionInProgress(false);
          // Trigger immediate dashboard data refresh when collection completes
          refetchDashboard().catch((err) => {
            console.error('[DASHBOARD] Error refreshing dashboard after completion:', err);
          });
          // Keep progress data for a moment to show completion, then clear
          setTimeout(() => {
            if (isMounted) {
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

