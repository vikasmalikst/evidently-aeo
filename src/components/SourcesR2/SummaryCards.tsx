import { HelpCircle } from 'lucide-react';

interface SummaryCardMeta {
  label: string;
  color: string;
  description?: string;
}

interface SummaryCardsProps {
  counts: Record<string, number>;
  active?: string | null;
  onSelect?: (quadrant: string | null) => void;
  onHelpClick?: (key: string) => void;
}

const defaultCardMeta: Record<string, SummaryCardMeta> = {
  priority: { label: 'Priority Partnerships', color: '#06c686' },
  reputation: { label: 'Reputation Management', color: '#f97373' },
  growth: { label: 'Growth Opportunities', color: '#498cf9' },
  monitor: { label: 'Monitor', color: '#cbd5e1' }
};

export const SummaryCards = ({ counts, active = null, onSelect, onHelpClick }: SummaryCardsProps) => {
  const cardMeta = defaultCardMeta;

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
          className="group/card"
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color }} />
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 700 }}>{meta.label}</span>
            </div>
            {onHelpClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onHelpClick(key);
                }}
                className="opacity-0 group-hover/card:opacity-100 p-1 text-slate-300 hover:text-blue-500 transition-opacity relative z-10 cursor-pointer"
                aria-label={`Learn about ${meta.label}`}
              >
                <HelpCircle size={14} />
              </button>
            )}
          </div>
          {meta.description && (
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, lineHeight: 1.4 }}>
              {meta.description}
            </div>
          )}
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{counts[key as keyof typeof counts] ?? 0}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>sources</div>
        </div>
      ))}
    </div>
  );
};

