import { Activity, CheckCircle2 } from 'lucide-react';

interface ProgressData {
  queries: {
    total: number;
    completed: number;
  };
  scoring: {
    positions: boolean;
    sentiments: boolean;
    citations: boolean;
  };
  currentOperation: 'collecting' | 'scoring' | 'finalizing';
}

interface DataCollectionProgressBarProps {
  selectedBrandId: string;
  progress: ProgressData | null;
  isLoading: boolean;
}

export const DataCollectionProgressBar = ({
  selectedBrandId,
  progress,
  isLoading
}: DataCollectionProgressBarProps) => {
  if (!progress || !selectedBrandId) {
    return null;
  }

  // Calculate overall progress percentage
  const calculateProgress = () => {
    if (!progress) return 0;

    const { queries, scoring } = progress;
    
    // Calculate query progress (0-70% of total)
    const queryProgress = queries.total > 0 
      ? (queries.completed / queries.total) * 70
      : 0;

    // Calculate scoring progress (70-100% of total, split between 3 steps)
    let scoringProgress = 0;
    if (queries.completed >= queries.total && queries.total > 0) {
      const scoringSteps = [
        scoring.positions,
        scoring.sentiments,
        scoring.citations
      ].filter(Boolean).length;
      scoringProgress = (scoringSteps / 3) * 30; // Remaining 30%
    }

    return Math.min(100, Math.round(queryProgress + scoringProgress));
  };

  const progressPercentage = calculateProgress();
  const isComplete = progress.queries.completed >= progress.queries.total &&
                    progress.scoring.positions &&
                    progress.scoring.sentiments &&
                    progress.scoring.citations;

  const getStatusText = () => {
    if (isComplete) {
      return 'Data collection and scoring complete!';
    }
    if (progress.currentOperation === 'collecting') {
      return `Collecting data: ${progress.queries.completed} of ${progress.queries.total} queries completed`;
    }
    if (progress.currentOperation === 'scoring') {
      const scoringSteps = [
        progress.scoring.positions && 'Positions',
        progress.scoring.sentiments && 'Sentiments',
        progress.scoring.citations && 'Citations'
      ].filter(Boolean);
      return `Scoring results: ${scoringSteps.join(', ')} completed`;
    }
    return 'Processing your data...';
  };

  return (
    <div className="mb-6 bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isComplete ? (
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#06c686' }}>
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#00bcdc' }}>
              <Activity className="w-5 h-5 text-white animate-pulse" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#1a1d29' }}>
            {isComplete ? 'Data Collection Complete' : 'Collecting and Scoring Your Data'}
          </h3>
          <p className="text-[13px] mb-3" style={{ color: '#64748b' }}>
            {getStatusText()}
          </p>
          
          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[12px] font-medium" style={{ color: '#393e51' }}>
                Overall Progress
              </span>
              <span className="text-[12px] font-semibold" style={{ color: '#1a1d29' }}>
                {progressPercentage}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#e8e9ed' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${progressPercentage}%`,
                  backgroundColor: isComplete ? '#06c686' : '#00bcdc'
                }}
              />
            </div>
          </div>

          {/* Detailed Progress */}
          {!isComplete && (
            <div className="grid grid-cols-2 gap-2 mt-3 text-[12px]">
              <div style={{ color: '#64748b' }}>
                <span className="font-medium">Queries: </span>
                <span>{progress.queries.completed}/{progress.queries.total}</span>
              </div>
              <div style={{ color: '#64748b' }}>
                <span className="font-medium">Scoring: </span>
                <span>
                  {[
                    progress.scoring.positions && 'Positions',
                    progress.scoring.sentiments && 'Sentiments',
                    progress.scoring.citations && 'Citations'
                  ].filter(Boolean).join(', ') || 'Pending'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

