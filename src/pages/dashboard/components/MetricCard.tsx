
import { ChevronUp, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { HelpButton } from '../../../components/common/HelpButton';
import type { MetricCardProps } from '../types';
import { InfoTooltip } from './InfoTooltip';

const ZoneStatusBar = ({ value, metricType, queryTags = [] }: { value: number, metricType: string, queryTags?: string[] }) => {
  let zones = { red: 0, yellow: 0 };
  let maxScale = 100;
  let labels = { min: 0, mid: 50, max: 100 };

  const isBlind = queryTags.includes('blind');
  const isBias = queryTags.includes('bias');

  if (metricType === 'visibility') {
    if (isBlind) {
      // Blind: Scale 0-50. Red 0-17, Yellow 17-30, Green 31+
      maxScale = 50;
      zones = { red: 17, yellow: 30 };
      labels = { min: 0, mid: 25, max: 50 };
    } else if (isBias) {
      // Bias: Scale 0-100. Red 0-33, Yellow 33-50, Green 50+
      maxScale = 100;
      zones = { red: 33, yellow: 50 };
      labels = { min: 0, mid: 50, max: 100 };
    } else {
      // ALL: Scale 0-50. Red 0-17, Yellow 18-30, Green 30+
      maxScale = 50;
      zones = { red: 17, yellow: 30 };
      labels = { min: 0, mid: 25, max: 50 };
    }
  } else if (metricType === 'share') {
    // Share of Answer: Scale 0-100. Red 0-35, Yellow 35-70, Green 70+
    maxScale = 100;
    zones = { red: 35, yellow: 70 };
    labels = { min: 0, mid: 50, max: 100 };
  } else if (metricType === 'sentiment') {
    // Sentiment: Scale 0-100. Red 0-50, Yellow 50-70, Green 70+
    maxScale = 100;
    zones = { red: 50, yellow: 70 };
    labels = { min: 0, mid: 50, max: 100 };
  } else if (metricType === 'brandPresence') {
    // Brand Presence: Scale 0-100
    maxScale = 100;
    labels = { min: 0, mid: 50, max: 100 };
    
    if (isBias) {
      // Bias: Red 0-50, Yellow 50-70, Green 70+
      zones = { red: 50, yellow: 70 };
    } else {
      // Blind or ALL: Red 0-33, Yellow 33-66, Green 66+
      zones = { red: 33, yellow: 66 };
    }
  } else {
    // Fallback for any other metric types
    zones = { red: 33, yellow: 66 };
    maxScale = 100;
    labels = { min: 0, mid: 50, max: 100 };
  }

  // Calculate percentage for the bar width (relative to maxScale)
  const percentage = Math.min(Math.max((value / maxScale) * 100, 0), 100);

  // Gradient calculation based on zone positions relative to maxScale
  const redPos = (zones.red / maxScale) * 100;
  const yellowPos = (zones.yellow / maxScale) * 100;

  // Softer/Cooler Palette
  const colors = {
    red: '#f87171',    // Red-400
    yellow: '#fbbf24', // Amber-400
    green: '#4ade80'   // Green-400
  };

  const gradient = `linear-gradient(90deg, 
    ${colors.red} 0%, 
    ${colors.red} ${Math.max(0, redPos - 5)}%, 
    ${colors.yellow} ${Math.min(100, redPos + 5)}%, 
    ${colors.yellow} ${Math.max(0, yellowPos - 5)}%, 
    ${colors.green} ${Math.min(100, yellowPos + 5)}%, 
    ${colors.green} 100%)`;

  return (
    <div className="relative w-full mb-5">
      <div className="relative h-2.5 w-full">
        {/* Gradient Bar */}
        <div 
          className="absolute inset-0 rounded-full overflow-hidden shadow-inner"
          style={{ background: gradient }}
        />
        
        {/* Marker - Triangle Arrow */}
        <div
          className="absolute -top-[1px] z-10 transform -translate-x-1/2 -translate-y-full drop-shadow-md"
          style={{ left: `${percentage}%` }}
        >
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-900" />
        </div>
      </div>

      {/* Scale Markers & Labels */}
      <div className="absolute top-3 left-0 right-0 h-4 pointer-events-none">
        {/* Min */}
        <div className="absolute left-0 -translate-x-1/2 flex flex-col items-center">
          <div className="h-1 w-px bg-slate-300 mb-0.5"></div>
          <span className="text-[9px] font-medium text-slate-400 leading-none">{labels.min}</span>
        </div>
        
        {/* Mid */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="h-1 w-px bg-slate-300 mb-0.5"></div>
          <span className="text-[9px] font-medium text-slate-400 leading-none">{labels.mid}</span>
        </div>

        {/* Max */}
        <div className="absolute right-0 translate-x-1/2 flex flex-col items-center">
          <div className="h-1 w-px bg-slate-300 mb-0.5"></div>
          <span className="text-[9px] font-medium text-slate-400 leading-none">{labels.max}</span>
        </div>
      </div>
    </div>
  );
};

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
  actionPosition = 'inside',
  hideComparisonHeader,
  queryTags = []
}: MetricCardProps) => {
  const hasComparisons = comparisons.length > 0;
  const maxComparisonValue = hasComparisons
    ? Math.max(...comparisons.map((item) => item.value))
    : 0;

  // Optimized Color Logic with Gradients and Glows
  const getVisualStyles = (value: number, type?: 'visibility' | 'share' | 'sentiment' | 'brandPresence', tags: string[] = []) => {
    // Default fallback
    if (!type) return {
      color: color,
      background: `linear-gradient(90deg, ${color}20 0%, ${color} 100%)`,
      shadow: 'none'
    };

    let baseColor = '';
    const isBlind = tags.includes('blind');
    const isBias = tags.includes('bias');

    // Visibility
    if (type === 'visibility') {
      if (isBlind) {
        // Red 0-17, Yellow 17-30, Green 31+
        if (value < 17) baseColor = 'red';
        else if (value <= 30) baseColor = 'amber';
        else baseColor = 'green';
      } else if (isBias) {
        // Red 0-33, Yellow 33-50, Green 50+
        if (value < 33) baseColor = 'red';
        else if (value <= 50) baseColor = 'amber';
        else baseColor = 'green';
      } else {
        // ALL: Red 0-17, Yellow 18-30, Green 30+
        if (value < 17) baseColor = 'red';
        else if (value <= 30) baseColor = 'amber';
        else baseColor = 'green';
      }
    }
    // Share of Answer: Red 0-35, Yellow 35-70, Green 70+
    else if (type === 'share') {
      if (value < 35) baseColor = 'red';
      else if (value < 70) baseColor = 'amber';
      else baseColor = 'green';
    }
    // Sentiment: Red 0-50, Yellow 50-70, Green 70+
    else if (type === 'sentiment') {
      if (value < 50) baseColor = 'red';
      else if (value < 70) baseColor = 'amber';
      else baseColor = 'green';
    }
    // Brand Presence
    else if (type === 'brandPresence') {
      if (isBias) {
        // Bias: Red 0-50, Yellow 50-70, Green 70+
        if (value < 50) baseColor = 'red';
        else if (value < 70) baseColor = 'amber';
        else baseColor = 'green';
      } else {
        // Blind or ALL: Red 0-33, Yellow 33-66, Green 66+
        if (value < 33) baseColor = 'red';
        else if (value < 66) baseColor = 'amber';
        else baseColor = 'green';
      }
    }

    switch (baseColor) {
      case 'red':
        return {
          color: '#ef4444',
          background: 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)', // Red-500 to Red-400
          shadow: '0 0 8px rgba(239, 68, 68, 0.4)'
        };
      case 'amber':
        return {
          color: '#f59e0b',
          background: 'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)', // Amber-600 to Amber-400
          shadow: '0 0 8px rgba(245, 158, 11, 0.4)'
        };
      case 'green':
        return {
          color: '#22c55e',
          background: 'linear-gradient(90deg, #16a34a 0%, #4ade80 100%)', // Green-600 to Green-400
          shadow: '0 0 8px rgba(34, 197, 94, 0.4)'
        };
      default:
        return {
          color: color,
          background: `linear-gradient(90deg, ${color}40 0%, ${color} 100%)`,
          shadow: `0 0 8px ${color}40`
        };
    }
  };

  // Determine dynamic visual styles based on metric value
  // Note: We parse the numeric value from the display string if possible, or assume it's passed as number elsewhere.
  // The 'value' prop is string | number. If it's a string like "12%", we need to parse it.
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const visualStyles = getVisualStyles(isNaN(numericValue) ? 0 : numericValue, metricType, queryTags);
  
  // Use dynamic color if we have a metric type that supports it, otherwise fallback to prop
  const displayColor = metricType ? visualStyles.color : color;

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:z-20 p-5 flex flex-col relative group/card h-full">
      {/* Subtle top gradient accent */}
      <div
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20 rounded-t-xl"
        style={{ color: displayColor }}
      />

      {headerAction && (
        <div className={`absolute z-20 ${actionPosition === 'outside-top'
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
          style={{ backgroundColor: `${displayColor}10`, color: displayColor }}
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
            className={`flex items-center gap-0.5 text-[12px] font-bold pb-1 px-1.5 py-0.5 rounded-full ${trend.direction === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
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
          {!hideComparisonHeader && (
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
          )}

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

              return (
                <div key={item.label} className="flex flex-col gap-1.5 w-full group/item">
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {!hideComparisonHeader && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-50 text-[10px] font-bold text-slate-400 group-hover/item:bg-slate-100 group-hover/item:text-slate-600 transition-colors">
                          {index + 1}
                        </span>
                      )}
                      <span className={`truncate font-medium transition-colors ${item.isBrand ? 'text-slate-900' : 'text-slate-600 group-hover/item:text-slate-800'}`}>
                        {item.label}
                      </span>
                    </div>
                  </div>

                  {/* Heatmap Bar Container */}
                  {metricType ? (
                    <ZoneStatusBar value={item.value} metricType={metricType} queryTags={queryTags} />
                  ) : (
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

