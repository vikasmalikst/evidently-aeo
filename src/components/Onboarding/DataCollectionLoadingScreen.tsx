import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Fix for useParams
export const DataCollectionLoadingScreenRoute = () => {
  const { brandId } = useParams<{ brandId: string }>();
  if (!brandId) return <div>Invalid brand ID</div>;
  return <DataCollectionLoadingScreen brandId={brandId} />;
};
import { CheckCircle2, Sparkles, TrendingUp, Globe } from 'lucide-react';

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
  getEnvVar('VITE_LOADING_INITIAL_DELAY_MS', '20000'),
  10
); // 20 seconds default (user requested 15-20 seconds)
const SUBSEQUENT_UPDATE_INTERVAL = parseInt(
  getEnvVar('VITE_LOADING_UPDATE_INTERVAL_MS', '30000'),
  10
); // 30 seconds default

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
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState<'collecting' | 'scoring'>('collecting');
  const [progressBarValue, setProgressBarValue] = useState(0);

  // Fetch dashboard data to show after initial delay
  const fetchDashboardData = async () => {
    try {
      // Ensure we're fetching data for the correct brand
      if (!brandId) {
        console.warn('[LoadingScreen] No brandId provided, cannot fetch dashboard data');
        return;
      }
      
      console.log(`[LoadingScreen] Fetching dashboard data for brand: ${brandId}`);
      const response = await fetch(`/api/brands/${brandId}/dashboard`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Verify the data is for the correct brand
          if (data.data.brandId && data.data.brandId !== brandId) {
            console.warn(`[LoadingScreen] Brand ID mismatch! Expected ${brandId}, got ${data.data.brandId}`);
            return;
          }
          
          console.log('[LoadingScreen] Dashboard data received for brand:', brandId, data.data);
          setDashboardData(data.data);
          setHasShownInitialData(true);
        } else {
          console.warn('[LoadingScreen] Dashboard response not successful:', data);
        }
      } else {
        console.error('[LoadingScreen] Dashboard fetch failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[LoadingScreen] Error fetching dashboard data:', error);
    }
  };

  // Navigation timer - only runs once on mount, after 20 seconds
  useEffect(() => {
    if (!brandId) return;
    
    console.log(`[LoadingScreen] Setting up navigation timer for ${INITIAL_UPDATE_DELAY}ms for brand: ${brandId}`);
    const navigateTimer = setTimeout(() => {
      console.log(`[LoadingScreen] 20 seconds elapsed, navigating to dashboard for brand: ${brandId}`);
      // Store flag that we're showing partial data
      localStorage.setItem(`data_collection_in_progress_${brandId}`, 'true');
      // Pass brandId in navigation state so dashboard can auto-select it
      navigate('/dashboard', { 
        replace: true,
        state: { 
          autoSelectBrandId: brandId,
          fromOnboarding: true 
        }
      });
    }, INITIAL_UPDATE_DELAY);

    return () => {
      clearTimeout(navigateTimer);
    };
  }, [brandId, navigate]); // Only depend on brandId and navigate, not elapsedTime

  // Progress bar animation - transition from collecting to scoring
  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    
    // Animate progress bar smoothly based on elapsed time
    const updateProgress = () => {
      if (elapsedTime < 8) {
        // Collecting stage: 0-50% over 8 seconds
        setProgressBarValue((elapsedTime / 8) * 50);
        if (currentStage !== 'collecting') {
          setCurrentStage('collecting');
        }
      } else if (elapsedTime < 20) {
        // Scoring stage: 50-90% over next 12 seconds
        const scoringProgress = ((elapsedTime - 8) / 12) * 40;
        setProgressBarValue(50 + scoringProgress);
        if (currentStage !== 'scoring') {
          setCurrentStage('scoring');
        }
      } else {
        // After 20 seconds, show 100% briefly before navigation
        setProgressBarValue(100);
      }
    };

    // Update progress immediately
    updateProgress();
    
    // Update progress every 100ms for smooth animation
    progressInterval = setInterval(updateProgress, 100);

    return () => {
      clearInterval(progressInterval);
    };
  }, [elapsedTime, currentStage]); // This can depend on elapsedTime since it's just for animation

  // Initial data fetch after 15-20 seconds (configurable)
  useEffect(() => {
    if (!brandId) return;
    
    console.log(`[LoadingScreen] Will fetch dashboard data after ${INITIAL_UPDATE_DELAY}ms for brand: ${brandId}`);
    const initialTimer = setTimeout(() => {
      console.log(`[LoadingScreen] Initial delay elapsed, fetching dashboard data for brand: ${brandId}`);
      fetchDashboardData();
    }, INITIAL_UPDATE_DELAY);

    return () => clearTimeout(initialTimer);
  }, [brandId]);

  // Don't redirect automatically - let user see the data on loading screen
  // Only redirect when data collection is complete
  // The loading screen will show available data after the initial delay

  // Poll for progress updates and subsequent dashboard updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let updateInterval: NodeJS.Timeout;

    // Poll for progress updates (faster polling for progress)
    interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/brands/${brandId}/onboarding-progress`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setProgress(data.data);

            // Check if complete
            if (
              data.data.queries.completed >= data.data.queries.total &&
              data.data.scoring.positions &&
              data.data.scoring.sentiments &&
              data.data.scoring.citations
            ) {
              setIsComplete(true);
              clearInterval(interval);
              if (updateInterval) clearInterval(updateInterval);
              
              // Fetch final dashboard data before redirect
              await fetchDashboardData();
              
              // Redirect after brief delay to show completion
              setTimeout(() => {
                navigate('/dashboard', { 
                  replace: true,
                  state: { 
                    autoSelectBrandId: brandId,
                    fromOnboarding: true 
                  }
                });
              }, 1500);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
        // Continue polling even on error
      }
    }, 2000); // Poll every 2 seconds for progress

    // Subsequent dashboard updates every 30 seconds (only after initial data shown)
    if (hasShownInitialData) {
      updateInterval = setInterval(() => {
        fetchDashboardData();
      }, SUBSEQUENT_UPDATE_INTERVAL);
    }

    return () => {
      clearInterval(interval);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, [brandId, navigate, hasShownInitialData]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-purple-400 rounded-full opacity-20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        {/* Main card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4 shadow-lg">
              {isComplete ? (
                <CheckCircle2 className="w-10 h-10 text-white animate-scale-in" />
              ) : (
                <Sparkles className="w-10 h-10 text-white animate-spin-slow" />
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {isComplete ? 'Almost There!' : 'Setting Up Your Brand'}
            </h1>
            <p className="text-purple-200 text-lg mb-6">
              {currentStage === 'collecting' 
                ? 'Collecting your results...'
                : 'Scoring the results...'
              }
            </p>

            {/* Animated Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-purple-200">
                  {currentStage === 'collecting' ? 'Collecting Results' : 'Scoring Results'}
                </span>
                <span className="text-sm font-bold text-white">{Math.round(progressBarValue)}%</span>
              </div>
              <div className="h-4 bg-white/10 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${progressBarValue}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-purple-300/60">
                <span className={currentStage === 'collecting' ? 'text-purple-300 font-medium' : ''}>
                  {currentStage === 'collecting' ? '● Collecting' : '✓ Collecting'}
                </span>
                <span className={currentStage === 'scoring' ? 'text-purple-300 font-medium' : ''}>
                  {currentStage === 'scoring' ? '● Scoring' : 'Scoring'}
                </span>
              </div>
            </div>
          </div>


          {/* Show available dashboard data after initial delay */}
          {hasShownInitialData && dashboardData && (
            <div className="mt-6 bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-white font-semibold mb-3 text-sm">Available Data</p>
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                {/* Share of Answer */}
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-purple-200 text-xs mb-1">Share of Answer</p>
                  <p className="text-white font-bold text-lg">
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
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-purple-200 text-xs mb-1">Visibility</p>
                  <p className="text-white font-bold text-lg">
                    {(() => {
                      const metric = dashboardData.scores?.find((m: any) => 
                        m.label?.toLowerCase().includes('visibility index')
                      );
                      return metric ? (metric.value?.toFixed(1) || '0') : '0';
                    })()}
                  </p>
                </div>
                {/* Sentiment */}
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-purple-200 text-xs mb-1">Sentiment</p>
                  <p className="text-white font-bold text-lg">
                    {(() => {
                      const metric = dashboardData.scores?.find((m: any) => 
                        m.label?.toLowerCase().includes('sentiment score')
                      );
                      return metric ? (metric.value?.toFixed(1) || '0') : '0';
                    })()}
                  </p>
                </div>
              </div>
              {/* Additional stats row */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-purple-200 text-xs mb-1">Total Queries</p>
                  <p className="text-white font-bold text-lg">
                    {dashboardData.totalQueries || 0}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-purple-200 text-xs mb-1">Queries with Brand Presence</p>
                  <p className="text-white font-bold text-lg">
                    {dashboardData.queriesWithBrandPresence || 0}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-purple-200 text-xs mb-1">Average Collection Time</p>
                  <p className="text-white font-bold text-lg">
                    {(() => {
                      // Show average collection time if available in dashboard data
                      // This would need to be added to the dashboard payload if not already there
                      if (dashboardData.averageCollectionTimeMs) {
                        const ms = dashboardData.averageCollectionTimeMs;
                        return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
                      }
                      return 'N/A';
                    })()}
                  </p>
                </div>
              </div>
              <p className="text-purple-300/60 text-xs mt-3 text-center">
                Data will update automatically every {SUBSEQUENT_UPDATE_INTERVAL / 1000} seconds
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-purple-200 border-t border-white/10 pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Elapsed: {formatTime(elapsedTime)}</span>
            </div>
            {progress.estimatedTimeRemaining && (
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span>Est. remaining: ~{Math.ceil(progress.estimatedTimeRemaining / 60)} min</span>
              </div>
            )}
          </div>

          {/* Loading animation hint */}
          {!isComplete && !hasShownInitialData && (
            <div className="mt-6 text-center">
              <p className="text-purple-300/60 text-sm">
                This may take a few minutes. We're collecting and analyzing data from multiple AI sources...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        @keyframes scale-in {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }
      `}</style>
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

