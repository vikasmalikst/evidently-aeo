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
import { IconBrandOpenai } from '@tabler/icons-react';
import claudeLogoSrc from '../../assets/Claude-AI-icon.svg';
import copilotLogoSrc from '../../assets/Microsoft-Copilot-icon.svg';
import geminiLogoSrc from '../../assets/Google-Gemini-Icon.svg';
import googleAioLogoSrc from '../../assets/Google-AI-icon.svg';
import grokLogoSrc from '../../assets/Grok-icon.svg';
import perplexityLogoSrc from '../../assets/Perplexity-Simple-Icon.svg';
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
  icon?: string;
}

// Helper function to get favicon for a model
const getModelFavicon = (modelId: string, modelName: string): string | null => {
  const id = modelId.toLowerCase();
  const name = modelName.toLowerCase();
  
  if (id.includes('chatgpt') || id.includes('gpt') || name.includes('chatgpt') || name.includes('gpt')) {
    return null; // Will use IconBrandOpenai component
  } else if (id.includes('claude') || name.includes('claude')) {
    return claudeLogoSrc;
  } else if (id.includes('gemini') || name.includes('gemini')) {
    return geminiLogoSrc;
  } else if (id.includes('perplexity') || name.includes('perplexity')) {
    return perplexityLogoSrc;
  } else if (id.includes('copilot') || name.includes('copilot')) {
    return copilotLogoSrc;
  } else if (id.includes('google_aio') || id.includes('googleaio') || name.includes('google aio')) {
    return googleAioLogoSrc;
  } else if (id.includes('grok') || name.includes('grok')) {
    return grokLogoSrc;
  }
  
  return null;
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
  datePeriodType?: 'daily' | 'weekly' | 'monthly';
  dateRangeLabel?: string;
  selectedModels: string[];
  loading?: boolean;
  activeTab: string;
  models?: Model[];
  metricType?: 'visibility' | 'share';
}

