import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, TrendingUp, Globe } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import type { ApiResponse, DashboardPayload } from '../../pages/dashboard/types';
import evidentlyLogo from '../../assets/logo.png';

export const DataCollectionLoadingScreenRoute = () => {
  const { brandId } = useParams<{ brandId: string }>();
  if (!brandId) return <div>Invalid brand ID</div>;
  return <DataCollectionLoadingScreen brandId={brandId} />;
};

interface ProgressData {
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
  currentOperation: 'collecting' | 'scoring' | 'finalizing';
  estimatedTimeRemaining?: number; // in seconds
}

interface DataCollectionLoadingScreenProps {
  brandId: string;
}

// Configurable polling intervals (in milliseconds)
// Can be overridden via Vite environment variables: VITE_LOADING_INITIAL_DELAY_MS and VITE_LOADING_UPDATE_INTERVAL_MS
const getEnvVar = (key: string, defaultValue: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  return defaultValue;
};

const INITIAL_UPDATE_DELAY = parseInt(
  getEnvVar('VITE_LOADING_INITIAL_DELAY_MS', '60000'),
  10
); // default to 60 seconds (can override via env)

export const DataCollectionLoadingScreen = ({ brandId }: DataCollectionLoadingScreenProps) => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressData>({
    queries: { total: 0, completed: 0 },
    scoring: {
      positions: false,
      sentiments: false,
      citations: false,
    },
    currentOperation: 'collecting',
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [hasShownInitialData, setHasShownInitialData] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [currentStage, setCurrentStage] = useState<'collecting' | 'scoring'>('collecting');
  const [progressBarValue, setProgressBarValue] = useState(0);

  // Fetch dashboard data to show after initial delay
  const fetchDashboardData = useCallback(async () => {
    try {
      // Ensure we're fetching data for the correct brand
      if (!brandId) {
        console.warn('[LoadingScreen] No brandId provided, cannot fetch dashboard data');
        return;
      }
      
      const endpoint = `/brands/${brandId}/dashboard?skipCache=true&cacheBust=${Date.now()}`;
      const data = await apiClient.request<ApiResponse<DashboardPayload>>(endpoint, {}, { requiresAuth: true });

      if (data.success && data.data) {
        if (data.data.brandId && data.data.brandId !== brandId) {
          return;
        }
        setDashboardData(data.data);
        setHasShownInitialData(true);
      } else {
        console.warn('[LoadingScreen] Dashboard response not successful');
      }
    } catch (error) {
      console.error('[LoadingScreen] Error fetching dashboard data:', error);
    }
  }, [brandId]);

  // Fetch dashboard data first (at ~20 seconds), then redirect at 25 seconds
  useEffect(() => {
    if (!brandId) return;
    
    // Fetch dashboard data shortly before redirect to warm cache
    const preFetchTimer = setTimeout(() => {
      fetchDashboardData();
    }, Math.max(0, INITIAL_UPDATE_DELAY - 5000)); // 5 seconds before redirect

    // Navigate to dashboard after configured delay
    const navigateTimer = setTimeout(() => {
      // Store flag that we're showing partial data
      localStorage.setItem(`data_collection_in_progress_${brandId}`, 'true');
      // Pass brandId in navigation state so dashboard can auto-select it
      const currentBrandId = brandId;
      navigate('/dashboard', { 
        replace: true,
        state: { 
          autoSelectBrandId: currentBrandId,
          fromOnboarding: true 
        }
      });
    }, INITIAL_UPDATE_DELAY);

    return () => {
      clearTimeout(preFetchTimer);
      clearTimeout(navigateTimer);
    };
  }, [brandId, navigate, fetchDashboardData]);

  // Progress bar animation - transition from collecting to scoring
  useEffect(() => {
    // Animate progress bar smoothly based on elapsed time
    const updateProgress = () => {
      if (elapsedTime < 30) {
        // Collecting stage: 0-50% over first 30 seconds
        setProgressBarValue((elapsedTime / 30) * 50);
        if (currentStage !== 'collecting') {
          setCurrentStage('collecting');
        }
      } else if (elapsedTime < 55) {
        // Scoring stage: 50-90% over next 25 seconds
        const scoringProgress = ((elapsedTime - 30) / 25) * 40;
        setProgressBarValue(50 + scoringProgress);
        if (currentStage !== 'scoring') {
          setCurrentStage('scoring');
        }
      } else {
        // After 55 seconds, show 100% briefly before navigation
        setProgressBarValue(100);
      }
    };

    // Update progress immediately
    updateProgress();
    
    // Update progress every 100ms for smooth animation
    const progressInterval = setInterval(updateProgress, 100);

    return () => {
      clearInterval(progressInterval);
    };
  }, [elapsedTime, currentStage]); // This can depend on elapsedTime since it's just for animation

  // Removed - now handled in the navigation timer above to ensure data is fetched before redirect

  // Don't redirect automatically - let user see the data on loading screen
  // Only redirect when data collection is complete
  // The loading screen will show available data after the initial delay

  // Poll for progress updates only (no auto-redirect on completion - let dashboard handle that)
  useEffect(() => {
    // Poll for progress updates to update the UI
    const interval = setInterval(async () => {
      try {
        const data = await apiClient.request<ApiResponse<ProgressData>>(
          `/brands/${brandId}/onboarding-progress`,
          {},
          { requiresAuth: true }
        );

        if (data.success && data.data) {
          setProgress(data.data);

          // Check if complete - but don't redirect from here
          // The 25-second timer will handle redirect regardless
          if (
            data.data.queries.completed >= data.data.queries.total &&
            data.data.scoring.positions &&
            data.data.scoring.sentiments &&
            data.data.scoring.citations
          ) {
            setIsComplete(true);
          }
        }
      } catch (error) {
        // Only log non-critical errors
        if (error instanceof Error && !error.message.includes('fetch')) {
          console.error('Error fetching progress:', error);
        }
      }
    }, 5000); // Poll every 5 seconds for progress

    return () => {
      clearInterval(interval);
    };
  }, [brandId]);

  // Track elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f9f9fb' }}>
      <img
        src={evidentlyLogo}
        alt="EvidentlyAEO"
        className="fixed top-6 left-6 h-20 w-20 object-contain z-50"
      />
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="max-w-2xl w-full">
          {/* Main card */}
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-8 md:p-12">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: '#00bcdc' }}>
                {isComplete ? (
                  <CheckCircle2 className="w-8 h-8 text-white" />
                ) : (
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: '#1a1d29' }}>
                {isComplete ? 'Almost There!' : 'Setting Up Your Brand'}
              </h1>
              <p className="text-[15px] mb-6" style={{ color: '#64748b' }}>
                {currentStage === 'collecting' 
                  ? 'Collecting your results...'
                  : 'Scoring the results...'
                }
              </p>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[13px] font-medium" style={{ color: '#393e51' }}>
                    {currentStage === 'collecting' ? 'Collecting Results' : 'Scoring Results'}
                  </span>
                  <span className="text-[13px] font-semibold" style={{ color: '#1a1d29' }}>{Math.round(progressBarValue)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#e8e9ed' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{ 
                      width: `${progressBarValue}%`,
                      backgroundColor: '#00bcdc'
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[12px]" style={{ color: '#64748b' }}>
                  <span className={currentStage === 'collecting' ? 'font-medium' : ''} style={currentStage === 'collecting' ? { color: '#00bcdc' } : {}}>
                    {currentStage === 'collecting' ? '● Collecting' : '✓ Collecting'}
                  </span>
                  <span className={currentStage === 'scoring' ? 'font-medium' : ''} style={currentStage === 'scoring' ? { color: '#00bcdc' } : {}}>
                    {currentStage === 'scoring' ? '● Scoring' : 'Scoring'}
                  </span>
                </div>
              </div>
            </div>


          {/* Show available dashboard data after initial delay */}
          {hasShownInitialData && dashboardData && (
            <div className="mt-6 rounded-lg p-4" style={{ backgroundColor: '#f9f9fb', border: '1px solid #e8e9ed' }}>
              <p className="font-semibold mb-3 text-[13px]" style={{ color: '#1a1d29' }}>Available Data</p>
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                {/* Share of Answer */}
                <div className="rounded-lg p-2" style={{ backgroundColor: '#ffffff' }}>
                  <p className="text-[12px] mb-1" style={{ color: '#64748b' }}>Share of Answer</p>
                  <p className="font-bold text-base" style={{ color: '#1a1d29' }}>
                    {(() => {
                      const metric = dashboardData.scores?.find((m: any) => 
                        m.label?.toLowerCase().includes('share of answer') || 
                        m.label?.toLowerCase().includes('share of answers')
                      );
                      return metric ? `${metric.value?.toFixed(1) || '0'}%` : '0%';
                    })()}
                  </p>
                </div>
                {/* Visibility */}
                <div className="rounded-lg p-2" style={{ backgroundColor: '#ffffff' }}>
                  <p className="text-[12px] mb-1" style={{ color: '#64748b' }}>Visibility</p>
                  <p className="font-bold text-base" style={{ color: '#1a1d29' }}>
                    {(() => {
                      const metric = dashboardData.scores?.find((m: any) => 
                        m.label?.toLowerCase().includes('visibility index')
                      );
                      return metric ? (metric.value?.toFixed(1) || '0') : '0';
                    })()}
                  </p>
                </div>
                {/* Sentiment */}
                <div className="rounded-lg p-2" style={{ backgroundColor: '#ffffff' }}>
                  <p className="text-[12px] mb-1" style={{ color: '#64748b' }}>Sentiment</p>
                  <p className="font-bold text-base" style={{ color: '#1a1d29' }}>
                    {(() => {
                      const metric = dashboardData.scores?.find((m: any) => 
                        m.label?.toLowerCase().includes('sentiment score')
                      );
                      return metric ? (metric.value?.toFixed(1) || '0') : '0';
                    })()}
                  </p>
                </div>
              </div>
              <p className="text-[12px] mt-3 text-center" style={{ color: '#64748b' }}>
                Redirecting to dashboard in a few seconds...
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between text-[13px] border-t pt-6" style={{ borderColor: '#e8e9ed' }}>
            <div className="flex items-center gap-2" style={{ color: '#64748b' }}>
              <TrendingUp className="w-4 h-4" />
              <span>Elapsed: {formatTime(elapsedTime)}</span>
            </div>
            {progress.estimatedTimeRemaining && (
              <div className="flex items-center gap-2" style={{ color: '#64748b' }}>
                <Globe className="w-4 h-4" />
                <span>Est. remaining: ~{Math.ceil(progress.estimatedTimeRemaining / 60)} min</span>
              </div>
            )}
          </div>

          {/* Loading animation hint */}
          {!isComplete && !hasShownInitialData && (
            <div className="mt-6 text-center">
              <p className="text-[13px]" style={{ color: '#64748b' }}>
                This may take a few minutes. We're collecting and analyzing data from multiple AI sources...
              </p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for using loading screen in onboarding flow
export const useDataCollectionProgress = (brandId: string) => {
  const [showLoading, setShowLoading] = useState(false);
  const navigate = useNavigate();

  const startDataCollection = () => {
    setShowLoading(true);
    // Navigate to loading screen
    navigate(`/onboarding/loading/${brandId}`, { replace: true });
  };

  return { showLoading, startDataCollection };
};
