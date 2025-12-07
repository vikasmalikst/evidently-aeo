interface SummaryCardsProps {
  counts: Record<string, number>;
  active?: string | null;
  onSelect?: (quadrant: string | null) => void;
  cardMetaOverride?: Record<string, { label: string; color: string }>;
}

const defaultCardMeta: Record<string, { label: string; color: string }> = {
  priority: { label: 'Priority Partnerships', color: '#06c686' },
  reputation: { label: 'Reputation Management', color: '#f97373' },
  growth: { label: 'Growth Opportunities', color: '#498cf9' },
  monitor: { label: 'Monitor', color: '#cbd5e1' }
};

export const SummaryCards = ({ counts, active = null, onSelect, cardMetaOverride }: SummaryCardsProps) => {
  const cardMeta = cardMetaOverride ?? defaultCardMeta;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
      {Object.entries(cardMeta).map(([key, meta]) => (
        <div
          key={key}
          style={{
            border: `1px solid ${active === key ? meta.color : '#e5e7eb'}`,
            borderRadius: 12,
            padding: '12px 14px',
            background: active === key ? `${meta.color}14` : '#fff',
            boxShadow: active === key ? `0 10px 24px ${meta.color}33` : '0 8px 18px rgba(15,23,42,0.05)',
            cursor: onSelect ? 'pointer' : 'default',
            transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease'
          }}
          onClick={() => onSelect?.(active === key ? null : key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect?.(active === key ? null : key);
            }
          }}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : -1}
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

