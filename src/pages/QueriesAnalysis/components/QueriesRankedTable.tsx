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

  const formatScore = (val: number | null | undefined) => {
      if (val === null || val === undefined) return '—';
      return val.toFixed(1);
  };
  
  const formatSoA = (val: number | null | undefined) => {
      if (val === null || val === undefined) return '—';
      return `${val.toFixed(1)}%`;
  };

  const SortButton = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => {
    const isActive = sortState.column === column;
    return (
      <button
        onClick={() => handleSort(column)}
        className={`relative flex items-center gap-2 text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide hover:text-[var(--accent500)] transition-colors ${
          isActive ? 'text-[var(--accent500)]' : ''
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
                  <td colSpan={5} className="px-3 sm:px-4 lg:px-5 py-12 text-center">
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
                        <span className="text-sm font-semibold whitespace-nowrap text-[var(--text-body)]">
                          {formatScore(query.visibilityScore)}
                        </span>
                    </td>
                     <td className="px-3 sm:px-4 lg:px-5 py-4">
                        <span className="text-sm font-semibold whitespace-nowrap text-[var(--text-body)]">
                          {formatSoA(query.soa)}
                        </span>
                    </td>
                     <td className="px-3 sm:px-4 lg:px-5 py-4">
                        <span className="text-sm font-semibold whitespace-nowrap text-[var(--text-body)]">
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
