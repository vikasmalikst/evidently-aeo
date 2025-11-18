import { Info } from 'lucide-react';
import type { ImpactEstimate } from '../../utils/impactCalculator';

interface ScoreDeltaVisualizationProps {
  currentScore: number;
  impact: ImpactEstimate;
}

export const ScoreDeltaVisualization = ({
  currentScore,
  impact
}: ScoreDeltaVisualizationProps) => {
  return (
    <div className="bg-[var(--accent-light)] rounded-lg p-6 mb-6 border border-[var(--border-default)]">
      <div className="flex items-center gap-2 mb-5">
        <h4 className="text-lg font-semibold text-[var(--text-headings)]">
          Estimated Score Change
        </h4>
        <div className="group relative">
          <Info size={18} className="text-[var(--text-caption)] cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--text-headings)] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            There will be a new configuration version
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[var(--text-headings)]"></div>
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <div className="text-2xl font-bold text-[var(--text-headings)]">
          {currentScore.toFixed(1)}
        </div>
        <div className="text-xl text-[var(--text-caption)]">→</div>
        <div className="text-3xl font-bold text-[var(--accent-primary)]">
          {impact.newScore.toFixed(1)}
        </div>
      </div>

      {impact.reasoning && (
        <div className="mt-5 pt-4 border-t border-[var(--border-default)]">
          <p className="text-sm text-[var(--text-body)] leading-relaxed">{impact.reasoning}</p>
        </div>
      )}
    </div>
  );
};

