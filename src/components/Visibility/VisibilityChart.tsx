import { useRef, useMemo, memo, useState, useEffect } from 'react';
import type { ChartEvent, LegendItem } from 'chart.js';
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

const fadeColor = (hex: string, alpha = 0.2) => {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;
  const expand = (value: string) => (hex.length === 4 ? `${value}${value}` : value);
  const r = parseInt(expand(hex.slice(1, hex.length === 4 ? 2 : 3)), 16);
  const g = parseInt(expand(hex.slice(hex.length === 4 ? 2 : 3, hex.length === 4 ? 3 : 5)), 16);
  const b = parseInt(expand(hex.slice(hex.length === 4 ? 3 : 5)), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const [focusedDataset, setFocusedDataset] = useState<number | null>(null);

  useEffect(() => {
    setFocusedDataset(null);
  }, [selectedModels]);

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
        const isDimmed = focusedDataset !== null && focusedDataset !== index;
        const activeBorderColor = color;
        const inactiveBorderColor = fadeColor(color, 0.25);

        if (isBarChart) {
          // Bar chart configuration
          return {
            label: modelData.label,
            data: modelData.data,
            backgroundColor: isDimmed ? fadeColor(color, 0.25) : color,
            borderColor: isDimmed ? inactiveBorderColor : activeBorderColor,
            borderWidth: isDimmed ? 0.5 : 1,
            borderRadius: 4,
            borderSkipped: 'start' as const,
          };
        } else {
          // Line chart configuration
          return {
            label: modelData.label,
            data: modelData.data,
            borderColor: isDimmed ? inactiveBorderColor : activeBorderColor,
            pointBackgroundColor: isDimmed ? inactiveBorderColor : activeBorderColor,
            backgroundColor: 'transparent',
            borderWidth: isDimmed ? 1 : 2.5,
            pointRadius: isDimmed ? 2 : 3,
            pointHoverRadius: isDimmed ? 3 : 6,
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
  }, [data, selectedModels, models, chartType, focusedDataset]);

  // Calculate dynamic max value from data for auto-scaling
  const calculatedMax = useMemo(() => {
    if (!data || selectedModels.length === 0) {
      // Default fallback values based on metric type
      return metricType === 'visibility' ? 120 : 100;
    }

    // Find the maximum value across all selected datasets
    let maxValue = 0;
    selectedModels.forEach((modelId) => {
      const modelData = data.datasets.find(d => d.id === modelId);
      if (modelData && modelData.data) {
        const datasetMax = Math.max(
          ...modelData.data.filter((v): v is number => typeof v === 'number' && !isNaN(v))
        );
        maxValue = Math.max(maxValue, datasetMax);
      }
    });

    // If no valid data found, use default
    if (maxValue === 0) {
      return metricType === 'visibility' ? 120 : 100;
    }

    // Add 10% padding above the max value for better visualization
    // Round up to nearest 10 for cleaner scale
    const paddedMax = maxValue * 1.1;
    const roundedMax = Math.ceil(paddedMax / 10) * 10;
    
    // Ensure minimum scale for very small values
    const minScale = metricType === 'visibility' ? 20 : 10;
    return Math.max(roundedMax, minScale);
  }, [data, selectedModels, metricType]);

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
          max: calculatedMax,
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
            stepSize: calculatedMax <= 20 ? 5 : calculatedMax <= 50 ? 10 : 20,
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
          onClick: (_event: ChartEvent, legendItem: LegendItem) => {
            const datasetIndex = legendItem.datasetIndex;
            if (typeof datasetIndex !== 'number') return;
            setFocusedDataset((prev) => (prev === datasetIndex ? null : datasetIndex));
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
  }, [chartType, metricType, calculatedMax]);

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
