import { useEffect, useMemo, useState } from 'react';
import { HelpButton } from '../common/HelpButton';
import { normalizeDomain } from '../../utils/citationAnalysisUtils';
import { EnhancedSource } from '../../types/citation-sources';

export type ValueScoreSource = Omit<EnhancedSource, 'quadrant'> & {
  quadrant: EnhancedSource['quadrant'] | string;
};

interface ValueScoreTableProps {
  sources: ValueScoreSource[];
  /**
   * Optional cap on visible rows (useful for compact widgets).
   * If omitted, all rows are rendered.
   */
  maxRows?: number;
  /**
   * Max height for the table viewport; enables vertical scrolling.
   */
  maxHeight?: number | string;
  /**
   * Optional selection UI for controlling the Impact Score Trends chart.
   */
  trendSelection?: {
    selectedNames: Set<string>;
    maxSelected: number;
    onToggle: (name: string) => void;
    onDeselectAll?: () => void;
  };
  /**
   * Optional source name to highlight (e.g., from deep link)
   */
  highlightedSourceName?: string | null;
  disableSorting?: boolean;
  pagination?: {
    pageSize: number;
  };
  onHelpClick?: (key: string) => void;
  /**
   * Used to calculate percentage of citations (Share of Voice).
   * If provided and > 0, the Citations column will show %.
   */
  totalCitations?: number;
}

type SortKey = 'name' | 'type' | 'valueScore' | 'mentionRate' | 'soa' | 'sentiment' | 'citations' | 'quadrant';

const zoneStyles: Record<
  string,
  { bg: string; text: string; label?: string }
> = {
  priority: { bg: '#06c686', text: '#fff', label: 'Priority Partnerships' },
  reputation: { bg: '#f97373', text: '#fff', label: 'Reputation Management' },
  growth: { bg: '#498cf9', text: '#fff', label: 'Growth Opportunities' },
  monitor: { bg: '#cbd5e1', text: '#0f172a', label: 'Monitor' }
};



