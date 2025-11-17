import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface SourcesBarChartProps {
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

export const SourcesBarChart = ({ racingChartData }: SourcesBarChartProps) => {
  const latestData = racingChartData.sources.map(source => ({
    domain: source.domain,
    value: source.data[source.data.length - 1],
    color: source.color,
    type: source.type
  })).sort((a, b) => b.value - a.value);

  // Create gradient for each bar
  const getGradient = (ctx: any, chartArea: any) => {
    if (!chartArea) return '#498cf9';
    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
    gradient.addColorStop(0, '#498cf9');
    gradient.addColorStop(1, '#0d3196');
    return gradient;
  };

  const data = {
    labels: latestData.map(item => item.domain),
    datasets: [
      {
        label: 'Citation Percentage',
        data: latestData.map(item => item.value),
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return '#498cf9';
          return getGradient(ctx, chartArea);
        },
        borderColor: '#ffffff',
        borderWidth: 0,
        borderRadius: 4,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        caretSize: 0,
        callbacks: {
          label: (context: any) => {
            return `${context.parsed.x}%`;
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
          color: 'var(--chart-label)',
          callback: (value: any) => `${value}%`
        }
      },
      y: {
        grid: {
          display: true,
          color: '#d4d4d8'
        },
        ticks: {
          color: 'var(--chart-label)'
        }
      }
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
        Top 10 Sources - Bar Chart
      </h3>
      <div className="h-[400px]">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

