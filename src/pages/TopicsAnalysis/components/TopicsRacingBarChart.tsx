import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { Topic } from '../types';
import type { Competitor } from '../utils/competitorColors';
import { wrapLabelText } from '../utils/text';

interface TopicsRacingBarChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
  stackData?: boolean;
  competitors?: Competitor[];
  brandFavicon?: string;
  brandName?: string;
}

export const TopicsRacingBarChart = ({ 
  topics, 
  onBarClick, 
  stackData = false,
  competitors = [],
  brandFavicon: _brandFavicon, // Unused - removed from legend
  brandName = 'Brand'
}: TopicsRacingBarChartProps) => {
  // IMPORTANT:
  // Competitors load asynchronously; tying comparison mode to `competitors.length`
  // causes a visual “reload” even when topic data is cached. Base comparison on
  // whether topic data actually has industry averages.
  
  // Determine if bars should be stacked or grouped (computed after showComparison is defined)
  
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
  const textCaptionColor = useMemo(() => getCSSVariable('--text-caption'), []);
  
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

  const showComparison = hasIndustryData;

  // Determine if bars should be stacked or grouped
  const isStacked = stackData && showComparison;
  const isGrouped = !stackData && showComparison;

  // Calculate average competitor SoA across all topics for the horizontal marker line
  const avgIndustrySoA = useMemo(() => {
    if (!hasIndustryData || sortedTopics.length === 0) return 0;
    const topicsWithIndustryData = sortedTopics.filter(topic => 
      topic.industryAvgSoA !== null && 
      topic.industryAvgSoA !== undefined && 
      topic.industryAvgSoA > 0
    );
    if (topicsWithIndustryData.length === 0) return 0;
    
    const sum = topicsWithIndustryData.reduce((acc, topic) => {
      // Convert multiplier (0-5x) to percentage (0-100)
      const industrySoAPercentage = (topic.industryAvgSoA || 0) * 20;
      return acc + industrySoAPercentage;
    }, 0);
    return sum / topicsWithIndustryData.length;
  }, [sortedTopics, hasIndustryData]);
  
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
      return [...sortedTopics].reverse().map((topic) => ({
        topic: topic.name,
        value: topic.currentSoA ?? 0,
        soA: topic.soA, // Include SoA metric (0-5x scale)
      }));
    } else {
      // Brand and avg competitor SoA per topic (competitor avg also shown as marker line)
      return [...sortedTopics].reverse().map((topic) => {
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

  // Calculate dynamic height based on number of topics
  // Balance between expanding height and reducing bar size
  const chartHeight = useMemo(() => {
    // Increase row height for better visibility of bars and more vertical space
    const rowHeight = showComparison ? 65 : 55;
    const baseHeight = sortedTopics.length * rowHeight;
    // Add padding but cap max height to prevent excessive scrolling
    // Add extra space for legend when showing comparison
    const legendSpace = showComparison ? 80 : 0;
    return Math.min(Math.max(400, baseHeight + 120 + legendSpace), 1200);
  }, [sortedTopics.length, showComparison]);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div style={{ height: `${chartHeight}px`, cursor: 'pointer', position: 'relative' }}>
        <ResponsiveBar
          data={chartData}
          keys={chartKeys}
          indexBy="topic"
          layout="horizontal"
          margin={{ top: 16, right: 60, bottom: showComparison ? 100 : 12, left: 120 }}
          padding={showComparison ? 0.25 : 0.20} // Increased spacing between bars for more vertical space
          innerPadding={showComparison && isGrouped ? 4 : 0} // Vertical spacing between bars in grouped mode
          groupMode={isStacked ? 'stacked' : isGrouped ? 'grouped' : undefined}
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
            : "#498cf9" // Data viz 01 - matches Chart.js color
          }
          markers={[]}
          borderRadius={0} // Remove border radius on all bars
          borderWidth={showComparison ? (isGrouped ? 0 : 1) : 0}
          borderColor={showComparison && !isGrouped ? '#ffffff' : 'transparent'}
          enableLabel={false}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 8,
            tickRotation: 0,
            format: (value: number) => `${value}%`,
            tickValues: [0, 20, 40, 60, 80, 100], // Keep major ticks at 20% intervals
            legend: 'Share of Answer (SoA)',
            legendPosition: 'middle',
            legendOffset: 40,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickRotation: 0,
            format: (value: string) => value,
            renderTick: (tick: any) => {
              const topicName = String(tick.value);
              const lines = wrapLabelText(topicName, 18);
              const lineHeight = 13;
              const offsetY = -(lines.length - 1) * lineHeight / 2;

              return (
                <g transform={`translate(${tick.x},${tick.y})`}>
                  {lines.map((line, index) => (
                    <text
                      key={`${topicName}-${index}`}
                      x={-8}
                      y={offsetY + index * lineHeight}
                      textAnchor="end"
                      dominantBaseline="middle"
                      style={{
                        fill: textCaptionColor || '#6e7387',
                        fontSize: 11,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                        fontWeight: 400,
                      }}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            },
          }}
          enableGridX={true}
          enableGridY={false}
          gridXValues={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} // More grid lines for better scannability
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
            
            const key = showComparison ? props.id : null;
            const value = props.value as number;
            
            let label = '';
            let barColor = '#498cf9';
            
            if (showComparison && key) {
              if (key === 'brand') {
                label = `${brandName} SoA`;
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
                </div>
              );
            } else {
              // Non-stacked view: show topic tooltip
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
                    paddingLeft: '16px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  }}>
                    SoA: {value.toFixed(1)}%
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
            }
          }}
          legends={[]}
          layers={[
            'grid',
            'markers',
            'axes',
            'bars',
            'legends',
            (props: any) => {
              // Custom layer to add SoA labels to the right of bars
              const { bars, xScale, yScale } = props;
              
              return (
                <g>
                  {bars.map((bar: any) => {
                    // Only show label for brand bars (or single value bars)
                    const isBrandBar = showComparison ? bar.id === 'brand' : true;
                    if (!isBrandBar) return null;
                    
                    const topicName = bar.data.topic as string;
                    const topic = topicMap.get(topicName);
                    if (!topic) return null;
                    
                    // Get the SoA value as percentage
                    const soAValue = topic.currentSoA ?? (topic.soA * 20);
                    const xPosition = xScale(soAValue) + 8; // Position to the right of the bar
                    const yPosition = yScale(bar.data.topic) + (yScale.bandwidth() / 2);
                    
                    return (
                      <text
                        key={`label-${bar.id}-${bar.data.topic}`}
                        x={xPosition}
                        y={yPosition}
                        textAnchor="start"
                        dominantBaseline="middle"
                        style={{
                          fill: textCaptionColor,
                          fontSize: 11,
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                          fontWeight: 500,
                        }}
                      >
                        {soAValue.toFixed(1)}%
                      </text>
                    );
                  })}
                </g>
              );
            },
          ]}
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
              {brandName} SoA
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
