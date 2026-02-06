import { useMemo } from 'react';
import type { SourceData } from '../../types/citation-sources';
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
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 8px 18px rgba(15,23,42,0.06)',
      transition: 'box-shadow 200ms ease'
    }}>
      <div className="flex items-center justify-between mb-5">
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>Source Type Distribution</h3>
        {onHelpClick && (
          <HelpButton
            onClick={onHelpClick}
            label="Learn about source types"
            size={18}
          />
        )}
      </div>

      {/* Stacked Bar */}
      <div style={{ 
        height: 48, 
        width: '100%', 
        borderRadius: 8, 
        display: 'flex', 
        overflow: 'hidden', 
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(15,23,42,0.04)'
      }}>
        {distribution.map((item) => (
          <div
            key={item.type}
            style={{ 
              width: `${item.percentage}%`, 
              background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}dd 100%)`,
              position: 'relative',
              transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="h-full group/bar cursor-pointer"
            title={`${item.label}: ${item.count} sources (${item.percentage.toFixed(1)}%)`}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
            }}
          >
          </div>
        ))}
      </div>

      {/* Legend Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '20px 24px'
      }}>
        {distribution.map((item) => (
          <div key={item.type} className="flex flex-col gap-1.5 group/legend-item cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div 
                style={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: 3,
                  background: item.color,
                  boxShadow: '0 1px 3px rgba(15,23,42,0.1)'
                }}
              ></div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>{item.label}</span>
              {onHelpClick && (
                <HelpButton
                  onClick={(e) => {
                    e?.stopPropagation();
                    onHelpClick();
                  }}
                  className="opacity-0 group-hover/legend-item:opacity-100 p-0.5 transition-opacity"
                  label={`Learn about ${item.label}`}
                  size={12}
                />
              )}
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginLeft: 20 }}>
              {item.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


