interface SummaryCardsProps {
  counts: {
    priority: number;
    reputation: number;
    growth: number;
    monitor: number;
  };
}

const cardMeta = {
  priority: { label: 'Priority Partnerships', color: '#06c686' },
  reputation: { label: 'Reputation Management', color: '#f97373' },
  growth: { label: 'Growth Opportunities', color: '#498cf9' },
  monitor: { label: 'Monitor', color: '#cbd5e1' }
};

export const SummaryCards = ({ counts }: SummaryCardsProps) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
      {Object.entries(cardMeta).map(([key, meta]) => (
        <div
          key={key}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '12px 14px',
            background: '#fff',
            boxShadow: '0 8px 18px rgba(15,23,42,0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color }} />
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 700 }}>{meta.label}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{counts[key as keyof typeof counts] ?? 0}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>sources</div>
        </div>
      ))}
    </div>
  );
};

