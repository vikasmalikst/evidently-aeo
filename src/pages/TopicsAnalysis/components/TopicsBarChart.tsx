import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { Topic } from '../types';
import type { Competitor } from '../utils/competitorColors';
import type { ManagedCompetitor } from '../../../api/competitorManagementApi';
import { wrapLabelText } from '../utils/text';

interface TopicsBarChartProps {
  topics: Topic[];
  onBarClick?: (topic: Topic) => void;
  competitors?: Competitor[];
  selectedCompetitor?: string;
  managedCompetitors?: ManagedCompetitor[];
  selectedCompetitors?: Set<string>;
  metricType?: 'share' | 'visibility' | 'sentiment';
}

const LEFT_AXIS_CHAR_LIMIT = 25;
const LEFT_AXIS_LINE_HEIGHT = 14;
const BOTTOM_AXIS_CHAR_LIMIT = 18;
const BOTTOM_AXIS_LINE_HEIGHT = 13;

export const TopicsBarChart = ({ 
  topics, 
  onBarClick,
  competitors: _competitors = [],
  selectedCompetitor: _selectedCompetitor, // kept for future filtering logic
  managedCompetitors = [],
  selectedCompetitors = new Set(),
  metricType = 'share',
}: TopicsBarChartProps) => {
  // IMPORTANT:
  // Do NOT tie comparison mode to competitor-list loading.
  // Competitors are fetched separately and arrive later, which caused the chart to “reload”
  // (single bars -> grouped bars) even when topic data was cached.
  // Instead, base comparison mode on whether topic data actually has industry averages.
  
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

  const getMetricValue = (topic: Topic): number => {
    if (metricType === 'visibility') {
      return Math.max(0, Math.min(100, topic.currentVisibility ?? 0));
    }
    if (metricType === 'sentiment') {
      return Math.max(0, Math.min(100, topic.currentSentiment ?? 0));
    }
    return Math.max(0, Math.min(100, topic.currentSoA ?? (topic.soA * 20)));
  };

  const metricLabel =
    metricType === 'share' ? 'Share of Answer (SoA)' : metricType === 'visibility' ? 'Visibility Score' : 'Sentiment Score';
  const formatValue = (value: number) => (metricType === 'share' ? `${value.toFixed(1)}%` : value.toFixed(1));

  // Sort topics by SoA descending (largest to smallest) for left to right display
  // Convert SoA (0-5x scale) to percentage (0-100) for display
  const sortedTopics = useMemo(() => {
    return [...topics]
      .map(topic => ({
        ...topic,
        currentSoA: topic.currentSoA ?? (topic.soA * 20) // Convert 0-5x to 0-100%
      }))
      .sort((a, b) => getMetricValue(b) - getMetricValue(a));
  }, [topics, metricType]);

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
    if (metricType === 'share') {
      return sortedTopics.some(
        (topic) => topic.industryAvgSoA !== null && topic.industryAvgSoA !== undefined && topic.industryAvgSoA > 0
      );
    }
    if (metricType === 'visibility') {
      return sortedTopics.some((topic) => topic.industryAvgVisibility !== null && topic.industryAvgVisibility !== undefined);
    }
    return sortedTopics.some(
      (topic) =>
        topic.industryAvgSentiment !== null && topic.industryAvgSentiment !== undefined
    );
  }, [sortedTopics, metricType]);

  const showComparison = hasIndustryData;

  // Determine competitor label based on selection
  const competitorLabel = useMemo(() => {
    if (!managedCompetitors.length || !selectedCompetitors.size) {
      return metricType === 'share' ? 'Competitor SoA' : metricType === 'visibility' ? 'Competitor Visibility' : 'Competitor Sentiment';
    }
    
    // Check if all competitors are selected
    const isAllSelected = selectedCompetitors.size === managedCompetitors.length && 
      managedCompetitors.every(c => selectedCompetitors.has(c.name.toLowerCase()));
    
    if (isAllSelected || selectedCompetitors.size > 1) {
      // All competitors or multiple selected - show "Avg Competitor SOA"
      return metricType === 'share' ? 'Avg Competitor SoA' : metricType === 'visibility' ? 'Avg Competitor Visibility' : 'Avg Competitor Sentiment';
    } else {
      // Single competitor selected - show competitor name
      const selectedKey = Array.from(selectedCompetitors)[0];
      const selectedCompetitor = managedCompetitors.find(c => c.name.toLowerCase() === selectedKey);
      const competitorName = selectedCompetitor?.name || 'Competitor';
      return metricType === 'share' 
        ? `${competitorName} SoA` 
        : metricType === 'visibility' 
          ? `${competitorName} Visibility` 
          : `${competitorName} Sentiment`;
    }
  }, [managedCompetitors, selectedCompetitors, metricType]);

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
        value: getMetricValue(topic),
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
        data['brand'] = getMetricValue(topic);
        
        if (metricType === 'share') {
          data['avgIndustry'] =
            topic.industryAvgSoA !== null && topic.industryAvgSoA !== undefined && topic.industryAvgSoA > 0
              ? topic.industryAvgSoA * 20
              : 0;
        } else if (metricType === 'visibility') {
          data['avgIndustry'] = topic.industryAvgVisibility ?? 0;
        } else {
          data['avgIndustry'] = topic.industryAvgSentiment ?? 0;
        }
        
        return data;
      });
    }
  }, [sortedTopics, showComparison, hasIndustryData, metricType]);

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
            legend: metricLabel,
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
            legend: metricLabel,
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
                label = metricType === 'share' ? 'Brand SoA' : metricType === 'visibility' ? 'Brand Visibility' : 'Brand Sentiment';
                barColor = BRAND_COLOR; // Data viz 02 (blue) for brand
              } else if (key === 'avgIndustry') {
                label = competitorLabel;
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
                      {label}: {formatValue(value)}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '11px',
                    color: '#ffffff',
                    marginTop: '6px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  }}>
                    {metricLabel}: {formatValue(value)}
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
                      {topic.name}: {formatValue(value)}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '11px',
                    color: '#ffffff',
                    marginTop: '6px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                  }}>
                    {metricLabel}: {formatValue(value)}
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
              {metricType === 'share' ? 'Brand SoA' : metricType === 'visibility' ? 'Brand Visibility' : 'Brand Sentiment'}
            </span>
          </div>
          
          {/* Competitor metric - Bar */}
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
              {competitorLabel}
            </span>
          </div>
          
        </div>
      )}
    </div>
  );
};
