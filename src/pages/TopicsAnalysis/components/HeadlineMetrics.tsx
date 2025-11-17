import { useMemo } from 'react';
import type { Portfolio, Performance } from '../types';

interface HeadlineMetricsProps {
  portfolio: Portfolio;
  performance: Performance;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'Last week';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return 'This month';
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const HeadlineMetrics = ({ portfolio, performance }: HeadlineMetricsProps) => {
  const lastAnalyzed = useMemo(() => formatDate(portfolio.lastUpdated), [portfolio.lastUpdated]);
  const formattedVolume = useMemo(() => formatNumber(portfolio.searchVolume), [portfolio.searchVolume]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 sm:mb-8">
      {/* Portfolio Card */}
      <div className="bg-white border border-[var(--primary200)] rounded-lg p-4 sm:p-5">
        <h3 className="text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide mb-4">
          YOUR TOPIC PORTFOLIO
        </h3>
        <ul className="space-y-2 text-sm text-[var(--text-body)]">
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-headings)] mr-3"></span>
            <span>{portfolio.totalTopics} topics tracked</span>
          </li>
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-headings)] mr-3"></span>
            <span>Across {portfolio.categories} categories</span>
          </li>
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-headings)] mr-3"></span>
            <span>{formattedVolume} combined search volume</span>
          </li>
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-headings)] mr-3"></span>
            <span>Last analyzed: {lastAnalyzed}</span>
          </li>
        </ul>
      </div>

      {/* Performance Card */}
      <div className="bg-white border border-[var(--primary200)] rounded-lg p-4 sm:p-5">
        <h3 className="text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide mb-4">
          PERFORMANCE SNAPSHOT
        </h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-[var(--text-body)]">
              Average SoA:{' '}
              <span className="font-semibold text-[var(--accent500)]">{performance.avgSoA.toFixed(2)}x</span>
            </p>
            <p className="text-xs text-[var(--text-caption)] mt-1">(vs. 1.0x baseline)</p>
          </div>
          <div className="pt-2 border-t border-[var(--border-default)]">
            <p className="text-[var(--text-body)]">
              Top performers: <span className="font-medium text-[var(--accent500)]">{performance.maxSoA.toFixed(1)}x</span> SoA
            </p>
          </div>
          <div>
            <p className="text-[var(--text-body)]">
              Opportunity gaps: <span className="font-medium text-[var(--text-headings)]">&lt;1.0x</span> SoA
            </p>
          </div>
          <div className="pt-2 border-t border-[var(--border-default)]">
            <p className="text-[var(--text-body)]">
              Biggest gainer this week:{' '}
              <span className="font-medium text-[var(--accent500)]">
                {performance.weeklyGainer.topic}: ↑+{performance.weeklyGainer.delta.toFixed(1)}x
              </span>
              <span className="text-xs text-[var(--text-caption)] ml-2">(trending)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

