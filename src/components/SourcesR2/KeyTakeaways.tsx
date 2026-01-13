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
                    bg: '#fef2f2',
                    border: '#fecdd3',
                    icon: '⚠️',
                    iconColor: '#dc2626',
                    titleColor: '#991b1b'
                };
            case 'opportunity':
                return {
                    bg: '#eff6ff',
                    border: '#bfdbfe',
                    icon: '🚀',
                    iconColor: '#2563eb',
                    titleColor: '#1e40af'
                };
            case 'insight':
                return {
                    bg: '#f0fdf4',
                    border: '#bbf7d0',
                    icon: '💡',
                    iconColor: '#16a34a',
                    titleColor: '#166534'
                };
            case 'info':
            default:
                return {
                    bg: '#f8fafc',
                    border: '#e2e8f0',
                    icon: 'ℹ️',
                    iconColor: '#64748b',
                    titleColor: '#334155'
                };
        }
    }, [type]);

    return (
        <div style={{
            background: styles.bg,
            border: `1px solid ${styles.border}`,
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            minHeight: 80
        }}>
            <div style={{
                fontSize: 18,
                lineHeight: 1,
                marginTop: 2
            }}>
                {styles.icon}
            </div>
            <div>
                <h4 style={{
                    margin: '0 0 4px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: styles.titleColor
                }}>
                    {title}
                </h4>
                <p style={{
                    margin: 0,
                    fontSize: 13,
                    color: '#475569',
                    lineHeight: 1.4
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
