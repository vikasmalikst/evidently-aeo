import { CheckCircle, AlertCircle } from 'lucide-react';

interface CurrentConfigSummaryProps {
  promptCount: number;
  coverage: number;
  visibilityScore: number;
  lastUpdated: string;
}

export const CurrentConfigSummary = ({
  promptCount,
  coverage,
  visibilityScore,
  lastUpdated
}: CurrentConfigSummaryProps) => {
  const getCoverageColor = (coverage: number) => {
    if (coverage >= 90) return 'text-[var(--success500)]';
    if (coverage >= 70) return 'text-[var(--text-warning)]';
    return 'text-[var(--dataviz-4)]';
  };

  const getCoverageIcon = (coverage: number) => {
    if (coverage >= 90) return <CheckCircle size={16} className="text-[var(--success500)]" />;
    return <AlertCircle size={16} className="text-[var(--dataviz-4)]" />;
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
        Current Configuration
      </h3>
      
      <div className="grid grid-cols-3 gap-6">
        {/* Prompts Count */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--dataviz-1)]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[var(--dataviz-1)] font-semibold text-sm">{promptCount}</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-1">
              Prompts Selected
            </div>
            <div className="text-2xl font-bold text-[var(--text-headings)]">
              {promptCount}
            </div>
          </div>
        </div>

        {/* Coverage */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--success500)]/10 flex items-center justify-center flex-shrink-0">
            {getCoverageIcon(coverage)}
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-1">
              Coverage
            </div>
            <div className={`text-2xl font-bold ${getCoverageColor(coverage)}`}>
              {coverage.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Visibility Score */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
            <span className="text-[var(--accent-primary)] font-semibold text-sm">VS</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-1">
              Current Score
            </div>
            <div className="text-2xl font-bold text-[var(--text-headings)]">
              {visibilityScore.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[var(--border-default)]">
        <div className="text-xs text-[var(--text-caption)]">
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          }) : 'N/A'}
        </div>
      </div>
    </div>
  );
};

