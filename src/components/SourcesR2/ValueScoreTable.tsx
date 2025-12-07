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

const quadrantBadgeColor: Record<string, string> = {
  priority: '#06c686',
  reputation: '#f97373',
  growth: '#498cf9',
  monitor: '#cbd5e1'
};

export const ValueScoreTable = ({ sources }: ValueScoreTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('valueScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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
          <h3 style={{ margin: 0, fontSize: 16, color: '#1a1d29', fontWeight: 700 }}>Top Sources by Value Score</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Composite score combining visibility, SOA, sentiment, citations, topics</p>
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
                Value {sortIndicator('valueScore')}
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
                Zone {sortIndicator('quadrant')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedSources.map((s) => (
              <tr key={s.name} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: '10px 8px', color: '#475569' }}>{s.type}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>{s.valueScore.toFixed(1)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0f172a' }}>{s.mentionRate.toFixed(1)}%</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0f172a' }}>{s.soa.toFixed(1)}%</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: s.sentiment >= 0 ? '#047857' : '#b91c1c' }}>
                  {Math.round(s.sentiment * 100)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0f172a' }}>{s.citations}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 999,
                      backgroundColor: quadrantBadgeColor[s.quadrant] || '#e2e8f0',
                      color: s.quadrant === 'monitor' ? '#0f172a' : '#fff',
                      fontWeight: 700,
                      fontSize: 12
                    }}
                  >
                    {s.quadrant}
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

