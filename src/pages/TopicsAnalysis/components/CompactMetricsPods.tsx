import { useState, useMemo } from 'react';
import { PieChart, TrendingUp } from 'lucide-react';
import { IconFolderSearch, IconSpace } from '@tabler/icons-react';
import type { Topic } from '../types';

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
  
  // Count topics where brand's SOA is less than competitor average SOA
  // Even if the difference is very small, it's still a gap
  return topics.filter(topic => {
    const brandSoA = topic.currentSoA || (topic.soA * 20); // Brand SOA in percentage (0-100)
    
    // industryAvgSoA is stored as multiplier (0-5x), convert to percentage (0-100)
    // Note: This represents competitor average SOA (calculated from competitor SOA values only)
    const industryAvgSoA = topic.industryAvgSoA !== null && topic.industryAvgSoA !== undefined && topic.industryAvgSoA > 0
      ? (topic.industryAvgSoA * 20) // Convert multiplier to percentage
      : null;
    
    // If competitor average exists and brand SOA is less than it (even slightly), it's a gap
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
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-full"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '14px 16px',
          minHeight: '140px',
          backgroundColor: isHovered ? '#fcfdff' : '#ffffff',
          border: `1px solid ${isHovered ? borderColor : '#e5e7eb'}`,
          borderRadius: '12px',
          boxShadow: isHovered ? '0 10px 24px rgba(15,23,42,0.08)' : '0 8px 18px rgba(15,23,42,0.05)',
          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease',
          cursor: 'pointer',
          position: 'relative',
          transform: isHovered ? 'translateY(-1px)' : 'none',
        }}
        aria-label={tooltip}
        aria-describedby={`tooltip-${podId}`}
      >
        {/* Title */}
        <div className="flex items-center justify-center gap-2 w-full" style={{ marginBottom: '4px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: iconColor }} />
          <span
            style={{
              fontSize: '13px',
              color: '#475569',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {label}
            {icon && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: iconColor, transform: 'scale(0.9)' }}>
                {icon}
              </span>
            )}
          </span>
        </div>

        {/* Primary Value */}
        <div
          className={`font-bold leading-none ${isLongText ? 'line-clamp-2' : ''}`}
          style={{
            fontSize: isLongText ? '16px' : '28px',
            color: '#0f172a',
            lineHeight: isLongText ? 1.35 : 1.15,
            wordBreak: isLongText ? 'break-word' : 'normal',
            marginBottom: '4px',
            textAlign: 'center',
          }}
          title={primaryValue}
        >
          {primaryValue}
        </div>

        {/* Secondary */}
        {secondary && (
          <div
            className="leading-normal"
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              lineHeight: 1.4,
              marginBottom: changeIndicator ? '2px' : 0,
              textAlign: 'center',
            }}
            title={secondary}
          >
            {secondary}
          </div>
        )}

        {/* Change Indicator */}
        {changeIndicator && (
          <div
            className="flex items-center justify-center gap-1 leading-normal"
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
  const avgSoADelta = performance.avgSoADelta;
  const hasAvgSoADelta = avgSoADelta !== undefined && avgSoADelta !== null;
  const currentAvgSoAPercentage = (performance.avgSoA || 0) * 20;
  const previousAvgSoAPercentage = hasAvgSoADelta ? currentAvgSoAPercentage - avgSoADelta : null;
  const trendingDirection = hasAvgSoADelta
    ? avgSoADelta > 0
      ? 'up'
      : avgSoADelta < 0
        ? 'down'
        : 'neutral'
    : 'neutral';
  const trendingPrimaryValue = hasAvgSoADelta
    ? `${avgSoADelta > 0 ? '+' : ''}${avgSoADelta.toFixed(1)}%`
    : 'No delta yet';
  const trendingSecondary = hasAvgSoADelta && previousAvgSoAPercentage !== null
    ? `${currentAvgSoAPercentage.toFixed(1)}% current vs ${previousAvgSoAPercentage.toFixed(1)}% previous`
    : 'Need previous period to compare';

  return (
    <div
      className="w-full"
      style={{
        display: 'grid',
        gap: '16px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}
    >
      {/* POD 1: Topics */}
      <MetricPod
        podId="portfolio"
        icon={<IconFolderSearch size={20} />}
        primaryValue={portfolio.totalTopics.toString()}
        label="Topics"
        secondary=""
        changeIndicator={undefined}
        tooltip={`${portfolio.totalTopics} topics tracked across ${portfolio.categories} categories. Last analyzed ${lastAnalyzed}. [Edit topics]`}
        borderColor="#1a1d29"
        iconColor="#1a1d29"
        onPodClick={onPodClick}
      />

      {/* POD 2: Avg SOA */}
      <MetricPod
        podId="performance"
        icon={<PieChart size={20} />}
        primaryValue={`${(performance.avgSoA * 20).toFixed(1)}%`}
        label="Avg SOA"
        secondary=""
        changeIndicator={undefined}
        tooltip={`Your average Share of Answer is ${(performance.avgSoA * 20).toFixed(1)}%${performance.avgSoADelta !== undefined && performance.avgSoADelta !== null ? ` (${performance.avgSoADelta > 0 ? '+' : ''}${performance.avgSoADelta.toFixed(1)}% from previous period)` : ''}`}
        borderColor="#00bcdc"
        iconColor="#00bcdc"
        onPodClick={onPodClick}
      />

      {/* POD 3: Trending */}
      <MetricPod
        podId="momentum"
        icon={<TrendingUp size={20} />}
        primaryValue={trendingPrimaryValue}
        label="Trending"
        secondary=""
        changeIndicator={undefined}
        tooltip={
          hasAvgSoADelta
            ? `Avg SOA is ${currentAvgSoAPercentage.toFixed(1)}%, ${trendingPrimaryValue} vs previous period${previousAvgSoAPercentage !== null ? ` (${previousAvgSoAPercentage.toFixed(1)}%)` : ''}.`
            : 'Avg SOA change will appear after a previous period is available.'
        }
        borderColor="#06c686"
        iconColor="#06c686"
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
        onPodClick={onPodClick}
      />
    </div>
  );
};

export default CompactMetricsPods;

