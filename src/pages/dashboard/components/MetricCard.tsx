
import { ChevronUp, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
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
  metricType,
  onHelpClick,
  headerAction,
  actionPosition = 'inside'
}: MetricCardProps) => {
  const hasComparisons = comparisons.length > 0;
  const maxComparisonValue = hasComparisons
    ? Math.max(...comparisons.map((item) => item.value))
    : 0;

  // Optimized Color Logic with Gradients and Glows
  const getVisualStyles = (value: number, type?: 'visibility' | 'share' | 'sentiment' | 'brandPresence') => {
    // Default fallback
    if (!type) return {
      background: `linear-gradient(90deg, ${color}20 0%, ${color} 100%)`, 
      shadow: 'none'
    };

    let baseColor = '';
    // Visibility: <17 Red, 17-34 Yellow, >=35 Green
    if (type === 'visibility') {
      if (value < 17) baseColor = 'red';
      else if (value < 35) baseColor = 'amber';
      else baseColor = 'green';
    }
    // Sentiment: <56 Red, 56-65 Yellow, >=66 Green
    else if (type === 'sentiment') {
      if (value < 56) baseColor = 'red';
      else if (value < 66) baseColor = 'amber';
      else baseColor = 'green';
    }
    // SOA & Brand Presence: <34 Red, 34-67 Yellow, >=67 Green
    else if (type === 'share' || type === 'brandPresence') {
      if (value < 34) baseColor = 'red';
      else if (value < 67) baseColor = 'amber';
      else baseColor = 'green';
    }

    switch (baseColor) {
      case 'red':
        return {
          background: 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)', // Red-500 to Red-400
          shadow: '0 0 8px rgba(239, 68, 68, 0.4)'
        };
      case 'amber':
        return {
          background: 'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)', // Amber-600 to Amber-400
          shadow: '0 0 8px rgba(245, 158, 11, 0.4)'
        };
      case 'green':
        return {
          background: 'linear-gradient(90deg, #16a34a 0%, #4ade80 100%)', // Green-600 to Green-400
          shadow: '0 0 8px rgba(34, 197, 94, 0.4)'
        };
      default:
        return {
          background: `linear-gradient(90deg, ${color}40 0%, ${color} 100%)`,
          shadow: `0 0 8px ${color}40`
        };
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:z-20 p-5 flex flex-col relative group/card h-full"> 
      {/* Subtle top gradient accent */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20 rounded-t-xl" 
        style={{ color }}
      />
      
      {headerAction && (
        <div className={`absolute z-20 ${
          actionPosition === 'outside-top' 
            ? '-top-9 right-0' 
            : 'top-3 right-3'
        }`}>
          {headerAction}
        </div>
      )}

      {onHelpClick && (
        <HelpButton
          onClick={(e) => {
            e?.stopPropagation();
            onHelpClick();
          }}
          className={`!absolute top-3 ${headerAction && actionPosition === 'inside' ? 'right-12' : 'right-3'} z-10 opacity-0 group-hover/card:opacity-100 focus:opacity-100 transition-opacity duration-200`}
          label="Learn more about this KPI"
          size={18}
        />
      )}
      
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover/card:scale-105 duration-300 shadow-sm"
          style={{ backgroundColor: `${color}10`, color }}
        >
          {icon}
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="text-[15px] font-bold text-slate-800 truncate" title={title}>{title}</div>
          {description && <InfoTooltip description={description} />}
        </div>
      </div>

      <div className="flex items-end gap-2 mb-2">
        <div className="text-3xl font-extrabold text-slate-900 leading-none tracking-tight">{value}</div>
        {trend.direction !== 'stable' && (
          <div
            className={`flex items-center gap-0.5 text-[12px] font-bold pb-1 px-1.5 py-0.5 rounded-full ${
              trend.direction === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}
          >
            {trend.direction === 'up' ? (
              <ChevronUp size={12} strokeWidth={3} />
            ) : (
              <ChevronDown size={12} strokeWidth={3} />
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      
      {subtitle && <div className="text-[13px] text-slate-500 font-medium">{subtitle}</div>}

      {hasComparisons && (
        <div className="mt-auto pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Top Performers
            </div>
            {metricType && (
              <div className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                 {metricType === 'visibility' ? 'Score' : metricType === 'sentiment' ? '1-100' : '%'}
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-3">
            {comparisons.map((item, index) => {
              // Calculate width: specific metric types use absolute 0-100 scale
              // Otherwise fall back to relative to max (old behavior)
              let width = 0;
              if (metricType) {
                // If the value is > 100 (e.g. some oddly high visibility), clamp it. 
                // Mostly these are 0-100.
                width = item.value;
              } else {
                width = maxComparisonValue > 0 ? (item.value / maxComparisonValue) * 100 : 0;
              }

              const { background: dotBackground } = getVisualStyles(item.value, metricType);
              
              return (
                <div key={item.label} className="flex flex-col gap-1.5 w-full group/item">
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-50 text-[10px] font-bold text-slate-400 group-hover/item:bg-slate-100 group-hover/item:text-slate-600 transition-colors">
                        {index + 1}
                      </span>
                      <span className={`truncate font-medium transition-colors ${item.isBrand ? 'text-slate-900' : 'text-slate-600 group-hover/item:text-slate-800'}`}>
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                       {/* Heatmap Dot */}
                      <div 
                        className="w-2 h-2 rounded-full shadow-sm"
                        style={{ background: dotBackground }}
                      />
                      <span className={`font-bold tabular-nums ${item.isBrand ? 'text-slate-900' : 'text-slate-700'}`}>
                        {item.value.toFixed(1).replace(/\.0$/, '')}{comparisonSuffix}
                      </span>
                    </div>
                  </div>
                  
                  {/* Heatmap Bar Container */}
                  <div className="relative h-2.5 w-full bg-slate-100/80 rounded-full overflow-hidden shadow-inner">
                    {/* Animated Bar */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.max(width, 2), 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                      className="absolute top-0 left-0 h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${color}40 0%, ${color} 100%)`,
                        boxShadow: `0 0 8px ${color}20`
                      }}
                    />
                    {/* Glass/Gloss Overlay effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none rounded-full" />
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

