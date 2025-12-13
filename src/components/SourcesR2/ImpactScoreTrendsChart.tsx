import { useRef, useMemo } from 'react';
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
import { useChartResize } from '../../hooks/useChartResize';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export interface ImpactScoreTrendSource {
  name: string;
  valueScore: number; // Impact score
  trendData?: number[]; // Historical impact scores over time
}

interface ImpactScoreTrendsChartProps {
  sources: ImpactScoreTrendSource[];
  dates?: string[]; // Date labels for the x-axis
  maxSources?: number;
}

const palette = ['#06b6d4', '#498cf9', '#ac59fb', '#fa8a40', '#f155a2', '#0d7c96', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const ImpactScoreTrendsChart = ({ 
  sources, 
  dates, 
  maxSources = 10 
}: ImpactScoreTrendsChartProps) => {
  const chartRef = useRef<any>(null);
  
  // Get top sources by Impact score
  const topSources = useMemo(() => {
    return [...sources]
      .sort((a, b) => b.valueScore - a.valueScore)
      .slice(0, maxSources);
  }, [sources, maxSources]);

  // Generate dates if not provided (for demo/fallback)
  const chartDates = useMemo(() => {
    if (dates && dates.length > 0) {
      return dates;
    }
    // Generate default dates (last 7 days)
    const defaultDates: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      defaultDates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return defaultDates;
  }, [dates]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = chartDates;
    
    const datasets = topSources.map((source, idx) => {
      const color = palette[idx % palette.length];
      
      // If trend data is available, use it; otherwise create a flat line with current value
      const data = source.trendData && source.trendData.length > 0
        ? source.trendData
        : Array(chartDates.length).fill(source.valueScore);
      
      return {
        label: source.name,
        data,
        borderColor: color,
        backgroundColor: color + '20',
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
        fill: false
      };
    });

    return { labels, datasets };
  }, [topSources, chartDates]);

  const options = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right' as const,
          labels: {
            usePointStyle: true,
            padding: 12,
            font: {
              size: 11
            },
            color: '#475569'
          }
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          callbacks: {
            label: (context: any) => {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#e2e8f0',
            display: true
          },
          ticks: {
            color: '#64748b',
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#e2e8f0',
            display: true
          },
          ticks: {
            color: '#64748b',
            font: {
              size: 11
            },
            callback: (value: any) => value.toFixed(1)
          },
          title: {
            display: true,
            text: 'Impact Score',
            color: '#64748b',
            font: {
              size: 12,
              weight: 'bold' as const
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
  }, []);

  // Handle chart resize
  useChartResize(chartRef, topSources.length > 0);

  if (!topSources.length) {
    return (
      <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center' }}>
        No source data available to display trends.
      </div>
    );
  }

  return (
    <div style={{ height: 400 }}>
      <Line data={chartData} options={options} ref={chartRef} />
    </div>
  );
};

