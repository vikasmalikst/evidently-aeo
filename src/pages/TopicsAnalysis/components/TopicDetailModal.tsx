import { X, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import type { Topic } from '../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface TopicDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: Topic | null;
  metricType?: 'share' | 'visibility' | 'sentiment';
}

// Get trend icon and color
const getTrendDisplay = (direction: string, delta: number) => {
  switch (direction) {
    case 'up':
      return {
        icon: TrendingUp,
        color: 'var(--success500)',
        symbol: '↑',
      };
    case 'down':
      return {
        icon: TrendingDown,
        color: 'var(--dataviz-4)',
        symbol: '↓',
      };
    default:
      return {
        icon: Minus,
        color: 'var(--primary300)',
        symbol: '→',
      };
  }
};

// Get SoA color based on scale
const getSoAColor = (soA: number): string => {
  if (soA >= 3.0) return 'var(--accent500)'; // Cyan - Strong Position
  if (soA >= 2.0) return 'var(--accent600)'; // Teal - Competitive
  if (soA >= 1.0) return 'var(--dataviz-4)'; // Orange - Opportunity
  return 'var(--text-headings)'; // Navy - Citation Gap
};

// Get sentiment color
const getSentimentColor = (sentiment: string): string => {
  switch (sentiment) {
    case 'positive':
      return 'var(--success500)';
    case 'negative':
      return 'var(--error500)';
    default:
      return 'var(--primary300)';
  }
};

