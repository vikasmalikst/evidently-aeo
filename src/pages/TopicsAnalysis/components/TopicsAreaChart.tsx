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
}

const getSoAColor = (soA: number): string => {
  if (soA >= 3.0) return '#00bcdc';
  if (soA >= 2.0) return '#0d7c96';
  if (soA >= 1.0) return '#f97316';
  return '#1a1d29';
};

export const TopicsAreaChart = ({ topics, onBarClick }: TopicsAreaChartProps) => {
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
      .sort((a, b) => (b.currentSoA ?? 0) - (a.currentSoA ?? 0))
      .slice(0, 10); // Show first 10 selected topics
  }, [topics]);

  const chartData = useMemo(() => {
    return {
      labels: sortedTopics.map((t) => t.name),
      datasets: [
        {
          label: 'Share of Answer (SoA)',
          data: sortedTopics.map((t) => t.currentSoA ?? 0),
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
          backgroundColor: 'rgba(26, 29, 41, 0.98)',
          titleColor: '#ffffff',
          titleFont: {
            size: 13,
            weight: '600',
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
          bodyColor: '#ffffff',
          bodyFont: {
            size: 12,
            weight: '500',
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
              return `Share of Answer (SoA): ${context.parsed.y.toFixed(2)}%`;
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
              size: isMobile ? 10 : 13,
              weight: 500,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            maxRotation: 45,
            minRotation: 45,
            padding: 8,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Share of Answer (SoA)',
            color: 'var(--chart-label)',
            font: {
              size: isMobile ? 11 : 13,
              weight: '600',
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
              return value + '%';
            },
          },
          max: 100,
        },
      },
    };
  }, [sortedTopics, onBarClick, isMobile]);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="h-[400px] sm:h-[500px] lg:h-[600px] relative">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
};

