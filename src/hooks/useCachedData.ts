/**
 * React Hook for Cached Data Fetching
 * Provides a simple interface for components to fetch and cache API data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cachedRequest, prefetchRequest } from '../lib/apiCache';
import { cacheManager } from '../lib/cacheManager';
import { authService } from '../lib/auth';

const cacheDebugEnabled =
  typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_CACHE_DEBUG === 'true';
const cacheDebugLog = (...args: any[]) => {
  if (cacheDebugEnabled) {
    console.log(...args);
  }
};

function isAbortError(err: unknown): boolean {
  // Abort can be DOMException in browsers (not always instanceof Error)
  if (!err || (typeof err !== 'object' && typeof err !== 'function')) return false;
  const anyErr = err as any;
  const name = typeof anyErr.name === 'string' ? anyErr.name : '';
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  return name === 'AbortError' || message.toLowerCase().includes('aborted');
}

/**
 * Generate cache key matching apiCache's logic (includes customer_id for customer-specific endpoints)
 */
function generateCacheKeyForHook(endpoint: string, params?: Record<string, string>): string {
  const baseKey = endpoint.split('?')[0];
  
  // Customer-specific endpoints that need customer_id in cache key (same as apiCache)
  const customerSpecificEndpoints = [
    '/brands',
    '/dashboard',
    '/sources',
    '/topics',
    '/prompts',
    '/keywords',
    '/visibility'
  ];
  
  const isCustomerSpecific = customerSpecificEndpoints.some(pattern => 
    baseKey === pattern || baseKey.startsWith(pattern + '/')
  );
  
  // Get customer_id from auth service for customer-specific endpoints
  let customerId: string | null = null;
  if (isCustomerSpecific) {
    try {
      const user = authService.getStoredUser();
      customerId = user?.customerId || null;
    } catch (error) {
      // Ignore errors - will fall back to key without customer_id
    }
  }
  
  // Build cache key with customer_id if applicable
  const keyParts: string[] = [baseKey];
  
  if (customerId) {
    keyParts.push(`customer=${customerId}`);
  }
  
  // Normalize params for consistent keys
  if (params) {
    const sortedKeys = Object.keys(params).sort();
    if (sortedKeys.length > 0) {
      const normalizedParams = sortedKeys
        .map(key => `${key}=${String(params[key])}`)
        .join('&');
      keyParts.push(normalizedParams);
    }
  }
  
  return keyParts.length > 1 ? keyParts.join('?') : baseKey;
}

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

  // Initialize state from cache synchronously if available
  const [data, setData] = useState<T | null>(() => {
    if (!endpoint || !enabled) return null;
    try {
      const url = new URL(endpoint.startsWith('http') ? endpoint : `http://dummy${endpoint}`);
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      // Use same cache key generation logic as apiCache (includes customer_id)
      const cacheKey = generateCacheKeyForHook(endpoint, params);
      const cached = cacheManager.get<T>(cacheKey);
      if (cached) {
        cacheDebugLog(`[useCachedData] ✅ Initial state from cache for: ${endpoint} (key: ${cacheKey})`);
        return cached;
      }
    } catch (e) {
      // Ignore errors in initial cache check
    }
    return null;
  });
  
  const [loading, setLoading] = useState<boolean>(() => {
    if (!endpoint || !enabled) return false;
    try {
      const url = new URL(endpoint.startsWith('http') ? endpoint : `http://dummy${endpoint}`);
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      // Use same cache key generation logic as apiCache (includes customer_id)
      const cacheKey = generateCacheKeyForHook(endpoint, params);
      const cached = cacheManager.get<T>(cacheKey);
      // If we have cached data (even if stale), set loading to false so we can show it immediately
      // The background refresh will happen in useEffect
      if (cached) {
        const isFresh = cacheManager.isFresh(cacheKey);
        cacheDebugLog(`[useCachedData] ✅ Initial loading false (${isFresh ? 'fresh' : 'stale'} cache) for: ${endpoint} (key: ${cacheKey})`);
        return false;
      }
    } catch (e) {
      // Ignore errors in initial cache check
    }
    return true;
  });
  
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState<boolean>(() => {
    if (!endpoint || !enabled) return false;
    try {
      const url = new URL(endpoint.startsWith('http') ? endpoint : `http://dummy${endpoint}`);
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      // Use same cache key generation logic as apiCache (includes customer_id)
      const cacheKey = generateCacheKeyForHook(endpoint, params);
      return cacheManager.isStale(cacheKey);
    } catch (e) {
      return false;
    }
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);
  

  const fetchData = useCallback(async (showLoading = true) => {
    const fetchStart = performance.now();
    cacheDebugLog(`[useCachedData] fetchData called for: ${endpoint} at`, fetchStart, `- showLoading: ${showLoading}`);
    
    if (!endpoint || !enabled) {
      cacheDebugLog(`[useCachedData] fetchData skipped - endpoint: ${endpoint}, enabled: ${enabled}`);
      setLoading(false);
      return;
    }

    // Cancel previous request gracefully
    if (abortControllerRef.current) {
      try {
        // Mark as cleanup abort to prevent error logging
        (abortControllerRef.current as any)._isCleanupAbort = true;
        abortControllerRef.current.abort();
      } catch (e) {
        // Ignore any errors during abort - this is expected
      }
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const currentController = abortControllerRef.current;

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      cacheDebugLog(`[useCachedData] Calling cachedRequest at`, performance.now(), `- Time since fetchData start: ${(performance.now() - fetchStart).toFixed(2)}ms`);
      const requestStart = performance.now();
      
      // Use cached request which handles stale-while-revalidate
      const result = await cachedRequest<T>(
        endpoint,
        {
          ...options,
          signal,
        },
        config
      );

      const requestDuration = performance.now() - requestStart;
      cacheDebugLog(`[useCachedData] cachedRequest completed at`, performance.now(), `- Request duration: ${requestDuration.toFixed(2)}ms - Total fetchData time: ${(performance.now() - fetchStart).toFixed(2)}ms`);

      // Check if this request was aborted (controller might have changed)
      if (currentController === abortControllerRef.current && !signal.aborted) {
        setData(result);
        setLoading(false);
        setIsStale(false);
        cacheDebugLog(`[useCachedData] ✅ Data set in state at`, performance.now());
      } else {
        cacheDebugLog(`[useCachedData] Request was aborted, not setting data`);
      }
    } catch (err) {
      const errorDuration = performance.now() - fetchStart;
      // Ignore AbortError - it's expected when requests are cancelled
      if (isAbortError(err)) {
        // Check if this was a cleanup abort (expected) or an unexpected abort
        const isCleanupAbort = (abortControllerRef.current as any)?._isCleanupAbort;
        if (isCleanupAbort) {
          // Silent - this is expected cleanup behavior
          return;
        }
        // Silent - abort errors are always expected when switching endpoints or unmounting
        // Don't log as they clutter the console
        return;
      }
      
      // Only log non-abort errors
      console.error(`[useCachedData] ❌ Error in fetchData at`, performance.now(), `- Duration: ${errorDuration.toFixed(2)}ms - Error:`, err);
      
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
    const hookStart = performance.now();
    cacheDebugLog(`[useCachedData] Hook effect triggered for: ${endpoint} at`, hookStart, `- enabled: ${enabled}`);
    
    if (!endpoint) {
      cacheDebugLog(`[useCachedData] No endpoint - clearing state`);
      setLoading(false);
      setData(null);
      return;
    }
    
    // If disabled, don't clear data - just don't fetch
    if (!enabled) {
      cacheDebugLog(`[useCachedData] Hook disabled - keeping existing data, not fetching`);
      return;
    }
    
    // Check cache synchronously first
    const cacheCheckStart = performance.now();
    let hasCache = false;
    try {
      const url = new URL(endpoint.startsWith('http') ? endpoint : `http://dummy${endpoint}`);
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      // Use same cache key generation logic as apiCache (includes customer_id)
      const cacheKey = generateCacheKeyForHook(endpoint, params);
      
      console.log(`[useCachedData] Checking cache for key: ${cacheKey} at`, performance.now());
      const cached = cacheManager.get<T>(cacheKey);
      const cacheCheckTime = performance.now() - cacheCheckStart;
      
      if (cached) {
        const isStaleValue = cacheManager.isStale(cacheKey);
        const isFreshValue = cacheManager.isFresh(cacheKey);
        const isExpiredValue = cacheManager.isExpired(cacheKey);
        console.log(`[useCachedData] ✅ CACHE HIT at`, performance.now(), `- Cache check took: ${cacheCheckTime.toFixed(2)}ms - Fresh: ${isFreshValue}, Stale: ${isStaleValue}, Expired: ${isExpiredValue}`);
        setData(cached);
        setLoading(false);
        setIsStale(isStaleValue);
        hasCache = true;
        
        // If expired, we still show it but fetch fresh in background
        if (isExpiredValue) {
          cacheDebugLog(`[useCachedData] Cache expired - will fetch fresh in background`);
        }
      } else {
        cacheDebugLog(`[useCachedData] ❌ CACHE MISS at`, performance.now(), `- Cache check took: ${cacheCheckTime.toFixed(2)}ms`);
      }
    } catch (e) {
      console.error(`[useCachedData] Error checking cache:`, e);
    }
    
    // Always fetch if enabled (cachedRequest will handle cache logic)
    // This ensures we fetch when enabled changes from false to true
    const fetchStart = performance.now();
    cacheDebugLog(`[useCachedData] Starting fetch at`, fetchStart, `- Has cache: ${hasCache}, Refetch on mount: ${refetchOnMount}`);
    // Don't show loading if we have fresh cache
    const showLoading = !hasCache || refetchOnMount;
    fetchData(showLoading).catch((err) => {
      // Silently ignore abort errors - they're expected during cleanup
      if (isAbortError(err)) {
        return;
      }
      // Only log non-abort errors
      if (err instanceof Error) {
        console.error('[useCachedData] Unhandled fetch error:', err);
      }
    });

    return () => {
      if (abortControllerRef.current) {
        // Abort without throwing - this is cleanup
        // Use a flag to prevent error logging for expected aborts
        const controller = abortControllerRef.current;
        try {
          // Mark as cleanup abort to prevent error logging
          (controller as any)._isCleanupAbort = true;
          controller.abort();
        } catch (e) {
          // Ignore any errors during cleanup - this is expected
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, enabled, refetchOnMount]);

  // Auto-refetch interval
  useEffect(() => {
    if (refetchInterval && endpoint && enabled) {
      intervalRef.current = window.setInterval(() => {
        fetchData(false).catch((err) => {
          // Silently ignore abort errors - they're expected during cleanup
          if (isAbortError(err)) {
            return;
          }
          // Only log non-abort errors
          if (err instanceof Error) {
            console.error('[useCachedData] Unhandled interval fetch error:', err);
          }
        }); // Don't show loading on interval refetch
      }, refetchInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    // Always return a cleanup function (even if no-op) to ensure consistent hook behavior
    return () => {
      // No-op cleanup when interval is not active
    };
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

