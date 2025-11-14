import { useMemo, useState, useEffect } from 'react';
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
}

const getSoAColor = (soA: number): string => {
  if (soA >= 3.0) return '#00bcdc';
  if (soA >= 2.0) return '#0d7c96';
  if (soA >= 1.0) return '#f97316';
  return '#1a1d29';
};

export const TopicsAreaChart = ({ topics, onBarClick }: TopicsAreaChartProps) => {
  const [isMobile, setIsMobile] = useState(false);

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
    return [...topics].sort((a, b) => b.soA - a.soA).slice(0, 10); // Show first 10 selected topics
  }, [topics]);

  const chartData = useMemo(() => {
    return {
      labels: sortedTopics.map((t) => t.name),
      datasets: [
        {
          label: 'Share of Answer (SoA)',
          data: sortedTopics.map((t) => t.soA),
          borderColor: '#00bcdc',
          backgroundColor: 'rgba(0, 188, 220, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          borderWidth: 2,
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
          backgroundColor: 'rgba(26, 29, 41, 0.96)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#c6c9d2',
          borderWidth: 1,
          padding: 10,
          caretSize: 0,
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
              size: isMobile ? 9 : 12,
              weight: 400,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Share of Answer (SoA)',
            color: 'var(--chart-label)',
            font: {
              size: isMobile ? 10 : 12,
              weight: '600',
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
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
          },
        },
      },
    };
  }, [sortedTopics, onBarClick, isMobile]);

  // Color key for topics
  const colorKeyItems = sortedTopics.slice(0, 10).map((topic, index) => ({
    color: getSoAColor(topic.soA),
    label: topic.name,
    value: topic.soA.toFixed(2) + '×',
  }));

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="h-[400px] sm:h-[500px] lg:h-[600px]">
        <Line data={chartData} options={options} />
      </div>
      
      {/* Color Key - Below Chart */}
      {colorKeyItems.length > 0 && (
        <div className="mt-3 sm:mt-4 flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide whitespace-nowrap">
            Topics:
          </span>
          {colorKeyItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 sm:gap-2">
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

