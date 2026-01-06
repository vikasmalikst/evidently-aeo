import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Globe, TrendingUp, X } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import type { DashboardPayload, DashboardScoreMetric } from '../../pages/dashboard/types';
import { formatMetricValue, getDefaultDateRange } from '../../pages/dashboard/utils';
import evidentlyLogo from '../../assets/logo.png';
import { FAQSection } from './FAQSection';

interface ProgressModalProps {
  brandId: string;
  brandName?: string;
  mode: 'fullpage' | 'modal';
  /**
   * Called when we should navigate to dashboard (manual "Continue" or auto-redirect).
   * In the new UX, this should minimize into bell + redirect.
   */
  onNavigateDashboard?: () => void;
  /** Only used in modal mode */
  onClose?: () => void;
}

const MINIMUM_DISPLAY_TIME_MS = 60000;
const DASHBOARD_PREVIEW_REFRESH_INTERVAL_MS = 15000;

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ProgressModal = ({ brandId, brandName, mode, onNavigateDashboard, onClose }: ProgressModalProps) => {
  const defaultDateRange = useRef(getDefaultDateRange());
  const { progress, lastUpdatedAt, lastError, consecutiveFailures, isComplete } = useOnboardingProgress(brandId);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [minTimePassed, setMinTimePassed] = useState(mode === 'modal'); // modal should not gate UX
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [dashboardFetchError, setDashboardFetchError] = useState<string | null>(null);
  const redirectScheduledRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Elapsed timer (fullpage mode only)
  useEffect(() => {
    if (mode !== 'fullpage') return;
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'fullpage') return;
    if (elapsedTime * 1000 >= MINIMUM_DISPLAY_TIME_MS) {
      setMinTimePassed(true);
    }
  }, [mode, elapsedTime]);

  const timeRemaining = useMemo(() => {
    if (mode !== 'fullpage') return 0;
    const remaining = Math.max(0, Math.ceil((MINIMUM_DISPLAY_TIME_MS - elapsedTime * 1000) / 1000));
    return remaining;
  }, [mode, elapsedTime]);

  const findScore = (label: string, data: typeof dashboardData): DashboardScoreMetric | undefined =>
    data?.scores?.find((metric) => metric.label.toLowerCase() === label.toLowerCase());

  const visibilityMetric = findScore('Visibility Index', dashboardData);
  const shareMetric = findScore('Share of Answers', dashboardData);
  const sentimentMetric = findScore('Sentiment Score', dashboardData);

  const fetchDashboardData = useCallback(async () => {
    try {
      const { start, end } = defaultDateRange.current;
      const endpoint = `/brands/${brandId}/dashboard?startDate=${start}&endDate=${end}&skipCache=true&cacheBust=${Date.now()}`;
      const data = await apiClient.request<{ success: boolean; data?: DashboardPayload; error?: string; message?: string }>(
        endpoint,
        {},
        { requiresAuth: true, timeout: 30000 }
      );

      if (data.success && data.data) {
        setDashboardData(data.data);
        setDashboardFetchError(null);
      } else {
        setDashboardFetchError(data.error || data.message || 'Dashboard preview not available yet.');
      }
    } catch (error) {
      setDashboardFetchError(error instanceof Error ? error.message : 'Failed to fetch dashboard preview.');
    }
  }, [brandId]);

  // Dashboard preview polling (both modes) - fetch immediately, no delay
  useEffect(() => {
    if (!brandId) return;
    // Fetch immediately on mount
    fetchDashboardData();
    // Then poll at regular intervals
    const interval = setInterval(fetchDashboardData, DASHBOARD_PREVIEW_REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [brandId, fetchDashboardData]);

  // Auto-redirect behavior (fullpage only): after min time AND completion.
  useEffect(() => {
    if (mode !== 'fullpage') return;
    if (!minTimePassed || !isComplete) return;
    if (redirectScheduledRef.current) return;
    if (!onNavigateDashboard) return;

    redirectScheduledRef.current = true;
    setIsRedirecting(true);

    redirectTimerRef.current = setTimeout(() => {
      onNavigateDashboard();
    }, 2000);

    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [mode, minTimePassed, isComplete, onNavigateDashboard]);

  const currentStage = useMemo<'collecting' | 'scoring' | 'finalizing'>(() => {
    if (progress?.stages?.collection?.status === 'completed') {
      if (progress?.stages?.scoring?.status === 'completed') return 'finalizing';
      return 'scoring';
    }
    if (progress?.currentOperation) return progress.currentOperation;
    return 'collecting';
  }, [progress]);

  const progressBarValue = useMemo(() => {
    const totalQueries = progress?.queries?.total || progress?.stages?.collection?.total || 0;
    const completedQueries = progress?.queries?.completed || progress?.stages?.collection?.completed || 0;

    if (!totalQueries) {
      // If no data yet, use time-based animation in fullpage mode
      if (mode !== 'fullpage') return 5;
      return Math.min(90, (elapsedTime / (MINIMUM_DISPLAY_TIME_MS / 1000)) * 90);
    }

    let calculated = 0;
    const collectionProgress = (completedQueries / totalQueries) * 70;
    calculated = collectionProgress;

    if (progress?.stages?.collection?.status === 'completed') {
      if (progress?.stages?.scoring?.status === 'completed') {
        calculated = 100;
      } else if (progress?.stages?.scoring?.total) {
        const scoringProgress = (progress.stages.scoring.completed / progress.stages.scoring.total) * 25;
        calculated = 70 + scoringProgress;
      } else {
        calculated = 75;
      }
    }

    return Math.max(0, Math.min(100, calculated));
  }, [progress, mode, elapsedTime]);

  const showCountdown = mode === 'fullpage' && !minTimePassed;

  const lastProgressAtSecondsAgo = useMemo(() => {
    if (!lastUpdatedAt) return null;
    return Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
  }, [lastUpdatedAt]);

  const headerContent = (
    <div className="text-center mb-6">
      <div className="flex justify-center mb-4">
        <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-10 w-10 object-contain" />
      </div>
      <h1 className="text-xl md:text-2xl font-bold mb-2 px-4 break-words" style={{ color: '#1a1d29' }}>
        {mode === 'fullpage' ? 'Collecting your AI visibility data' : 'Data collection in progress'}
      </h1>
      <p className="text-sm px-4" style={{ color: '#64748b' }}>
        {brandName ? `Brand: ${brandName}` : 'Please wait while we gather and analyze your data in real-time.'}
      </p>
    </div>
  );

  const mainContent = (
    <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#e8e9ed' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold" style={{ color: '#1a1d29' }}>
            Progress
          </div>
          <div className="text-sm font-semibold" style={{ color: '#1a1d29' }}>
            {Math.round(progressBarValue)}%
          </div>
        </div>

        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#e8e9ed' }}>
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressBarValue}%`, backgroundColor: '#00bcdc' }}
          />
        </div>

        <div className="flex justify-between mt-2 text-[12px]" style={{ color: '#64748b' }}>
          <span className={currentStage === 'collecting' ? 'font-medium' : ''} style={currentStage === 'collecting' ? { color: '#00bcdc' } : {}}>
            {currentStage === 'collecting' ? '● Collecting' : '✓ Collecting'}
          </span>
          <span className={currentStage === 'scoring' ? 'font-medium' : ''} style={currentStage === 'scoring' ? { color: '#00bcdc' } : {}}>
            {currentStage === 'scoring' ? '● Scoring' : currentStage === 'finalizing' ? '● Scoring' : 'Scoring'}
          </span>
        </div>

        {/* Backend Progress Details */}
        {(progress?.queries?.total || 0) > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[12px]" style={{ color: '#64748b' }}>Queries Collected</span>
              <span className="text-[12px] font-semibold" style={{ color: '#1a1d29' }}>
                {progress?.queries?.completed || progress?.stages?.collection?.completed || 0} / {progress?.queries?.total || progress?.stages?.collection?.total || 0}
              </span>
            </div>
            {progress?.stages?.scoring && progress.stages.scoring.total > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[12px]" style={{ color: '#64748b' }}>Results Scored</span>
                <span className="text-[12px] font-semibold" style={{ color: '#1a1d29' }}>
                  {progress.stages.scoring.completed} / {progress.stages.scoring.total}
                </span>
              </div>
            )}

            <div className="mt-3 text-[11px]" style={{ color: '#64748b' }}>
              {lastProgressAtSecondsAgo !== null ? `Last update: ${formatTime(lastProgressAtSecondsAgo)} ago` : 'Waiting for first progress update…'}
              {consecutiveFailures > 0 ? ` • Retries: ${consecutiveFailures}` : ''}
            </div>
          </div>
        )}

        {lastError && (
          <div className="mt-4 rounded-lg p-3 text-[12px]" style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' }}>
            <div className="font-semibold mb-1">Progress updates are delayed</div>
            <div className="opacity-90">{lastError}</div>
            <div className="opacity-80 mt-1">We’ll keep retrying in the background.</div>
          </div>
        )}

        {/* Available Data - Always show (loads immediately, no delay) */}
        <div className="mt-6 rounded-lg p-4" style={{ backgroundColor: '#f9f9fb', border: '1px solid #e8e9ed' }}>
          <p className="font-semibold mb-3 text-[13px]" style={{ color: '#1a1d29' }}>Available Data</p>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div className="rounded-lg p-2" style={{ backgroundColor: '#ffffff' }}>
              <p className="text-[12px] mb-1" style={{ color: '#64748b' }}>Share of Answer</p>
              <p className="font-bold text-base" style={{ color: '#1a1d29' }}>
                {dashboardData ? formatMetricValue(shareMetric, '%') : '—'}
              </p>
            </div>
            <div className="rounded-lg p-2" style={{ backgroundColor: '#ffffff' }}>
              <p className="text-[12px] mb-1" style={{ color: '#64748b' }}>Visibility</p>
              <p className="font-bold text-base" style={{ color: '#1a1d29' }}>
                {dashboardData ? formatMetricValue(visibilityMetric, '') : '—'}
              </p>
            </div>
            <div className="rounded-lg p-2" style={{ backgroundColor: '#ffffff' }}>
              <p className="text-[12px] mb-1" style={{ color: '#64748b' }}>Sentiment</p>
              <p className="font-bold text-base" style={{ color: '#1a1d29' }}>
                {dashboardData ? formatMetricValue(sentimentMetric, '') : '—'}
              </p>
            </div>
          </div>

          {dashboardFetchError && (
            <div className="mt-3 rounded-lg p-3 text-[12px]" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
              <div className="font-semibold mb-1">Dashboard preview not available yet</div>
              <div className="opacity-90">{dashboardFetchError}</div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-[13px] border-t pt-6 mt-6" style={{ borderColor: '#e8e9ed' }}>
          {mode === 'fullpage' ? (
            <div className="flex items-center gap-2" style={{ color: '#64748b' }}>
              <TrendingUp className="w-4 h-4" />
              <span>Elapsed: {formatTime(elapsedTime)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2" style={{ color: '#64748b' }}>
              <TrendingUp className="w-4 h-4" />
              <span>{isComplete ? 'Complete' : 'In progress'}</span>
            </div>
          )}

          <div className="flex items-center gap-2" style={{ color: showCountdown ? '#00bcdc' : '#64748b' }}>
            <Globe className="w-4 h-4" />
            <span className={showCountdown ? 'font-semibold' : ''}>
              {showCountdown
                ? `Min. time remaining: ${formatTime(Math.floor(timeRemaining))}`
                : isComplete
                ? (isRedirecting ? 'Redirecting…' : 'Complete!')
                : lastError
                ? 'Progress delayed (retrying…)'
                : 'Processing…'}
            </span>
          </div>
        </div>

        {mode === 'fullpage' && minTimePassed && !isRedirecting && onNavigateDashboard && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={onNavigateDashboard}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: '#1a1d29', color: '#ffffff' }}
            >
              Continue to Dashboard
            </button>
          </div>
        )}

        {mode === 'modal' && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: '#1a1d29', color: '#ffffff' }}
            >
              Close
            </button>
          </div>
        )}

        {!isComplete && !dashboardData && (
          <div className="mt-6 text-center">
            <p className="text-[13px]" style={{ color: '#64748b' }}>
              This may take a few minutes. We're collecting and analyzing data from multiple AI sources…
            </p>
          </div>
        )}

        {isComplete && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#16a34a' }}>
              <CheckCircle2 className="w-4 h-4" />
              Collection & scoring complete
            </div>
          </div>
        )}
      </div>
  );

  if (mode === 'fullpage') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f9f9fb' }}>
        <div className="w-full max-w-3xl mx-auto">
          {headerContent}
          {mainContent}
          {/* FAQ Section - Only in fullpage mode, show after 2 seconds */}
          {elapsedTime >= 2 && <FAQSection delay={2000} />}
        </div>
      </div>
    );
  }

  // Modal mode (overlay with blurred backdrop)
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl my-auto">
        <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close progress modal"
            style={{ color: '#64748b' }}
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Content with proper padding */}
          <div className="p-6 pt-8">
            {headerContent}
            {mainContent}
          </div>
        </div>
      </div>
    </div>
  );
};


