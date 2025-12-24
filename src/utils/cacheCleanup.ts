/**
 * Cache Cleanup Utilities
 * 
 * Utilities for clearing cached data when encountering issues with deleted brands
 * or stale data in the application.
 * 
 * Usage:
 * 1. Import in browser console: window.clearBrandCache()
 * 2. Or call programmatically from the app
 */

import { cacheManager } from '../lib/cacheManager';
import { invalidateCache } from '../lib/apiCache';

/**
 * Clear the selected brand from localStorage
 * This is useful when the stored brand ID no longer exists in the database
 */
export function clearSelectedBrand(): void {
  try {
    localStorage.removeItem('manual-dashboard:selected-brand');
    console.log('✅ Cleared selected brand from localStorage');
  } catch (error) {
    console.error('❌ Failed to clear selected brand:', error);
  }
}

/**
 * Clear all brand-related cache entries
 * This includes the brands list and any dashboard data
 */
export function clearBrandCache(): void {
  try {
    // Clear brands list cache
    invalidateCache('/brands');
    
    // Clear dashboard cache for all brands
    invalidateCache(/\/dashboard/);
    
    // Clear selected brand from localStorage
    clearSelectedBrand();
    
    console.log('✅ Cleared all brand-related cache');
  } catch (error) {
    console.error('❌ Failed to clear brand cache:', error);
  }
}

/**
 * Clear cache for a specific brand
 * Useful when you know a specific brand was deleted or modified
 * 
 * @param brandId - The ID of the brand to clear cache for
 */
export function clearBrandDataCache(brandId: string): void {
  try {
    // Clear dashboard cache for this brand
    invalidateCache(new RegExp(`/brands/${brandId}/`));
    
    // If this was the selected brand, clear it
    const selectedBrand = localStorage.getItem('manual-dashboard:selected-brand');
    if (selectedBrand === brandId) {
      clearSelectedBrand();
    }
    
    console.log(`✅ Cleared cache for brand: ${brandId}`);
  } catch (error) {
    console.error(`❌ Failed to clear cache for brand ${brandId}:`, error);
  }
}

/**
 * Clear all API cache
 * This is a nuclear option - clears everything
 */
export function clearAllCache(): void {
  try {
    cacheManager.clear();
    console.log('✅ Cleared all API cache');
  } catch (error) {
    console.error('❌ Failed to clear all cache:', error);
  }
}

/**
 * Full cleanup - clears everything and reloads the page
 * This is the recommended solution when encountering persistent issues
 */
export function fullCleanup(): void {
  clearBrandCache();
  clearAllCache();
  
  console.log('✅ Full cleanup complete. Reloading page...');
  
  // Reload after a short delay to ensure cleanup is complete
  setTimeout(() => {
    window.location.reload();
  }, 500);
}

/**
 * Get diagnostic information about current cache state
 * Useful for debugging cache issues
 */
export function getCacheDiagnostics(): {
  selectedBrand: string | null;
  localStorageKeys: string[];
  cacheSize: number;
} {
  const selectedBrand = localStorage.getItem('manual-dashboard:selected-brand');
  
  // Get all localStorage keys
  const localStorageKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      localStorageKeys.push(key);
    }
  }
  
  return {
    selectedBrand,
    localStorageKeys,
    cacheSize: localStorageKeys.length,
  };
}

// Expose utilities to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).clearBrandCache = clearBrandCache;
  (window as any).clearSelectedBrand = clearSelectedBrand;
  (window as any).clearBrandDataCache = clearBrandDataCache;
  (window as any).clearAllCache = clearAllCache;
  (window as any).fullCleanup = fullCleanup;
  (window as any).getCacheDiagnostics = getCacheDiagnostics;
}

/**
 * BROWSER CONSOLE USAGE:
 * 
 * Quick fixes for common issues:
 * 
 * 1. Clear selected brand (404 error for deleted brand):
 *    clearSelectedBrand()
 * 
 * 2. Clear all brand cache:
 *    clearBrandCache()
 * 
 * 3. Clear cache for specific brand:
 *    clearBrandDataCache('brand-id-here')
 * 
 * 4. Full cleanup and reload:
 *    fullCleanup()
 * 
 * 5. Get diagnostics:
 *    getCacheDiagnostics()
 */

