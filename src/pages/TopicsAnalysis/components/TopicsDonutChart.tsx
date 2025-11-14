import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import type { Topic } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend);

interface TopicsDonutChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
}

const getSoAColor = (soA: number): string => {
  if (soA >= 3.0) return '#00bcdc';
  if (soA >= 2.0) return '#0d7c96';
  if (soA >= 1.0) return '#f97316';
  return '#1a1d29';
};

export const TopicsDonutChart = ({ topics, onBarClick }: TopicsDonutChartProps) => {
  const sortedTopics = useMemo(() => {
    return [...topics].sort((a, b) => b.soA - a.soA).slice(0, 10);
  }, [topics]);

  const chartData = useMemo(() => {
    return {
      labels: sortedTopics.map((t) => t.name),
      datasets: [
        {
          data: sortedTopics.map((t) => t.soA),
          backgroundColor: sortedTopics.map((t) => getSoAColor(t.soA)),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    };
  }, [sortedTopics]);

  const options = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event: any, elements: any[]) => {
        if (elements.length > 0 && onBarClick) {
          const elementIndex = elements[0].index;
          onBarClick(sortedTopics[elementIndex]);
        }
      },
      plugins: {
        legend: {
          position: 'right' as const,
          labels: {
            color: 'var(--chart-label)',
            font: {
              size: 12,
              weight: 400,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            padding: 15,
            generateLabels: (chart: any) => {
              const datasets = chart.data.datasets;
              return chart.data.labels.map((label: string, i: number) => ({
                text: `${label} (${sortedTopics[i].soA.toFixed(2)}×)`,
                fillStyle: datasets[0].backgroundColor[i],
                hidden: false,
                index: i
              }));
            }
          }
        },
        tooltip: {
          caretSize: 0,
          callbacks: {
            label: (context: any) => {
              const topic = sortedTopics[context.dataIndex];
              return [
                `SoA: ${topic.soA.toFixed(2)}×`,
                `Rank: ${topic.rank}`,
                `Category: ${topic.category}`,
              ];
            }
          }
        }
      }
    };
  }, [sortedTopics, onBarClick]);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="h-[400px] sm:h-[500px] lg:h-[600px]">
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
};

