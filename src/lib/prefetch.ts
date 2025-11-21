/**
 * Prefetching Utilities
 * Provides utilities for prefetching data on navigation and idle time
 */

import { prefetchRequest } from './apiCache';

/**
 * Prefetch data when idle (using requestIdleCallback or setTimeout fallback)
 */
export function prefetchOnIdle<T>(
  endpoint: string,
  options: RequestInit = {},
  config: { requiresAuth?: boolean; retry?: boolean } = {},
  timeout = 2000
): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      () => {
        prefetchRequest<T>(endpoint, options, config);
      },
      { timeout }
    );
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      prefetchRequest<T>(endpoint, options, config);
    }, 100);
  }
}

/**
 * Prefetch data immediately (high priority)
 */
export async function prefetchNow<T>(
  endpoint: string,
  options: RequestInit = {},
  config: { requiresAuth?: boolean; retry?: boolean } = {}
): Promise<void> {
  await prefetchRequest<T>(endpoint, options, config);
}

/**
 * Prefetch multiple endpoints in parallel
 */
export async function prefetchMultiple(
  endpoints: Array<{
    endpoint: string;
    options?: RequestInit;
    config?: { requiresAuth?: boolean; retry?: boolean };
  }>
): Promise<void> {
  await Promise.all(
    endpoints.map(({ endpoint, options = {}, config = {} }) =>
      prefetchRequest(endpoint, options, config).catch(error => {
        console.debug('[prefetch] Failed to prefetch:', endpoint, error);
      })
    )
  );
}

/**
 * Prefetch related data for a page
 * This can be called when a page loads to prefetch likely next pages
 */
export function prefetchRelatedPages(currentPath: string, brandId?: string): void {
  if (!brandId) return;

  const relatedEndpoints: Array<{
    endpoint: string;
    options?: RequestInit;
    config?: { requiresAuth?: boolean; retry?: boolean };
  }> = [];

  // Prefetch dashboard if not on dashboard
  if (!currentPath.includes('/dashboard')) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    relatedEndpoints.push({
      endpoint: `/brands/${brandId}/dashboard?startDate=${start.toISOString().split('T')[0]}&endDate=${end.toISOString().split('T')[0]}`,
    });
  }

  // Prefetch visibility if not on visibility page
  if (!currentPath.includes('/search-visibility')) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    relatedEndpoints.push({
      endpoint: `/brands/${brandId}/dashboard?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
    });
  }

  // Prefetch sources if not on sources page
  if (!currentPath.includes('/search-sources')) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    relatedEndpoints.push({
      endpoint: `/brands/${brandId}/sources?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
    });
  }

  // Prefetch topics if not on topics page
  if (!currentPath.includes('/topics')) {
    relatedEndpoints.push({
      endpoint: `/brands/${brandId}/topics`,
    });
  }

  // Prefetch prompts if not on prompts page
  if (!currentPath.includes('/prompts')) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    relatedEndpoints.push({
      endpoint: `/brands/${brandId}/prompts?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
    });
  }

  // Prefetch on idle
  if (relatedEndpoints.length > 0) {
    prefetchOnIdle('', {}, {}, 3000);
    setTimeout(() => {
      prefetchMultiple(relatedEndpoints);
    }, 1000);
  }
}


