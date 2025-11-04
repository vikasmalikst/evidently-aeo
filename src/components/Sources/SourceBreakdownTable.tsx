import { useState } from 'react';
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SourceData } from '../../data/mockSourcesData';

interface SourceBreakdownTableProps {
  sources: SourceData[];
}

type SortKey = 'name' | 'mentionCount' | 'mentionRate' | 'avgPosition';

export const SourceBreakdownTable = ({ sources }: SourceBreakdownTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('mentionCount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedSources = [...sources].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortKey) {
      case 'name':
        aVal = a.name;
        bVal = b.name;
        break;
      case 'mentionCount':
        aVal = a.mentionCount;
        bVal = b.mentionCount;
        break;
      case 'mentionRate':
        aVal = a.mentionRate;
        bVal = b.mentionRate;
        break;
      case 'avgPosition':
        aVal = a.avgPosition;
        bVal = b.avgPosition;
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const getCompetitorStatus = (source: SourceData) => {
    const avgCompetitorMentions = (
      source.competitorComparison.rival1.mentions +
      source.competitorComparison.rival2.mentions +
      source.competitorComparison.rival3.mentions
    ) / 3;

    if (source.mentionCount > avgCompetitorMentions * 1.1) return 'ahead';
    if (source.mentionCount < avgCompetitorMentions * 0.9) return 'behind';
    return 'equal';
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ChevronUp size={14} className="opacity-30" />;
    return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[var(--border-default)]">
        <h3 className="text-lg font-semibold text-[var(--text-headings)]">
          Detailed Source Breakdown
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)]">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Source
                  <SortIcon columnKey="name" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => handleSort('mentionCount')}
              >
                <div className="flex items-center gap-2">
                  Total Mentions
                  <SortIcon columnKey="mentionCount" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => handleSort('mentionRate')}
              >
                <div className="flex items-center gap-2">
                  Mention Rate
                  <SortIcon columnKey="mentionRate" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => handleSort('avgPosition')}
              >
                <div className="flex items-center gap-2">
                  Avg Position
                  <SortIcon columnKey="avgPosition" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Vs Competitors
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Tone
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--border-default)]">
            {sortedSources.map((source, idx) => {
              const competitorStatus = getCompetitorStatus(source);
              const total = source.toneBreakdown.positive + source.toneBreakdown.neutral + source.toneBreakdown.negative;
              const posPercent = (source.toneBreakdown.positive / total) * 100;
              const neutPercent = (source.toneBreakdown.neutral / total) * 100;

              return (
                <tr
                  key={source.id}
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[var(--bg-secondary)]'} hover:bg-[var(--bg-tertiary)] transition-colors`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: source.color }}
                      />
                      <span className="text-sm font-semibold text-[var(--text-body)]">
                        {source.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-[var(--text-body)]">
                      {source.mentionCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-body)]">
                        {(source.mentionRate * 100).toFixed(0)}%
                      </span>
                      {source.trendDirection === 'up' ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--text-success)]">
                          <TrendingUp size={14} />
                          {source.trendPercent}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--text-error)]">
                          <TrendingDown size={14} />
                          {Math.abs(source.trendPercent)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-[var(--text-body)]">
                      {source.avgPosition.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {competitorStatus === 'ahead' && (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-success)]">
                        <TrendingUp size={14} />
                        Ahead
                      </span>
                    )}
                    {competitorStatus === 'behind' && (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-error)]">
                        <TrendingDown size={14} />
                        Behind
                      </span>
                    )}
                    {competitorStatus === 'equal' && (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-caption)]">
                        <Minus size={14} />
                        Equal
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-[var(--text-success)]"
                          style={{ width: `${posPercent}%` }}
                          title={`Positive: ${source.toneBreakdown.positive}`}
                        />
                        <div
                          className="h-full bg-[var(--text-warning)]"
                          style={{ width: `${neutPercent}%` }}
                          title={`Neutral: ${source.toneBreakdown.neutral}`}
                        />
                        <div
                          className="h-full bg-[var(--text-error)]"
                          style={{ width: `${100 - posPercent - neutPercent}%` }}
                          title={`Negative: ${source.toneBreakdown.negative}`}
                        />
                      </div>
                      <span className="text-xs text-[var(--text-caption)] whitespace-nowrap">
                        {source.toneBreakdown.positive}/{source.toneBreakdown.neutral}/{source.toneBreakdown.negative}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
