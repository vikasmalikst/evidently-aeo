import { useState, useMemo } from 'react';
import { PieChart, TrendingUp, TrendingDown } from 'lucide-react';
import { IconFolderSearch, IconSpace, IconTrendingUp } from '@tabler/icons-react';
import type { Query, QueriesPortfolio, QueriesPerformance } from '../types';

export type PodId = 'portfolio' | 'performance' | 'gaps' | 'momentum';

interface CompactMetricsPodsProps {
  portfolio: QueriesPortfolio;
  performance: QueriesPerformance;
  queries?: Query[]; 
  metricType?: 'visibility' | 'sentiment';
  onPodClick?: (podId: PodId) => void;
}

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
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
  isLongText?: boolean;
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
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => onPodClick?.(podId)}
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
          transition: 'all 160ms ease',
          cursor: 'pointer',
          transform: isHovered ? 'translateY(-1px)' : 'none',
        }}
        aria-label={tooltip}
      >
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
        >
          {primaryValue}
        </div>

        {secondary && (
          <div
            className="leading-normal"
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            {secondary}
          </div>
        )}

        {changeIndicator && (
          <div
            className="flex items-center justify-center gap-1 leading-normal"
            style={{
              fontSize: '11px',
              color: getChangeColor(changeIndicator.direction),
              lineHeight: 1.4,
            }}
          >
            {changeIndicator.direction === 'up' && <TrendingUp size={12} />}
            {changeIndicator.direction === 'down' && <TrendingDown size={12} />}
            <span>{changeIndicator.value}</span>
          </div>
        )}
      </button>

      {showTooltip && (
        <div
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
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
        >
          {tooltip}
          <div
            className="absolute"
            style={{
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
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
  queries = [],
  metricType = 'visibility',
  onPodClick,
}: CompactMetricsPodsProps) => {
  const lastAnalyzed = useMemo(() => formatDate(portfolio.lastUpdated), [portfolio.lastUpdated]);

  const metricLabel = metricType === 'visibility' ? 'Visibility' : 'Sentiment';

  // Compute average from current queries to reflect filtering
  const avgMetricValue = useMemo(() => {
    if (!queries || queries.length === 0) return 0;
    const values = queries
      .map((q) => metricType === 'visibility' ? q.visibilityScore : q.sentimentScore)
      .filter((v): v is number => v !== null && v !== undefined);
    
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }, [queries, metricType]);

  // Gaps: Arbitrarilly defined as metric < 30 for now since we don't have competitor data
  const gapCount = useMemo(() => {
     return queries.filter(q => {
         const val = metricType === 'visibility' ? q.visibilityScore : q.sentimentScore;
         return val !== null && val < 30;
     }).length;
  }, [queries, metricType]);

  const delta = performance.avgVisibilityDelta;
  const trendingPrimaryValue = delta !== undefined
    ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`
    : '—';


  // Determine Top Gainer / Loser based on trend
  const topGainer = performance.topGainer;
  
  return (
    <div
      className="w-full"
      style={{
        display: 'grid',
        gap: '16px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}
    >
      {/* POD 1: Total Queries */}
      <MetricPod
        podId="portfolio"
        icon={<IconFolderSearch size={20} />}
        primaryValue={portfolio.totalQueries.toString()}
        label="Queries"
        secondary="Tracked"
        tooltip={`${portfolio.totalQueries} queries tracked. Last analyzed ${lastAnalyzed}.`}
        borderColor="#1a1d29"
        iconColor="#1a1d29"
        onPodClick={onPodClick}
      />

      {/* POD 2: Avg Score */}
      <MetricPod
        podId="performance"
        icon={<PieChart size={20} />}
        primaryValue={avgMetricValue.toFixed(1)}
        label={`Avg ${metricLabel}`}
        secondary=""
         changeIndicator={delta ? {
             value: `${Math.abs(delta).toFixed(1)}%`,
             direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'
         } : undefined}
        tooltip={`Your average ${metricLabel} is ${avgMetricValue.toFixed(1)}.`}
        borderColor="#00bcdc"
        iconColor="#00bcdc"
        onPodClick={onPodClick}
      />

       {/* POD 3: Top Moving Query */}
       <MetricPod
        podId="momentum"
        icon={<IconTrendingUp size={20} />}
        primaryValue={topGainer && topGainer.query ? topGainer.query : '—'}
        label="Top Mover"
        secondary={topGainer && topGainer.delta ? `+${topGainer.delta.toFixed(1)}%` : ''}
        tooltip={topGainer?.query ? `Query with highest ${metricLabel} gain: ${topGainer.query}` : 'No trend data yet'}
        borderColor="#06c686"
        iconColor="#06c686"
        onPodClick={onPodClick}
        isLongText={true}
      />

      {/* POD 4: Gaps (Low Score) */}
      <MetricPod
        podId="gaps"
        icon={<IconSpace size={20} />}
        primaryValue={gapCount.toString()}
        label="Low Performance"
        secondary={`Queries < 30`}
        tooltip={`${gapCount} queries have ${metricLabel} score below 30. Optimize these.`}
        borderColor="#f94343"
        iconColor="#f94343"
        onPodClick={onPodClick}
      />
    </div>
  );
};
