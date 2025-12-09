import { useMemo, useState } from 'react';

export interface ValueScoreSource {
  name: string;
  type: string;
  mentionRate: number;
  soa: number;
  sentiment: number;
  citations: number;
  valueScore: number;
  quadrant: string;
}

interface ValueScoreTableProps {
  sources: ValueScoreSource[];
}

type SortKey = 'name' | 'type' | 'valueScore' | 'mentionRate' | 'soa' | 'sentiment' | 'citations' | 'quadrant';

const zoneStyles: Record<
  string,
  { bg: string; text: string; label?: string }
> = {
  // Legacy quadrants
  priority: { bg: '#06c686', text: '#fff', label: 'Priority Partnerships' },
  reputation: { bg: '#f97373', text: '#fff', label: 'Reputation Management' },
  growth: { bg: '#498cf9', text: '#fff', label: 'Growth Opportunities' },
  monitor: { bg: '#cbd5e1', text: '#0f172a', label: 'Monitor' },
  // New zone view
  marketLeaders: { bg: '#0ea5e9', text: '#fff', label: 'Market Leaders' },
  reputationRisks: { bg: '#f97373', text: '#fff', label: 'Reputation Risks' },
  growthBets: { bg: '#6366f1', text: '#fff', label: 'Growth Bets' },
  monitorImprove: { bg: '#cbd5e1', text: '#0f172a', label: 'Monitor & Improve' }
};

export const ValueScoreTable = ({ sources }: ValueScoreTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('valueScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const metricRanges = useMemo(() => {
    const getRange = (values: number[]) => {
      const valid = values.filter((v) => Number.isFinite(v));
      if (!valid.length) return { min: 0, max: 0 };
      return { min: Math.min(...valid), max: Math.max(...valid) };
    };

    return {
      valueScore: getRange(sources.map((s) => s.valueScore)),
      mentionRate: getRange(sources.map((s) => s.mentionRate)),
      soa: getRange(sources.map((s) => s.soa)),
      sentiment: getRange(sources.map((s) => s.sentiment * 100)),
      citations: getRange(sources.map((s) => s.citations))
    };
  }, [sources]);

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
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // default direction: numbers descending, strings ascending
      setSortDir(key === 'name' || key === 'type' || key === 'quadrant' ? 'asc' : 'desc');
    }
  };

  const sortedSources = useMemo(() => {
    const list = [...sources];
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (typeof aVal === 'string' || typeof bVal === 'string') {
        return String(aVal).localeCompare(String(bVal)) * dir;
      }
      return (Number(aVal) - Number(bVal)) * dir;
    });
    return list.slice(0, 12);
  }, [sources, sortKey, sortDir]);

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '');

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, height: '100%', boxShadow: '0 10px 25px rgba(15,23,42,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: '#1a1d29', fontWeight: 700 }}>Top Sources</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Composite score based on Visibility, SOA, Sentiment, Citations and Topics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', color: '#475569' }}>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                Source {sortIndicator('name')}
              </th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, cursor: 'pointer' }} onClick={() => toggleSort('type')}>
                Type {sortIndicator('type')}
              </th>
              <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, cursor: 'pointer' }} onClick={() => toggleSort('valueScore')}>
                Impact Score {sortIndicator('valueScore')}
              </th>
              <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, cursor: 'pointer' }} onClick={() => toggleSort('mentionRate')}>
                Mention % {sortIndicator('mentionRate')}
              </th>
              <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, cursor: 'pointer' }} onClick={() => toggleSort('soa')}>
                SOA % {sortIndicator('soa')}
              </th>
              <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, cursor: 'pointer' }} onClick={() => toggleSort('sentiment')}>
                Sentiment {sortIndicator('sentiment')}
              </th>
              <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, cursor: 'pointer' }} onClick={() => toggleSort('citations')}>
                Citations {sortIndicator('citations')}
              </th>
              <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, cursor: 'pointer' }} onClick={() => toggleSort('quadrant')}>
                Category {sortIndicator('quadrant')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedSources.map((s) => (
              <tr key={s.name} style={{ borderTop: '1px solid #e5e7eb' }}>
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
                  const { style, textColor } = heatmapStyle('sentiment', s.sentiment * 100);
                  const sentimentColor = s.sentiment >= 0 ? '#047857' : '#b91c1c';
                  return (
                <td
                  style={{
                    padding: '10px 8px',
                    textAlign: 'right',
                    color: textColor || sentimentColor,
                    ...style
                  }}
                >
                  {Math.round(s.sentiment * 100)}
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
                  {s.citations}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

