import { useState, useMemo } from 'react';
import { Trophy, Search, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Category } from '../types';

interface CategoryHighlightsProps {
  categories: Category[];
  totalTopics: number;
  onCategoryClick?: (categoryId: string) => void;
}

// Get status icon
const getStatusIcon = (status: Category['status']) => {
  switch (status) {
    case 'leader':
      return Trophy;
    case 'emerging':
      return Search;
    case 'growing':
      return TrendingUp;
    case 'declining':
      return AlertTriangle;
    default:
      return Trophy;
  }
};

export const CategoryHighlights = ({ categories, totalTopics, onCategoryClick }: CategoryHighlightsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const categoryCards = useMemo(() => {
    return categories.map((category) => {
      const StatusIcon = getStatusIcon(category.status);
      const portfolioPercent = ((category.topicCount / totalTopics) * 100).toFixed(1);
      const trendColor = category.trend.delta >= 0 ? 'var(--success500)' : 'var(--dataviz-4)';
      const trendSymbol = category.trend.direction === 'up' ? '↑' : category.trend.direction === 'down' ? '↓' : '→';

      return (
        <div
          key={category.id}
          onClick={() => onCategoryClick?.(category.id)}
          className="bg-white border border-[var(--primary200)] rounded-lg p-4 sm:p-5 cursor-pointer transition-all hover:shadow-md hover:border-[var(--accent500)]"
          role="button"
          tabIndex={0}
          aria-label={`Category: ${category.name}, ${category.topicCount} topics, Average SoA: ${(category.avgSoA * 20).toFixed(1)}%`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onCategoryClick?.(category.id);
            }
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0">
              <StatusIcon size={18} className="text-[var(--text-headings)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-[var(--text-headings)] mb-1">
                {category.name.toUpperCase()} ({category.topicCount} topics)
              </h4>
            </div>
          </div>

          <div className="space-y-2 text-sm text-[var(--text-body)]">
            <div>
              <span>Avg SoA: </span>
              <span className="font-semibold text-[var(--accent500)]">{(category.avgSoA * 20).toFixed(1)}%</span>
            </div>
            <div>
              <span>Portfolio %: </span>
              <span className="font-medium text-[var(--text-headings)]">{portfolioPercent}%</span>
            </div>
            <div className="pt-2 border-t border-[var(--border-default)]">
              <span>Trend: </span>
              <span className="font-medium" style={{ color: trendColor }}>
                {trendSymbol}
                {Math.abs(category.trend.delta).toFixed(1)}x
              </span>
              <span className="text-xs text-[var(--text-caption)] ml-2">
                ({category.status === 'leader' ? 'Strong' : category.status === 'declining' ? 'Weak' : 'Moderate'})
              </span>
            </div>
          </div>
        </div>
      );
    });
  }, [categories, totalTopics, onCategoryClick]);

  if (categories.length === 0) return null;

  return (
    <div className="mt-6 sm:mt-8">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base font-semibold text-[var(--text-headings)]">Category Highlights</h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sm text-[var(--accent500)] hover:text-[var(--accent-hover)] transition-colors"
          aria-label={isCollapsed ? 'Expand categories' : 'Collapse categories'}
        >
          {isCollapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{categoryCards}</div>
      )}
    </div>
  );
};

