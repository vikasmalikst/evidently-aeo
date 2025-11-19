import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { Topic } from '../types';
import type { Competitor } from '../utils/competitorColors';

interface TopicsBarChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
  competitors?: Competitor[];
}

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
  const textCaptionColor = useMemo(() => getCSSVariable('--text-caption'), []);
  
  // Brand color (data viz 02) - resolved from CSS variable
  const BRAND_COLOR = useMemo(() => getCSSVariable('--dataviz-2') || '#498cf9', []); // data-viz-02 (blue)
  // Avg Competitor color (data viz 04 at 48% opacity - orange)
  const AVG_COMPETITOR_COLOR = 'rgba(250, 138, 64, 0.48)'; // --dataviz-4 at 48% opacity
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

  // Generate mock average competitor and industry SoA data for each topic (deterministic)
  const getAvgCompetitorSoA = (topic: Topic, numCompetitors: number): number => {
    const seed = (topic.id.charCodeAt(0) + numCompetitors * 19) % 100;
    const baseSoA = topic.currentSoA ?? (topic.soA * 20);
    return Math.max(0, Math.min(100, baseSoA * (0.65 + (seed / 100) * 0.7)));
  };

  // Calculate average industry SoA across all topics for the horizontal line
  const avgIndustrySoA = useMemo(() => {
    if (!showComparison || sortedTopics.length === 0) return 0;
    const sum = sortedTopics.reduce((acc, topic) => {
      const seed = (topic.id.charCodeAt(0) * 13) % 100;
      const baseSoA = topic.currentSoA ?? (topic.soA * 20);
      const industrySoA = Math.max(0, Math.min(100, baseSoA * (0.7 + (seed / 100) * 0.6)));
      return acc + industrySoA;
    }, 0);
    return sum / sortedTopics.length;
  }, [sortedTopics, showComparison]);

  // Chart keys: brand, avgCompetitor
  const chartKeys = useMemo(() => {
    if (showComparison) {
      return ['brand', 'avgCompetitor'];
    }
    return ['value'];
  }, [showComparison]);

  const chartData = useMemo(() => {
    if (!showComparison) {
      // Single value per topic (no comparison)
      return sortedTopics.map((topic) => ({
        topic: topic.name,
        value: topic.currentSoA ?? 0,
        soA: topic.soA, // Include SoA metric (0-5x scale)
      }));
    } else {
      // Brand and avg competitor SoA per topic (industry avg shown as marker line)
      return sortedTopics.map((topic) => {
        const data: Record<string, string | number> = { 
          topic: topic.name,
          soA: topic.soA, // Include SoA metric (0-5x scale) for brand
        };
        
        // Add brand performance
        data['brand'] = topic.currentSoA ?? 0;
        
        // Add avg competitor SoA (muted color)
        data['avgCompetitor'] = getAvgCompetitorSoA(topic, competitors.length);
        
        return data;
      });
    }
  }, [sortedTopics, showComparison, competitors.length]);

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
          margin={{ top: 16, right: 16, bottom: showComparison ? 100 : 60, left: 120 }}
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
                } else if (key === 'avgCompetitor') {
                  return AVG_COMPETITOR_COLOR; // Data viz 04 (orange) at 48% opacity for avg competitor
                }
                return '#498cf9';
              }
            : BRAND_COLOR // Data viz 02 for single brand view
          }
          markers={showComparison && avgIndustrySoA > 0 ? [
            {
              axis: 'y',
              value: avgIndustrySoA,
              lineStyle: {
                stroke: AVG_INDUSTRY_COLOR,
                strokeWidth: 2,
                strokeDasharray: '4 4',
              },
              legend: 'Avg Industry SoA',
              legendPosition: 'top-left',
              textStyle: {
                fill: chartLabelColor || '#393e51',
                fontSize: 11,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
              },
            },
          ] : []}
          borderRadius={0} // Remove border radius on all bars
          borderWidth={showComparison ? 1 : 0}
          borderColor={showComparison ? '#ffffff' : 'transparent'}
          enableLabel={false}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 8,
            tickRotation: 45,
            format: (value: string) => value,
            legend: 'Topics',
            legendPosition: 'middle',
            legendOffset: 50,
            tickValues: undefined, // Show all topics
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 8,
            tickRotation: 0,
            format: (value: number) => `${value}%`,
            tickValues: 5, // Show 5 ticks
            legend: 'Share of Answer (SoA)',
            legendPosition: 'middle',
            legendOffset: -80,
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
                  fill: textCaptionColor || '#6b7280',
                  fontSize: 9,
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
              } else if (key === 'avgCompetitor') {
                label = 'Avg Competitor SoA';
                barColor = AVG_COMPETITOR_COLOR;
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
                    SoA: {topic.soA.toFixed(2)}×
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
                    SoA: {topic.soA.toFixed(2)}×
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
      
      {/* Custom Legend with Brand, Avg Competitor SoA, and Avg Industry SoA Marker */}
      {showComparison && (
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
          
          {/* Avg Competitor SoA */}
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: AVG_COMPETITOR_COLOR,
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '11px', color: chartLabelColor || '#393e51', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' }}>
              Avg Competitor SoA
            </span>
          </div>
          
          {/* Avg Industry SoA - Marker Line */}
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: '20px',
                height: '2px',
                background: `repeating-linear-gradient(to right, ${AVG_INDUSTRY_COLOR} 0, ${AVG_INDUSTRY_COLOR} 4px, transparent 4px, transparent 8px)`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '11px', color: chartLabelColor || '#393e51', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' }}>
              Avg Industry SoA
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
