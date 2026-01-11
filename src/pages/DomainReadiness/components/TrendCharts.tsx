import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AeoAuditResult } from '../types/types';

interface TrendChartsProps {
    history: AeoAuditResult[];
    orientation?: 'horizontal' | 'vertical';
    categoryFilter?: string; // Add filter prop
}

interface CategoryTrend {
    name: string;
    key: keyof AeoAuditResult['scoreBreakdown'];
    currentScore: number;
    trend: number;
    data: { date: string; score: number }[];
    color: string;
}

export const TrendCharts = ({ history, orientation = 'horizontal', categoryFilter }: TrendChartsProps) => {
    const categories: CategoryTrend[] = useMemo(() => {
        if (history.length === 0) return [];

        const categoryKeys: { key: keyof AeoAuditResult['scoreBreakdown']; name: string; color: string }[] = [
            { key: 'technicalCrawlability', name: 'Technical', color: '#3b82f6' },
            { key: 'contentQuality', name: 'Content', color: '#a855f7' },
            { key: 'semanticStructure', name: 'Semantic', color: '#10b981' },
            { key: 'accessibilityAndBrand', name: 'Access & Brand', color: '#f97316' },
            { key: 'aeoOptimization', name: 'AEO', color: '#6366f1' },
        ];

        // Filter if prop provided
        const filteredKeys = categoryFilter
            ? categoryKeys.filter(c => c.key === categoryFilter)
            : categoryKeys;

        return filteredKeys.map(({ key, name, color }) => {
            const data = history.map(audit => ({
                date: audit.auditDate || audit.timestamp.split('T')[0],
                score: audit.scoreBreakdown[key]
            }));

            const currentScore = data[data.length - 1]?.score || 0;
            const firstScore = data[0]?.score || 0;
            const trend = firstScore > 0 ? ((currentScore - firstScore) / firstScore) * 100 : 0;

            return { name, key, currentScore, trend, data, color };
        });
    }, [history]);

    const getTrendIcon = (trend: number) => {
        if (trend > 2) return <TrendingUp className="w-3 h-3 text-green-600" />;
        if (trend < -2) return <TrendingDown className="w-3 h-3 text-red-600" />;
        return <Minus className="w-3 h-3 text-gray-400" />;
    };

    const getTrendColor = (trend: number) => {
        if (trend > 2) return 'text-green-600';
        if (trend < -2) return 'text-red-600';
        return 'text-gray-500';
    };

    if (history.length === 0) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-500">No historical data available yet. Run audits over multiple days to see trends.</p>
            </div>
        );
    }

    return (
        <div className={`mb - 6 ${orientation === 'vertical' ? 'h-full' : ''} `}>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">30-Day Trends</h3>
            <div className={`grid gap - 4 ${orientation === 'vertical'
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-5'
                } `}>
                {categories.map((cat) => (
                    <div key={cat.key} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600">{cat.name}</span>
                            <div className="flex items-center gap-1">
                                {getTrendIcon(cat.trend)}
                                <span className={`text - xs font - medium ${getTrendColor(cat.trend)} `}>
                                    {cat.trend > 0 ? '+' : ''}{cat.trend.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        <div className="text-2xl font-bold text-gray-900 mb-3">
                            {cat.currentScore}
                        </div>

                        <ResponsiveContainer width="100%" height={60}>
                            <LineChart data={cat.data}>
                                <defs>
                                    <linearGradient id={`gradient - ${cat.key} `} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={cat.color} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={cat.color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
                                                    <p>{payload[0].payload.date}</p>
                                                    <p className="font-bold">Score: {payload[0].value}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke={cat.color}
                                    strokeWidth={2}
                                    dot={false}
                                    fill={`url(#gradient - ${cat.key})`}
                                />
                            </LineChart>
                        </ResponsiveContainer>

                        <div className="text-xs text-gray-500 mt-2">
                            {cat.data.length} data point{cat.data.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
