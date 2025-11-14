import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { Topic } from '../types';

interface TopicsRacingBarChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
}

export const TopicsRacingBarChart = ({ topics, onBarClick }: TopicsRacingBarChartProps) => {
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

  // Transform data for Nivo Bar chart
  // Store topic mapping separately for click handler
  const topicMap = useMemo(() => {
    const map = new Map<string, Topic>();
    sortedTopics.forEach(topic => {
      map.set(topic.name, topic);
    });
    return map;
  }, [sortedTopics]);

  const chartData = useMemo(() => {
    // Reverse the array so highest values appear at top (Nivo renders bottom-to-top for horizontal bars)
    return [...sortedTopics].reverse().map((topic) => ({
      topic: topic.name,
      value: topic.currentSoA ?? 0,
    }));
  }, [sortedTopics]);

  // Calculate dynamic height based on number of topics (minimum 400px, add ~40px per topic)
  const chartHeight = useMemo(() => {
    return Math.max(400, sortedTopics.length * 40 + 100);
  }, [sortedTopics.length]);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div style={{ height: `${chartHeight}px`, cursor: 'pointer', position: 'relative' }}>
        <ResponsiveBar
          data={chartData}
          keys={['value']}
          indexBy="topic"
          layout="horizontal"
          margin={{ top: 16, right: 16, bottom: 12, left: 120 }}
          padding={0.1}
          valueScale={{ type: 'linear', min: 0, max: 100 }}
          indexScale={{ type: 'band', round: true }}
          colors="#498cf9" // Data viz 02 - matches Chart.js color
          borderRadius={4}
          borderWidth={0}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 8,
            tickRotation: 0,
            format: (value: number) => `${value}%`,
            tickValues: [0, 20, 40, 60, 80, 100],
            legend: 'Share of Answer (SoA)',
            legendPosition: 'middle',
            legendOffset: 40,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickRotation: 0,
            format: (value: string) => value,
            renderTick: (tick: any) => (
              <g transform={`translate(${tick.x},${tick.y})`}>
                <text
                  x={-8}
                  y={tick.textY}
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{
                    fill: textCaptionColor,
                    fontSize: 11,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                    fontWeight: 400,
                  }}
                >
                  {tick.value}
                </text>
              </g>
            ),
          }}
          enableGridX={true}
          enableGridY={false}
          gridXValues={[0, 20, 40, 60, 80, 100]}
          gridYValues={[]}
          theme={{
            axis: {
              domain: {
                line: {
                  stroke: 'transparent',
                  strokeWidth: 0,
                },
              },
              ticks: {
                line: {
                  stroke: 'transparent',
                  strokeWidth: 0,
                },
                text: {
                  fill: textCaptionColor,
                  fontSize: 9,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  fontWeight: 400,
                },
              },
              legend: {
                text: {
                  fill: chartLabelColor,
                  fontSize: 12,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  fontWeight: 600,
                },
              },
            },
            grid: {
              line: {
                stroke: chartGridColor,
                strokeWidth: 1,
              },
            },
          }}
          enableLabel={false}
          labelSkipWidth={12}
          labelSkipHeight={12}
          labelTextColor={{
            from: 'color',
            modifiers: [['darker', 1.6]],
          }}
          animate={true}
          motionConfig={{
            mass: 1,
            tension: 280,
            friction: 60,
            clamp: false,
            precision: 0.01,
            velocity: 0,
          }}
          onClick={(bar: any) => {
            const topicName = bar.data.topic as string;
            const topic = topicMap.get(topicName);
            if (onBarClick && topic) {
              onBarClick(topic);
            }
          }}
          tooltip={(props: any) => {
            const topicName = props.data.topic as string;
            const topic = topicMap.get(topicName);
            if (!topic) return null;
            
            const value = props.value as number;
            return (
              <div
                style={{
                  backgroundColor: 'rgba(26, 29, 41, 0.96)',
                  color: '#ffffff',
                  border: `1px solid ${chartAxisColor}`,
                  borderWidth: '1px',
                  borderRadius: '4px',
                  padding: '10px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  minWidth: '220px',
                }}
              >
                {/* Title */}
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    marginBottom: '0px',
                    color: '#ffffff',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  }}
                >
                  {topic.name}
                </div>
                {/* Body items with color indicator */}
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '6px',
                }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#498cf9',
                      borderRadius: '2px',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#ffffff',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  }}>
                    {topic.name}: {value.toFixed(1)}%
                  </div>
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: '#ffffff',
                  marginTop: '6px',
                  paddingLeft: '16px', // Align with text above (6px gap + 10px color box)
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                }}>
                  SoA: {topic.soA.toFixed(2)}×
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: '#ffffff',
                  marginTop: '6px',
                  paddingLeft: '16px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                }}>
                  Rank: {topic.rank}
                </div>
              </div>
            );
          }}
          legends={[]}
        />
      </div>
    </div>
  );
};
