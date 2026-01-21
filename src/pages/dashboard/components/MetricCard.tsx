
import { ChevronUp, ChevronDown } from 'lucide-react';
import { HelpButton } from '../../../components/common/HelpButton';
import type { MetricCardProps } from '../types';
import { InfoTooltip } from './InfoTooltip';

export const MetricCard = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  color,
  linkTo,
  description,
  comparisons = [],
  comparisonSuffix = '',
  onHelpClick
}: MetricCardProps) => {
  const hasComparisons = comparisons.length > 0;
  const maxComparisonValue = hasComparisons
    ? Math.max(...comparisons.map((item) => item.value))
    : 0;

  return (
    <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5 flex flex-col relative group/card">
      {onHelpClick && (
        <HelpButton
          onClick={(e) => {
            e?.stopPropagation();
            onHelpClick();
          }}
          className="!absolute top-3 right-3 z-10 opacity-0 group-hover/card:opacity-100 focus:opacity-100"
          label="Learn more about this KPI"
          size={18}
        />
      )}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <div className="text-[14px] font-semibold text-[#1a1d29]">{title}</div>
          {description && <InfoTooltip description={description} />}
        </div>
      </div>
      <div className="flex items-end gap-2 mb-1">
        <div className="text-[28px] font-bold text-[#1a1d29] leading-none">{value}</div>
        {trend.direction !== 'stable' && (
          <div
            className={`flex items-center gap-0.5 text-[11px] font-semibold pb-1 ${trend.direction === 'up' ? 'text-[#06c686]' : 'text-[#f94343]'
              }`}
          >
            {trend.direction === 'up' ? (
              <ChevronUp size={12} strokeWidth={2.5} />
            ) : (
              <ChevronDown size={12} strokeWidth={2.5} />
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      {subtitle && <div className="text-[12px] text-[#64748b]">{subtitle}</div>}

      {hasComparisons && (
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
            Top performers
          </div>
          <div className="flex flex-col gap-2">
            {comparisons.map((item, index) => {
              const width = maxComparisonValue > 0 ? Math.max(10, (item.value / maxComparisonValue) * 100) : 0;
              const gradient = `linear-gradient(90deg, ${color}26 0%, ${color} 100%)`;

              return (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-5 text-[11px] font-semibold text-[#94a3b8]">{index + 1}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className={`truncate ${item.isBrand ? 'font-semibold text-[#0f172a]' : 'text-[#475569]'}`}>
                        {item.label}
                      </span>
                      <span className="text-[#0f172a] font-semibold">
                        {item.value.toFixed(1).replace(/\.0$/, '')}{comparisonSuffix}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#f1f5f9] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(width, 100)}%`,
                          background: gradient,
                          boxShadow: width > 95 ? `0 0 0 1px ${color}20` : undefined
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


    </div>
  );
};

