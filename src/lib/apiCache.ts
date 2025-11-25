/**
 * API Cache Wrapper
 * Wraps apiClient.request() with intelligent caching based on endpoint patterns
 */

import { apiClient } from './apiClient';
import { cacheManager } from './cacheManager';

interface CacheStrategy {
  ttl: number; // Time to live in milliseconds
  staleTime: number; // Time after which data is considered stale
  maxAge: number; // Maximum age before data is completely invalid
  persist: boolean; // Whether to persist to localStorage
}

// Cache strategies per endpoint pattern
const CACHE_STRATEGIES: Record<string, CacheStrategy> = {
  // Brands endpoint - cache for longer since it doesn't change often
  '/brands': {
    ttl: 5 * 60 * 1000, // 5 minutes
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    persist: true,
  },
  // Dashboard endpoints
  '/dashboard': {
    ttl: 2 * 60 * 1000, // 2 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
    maxAge: 10 * 60 * 1000, // 10 minutes
    persist: true,
  },
  // Visibility endpoints
  '/visibility': {
    ttl: 1 * 60 * 1000, // 1 minute
    staleTime: 3 * 60 * 1000, // 3 minutes
    maxAge: 5 * 60 * 1000, // 5 minutes
    persist: true,
  },
  // Sources endpoints
  '/sources': {
    ttl: 2 * 60 * 1000, // 2 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
    maxAge: 10 * 60 * 1000, // 10 minutes
    persist: true,
  },
  // Topics endpoints
  '/topics': {
    ttl: 5 * 60 * 1000, // 5 minutes
    staleTime: 10 * 60 * 1000, // 10 minutes
    maxAge: 30 * 60 * 1000, // 30 minutes
    persist: true,
  },
  // Prompts endpoints
  '/prompts': {
    ttl: 1 * 60 * 1000, // 1 minute
    staleTime: 3 * 60 * 1000, // 3 minutes
    maxAge: 5 * 60 * 1000, // 5 minutes
    persist: true,
  },
  // Default strategy
  default: {
    ttl: 2 * 60 * 1000, // 2 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
    maxAge: 10 * 60 * 1000, // 10 minutes
    persist: false,
  },
};

/**
 * Generate cache key from endpoint and params
 */
function generateCacheKey(endpoint: string, params?: Record<string, any>): string {
  const baseKey = endpoint.split('?')[0]; // Remove query string from endpoint
  
  // Normalize params for consistent keys (skip when no params)
  if (params) {
    const sortedKeys = Object.keys(params).sort();
    if (sortedKeys.length > 0) {
      const normalizedParams = sortedKeys
        .map(key => `${key}=${String(params[key])}`)
        .join('&');
      return `${baseKey}?${normalizedParams}`;
    }
  }
  
  return baseKey;
}

/**
 * Get cache strategy for an endpoint
 */
function getCacheStrategy(endpoint: string): CacheStrategy {
  // Check for specific endpoint patterns (order matters - more specific first)
  // Check exact matches first (e.g., /brands without query params)
  if (endpoint === '/brands' || endpoint.startsWith('/brands?')) {
    return CACHE_STRATEGIES['/brands'];
  }
  
  // Then check for pattern matches
  for (const [pattern, strategy] of Object.entries(CACHE_STRATEGIES)) {
    if (pattern !== 'default' && endpoint.includes(pattern)) {
      return strategy;
    }
  }
  
  return CACHE_STRATEGIES.default;
}

/**
 * Cached API request with stale-while-revalidate pattern
 */
