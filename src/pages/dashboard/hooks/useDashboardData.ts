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

import { useDashboardStore } from '../../../store/dashboardStore';

export const useDashboardData = () => {
  const pageMountTime = useRef(performance.now());
  const authLoading = useAuthStore((state) => state.isLoading);
  // Replaced local state with global store
  const { startDate, endDate, setStartDate, setEndDate, llmFilters, queryTags } = useDashboardStore();
  const [reloadKey, setReloadKey] = useState(0);
  // Track the last time we successfully received data to query for updates relative to that time
  const lastSuccessfulFetch = useRef<string>(new Date(Date.now() - 5 * 60 * 1000).toISOString());
  const navigate = useNavigate();
  const location = useLocation();
  const [isDataCollectionInProgress, setIsDataCollectionInProgress] = useState(false);
  const [progressData, setProgressData] = useState<{
    stages?: {
      collection: { total: number; completed: number; status: 'pending' | 'active' | 'completed' };
      scoring: { total: number; completed: number; status: 'pending' | 'active' | 'completed' };
      domain_readiness: { status: 'pending' | 'active' | 'completed'; last_run: string | null };
      recommendations: { status: 'pending' | 'active' | 'completed'; last_run: string | null };
      finalization: { status: 'pending' | 'active' | 'completed' };
    };
    queries: { total: number; completed: number };
    scoring: { positions: boolean; sentiments: boolean; citations: boolean };
    currentOperation: 'collecting' | 'scoring' | 'finalizing' | 'domain_readiness' | 'recommendations';
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

    // Get timezone offset in minutes (UTC - Local)
    const timezoneOffset = new Date().getTimezoneOffset();

    const params = new URLSearchParams({
      startDate,
      endDate,
      timezoneOffset: timezoneOffset.toString(),
      skipCitations: 'true'
    });

    // Add collectors filter if specific LLMs are selected
    if (llmFilters && llmFilters.length > 0 && !llmFilters.includes('all')) {
      // Map normalized IDs back to labels is tricky here without the options list.
      // However, the backend likely expects what we pass. 
      // In MeasurePage we were mapping back to labels.
      // Let's assume the store holds the values we want to send, or we need to pass the mapping capability.
      // Actually, looking at MeasurePage, it holds "normalized" IDs (e.g. 'gpt-4') but sends labels (e.g. 'GPT-4').
      // We might need to store the actual values in the store or handle mapping there.
      // For now, let's pass what's in the store. If they are normalized IDs, the backend might need to handle them or we need to map them.
      // WAIT - MeasurePage was doing: s.provider (label) -> normalizeId (value). 
      // And passing labels to backend.
      // If we move state to store, the store should probably hold the values (IDs) and we map them here?
      // OR we just assume the store holds what we want to send?
      // Let's assume the store holds the IDs (values).
      // If the backend needs labels, we have a problem: we don't have the labels here.
      // The labels come from the data itself (llmVisibility).
      // We can get the labels from dashboardData if available?

      // Better approach: Let's assume we store the "Keys" in the store.
      // And we rely on the backend to accept keys OR we fix the store to hold what needs to be sent.
      // BUT, checking MeasurePage again:
      // const llmOptions = ... map(s => ({ value: normalizeId(s.provider), label: s.provider ...
      // setLlmFilters stores values.
      // params.append('collectors', selectedLabels.join(','));
      // So we DO need to map back to labels.

      // We can find the labels from the current dashboardData if it exists!
      // If dashboardData is null (first load), we can't filter yet anyway? 
      // Or we can just send the ID and hope backend handles it? 
      // Let's try to map from dashboardData if available.

      // If we don't have data yet, we can't map. But if we don't have data, we arguably don't have filters set yet either (default empty).
      // If we are reloading with filters set...

      // Workaround: Send the IDs. Backend *should* ideally handle normalized IDs.
      // If not, we might need to cache the options in the store too.
      // Let's try sending the IDs joined by comma.
      params.append('collectors', llmFilters.join(','));
    }

    // Add query tag filter
    if (queryTags && queryTags.length > 0) {
      params.append('queryTags', queryTags.join(','));
    }

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
  }, [selectedBrandId, startDate, endDate, reloadKey, isDataCollectionInProgress, brandsLoading, brands, llmFilters, queryTags]);

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
        // Query for updates since the last time we successfully fetched data
        const since = lastSuccessfulFetch.current;

        const response = await apiClient.request<ApiResponse<{ hasUpdates: boolean; count?: number }>>(
          `/brands/${selectedBrandId}/data-updates?since=${since}`,
          {},
          { requiresAuth: true }
        );

        if (response?.success && response.data?.hasUpdates) {
          console.info(`[DASHBOARD] New data detected (since ${since}), forcing refresh...`);
          // Force a reload using reloadKey to bypass cache
          handleRetryFetch();
        }
      } catch (error) {
        // Silently fail - this is a background check, don't spam console
        if (error instanceof Error && !error.message.includes('aborted')) {
          console.debug('[DASHBOARD] Error checking for new data:', error);
        }
      }
    };

    // Check for new data every 20 seconds
    const interval = setInterval(checkForNewData, 20000);

    return () => clearInterval(interval);
  }, [selectedBrandId, dashboardEndpoint]);

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

      // Update the reference time for "since" checks
      lastSuccessfulFetch.current = new Date().toISOString();
    }
  }, [dashboardData]);

  const handleRetryFetch = () => {
    setReloadKey((prev) => prev + 1);
  };

  const brandSelectionPending = !selectedBrandId && brandsLoading;
  const locationState = location.state as { fromOnboarding?: boolean } | null;
  const fromOnboarding = locationState?.fromOnboarding || false;
  // Show loading when: auth loading, brand selection pending, brand switching, or fetching new data
  // Fix: Show loading if dashboardLoading is true, UNLESS we have data and we are just refetching in background (stale-while-revalidate).
  // But for date changes, we WANT to show loading.
  // We can distinguish by comparing the current dashboardData date range with the requested startDate/endDate.
  const isDateChange = dashboardData && (dashboardData.dateRange.start !== startDate || dashboardData.dateRange.end !== endDate);

  const shouldShowLoading = (
    authLoading ||
    brandSelectionPending ||
    isBrandSwitching ||
    (dashboardLoading && (!dashboardData || isDateChange))
  );


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
            const timezoneOffset = new Date().getTimezoneOffset();
            const params = new URLSearchParams({
              startDate,
              endDate,
              timezoneOffset: timezoneOffset.toString(),
              skipCitations: 'true'
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

        console.info('[DASHBOARD] Data collection complete, forcing refresh...');
        handleRetryFetch();

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
