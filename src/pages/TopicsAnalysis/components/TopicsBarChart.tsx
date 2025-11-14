import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import type { Topic } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TopicsBarChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
}

export const TopicsBarChart = ({ topics, onBarClick }: TopicsBarChartProps) => {
  // Helper function to resolve CSS variable at runtime
  const getCSSVariable = (variableName: string): string => {
    if (typeof window !== 'undefined') {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(variableName)
        .trim() || '#e8e9ed'; // Fallback to default if not found
    }
    return '#e8e9ed'; // Fallback for SSR
  };

  // Resolve CSS variables for chart colors
  const chartGridColor = useMemo(() => getCSSVariable('--chart-grid'), []);
  const chartLabelColor = useMemo(() => getCSSVariable('--chart-label'), []);
  const chartAxisColor = useMemo(() => getCSSVariable('--chart-axis'), []);
  const textCaptionColor = useMemo(() => getCSSVariable('--text-caption'), []);

  // Sort topics by SoA descending (largest to smallest) for left to right display
  // Convert SoA (0-5x scale) to percentage (0-100) for display
  const sortedTopics = useMemo(() => {
    return [...topics]
      .map(topic => ({
        ...topic,
        currentSoA: topic.currentSoA ?? (topic.soA * 20) // Convert 0-5x to 0-100%
      }))
      .sort((a, b) => (b.currentSoA ?? 0) - (a.currentSoA ?? 0));
  }, [topics]);

  const chartData = useMemo(() => {
    return {
      labels: sortedTopics.map((t) => t.name),
      datasets: [
        {
          label: 'Share of Answer (SoA)',
          data: sortedTopics.map((t) => t.currentSoA ?? 0),
          backgroundColor: '#498cf9', // Data viz 02
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [sortedTopics]);

  const options = useMemo(() => {
    return {
      indexAxis: 'x' as const,
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
      onClick: (_event: any, elements: any[]) => {
        if (elements.length > 0 && onBarClick) {
          const elementIndex = elements[0].index;
          onBarClick(sortedTopics[elementIndex]);
        }
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(26, 29, 41, 0.96)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: chartAxisColor,
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
              return context[0]?.label || '';
            },
            label: (context: any) => {
              const elementIndex = context.dataIndex;
              const topic = sortedTopics[elementIndex];
              const lines = [`${context.parsed.y.toFixed(1)}%`];
              if (topic) {
                lines.push(`SoA: ${topic.soA.toFixed(2)}×`);
                lines.push(`Rank: ${topic.rank}`);
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Topics',
            color: chartLabelColor,
            font: {
              size: 12,
              weight: 600,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            padding: { top: 8, bottom: 4 },
          },
          grid: {
            display: false,
            drawBorder: false,
            drawTicks: false,
          },
          ticks: {
            color: textCaptionColor,
            font: {
              size: 9,
              weight: 400,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            padding: 8,
            maxRotation: 45,
            minRotation: 45,
          },
          categoryPercentage: 0.6, // Reduce bar width to 60% of category
          barPercentage: 0.8, // Bars take 80% of available space
        },
        y: {
          beginAtZero: true,
          min: 0,
          max: 100,
          title: {
            display: true,
            text: 'Share of Answer (SoA)',
            color: chartLabelColor,
            font: {
              size: 12,
              weight: 600,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            padding: { top: 8, bottom: 4 },
          },
          grid: {
            color: chartGridColor,
            lineWidth: 1,
            drawBorder: false,
            drawTicks: false,
          },
          ticks: {
            color: textCaptionColor,
            callback: (value: any) => `${value}%`,
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
  }, [sortedTopics, onBarClick, chartGridColor, chartLabelColor, chartAxisColor, textCaptionColor]);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="h-[400px] sm:h-[500px] lg:h-[600px]" style={{ cursor: 'pointer' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

