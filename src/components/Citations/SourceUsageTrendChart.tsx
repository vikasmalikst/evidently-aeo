import { useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useChartResize } from '../../hooks/useChartResize';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface SourceUsageTrendChartProps {
  trendData: {
    dateRange: string;
    dates: string[];
    sources: Array<{
      domain: string;
      data: number[];
      color: string;
      trend: { direction: 'up' | 'down' | 'stable'; percent: number };
    }>;
  };
}

export const SourceUsageTrendChart = ({ trendData }: SourceUsageTrendChartProps) => {
  const chartRef = useRef<any>(null);
  
  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, trendData.sources.length > 0);
  
  const data = {
    labels: trendData.dates,
    datasets: trendData.sources.map(source => ({
      label: source.domain,
      data: source.data,
      borderColor: source.color,
      backgroundColor: source.color,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 5,
      borderWidth: 2
    }))
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.y}%`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'var(--chart-grid)'
        },
        ticks: {
          color: 'var(--chart-label)',
          font: {
            size: 12
          }
        }
      },
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'var(--chart-grid)'
        },
        ticks: {
          callback: (value: any) => `${value}%`,
          color: 'var(--chart-label)',
          font: {
            size: 12
          }
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp size={14} className="text-[var(--text-success)]" />;
      case 'down':
        return <TrendingDown size={14} className="text-[var(--text-error)]" />;
      default:
        return <Minus size={14} className="text-[var(--text-caption)]" />;
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
        Source Usage Trends
      </h3>
      <div className="h-[350px] mb-4">
        <Line data={data} options={options} ref={chartRef} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {trendData.sources.map((source, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2 rounded border border-[var(--border-default)]"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: source.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--text-body)] truncate">
                {source.domain}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="font-semibold text-[var(--text-body)]">
                  {source.data[source.data.length - 1]}%
                </span>
                <span className="flex items-center gap-0.5">
                  {getTrendIcon(source.trend.direction)}
                  <span className={`${
                    source.trend.direction === 'up' ? 'text-[var(--text-success)]' :
                    source.trend.direction === 'down' ? 'text-[var(--text-error)]' :
                    'text-[var(--text-caption)]'
                  }`}>
                    {source.trend.percent > 0 ? '+' : ''}{source.trend.percent}%
                  </span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