export const VisibilityChart = memo(({
  data,
  chartType = 'line',
  datePeriodType = 'weekly',
  dateRangeLabel,
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
    const isBrandMode = activeTab === 'brand';

    // For bar charts in brand mode, sort LLMs by average value (largest to smallest)
    // Chart.js doesn't support per-group sorting, so we sort by overall average
    if (isBarChart && isBrandMode) {
      // Get all model data with their average values
      const modelDataList = selectedModels
        .map((modelId) => {
          const modelData = data.datasets.find(d => d.id === modelId);
          if (!modelData) return null;
          const model = models.find(m => m.id === modelId);
          const color = model?.color || chartColors[colorKeys[selectedModels.indexOf(modelId) % colorKeys.length] as keyof typeof chartColors];
          
          // Calculate average value across all periods
          const avgValue = modelData.data.reduce((sum, val) => sum + val, 0) / modelData.data.length;
          
          return {
            id: modelId,
            label: modelData.label,
            data: modelData.data,
            color,
            model,
            avgValue
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Sort by average value descending (largest to smallest)
      modelDataList.sort((a, b) => b.avgValue - a.avgValue);

      // Create datasets in sorted order
      const datasets = modelDataList.map((modelData) => {
        return {
          id: modelData.id,
          label: modelData.label,
          data: modelData.data,
          backgroundColor: modelData.color,
          borderColor: modelData.color,
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: 'start' as const,
        };
      });

      return {
        labels: data.labels,
        datasets
      };
    }

    // For line charts or competitive mode bar charts, use standard grouping
    const datasets = selectedModels
      .map((modelId, index) => {
        const modelData = data.datasets.find(d => d.id === modelId);
        if (!modelData) return null;

        // Use color from model if available, otherwise fall back to generic color palette
        const model = models.find(m => m.id === modelId);
        const color = model?.color || chartColors[colorKeys[index % colorKeys.length] as keyof typeof chartColors];

        if (isBarChart) {
          // Bar chart configuration - grouped bars by time period
          // Each dataset represents one LLM, and bars will be grouped by time period (labels)
          return {
            id: modelId, // Store model ID for legend lookup
            label: modelData.label,
            data: modelData.data,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: 'start' as const,
          };
        } else {
          // Line chart configuration - time series with one line per model
          return {
            id: modelId, // Store model ID for legend lookup
            label: modelData.label,
            data: modelData.data,
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBorderWidth: 2,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#ffffff',
            tension: 0.4,
            fill: false,
          };
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      labels: data.labels, // Date periods
      datasets
    };
  }, [data, selectedModels, models, chartType, activeTab]);

  const options = useMemo(() => {
    const isBarChart = chartType === 'bar';
    const isBrandMode = activeTab === 'brand';
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
          max: 100,
          title: {
            display: true,
            text: metricType === 'visibility' ? 'Visibility Score' : 'Share of Answers (%)',
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
          // For bar charts, group bars by time period (labels)
          // For line charts, show time periods on x-axis
          stacked: false, // Ensure bars are grouped, not stacked
          ticks: {
            color: neutrals[700],
            font: {
              size: datePeriodType === 'monthly' ? 9 : 9,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
              weight: 400,
            },
            padding: isBarChart && isBrandMode ? 12 : 8, // More spacing for bar charts in brand mode
            maxRotation: datePeriodType === 'monthly' ? 45 : 0,
            minRotation: datePeriodType === 'monthly' ? 45 : 0,
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
          display: false, // Hide default legend, we'll use custom one
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
            const suffix = metricType === 'share' ? '%' : '';
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
  }, [chartType, metricType, datePeriodType, activeTab]);

  // Generate custom legend items with favicons - must be called before any early returns
  const legendItems = useMemo(() => {
    if (!chartData) return [];
    
    return chartData.datasets.map((dataset, index) => {
      const model = models.find(m => m.id === dataset.id || m.name === dataset.label);
      const modelId = model?.id || dataset.id || '';
      const modelName = model?.name || dataset.label || '';
      const faviconSrc = getModelFavicon(modelId, modelName);
      const isChatGPT = modelId.toLowerCase().includes('chatgpt') || modelId.toLowerCase().includes('gpt') || 
                       modelName.toLowerCase().includes('chatgpt') || modelName.toLowerCase().includes('gpt');
      const color = model?.color || dataset.backgroundColor || dataset.borderColor;
      
      return {
        label: modelName,
        color,
        faviconSrc,
        isChatGPT,
        index,
      };
    });
  }, [chartData, models]);

  // Handle chart resize on window resize (e.g., when dev tools open/close)
  // Must be called after chartData is defined
  useChartResize(chartRef, !loading && !!chartData && selectedModels.length > 0);

  // Early returns must come AFTER all hooks
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
      {/* Date Range Label */}
      {dateRangeLabel && (
        <div className="mb-4 text-center">
          <span className="text-sm text-[var(--text-caption)]">
            {dateRangeLabel}
          </span>
        </div>
      )}
      <div className="relative w-full">
        <ChartComponent data={chartData} options={options} ref={chartRef} />
      </div>
      {/* Custom Legend with Favicons */}
      {legendItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-[var(--border-default)]">
          {legendItems.map((item) => (
            <div
              key={item.index}
              className="flex items-center gap-2"
            >
              {item.isChatGPT ? (
                <IconBrandOpenai size={16} className="flex-shrink-0" />
              ) : item.faviconSrc ? (
                <img
                  src={item.faviconSrc}
                  alt=""
                  className="w-4 h-4 flex-shrink-0"
                  style={{ width: '16px', height: '16px' }}
                />
              ) : (
                <div
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{
                    backgroundColor: item.color,
                    border: chartType === 'bar' ? 'none' : `2px solid ${item.color}`,
                  }}
                />
              )}
              <span
                className="text-xs font-medium text-[var(--text-body)]"
                style={{ fontSize: '11px' }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
