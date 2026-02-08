import { useEffect, useMemo, useState } from 'react';
import { HelpButton } from '../common/HelpButton';
import { normalizeDomain } from '../../utils/citationAnalysisUtils';
import { EnhancedSource } from '../../types/citation-sources';

export type ValueScoreSource = Omit<EnhancedSource, 'quadrant'> & {
  quadrant: EnhancedSource['quadrant'] | string;
};

interface ValueScoreTableProps {
  sources: ValueScoreSource[];

  maxRows?: number;

  maxHeight?: number | string;

  trendSelection?: {
    selectedNames: Set<string>;
    maxSelected: number;
    onToggle: (name: string) => void;
    onDeselectAll?: () => void;
    onSelectMultiple?: (names: string[]) => void;
  };

  highlightedSourceName?: string | null;
  disableSorting?: boolean;
  pagination?: {
    pageSize: number;
  };
  onHelpClick?: (key: string) => void;

  totalCitations?: number;
}

type SortKey = 'name' | 'type' | 'valueScore' | 'mentionRate' | 'soa' | 'sentiment' | 'citations' | 'quadrant';

const zoneStyles: Record<
  string,
  { bg: string; text: string; label?: string }
> = {
  priority: { bg: '#dcfce7', text: '#166534', label: 'Priority Partnerships' }, // green-100 text-green-800
  reputation: { bg: '#fee2e2', text: '#991b1b', label: 'Reputation Management' }, // red-100 text-red-800
  growth: { bg: '#dbeafe', text: '#1e40af', label: 'Growth Opportunities' }, // blue-100 text-blue-800
  monitor: { bg: '#f1f5f9', text: '#475569', label: 'Monitor' } // slate-100 text-slate-600
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

    // Determine color based on score (Red -> Yellow -> Green)
    let color = '#334155'; // default slate-700
    if (metric === 'valueScore') {
      // Value score gets special treatment - bold and colored
      if (ratio > 0.8) color = '#15803d'; // green-700
      else if (ratio > 0.4) color = '#b45309'; // amber-700
      else color = '#b91c1c'; // red-700
    }

    return {
      style: {
        background: 'transparent',
        transition: 'color 140ms ease'
      },
      textColor: color
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
    padding: '12px 16px',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    cursor: disableSorting ? 'default' : 'pointer',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#f8fafc',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0',
    transition: 'background 200ms ease'
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
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, height: '100%', boxShadow: '0 8px 18px rgba(15,23,42,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 800 }}>Top Sources</h3>
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
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>Composite score based on Visibility, SOA, Sentiment, Citations and Topics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {trendSelection && (
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
              Trends: {selectedCount}/{trendSelection.maxSelected}
            </span>
          )}

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
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    const { selectedNames, maxSelected, onDeselectAll, onSelectMultiple } = trendSelection;
                    const isSelected = selectedNames.size > 0;

                    if (isSelected && onDeselectAll) {
                      onDeselectAll();
                    } else if (!isSelected && onSelectMultiple) {
                      // Select top 10 (or maxallowed) from sorted sources
                      const candidates = sortedSources.slice(0, maxSelected).map(s => s.name);
                      onSelectMultiple(candidates);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={trendSelection.selectedNames.size === trendSelection.maxSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = trendSelection.selectedNames.size > 0 && trendSelection.selectedNames.size < trendSelection.maxSelected;
                      }
                    }}
                    onChange={() => {
                      // Handling via parent th click for larger touch target
                    }}
                    style={{ cursor: 'pointer' }}
                    aria-label={trendSelection.selectedNames.size > 0 ? "Deselect all rows" : "Select top 10 rows"}
                  />
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
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: isHighlighted ? '#fef3c7' : undefined,
                    borderLeft: isHighlighted ? '4px solid #f59e0b' : '4px solid transparent',
                    transition: 'all 0.2s ease'
                  }}
                  className="hover:bg-slate-50 transition-colors"
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
                  <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: 600, fontSize: 13 }}>{s.name}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>{s.type}</td>
                  {(() => {
                    const { style, textColor } = heatmapStyle('valueScore', s.valueScore);
                    return (
                      <td
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          color: textColor || '#0f172a',
                          fontWeight: 700,
                          fontFeatureSettings: '"tnum"',
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
                          padding: '12px 16px',
                          textAlign: 'right',
                          color: textColor || '#475569',
                          fontFeatureSettings: '"tnum"',
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
                          padding: '12px 16px',
                          textAlign: 'right',
                          color: textColor || '#475569',
                          fontFeatureSettings: '"tnum"',
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
                          padding: '12px 16px',
                          textAlign: 'right',
                          color: textColor || '#475569',
                          fontFeatureSettings: '"tnum"',
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
                          padding: '12px 16px',
                          textAlign: 'right',
                          color: textColor || '#475569',
                          fontFeatureSettings: '"tnum"',
                          ...style
                        }}
                      >
                        {totalCitations && totalCitations > 0
                          ? `${((s.citations / totalCitations) * 100).toFixed(1)}%`
                          : s.citations}
                      </td>
                    );
                  })()}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 999,
                        backgroundColor: zoneStyles[s.quadrant]?.bg || '#e2e8f0',
                        color: zoneStyles[s.quadrant]?.text || '#0f172a',
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
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
