import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { Topic } from '../types';
import type { Competitor } from '../utils/competitorColors';
import { wrapLabelText } from '../utils/text';

interface TopicsBarChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
  competitors?: Competitor[];
}

const LEFT_AXIS_CHAR_LIMIT = 25;
const LEFT_AXIS_LINE_HEIGHT = 14;
const BOTTOM_AXIS_CHAR_LIMIT = 18;
const BOTTOM_AXIS_LINE_HEIGHT = 13;

export const TopicsBarChart = ({ 
  topics, 
  onBarClick,
  competitors = []
}: TopicsBarChartProps) => {
  // Always show comparison (brand + avg competitor + industry line) when competitors are available
  const showComparison = competitors.length > 0;
  
  // Helper function to resolve CSS variable at runtime
  const getCSSVariable = (variableName: string): string => {
    if (typeof window !== 'undefined') {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(variableName)
        .trim() || ''; // Return empty string if not found
    }
    return ''; // Fallback for SSR
  };

  // Resolve CSS variables for chart colors
  const chartGridColor = useMemo(() => getCSSVariable('--chart-grid'), []);
  const chartLabelColor = useMemo(() => getCSSVariable('--chart-label'), []);
  const chartAxisColor = useMemo(() => getCSSVariable('--chart-axis'), []);
  
  // Brand color (data viz 02) - resolved from CSS variable
  const BRAND_COLOR = useMemo(() => getCSSVariable('--dataviz-2') || '#498cf9', []); // data-viz-02 (blue)
  // Avg Industry color (neutral 400)
  const AVG_INDUSTRY_COLOR = '#8b90a7'; // neutral-400

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

  // Use real competitor average SOA from backend (stored as multiplier 0-5x, convert to percentage 0-100)
  // Only show comparison if at least one topic has competitor data
  const hasIndustryData = useMemo(() => {
    return sortedTopics.some(topic => 
      topic.industryAvgSoA !== null && 
      topic.industryAvgSoA !== undefined && 
      topic.industryAvgSoA > 0
    );
  }, [sortedTopics]);


  // Chart keys: brand, avgIndustry (only show comparison if competitor data exists)
  const chartKeys = useMemo(() => {
    if (showComparison && hasIndustryData) {
      return ['brand', 'avgIndustry'];
    }
    return ['value'];
  }, [showComparison, hasIndustryData]);

  const chartData = useMemo(() => {
    if (!showComparison || !hasIndustryData) {
      // Single value per topic (no comparison)
      return sortedTopics.map((topic) => ({
        topic: topic.name,
        value: topic.currentSoA ?? 0,
        soA: topic.soA, // Include SoA metric (0-5x scale)
      }));
    } else {
      // Brand and avg competitor SoA per topic (competitor avg also shown as marker line)
      return sortedTopics.map((topic) => {
        const data: Record<string, string | number> = { 
          topic: topic.name,
          soA: topic.soA, // Include SoA metric (0-5x scale) for brand
        };
        
        // Add brand performance
        data['brand'] = topic.currentSoA ?? 0;
        
        // Add avg competitor SoA from backend (convert multiplier to percentage)
        // Only show if competitor data exists for this topic
        if (topic.industryAvgSoA !== null && topic.industryAvgSoA !== undefined && topic.industryAvgSoA > 0) {
          data['avgIndustry'] = (topic.industryAvgSoA * 20); // Convert multiplier (0-5x) to percentage (0-100)
        } else {
          data['avgIndustry'] = 0; // No data for this topic
        }
        
        return data;
      });
    }
  }, [sortedTopics, showComparison, hasIndustryData]);

  const maxBottomLabelLines = useMemo(() => {
    if (!sortedTopics.length) return 1;
    return sortedTopics.reduce((max, topic) => {
      const lines = wrapLabelText(topic.name, BOTTOM_AXIS_CHAR_LIMIT);
      return Math.max(max, lines.length);
    }, 1);
  }, [sortedTopics]);

  const axisBottomMargin = useMemo(() => {
    const base = showComparison ? 110 : 70;
    return base + Math.max(0, (maxBottomLabelLines - 1) * BOTTOM_AXIS_LINE_HEIGHT);
  }, [showComparison, maxBottomLabelLines]);

  const axisBottomLegendOffset = useMemo(() => {
    return 40 + (maxBottomLabelLines - 1) * BOTTOM_AXIS_LINE_HEIGHT;
  }, [maxBottomLabelLines]);

  // Calculate dynamic height based on number of topics
  // Balance between expanding height and reducing bar size
  const chartHeight = useMemo(() => {
    const baseHeight = Math.min(Math.max(400, sortedTopics.length * 50 + 100), 800);
    // Add extra height for legend when showing competitors or comparison
    return (showComparison) ? baseHeight + 40 : baseHeight;
  }, [sortedTopics.length, showComparison]);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div style={{ height: `${chartHeight}px`, cursor: 'pointer', position: 'relative' }}>
        <ResponsiveBar
          data={chartData}
          keys={chartKeys}
          indexBy="topic"
          layout="vertical"
          margin={{ top: 16, right: 16, bottom: axisBottomMargin, left: 250 }}
          padding={showComparison ? 0.4 : 0.6}
          innerPadding={showComparison ? 4 : 0} // Spacing between bars in grouped mode
          groupMode={showComparison ? 'grouped' : undefined}
          valueScale={{ type: 'linear', min: 0, max: 100 }}
          indexScale={{ type: 'band', round: true }}
          colors={showComparison
            ? (bar: any) => {
                const key = bar.id as string;
                if (key === 'brand') {
                  return BRAND_COLOR; // Data viz 02 (blue) for brand
                } else if (key === 'avgIndustry') {
                  return AVG_INDUSTRY_COLOR; // neutral-400 for avg industry
                }
                return '#498cf9';
              }
            : BRAND_COLOR // Data viz 02 for single brand view
          }
          markers={[]}
          borderRadius={0} // Remove border radius on all bars
          borderWidth={showComparison ? 1 : 0}
          borderColor={showComparison ? '#ffffff' : 'transparent'}
          enableLabel={false}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 8,
            tickRotation: 0,
            legend: 'Share of Answer (SoA)',
            legendPosition: 'middle',
            legendOffset: axisBottomLegendOffset,
            renderTick: (tick: any) => {
              const topicName = String(tick.value);
              const lines = wrapLabelText(topicName, BOTTOM_AXIS_CHAR_LIMIT);
              const textY = (tick.textY ?? 0) + 2;
              
              return (
                <g transform={`translate(${tick.x},${tick.y})`}>
                  {lines.map((line, index) => (
                    <text
                      key={`${topicName}-${index}`}
                      x={0}
                      y={textY + index * BOTTOM_AXIS_LINE_HEIGHT}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      style={{
                        fill: chartLabelColor || '#393e51',
                        fontSize: 11,
                        fontWeight: 500,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                      }}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            },
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 12,
            tickRotation: 0,
            format: (value: any) => value, // Keep original value for renderTick
            legend: 'Share of Answer (SoA)',
            legendPosition: 'middle',
            legendOffset: -100,
            renderTick: (tick: any) => {
              const topicName = String(tick.value);
              const lines = wrapLabelText(topicName, LEFT_AXIS_CHAR_LIMIT);
              const offsetY = -(lines.length - 1) * LEFT_AXIS_LINE_HEIGHT / 2;
              
              return (
                <g transform={`translate(${tick.x},${tick.y})`}>
                  {lines.map((line, index) => (
                    <text
                      key={index}
                      x={0}
                      y={offsetY + index * LEFT_AXIS_LINE_HEIGHT}
                      textAnchor="end"
                      dominantBaseline="middle"
                      style={{
                        fill: chartLabelColor || '#393e51',
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                      }}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            },
          }}
          gridYValues={[0, 20, 40, 60, 80, 100]}
          theme={{
            axis: {
              domain: {
                line: {
                  stroke: chartAxisColor || '#e8e9ed',
                  strokeWidth: 1,
                },
              },
              ticks: {
                line: {
                  stroke: chartAxisColor || '#e8e9ed',
                  strokeWidth: 1,
                },
                text: {
                  fill: chartLabelColor || '#393e51',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                },
              },
              legend: {
                text: {
                  fill: chartLabelColor || '#393e51',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                },
              },
            },
            grid: {
              line: {
                stroke: chartGridColor || '#e8e9ed',
                strokeWidth: 1,
              },
            },
            tooltip: {
              container: {
                background: 'rgba(26, 29, 41, 0.96)',
                color: '#ffffff',
                fontSize: '11px',
                borderRadius: '4px',
                padding: '10px',
                border: `1px solid ${chartAxisColor || '#e8e9ed'}`,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
              },
            },
          }}
          tooltip={(props: any) => {
            const topicName = props.data.topic as string;
            const topic = topicMap.get(topicName);
            if (!topic) return null;
            
            const key = showComparison ? props.id : null;
            const value = props.value as number;
            
            let label = '';
            let barColor = BRAND_COLOR;
            
            if (showComparison && key) {
              if (key === 'brand') {
                label = 'Brand';
                barColor = BRAND_COLOR; // Data viz 02 (blue) for brand
              } else if (key === 'avgIndustry') {
                label = 'Competitor SoA';
                barColor = AVG_INDUSTRY_COLOR;
              }
            }
            
            if (showComparison && key && label) {
              // Comparison view: show specific tooltip
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
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      marginBottom: '4px',
                      color: '#ffffff',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                    }}
                  >
                    {topic.name}
                  </div>
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
                        backgroundColor: barColor,
                        borderRadius: '2px',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#ffffff',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                    }}>
                      {label}: {value.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '11px',
                    color: '#ffffff',
                    marginTop: '6px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  }}>
                    SoA: {value.toFixed(1)}%
                  </div>
                </div>
              );
            } else {
              // Single brand view: show topic tooltip
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
                        backgroundColor: barColor,
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
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  }}>
                    SoA: {value.toFixed(1)}%
                  </div>
                  <div style={{ 
                    fontSize: '11px',
                    color: '#ffffff',
                    marginTop: '6px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  }}>
                    Rank: {topic.rank}
                  </div>
                </div>
              );
            }
          }}
          onClick={(bar) => {
            if (onBarClick) {
              const topic = topicMap.get(bar.indexValue as string);
              if (topic) {
                onBarClick(topic);
              }
            }
          }}
          legends={[]}
        />
      </div>
      
      {/* Custom Legend with Brand, Competitor SoA Bar, and Competitor SoA Marker */}
      {showComparison && hasIndustryData && (
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pb-2">
          {/* Brand */}
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: BRAND_COLOR,
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '11px', color: chartLabelColor || '#393e51', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' }}>
              Brand
            </span>
          </div>
          
          {/* Competitor SoA - Bar */}
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: AVG_INDUSTRY_COLOR,
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '11px', color: chartLabelColor || '#393e51', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' }}>
              Competitor SoA
            </span>
          </div>
          
        </div>
      )}
    </div>
  );
};
