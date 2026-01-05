import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useManualBrandDashboard } from '../../../manual-dashboard';
import { useCachedData } from '../../../hooks/useCachedData';
import { featureFlags } from '../../../config/featureFlags';
import { onboardingUtils } from '../../../utils/onboardingUtils';
import type { ApiResponse, DashboardPayload } from '../types';
import { getDefaultDateRange } from '../utils';
import { apiClient } from '../../../lib/apiClient';
import { prefetchOnIdle } from '../../../lib/prefetch';
import { onboardingProgressTracker } from '../../../lib/onboardingProgressTracker';

export const useDashboardData = () => {
  const pageMountTime = useRef(performance.now());
  const authLoading = useAuthStore((state) => state.isLoading);
  const defaultDateRange = useMemo(getDefaultDateRange, []);
  const [startDate, setStartDate] = useState(defaultDateRange.start);
  const [endDate, setEndDate] = useState(defaultDateRange.end);
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [isDataCollectionInProgress, setIsDataCollectionInProgress] = useState(false);
  const [progressData, setProgressData] = useState<{
    stages?: {
      collection: { total: number; completed: number; status: 'pending' | 'active' | 'completed' };
      scoring: { total: number; completed: number; status: 'pending' | 'active' | 'completed' };
      finalization: { status: 'pending' | 'active' | 'completed' };
    };
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
    selectBrand,
    reload: reloadBrands
  } = useManualBrandDashboard();

  // Sync selectedBrandId to current_brand_id for Bell/NotificationBell compatibility
  useEffect(() => {
    if (selectedBrandId) {
      localStorage.setItem('current_brand_id', selectedBrandId);
    } else {
      localStorage.removeItem('current_brand_id');
    }
  }, [selectedBrandId]);

  const previousBrandIdRef = useRef<string | null>(selectedBrandId);
  const [isBrandSwitching, setIsBrandSwitching] = useState(false);
  const [hasRetriedBrandLoad, setHasRetriedBrandLoad] = useState(false);

  useEffect(() => {
    if (previousBrandIdRef.current !== null && previousBrandIdRef.current !== selectedBrandId) {
      setIsBrandSwitching(true);
      console.debug(`[useDashboardData] Brand changed from ${previousBrandIdRef.current} to ${selectedBrandId}`);
    }
    previousBrandIdRef.current = selectedBrandId;
  }, [selectedBrandId]);

  useEffect(() => {
    if (brandsLoading) {
      return;
    }

    const locationState = location.state as { autoSelectBrandId?: string; fromOnboarding?: boolean } | null;
    
    if (locationState?.autoSelectBrandId && locationState.fromOnboarding) {
      const brandToSelect = locationState.autoSelectBrandId;
      const brandExists = brands.some(brand => brand.id === brandToSelect);
      
      if (!brandExists && !hasRetriedBrandLoad) {
        console.log(`[useDashboardData] Brand ${brandToSelect} not found in cache, reloading brands list...`);
        setHasRetriedBrandLoad(true);
        reloadBrands();
        return;
      }

      if (brandExists && selectedBrandId !== brandToSelect) {
        selectBrand(brandToSelect);
        // Don't clear state yet, we might need it if we re-render
        // window.history.replaceState({}, document.title); 
      } else if (!brandExists && brands.length > 0) {
        // Fallback only if we've already retried or decided not to
        const latestBrand = brands[0];
        if (latestBrand && selectedBrandId !== latestBrand.id) {
          console.warn(`[useDashboardData] Brand ${brandToSelect} not found after reload, defaulting to ${latestBrand.name}`);
          selectBrand(latestBrand.id);
        }
      }
    } else if (locationState?.fromOnboarding && !selectedBrandId && brands.length > 0) {
      const latestBrand = brands[0];
      if (latestBrand) {
        selectBrand(latestBrand.id);
      }
    }
  }, [brands, brandsLoading, selectedBrandId, selectBrand, location.state, reloadBrands, hasRetriedBrandLoad]);

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
    if (hasBackendBrands) {
      return () => clearTimer();
    }

    const hasCompletedOnboarding = onboardingUtils.isOnboardingComplete();
    navigate(hasCompletedOnboarding ? '/setup' : '/onboarding');
    return () => clearTimer();
  }, [brands, brandsLoading, navigate]);

  const dashboardEndpoint = useMemo(() => {
    // Wait for brands to load before creating endpoint to prevent 404 errors
    // This ensures selectedBrandId has been validated against the actual brands list
    if (brandsLoading) {
      return null;
    }
    
    // Ensure we have a valid brand selected that exists in the brands list
    if (!selectedBrandId || !startDate || !endDate) {
      return null;
    }
    
    // Additional safety check: ensure the selected brand actually exists in the brands list
    // This prevents trying to fetch data for a deleted brand
    const brandExists = brands.some(b => b.id === selectedBrandId);
    if (!brandExists) {
      console.warn(`[useDashboardData] Selected brand ${selectedBrandId} not found in brands list`);
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
    console.debug(`[useDashboardData] Endpoint created: ${endpoint}`);
    return endpoint;
  }, [selectedBrandId, startDate, endDate, reloadKey, isDataCollectionInProgress, brandsLoading, brands]);

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

  // Clear switching flag when new data arrives for the current brand
  useEffect(() => {
    if (isBrandSwitching && dashboardResponse && !dashboardLoading && dashboardResponse.success) {
      setIsBrandSwitching(false);
      console.debug(`[useDashboardData] Brand switch complete, data loaded for ${selectedBrandId}`);
    }
  }, [isBrandSwitching, dashboardResponse, dashboardLoading, selectedBrandId]);

  const dataProcessStart = useRef(performance.now());
  // Clear dashboardData when switching brands to prevent showing stale data
  const dashboardData: DashboardPayload | null = isBrandSwitching 
    ? null 
    : (dashboardResponse?.success ? dashboardResponse.data || null : null);
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
  // Show loading when: auth loading, brand selection pending, brand switching, or fetching new data
  const shouldShowLoading = (authLoading || brandSelectionPending || isBrandSwitching || (dashboardLoading && !dashboardData && !fromOnboarding));

  
  useEffect(() => {
    if (!shouldShowLoading && dashboardData) {
      const totalTime = performance.now() - pageMountTime.current;
      console.info('[DASHBOARD] Page loaded', { totalTimeMs: Number(totalTime.toFixed(2)) });
    }
  }, [shouldShowLoading, dashboardData, brands.length, dashboardEndpoint, dashboardResponse]);

  // Option 1: Prefetch all other brands after current brand loads
  const prefetchedBrandsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Only prefetch if:
    // 1. Current brand data has loaded successfully
    // 2. We have brands available
    // 3. We have a selected brand
    // 4. We're not currently switching brands
    if (
      dashboardData &&
      !dashboardLoading &&
      !isBrandSwitching &&
      brands.length > 1 &&
      selectedBrandId &&
      startDate &&
      endDate
    ) {
      // Wait a bit to avoid blocking the initial render
      const prefetchTimer = setTimeout(() => {
        const otherBrands = brands.filter((brand) => brand.id !== selectedBrandId);
        
        // Prefetch up to 3 brands at a time to avoid overwhelming the backend
        const brandsToPrefetch = otherBrands.slice(0, 3);
        
        brandsToPrefetch.forEach((brand, index) => {
          // Skip if already prefetched
          if (prefetchedBrandsRef.current.has(brand.id)) {
            return;
          }

          // Stagger prefetches slightly to avoid burst
          const delay = index * 200; // 200ms between each prefetch
          
          setTimeout(() => {
            const params = new URLSearchParams({
              startDate,
              endDate,
            });
            const endpoint = `/brands/${brand.id}/dashboard?${params.toString()}`;
            
            // Use prefetchOnIdle to avoid blocking main thread
            prefetchOnIdle<ApiResponse<DashboardPayload>>(
              endpoint,
              {},
              { requiresAuth: true },
              1000 // 1 second timeout
            );
            
            prefetchedBrandsRef.current.add(brand.id);
            console.debug(`[DASHBOARD] Prefetched dashboard for brand: ${brand.name}`);
          }, delay);
        });
      }, 300); // Wait 300ms after current brand loads

      return () => clearTimeout(prefetchTimer);
    }
  }, [dashboardData, dashboardLoading, isBrandSwitching, brands, selectedBrandId, startDate, endDate]);

  useEffect(() => {
    if (!selectedBrandId) {
      setIsDataCollectionInProgress(false);
      setProgressData(null);
      return;
    }

    const storageKey = `data_collection_in_progress_${selectedBrandId}`;
    const completedAtKey = `data_collection_completed_at_${selectedBrandId}`;
    const inProgress = localStorage.getItem(storageKey) === 'true';
    setIsDataCollectionInProgress(inProgress);

    if (!inProgress) {
      setProgressData(null);
      return;
    }

    let isMounted = true;

    // Shared poller (single interval per brand) used across bell + modal + dashboard
    const unsubscribe = onboardingProgressTracker.subscribe(selectedBrandId, (snapshot) => {
      if (!isMounted) return;

      if (snapshot.data) {
        setProgressData({
          stages: snapshot.data.stages,
          queries: snapshot.data.queries,
          scoring: snapshot.data.scoring,
          currentOperation: snapshot.data.currentOperation || 'collecting',
        });
      }

      if (snapshot.isComplete) {
        localStorage.removeItem(storageKey);
        localStorage.setItem(completedAtKey, new Date().toISOString());
        setIsDataCollectionInProgress(false);

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
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedBrandId, refetchDashboard]);

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
  };
};
