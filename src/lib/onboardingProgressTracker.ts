import { apiClient } from './apiClient';

export type OnboardingProgressData = {
  queries: {
    total: number;
    completed: number;
    current?: string;
  };
  scoring: {
    positions: boolean;
    sentiments: boolean;
    citations: boolean;
  };
  currentOperation: 'collecting' | 'scoring' | 'finalizing' | 'domain_readiness' | 'recommendations';
  estimatedTimeRemaining?: number;
  stages?: {
    collection: {
      total: number;
      completed: number;
      status: 'pending' | 'active' | 'completed';
    };
    scoring: {
      total: number;
      completed: number;
      status: 'pending' | 'active' | 'completed';
    };
    domain_readiness: {
      status: 'pending' | 'active' | 'completed';
      last_run: string | null;
    };
    recommendations: {
      status: 'pending' | 'active' | 'completed';
      last_run: string | null;
    };
    finalization: {
      status: 'pending' | 'active' | 'completed';
    };
  };
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type OnboardingProgressSnapshot = {
  data: OnboardingProgressData | null;
  lastUpdatedAt: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  isComplete: boolean;
};

type Subscriber = (snapshot: OnboardingProgressSnapshot) => void;

type Tracker = {
  brandId: string;
  snapshot: OnboardingProgressSnapshot;
  subscribers: Set<Subscriber>;
  intervalId: ReturnType<typeof setInterval> | null;
  initialTimeoutId: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  abortController: AbortController | null;
};

const trackers = new Map<string, Tracker>();

const POLL_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 45000;

const computeIsComplete = (progress: OnboardingProgressData | null): boolean => {
  if (!progress) return false;

  const total = progress.queries?.total ?? 0;
  const completed = progress.queries?.completed ?? 0;
  const scoring = progress.scoring;

  // If no queries exist yet, not complete
  if (total === 0) return false;

  // If queries exist but not all collected, not complete
  if (completed < total) return false;

  // Check stages for more accurate completion detection
  const collectionStatus = progress.stages?.collection?.status;
  const scoringStatus = progress.stages?.scoring?.status;
  const recommendationsStatus = progress.stages?.recommendations?.status;

  // If using stages data, use it for more accurate completion check
  if (collectionStatus && scoringStatus) {
    // Collection, scoring, and recommendations must be completed
    // Note: domain_readiness is handled separately in the onboarding flow
    if (collectionStatus === 'completed' && scoringStatus === 'completed') {
      // Check if recommendations are also done
      if (recommendationsStatus === 'completed') {
        return true;
      }
      // If recommendations status is available but not complete, not done
      if (recommendationsStatus) {
        return false;
      }
      // Fallback: check legacy scoring flags if recommendations status not available
      if (scoring) {
        return Boolean(scoring.positions && scoring.sentiments && scoring.citations);
      }
      return true; // If stages say complete but no scoring object, trust stages
    }
    return false;
  }

  // Fallback to legacy scoring flags check
  if (!scoring) return false;
  return Boolean(scoring.positions && scoring.sentiments && scoring.citations);
};

const notify = (tracker: Tracker) => {
  for (const cb of tracker.subscribers) {
    try {
      cb(tracker.snapshot);
    } catch (e) {
      // Don't let a subscriber break polling.
      console.error('[onboardingProgressTracker] subscriber error', e);
    }
  }
};

const pollOnce = async (tracker: Tracker) => {
  if (tracker.inFlight) return;
  tracker.inFlight = true;

  if (tracker.abortController) {
    tracker.abortController.abort();
  }
  tracker.abortController = new AbortController();

  try {
    const resp = await apiClient.request<ApiResponse<OnboardingProgressData>>(
      `/brands/${tracker.brandId}/onboarding-progress`,
      { signal: tracker.abortController.signal },
      { requiresAuth: true, timeout: REQUEST_TIMEOUT_MS }
    );

    if (!resp?.success || !resp.data) {
      throw new Error(resp?.error || resp?.message || 'Failed to fetch progress');
    }

    tracker.snapshot = {
      data: resp.data,
      lastUpdatedAt: Date.now(),
      lastError: null,
      consecutiveFailures: 0,
      isComplete: computeIsComplete(resp.data),
    };
  } catch (err) {
    // Abort errors are expected when switching brands or overlapping polls.
    const isAbort =
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as any).name === 'AbortError';

    if (!isAbort) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch progress';
      tracker.snapshot = {
        ...tracker.snapshot,
        lastError: msg,
        consecutiveFailures: tracker.snapshot.consecutiveFailures + 1,
        isComplete: computeIsComplete(tracker.snapshot.data),
      };
    }
  } finally {
    tracker.inFlight = false;
    notify(tracker);
  }
};

const ensureRunning = (tracker: Tracker) => {
  if (tracker.intervalId) return;

  // Initial poll shortly after subscribe to avoid burst on mount.
  tracker.initialTimeoutId = setTimeout(() => {
    pollOnce(tracker).catch(() => void 0);
  }, 250);

  tracker.intervalId = setInterval(() => {
    pollOnce(tracker).catch(() => void 0);
  }, POLL_INTERVAL_MS);
};

const maybeStop = (tracker: Tracker) => {
  if (tracker.subscribers.size > 0) return;
  if (tracker.intervalId) {
    clearInterval(tracker.intervalId);
    tracker.intervalId = null;
  }
  if (tracker.initialTimeoutId) {
    clearTimeout(tracker.initialTimeoutId);
    tracker.initialTimeoutId = null;
  }
  if (tracker.abortController) {
    tracker.abortController.abort();
    tracker.abortController = null;
  }
  tracker.inFlight = false;
};

export const onboardingProgressTracker = {
  subscribe(brandId: string, cb: Subscriber): () => void {
    const existing = trackers.get(brandId);
    const tracker: Tracker =
      existing ??
      {
        brandId,
        snapshot: {
          data: null,
          lastUpdatedAt: null,
          lastError: null,
          consecutiveFailures: 0,
          isComplete: false,
        },
        subscribers: new Set(),
        intervalId: null,
        initialTimeoutId: null,
        inFlight: false,
        abortController: null,
      };

    if (!existing) trackers.set(brandId, tracker);

    tracker.subscribers.add(cb);
    ensureRunning(tracker);

    // Immediately push current snapshot.
    cb(tracker.snapshot);

    return () => {
      tracker.subscribers.delete(cb);
      maybeStop(tracker);
    };
  },

  getSnapshot(brandId: string): OnboardingProgressSnapshot {
    return (
      trackers.get(brandId)?.snapshot ?? {
        data: null,
        lastUpdatedAt: null,
        lastError: null,
        consecutiveFailures: 0,
        isComplete: false,
      }
    );
  },
};


