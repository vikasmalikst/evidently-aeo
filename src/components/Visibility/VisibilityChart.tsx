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
import { Activity } from 'lucide-react';
import { formatDateLabel } from '../../utils/dateFormatting';

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

const getOrCreateTooltip = (chart: any) => {
  let tooltipEl = chart.canvas.parentNode.querySelector('div.chartjs-tooltip');

  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.classList.add('chartjs-tooltip');
    tooltipEl.style.background = 'rgba(26, 29, 41, 0.96)';
    tooltipEl.style.borderRadius = '4px';
    tooltipEl.style.color = 'white';
    tooltipEl.style.opacity = '1';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.transform = 'translate(-50%, 0)';
    tooltipEl.style.transition = 'all .1s ease';
    tooltipEl.style.zIndex = '100';
    tooltipEl.style.border = '1px solid #c6c9d2';
    tooltipEl.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';

    const table = document.createElement('table');
    table.style.margin = '0px';

    tooltipEl.appendChild(table);
    chart.canvas.parentNode.appendChild(tooltipEl);
  }

  return tooltipEl;
};

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
  logo?: string;
  domain?: string;
}

const buildLogoSources = (src?: string, domain?: string) => {
  const cleanDomain = domain
    ?.replace(/^https?:\/\//, '')
    .split('/')[0]
    .trim();

  const candidates = [
    src,
    cleanDomain ? `https://logo.clearbit.com/${cleanDomain}` : null,
    cleanDomain ? `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64` : null,
    cleanDomain ? `https://icon.horse/icon/${cleanDomain}` : null,
  ];

  // Remove falsy and duplicate entries while preserving order
  const seen = new Set<string>();
  return candidates.filter((url): url is string => {
    if (!url) return false;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

interface VisibilityChartProps {
  data: {
    labels: string[];
    datasets: Array<{
      id: string;
      label: string;
      data: Array<number | null>;
      isRealData?: boolean[]; // NEW: true if data from DB, false if interpolated
    }>;
  };
  chartType: string;
  selectedModels: string[];
  loading?: boolean;
  activeTab: string;
  models?: Model[];
  metricType?: 'visibility' | 'share' | 'sentiment' | 'brandPresence';
  completedRecommendations?: Array<{
    id: string;
    action: string;
    completedAt: string;
  }>;
}

export const VisibilityChart = memo((props: VisibilityChartProps) => {
  const {
    data,
    chartType = 'line',
    selectedModels = [],
    loading = false,
    activeTab = 'brand',
    models = [],
    metricType = 'visibility',
    completedRecommendations = []
  } = props;

  const chartRef = useRef<any>(null);
  const failedUrls = useRef(new Set<string>());
  const [focusedDataset, setFocusedDataset] = useState<number | null>(null);

  // Plugin for rendering vertical lines for recommendations
  const recommendationLinesPlugin = useMemo(() => ({
    id: 'recommendationLines',
    afterDraw: (chart: any) => {
      if (!completedRecommendations.length || !chart.scales.x) return;
      const { ctx, chartArea: { top, bottom, left, right }, scales: { x } } = chart;
      const labels = chart.data.labels;

      completedRecommendations.forEach((rec) => {
        const dateStr = rec.completedAt.split('T')[0];
        const label = formatDateLabel(dateStr);
        const index = labels.indexOf(label);

        if (index !== -1) {
          const xPos = x.getPixelForValue(labels[index]);
          if (xPos >= left && xPos <= right) {
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#7c3aed'; // Purple color for improvement events
            ctx.setLineDash([6, 4]);
            ctx.moveTo(xPos, top);
            ctx.lineTo(xPos, bottom);
            ctx.stroke();
            ctx.restore();
          }
        }
      });
    }
  }), [completedRecommendations]);

  useEffect(() => {
    setFocusedDataset(null);
  }, [selectedModels]);

  const [recMarkers, setRecMarkers] = useState<Array<{ x: number, y: number, action: string, id: string }>>([]);

  // Use a second effect to calculate marker positions after chart renders or data changes
  useEffect(() => {
    if (!chartRef.current || !completedRecommendations.length || !data?.labels) {
      setRecMarkers([]);
      return;
    }

    const chart = chartRef.current;
    const x = chart.scales.x;
    const top = chart.chartArea.top;
    const left = chart.chartArea.left;
    const right = chart.chartArea.right;
    const labels = chart.data.labels;

    const markers = completedRecommendations.map(rec => {
      const dateStr = rec.completedAt.split('T')[0];
      const label = formatDateLabel(dateStr);
      const index = labels.indexOf(label);

      if (index !== -1) {
        const xPos = x.getPixelForValue(labels[index]);
        if (xPos >= left && xPos <= right) {
          return {
            x: xPos,
            y: top,
            action: rec.action,
            id: rec.id
          };
        }
      }
      return null;
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    setRecMarkers(markers);
  }, [completedRecommendations, data?.labels, selectedModels, chartType, loading]);

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
          // Use isRealData to show dots only for real data points (not interpolated)
          const isRealData = modelData.isRealData
          const pointRadius = isRealData && isRealData.length === modelData.data.length
            ? isRealData.map((isReal) => (isReal ? (isDimmed ? 2 : 3) : 0)) // Show dot only if real data
            : (isDimmed ? 2 : 3) // Fallback: show all dots if isRealData not available

          return {
            label: modelData.label,
            data: modelData.data,
            borderColor: isDimmed ? inactiveBorderColor : activeBorderColor,
            pointBackgroundColor: isDimmed ? inactiveBorderColor : activeBorderColor,
            backgroundColor: 'transparent',
            borderWidth: isDimmed ? 1 : 2.5,
            pointRadius: pointRadius, // Array or number - Chart.js supports both
            pointHoverRadius: isDimmed ? 3 : 6,
            tension: 0.4,
            fill: false,
            spanGaps: false,
            logo: model?.logo, // Pass logo to dataset for tooltip access
            domain: model?.domain, // Pass domain to dataset
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

    return roundedMax;
  }, [data, selectedModels, metricType]);

  const options = useMemo(() => {
    const isBarChart = chartType === 'bar';

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          align: 'end' as const,
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            color: neutrals[400],
            font: {
              size: 12,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
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
          enabled: false,
          position: 'nearest' as const,
          external: (context: any) => {
            const { chart, tooltip } = context;
            const tooltipEl = getOrCreateTooltip(chart);

            // Hide if no tooltip
            if (tooltip.opacity === 0) {
              tooltipEl.style.opacity = '0';
              return;
            }

            // Set Text
            if (tooltip.body) {
              const titleLines = tooltip.title || [];
              const bodyLines = tooltip.body.map((b: any) => b.lines);

              const tableHead = document.createElement('thead');

              titleLines.forEach((title: string) => {
                const tr = document.createElement('tr');
                tr.style.borderWidth = '0';

                const th = document.createElement('th');
                th.style.borderWidth = '0';
                th.style.textAlign = 'left';
                th.style.paddingBottom = '8px';
                th.style.color = '#ffffff';
                th.style.fontSize = '12px';
                th.style.fontWeight = '600';
                th.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

                const text = document.createTextNode(title);
                th.appendChild(text);
                tr.appendChild(th);
                tableHead.appendChild(tr);
              });

              const tableBody = document.createElement('tbody');
              bodyLines.forEach((body: string, i: number) => {
                // Get the dataset to find the logo
                const dataPoint = tooltip.dataPoints[i];
                const dataset = chart.data.datasets[dataPoint.datasetIndex];

                const colors = tooltip.labelColors[i];
                const logoUrl = (dataset as any).logo;
                const domain = (dataset as any).domain;

                const tr = document.createElement('tr');
                tr.style.backgroundColor = 'inherit';
                tr.style.borderWidth = '0';

                const td = document.createElement('td');
                td.style.borderWidth = '0';
                td.style.display = 'flex';
                td.style.alignItems = 'center';
                td.style.padding = '4px 0';

                // Color indicator or Logo
                const iconContainer = document.createElement('div');
                iconContainer.style.width = '16px';
                iconContainer.style.height = '16px';
                iconContainer.style.minWidth = '16px';
                iconContainer.style.marginRight = '8px';
                iconContainer.style.display = 'flex';
                iconContainer.style.alignItems = 'center';
                iconContainer.style.justifyContent = 'center';

                // Fallback to dot helper
                const renderDot = () => {
                  const dot = document.createElement('span');
                  dot.style.background = colors.borderColor;
                  dot.style.borderColor = colors.borderColor;
                  dot.style.borderWidth = '2px';
                  dot.style.display = 'inline-block';
                  dot.style.height = '8px';
                  dot.style.width = '8px';
                  dot.style.borderRadius = '50%';
                  iconContainer.appendChild(dot);
                };

                if (logoUrl || domain) {
                  const img = document.createElement('img');
                  const candidates = buildLogoSources(logoUrl, domain);

                  if (candidates.length > 0) {
                    img.src = candidates[0];
                    img.style.width = '14px';
                    img.style.height = '14px';
                    img.style.objectFit = 'contain';
                    img.style.borderRadius = '2px';

                    img.onerror = () => {
                      failedUrls.current.add(img.src);
                      const nextCandidates = candidates.filter(url => !failedUrls.current.has(url));
                      if (nextCandidates.length > 0) {
                        img.src = nextCandidates[0];
                      } else {
                        img.style.display = 'none';
                        renderDot();
                      }
                    };

                    iconContainer.appendChild(img);
                  } else {
                    renderDot();
                  }
                } else {
                  renderDot();
                }

                td.appendChild(iconContainer);

                const textSpan = document.createElement('span');
                textSpan.style.color = '#ffffff';
                textSpan.style.fontSize = '12px';
                textSpan.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

                const labelFull = body[0];
                const labelParts = labelFull.split(':');
                const labelName = labelParts[0];
                const labelValue = labelParts[1];

                const nameSpan = document.createElement('span');
                nameSpan.style.color = 'rgba(255, 255, 255, 0.7)';
                nameSpan.style.marginRight = '4px';
                nameSpan.innerText = labelName + ':';

                const valueSpan = document.createElement('span');
                valueSpan.style.fontWeight = '600';
                valueSpan.innerText = labelValue;

                textSpan.appendChild(nameSpan);
                textSpan.appendChild(valueSpan);
                td.appendChild(textSpan);
                tr.appendChild(td);
                tableBody.appendChild(tr);
              });

              const root = tooltipEl.querySelector('table');

              // Remove old children
              while (root.firstChild) {
                root.firstChild.remove();
              }

              root.appendChild(tableHead);
              root.appendChild(tableBody);
            }

            const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

            // Display, position, and set styles for font
            tooltipEl.style.opacity = '1';
            tooltipEl.style.left = positionX + tooltip.caretX + 'px';
            tooltipEl.style.top = positionY + tooltip.caretY + 'px';
            tooltipEl.style.padding = tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
          }
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
          ticks: {
            color: neutrals[400],
            padding: 10,
            font: {
              size: 11,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
          },
        },
        y: {
          beginAtZero: true,
          max: calculatedMax,
          grid: {
            color: neutrals[100],
            drawBorder: false,
          },
          border: {
            display: false,
            dash: [4, 4],
          },
          ticks: {
            color: neutrals[400],
            padding: 10,
            font: {
              size: 11,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            maxTicksLimit: 6,
            callback: (value: any) => {
              if (metricType === 'sentiment') return value.toFixed(1);
              return value + (metricType === 'share' || metricType === 'brandPresence' ? '%' : '');
            },
          },
        },
      },
    };
  }, [chartType, metricType, calculatedMax]);

  return (
    <div className="relative w-full h-[320px]">
      {loading && (
        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500 font-medium">Updating chart...</span>
          </div>
        </div>
      )}
      <div className="w-full h-full relative">
        {chartData && (
          <>
            {chartType === 'bar' ? (
              <Bar ref={chartRef} data={chartData} options={options as any} plugins={[recommendationLinesPlugin]} />
            ) : (
              <Line ref={chartRef} data={chartData} options={options as any} plugins={[recommendationLinesPlugin]} />
            )}

            {/* Recommendation Markers (Icons on top of lines) */}
            {recMarkers.map((marker) => (
              <div
                key={marker.id}
                className="absolute z-20 group"
                style={{
                  left: `${marker.x}px`,
                  top: `${marker.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className="w-6 h-6 bg-white border-2 border-[#7c3aed] rounded-full flex items-center justify-center shadow-sm cursor-help hover:bg-[#7c3aed] transition-colors duration-200"
                >
                  <Activity size={12} className="text-[#7c3aed] group-hover:text-white" />
                </div>

                {/* Tooltip for Recommendation */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-30">
                  <div className="bg-[#1a1d29] text-white text-[11px] py-1.5 px-2.5 rounded shadow-xl whitespace-nowrap border border-slate-700">
                    <div className="font-bold text-[#a78bfa] mb-0.5">Recommendation Completed</div>
                    <div className="max-w-[200px] whitespace-normal leading-tight">
                      {marker.action}
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="w-2 h-2 bg-[#1a1d29] rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 border-r border-b border-slate-700"></div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
});