export const TopicDetailModal = ({ isOpen, onClose, topic, metricType = 'share' }: TopicDetailModalProps) => {
  if (!isOpen || !topic) return null;

  const metricLabel = metricType === 'share' ? 'Share of Answer' : metricType === 'visibility' ? 'Visibility Score' : 'Sentiment Score';
  const valueSuffix = metricType === 'share' ? '%' : '';
  const currentValue =
    metricType === 'visibility'
      ? (topic.currentVisibility ?? 0)
      : metricType === 'sentiment'
        ? (topic.currentSentiment ?? 0)
        : (topic.currentSoA ?? (topic.soA * 20));
  
  // Best-effort trend series (we only have a 12-slot array; for share/sentiment it may be synthetic)
  const previousValue = topic.visibilityTrend && topic.visibilityTrend.length > 0
    ? topic.visibilityTrend[0]
    : currentValue - (topic.trend.delta * 20);
  
  const valueChange = currentValue - previousValue;
  const valueChangePercent = previousValue > 0 ? ((valueChange / previousValue) * 100) : 0;
  
  const avgIndustryValue =
    metricType === 'visibility'
      ? topic.industryAvgVisibility ?? null
      : metricType === 'sentiment'
        ? topic.industryAvgSentiment ?? null
        : (topic.industryAvgSoA !== null && topic.industryAvgSoA !== undefined && topic.industryAvgSoA > 0
            ? topic.industryAvgSoA * 20
            : null);
  
  const trendDisplay = getTrendDisplay(topic.trend.direction, topic.trend.delta);
  const TrendIcon = trendDisplay.icon;

  // Prepare trend chart data
  const trendChartData = topic.visibilityTrend && topic.visibilityTrend.length === 12
    ? topic.visibilityTrend
    : Array.from({ length: 12 }, (_, i) => {
        const baseValue = previousValue;
        const trend = valueChange / 11;
        return Math.max(0, Math.min(100, baseValue + (trend * i)));
      });

  const chartData = {
    labels: Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`),
    datasets: [
      {
        label: metricType === 'share' ? 'Share of Answer (%)' : metricType === 'visibility' ? 'Visibility Score' : 'Sentiment Score',
        data: trendChartData,
        borderColor: '#498cf9',
        backgroundColor: 'rgba(73, 140, 249, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#498cf9',
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(26, 29, 41, 0.96)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'var(--chart-axis)',
        borderWidth: 1,
        padding: 10,
        caretSize: 0,
        callbacks: {
          label: (context: any) => {
            return `${context.parsed.y.toFixed(1)}${valueSuffix}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: '#e8e9ed',
        },
        ticks: {
          color: '#393e51',
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: '#e8e9ed',
        },
        ticks: {
          color: '#393e51',
          callback: (value: any) => `${value}${valueSuffix}`,
          font: {
            size: 11,
          },
        },
      },
    },
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-modal-title"
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[51] bg-white rounded-lg shadow-xl w-[95%] sm:w-[90%] max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-default)]">
          <div className="flex-1 min-w-0">
            <h2
              id="topic-modal-title"
              className="text-xl sm:text-2xl font-semibold text-[var(--text-headings)] mb-2"
            >
              {topic.name}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-2 py-1 text-xs font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-caption)]">
                {topic.category}
              </span>
              <span className="text-sm text-[var(--text-caption)]">
                Rank #{topic.rank}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors flex-shrink-0 ml-4"
            aria-label="Close modal"
          >
            <X size={24} className="text-[var(--text-body)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {/* Current KPI */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="text-xs text-[var(--text-caption)] mb-1">{metricLabel}</div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-2xl font-bold"
                  style={{ color: metricType === 'share' ? getSoAColor(topic.soA) : 'var(--text-headings)' }}
                >
                  {Number(currentValue).toFixed(1)}{valueSuffix}
                </span>
              </div>
            </div>

            {/* Previous Period */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="text-xs text-[var(--text-caption)] mb-1">Previous Period</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--text-body)]">
                  {Number(previousValue).toFixed(1)}{valueSuffix}
                </span>
              </div>
            </div>

            {/* Change */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="text-xs text-[var(--text-caption)] mb-1">Change</div>
              <div className="flex items-center gap-2">
                <TrendIcon
                  size={20}
                  style={{ color: trendDisplay.color }}
                />
                <span
                  className="text-2xl font-bold"
                  style={{ color: trendDisplay.color }}
                >
                  {valueChange >= 0 ? '+' : ''}{valueChange.toFixed(1)}{valueSuffix}
                </span>
              </div>
              <div className="text-xs text-[var(--text-caption)] mt-1">
                {valueChangePercent >= 0 ? '+' : ''}{valueChangePercent.toFixed(1)}% vs previous
              </div>
            </div>

            {/* Competitor KPI */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="text-xs text-[var(--text-caption)] mb-1">Competitor {metricLabel}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--text-body)]">
                  {avgIndustryValue !== null ? `${avgIndustryValue.toFixed(1)}${valueSuffix}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--text-headings)] mb-3 uppercase tracking-wide">
              12-Week Trend
            </h3>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="h-[250px]">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Sentiment */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="text-xs text-[var(--text-caption)] mb-2">Sentiment</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getSentimentColor(topic.sentiment) }}
                />
                <span className="text-sm font-medium text-[var(--text-body)] capitalize">
                  {topic.sentiment}
                </span>
              </div>
            </div>

            {/* Trend Direction */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="text-xs text-[var(--text-caption)] mb-2">Trend Direction</div>
              <div className="flex items-center gap-2">
                <TrendIcon
                  size={18}
                  style={{ color: trendDisplay.color }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: trendDisplay.color }}
                >
                  {trendDisplay.symbol} {Math.abs(topic.trend.delta * 20).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Sources */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-headings)] mb-3 uppercase tracking-wide">
              Top Sources ({topic.sources.length})
            </h3>
            <div className="space-y-2">
              {topic.sources.slice(0, 5).map((source, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: source.type === 'brand' ? '#00bcdc' : '#498cf9',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-body)] truncate">
                        {source.name}
                      </div>
                      <div className="text-xs text-[var(--text-caption)]">
                        {source.type} • {source.citations ?? 0} citations
                      </div>
                    </div>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={16} className="text-[var(--text-caption)]" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

