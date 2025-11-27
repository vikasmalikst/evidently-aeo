import { useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import { useChartResize } from '../../hooks/useChartResize';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface SourcesLineChartProps {
  racingChartData: {
    timePoints: string[];
    sources: Array<{
      domain: string;
      type: string;
      data: number[];
      color: string;
    }>;
  };
}

export const SourcesLineChart = ({ racingChartData }: SourcesLineChartProps) => {
  const chartRef = useRef<any>(null);
  
  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, racingChartData.sources.length > 0);
  
  const data = {
    labels: racingChartData.timePoints,
    datasets: racingChartData.sources.slice(0, 10).map(source => ({
      label: source.domain,
      data: source.data,
      borderColor: source.color,
      backgroundColor: source.color + '20',
      tension: 0.3,
      fill: false,
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
        position: 'right' as const,
        labels: {
          color: 'var(--text-body)',
          font: {
            size: 12
          },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'line'
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        caretSize: 0,
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
          color: 'var(--chart-label)',
          callback: (value: any) => `${value}%`,
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

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
        Top 10 Sources Over Time - Line Chart
      </h3>
      <div className="h-[400px]">
        <Line data={data} options={options} ref={chartRef} />
      </div>
    </div>
  );
};

