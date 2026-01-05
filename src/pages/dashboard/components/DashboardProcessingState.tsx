import { useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from '../../../components/Layout/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Sparkles, 
  Search, 
  BrainCircuit,
  Database,
  ArrowRight
} from 'lucide-react';
import { apiClient } from '../../../lib/apiClient';
import { getDefaultDateRange, formatMetricValue } from '../utils';
import type { ApiResponse, DashboardPayload, DashboardScoreMetric } from '../types';

interface DashboardProcessingStateProps {
  progressData: {
    stages?: {
      collection: { total: number; completed: number; status: 'pending' | 'active' | 'completed' };
      scoring: { total: number; completed: number; status: 'pending' | 'active' | 'completed' };
      finalization: { status: 'pending' | 'active' | 'completed' };
    };
    queries: { total: number; completed: number };
    scoring: { positions: boolean; sentiments: boolean; citations: boolean };
    currentOperation: 'collecting' | 'scoring' | 'finalizing';
  } | null;
  brandName?: string;
  brandId?: string;
  onMinimize?: () => void;
}

const TIPS = [
  "Evidently analyzes multiple AI models including ChatGPT, Claude, and Perplexity to benchmark your brand.",
  "AEO (Answer Engine Optimization) focuses on being the direct answer, not just a link on a page.",
  "We track sentiment analysis to understand how AI models 'feel' about your brand.",
  "You can compare your visibility directly against competitors in the dashboard.",
  "Citations are key to AEO. We track which sources AI models are using to define your brand."
];

