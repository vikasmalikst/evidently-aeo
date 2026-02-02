import { useEffect, useMemo, useState } from 'react';
import {
  onboardingProgressTracker,
  type OnboardingProgressSnapshot,
} from '../lib/onboardingProgressTracker';

export const useOnboardingProgress = (brandId: string | null | undefined, enabled: boolean = true) => {
  const [snapshot, setSnapshot] = useState<OnboardingProgressSnapshot>(() => ({
    data: null,
    lastUpdatedAt: null,
    lastError: null,
    consecutiveFailures: 0,
    isComplete: false,
    isReadyForDashboard: false,
  }));

  useEffect(() => {
    if (!brandId || !enabled) {
      setSnapshot({
        data: null,
        lastUpdatedAt: null,
        lastError: null,
        consecutiveFailures: 0,
        isComplete: false,
        isReadyForDashboard: false,
      });
      return;
    }

    return onboardingProgressTracker.subscribe(brandId, setSnapshot);
  }, [brandId, enabled]);

  return useMemo(
    () => ({
      ...snapshot,
      progress: snapshot.data,
    }),
    [snapshot]
  );
};
