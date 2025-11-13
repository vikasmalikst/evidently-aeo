import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartPreviewProps {
  currentScore: number;
  newScore: number;
  recalibrationDate: string;
}

export const ChartPreview = ({
  currentScore,
  newScore,
  recalibrationDate
}: ChartPreviewProps) => {
  // Generate sample data points
  const chartData = useMemo(() => {
    const dates = [];
    const scores = [];
    const today = new Date();
    
    // Generate 30 days of data
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      
      // Generate realistic score data with some variation
      const baseScore = currentScore;
      const variation = (Math.random() - 0.5) * 4;
      scores.push(Math.max(0, Math.min(100, baseScore + variation)));
    }

    // Find the index for recalibration date (assume it's today for preview)
    const recalibrationIndex = dates.length - 1;

    return {
      labels: dates,
      datasets: [
        {
          label: 'Visibility Score',
          data: scores,
          borderColor: '#498cf9', // --dataviz-1
          backgroundColor: 'rgba(73, 140, 249, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4
        },
        {
          label: 'Recalibration Point',
          data: scores.map((_, index) => index === recalibrationIndex ? newScore : null),
          borderColor: '#c6c9d2', // --primary300
          borderDash: [4, 3],
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#c6c9d2',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          fill: false,
          tension: 0
        }
      ]
    };
  }, [currentScore, newScore]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: any) => {
            if (context.datasetIndex === 1) {
              return `Recalibration: ${newScore.toFixed(1)}`;
            }
            return `Score: ${context.parsed.y.toFixed(1)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false
        },
        ticks: {
          maxTicksLimit: 6,
          font: {
            size: 10
          }
        }
      },
      y: {
        display: true,
        min: Math.max(0, Math.min(currentScore, newScore) - 10),
        max: Math.min(100, Math.max(currentScore, newScore) + 10),
        grid: {
          color: '#e8e9ed' // --chart-grid
        },
        ticks: {
          font: {
            size: 10
          }
        }
      }
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-[var(--text-headings)] uppercase tracking-wider">
          Chart Preview
        </h4>
        <div className="flex items-center gap-4 text-xs text-[var(--text-caption)]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-[var(--dataviz-1)]"></div>
            <span>Score</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-[var(--primary300)] border-dashed border"></div>
            <span>Recalibration</span>
          </div>
        </div>
      </div>
      <div style={{ height: '200px' }}>
        <Line data={chartData} options={options} />
      </div>
      <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
        <p className="text-xs text-[var(--text-caption)]">
          A dotted line marks where the configuration change occurs ({recalibrationDate})
        </p>
      </div>
    </div>
  );
};