export const ValueScoreTable = ({ sources, maxRows, maxHeight = '60vh', trendSelection, highlightedSourceName, disableSorting, pagination, onHelpClick, totalCitations }: ValueScoreTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('valueScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const pageSize = pagination?.pageSize ?? 0;
  const isPaging = !!pagination && pageSize > 0;

  const metricRanges = useMemo(() => {
    const getRange = (values: number[]) => {
      const valid = values.filter((v) => Number.isFinite(v));
      if (!valid.length) return { min: 0, max: 0 };
      return { min: Math.min(...valid), max: Math.max(...valid) };
    };

    const rangeBasis = (() => {
      if (!isPaging) return sources;
      const pageCount = Math.max(1, Math.ceil(sources.length / pageSize));
      const safePage = Math.min(Math.max(1, page), pageCount);
      return sources.slice((safePage - 1) * pageSize, safePage * pageSize);
    })();

    return {
      valueScore: getRange(rangeBasis.map((s) => s.valueScore)),
      mentionRate: getRange(rangeBasis.map((s) => s.mentionRate)),
      soa: getRange(rangeBasis.map((s) => s.soa)),
      sentiment: getRange(rangeBasis.map((s) => s.sentiment)),
      citations: getRange(rangeBasis.map((s) => s.citations))
    };
  }, [sources, isPaging, page, pageSize]);

  const heatmapStyle = (metric: keyof typeof metricRanges, value: number) => {
    const range = metricRanges[metric];
    if (!range) return { style: {} };
    const span = range.max - range.min;
    const hasRange = span > 0 && Number.isFinite(value);

    // If all values are equal (span 0) or the value is invalid, still show a soft low score tint.
    const ratio = hasRange ? Math.min(1, Math.max(0, (value - range.min) / span)) : 0.1;

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
        borderRadius: 8,
        boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
        transition: 'background-color 140ms ease, color 140ms ease'
      },
      textColor: '#0f172a'
    };
  };

  const toggleSort = (key: SortKey) => {
    if (disableSorting) return;
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // default direction: numbers descending, strings ascending
      setSortDir(key === 'name' || key === 'type' || key === 'quadrant' ? 'asc' : 'desc');
    }
  };

  const sortedSources = useMemo(() => {
    if (disableSorting) return sources;

    const list = [...sources];
    list.sort((a, b) => {
      // First, prioritize selected sources (if trendSelection is active)
      if (trendSelection) {
        const aSelected = trendSelection.selectedNames.has(a.name);
        const bSelected = trendSelection.selectedNames.has(b.name);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        // Both selected or both unselected - continue with normal sort
      }

      // Normal sort logic
      const dir = sortDir === 'asc' ? 1 : -1;
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (typeof aVal === 'string' || typeof bVal === 'string') {
        return String(aVal).localeCompare(String(bVal)) * dir;
      }
      return (Number(aVal) - Number(bVal)) * dir;
    });
    return list;
  }, [sources, sortKey, sortDir, trendSelection, disableSorting]);

  const sortIndicator = (key: SortKey) => {
    if (disableSorting) return '';
    return sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '';
  };

  const displayedSources = useMemo(() => {
    if (isPaging) {
      const count = sortedSources.length;
      const pageCount = Math.max(1, Math.ceil(count / pageSize));
      const safePage = Math.min(Math.max(1, page), pageCount);
      return sortedSources.slice((safePage - 1) * pageSize, safePage * pageSize);
    }
    if (!maxRows || maxRows <= 0) return sortedSources;
    return sortedSources.slice(0, maxRows);
  }, [sortedSources, maxRows, isPaging, page, pageSize]);

  useEffect(() => {
    if (!isPaging) return;
    const pageCount = Math.max(1, Math.ceil(sortedSources.length / pageSize));
    if (page > pageCount) setPage(pageCount);
  }, [isPaging, page, pageSize, sortedSources.length]);

  const headerCellBase: React.CSSProperties = {
    padding: '10px 8px',
    fontWeight: 700,
    cursor: disableSorting ? 'default' : 'pointer',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#f8fafc',
    color: '#475569',
    boxShadow: 'inset 0 -1px 0 #e5e7eb'
  };

  const selectedCount = trendSelection ? trendSelection.selectedNames.size : 0;
  const totalCount = sortedSources.length;
  const pageCount = isPaging ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  const safePage = isPaging ? Math.min(Math.max(1, page), pageCount) : 1;

  // Helper to generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2; // Number of pages to show around current page

    for (let i = 1; i <= pageCount; i++) {
      if (
        i === 1 || // Always show first
        i === pageCount || // Always show last
        (i >= safePage - delta && i <= safePage + delta) // Show around current
      ) {
        pages.push(i);
      } else if (
        (i === safePage - delta - 1 && i > 1) ||
        (i === safePage + delta + 1 && i < pageCount)
      ) {
        pages.push('...');
      }
    }
    return pages;
  };

  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalCount);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, height: '100%', boxShadow: '0 10px 25px rgba(15,23,42,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#1a1d29', fontWeight: 700 }}>Top Sources</h3>
            {onHelpClick && (
              <HelpButton
                onClick={(e) => {
                  e?.stopPropagation();
                  onHelpClick('table-feature-guide');
                }}
                label="Table Feature Guide"
                size={14}
              />
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Composite score based on Visibility, SOA, Sentiment, Citations and Topics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {trendSelection && (
            <>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                Trends: {selectedCount}/{trendSelection.maxSelected}
              </span>
              {selectedCount > 0 && trendSelection.onDeselectAll && (
                <button
                  onClick={trendSelection.onDeselectAll}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    color: '#64748b',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 160ms ease, border-color 160ms ease',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  Deselect All
                </button>
              )}
            </>
          )}
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Heatmap</span>
          <div
            aria-hidden
            style={{
              height: 8,
              width: 84,
              borderRadius: 999,
              background:
                'linear-gradient(90deg, hsl(8 78% 92%) 0%, hsl(45 90% 88%) 50%, hsl(120 55% 82%) 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)'
            }}
          />
        </div>
      </div>
      {isPaging && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            Showing <span style={{ color: '#0f172a', fontWeight: 700 }}>{startItem}-{endItem}</span> of <span style={{ color: '#0f172a', fontWeight: 700 }}>{totalCount}</span> sources
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setPage(1)}
              disabled={safePage <= 1}
              title="First Page"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: safePage <= 1 ? '#f8fafc' : '#fff',
                color: safePage <= 1 ? '#cbd5e1' : '#64748b',
                fontSize: 14,
                fontWeight: 700,
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{
                padding: '0 10px',
                height: 32,
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: safePage <= 1 ? '#f8fafc' : '#fff',
                color: safePage <= 1 ? '#cbd5e1' : '#64748b',
                fontSize: 12,
                fontWeight: 700,
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Prev
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px' }}>
              {getPageNumbers().map((p, i) => (
                <button
                  key={i}
                  onClick={() => typeof p === 'number' && setPage(p)}
                  disabled={typeof p !== 'number'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 32,
                    height: 32,
                    padding: '0 6px',
                    borderRadius: 6,
                    border: p === safePage ? '1px solid #0f172a' : '1px solid #e5e7eb',
                    background: p === safePage ? '#0f172a' : (typeof p !== 'number' ? 'transparent' : '#fff'),
                    color: p === safePage ? '#fff' : (typeof p !== 'number' ? '#94a3b8' : '#64748b'),
                    fontSize: 12,
                    fontWeight: p === safePage ? 700 : 600,
                    cursor: typeof p !== 'number' ? 'default' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              style={{
                padding: '0 10px',
                height: 32,
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: safePage >= pageCount ? '#f8fafc' : '#fff',
                color: safePage >= pageCount ? '#cbd5e1' : '#64748b',
                fontSize: 12,
                fontWeight: 700,
                cursor: safePage >= pageCount ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Next
            </button>
            <button
              onClick={() => setPage(pageCount)}
              disabled={safePage >= pageCount}
              title="Last Page"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: safePage >= pageCount ? '#f8fafc' : '#fff',
                color: safePage >= pageCount ? '#cbd5e1' : '#64748b',
                fontSize: 14,
                fontWeight: 700,
                cursor: safePage >= pageCount ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              »
            </button>
          </div>
        </div>
      )}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {trendSelection && (
                <th
                  style={{
                    ...headerCellBase,
                    textAlign: 'center',
                    width: 44,
                    cursor: 'default'
                  }}
                >
                  {/* Checkbox column */}
                </th>
              )}
              <th style={{ ...headerCellBase, textAlign: 'left' }} onClick={() => toggleSort('name')}>
                Source {sortIndicator('name')}
              </th>
              <th style={{ ...headerCellBase, textAlign: 'left' }} onClick={() => toggleSort('type')}>
                Type {sortIndicator('type')}
              </th>
              <th style={{ ...headerCellBase, textAlign: 'right' }} onClick={() => toggleSort('valueScore')}>
                <div className="flex items-center justify-end gap-1">
                  Impact Score {sortIndicator('valueScore')}
                  {onHelpClick && (
                    <HelpButton
                      onClick={(e) => {
                        e?.stopPropagation();
                        onHelpClick('metric-impact-score');
                      }}
                      className="opacity-50 hover:opacity-100"
                      size={12}
                    />
                  )}
                </div>
              </th>
              <th style={{ ...headerCellBase, textAlign: 'right' }} onClick={() => toggleSort('mentionRate')}>
                <div className="flex items-center justify-end gap-1">
                  Mention % {sortIndicator('mentionRate')}
                  {onHelpClick && (
                    <HelpButton
                      onClick={(e) => {
                        e?.stopPropagation();
                        onHelpClick('metric-mention');
                      }}
                      className="opacity-50 hover:opacity-100"
                      size={12}
                    />
                  )}
                </div>
              </th>
              <th style={{ ...headerCellBase, textAlign: 'right' }} onClick={() => toggleSort('soa')}>
                <div className="flex items-center justify-end gap-1">
                  SOA % {sortIndicator('soa')}
                  {onHelpClick && (
                    <HelpButton
                      onClick={(e) => {
                        e?.stopPropagation();
                        onHelpClick('metric-soa');
                      }}
                      className="opacity-50 hover:opacity-100"
                      size={12}
                    />
                  )}
                </div>
              </th>
              <th style={{ ...headerCellBase, textAlign: 'right' }} onClick={() => toggleSort('sentiment')}>
                <div className="flex items-center justify-end gap-1">
                  Sentiment {sortIndicator('sentiment')}
                  {onHelpClick && (
                    <HelpButton
                      onClick={(e) => {
                        e?.stopPropagation();
                        onHelpClick('metric-sentiment');
                      }}
                      className="opacity-50 hover:opacity-100"
                      size={12}
                    />
                  )}
                </div>
              </th>
              <th style={{ ...headerCellBase, textAlign: 'right' }} onClick={() => toggleSort('citations')}>
                <div className="flex items-center justify-end gap-1">
                  {totalCitations && totalCitations > 0 ? 'Citations %' : 'Citations'} {sortIndicator('citations')}
                  {onHelpClick && (
                    <HelpButton
                      onClick={(e) => {
                        e?.stopPropagation();
                        onHelpClick('metric-citations');
                      }}
                      className="opacity-50 hover:opacity-100"
                      size={12}
                    />
                  )}
                </div>
              </th>
              <th style={{ ...headerCellBase, textAlign: 'center' }} onClick={() => toggleSort('quadrant')}>
                Category {sortIndicator('quadrant')}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedSources.map((s) => {
              const isHighlighted = highlightedSourceName && (
                normalizeDomain(s.name) === normalizeDomain(highlightedSourceName) ||
                s.name.toLowerCase().includes(highlightedSourceName.toLowerCase()) ||
                highlightedSourceName.toLowerCase().includes(s.name.toLowerCase())
              );

              return (
                <tr
                  key={s.name}
                  style={{
                    borderTop: '1px solid #e5e7eb',
                    backgroundColor: isHighlighted ? '#fef3c7' : undefined,
                    borderLeft: isHighlighted ? '4px solid #f59e0b' : undefined,
                    transition: 'background-color 0.3s ease, border-left 0.3s ease'
                  }}
                >
                  {trendSelection && (() => {
                    const isChecked = trendSelection.selectedNames.has(s.name);
                    const isAtLimit = !isChecked && trendSelection.selectedNames.size >= trendSelection.maxSelected;
                    return (
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isAtLimit}
                          onChange={() => trendSelection.onToggle(s.name)}
                          aria-label={`Toggle ${s.name} in Impact Score Trends`}
                          style={{ cursor: isAtLimit ? 'not-allowed' : 'pointer' }}
                        />
                      </td>
                    );
                  })()}
                  <td style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: '10px 8px', color: '#475569' }}>{s.type}</td>
                  {(() => {
                    const { style, textColor } = heatmapStyle('valueScore', s.valueScore);
                    return (
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          color: textColor || '#0f172a',
                          fontWeight: 700,
                          ...style
                        }}
                      >
                        {s.valueScore.toFixed(1)}
                      </td>
                    );
                  })()}
                  {(() => {
                    const { style, textColor } = heatmapStyle('mentionRate', s.mentionRate);
                    return (
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          color: textColor || '#0f172a',
                          ...style
                        }}
                      >
                        {s.mentionRate.toFixed(1)}%
                      </td>
                    );
                  })()}
                  {(() => {
                    const { style, textColor } = heatmapStyle('soa', s.soa);
                    return (
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          color: textColor || '#0f172a',
                          ...style
                        }}
                      >
                        {s.soa.toFixed(1)}%
                      </td>
                    );
                  })()}
                  {(() => {
                    const { style, textColor } = heatmapStyle('sentiment', s.sentiment);
                    return (
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          color: textColor || '#0f172a',
                          ...style
                        }}
                      >
                        {Math.round(s.sentiment)}
                      </td>
                    );
                  })()}
                  {(() => {
                    const { style, textColor } = heatmapStyle('citations', s.citations);
                    return (
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          color: textColor || '#0f172a',
                          ...style
                        }}
                      >
                        {totalCitations && totalCitations > 0
                          ? `${((s.citations / totalCitations) * 100).toFixed(1)}%`
                          : s.citations}
                      </td>
                    );
                  })()}
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 999,
                        backgroundColor: zoneStyles[s.quadrant]?.bg || '#e2e8f0',
                        color: zoneStyles[s.quadrant]?.text || '#0f172a',
                        fontWeight: 700,
                        fontSize: 12
                      }}
                    >
                      {zoneStyles[s.quadrant]?.label || s.quadrant}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
