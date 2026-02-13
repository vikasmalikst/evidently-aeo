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
import { MetricType } from './KpiToggle';

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
    tooltipEl.style.background = '#ffffff';
    tooltipEl.style.borderRadius = '12px';
    tooltipEl.style.opacity = '1';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.position = 'absolute';
    // tooltipEl.style.transform = 'translate(-50%, 0)'; // Moved to external handler for dynamic positioning
    tooltipEl.style.zIndex = '100';
    tooltipEl.style.border = '1px solid #f1f5f9';
    tooltipEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)';
    tooltipEl.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    tooltipEl.style.transition = 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), top 0.1s cubic-bezier(0.4, 0, 0.2, 1), left 0.1s cubic-bezier(0.4, 0, 0.2, 1)';
    tooltipEl.style.padding = '0'; // Reset padding, will be handled by internal container

    const container = document.createElement('div');
    container.style.padding = '12px 14px';
    container.classList.add('tooltip-container');

    tooltipEl.appendChild(container);
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
  metricType?: MetricType;
  completedRecommendations?: Array<{
    id: string;
    action: string;
    completedAt: string;
  }>;
  rawDates?: string[];
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
    completedRecommendations = [],
    rawDates = []
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
            ctx.moveTo(xPos, top + 40);
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

  const [recMarkers, setRecMarkers] = useState<Array<{ x: number, y: number, action: string, id: string, isNearRight?: boolean }>>([]);

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
            y: top + 26,
            action: rec.action,
            id: rec.id,
            isNearRight: xPos > (chart.width - 150) // Heuristic: if within 150px of right edge
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
    const paddedMax = maxValue * 1.35;
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

              const dataPoints = tooltip.dataPoints || [];
              const dataIndex = dataPoints.length > 0 ? dataPoints[0].dataIndex : -1;
              
              // Resolve proper title (formatted date)
              let displayTitle = '';
              if (dataIndex !== -1 && rawDates && rawDates[dataIndex]) {
                 try {
                   // Ensure consistent formatting: "Sat, Oct 7, 2023"
                   // Parse explicitly to avoid TZ issues if possible, but localized string is fine for display
                   // We use the same parsing logic as in dateFormatting.ts if needed, but Date constructor usually works for YYYY-MM-DD
                   // Better to use the utility if available, but for now simple Date is okay or we can use the label if it fails
                   const [y, m, d] = rawDates[dataIndex].split('-').map(Number);
                   const dateObj = new Date(y, m - 1, d);
                   displayTitle = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                 } catch (e) {
                   displayTitle = titleLines[0];
                 }
              } else {
                 displayTitle = titleLines[0];
              }

              const headerDiv = document.createElement('div');
              headerDiv.style.marginBottom = '12px';
              headerDiv.style.paddingBottom = '8px';
              headerDiv.style.borderBottom = '1px solid #f1f5f9'; // Slate 100
              
              const titleSpan = document.createElement('div');
              titleSpan.style.color = '#64748b'; // Slate 500
              titleSpan.style.fontSize = '11px';
              titleSpan.style.fontWeight = '600';
              titleSpan.style.textTransform = 'uppercase';
              titleSpan.style.letterSpacing = '0.05em';
              titleSpan.innerText = displayTitle;
              headerDiv.appendChild(titleSpan);

              // Sort data points by value (descending) to show highest value on top
              // dataPoints is already defined above
              const sortedIndices = dataPoints
                .map((dp: any, i: number) => ({ index: i, value: dp.raw as number }))
                .sort((a: any, b: any) => {
                  // Handle potential non-numeric values gracefully
                  const valA = typeof a.value === 'number' ? a.value : 0;
                  const valB = typeof b.value === 'number' ? b.value : 0;
                  return valB - valA;
                })
                .map((item: any) => item.index);

              const rowsContainer = document.createElement('div');
              rowsContainer.style.display = 'flex';
              rowsContainer.style.flexDirection = 'column';
              rowsContainer.style.gap = '6px';

              // Iterate using sorted indices
              sortedIndices.forEach((sortedIndex: number) => {
                const body = bodyLines[sortedIndex];
                // Get the dataset to find the logo
                const dataPoint = tooltip.dataPoints[sortedIndex];
                const dataset = chart.data.datasets[dataPoint.datasetIndex];

                const colors = tooltip.labelColors[sortedIndex];
                const logoUrl = (dataset as any).logo;
                const domain = (dataset as any).domain;

                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.width = '100%';
                row.style.minWidth = '180px'; 
                row.style.gap = '16px';

                const leftSide = document.createElement('div');
                leftSide.style.display = 'flex';
                leftSide.style.alignItems = 'center';
                leftSide.style.gap = '8px';
                leftSide.style.overflow = 'hidden';

                // Color indicator or Logo
                const iconContainer = document.createElement('div');
                iconContainer.style.width = '16px';
                iconContainer.style.height = '16px';
                iconContainer.style.minWidth = '16px'; // Prevent shrink
                iconContainer.style.display = 'flex';
                iconContainer.style.alignItems = 'center';
                iconContainer.style.justifyContent = 'center';

                // Fallback to dot helper
                const renderDot = () => {
                  const dot = document.createElement('div');
                  dot.style.background = colors.backgroundColor;
                  dot.style.border = `2px solid ${colors.borderColor}`;
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
                    img.style.width = '16px';
                    img.style.height = '16px';
                    img.style.objectFit = 'contain';
                    img.style.borderRadius = '4px'; // Slightly rounded logo
                    
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

                leftSide.appendChild(iconContainer);

                const labelFull = body[0];
                const labelParts = labelFull.split(':');
                const labelName = labelParts[0];
                const labelValue = labelParts[1];

                const nameSpan = document.createElement('span');
                nameSpan.style.color = '#334155'; // Slate 700 - darker for readability
                nameSpan.style.fontSize = '12px';
                nameSpan.style.fontWeight = '500';
                nameSpan.style.whiteSpace = 'nowrap';
                nameSpan.style.overflow = 'hidden';
                nameSpan.style.textOverflow = 'ellipsis';
                nameSpan.style.maxWidth = '140px'; 
                nameSpan.innerText = labelName;

                leftSide.appendChild(nameSpan);

                const valueSpan = document.createElement('span');
                valueSpan.style.color = '#0f172a'; // Slate 900 - darkest
                valueSpan.style.fontSize = '12px';
                valueSpan.style.fontWeight = '600';
                valueSpan.style.fontVariantNumeric = 'tabular-nums';
                valueSpan.innerText = labelValue;

                row.appendChild(leftSide);
                row.appendChild(valueSpan);
                rowsContainer.appendChild(row);
              });

              const root = tooltipEl.querySelector('.tooltip-container');
              if (root) {
                // Remove old children
                while (root.firstChild) {
                  root.firstChild.remove();
                }

                root.appendChild(headerDiv);
                root.appendChild(rowsContainer);
              }
            }

            const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

            // Display, position, and set styles for font
            tooltipEl.style.opacity = '1';

            // Smart Positioning Logic (Clamped to Chart Area)
            const tooltipRect = tooltipEl.getBoundingClientRect();

            // chart.canvas.height gives the internal canvas height, but we want the CSS height
            // However, positionY is 0 relative to parent if parent is the container. 
            // Better to use chart.chartArea to know the drawing bounds, but tooltip usually floats over the whole canvas.
            // Let's rely on the parent container height which is 320px
            const chartHeight = chart.canvas.parentNode.clientHeight || 320;
            const tooltipHeight = tooltipRect.height;
            const tooltipWidth = tooltipRect.width;

            // Default position: below the cursor
            let topPos = positionY + tooltip.caretY + 10;
            let leftPos = positionX + tooltip.caretX;

            // Check if it overflows the bottom of the chart container
            if (topPos + tooltipHeight > chartHeight) {
              // Try positioning above
              topPos = positionY + tooltip.caretY - tooltipHeight - 10;
            }

            // If it NOW overflows the top (unlikely but possible if at very top), clamp it
            if (topPos < 0) {
              topPos = 0; // Stick to top
            }

            // If it STILL overflows the bottom (because it was clamped from top, or cursor is in middle but tooltip is huge)
            // Force clamp to bottom edge
            if (topPos + tooltipHeight > chartHeight) {
              topPos = chartHeight - tooltipHeight;
            }
            
            // Handle Horizontal Overflow
            // By default we center it: transform: translate(-50%, 0)
            // We need to check if leftPos - width/2 < 0 (left overflow)
            // or leftPos + width/2 > chartWidth (right overflow)
            
            const chartWidth = chart.width;
            
            let translateX = -50;
            
            if (leftPos - tooltipWidth / 2 < 0) {
               // Left overflow: shift right. remove translate
               translateX = 0;
               leftPos = 10; // padding
            } else if (leftPos + tooltipWidth / 2 > chartWidth) {
               // Right overflow: shift left
               translateX = -100;
               leftPos = chartWidth - 10; // padding
            }

            tooltipEl.style.transform = `translate(${translateX}%, 0)`; 
            tooltipEl.style.left = leftPos + 'px';
            tooltipEl.style.top = topPos + 'px';
            tooltipEl.style.padding = '0';
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
                  className="w-6 h-6 bg-[#7c3aed] border-2 border-[#7c3aed] rounded-full flex items-center justify-center shadow-sm cursor-help hover:bg-[#6d28d9] transition-colors duration-200"
                >
                  <Activity size={12} className="text-white" />
                </div>

                {/* Tooltip for Recommendation */}
                {marker.y < 150 ? (
                  // Top of chart: Show tooltip BELOW
                  <div className={`absolute top-full mt-3 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 ${marker.isNearRight ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                    {/* Arrow (Top) */}
                    <div className={`w-2 h-2 bg-[#1a1d29] rotate-45 absolute -top-1 border-l border-t border-slate-700 ${marker.isNearRight ? 'right-2' : 'left-1/2 -translate-x-1/2'}`}></div>

                    <div className="bg-[#1a1d29] text-white text-[11px] py-1.5 px-2.5 rounded shadow-xl whitespace-nowrap border border-slate-700 relative">
                      <div className="font-bold text-[#a78bfa] mb-0.5">Recommendation Completed</div>
                      <div className="max-w-[200px] whitespace-normal leading-tight">
                        {marker.action}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Normal: Show tooltip ABOVE
                  <div className={`absolute bottom-full mb-3 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 ${marker.isNearRight ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                    <div className="bg-[#1a1d29] text-white text-[11px] py-1.5 px-2.5 rounded shadow-xl whitespace-nowrap border border-slate-700 relative">
                      <div className="font-bold text-[#a78bfa] mb-0.5">Recommendation Completed</div>
                      <div className="max-w-[200px] whitespace-normal leading-tight">
                        {marker.action}
                      </div>
                    </div>
                    {/* Arrow (Bottom) */}
                    <div className={`w-2 h-2 bg-[#1a1d29] rotate-45 absolute -bottom-1 border-r border-b border-slate-700 ${marker.isNearRight ? 'right-2' : 'left-1/2 -translate-x-1/2'}`}></div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
});
