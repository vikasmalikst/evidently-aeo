import { useMemo } from 'react';
import type { SourceData } from '../../pages/SearchSourcesR2';
import { HelpButton } from '../common/HelpButton';

interface SourceTypeDistributionProps {
  sources: SourceData[];
  isLoading?: boolean;
  onHelpClick?: () => void;
}

type SourceType = 'editorial' | 'corporate' | 'ugc' | 'reference' | 'institutional' | 'brand';

// Define colors and labels for each type
const TYPE_CONFIG: Record<SourceType, { label: string; color: string; order: number }> = {
  editorial: { label: 'Editorial', color: '#5C5CFF', order: 1 }, // High visibility blue/purple
  corporate: { label: 'Corporate', color: '#0EA5E9', order: 2 }, // Blue
  ugc: { label: 'Ugc', color: '#22D3EE', order: 3 }, // Cyan
  social: { label: 'Social', color: '#F97316', order: 4 }, // Orange (Mapping 'brand' or explicit social if exists? SourceData has 'brand', let's check)
  brand: { label: 'Brand', color: '#F97316', order: 4 }, // Using Orange for Brand/Social
  reference: { label: 'Reference', color: '#A855F7', order: 5 }, // Purple
  institutional: { label: 'Institutional', color: '#10B981', order: 6 }, // Green
} as any; // Cast as any to handle potential mismatches or extra keys safely in runtime if needed

export const SourceTypeDistribution = ({ sources, isLoading = false, onHelpClick }: SourceTypeDistributionProps) => {
  const distribution = useMemo(() => {
    if (!sources.length) return [];

    const counts: Record<string, number> = {};
    let total = 0;

    sources.forEach(source => {
      const type = source.type || 'corporate'; // Default fallback
      counts[type] = (counts[type] || 0) + 1;
      total++;
    });

    return Object.entries(counts)
      .map(([type, count]) => {
        const config = TYPE_CONFIG[type as SourceType] || { label: type, color: '#cbd5e1', order: 99 };
        return {
          type,
          label: config.label,
          color: config.color,
          count,
          percentage: (count / total) * 100,
          order: config.order
        };
      })
      .sort((a, b) => a.order - b.order);
  }, [sources]);

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-[0_8px_18px_rgba(15,23,42,0.05)] animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
        <div className="h-8 w-full bg-gray-200 rounded mb-6"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-extrabold text-slate-900 m-0">Source Type Distribution</h3>
        {onHelpClick && (
          <HelpButton
            onClick={onHelpClick}
            label="Learn about source types"
            size={18}
          />
        )}
      </div>

      {/* Stacked Bar */}
      <div className="h-8 w-full rounded flex overflow-hidden mb-6">
        {distribution.map((item, index) => (
          <div
            key={item.type}
            style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
            className="h-full relative group first:rounded-l last:rounded-r transition-all hover:opacity-90"
            title={`${item.label}: ${item.count} sources (${item.percentage.toFixed(1)}%)`}
          >
            {/* Small separator if needed, but flex handles it cleanly. */}
          </div>
        ))}
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-4 gap-x-8">
        {distribution.map((item) => (
          <div key={item.type} className="flex flex-col gap-1 group/legend-item">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: item.color }}></div>
              <span className="text-xs font-medium text-slate-500">{item.label}</span>
              {onHelpClick && (
                <HelpButton
                  onClick={(e) => {
                    e?.stopPropagation();
                    onHelpClick();
                  }}
                  className="opacity-0 group-hover/legend-item:opacity-100 p-0.5"
                  label={`Learn about ${item.label}`}
                  size={12}
                />
              )}
            </div>
            <span className="text-sm font-extrabold text-slate-900 ml-5">
              {item.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


