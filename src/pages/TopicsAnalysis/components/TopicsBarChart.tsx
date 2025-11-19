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
import type { Competitor } from '../utils/competitorColors';
import { createCompetitorColorMap, getCompetitorColorById } from '../utils/competitorColors';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TopicsBarChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
  competitors?: Competitor[];
  selectedCompetitor?: string;
}

export const TopicsBarChart = ({ 
  topics, 
  onBarClick,
  competitors = [],
  selectedCompetitor = 'all'
}: TopicsBarChartProps) => {
  // Determine if we should show competitor breakdown
  const showCompetitorBreakdown = selectedCompetitor === 'all' && competitors.length > 0;
  
  // Create color map for competitors
  const competitorColorMap = useMemo(() => {
    return createCompetitorColorMap(competitors);
  }, [competitors]);
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

  // Generate mock competitor data for each topic (deterministic based on topic index)
  const competitorData = useMemo(() => {
    if (!showCompetitorBreakdown) return null;
    
    const competitorMap = new Map<string, Map<string, number>>();
    
    sortedTopics.forEach((topic, topicIndex) => {
      const topicCompetitors = new Map<string, number>();
      const baseSoA = topic.currentSoA ?? 0;
      
      // Generate competitor values that sum to approximately the base SoA
      // Use deterministic distribution based on topic index for consistency
      const seed = topicIndex * 17; // Deterministic seed
      let remaining = baseSoA;
      const portions: number[] = [];
      
      // Generate portions deterministically
      for (let compIndex = 0; compIndex < competitors.length; compIndex++) {
        if (compIndex < competitors.length - 1) {
          // Use deterministic pseudo-random distribution
          const pseudoRandom = ((seed + compIndex * 7) % 100) / 100;
          const portion = remaining * (0.05 + pseudoRandom * 0.15);
          portions.push(Math.max(0, Math.min(portion, remaining)));
          remaining = Math.max(0, remaining - portion);
        } else {
          // Last competitor gets the remainder
          portions.push(remaining);
        }
      }
      
      // Assign portions to competitors
      competitors.forEach((competitor, compIndex) => {
        topicCompetitors.set(competitor.id, portions[compIndex] ?? 0);
      });
      
      competitorMap.set(topic.name, topicCompetitors);
    });
    
    return competitorMap;
  }, [sortedTopics, showCompetitorBreakdown, competitors]);

  const chartData = useMemo(() => {
    if (!showCompetitorBreakdown) {
      return {
        labels: sortedTopics.map((t) => t.name),
        datasets: [
          {
            label: 'Share of Answer (SoA)',
            data: sortedTopics.map((t) => t.currentSoA ?? 0),
            backgroundColor: '#498cf9', // Data viz 02
            borderRadius: 0, // Remove border radius
            borderSkipped: false,
          },
        ],
      };
    } else {
      // Stacked bar chart with competitors
      return {
        labels: sortedTopics.map((t) => t.name),
        datasets: competitors.map((competitor) => ({
          label: competitor.name,
          data: sortedTopics.map((topic) => {
            const topicCompetitors = competitorData?.get(topic.name);
            return topicCompetitors?.get(competitor.id) ?? 0;
          }),
          backgroundColor: getCompetitorColorById(competitor.id, competitorColorMap),
          borderRadius: 0, // Remove border radius
          borderSkipped: false,
        })),
      };
    }
  }, [sortedTopics, showCompetitorBreakdown, competitors, competitorData, competitorColorMap]);

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
          display: showCompetitorBreakdown,
          position: 'bottom' as const,
          labels: {
            usePointStyle: true,
            pointStyle: 'rect',
            padding: 15,
            font: {
              size: 11,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            color: chartLabelColor,
          },
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
              const datasetLabel = context.dataset.label || '';
              const value = context.parsed.y;
              
              if (showCompetitorBreakdown) {
                // Stacked view: show competitor-specific info
                const lines = [`${datasetLabel}: ${value.toFixed(1)}%`];
                if (topic) {
                  lines.push(`SoA: ${topic.soA.toFixed(2)}×`);
                }
                return lines;
              } else {
                // Non-stacked view: show topic info
                const lines = [`${value.toFixed(1)}%`];
                if (topic) {
                  lines.push(`SoA: ${topic.soA.toFixed(2)}×`);
                  lines.push(`Rank: ${topic.rank}`);
                }
                return lines;
              }
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
          categoryPercentage: showCompetitorBreakdown ? 0.7 : 0.6, // Slightly wider when stacked
          barPercentage: showCompetitorBreakdown ? 0.9 : 0.8, // More space when stacked
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
          bottom: showCompetitorBreakdown ? 60 : 12, // Extra space for legend when stacked
          left: 8,
        },
      },
      animation: {
        duration: 500,
        easing: 'easeInOutQuart' as const,
      },
    };
  }, [sortedTopics, onBarClick, chartGridColor, chartLabelColor, chartAxisColor, textCaptionColor, showCompetitorBreakdown]);

  // Calculate dynamic height based on number of topics
  // Balance between expanding height and reducing bar size
  const chartHeight = useMemo(() => {
    const baseHeight = Math.min(Math.max(400, sortedTopics.length * 50 + 100), 800);
    // Add extra height for legend when showing competitors
    return showCompetitorBreakdown ? baseHeight + 40 : baseHeight;
  }, [sortedTopics.length, showCompetitorBreakdown]);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div style={{ height: `${chartHeight}px`, cursor: 'pointer' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

