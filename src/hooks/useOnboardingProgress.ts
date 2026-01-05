import { useEffect, useMemo, useState } from 'react';
import {
  onboardingProgressTracker,
  type OnboardingProgressSnapshot,
} from '../lib/onboardingProgressTracker';

export const useOnboardingProgress = (brandId: string | null | undefined) => {
  const [snapshot, setSnapshot] = useState<OnboardingProgressSnapshot>(() => ({
    data: null,
    lastUpdatedAt: null,
    lastError: null,
    consecutiveFailures: 0,
    isComplete: false,
  }));

  useEffect(() => {
    if (!brandId) {
      setSnapshot({
        data: null,
        lastUpdatedAt: null,
        lastError: null,
        consecutiveFailures: 0,
        isComplete: false,
      });
      return;
    }

    return onboardingProgressTracker.subscribe(brandId, setSnapshot);
  }, [brandId]);

  return useMemo(
    () => ({
      ...snapshot,
      progress: snapshot.data,
    }),
    [snapshot]
  );
};


