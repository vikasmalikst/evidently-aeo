import { useRef, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useChartResize } from '../../../hooks/useChartResize';
import { SourceTypeTooltip } from './SourceTypeTooltip';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StackedRacingChartProps {
  data: Array<{
    type: string;
    percentage: number;
    color: string;
  }>;
  topSourcesByType?: Record<string, Array<{ domain: string; title: string | null; url: string | null; usage: number }>>;
}

export const StackedRacingChart = ({ data, topSourcesByType }: StackedRacingChartProps) => {
  const chartRef = useRef<any>(null);
  const [tooltipState, setTooltipState] = useState<{
    sourceType: string;
    position: { x: number; y: number };
  } | null>(null);
  
  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, data.length > 0);
  
  const chartData = {
    labels: [''],
    datasets: data.map((item) => ({
      label: item.type,
      data: [item.percentage],
      backgroundColor: item.color,
      borderWidth: 0,
      barPercentage: 1,
      categoryPercentage: 0.9,
    })),
  };

  const handleChartClick = (event: any, elements: any[]) => {
    if (!topSourcesByType || !elements || elements.length === 0) {
      return;
    }

    // Get the clicked element - for stacked bars, we need to find which segment was clicked
    const clickedElement = elements[0];
    if (!clickedElement) {
      return;
    }

    const datasetIndex = clickedElement.datasetIndex;
    const clickedSourceType = data[datasetIndex]?.type;

    if (!clickedSourceType || !topSourcesByType[clickedSourceType]) {
      return;
    }

    // Get click position for tooltip placement
    // Use the chart canvas element to get position
    const canvas = chartRef.current?.canvas;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setTooltipState({
        sourceType: clickedSourceType,
        position: {
          x: event.native?.clientX || rect.left + rect.width / 2,
          y: event.native?.clientY || rect.top + rect.height / 2,
        },
      });
    } else if (event.native) {
      // Fallback to native event position
      setTooltipState({
        sourceType: clickedSourceType,
        position: {
          x: event.native.clientX,
          y: event.native.clientY,
        },
      });
    }
  };

  const handleCloseTooltip = () => {
    setTooltipState(null);
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleChartClick,
    scales: {
      x: {
        stacked: true,
        max: 100,
        display: false,
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        display: false,
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        caretSize: 0,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.x}`;
          },
        },
      },
    },
  };

  const tooltipSources = tooltipState && topSourcesByType?.[tooltipState.sourceType]
    ? topSourcesByType[tooltipState.sourceType]
    : [];

  return (
    <div>
      <div style={{ height: '40px', cursor: topSourcesByType ? 'pointer' : 'default' }}>
        <Bar data={chartData} options={options} ref={chartRef} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((item) => (
          <div 
            key={item.type} 
            className="flex items-center gap-2"
            style={{ cursor: topSourcesByType ? 'pointer' : 'default' }}
            onClick={(event) => {
              if (topSourcesByType?.[item.type]) {
                // Get position from the legend item
                const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect();
                if (rect) {
                  setTooltipState({
                    sourceType: item.type,
                    position: {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2,
                    },
                  });
                }
              }
            }}
          >
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-[#64748b] truncate">{item.type}</div>
              <div className="text-[13px] font-semibold text-[#1a1d29]">{item.percentage}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Render tooltip if active */}
      {tooltipState && tooltipSources.length > 0 && (
        <SourceTypeTooltip
          sourceType={tooltipState.sourceType}
          sources={tooltipSources}
          position={tooltipState.position}
          onClose={handleCloseTooltip}
        />
      )}
    </div>
  );
};

