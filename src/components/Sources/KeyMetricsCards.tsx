import { TrendingUp, TrendingDown } from 'lucide-react';
import { SourceData } from '../../data/mockSourcesData';

interface KeyMetricsCardsProps {
  sources: SourceData[];
}

export const KeyMetricsCards = ({ sources }: KeyMetricsCardsProps) => {
  const bestSource = sources.reduce((prev, current) =>
    current.mentionRate > prev.mentionRate ? current : prev
  );

  const worstSource = sources.reduce((prev, current) =>
    current.mentionRate < prev.mentionRate ? current : prev
  );

  const avgPosition = (sources.reduce((sum, source) => sum + source.avgPosition, 0) / sources.length).toFixed(1);

  const brandMentions = sources.reduce((sum, source) => sum + source.mentionCount, 0);
  const competitorMentions = sources.reduce((sum, source) => {
    const comp = source.competitorComparison;
    return sum + comp.rival1.mentions + comp.rival2.mentions + comp.rival3.mentions;
  }, 0);
  const isAhead = brandMentions > competitorMentions / 3;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
        <div className="text-sm text-[var(--text-caption)] mb-2">Best Performing Source</div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: bestSource.color }}
          />
          <span className="text-xl font-bold text-[var(--text-body)]">
            {bestSource.name}
          </span>
        </div>
        <div className="text-sm text-[var(--text-caption)] mt-1">
          {bestSource.mentionCount} mentions
        </div>
      </div>

      <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
        <div className="text-sm text-[var(--text-caption)] mb-2">Lowest Performing Source</div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: worstSource.color }}
          />
          <span className="text-xl font-bold text-[var(--text-body)]">
            {worstSource.name}
          </span>
        </div>
        <div className="text-sm text-[var(--text-caption)] mt-1">
          {worstSource.mentionCount} mentions
        </div>
      </div>

      <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
        <div className="text-sm text-[var(--text-caption)] mb-2">Average Position</div>
        <div className="text-3xl font-bold text-[var(--text-body)]">
          {avgPosition}
        </div>
        <div className="text-xs text-[var(--text-caption)] mt-1">
          Lower is better
        </div>
      </div>

      <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
        <div className="text-sm text-[var(--text-caption)] mb-2">Competitive Advantage</div>
        <div className="flex items-center gap-2">
          {isAhead ? (
            <>
              <TrendingUp className="text-[var(--text-success)]" size={24} />
              <span className="text-xl font-bold text-[var(--text-success)]">Ahead</span>
            </>
          ) : (
            <>
              <TrendingDown className="text-[var(--text-error)]" size={24} />
              <span className="text-xl font-bold text-[var(--text-error)]">Behind</span>
            </>
          )}
        </div>
        <div className="text-xs text-[var(--text-caption)] mt-1">
          vs avg competitor
        </div>
      </div>
    </div>
  );
};
