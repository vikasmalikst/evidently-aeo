import { useRef, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

const chartColors = {
  viz01: '#06b6d4',
  viz02: '#498cf9',
  viz03: '#ac59fb',
  viz04: '#fa8a40',
  viz05: '#f155a2',
  viz06: '#0d7c96',
  viz07: '#0d3196',
  viz08: '#54079c',
};

const neutrals = {
  50: '#f4f4f6',
  100: '#e8e9ed',
  200: '#dcdfe5',
  300: '#c6c9d2',
  400: '#8b90a7',
  700: '#393e51',
  800: '#212534',
  900: '#1a1d29',
};

interface VisibilityChartProps {
  data: {
    labels: string[];
    datasets: Array<{
      id: string;
      label: string;
      data: number[];
    }>;
  };
  chartType: string;
  timeframe: string;
  selectedModels: string[];
  loading?: boolean;
  activeTab: string;
}

export const VisibilityChart = ({
  data,
  selectedModels = [],
  loading = false,
  activeTab = 'brand'
}: VisibilityChartProps) => {
  const chartRef = useRef(null);

  const chartData = useMemo(() => {
    if (!data || selectedModels.length === 0) {
      return null;
    }

    const colorKeys = Object.keys(chartColors);

    const datasets = selectedModels.map((modelId, index) => {
      const modelData = data.datasets.find(d => d.id === modelId);
      if (!modelData) return null;

      const color = chartColors[colorKeys[index % colorKeys.length] as keyof typeof chartColors];

      return {
        label: modelData.label,
        data: modelData.data,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.4,
        fill: false,
      };
    }).filter(Boolean);

    return {
      labels: data.labels,
      datasets
    };
  }, [data, selectedModels]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.8,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        align: 'center' as const,
        labels: {
          color: neutrals[800],
          font: {
            size: 12,
            weight: 500,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
          padding: 16,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: false,
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(26, 29, 41, 0.96)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: neutrals[300],
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        boxPadding: 6,
        position: 'nearest' as const,
        xAlign: 'right' as const,
        yAlign: 'top' as const,
        caretPadding: 10,
        cornerRadius: 4,
        titleFont: {
          size: 11,
          weight: '600',
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        },
        bodyFont: {
          size: 11,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        },
        callbacks: {
          title: (context: any) => {
            return context[0]?.label || '';
          },
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `  ${label}: ${value}`;
          },
        },
      },
      filler: {
        propagate: false,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        min: 40,
        max: 100,
        ticks: {
          color: neutrals[700],
          font: {
            size: 9,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            weight: 400,
          },
          callback: (value: any) => String(value),
          padding: 8,
          stepSize: 10,
          maxRotation: 0,
          minRotation: 0,
        },
        grid: {
          color: neutrals[100],
          lineWidth: 1,
          drawBorder: false,
          drawTicks: false,
        },
      },
      x: {
        ticks: {
          color: neutrals[700],
          font: {
            size: 9,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            weight: 400,
          },
          padding: 8,
          maxRotation: 0,
          minRotation: 0,
        },
        grid: {
          display: false,
          drawBorder: false,
          drawTicks: false,
        },
      },
    },
    layout: {
      padding: {
        top: 16,
        right: 16,
        bottom: 12,
        left: 8,
      },
    },
    animation: {
      duration: 500,
      easing: 'easeInOutQuart' as const,
    },
  }), []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 bg-white">
        <p className="text-[var(--text-caption)] text-sm">Loading visibility data...</p>
      </div>
    );
  }

  if (!chartData || selectedModels.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 bg-white min-h-[400px]">
        <p className="text-[var(--text-caption)] text-sm text-center">
          Select at least one {activeTab === 'brand' ? 'LLM model' : 'brand'} to display
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-auto bg-white rounded-lg p-6">
      <div className="relative w-full">
        <Line data={chartData} options={options} ref={chartRef} />
      </div>
    </div>
  );
};
