import { useRef, useMemo, memo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { useChartResize } from '../../hooks/useChartResize';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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

interface Model {
  id: string;
  name: string;
  color?: string;
}

interface VisibilityChartProps {
  data: {
    labels: string[];
    datasets: Array<{
      id: string;
      label: string;
      data: Array<number | null>;
    }>;
  };
  chartType: string;
  timeframe: string;
  selectedModels: string[];
  loading?: boolean;
  activeTab: string;
  models?: Model[];
  metricType?: 'visibility' | 'share' | 'sentiment' | 'brandPresence';
}

export const VisibilityChart = memo(({
  data,
  chartType = 'line',
  selectedModels = [],
  loading = false,
  activeTab = 'brand',
  models = [],
  metricType = 'visibility'
}: VisibilityChartProps) => {
  const chartRef = useRef<any>(null);

  const chartData = useMemo(() => {
    if (!data || selectedModels.length === 0) {
      return null;
    }

    const colorKeys = Object.keys(chartColors);
    const isBarChart = chartType === 'bar';

    const datasets = selectedModels
      .map((modelId, index) => {
        const modelData = data.datasets.find(d => d.id === modelId);
        if (!modelData) return null;

        // Use color from model if available, otherwise fall back to generic color palette
        const model = models.find(m => m.id === modelId);
        const color = model?.color || chartColors[colorKeys[index % colorKeys.length] as keyof typeof chartColors];

        if (isBarChart) {
          // Bar chart configuration
          return {
            label: modelData.label,
            data: modelData.data,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: 'start' as const,
          };
        } else {
          // Line chart configuration
          return {
            label: modelData.label,
            data: modelData.data,
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.4,
            fill: false,
            spanGaps: false,
          };
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      labels: data.labels,
      datasets
    };
  }, [data, selectedModels, models, chartType]);

  const options = useMemo(() => {
    const isBarChart = chartType === 'bar';
    return {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.8,
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: 120,
          title: {
            display: true,
            text: metricType === 'visibility' 
              ? 'Visibility Score' 
              : metricType === 'share' 
                ? 'Share of Answers (%)'
                : metricType === 'brandPresence'
                  ? 'Brand Presence (%)'
                  : 'Sentiment Score',
            color: neutrals[700],
            font: {
              size: 11,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
              weight: 500,
            },
            padding: {
              top: 0,
              bottom: 8,
            },
          },
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
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
          align: 'start' as const,
          labels: {
            usePointStyle: true,
            pointStyle: isBarChart ? 'rect' : 'line',
            padding: 15,
            font: {
              size: 11,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
              weight: 400,
            },
            color: neutrals[700],
            generateLabels: (chart: any) => {
              const datasets = chart.data.datasets || [];
              return datasets.map((dataset: any, index: number) => {
                return {
                  text: dataset.label || `Dataset ${index + 1}`,
                  fillStyle: dataset.backgroundColor || dataset.borderColor,
                  strokeStyle: dataset.borderColor || dataset.backgroundColor,
                  lineWidth: isBarChart ? 0 : 2,
                  hidden: !chart.isDatasetVisible(index),
                  index: index,
                };
              });
            },
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
        displayColors: false,
        boxPadding: 6,
        position: 'nearest' as const,
        xAlign: 'right' as const,
        yAlign: 'top' as const,
        caretPadding: 10,
        cornerRadius: 4,
        titleFont: {
          size: 11,
          weight: 'bold' as const,
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
            const suffix = metricType === 'share' || metricType === 'brandPresence' ? '%' : '';
            return `  ${label}: ${value}${suffix}`;
          },
        },
      },
      filler: {
        propagate: false,
      },
    },
      layout: {
        padding: {
          top: 16,
          right: 16,
          bottom: 40,
          left: 8,
        },
      },
      animation: {
        duration: 500,
        easing: 'easeInOutQuart' as const,
      },
    };
  }, [chartType, metricType]);

  // Handle chart resize on window resize (e.g., when dev tools open/close)
  // Must be called after chartData is defined
  useChartResize(chartRef, !loading && !!chartData && selectedModels.length > 0);

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

  const ChartComponent = chartType === 'bar' ? Bar : Line;

  return (
    <div className="w-full h-auto bg-white rounded-lg p-6">
      <div className="relative w-full">
        <ChartComponent data={chartData} options={options} ref={chartRef} />
      </div>
    </div>
  );
});
