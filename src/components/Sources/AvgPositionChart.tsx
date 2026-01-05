import { useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { SourceData } from '../../data/mockSourcesData';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useChartResize } from '../../hooks/useChartResize';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface AvgPositionChartProps {
  sources: SourceData[];
}

export const AvgPositionChart = ({ sources }: AvgPositionChartProps) => {
  const chartRef = useRef<any>(null);
  
  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, sources.length > 0);
  
  const sortedSources = [...sources].sort((a, b) => a.avgPosition - b.avgPosition);

  const data = {
    labels: sortedSources.map(s => s.name),
    datasets: [
      {
        label: 'Average Position',
        data: sortedSources.map(s => s.avgPosition),
        backgroundColor: sortedSources.map(s => s.color),
        borderRadius: 6,
        barThickness: 50,
      }
    ]
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
        callbacks: {
          label: (context: any) => {
            return `Position: ${context.parsed.y.toFixed(1)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: 'var(--chart-label)',
          font: {
            size: 14,
            weight: 500
          }
        }
      },
      y: {
        beginAtZero: true,
        max: 5,
        reverse: false,
        grid: {
          color: 'var(--chart-grid)'
        },
        ticks: {
          stepSize: 1,
          color: 'var(--chart-label)',
          font: {
            size: 12
          }
        }
      }
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-headings)]">
          Average Mention Position by Source
        </h3>
        <div className="flex items-center gap-2 text-xs text-[var(--text-caption)]">
          <TrendingUp size={14} className="text-[var(--text-success)]" />
          <span>Lower is better</span>
        </div>
      </div>
      <div className="h-[350px]">
        <Bar data={data} options={options} ref={chartRef} />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2 text-center">
        {sortedSources.map(source => (
          <div key={source.id} className="text-xs">
            <div className="font-semibold text-[var(--text-body)]">{source.avgPosition.toFixed(1)}</div>
            {source.avgPosition < 2.5 ? (
              <TrendingUp size={12} className="text-[var(--text-success)] mx-auto mt-1" />
            ) : (
              <TrendingDown size={12} className="text-[var(--text-warning)] mx-auto mt-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
