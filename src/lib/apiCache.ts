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
  
  // Normalize params for consistent keys
  if (params) {
    const normalizedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${String(params[key])}`)
      .join('&');
    return `${baseKey}?${normalizedParams}`;
  }
  
  return baseKey;
}

/**
 * Get cache strategy for an endpoint
 */
function getCacheStrategy(endpoint: string): CacheStrategy {
  // Check for specific endpoint patterns
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
  // Extract params from endpoint or options
  const url = new URL(endpoint.startsWith('http') ? endpoint : `http://dummy${endpoint}`);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const cacheKey = generateCacheKey(endpoint, params);
  const strategy = getCacheStrategy(endpoint);

  // Check if we have a pending request for this key
  const pendingRequest = cacheManager.getPendingRequest<T>(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  // Check cache
  const cachedData = cacheManager.get<T>(cacheKey);
  const isFresh = cacheManager.isFresh(cacheKey);
  const isStale = cacheManager.isStale(cacheKey);
  const isExpired = cacheManager.isExpired(cacheKey);

  // If we have fresh data, return it immediately
  if (isFresh && cachedData) {
    return cachedData;
  }

  // If we have stale data, return it but fetch fresh in background
  if (isStale && cachedData) {
    // Check if signal is already aborted - if so, just return stale data
    const signal = (options as any)?.signal;
    if (signal && signal.aborted) {
      return cachedData;
    }
    
    // Fetch fresh data in background (don't await)
    // Don't pass signal to background refresh - it should complete independently
    const backgroundOptions = { ...options };
    delete (backgroundOptions as any).signal; // Remove signal from background request
    
    const freshRequest = apiClient.request<T>(endpoint, backgroundOptions, config);
    cacheManager.registerPendingRequest(cacheKey, freshRequest);
    
    freshRequest
      .then(data => {
        cacheManager.set(cacheKey, data, strategy);
      })
      .catch(error => {
        // Ignore AbortError in background refresh
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.warn('[apiCache] Background refresh failed:', error);
        // Keep stale data on error
      });
    
    return cachedData;
  }

  // If expired or no cache, fetch fresh data
  const signal = (options as any)?.signal;
  
  // Check if signal is already aborted before making request
  if (signal && signal.aborted) {
    // If we have any cached data (even expired), return it
    if (cachedData) {
      return cachedData;
    }
    // Otherwise, throw a proper error
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
  
  const request = apiClient.request<T>(endpoint, options, config);
  const registeredRequest = cacheManager.registerPendingRequest(cacheKey, request);
  
  try {
    const data = await registeredRequest;
    
    // Check if request was aborted after completion
    if (signal && signal.aborted) {
      // Still cache the data for future use, but return stale if available
      cacheManager.set(cacheKey, data, strategy);
      if (cachedData && !isExpired) {
        return cachedData;
      }
      return data;
    }
    
    cacheManager.set(cacheKey, data, strategy);
    return data;
  } catch (error) {
    // Ignore AbortError - it's expected when requests are cancelled
    if (error instanceof Error && error.name === 'AbortError') {
      // If we have stale data, return it even on abort
      if (cachedData && !isExpired) {
        return cachedData;
      }
      // If we have any cached data at all, return it
      if (cachedData) {
        return cachedData;
      }
      // Re-throw AbortError if no stale data available
      throw error;
    }
    
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

