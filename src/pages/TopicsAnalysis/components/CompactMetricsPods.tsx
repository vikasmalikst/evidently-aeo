import { useState, useMemo } from 'react';
import { PieChart, TrendingUp } from 'lucide-react';
import { IconFolderSearch, IconSpace } from '@tabler/icons-react';
import type { Portfolio, Performance, Topic } from '../types';

export type PodId = 'portfolio' | 'performance' | 'gaps' | 'momentum';

interface CompactMetricsPodsProps {
  portfolio: {
    totalTopics: number;
    categories: number;
    searchVolume: number;
    lastUpdated: string; // ISO date string
  };
  performance: {
    avgSoA: number;
    maxSoA: number;
    minSoA: number;
    avgSoADelta?: number; // Change from previous period (percentage points)
    weeklyGainer: {
      topic: string;
      delta: number;
      category: string;
    };
  };
  topics?: Topic[]; // Topics array for gap calculation
  onPodClick?: (podId: PodId) => void;
}

// Calculate gap count: topics where Brand SOA < Competitor Avg SOA
const getGapCount = (topics: Topic[]): number => {
  if (!topics || topics.length === 0) {
    return 0;
  }
  
  // Count topics where brand's SOA is less than industry average SOA
  // Even if the difference is very small, it's still a gap
  return topics.filter(topic => {
    const brandSoA = topic.currentSoA || (topic.soA * 20); // Brand SOA in percentage (0-100)
    
    // industryAvgSoA is stored as multiplier (0-5x), convert to percentage (0-100)
    const industryAvgSoA = topic.industryAvgSoA !== null && topic.industryAvgSoA !== undefined && topic.industryAvgSoA > 0
      ? (topic.industryAvgSoA * 20) // Convert multiplier to percentage
      : null;
    
    // If industry average exists and brand SOA is less than it (even slightly), it's a gap
    if (industryAvgSoA !== null && brandSoA < industryAvgSoA) {
      return true;
    }
    
    return false;
  }).length;
};

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


interface MetricPodProps {
  podId: PodId;
  icon: React.ReactNode;
  primaryValue: string;
  label: string;
  secondary: string;
  changeIndicator?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  tooltip: string;
  borderColor: string;
  iconColor: string;
  hoverBgColor: string;
  onPodClick?: (podId: PodId) => void;
  isLongText?: boolean; // For pods with long text values (like Trending topic names)
}

