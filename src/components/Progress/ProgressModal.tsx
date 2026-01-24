import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Globe, TrendingUp, X, Sparkles, BarChart3, Target, Zap } from 'lucide-react';
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
  onNavigateDashboard?: () => void;
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
  const { progress, lastUpdatedAt, lastError, consecutiveFailures, isComplete, isReadyForDashboard } = useOnboardingProgress(brandId);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [minTimePassed, setMinTimePassed] = useState(mode === 'modal');
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

  useEffect(() => {
    if (!brandId) return;
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, DASHBOARD_PREVIEW_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [brandId, fetchDashboardData]);

  useEffect(() => {
    if (mode !== 'fullpage') return;
    if (!minTimePassed || !isReadyForDashboard) return;
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
  }, [mode, minTimePassed, isReadyForDashboard, onNavigateDashboard]);

  const currentStage = useMemo<'collecting' | 'scoring' | 'recommendations' | 'finalizing'>(() => {
    if (progress?.stages?.collection?.status === 'completed') {
      if (progress?.stages?.scoring?.status === 'completed') {
        if (progress?.stages?.recommendations?.status === 'completed') {
          return 'finalizing';
        }
        return 'recommendations';
      }
      return 'scoring';
    }
    if (progress?.currentOperation) return progress.currentOperation as any;
    return 'collecting';
  }, [progress]);

  const progressBarValue = useMemo(() => {
    const totalQueries = progress?.queries?.total || progress?.stages?.collection?.total || 0;
    const completedQueries = progress?.queries?.completed || progress?.stages?.collection?.completed || 0;

    if (!totalQueries) {
      if (mode !== 'fullpage') return 5;
      return Math.min(90, (elapsedTime / (MINIMUM_DISPLAY_TIME_MS / 1000)) * 90);
    }

    let calculated = 0;
    const collectionProgress = (completedQueries / totalQueries) * 50;
    calculated = collectionProgress;

    if (progress?.stages?.collection?.status === 'completed') {
      if (progress?.stages?.scoring?.status === 'completed') {
        calculated = 80;
      } else if (progress?.stages?.scoring?.total) {
        const scoringProgress = (progress.stages.scoring.completed / progress.stages.scoring.total) * 30;
        calculated = 50 + scoringProgress;
      } else {
        calculated = 50;
      }

      if (progress?.stages?.scoring?.status === 'completed') {
        if (progress?.stages?.recommendations?.status === 'completed') {
          calculated = 100;
        } else if (progress?.stages?.recommendations?.status === 'active') {
          calculated = 90;
        } else {
          calculated = 80;
        }
      }
    }

    return Math.max(0, Math.min(100, calculated));
  }, [progress, mode, elapsedTime]);

  const showCountdown = mode === 'fullpage' && !minTimePassed;

  const lastProgressAtSecondsAgo = useMemo(() => {
    if (!lastUpdatedAt) return null;
    return Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
  }, [lastUpdatedAt]);

  const stages = [
    { id: 'collecting', label: 'Data', status: progress?.stages?.collection?.status },
    { id: 'scoring', label: 'Scoring', status: progress?.stages?.scoring?.status },
    { id: 'recommendations', label: 'Recs', status: progress?.stages?.recommendations?.status },
  ];

  const mainContent = (
    <motion.div 
      className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-6 md:p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-200 mb-4"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <Sparkles size={28} className="text-white" />
        </motion.div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          {mode === 'fullpage' ? 'Collecting your AI visibility data' : 'Data collection in progress'}
        </h1>
        <p className="text-gray-500">
          {brandName ? `Brand: ${brandName}` : 'Please wait while we gather and analyze your data in real-time.'}
        </p>
      </div>

      {/* Progress Section */}
      <div className="bg-gray-50 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-gray-900">Progress</span>
          <span className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            {Math.round(progressBarValue)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-3 rounded-full overflow-hidden bg-gray-200 mb-4">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressBarValue}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Stage Indicators */}
        <div className="flex justify-between text-xs font-medium">
          {stages.map((stage) => (
            <div 
              key={stage.id}
              className={`flex items-center gap-1.5 transition-colors ${
                stage.status === 'completed' ? 'text-green-600' :
                currentStage === stage.id ? 'text-cyan-600' :
                'text-gray-400'
              }`}
            >
              {stage.status === 'completed' ? (
                <CheckCircle2 size={14} />
              ) : (
                <div className={`w-2 h-2 rounded-full ${currentStage === stage.id ? 'bg-cyan-500 animate-pulse' : 'bg-gray-300'}`} />
              )}
              <span>{stage.label}</span>
            </div>
          ))}
        </div>

        {/* Query Details */}
        {(progress?.queries?.total || 0) > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">Queries Collected</span>
              <span className="text-sm font-semibold text-gray-900">
                {progress?.queries?.completed || 0} / {progress?.queries?.total || 0}
              </span>
            </div>
            {progress?.stages?.scoring && progress.stages.scoring.total > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Results Scored</span>
                <span className="text-sm font-semibold text-gray-900">
                  {progress.stages.scoring.completed} / {progress.stages.scoring.total}
                </span>
              </div>
            )}
            {/* <p className="text-xs text-gray-400 mt-3">
              {lastProgressAtSecondsAgo !== null ? `Last update: ${formatTime(lastProgressAtSecondsAgo)} ago` : 'Waiting for first progress update…'}
              {consecutiveFailures > 0 ? ` • Retries: ${consecutiveFailures}` : ''}
            </p> */}
          </div>
        )}
      </div>

      {/* Error Warning */}
      <AnimatePresence>
        {lastError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-800"
          >
            <p className="font-semibold text-sm mb-1">Progress updates are delayed</p>
            <p className="text-xs opacity-80">{lastError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Data Preview */}
      <motion.div 
        className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-cyan-400" />
          <span className="font-semibold text-white text-sm">Live Data Preview</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Share of Answer', value: dashboardData ? formatMetricValue(shareMetric, '%') : '—', icon: Target },
            { label: 'Visibility', value: dashboardData ? formatMetricValue(visibilityMetric, '') : '—', icon: TrendingUp },
            { label: 'Sentiment', value: dashboardData ? formatMetricValue(sentimentMetric, '') : '—', icon: Zap },
          ].map((metric) => (
            <div key={metric.label} className="text-center">
              <metric.icon size={16} className="mx-auto text-cyan-400 mb-2" />
              <p className="text-xs text-gray-400 mb-1">{metric.label}</p>
              <p className="text-xl font-bold text-white">{metric.value}</p>
            </div>
          ))}
        </div>
        {dashboardFetchError && (
          <p className="text-xs text-gray-500 text-center mt-4">{dashboardFetchError}</p>
        )}
      </motion.div>

      {/* Status Footer */}
      <div className="flex items-center justify-between text-sm">
        {mode === 'fullpage' ? (
          <div className="flex items-center gap-2 text-gray-500">
            <TrendingUp size={16} />
            <span>Elapsed: {formatTime(elapsedTime)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <TrendingUp size={16} />
            <span>{isComplete ? 'Complete' : isReadyForDashboard ? 'Scoring Complete' : 'In progress'}</span>
          </div>
        )}

        <div className={`flex items-center gap-2 ${showCountdown ? 'text-cyan-600 font-semibold' : 'text-gray-500'}`}>
          <Globe size={16} />
          <span>
            {showCountdown
              ? `Min. time: ${formatTime(Math.floor(timeRemaining))}`
              : isComplete
              ? 'Onboarding Complete!'
              : isReadyForDashboard
              ? (isRedirecting ? 'Redirecting…' : 'Scoring Complete')
              : 'Processing…'}
          </span>
        </div>
      </div>

      {/* CTA Button */}
      {mode === 'fullpage' && minTimePassed && !isRedirecting && onNavigateDashboard && (
        <motion.div 
          className="mt-6 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.button
            onClick={onNavigateDashboard}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-xl shadow-lg shadow-cyan-200 hover:shadow-xl transition-all"
          >
            Continue to Dashboard
          </motion.button>
        </motion.div>
      )}

      {mode === 'modal' && (
        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Completion Message */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 text-center"
          >
            <div className="inline-flex items-center gap-2 text-green-600 font-semibold">
              <CheckCircle2 size={18} />
              Onboarding complete
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isReadyForDashboard && !dashboardData && (
        <p className="mt-6 text-center text-sm text-gray-500">
          This may take a few minutes. We're collecting data from multiple AI sources…
        </p>
      )}
    </motion.div>
  );

  if (mode === 'fullpage') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-100/40 to-blue-100/40 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-100/30 to-teal-100/30 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity }}
          />
        </div>

        {/* Floating Logo */}
        <motion.div 
          className="absolute top-6 left-6 z-10"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-8 w-auto" />
        </motion.div>

        <div className="w-full max-w-3xl mx-auto relative z-10">
          {mainContent}
          {elapsedTime >= 2 && <FAQSection delay={2000} />}
        </div>
      </div>
    );
  }

  // Modal mode
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <motion.div 
        className="w-full max-w-3xl my-auto relative"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X size={20} />
        </button>
        {mainContent}
      </motion.div>
    </div>
  );
};
