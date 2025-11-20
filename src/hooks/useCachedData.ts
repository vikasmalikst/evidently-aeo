/**
 * React Hook for Cached Data Fetching
 * Provides a simple interface for components to fetch and cache API data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cachedRequest, prefetchRequest } from '../lib/apiCache';
import { cacheManager } from '../lib/cacheManager';

interface UseCachedDataOptions {
  enabled?: boolean; // Whether to fetch (default: true)
  refetchOnMount?: boolean; // Whether to refetch when component mounts (default: false)
  refetchInterval?: number; // Auto-refetch interval in ms (default: undefined)
}

interface UseCachedDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isStale: boolean;
}

/**
 * Hook for fetching and caching API data
 */
export function useCachedData<T>(
  endpoint: string | null,
  options: RequestInit = {},
  config: { requiresAuth?: boolean; retry?: boolean } = {},
  hookOptions: UseCachedDataOptions = {}
): UseCachedDataResult<T> {
  const {
    enabled = true,
    refetchOnMount = false,
    refetchInterval,
  } = hookOptions;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);
  

  const fetchData = useCallback(async (showLoading = true) => {
    if (!endpoint || !enabled) {
      setLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const currentController = abortControllerRef.current;

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      // Use cached request which handles stale-while-revalidate
      const result = await cachedRequest<T>(
        endpoint,
        {
          ...options,
          signal,
        },
        config
      );

      // Check if this request was aborted (controller might have changed)
      if (currentController === abortControllerRef.current && !signal.aborted) {
        setData(result);
        setLoading(false);
        setIsStale(false);
      }
    } catch (err) {
      // Ignore AbortError - it's expected when requests are cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        // Silently ignore - this is expected behavior
        return;
      }
      
      // Check if this request was aborted (controller might have changed)
      if (currentController === abortControllerRef.current && !signal.aborted) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setLoading(false);
        // Don't clear data on error - keep existing data if available
      }
    }
  }, [endpoint, enabled, JSON.stringify(options), JSON.stringify(config)]);

  // Initial fetch - check cache first, then fetch if needed
  useEffect(() => {
    if (!endpoint || !enabled) {
      setLoading(false);
      setData(null);
      return;
    }
    
    // Check cache synchronously first
    let hasCache = false;
    try {
      const url = new URL(endpoint.startsWith('http') ? endpoint : `http://dummy${endpoint}`);
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      const baseKey = endpoint.split('?')[0];
      const normalizedParams = params ? Object.keys(params)
        .sort()
        .map(key => `${key}=${String(params[key])}`)
        .join('&') : '';
      const cacheKey = normalizedParams ? `${baseKey}?${normalizedParams}` : baseKey;
      
      const cached = cacheManager.get<T>(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        setIsStale(cacheManager.isStale(cacheKey));
        hasCache = true;
      }
    } catch (e) {
      // Ignore errors in cache check
    }
    
    // Fetch data (will use cache if available, or fetch fresh)
    // Don't show loading if we already have cache and refetchOnMount is false
    if (!hasCache || refetchOnMount) {
      fetchData(!hasCache && !refetchOnMount);
    }

    return () => {
      if (abortControllerRef.current) {
        // Abort without throwing - this is cleanup
        try {
          abortControllerRef.current.abort();
        } catch (e) {
          // Ignore any errors during cleanup
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, enabled, refetchOnMount]);

  // Auto-refetch interval
  useEffect(() => {
    if (refetchInterval && endpoint && enabled) {
      intervalRef.current = window.setInterval(() => {
        fetchData(false); // Don't show loading on interval refetch
      }, refetchInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refetchInterval, endpoint, enabled, fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    isStale,
  };
}

/**
 * Hook for prefetching data (non-blocking)
 */
export function usePrefetch() {
  const prefetch = useCallback(
    async <T>(
      endpoint: string,
      options: RequestInit = {},
      config: { requiresAuth?: boolean; retry?: boolean } = {}
    ): Promise<void> => {
      await prefetchRequest<T>(endpoint, options, config);
    },
    []
  );

  return { prefetch };
}

/**
 * Hook for prefetching on hover
 */
export function usePrefetchOnHover(
  endpoint: string | null,
  options: RequestInit = {},
  config: { requiresAuth?: boolean; retry?: boolean } = {}
) {
  const { prefetch } = usePrefetch();

  const handleMouseEnter = useCallback(() => {
    if (endpoint) {
      prefetch(endpoint, options, config);
    }
  }, [endpoint, JSON.stringify(options), JSON.stringify(config), prefetch]);

  return { onMouseEnter: handleMouseEnter };
}