const MetricPod = ({
  podId,
  icon,
  primaryValue,
  label,
  secondary,
  changeIndicator,
  tooltip,
  borderColor,
  iconColor,
  hoverBgColor,
  onPodClick,
  isLongText = false,
}: MetricPodProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    const timeout = setTimeout(() => setShowTooltip(true), 200);
    setTooltipTimeout(timeout);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowTooltip(false);
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      setTooltipTimeout(null);
    }
  };

  const handleClick = () => {
    onPodClick?.(podId);
  };

  const getChangeColor = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return '#06c686';
      case 'down':
        return '#f94343';
      default:
        return '#6c7289';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          w-full sm:w-[220px] md:w-[240px]
          min-w-[140px] sm:min-w-[220px] md:min-w-[240px]
          h-[150px] md:h-[160px]
          px-5 py-5
          bg-white
          border border-[var(--border-default)]
          rounded-lg
          shadow-sm
          transition-all duration-200
          cursor-pointer
          flex flex-col
          relative
          ${isHovered ? 'shadow-md' : ''}
        `}
        style={{
          borderColor: isHovered ? borderColor : 'var(--border-default)',
          backgroundColor: isHovered ? hoverBgColor : 'white',
        }}
        aria-label={tooltip}
        aria-describedby={`tooltip-${podId}`}
      >
        {/* Icon and Title - Inline */}
        <div className="flex items-center gap-3 mb-4 w-full">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ color: iconColor }}
          >
            {icon}
          </div>
          <div
            className="font-semibold text-left flex-1"
            style={{
              fontSize: '16px',
              color: '#1a1d29',
              lineHeight: 1.2,
            }}
          >
            {label}
          </div>
        </div>

        {/* Content Container */}
        <div className="flex flex-col flex-1 justify-between">
          {/* Primary Value */}
          <div
            className={`font-bold leading-none mb-2 ${isLongText ? 'line-clamp-2' : ''}`}
            style={{
              fontSize: isLongText ? '14px' : '28px',
              color: '#1a1d29',
              lineHeight: isLongText ? 1.4 : 1.2,
              wordBreak: isLongText ? 'break-word' : 'normal',
            }}
            title={primaryValue}
          >
            {primaryValue}
          </div>

          {/* Secondary */}
          <div
            className="leading-normal mb-2"
            style={{
              fontSize: '12px',
              color: '#393e51',
              lineHeight: 1.4,
            }}
            title={secondary}
          >
            {secondary}
          </div>

          {/* Change Indicator */}
          {changeIndicator && (
            <div
              className="flex items-center gap-1 leading-normal"
              style={{
                fontSize: '11px',
                color: getChangeColor(changeIndicator.direction),
                lineHeight: 1.4,
              }}
            >
              {changeIndicator.direction === 'up' && (
                <TrendingUp size={12} style={{ color: getChangeColor(changeIndicator.direction) }} />
              )}
              {changeIndicator.direction === 'down' && (
                <TrendingUp size={12} style={{ color: getChangeColor(changeIndicator.direction), transform: 'rotate(180deg)' }} />
              )}
              <span>{changeIndicator.value}</span>
            </div>
          )}
        </div>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          id={`tooltip-${podId}`}
          className="absolute z-10 pointer-events-none"
          style={{
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1a1d29',
            color: '#ffffff',
            padding: '12px',
            borderRadius: '8px',
            maxWidth: '220px',
            fontSize: '12px',
            fontFamily: 'IBM Plex Sans, sans-serif',
            lineHeight: 1.4,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {tooltip}
          {/* Arrow */}
          <div
            className="absolute"
            style={{
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #1a1d29',
            }}
          />
        </div>
      )}
    </div>
  );
};

export const CompactMetricsPods = ({
  portfolio,
  performance,
  topics = [],
  onPodClick,
}: CompactMetricsPodsProps) => {
  const lastAnalyzed = useMemo(() => formatDate(portfolio.lastUpdated), [portfolio.lastUpdated]);
  const gapCount = useMemo(
    () => getGapCount(topics),
    [topics]
  );

  return (
    <div
      className="flex flex-wrap gap-4 w-full"
      style={{
        justifyContent: 'flex-start',
        // Desktop: 5 pods in row, Tablet: 3+2 wrap, Mobile: 2 per row
      }}
    >
      {/* POD 1: Topics */}
      <MetricPod
        podId="portfolio"
        icon={<IconFolderSearch size={20} />}
        primaryValue={portfolio.totalTopics.toString()}
        label="Topics"
        secondary={`${portfolio.categories} categories`}
        changeIndicator={{
          value: `Last analyzed: ${lastAnalyzed}`,
          direction: 'neutral',
        }}
        tooltip={`${portfolio.totalTopics} topics tracked across ${portfolio.categories} categories. Last analyzed ${lastAnalyzed}. [Edit topics]`}
        borderColor="#1a1d29"
        iconColor="#1a1d29"
        hoverBgColor="#f9f9fb"
        onPodClick={onPodClick}
      />

      {/* POD 2: Avg SOA */}
      <MetricPod
        podId="performance"
        icon={<PieChart size={20} />}
        primaryValue={`${(performance.avgSoA * 20).toFixed(1)}%`}
        label="Avg SOA"
        secondary=""
        changeIndicator={performance.avgSoADelta !== undefined && performance.avgSoADelta !== null ? {
          value: `${Math.abs(performance.avgSoADelta).toFixed(1)}%`,
          direction: performance.avgSoADelta > 0 ? 'up' : performance.avgSoADelta < 0 ? 'down' : 'neutral',
        } : undefined}
        tooltip={`Your average Share of Answer is ${(performance.avgSoA * 20).toFixed(1)}%${performance.avgSoADelta !== undefined && performance.avgSoADelta !== null ? ` (${performance.avgSoADelta > 0 ? '+' : ''}${performance.avgSoADelta.toFixed(1)}% from previous period)` : ''}`}
        borderColor="#00bcdc"
        iconColor="#00bcdc"
        hoverBgColor="#e6f7f9"
        onPodClick={onPodClick}
      />

      {/* POD 3: Trending */}
      <MetricPod
        podId="momentum"
        icon={<TrendingUp size={20} />}
        primaryValue={performance.weeklyGainer.topic}
        label="Trending"
        secondary={performance.weeklyGainer.category}
        isLongText={true}
        changeIndicator={performance.weeklyGainer.delta !== undefined && performance.weeklyGainer.delta !== null && performance.weeklyGainer.delta !== 0 ? {
          value: `${Math.abs(performance.weeklyGainer.delta).toFixed(1)}%`,
          direction: performance.weeklyGainer.delta > 0 ? 'up' : 'down',
        } : undefined}
        tooltip={`${performance.weeklyGainer.topic} is the top trending topic${performance.weeklyGainer.delta !== undefined && performance.weeklyGainer.delta !== null && performance.weeklyGainer.delta !== 0 ? ` with ${performance.weeklyGainer.delta > 0 ? '+' : ''}${performance.weeklyGainer.delta.toFixed(1)}% change` : ''}. [View topic]`}
        borderColor="#06c686"
        iconColor="#06c686"
        hoverBgColor="#f0fdf4"
        onPodClick={onPodClick}
      />

      {/* POD 4: Gaps */}
      <MetricPod
        podId="gaps"
        icon={<IconSpace size={20} />}
        primaryValue={gapCount.toString()}
        label="Gaps"
        secondary="Gaps"
        tooltip={`${gapCount} topics where your SOA is below competitor average. These are high-value opportunities to gain share. [View gaps]`}
        borderColor="#f94343"
        iconColor="#f94343"
        hoverBgColor="#fff5f5"
        onPodClick={onPodClick}
      />
    </div>
  );
};

export default CompactMetricsPods;

