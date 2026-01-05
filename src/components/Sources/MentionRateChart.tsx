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
import { useChartResize } from '../../hooks/useChartResize';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface MentionRateChartProps {
  sources: SourceData[];
}

export const MentionRateChart = ({ sources }: MentionRateChartProps) => {
  const chartRef = useRef<any>(null);
  
  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, sources.length > 0);
  
  const sortedSources = [...sources].sort((a, b) => b.mentionRate - a.mentionRate);

  const data = {
    labels: sortedSources.map(s => s.name),
    datasets: [
      {
        label: 'Mention Rate',
        data: sortedSources.map(s => (s.mentionRate * 100).toFixed(0)),
        backgroundColor: sortedSources.map(s => s.color),
        borderRadius: 6,
        barThickness: 40,
      }
    ]
  };

  const options = {
    indexAxis: 'y' as const,
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
            const source = sortedSources[context.dataIndex];
            return `${context.parsed.x}% (${source.mentionCount} mentions)`;
          }
        }
      }
    },
    scales: {
      x: {
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
      },
      y: {
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
      }
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
        Brand Mention Rate by Source
      </h3>
      <div className="h-[350px]">
        <Bar data={data} options={options} ref={chartRef} />
      </div>
    </div>
  );
};
