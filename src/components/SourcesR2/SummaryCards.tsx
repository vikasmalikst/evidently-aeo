import { HelpButton } from '../common/HelpButton';

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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      {Object.entries(cardMeta).map(([key, meta]) => (
        <div
          key={key}
          style={{
            border: `2px solid ${active === key ? meta.color : '#e5e7eb'}`,
            borderRadius: 12,
            padding: '16px 18px',
            background: active === key ? `linear-gradient(135deg, ${meta.color}08 0%, ${meta.color}14 100%)` : '#fff',
            boxShadow: active === key 
              ? `0 12px 32px ${meta.color}40, 0 0 0 1px ${meta.color}20` 
              : '0 2px 8px rgba(15,23,42,0.04)',
            cursor: onSelect ? 'pointer' : 'default',
            transition: 'all 220ms cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          className="group/card"
          onClick={() => onSelect?.(active === key ? null : key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect?.(active === key ? null : key);
            }
          }}
          onMouseEnter={(e) => {
            if (!active || active !== key) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(15,23,42,0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (!active || active !== key) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)';
            }
          }}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : -1}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: meta.color,
                boxShadow: `0 0 0 3px ${meta.color}20`,
                animation: active === key ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
              }} />
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 700 }}>{meta.label}</span>
            </div>
            {onHelpClick && (
              <HelpButton
                onClick={(e) => {
                  e?.stopPropagation();
                  onHelpClick(key);
                }}
                className="opacity-0 group-hover/card:opacity-100 p-1 relative z-10 transition-opacity"
                label={`Learn about ${meta.label}`}
                size={14}
              />
            )}
          </div>
          {meta.description && (
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, lineHeight: 1.4 }}>
              {meta.description}
            </div>
          )}
          <div style={{ fontSize: 28, fontWeight: 800, color: active === key ? meta.color : '#0f172a' }}>
            {counts[key as keyof typeof counts] ?? 0}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>sources</div>
        </div>
      ))}
    </div>
  );
};

