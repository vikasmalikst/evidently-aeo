import { useState, useEffect } from 'react';
import { NumericFilter, NumericFilters } from '../../types/citation-sources';

interface NumericFilterPanelProps {
    filters: NumericFilters;
    onFiltersChange: (filters: NumericFilters) => void;
    onClose: () => void;
}

interface CompactFilterRowProps {
    title: string;
    filterKey: keyof NumericFilters;
    filter: NumericFilter;
    onChange: (filter: NumericFilter) => void;
    min?: number;
    max?: number;
    step?: number;
}

const CompactFilterRow = ({ title, filterKey, filter, onChange, min, max, step = 0.01 }: CompactFilterRowProps) => {
    const isActive = filter.operator !== null;

    const handleOperatorChange = (operator: NumericFilter['operator']) => {
        if (operator === filter.operator) {
            // Clicking the same operator clears it
            onChange({ operator: null });
        } else {
            onChange({ operator, value: undefined, min: undefined, max: undefined });
        }
    };

    const handleValueChange = (value: string) => {
        const numValue = parseFloat(value);
        onChange({ ...filter, value: isNaN(numValue) ? undefined : numValue });
    };

    const handleMinChange = (value: string) => {
        const numValue = parseFloat(value);
        onChange({ ...filter, min: isNaN(numValue) ? undefined : numValue });
    };

    const handleMaxChange = (value: string) => {
        const numValue = parseFloat(value);
        onChange({ ...filter, max: isNaN(numValue) ? undefined : numValue });
    };

    const handleReset = () => {
        onChange({ operator: null });
    };

    return (
        <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: 12
        }}>
            {/* Column Title */}
            <div style={{
                minWidth: 120,
                fontWeight: 600,
                fontSize: 13,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: 6
            }}>
                {title}
                {isActive && (
                    <span style={{
                        display: 'inline-flex',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#6366f1'
                    }} />
                )}
            </div>

            {/* Operator Buttons */}
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                <button
                    onClick={() => handleOperatorChange('gt')}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: `1.5px solid ${filter.operator === 'gt' ? '#6366f1' : '#e5e7eb'}`,
                        background: filter.operator === 'gt' ? '#eef2ff' : '#fff',
                        color: filter.operator === 'gt' ? '#4f46e5' : '#64748b',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        whiteSpace: 'nowrap'
                    }}
                >
                    &gt;
                </button>

                <button
                    onClick={() => handleOperatorChange('lt')}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: `1.5px solid ${filter.operator === 'lt' ? '#6366f1' : '#e5e7eb'}`,
                        background: filter.operator === 'lt' ? '#eef2ff' : '#fff',
                        color: filter.operator === 'lt' ? '#4f46e5' : '#64748b',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        whiteSpace: 'nowrap'
                    }}
                >
                    &lt;
                </button>

                <button
                    onClick={() => handleOperatorChange('eq')}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: `1.5px solid ${filter.operator === 'eq' ? '#6366f1' : '#e5e7eb'}`,
                        background: filter.operator === 'eq' ? '#eef2ff' : '#fff',
                        color: filter.operator === 'eq' ? '#4f46e5' : '#64748b',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        whiteSpace: 'nowrap'
                    }}
                >
                    =
                </button>

                <button
                    onClick={() => handleOperatorChange('range')}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: `1.5px solid ${filter.operator === 'range' ? '#6366f1' : '#e5e7eb'}`,
                        background: filter.operator === 'range' ? '#eef2ff' : '#fff',
                        color: filter.operator === 'range' ? '#4f46e5' : '#64748b',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        whiteSpace: 'nowrap'
                    }}
                >
                    Range
                </button>

                {/* Value Input(s) */}
                {filter.operator === 'range' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, maxWidth: 200 }}>
                        <input
                            type="number"
                            value={filter.min ?? ''}
                            onChange={(e) => handleMinChange(e.target.value)}
                            min={min}
                            max={max}
                            step={step}
                            placeholder="Min"
                            style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1.5px solid #e5e7eb',
                                fontSize: 12,
                                outline: 'none'
                            }}
                        />
                        <span style={{ color: '#94a3b8', fontSize: 12, alignSelf: 'center' }}>-</span>
                        <input
                            type="number"
                            value={filter.max ?? ''}
                            onChange={(e) => handleMaxChange(e.target.value)}
                            min={min}
                            max={max}
                            step={step}
                            placeholder="Max"
                            style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1.5px solid #e5e7eb',
                                fontSize: 12,
                                outline: 'none'
                            }}
                        />
                    </div>
                ) : filter.operator && filter.operator !== null ? (
                    <input
                        type="number"
                        value={filter.value ?? ''}
                        onChange={(e) => handleValueChange(e.target.value)}
                        min={min}
                        max={max}
                        step={step}
                        placeholder="Value"
                        style={{
                            flex: 1,
                            maxWidth: 120,
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1.5px solid #e5e7eb',
                            fontSize: 12,
                            outline: 'none'
                        }}
                    />
                ) : (
                    <div style={{ flex: 1 }} />
                )}

                {/* Reset Button */}
                {isActive && (
                    <button
                        onClick={handleReset}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1.5px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 150ms',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Reset
                    </button>
                )}
            </div>
        </div>
    );
};

