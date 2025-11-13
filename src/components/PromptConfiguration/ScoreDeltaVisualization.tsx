import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ImpactEstimate } from '../../utils/impactCalculator';

interface ScoreDeltaVisualizationProps {
  currentScore: number;
  impact: ImpactEstimate;
}

export const ScoreDeltaVisualization = ({
  currentScore,
  impact
}: ScoreDeltaVisualizationProps) => {
  const isIncrease = impact.delta > 0;
  const isDecrease = impact.delta < 0;
  const isNeutral = impact.delta === 0;

  const getColor = () => {
    if (isIncrease) return 'text-[var(--success500)]';
    if (isDecrease) return 'text-[var(--primary300)]';
    return 'text-[var(--accent-primary)]';
  };

  const getBgColor = () => {
    if (isIncrease) return 'bg-[var(--success500)]/10';
    if (isDecrease) return 'bg-[var(--primary300)]/10';
    return 'bg-[var(--accent-light)]';
  };

  const getIcon = () => {
    if (isIncrease) return <TrendingUp size={24} className="text-[var(--success500)]" />;
    if (isDecrease) return <TrendingDown size={24} className="text-[var(--primary300)]" />;
    return <Minus size={24} className="text-[var(--accent-primary)]" />;
  };

  const getConfidenceDots = () => {
    const dots = [];
    const level = impact.confidence === 'high' ? 3 : impact.confidence === 'medium' ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      dots.push(
        <span
          key={i}
          className={`inline-block w-2 h-2 rounded-full ${
            i < level ? 'bg-[var(--accent-primary)]' : 'bg-[var(--primary300)]'
          }`}
        />
      );
    }
    return dots;
  };

  return (
    <div className={`${getBgColor()} rounded-lg p-6 mb-6 border border-[var(--border-default)]`}>
      <div className="flex items-center justify-between mb-5">
        <h4 className="text-lg font-semibold text-[var(--text-headings)]">
          Estimated Score Change
        </h4>
        <div className={getColor()}>{getIcon()}</div>
      </div>

      <div className="flex items-baseline gap-3 mb-5">
        <div className="text-2xl font-bold text-[var(--text-headings)]">
          {currentScore.toFixed(1)}
        </div>
        <div className="text-xl text-[var(--text-caption)]">→</div>
        <div className={`text-3xl font-bold ${getColor()}`}>
          {impact.newScore.toFixed(1)}
        </div>
        {impact.delta !== 0 && (
          <div className={`text-lg font-semibold ${getColor()}`}>
            ({isIncrease ? '+' : ''}{impact.delta.toFixed(1)})
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-[var(--text-caption)]">
        <span className="font-medium">Confidence:</span>
        <div className="flex items-center gap-1">
          {getConfidenceDots()}
        </div>
        <span className="ml-1">
          {impact.confidence === 'high' && 'High (similar topic coverage)'}
          {impact.confidence === 'medium' && 'Medium (some topic overlap)'}
          {impact.confidence === 'low' && 'Low (different topic focus)'}
        </span>
      </div>

      {impact.reasoning && (
        <div className="mt-5 pt-4 border-t border-[var(--border-default)]">
          <p className="text-sm text-[var(--text-body)] leading-relaxed">{impact.reasoning}</p>
        </div>
      )}
    </div>
  );
};

