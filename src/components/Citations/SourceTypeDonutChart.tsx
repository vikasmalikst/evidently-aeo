import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SourceTypeDistribution } from '../../data/mockCitationSourcesData';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SourceTypeDonutChartProps {
  distribution: SourceTypeDistribution[];
}

export const SourceTypeDonutChart = ({ distribution }: SourceTypeDonutChartProps) => {
  const data = {
    labels: distribution.map(d => d.type),
    datasets: [
      {
        data: distribution.map(d => d.percentage),
        backgroundColor: distribution.map(d => d.color),
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
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed;
            const item = distribution[context.dataIndex];
            return `${label}: ${value}% (${item.count} domains)`;
          }
        }
      }
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp size={12} className="text-[var(--text-success)]" />;
      case 'down':
        return <TrendingDown size={12} className="text-[var(--text-error)]" />;
      default:
        return <Minus size={12} className="text-[var(--text-caption)]" />;
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-2">
        Source Types by Distribution
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[300px] flex items-center justify-center">
          <div className="relative w-full h-full">
            <Doughnut data={data} options={options} />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-2xl font-bold text-[var(--text-body)]">{distribution.length}</div>
              <div className="text-xs text-[var(--text-caption)]">Types</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center space-y-3">
          {distribution.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-medium text-[var(--text-body)]">{item.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-caption)]">{item.count} domains</span>
                <span className="text-sm font-semibold text-[var(--text-body)]">{item.percentage}%</span>
                <span className="flex items-center gap-0.5">
                  {getTrendIcon(item.trend.direction)}
                  <span className="text-xs text-[var(--text-caption)]">
                    {item.trend.percent > 0 ? '+' : ''}{item.trend.percent}%
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-[var(--text-caption)] mt-4">
        AI prefers Editorial (35%) + Corporate (28%) + Reference (18%) - totaling 81% of all citations
      </p>
    </div>
  );
};
