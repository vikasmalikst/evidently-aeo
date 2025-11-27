import { useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useChartResize } from '../../../hooks/useChartResize';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StackedRacingChartProps {
  data: Array<{
    type: string;
    percentage: number;
    color: string;
  }>;
}

export const StackedRacingChart = ({ data }: StackedRacingChartProps) => {
  const chartRef = useRef<any>(null);
  
  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, data.length > 0);
  
  const chartData = {
    labels: [''],
    datasets: data.map((item) => ({
      label: item.type,
      data: [item.percentage],
      backgroundColor: item.color,
      borderWidth: 0,
      barPercentage: 1,
      categoryPercentage: 0.9,
    })),
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        max: 100,
        display: false,
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        display: false,
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        caretSize: 0,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.x}`;
          },
        },
      },
    },
  };

  return (
    <div>
      <div style={{ height: '40px' }}>
        <Bar data={chartData} options={options} ref={chartRef} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-[#64748b] truncate">{item.type}</div>
              <div className="text-[13px] font-semibold text-[#1a1d29]">{item.percentage}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

