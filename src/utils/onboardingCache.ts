import type { OnboardingBrand, OnboardingCompetitor } from '../types/onboarding';

const CACHE_KEY = 'onboarding_progress_cache';
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface CachedOnboardingData {
  timestamp: number;
  step: 'brand' | 'competitors' | 'summary';
  brand: OnboardingBrand | null;
  competitors: OnboardingCompetitor[];
  allCompetitors: OnboardingCompetitor[];
  selectedCompetitorDomains: string[]; // Convert Set to Array for JSON storage
  brandInput: string;
}

export const onboardingCache = {
  save: (data: Omit<CachedOnboardingData, 'timestamp'>) => {
    try {
      const cacheData: CachedOnboardingData = {
        ...data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log('💾 Onboarding progress saved to cache');
    } catch (error) {
      console.error('Failed to save onboarding cache:', error);
    }
  },

  load: (): Omit<CachedOnboardingData, 'timestamp'> | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached) as CachedOnboardingData;
      const age = Date.now() - data.timestamp;

      if (age > CACHE_DURATION_MS) {
        console.log('⚠️ Onboarding cache expired');
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      console.log('📂 Onboarding progress loaded from cache');
      return {
        step: data.step,
        brand: data.brand,
        competitors: data.competitors,
        allCompetitors: data.allCompetitors,
        selectedCompetitorDomains: data.selectedCompetitorDomains,
        brandInput: data.brandInput,
      };
    } catch (error) {
      console.error('Failed to load onboarding cache:', error);
      return null;
    }
  },

  clear: () => {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Onboarding cache cleared');
  },
};