export const DashboardProcessingState = ({ progressData, brandName, brandId, onMinimize }: DashboardProcessingStateProps) => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [hasShownInitialData, setHasShownInitialData] = useState(false);
  const [dashboardFetchError, setDashboardFetchError] = useState<string | null>(null);
  const defaultDateRange = useRef(getDefaultDateRange());
  const dashboardFetchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Find score metrics helper (same as dashboard)
  const findScore = (label: string, data: typeof dashboardData): DashboardScoreMetric | undefined =>
    data?.scores?.find((metric) => metric.label.toLowerCase() === label.toLowerCase());

  const visibilityMetric = findScore('Visibility Index', dashboardData);
  const shareMetric = findScore('Share of Answers', dashboardData);
  const sentimentMetric = findScore('Sentiment Score', dashboardData);

  // Fetch dashboard data using same API and date range as loading screen
  const fetchDashboardData = useCallback(async () => {
    if (!brandId) return;

    try {
      const { start, end } = defaultDateRange.current;
      const endpoint = `/brands/${brandId}/dashboard?startDate=${start}&endDate=${end}&skipCache=true&cacheBust=${Date.now()}`;
      const data = await apiClient.request<ApiResponse<DashboardPayload>>(
        endpoint,
        {},
        { requiresAuth: true, timeout: 30000 }
      );

      if (data.success && data.data) {
        if (data.data.brandId && data.data.brandId !== brandId) {
          return;
        }
        setDashboardData(data.data);
        setHasShownInitialData(true);
        setDashboardFetchError(null);
      } else {
        console.warn('[DashboardProcessingState] Dashboard response not successful');
        setDashboardFetchError('Dashboard data not available yet');
      }
    } catch (error) {
      console.error('[DashboardProcessingState] Error fetching dashboard data:', error);
      setDashboardFetchError(error instanceof Error ? error.message : 'Failed to fetch dashboard data');
    }
  }, [brandId]);

  // Poll for dashboard data updates every 15 seconds (same as loading screen)
  // Note: Progress data is polled separately by useDashboardData hook (every 5 seconds)
  // This ensures progress updates continue even when this modal is minimized
  useEffect(() => {
    if (!brandId) return;

    // Immediate fetch if scoring has started or completed
    const shouldFetchImmediately = 
      progressData?.stages?.scoring?.status === 'active' ||
      progressData?.stages?.scoring?.status === 'completed' ||
      progressData?.currentOperation === 'scoring' ||
      progressData?.currentOperation === 'finalizing';

    if (shouldFetchImmediately) {
      // Fetch immediately if scoring is in progress or done
      fetchDashboardData();
    } else {
      // Otherwise wait 2 seconds before first fetch
      const initialTimeout = setTimeout(() => {
        fetchDashboardData();
      }, 2000);

      return () => {
        clearTimeout(initialTimeout);
      };
    }

    // Then poll every 15 seconds to update KPI preview
    dashboardFetchIntervalRef.current = setInterval(() => {
      fetchDashboardData();
    }, 15000);

    return () => {
      if (dashboardFetchIntervalRef.current) {
        clearInterval(dashboardFetchIntervalRef.current);
        dashboardFetchIntervalRef.current = null;
      }
    };
  }, [brandId, fetchDashboardData, progressData?.stages?.scoring?.status, progressData?.currentOperation]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const stages = progressData?.stages || {
    collection: { 
      total: progressData?.queries.total || 1, 
      completed: progressData?.queries.completed || 0, 
      status: progressData?.currentOperation === 'collecting' ? 'active' : 'completed'
    },
    scoring: { 
      total: progressData?.queries.total || 1, 
      completed: 0, // Fallback doesn't have granular scoring count
      status: progressData?.currentOperation === 'scoring' ? 'active' : (progressData?.currentOperation === 'finalizing' ? 'completed' : 'pending')
    },
    finalization: { 
      status: progressData?.currentOperation === 'finalizing' ? 'active' : 'pending'
    }
  };

  const calculatePercentage = (completed: number, total: number) => {
    if (total === 0) return 0;
    return Math.min(100, Math.round((completed / total) * 100));
  };

  const steps = [
    {
      id: 'collection',
      label: 'Data Collection',
      icon: Search,
      status: stages.collection.status,
      progress: calculatePercentage(stages.collection.completed, stages.collection.total),
      detail: `${stages.collection.completed} / ${stages.collection.total} queries collected`
    },
    {
      id: 'scoring',
      label: 'Score Calculation',
      icon: BrainCircuit,
      status: stages.scoring.status,
      progress: calculatePercentage(stages.scoring.completed, stages.scoring.total),
      detail: stages.scoring.status === 'pending' ? 'Waiting for data...' : 
              stages.scoring.status === 'completed' ? 'Analysis complete' :
              `${stages.scoring.completed} / ${stages.scoring.total} analyzed`
    },
    {
      id: 'finalization',
      label: 'Data Finalization',
      icon: Database,
      status: stages.finalization.status,
      progress: stages.finalization.status === 'completed' ? 100 : (stages.finalization.status === 'active' ? 50 : 0),
      detail: stages.finalization.status === 'active' ? 'Caching & Preloading...' : 'Preparing dashboard...'
    }
  ];

  return (
    <Layout>
      <div className="p-8 min-h-screen bg-[var(--bg-secondary)] flex flex-col items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-[var(--primary200)]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#00bcdc] to-[#0096b0] p-8 text-white text-center relative overflow-hidden">
            <motion.div 
              className="absolute inset-0 bg-white/10"
              animate={{ 
                backgroundPosition: ['0% 0%', '100% 100%'],
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ backgroundSize: '200% 200%' }}
            />
            <div className="relative z-10">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full mx-auto mb-6"
              />
              <h1 className="text-2xl font-bold mb-2">
                Setting up dashboard for {brandName || 'your brand'}
              </h1>
              <p className="text-white/80">
                Please wait while we gather and analyze your data in real-time.
              </p>
              {onMinimize && (
                <button 
                  onClick={onMinimize}
                  className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all text-sm font-medium flex items-center gap-2"
                >
                  Minimize <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Progress Section */}
          <div className="p-8">
            <div className="space-y-8">
              {steps.map((step) => (
                <div key={step.id} className="relative">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                      step.status === 'completed' 
                        ? 'bg-[#00bcdc] border-[#00bcdc] text-white scale-110'
                        : step.status === 'active'
                          ? 'bg-white border-[#00bcdc] text-[#00bcdc] shadow-lg shadow-blue-100'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                      {step.status === 'completed' ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <step.icon size={20} className={step.status === 'active' ? 'animate-pulse' : ''} />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className={`font-semibold text-lg ${
                          step.status === 'pending' ? 'text-gray-400' : 'text-gray-900'
                        }`}>
                          {step.label}
                        </h3>
                        <span className={`text-sm font-medium ${
                          step.status === 'active' ? 'text-[#00bcdc]' : 'text-gray-500'
                        }`}>
                          {step.status === 'completed' ? '100%' : `${step.progress}%`}
                        </span>
                      </div>
                      
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden w-full relative">
                        <motion.div 
                          className={`h-full rounded-full ${
                            step.status === 'completed' ? 'bg-[#00bcdc]' : 
                            step.status === 'active' ? 'bg-[#00bcdc]' : 'bg-gray-200'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${step.progress}%` }}
                          transition={{ type: "spring", stiffness: 50, damping: 15 }}
                        />
                        {step.status === 'active' && (
                          <motion.div 
                            className="absolute top-0 left-0 bottom-0 right-0 bg-white/30"
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          />
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                        {step.status === 'active' && <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#00bcdc]" />}
                        {step.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Available Data Section - Always show when scoring has started */}
            {(progressData?.stages?.scoring?.status === 'active' || 
              progressData?.stages?.scoring?.status === 'completed' ||
              progressData?.currentOperation === 'scoring' ||
              progressData?.currentOperation === 'finalizing' ||
              hasShownInitialData) && (
              <div className="mt-8 rounded-lg p-4 bg-gray-50 border border-gray-200">
                <p className="font-semibold mb-3 text-sm text-gray-900">Available Data</p>
                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                  {/* Share of Answer */}
                  <div className="rounded-lg p-3 bg-white shadow-sm">
                    <p className="text-xs mb-1 text-gray-600">Share of Answer</p>
                    <p className="font-bold text-lg text-gray-900">
                      {dashboardData ? formatMetricValue(shareMetric, '%') : '—'}
                    </p>
                  </div>
                  {/* Visibility */}
                  <div className="rounded-lg p-3 bg-white shadow-sm">
                    <p className="text-xs mb-1 text-gray-600">Visibility</p>
                    <p className="font-bold text-lg text-gray-900">
                      {dashboardData ? formatMetricValue(visibilityMetric, '') : '—'}
                    </p>
                  </div>
                  {/* Sentiment */}
                  <div className="rounded-lg p-3 bg-white shadow-sm">
                    <p className="text-xs mb-1 text-gray-600">Sentiment</p>
                    <p className="font-bold text-lg text-gray-900">
                      {dashboardData ? formatMetricValue(sentimentMetric, '') : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-xs mt-3 text-center text-gray-500">
                  {!dashboardData && !dashboardFetchError
                    ? 'Loading dashboard data...'
                    : dashboardFetchError
                    ? `Unable to load data: ${dashboardFetchError}`
                    : progressData?.currentOperation === 'finalizing' || 
                      (progressData?.stages?.finalization?.status === 'completed')
                    ? 'Data is being finalized. Dashboard will update shortly.'
                    : 'You can minimize this and continue exploring while collection finishes in the background.'}
                </p>
                {dashboardFetchError && (
                  <div className="mt-2 rounded p-2 text-xs bg-amber-50 border border-amber-200 text-amber-800">
                    <div className="opacity-90">We'll keep trying to fetch the latest data.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tips Section */}
          <div className="bg-gray-50 p-6 border-t border-gray-100">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Did you know?</h4>
                <div className="h-12 relative overflow-hidden">
                  <AnimatePresence mode='wait'>
                    <motion.p
                      key={currentTipIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-sm text-gray-600 absolute w-full"
                    >
                      {TIPS[currentTipIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};
