import { useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { TopicsAreaChart } from './TopicsAreaChart';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import type { Topic } from '../types';
import { getChartColor } from '../utils/chartColors';
import { useChartResize } from '../../../hooks/useChartResize';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Plugin removed - no longer drawing industry average line

interface TopicsLineChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
  selectedDateRange?: string;
}

export const TopicsLineChart = ({ topics, onBarClick, selectedDateRange }: TopicsLineChartProps) => {
  const chartRef = useRef<any>(null);
  
  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, topics.length > 0);
  
  // Helper function to resolve CSS variable at runtime
  const getCSSVariable = (variableName: string): string => {
    if (typeof window !== 'undefined') {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(variableName)
        .trim() || '#e8e9ed'; // Fallback to default if not found
    }
    return '#e8e9ed'; // Fallback for SSR
  };

  // Resolve chart grid color from CSS variable
  const chartGridColor = useMemo(() => getCSSVariable('--chart-grid'), []);
  const chartLabelColor = useMemo(() => getCSSVariable('--chart-label'), []);
  
  // Avg Industry color (neutral 400)
  const AVG_INDUSTRY_COLOR = '#8b90a7'; // neutral-400

  // Sort topics by currentSoA descending (largest to smallest), limit to top 10
  const sortedTopics = useMemo(() => {
    return [...topics]
      .map(topic => ({
        ...topic,
        currentSoA: topic.currentSoA ?? (topic.soA * 20) // Convert 0-5x to 0-100%
      }))
      .sort((a, b) => (b.currentSoA ?? 0) - (a.currentSoA ?? 0))
      .slice(0, 10);
  }, [topics]);

  // Calculate average industry SoA across all topics for the horizontal line
  const avgIndustrySoA = useMemo(() => {
    if (sortedTopics.length === 0) return 0;
    const sum = sortedTopics.reduce((acc, topic) => {
      const seed = (topic.id.charCodeAt(0) * 13) % 100;
      const baseSoA = topic.currentSoA ?? (topic.soA * 20);
      const industrySoA = Math.max(0, Math.min(100, baseSoA * (0.7 + (seed / 100) * 0.6)));
      return acc + industrySoA;
    }, 0);
    return sum / sortedTopics.length;
  }, [sortedTopics]);

  // Generate 12-week labels
  const weekLabels = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`);
  }, []);

  // Generate date range label from selectedDateRange
  const dateRangeLabel = useMemo(() => {
    if (!selectedDateRange) return '';
    
    const today = new Date('2025-11-01');
    const formatDate = (date: Date) => {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}/${day}`;
    };

    // Parse different date range formats
    if (selectedDateRange.startsWith('daily-')) {
      // Format: "daily-last-{days}-days"
      const daysMatch = selectedDateRange.match(/daily-last-(\d+)-days/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (days - 1));
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
      }
    } else if (selectedDateRange.startsWith('weekly-')) {
      // Format: "weekly-last-{weeks}-weeks"
      const weeksMatch = selectedDateRange.match(/weekly-last-(\d+)-weeks/);
      if (weeksMatch) {
        const weeks = parseInt(weeksMatch[1]);
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (weeks * 7 - 1));
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
      }
    } else if (selectedDateRange.startsWith('monthly-')) {
      // Format: "monthly-last-{months}-months"
      const monthsMatch = selectedDateRange.match(/monthly-last-(\d+)-months/);
      if (monthsMatch) {
        const months = parseInt(monthsMatch[1]);
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setMonth(today.getMonth() - months);
        startDate.setDate(1);
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
      }
    } else if (selectedDateRange.startsWith('week-')) {
      // Legacy format: "week-0", "week-1", etc.
      const weekIndex = parseInt(selectedDateRange.replace('week-', '')) || 0;
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - (weekIndex * 7));
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }

    return '';
  }, [selectedDateRange]);

  const chartData = useMemo(() => {
    // Show each topic as a separate line with 12-week historical data
    const datasets = sortedTopics.map((topic, index) => {
      const color = getChartColor(index);
      // Only use visibilityTrend if available - don't generate mock data
      // If no trend data, skip this topic (don't show it in the chart)
      if (!topic.visibilityTrend || topic.visibilityTrend.length !== 12) {
        return null; // Skip topics without real trend data
      }
      const trendData = topic.visibilityTrend;

      // Convert hex color to rgba for background fill
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };

      return {
        label: topic.name,
        data: trendData,
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.05),
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2,
        borderWidth: 2,
        spanGaps: false,
      };
    });

    return {
      labels: weekLabels,
      datasets: datasets.filter((d): d is NonNullable<typeof d> => d !== null), // Filter out null datasets
    };
  }, [sortedTopics, weekLabels]);

  // Calculate dynamic max value from data for auto-scaling
  const calculatedMax = useMemo(() => {
    if (!chartData || chartData.datasets.length === 0) {
      return 100; // Default fallback
    }

    // Find the maximum value across all datasets and all data points
    let maxValue = 0;
    chartData.datasets.forEach((dataset) => {
      if (dataset.data && Array.isArray(dataset.data)) {
        const datasetMax = Math.max(
          ...dataset.data.filter((v): v is number => typeof v === 'number' && !isNaN(v))
        );
        maxValue = Math.max(maxValue, datasetMax);
      }
    });

    // If no valid data found, use default
    if (maxValue === 0) {
      return 100;
    }

    // Add 10% padding above the max value for better visualization
    // Round up to nearest 10 for cleaner scale
    const paddedMax = maxValue * 1.1;
    const roundedMax = Math.ceil(paddedMax / 10) * 10;
    
    // Ensure minimum scale for very small values
    return Math.max(roundedMax, 10);
  }, [chartData]);

  const options = useMemo(() => {
    return {
      indexAxis: 'x' as const,
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
      aspectRatio: 2.5,
      onClick: (_event: any, elements: any[]) => {
        if (elements.length > 0 && onBarClick) {
          const elementIndex = elements[0].index;
          onBarClick(sortedTopics[elementIndex]);
        }
      },
      plugins: {
        legend: {
          display: false,
          position: 'bottom' as const,
          align: 'center' as const,
          labels: {
            color: 'var(--chart-label)',
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
          borderColor: 'var(--chart-axis)',
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          boxPadding: 6,
          position: 'nearest' as const,
          xAlign: 'right' as const,
          yAlign: 'top' as const,
          caretPadding: 10,
          caretSize: 0,
          cornerRadius: 4,
          titleFont: {
            size: 11,
            weight: 600,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
          bodyFont: {
            size: 11,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
          callbacks: {
            title: (context: any) => {
              const weekLabel = context[0]?.label || '';
              if (dateRangeLabel) {
                return `${weekLabel} (${dateRangeLabel})`;
              }
              return weekLabel;
            },
            label: (context: any) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              const topic = sortedTopics.find(t => t.name === label);
              const lines = [`  ${label}: ${value.toFixed(1)}%`];
              if (topic) {
                lines.push(`  Rank: ${topic.rank}`);
              }
              return lines;
            },
          },
        },
        filler: {
          propagate: false,
        },
      },
      scales: {
        x: {
          title: {
            display: false,
          },
          grid: {
            color: chartGridColor,
            lineWidth: 1,
            drawBorder: false,
            drawTicks: false,
          },
          ticks: {
            color: 'var(--text-caption)',
            font: {
              size: 9,
              weight: 400,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            padding: 8,
            maxRotation: 0,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          min: 0,
          max: calculatedMax,
          title: {
            display: false,
          },
          grid: {
            color: chartGridColor,
            lineWidth: 1,
            drawBorder: false,
            drawTicks: false,
          },
          ticks: {
            color: 'var(--text-caption)',
            font: {
              size: 9,
              weight: 400,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            padding: 8,
            stepSize: calculatedMax <= 20 ? 5 : calculatedMax <= 50 ? 10 : 20,
            callback: (value: any) => `${value}%`,
            maxRotation: 0,
            minRotation: 0,
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
    };
  }, [sortedTopics, onBarClick, chartGridColor, chartLabelColor, avgIndustrySoA, AVG_INDUSTRY_COLOR, calculatedMax]);

  // Color key for topics
  const colorKeyItems = sortedTopics.map((topic, index) => ({
    topic,
    color: getChartColor(index),
    label: topic.name,
    value: (topic.currentSoA ?? 0).toFixed(1) + '%',
  }));

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="h-[400px] sm:h-[500px] lg:h-[600px]" style={{ cursor: 'pointer' }}>
        <Line data={chartData} options={options} ref={chartRef} />
      </div>
      
      {/* Color Key - Below Chart */}
      {colorKeyItems.length > 0 && (
        <div className="mt-3 sm:mt-4 flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide whitespace-nowrap">
            Topics:
          </span>
          {colorKeyItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => onBarClick?.(item.topic)}
              className="flex items-center gap-1.5 sm:gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onBarClick?.(item.topic);
                }
              }}
            >
              <div
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[10px] sm:text-xs text-[var(--text-body)] whitespace-nowrap">
                <span className="hidden sm:inline">{item.label} </span>({item.value})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

