import { useState, useMemo, useCallback } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { Download } from 'lucide-react';
import type { Query } from '../types';

export type QueriesMetricType = 'visibility' | 'sentiment';

interface QueryAnalysisMultiViewProps {
  queries: Query[];
  isLoading?: boolean;
  onQueryClick?: (query: Query) => void;
  metricType?: QueriesMetricType;
  onExport?: () => void;
}

const BOTTOM_AXIS_CHAR_LIMIT = 18;
const BOTTOM_AXIS_LINE_HEIGHT = 13;
const LEFT_AXIS_CHAR_LIMIT = 25;
const LEFT_AXIS_LINE_HEIGHT = 14;

// Helper function to wrap text (simplified from topics utils)
const wrapLabelText = (text: string, maxChars: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if ((currentLine + ' ' + word).length <= maxChars) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
};


export const QueryAnalysisMultiView = ({
  queries,
  isLoading = false,
  onQueryClick,
  metricType = 'visibility',
  onExport,
}: QueryAnalysisMultiViewProps) => {

  const getMetricValue = useCallback((query: Query): number => {
    if (metricType === 'visibility') {
      return Math.max(0, Math.min(100, query.visibilityScore ?? 0));
    }
    // sentiment
    return Math.max(0, Math.min(100, query.sentimentScore ?? 0));
  }, [metricType]);

  // Sort queries by metric value
  const preparedQueries = useMemo(() => {
    return [...queries]
      .sort((a, b) => getMetricValue(b) - getMetricValue(a))
      .slice(0, 50); // Limit to top 50 for performance if many are selected
  }, [queries, getMetricValue]);

  // Map for click handling
  const queryMap = useMemo(() => {
    const map = new Map<string, Query>();
    preparedQueries.forEach(q => map.set(q.text, q));
    return map;
  }, [preparedQueries]);

  const chartData = useMemo(() => {
      return preparedQueries.map(q => ({
          query: q.text,
          value: getMetricValue(q),
      }));
  }, [preparedQueries, getMetricValue]);

  const metricLabel = metricType === 'visibility' ? 'Visibility Score' : 'Sentiment Score';
  const BRAND_COLOR = '#498cf9';

  const maxBottomLabelLines = useMemo(() => {
    if (!preparedQueries.length) return 1;
    return preparedQueries.reduce((max, q) => {
      const lines = wrapLabelText(q.text, BOTTOM_AXIS_CHAR_LIMIT);
      return Math.max(max, lines.length);
    }, 1);
  }, [preparedQueries]);

  const axisBottomMargin = useMemo(() => {
      return 70 + Math.max(0, (maxBottomLabelLines - 1) * BOTTOM_AXIS_LINE_HEIGHT);
  }, [maxBottomLabelLines]);

  const chartHeight = useMemo(() => {
      return Math.min(Math.max(400, preparedQueries.length * 50 + 100), 1200);
  }, [preparedQueries.length]);

  if (isLoading) {
    return (
      <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6 flex items-center justify-center h-[400px]">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]"></div>
      </div>
    );
  }
  
  if (preparedQueries.length === 0) {
      return (
        <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6 flex items-center justify-center h-[400px]">
            <p className="text-[var(--text-caption)]">No queries selected to visualize</p>
        </div>
      );
  }

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm">
      <div className="p-4 border-b border-[var(--border-default)] flex justify-between items-center">
          <h3 className="text-sm font-semibold text-[var(--text-headings)]">{metricLabel} Overview</h3>
          {onExport && (
            <button onClick={onExport} className="text-[var(--text-caption)] hover:text-[var(--text-headings)]">
                <Download size={18} />
            </button>
          )}
      </div>

      <div className="p-4 relative" style={{ height: chartHeight }}>
        <ResponsiveBar
            data={chartData}
            keys={['value']}
            indexBy="query"
            layout="vertical"
            margin={{ top: 10, right: 30, bottom: axisBottomMargin, left: 160 }}
            padding={0.4}
            valueScale={{ type: 'linear', min: 0, max: 100 }}
            colors={[BRAND_COLOR]}
            axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Query',
                legendPosition: 'middle',
                legendOffset: axisBottomMargin - 20,
                 renderTick: (tick: any) => {
                  const val = String(tick.value);
                  const lines = wrapLabelText(val, BOTTOM_AXIS_CHAR_LIMIT);
                  // Only show first 1-2 words if too long or just skip rendering some ticks if too crowded?
                  // For now render all but maybe overlapping.
                  return (
                    <g transform={`translate(${tick.x},${tick.y})`}>
                       <text
                          transform={`translate(0, 10)`}
                          textAnchor="middle"
                          style={{ fontSize: 10, fill: '#333' }}
                       >
                           {lines.slice(0, 2).map((l, i) => <tspan x="0" dy={i===0 ? 0 : 12} key={i}>{l}</tspan>)}
                           {lines.length > 2 && <tspan x="0" dy={12}>...</tspan>}
                       </text>
                    </g>
                  );
                }
            }}
            axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: metricLabel,
                legendPosition: 'middle',
                legendOffset: -120,
                renderTick: (tick: any) => {
                    const val = String(tick.value);
                    const lines = wrapLabelText(val, LEFT_AXIS_CHAR_LIMIT);
                    return (
                        <g transform={`translate(${tick.x},${tick.y})`}>
                            <text
                                transform={`translate(-10, 5)`}
                                textAnchor="end"
                                style={{ fontSize: 11, fill: '#333' }}
                            >
                                {lines[0]}{lines.length > 1 ? '...' : ''}
                            </text>
                        </g>
                    )
                }
            }}
            tooltip={(props) => {
                return (
                    <div className="bg-white p-2 border border-gray-200 shadow-md rounded text-xs">
                        <strong>{props.indexValue}</strong><br/>
                        {metricLabel}: {props.value}
                    </div>
                )
            }}
            onClick={(data) => {
                const query = queryMap.get(data.indexValue as string);
                if (query && onQueryClick) onQueryClick(query);
            }}
        />
      </div>
    </div>
  );
};
