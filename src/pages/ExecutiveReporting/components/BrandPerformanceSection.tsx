/**
 * Brand Performance Overview Section Component
 * Features glassmorphism metric cards and styled comparison table
 */

import { IconTrendingUp, IconTrendingDown, IconMinus, IconChartBar } from '@tabler/icons-react';

interface BrandPerformanceData {
    current: {
        visibility: number;
        average_position: number;
        appearance_rate: number;
        share_of_answer: number;
        sentiment: number;
    };
    previous: {
        visibility: number;
        average_position: number;
        appearance_rate: number;
        share_of_answer: number;
        sentiment: number;
    };
    deltas: {
        visibility: { absolute: number; percentage: number };
        average_position: { absolute: number; percentage: number };
        appearance_rate: { absolute: number; percentage: number };
        share_of_answer: { absolute: number; percentage: number };
        sentiment: { absolute: number; percentage: number };
    };
}

interface BrandPerformanceSectionProps {
    data: BrandPerformanceData;
}

const MetricCard = ({
    label,
    value,
    delta,
    suffix = '',
    inverseColor = false,
    index = 0,
}: {
    label: string;
    value: number;
    delta: { absolute: number; percentage: number };
    suffix?: string;
    inverseColor?: boolean;
    index?: number;
}) => {
    const isPositive = inverseColor ? delta.percentage < 0 : delta.percentage > 0;
    const isNeutral = Math.abs(delta.percentage) < 0.1;

    const trendClass = isNeutral
        ? 'executive-metric-trend neutral'
        : isPositive
            ? 'executive-metric-trend positive'
            : 'executive-metric-trend negative';

    const cardClass = isNeutral
        ? 'executive-metric-card'
        : isPositive
            ? 'executive-metric-card positive'
            : 'executive-metric-card negative';

    const Icon = isNeutral ? IconMinus : isPositive ? IconTrendingUp : IconTrendingDown;

    return (
        <div
            className={cardClass}
            style={{ animationDelay: `${index * 0.1}s` }}
        >
            <div className="executive-metric-label">{label}</div>
            <div className="executive-metric-value">
                {value.toFixed(1)}
                {suffix && <span className="text-lg text-[var(--text-caption)] ml-0.5">{suffix}</span>}
            </div>
            <div className={trendClass}>
                <Icon className="w-3.5 h-3.5" />
                <span>
                    {delta.percentage > 0 ? '+' : ''}
                    {delta.percentage.toFixed(1)}%
                </span>
                <span className="executive-metric-context">vs previous</span>
            </div>
        </div>
    );
};

export const BrandPerformanceSection = ({ data }: BrandPerformanceSectionProps) => {
    const getChangeClass = (value: number, inverse = false) => {
        const isPositive = inverse ? value < 0 : value > 0;
        if (Math.abs(value) < 0.1) return 'executive-change-neutral';
        return isPositive ? 'executive-change-positive' : 'executive-change-negative';
    };

    return (
        <div className="executive-section">
            <div className="executive-section-header">
                <div className="executive-section-icon performance">
                    <IconChartBar className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="executive-section-title">Brand Performance Overview</h2>
            </div>

            {/* Metric Cards Grid */}
            <div className="executive-metrics-grid">
                <MetricCard
                    label="Visibility Score"
                    value={data.current.visibility}
                    delta={data.deltas.visibility}
                    index={0}
                />
                <MetricCard
                    label="Share of Answer"
                    value={data.current.share_of_answer}
                    delta={data.deltas.share_of_answer}
                    suffix="%"
                    index={1}
                />
                <MetricCard
                    label="Brand Presence"
                    value={data.current.appearance_rate}
                    delta={data.deltas.appearance_rate}
                    suffix="%"
                    index={2}
                />
                <MetricCard
                    label="Sentiment Score"
                    value={data.current.sentiment}
                    delta={data.deltas.sentiment}
                    index={3}
                />
            </div>

            {/* Comparison Table */}
            <div className="mt-8">
                <h3 className="text-base font-bold text-[var(--text-headings)] mb-4">
                    Period-over-Period Comparison
                </h3>
                <div className="executive-table-container">
                    <table className="executive-table">
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th>Current</th>
                                <th>Previous</th>
                                <th>Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="font-medium">Visibility</td>
                                <td>{data.current.visibility.toFixed(1)}</td>
                                <td>{data.previous.visibility.toFixed(1)}</td>
                                <td>
                                    <span className={getChangeClass(data.deltas.visibility.percentage)}>
                                        {data.deltas.visibility.percentage > 0 ? '+' : ''}
                                        {data.deltas.visibility.percentage.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td className="font-medium">Share of Answer</td>
                                <td>{data.current.share_of_answer.toFixed(1)}%</td>
                                <td>{data.previous.share_of_answer.toFixed(1)}%</td>
                                <td>
                                    <span className={getChangeClass(data.deltas.share_of_answer.percentage)}>
                                        {data.deltas.share_of_answer.percentage > 0 ? '+' : ''}
                                        {data.deltas.share_of_answer.percentage.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td className="font-medium">Brand Presence</td>
                                <td>{data.current.appearance_rate.toFixed(1)}%</td>
                                <td>{data.previous.appearance_rate.toFixed(1)}%</td>
                                <td>
                                    <span className={getChangeClass(data.deltas.appearance_rate.percentage)}>
                                        {data.deltas.appearance_rate.percentage > 0 ? '+' : ''}
                                        {data.deltas.appearance_rate.percentage.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td className="font-medium">Sentiment</td>
                                <td>{data.current.sentiment.toFixed(2)}</td>
                                <td>{data.previous.sentiment.toFixed(2)}</td>
                                <td>
                                    <span className={getChangeClass(data.deltas.sentiment.percentage)}>
                                        {data.deltas.sentiment.percentage > 0 ? '+' : ''}
                                        {data.deltas.sentiment.percentage.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

