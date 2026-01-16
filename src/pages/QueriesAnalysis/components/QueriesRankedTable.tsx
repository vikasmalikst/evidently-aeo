import { useState, useMemo, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { Query, SortColumn, SortState } from '../types';

interface QueriesRankedTableProps {
  queries: Query[];
  onRowClick?: (query: Query) => void;
  selectedQueries?: Set<string>;
  onSelectedQueriesChange?: (selectedQueries: Set<string>) => void;
  metricType?: 'visibility' | 'sentiment';
}

export const QueriesRankedTable = ({
  queries,
  onRowClick,

  selectedQueries: externalSelectedQueries,
  onSelectedQueriesChange,
}: QueriesRankedTableProps) => {

  const [sortState, setSortState] = useState<SortState>({ column: 'visibility', direction: 'desc' });

  // Use external selectedQueries if provided, otherwise use internal state
  const [internalSelectedQueries, setInternalSelectedQueries] = useState<Set<string>>(() => {
    // Default: all queries selected
    return new Set(queries.map(q => q.id));
  });

  const selectedQueries = externalSelectedQueries ?? internalSelectedQueries;

  const handleQueryToggle = (queryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectedQueriesChange) {
      const newSet = new Set(selectedQueries);
      if (newSet.has(queryId)) {
        newSet.delete(queryId);
      } else {
        newSet.add(queryId);
      }
      onSelectedQueriesChange(newSet);
    } else {
      setInternalSelectedQueries((prev: Set<string>) => {
        const newSet = new Set(prev);
        if (newSet.has(queryId)) {
          newSet.delete(queryId);
        } else {
          newSet.add(queryId);
        }
        return newSet;
      });
    }
  };

  // Handle sort
  const handleSort = useCallback((column: SortColumn) => {
    setSortState((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Filter and sort queries
  const filteredAndSortedQueries = useMemo(() => {
    let filtered = [...queries];

    // Sort
    filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortState.column) {

        case 'text':
          aVal = a.text.toLowerCase();
          bVal = b.text.toLowerCase();
          break;
        case 'topic':
          aVal = a.topic.toLowerCase();
          bVal = b.topic.toLowerCase();
          break;
        case 'visibility':
          aVal = a.visibilityScore ?? 0;
          bVal = b.visibilityScore ?? 0;
          break;
        case 'sentiment':
          aVal = a.sentimentScore ?? 0;
          bVal = b.sentimentScore ?? 0;
          break;
        case 'brandPresence':
          aVal = a.brandPresence ?? 0;
          bVal = b.brandPresence ?? 0;
          break;
        case 'soa':
          aVal = a.soa ?? 0;
          bVal = b.soa ?? 0;
          break;
        case 'trend':
          aVal = a.trend.delta;
          bVal = b.trend.delta;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortState.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortState.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [queries, sortState]);

  // Heatmap Logic
  const metricRanges = useMemo(() => {
    const getRange = (values: (number | null)[]) => {
      const valid = values.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
      if (!valid.length) return { min: 0, max: 0 };
      return { min: Math.min(...valid), max: Math.max(...valid) };
    };

    return {
      visibility: getRange(queries.map(q => q.visibilityScore)),
      brandPresence: getRange(queries.map(q => q.brandPresence)),
      soa: getRange(queries.map(q => q.soa)),
      sentiment: getRange(queries.map(q => q.sentimentScore))
    };
  }, [queries]);

  const heatmapStyle = (metric: keyof typeof metricRanges, value: number | null | undefined) => {
    if (value === null || value === undefined) return { style: {} };

    const range = metricRanges[metric];
    const span = range.max - range.min;
    // If span is 0 (all values same), treat as middle/high based on value? 
    // Or just default to a neutral color. Let's use 0.5 ratio if span is 0.
    const ratio = span > 0 ? Math.min(1, Math.max(0, (value - range.min) / span)) : (value > 0 ? 1 : 0);

    // Smooth gradient: low = soft red, mid = warm yellow, high = gentle green
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const colorHsl = (() => {
      if (ratio < 0.5) {
        const t = ratio * 2;
        const h = lerp(8, 45, t); // red -> yellow hue
        const s = lerp(78, 90, t);
        const l = lerp(92, 88, t);
        return `hsl(${h} ${s}% ${l}%)`;
      }
      const t = (ratio - 0.5) * 2;
      const h = lerp(45, 120, t); // yellow -> green hue
      const s = lerp(90, 55, t);
      const l = lerp(88, 82, t);
      return `hsl(${h} ${s}% ${l}%)`;
    })();

    return {
      style: {
        backgroundColor: colorHsl,
        borderRadius: 6, // Slightly smaller radius for table cells
        padding: '4px 8px', // Add some internal padding for pill look
        boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
        width: 'fit-content',
        minWidth: '60px',
        textAlign: 'center' as const,
        display: 'inline-block'
      },
      textColor: '#0f172a'
    };
  };

  const formatScore = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return val.toFixed(1);
  };

  const formatPercentage = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return `${val.toFixed(1)}%`;
  };

  const SortButton = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => {
    const isActive = sortState.column === column;
    return (
      <button
        onClick={() => handleSort(column)}
        className={`relative flex items-center gap-2 text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide hover:text-[var(--accent500)] transition-colors ${isActive ? 'text-[var(--accent500)]' : ''
          }`}
        aria-label={`Sort by ${column} ${isActive ? sortState.direction : 'ascending'}`}
      >
        {children}
        {isActive && (
          <span className="text-[var(--accent500)]">
            {sortState.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
        {isActive && (
          <span
            className="absolute bottom-[-12px] left-0 right-0 h-0.5 bg-[var(--accent500)]"
          ></span>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white border border-[var(--primary200)] rounded-lg overflow-hidden shadow-sm">
      {/* Table View */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-[var(--border-default)] bg-[var(--bg-secondary)]">

              {/* Query */}
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[200px]">
                <SortButton column="text">Query</SortButton>
              </th>

              {/* Topic */}
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[150px]">
                <SortButton column="topic">Topic</SortButton>
              </th>

              {/* Visibility */}
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[120px]">
                <SortButton column="visibility">Visibility</SortButton>
              </th>

              {/* Brand Presence (New) */}
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[120px]">
                <SortButton column="brandPresence">Brand Pres.</SortButton>
              </th>

              {/* SoA */}
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[120px]">
                <SortButton column="soa">SoA</SortButton>
              </th>

              {/* Sentiment */}
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[120px]">
                <SortButton column="sentiment">Sentiment</SortButton>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {filteredAndSortedQueries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 sm:px-4 lg:px-5 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-headings)]">
                      No queries found for selected filters
                    </p>
                    <p className="text-xs text-[var(--text-caption)]">
                      Try adjusting your filters to see more results
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedQueries.map((query) => {
                const visibilityStyle = heatmapStyle('visibility', query.visibilityScore);
                const brandPresenceStyle = heatmapStyle('brandPresence', query.brandPresence);
                const soaStyle = heatmapStyle('soa', query.soa);
                const sentimentStyle = heatmapStyle('sentiment', query.sentimentScore);

                return (
                  <tr
                    key={query.id}
                    onClick={() => onRowClick?.(query)}
                    className="transition-colors cursor-pointer hover:bg-[var(--bg-secondary)]/50"
                    role="button"
                    tabIndex={0}
                  >
                    <td className="px-3 sm:px-4 lg:px-5 py-4">
                      <span className="text-sm font-medium text-[var(--text-headings)] break-words">{query.text}</span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-5 py-4">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-[var(--bg-secondary)] text-[var(--text-caption)] whitespace-nowrap">
                        {query.topic}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-5 py-4">
                      <span
                        className="text-sm font-semibold whitespace-nowrap"
                        style={{
                          color: visibilityStyle.textColor,
                          ...visibilityStyle.style
                        }}
                      >
                        {formatScore(query.visibilityScore)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-5 py-4">
                      <span
                        className="text-sm font-semibold whitespace-nowrap"
                        style={{
                          color: brandPresenceStyle.textColor,
                          ...brandPresenceStyle.style
                        }}
                      >
                        {formatPercentage(query.brandPresence)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-5 py-4">
                      <span
                        className="text-sm font-semibold whitespace-nowrap"
                        style={{
                          color: soaStyle.textColor,
                          ...soaStyle.style
                        }}
                      >
                        {formatPercentage(query.soa)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-5 py-4">
                      <span
                        className="text-sm font-semibold whitespace-nowrap"
                        style={{
                          color: sentimentStyle.textColor,
                          ...sentimentStyle.style
                        }}
                      >
                        {formatScore(query.sentimentScore)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
