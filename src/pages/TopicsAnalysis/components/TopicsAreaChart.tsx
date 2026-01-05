import { useMemo, useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface TopicsAreaChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
  metricType?: 'share' | 'visibility' | 'sentiment';
}

const getSoAColor = (soA: number): string => {
  if (soA >= 3.0) return '#00bcdc';
  if (soA >= 2.0) return '#0d7c96';
  if (soA >= 1.0) return '#f97316';
  return '#1a1d29';
};

export const TopicsAreaChart = ({ topics, onBarClick, metricType = 'share' }: TopicsAreaChartProps) => {
  const [isMobile, setIsMobile] = useState(false);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sort topics by SoA descending (largest to smallest)
  const sortedTopics = useMemo(() => {
    return [...topics]
      .map(topic => ({
        ...topic,
        currentSoA: topic.currentSoA ?? (topic.soA * 20) // Convert 0-5x to 0-100%
      }))
      .sort((a, b) => {
        const aVal =
          metricType === 'visibility'
            ? (a.currentVisibility ?? 0)
            : metricType === 'sentiment'
              ? (a.currentSentiment ?? 0)
              : (a.currentSoA ?? 0);
        const bVal =
          metricType === 'visibility'
            ? (b.currentVisibility ?? 0)
            : metricType === 'sentiment'
              ? (b.currentSentiment ?? 0)
              : (b.currentSoA ?? 0);
        return (bVal ?? 0) - (aVal ?? 0);
      })
      .slice(0, 10); // Show first 10 selected topics
  }, [topics, metricType]);

  // Helper function to wrap topic names into multiple lines
  const wrapTopicName = (name: string, maxLineLength: number = 18): string => {
    if (name.length <= maxLineLength) {
      return name;
    }
    
    const words = name.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach((word, index) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxLineLength) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        // Handle very long words
        if (word.length > maxLineLength) {
          // Break long word into chunks
          for (let i = 0; i < word.length; i += maxLineLength) {
            lines.push(word.substring(i, i + maxLineLength));
          }
          currentLine = '';
        } else {
          currentLine = word;
        }
      }
      
      if (index === words.length - 1 && currentLine) {
        lines.push(currentLine);
      }
    });
    
    return lines.length > 0 ? lines.join('\n') : name;
  };

  const chartData = useMemo(() => {
    const metricLabel =
      metricType === 'share' ? 'Share of Answer (SoA)' : metricType === 'visibility' ? 'Visibility Score' : 'Sentiment Score';
    const values = sortedTopics.map((t) => {
      if (metricType === 'visibility') return Math.max(0, Math.min(100, t.currentVisibility ?? 0));
      if (metricType === 'sentiment') return Math.max(0, Math.min(100, t.currentSentiment ?? 0));
      return Math.max(0, Math.min(100, t.currentSoA ?? 0));
    });
    return {
      labels: sortedTopics.map((t) => {
        // Wrap topic names to multiple lines for better visibility
        return wrapTopicName(t.name, 18);
      }),
      datasets: [
        {
          label: metricLabel,
          data: values,
          borderColor: '#00bcdc',
          backgroundColor: 'rgba(0, 188, 220, 0.15)',
          fill: true,
          tension: 0.5,
          pointRadius: 0,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#00bcdc',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3,
          borderWidth: 2.5,
          pointBackgroundColor: '#00bcdc',
          pointBorderColor: '#ffffff',
        },
      ],
    };
  }, [sortedTopics, metricType]);

  // Calculate dynamic max value from data for auto-scaling
  const calculatedMax = useMemo(() => {
    if (sortedTopics.length === 0) {
      return 100; // Default fallback
    }

    // Find the maximum value across all topics for the selected metric
    let maxValue = 0;
    sortedTopics.forEach((topic) => {
      let value = 0;
      if (metricType === 'visibility') {
        value = Math.max(0, Math.min(100, topic.currentVisibility ?? 0));
      } else if (metricType === 'sentiment') {
        value = Math.max(0, Math.min(100, topic.currentSentiment ?? 0));
      } else {
        value = Math.max(0, Math.min(100, topic.currentSoA ?? 0));
      }
      maxValue = Math.max(maxValue, value);
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
  }, [sortedTopics, metricType]);

  const options = useMemo(() => {
    const metricLabel =
      metricType === 'share' ? 'Share of Answer (SoA)' : metricType === 'visibility' ? 'Visibility Score' : 'Sentiment Score';
    return {
      indexAxis: 'x' as const,
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 40, // Extra space for multi-line labels
        },
      },
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
      onClick: (event: any, elements: any[]) => {
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
          backgroundColor: 'rgba(26, 29, 41, 0.98)',
          titleColor: '#ffffff',
          titleFont: {
            size: 13,
            weight: 600,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
          bodyColor: '#ffffff',
          bodyFont: {
            size: 12,
            weight: 500,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
          borderColor: '#00bcdc',
          borderWidth: 1.5,
          padding: 12,
          caretSize: 6,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: function(context: any) {
              const suffix = metricType === 'share' ? '%' : '';
              return `${metricLabel}: ${context.parsed.y.toFixed(2)}${suffix}`;
            }
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: 'var(--chart-label)',
            font: {
              size: isMobile ? 10 : 11,
              weight: 500,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            maxRotation: 45,
            minRotation: 45,
            padding: 20,
            maxWidth: 100, // Limit width to force wrapping
            autoSkip: false, // Show all labels
            callback: (_value: unknown, index: number) => chartData.labels?.[index] ?? '',
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: metricLabel,
            color: 'var(--chart-label)',
            font: {
              size: isMobile ? 11 : 13,
              weight: 600,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            padding: {
              top: 0,
              bottom: 12,
            },
          },
          grid: {
            color: 'var(--chart-grid)',
            lineWidth: 1,
            drawBorder: false,
            drawTicks: false,
          },
          ticks: {
            color: 'var(--chart-label)',
            font: {
              size: 12,
              weight: 400,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            padding: 8,
            callback: function(value: any) {
              return metricType === 'share' ? value + '%' : value;
            },
            stepSize: calculatedMax <= 20 ? 5 : calculatedMax <= 50 ? 10 : 20,
          },
          max: calculatedMax,
        },
      },
    };
  }, [sortedTopics, onBarClick, isMobile, metricType, calculatedMax, chartData.labels]);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="h-[400px] sm:h-[500px] lg:h-[600px] relative" style={{ overflow: 'visible' }}>
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
};
