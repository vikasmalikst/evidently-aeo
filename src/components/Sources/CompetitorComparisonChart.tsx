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

interface CompetitorComparisonChartProps {
  sources: SourceData[];
}

export const CompetitorComparisonChart = ({ sources }: CompetitorComparisonChartProps) => {
  const chartRef = useRef<any>(null);
  
  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, sources.length > 0);
  
  const sortedSources = [...sources].sort((a, b) => b.mentionCount - a.mentionCount);

  const data = {
    labels: sortedSources.map(s => s.name),
    datasets: [
      {
        label: 'Your Brand',
        data: sortedSources.map(s => s.mentionCount),
        backgroundColor: '#00bcdc',
        borderRadius: 4,
      },
      {
        label: 'Competitor A',
        data: sortedSources.map(s => s.competitorComparison.rival1.mentions),
        backgroundColor: '#0d7c96',
        borderRadius: 4,
      },
      {
        label: 'Competitor B',
        data: sortedSources.map(s => s.competitorComparison.rival2.mentions),
        backgroundColor: '#0d3196',
        borderRadius: 4,
      },
      {
        label: 'Competitor C',
        data: sortedSources.map(s => s.competitorComparison.rival3.mentions),
        backgroundColor: '#54079c',
        borderRadius: 4,
      }
    ]
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: 'var(--text-body)',
          font: {
            size: 12
          },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.x} mentions`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
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
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          color: 'var(--chart-label)',
          font: {
            size: 14,
            weight: '500'
          }
        }
      }
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
        Brand vs Competitors by Source
      </h3>
      <div className="h-[400px]">
        <Bar data={data} options={options} ref={chartRef} />
      </div>
    </div>
  );
};
