import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SourcesDonutChartProps {
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

export const SourcesDonutChart = ({ racingChartData }: SourcesDonutChartProps) => {
  const latestData = racingChartData.sources.map(source => ({
    domain: source.domain,
    value: source.data[source.data.length - 1],
    color: source.color,
    type: source.type
  }));

  const totalCitations = latestData.reduce((sum, item) => sum + item.value, 0);

  const data = {
    labels: latestData.map(item => item.domain),
    datasets: [
      {
        data: latestData.map(item => item.value),
        backgroundColor: latestData.map(item => item.color),
        borderColor: '#ffffff',
        borderWidth: 2,
      }
    ]
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
          generateLabels: (chart: any) => {
            const datasets = chart.data.datasets;
            return chart.data.labels.map((label: string, i: number) => ({
              text: `${label} (${latestData[i].value}%)`,
              fillStyle: datasets[0].backgroundColor[i],
              hidden: false,
              index: i
            }));
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed;
            const percentage = ((value / totalCitations) * 100).toFixed(1);
            return `${label}: ${value}% (${percentage}% of total)`;
          }
        }
      }
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
        Top 10 Sources Distribution
      </h3>
      <div className="h-[400px] flex items-center justify-center">
        <div className="relative w-full h-full">
          <Doughnut data={data} options={options} />
          <div className="absolute top-1/2 left-[30%] transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="text-2xl font-bold text-[var(--text-body)]">{latestData.length}</div>
            <div className="text-xs text-[var(--text-caption)]">Sources</div>
          </div>
        </div>
      </div>
    </div>
  );
};