export const NumericFilterPanel = ({ filters, onFiltersChange, onClose }: NumericFilterPanelProps) => {
    const [localFilters, setLocalFilters] = useState<NumericFilters>(filters);

    // Sync local filters with props when panel opens
    useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    const handleFilterChange = (key: keyof NumericFilters, filter: NumericFilter) => {
        setLocalFilters((prev) => ({
            ...prev,
            [key]: filter
        }));
    };

    const handleApply = () => {
        onFiltersChange(localFilters);
        onClose();
    };

    const handleClearAll = () => {
        const clearedFilters: NumericFilters = {
            valueScore: { operator: null },
            mentionRate: { operator: null },
            soa: { operator: null },
            sentiment: { operator: null },
            citations: { operator: null }
        };
        setLocalFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    const activeFilterCount = Object.values(localFilters).filter((f) => f.operator !== null).length;

    return (
        <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 8,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            zIndex: 50,
            maxWidth: 800
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        📊 Numeric Filters
                    </h3>
                    {activeFilterCount > 0 && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: '#eef2ff',
                            color: '#6366f1'
                        }}>
                            {activeFilterCount} active
                        </span>
                    )}
                </div>
                <button
                    onClick={onClose}
                    style={{
                        padding: 4,
                        border: 'none',
                        background: 'transparent',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: 18,
                        lineHeight: 1
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Filter Rows */}
            <div>
                <CompactFilterRow
                    title="Impact Score"
                    filterKey="valueScore"
                    filter={localFilters.valueScore}
                    onChange={(f) => handleFilterChange('valueScore', f)}
                    min={0}
                    max={100}
                    step={1}
                />
                <CompactFilterRow
                    title="Mention Rate (%)"
                    filterKey="mentionRate"
                    filter={localFilters.mentionRate}
                    onChange={(f) => handleFilterChange('mentionRate', f)}
                    min={0}
                    max={100}
                    step={0.1}
                />
                <CompactFilterRow
                    title="SOA (%)"
                    filterKey="soa"
                    filter={localFilters.soa}
                    onChange={(f) => handleFilterChange('soa', f)}
                    min={0}
                    max={100}
                    step={0.1}
                />
                <CompactFilterRow
                    title="Sentiment"
                    filterKey="sentiment"
                    filter={localFilters.sentiment}
                    onChange={(f) => handleFilterChange('sentiment', f)}
                    min={-1}
                    max={1}
                    step={0.01}
                />
                <CompactFilterRow
                    title="Citations"
                    filterKey="citations"
                    filter={localFilters.citations}
                    onChange={(f) => handleFilterChange('citations', f)}
                    min={0}
                    step={1}
                />
            </div>

            {/* Footer */}
            <div style={{
                padding: '12px 16px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
            }}>
                <button
                    onClick={handleClearAll}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1.5px solid #e5e7eb',
                        background: '#fff',
                        color: '#64748b',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 150ms'
                    }}
                >
                    Clear All
                </button>
                <button
                    onClick={handleApply}
                    style={{
                        padding: '8px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#6366f1',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        boxShadow: '0 2px 4px rgba(99,102,241,0.2)'
                    }}
                >
                    Apply Filters
                </button>
            </div>
        </div>
    );
};
