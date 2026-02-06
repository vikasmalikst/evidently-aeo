import React, { useMemo } from 'react';
import type { KeyTakeaway } from '../../utils/SourcesTakeawayGenerator';

interface KeyTakeawaysProps {
    takeaways: KeyTakeaway[];
    isLoading?: boolean;
}

const TakeawayCard: React.FC<{ takeaway: KeyTakeaway }> = ({ takeaway }) => {
    const { type, title, description } = takeaway;

    const styles = useMemo(() => {
        switch (type) {
            case 'critical':
                return {
                    bg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    border: '#fca5a5',
                    leftAccent: '#dc2626',
                    icon: '⚠️',
                    iconBg: '#fee2e2',
                    iconColor: '#dc2626',
                    titleColor: '#991b1b'
                };
            case 'opportunity':
                return {
                    bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '#93c5fd',
                    leftAccent: '#2563eb',
                    icon: '🚀',
                    iconBg: '#dbeafe',
                    iconColor: '#2563eb',
                    titleColor: '#1e40af'
                };
            case 'insight':
                return {
                    bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    border: '#86efac',
                    leftAccent: '#16a34a',
                    icon: '💡',
                    iconBg: '#dcfce7',
                    iconColor: '#16a34a',
                    titleColor: '#166534'
                };
            case 'info':
            default:
                return {
                    bg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '#cbd5e1',
                    leftAccent: '#64748b',
                    icon: 'ℹ️',
                    iconBg: '#e2e8f0',
                    iconColor: '#64748b',
                    titleColor: '#334155'
                };
        }
    }, [type]);

    return (
        <div style={{
            background: styles.bg,
            border: `1px solid ${styles.border}`,
            borderLeft: `4px solid ${styles.leftAccent}`,
            borderRadius: 12,
            padding: '16px 18px',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
            minHeight: 92,
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'default'
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.08)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.04)';
        }}
        >
            <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: styles.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(15, 23, 42, 0.05)'
            }}>
                {styles.icon}
            </div>
            <div style={{ flex: 1 }}>
                <h4 style={{
                    margin: '0 0 6px',
                    fontSize: 15,
                    fontWeight: 700,
                    color: styles.titleColor,
                    lineHeight: 1.3
                }}>
                    {title}
                </h4>
                <p style={{
                    margin: 0,
                    fontSize: 13,
                    color: '#475569',
                    lineHeight: 1.5
                }}>
                    {description}
                </p>
            </div>
        </div>
    );
};

export const KeyTakeaways: React.FC<KeyTakeawaysProps> = ({ takeaways, isLoading }) => {
    if (isLoading) {
        return (
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 16,
                marginBottom: 24,
                marginTop: 8
            }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{
                        height: 100,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }} />
                ))}
            </div>
        );
    }

    if (!takeaways.length) return null;

    return (
        <div style={{ marginBottom: 24, marginTop: 8 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Key Takeaways
            </h3>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 16
            }}>
                {takeaways.map(t => (
                    <TakeawayCard key={t.id} takeaway={t} />
                ))}
            </div>
        </div>
    );
};