export async function cachedRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  config: { requiresAuth?: boolean; retry?: boolean } = {}
): Promise<T> {
  const apiCacheStart = performance.now();
  console.log(`[apiCache] cachedRequest called for: ${endpoint} at`, apiCacheStart);
  
  // Extract params from endpoint or options
  const url = new URL(endpoint.startsWith('http') ? endpoint : `http://dummy${endpoint}`);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const cacheKey = generateCacheKey(endpoint, params);
  const strategy = getCacheStrategy(endpoint);
  console.log(`[apiCache] Cache key: ${cacheKey} - Strategy: ${endpoint.includes('/dashboard') ? 'dashboard' : 'other'}`);

  // Check if we have a pending request for this key
  const pendingRequest = cacheManager.getPendingRequest<T>(cacheKey);
  if (pendingRequest) {
    console.log(`[apiCache] ✅ Pending request found, reusing at`, performance.now(), `- Time: ${(performance.now() - apiCacheStart).toFixed(2)}ms`);
    return pendingRequest;
  }

  // Check cache
  const cacheCheckStart = performance.now();
  const cachedData = cacheManager.get<T>(cacheKey);
  const isFresh = cacheManager.isFresh(cacheKey);
  const isStale = cacheManager.isStale(cacheKey);
  const isExpired = cacheManager.isExpired(cacheKey);
  const cacheCheckTime = performance.now() - cacheCheckStart;
  
  console.log(`[apiCache] Cache check completed at`, performance.now(), `- Check time: ${cacheCheckTime.toFixed(2)}ms - Has data: ${!!cachedData}, Fresh: ${isFresh}, Stale: ${isStale}, Expired: ${isExpired}`);

  // If we have fresh data, return it immediately
  if (isFresh && cachedData) {
    console.log(`[apiCache] ✅✅✅ RETURNING FRESH CACHE at`, performance.now(), `- Total time: ${(performance.now() - apiCacheStart).toFixed(2)}ms`);
    return cachedData;
  }

  // If we have stale data, return it but fetch fresh in background
  if (isStale && cachedData) {
    console.log(`[apiCache] ✅✅ RETURNING STALE CACHE (will refresh in background) at`, performance.now(), `- Total time: ${(performance.now() - apiCacheStart).toFixed(2)}ms`);
    
    // Check if signal is already aborted - if so, just return stale data
    const signal = (options as any)?.signal;
    if (signal && signal.aborted) {
      return cachedData;
    }
    
    // Fetch fresh data in background (don't await)
    // Don't pass signal to background refresh - it should complete independently
    const backgroundOptions = { ...options };
    delete (backgroundOptions as any).signal; // Remove signal from background request
    
    const bgRefreshStart = performance.now();
    console.log(`[apiCache] Starting background refresh at`, bgRefreshStart);
    const freshRequest = apiClient.request<T>(endpoint, backgroundOptions, config);
    cacheManager.registerPendingRequest(cacheKey, freshRequest);
    
    freshRequest
      .then(data => {
        const bgRefreshTime = performance.now() - bgRefreshStart;
        console.log(`[apiCache] ✅ Background refresh completed at`, performance.now(), `- Duration: ${bgRefreshTime.toFixed(2)}ms`);
        cacheManager.set(cacheKey, data, strategy);
      })
      .catch(error => {
        const bgRefreshTime = performance.now() - bgRefreshStart;
        // Ignore AbortError in background refresh
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`[apiCache] Background refresh aborted at`, performance.now(), `- Duration: ${bgRefreshTime.toFixed(2)}ms`);
          return;
        }
        console.warn(`[apiCache] ❌ Background refresh failed at`, performance.now(), `- Duration: ${bgRefreshTime.toFixed(2)}ms - Error:`, error);
        // Keep stale data on error
      });
    
    return cachedData;
  }

  // If expired or no cache, fetch fresh data
  console.log(`[apiCache] ❌ No cache or expired, fetching fresh data at`, performance.now(), `- Time since start: ${(performance.now() - apiCacheStart).toFixed(2)}ms`);
  
  const signal = (options as any)?.signal;
  
  // Check if signal is already aborted before making request
  if (signal && signal.aborted) {
    console.log(`[apiCache] Signal already aborted, returning cached data if available`);
    // If we have any cached data (even expired), return it
    if (cachedData) {
      return cachedData;
    }
    // Otherwise, throw a proper error
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
  
  const apiRequestStart = performance.now();
  console.log(`[apiCache] Making API request at`, apiRequestStart);
  const request = apiClient.request<T>(endpoint, options, config);
  const registeredRequest = cacheManager.registerPendingRequest(cacheKey, request);
  
  try {
    const data = await registeredRequest;
    const apiRequestTime = performance.now() - apiRequestStart;
    console.log(`[apiCache] ✅ API request completed at`, performance.now(), `- Request duration: ${apiRequestTime.toFixed(2)}ms - Total time: ${(performance.now() - apiCacheStart).toFixed(2)}ms`);
    
    // Check if request was aborted after completion
    if (signal && signal.aborted) {
      // Still cache the data for future use, but return stale if available
      cacheManager.set(cacheKey, data, strategy);
      if (cachedData && !isExpired) {
        return cachedData;
      }
      return data;
    }
    
    const cacheSetStart = performance.now();
    cacheManager.set(cacheKey, data, strategy);
    const cacheSetTime = performance.now() - cacheSetStart;
    console.log(`[apiCache] Data cached at`, performance.now(), `- Cache set time: ${cacheSetTime.toFixed(2)}ms`);
    return data;
  } catch (error) {
    const apiRequestTime = performance.now() - apiRequestStart;
    // Ignore AbortError - it's expected when requests are cancelled
    if (error instanceof Error && error.name === 'AbortError') {
      // If we have stale data, return it even on abort
      if (cachedData && !isExpired) {
        console.log(`[apiCache] Request aborted, returning stale cache at`, performance.now(), `- Request duration: ${apiRequestTime.toFixed(2)}ms`);
        return cachedData;
      }
      // If we have any cached data at all, return it
      if (cachedData) {
        console.log(`[apiCache] Request aborted, returning expired cache at`, performance.now(), `- Request duration: ${apiRequestTime.toFixed(2)}ms`);
        return cachedData;
      }
      // Log but don't error - this is expected cleanup behavior
      console.log(`[apiCache] Request aborted (no cache available) at`, performance.now(), `- Request duration: ${apiRequestTime.toFixed(2)}ms`);
      // Re-throw AbortError if no stale data available
      throw error;
    }
    
    // Only log non-abort errors as errors
    console.error(`[apiCache] ❌ API request failed at`, performance.now(), `- Request duration: ${apiRequestTime.toFixed(2)}ms - Total time: ${(performance.now() - apiCacheStart).toFixed(2)}ms - Error:`, error);
    
    // On error, try to return stale data if available
    if (cachedData && !isExpired) {
      console.warn('[apiCache] Request failed, using stale cache:', error);
      return cachedData;
    }
    throw error;
  }
}

/**
 * Prefetch data (non-blocking)
 */
export async function prefetchRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  config: { requiresAuth?: boolean; retry?: boolean } = {}
): Promise<void> {
  const url = new URL(endpoint.startsWith('http') ? endpoint : `http://dummy${endpoint}`);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const cacheKey = generateCacheKey(endpoint, params);
  const strategy = getCacheStrategy(endpoint);

  // Don't prefetch if we already have fresh data
  if (cacheManager.isFresh(cacheKey)) {
    return;
  }

  // Don't prefetch if there's already a pending request
  if (cacheManager.getPendingRequest(cacheKey)) {
    return;
  }

  // Prefetch in background
  try {
    const request = apiClient.request<T>(endpoint, options, config);
    cacheManager.registerPendingRequest(cacheKey, request);
    const data = await request;
    cacheManager.set(cacheKey, data, strategy);
  } catch (error) {
    // Silently fail on prefetch errors
    console.debug('[apiCache] Prefetch failed:', error);
  }
}

/**
 * Invalidate cache for an endpoint pattern
 */
export function invalidateCache(pattern: string | RegExp): void {
  cacheManager.invalidatePattern(pattern);
}

/**
 * Clear all API cache
 */
export function clearApiCache(): void {
  cacheManager.clear();
}

