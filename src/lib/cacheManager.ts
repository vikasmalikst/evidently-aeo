/**
 * Centralized Cache Manager
 * Provides in-memory caching with localStorage persistence, TTL management,
 * stale-while-revalidate pattern, and request deduplication.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  staleTime: number; // Time after which data is considered stale (but still usable)
  maxAge: number; // Maximum age before data is completely invalid
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  staleTime: number; // Time after which data is considered stale
  maxAge: number; // Maximum age before data is completely invalid
  persist?: boolean; // Whether to persist to localStorage
}

type CacheKey = string;

class CacheManager {
  private memoryCache = new Map<CacheKey, CacheEntry<any>>();
  private pendingRequests = new Map<CacheKey, Promise<any>>();
  private readonly STORAGE_PREFIX = 'evidently_cache_';
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit for localStorage

  /**
   * Get data from cache (memory or localStorage)
   */
  get<T>(key: CacheKey): T | null {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      const age = Date.now() - memoryEntry.timestamp;
      if (age < memoryEntry.maxAge) {
        return memoryEntry.data as T;
      }
      // Entry expired, remove it
      this.memoryCache.delete(key);
    }

    // Try localStorage
    try {
      const stored = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        const age = Date.now() - entry.timestamp;
        if (age < entry.maxAge) {
          // Restore to memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        }
        // Entry expired, remove it
        localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
      }
    } catch (error) {
      console.warn('[CacheManager] Failed to read from localStorage:', error);
    }

    return null;
  }

  /**
   * Set data in cache
   */
  set<T>(key: CacheKey, data: T, config: CacheConfig): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: config.ttl,
      staleTime: config.staleTime,
      maxAge: config.maxAge,
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Persist to localStorage if configured
    if (config.persist) {
      try {
        const serialized = JSON.stringify(entry);
        const currentSize = this.getStorageSize();
        
        // Check if we need to evict old entries
        if (currentSize + serialized.length > this.MAX_STORAGE_SIZE) {
          this.evictOldestEntries(serialized.length);
        }

        localStorage.setItem(`${this.STORAGE_PREFIX}${key}`, serialized);
      } catch (error) {
        console.warn('[CacheManager] Failed to write to localStorage:', error);
        // If quota exceeded, try to evict and retry once
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          try {
            const serialized = JSON.stringify(entry);
            this.evictOldestEntries(serialized.length);
            localStorage.setItem(`${this.STORAGE_PREFIX}${key}`, serialized);
          } catch (retryError) {
            console.warn('[CacheManager] Failed to write after eviction:', retryError);
          }
        }
      }
    }
  }

  /**
   * Check if data exists and is fresh (not stale)
   */
  isFresh(key: CacheKey): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      // Check localStorage
      try {
        const stored = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
        if (stored) {
          const parsed: CacheEntry<any> = JSON.parse(stored);
          const age = Date.now() - parsed.timestamp;
          return age < parsed.ttl;
        }
      } catch {
        // Ignore errors
      }
      return false;
    }

    const age = Date.now() - entry.timestamp;
    return age < entry.ttl;
  }

  /**
   * Check if data exists but is stale (still usable but should be refreshed)
   */
  isStale(key: CacheKey): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      // Check localStorage
      try {
        const stored = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
        if (stored) {
          const parsed: CacheEntry<any> = JSON.parse(stored);
          const age = Date.now() - parsed.timestamp;
          return age >= parsed.ttl && age < parsed.staleTime;
        }
      } catch {
        // Ignore errors
      }
      return false;
    }

    const age = Date.now() - entry.timestamp;
    return age >= entry.ttl && age < entry.staleTime;
  }

  /**
   * Check if data is expired (should not be used)
   */
  isExpired(key: CacheKey): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      // Check localStorage
      try {
        const stored = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
        if (stored) {
          const parsed: CacheEntry<any> = JSON.parse(stored);
          const age = Date.now() - parsed.timestamp;
          return age >= parsed.maxAge;
        }
      } catch {
        // Ignore errors
      }
      return true;
    }

    const age = Date.now() - entry.timestamp;
    return age >= entry.maxAge;
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: CacheKey): void {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.warn('[CacheManager] Failed to remove from localStorage:', error);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    // Clear from memory
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from localStorage
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          const cacheKey = key.substring(this.STORAGE_PREFIX.length);
          if (regex.test(cacheKey)) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.warn('[CacheManager] Failed to clear pattern from localStorage:', error);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.pendingRequests.clear();
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('[CacheManager] Failed to clear localStorage:', error);
    }
  }

  /**
   * Register a pending request to prevent duplicate fetches
   */
  registerPendingRequest<T>(key: CacheKey, promise: Promise<T>): Promise<T> {
    this.pendingRequests.set(key, promise);
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });
    return promise;
  }

  /**
   * Get pending request if exists
   */
  getPendingRequest<T>(key: CacheKey): Promise<T> | null {
    return (this.pendingRequests.get(key) as Promise<T>) || null;
  }

  /**
   * Get current storage size
   */
  private getStorageSize(): number {
    try {
      let size = 0;
      for (const key in localStorage) {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          size += localStorage.getItem(key)?.length || 0;
        }
      }
      return size;
    } catch {
      return 0;
    }
  }

  /**
   * Evict oldest entries to make room
   */
  private evictOldestEntries(requiredSpace: number): void {
    try {
      const entries: Array<{ key: string; timestamp: number; size: number }> = [];
      
      for (const key in localStorage) {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const parsed: CacheEntry<any> = JSON.parse(value);
              entries.push({
                key,
                timestamp: parsed.timestamp,
                size: value.length,
              });
            } catch {
              // Invalid entry, remove it
              localStorage.removeItem(key);
            }
          }
        }
      }

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest entries until we have enough space
      let freedSpace = 0;
      for (const entry of entries) {
        if (freedSpace >= requiredSpace) break;
        localStorage.removeItem(entry.key);
        freedSpace += entry.size;
      }
    } catch (error) {
      console.warn('[CacheManager] Failed to evict entries:', error);
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Export types
export type { CacheConfig, CacheKey };


