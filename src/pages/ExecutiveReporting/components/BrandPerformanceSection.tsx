/**
 * Brand Performance Overview Section Component
 */

import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';

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
}: {
    label: string;
    value: number;
    delta: { absolute: number; percentage: number };
    suffix?: string;
    inverseColor?: boolean;
}) => {
    const isPositive = inverseColor ? delta.percentage < 0 : delta.percentage > 0;
    const isNeutral = delta.percentage === 0;

    const colorClass = isNeutral
        ? 'text-[var(--text-muted)]'
        : isPositive
            ? 'text-green-600'
            : 'text-red-600';

    const Icon = isNeutral ? IconMinus : isPositive ? IconTrendingUp : IconTrendingDown;

    return (
        <div className="bg-white p-6 rounded-lg border border-[var(--border-default)]">
            <div className="text-sm text-[var(--text-muted)] uppercase tracking-wide mb-2">
                {label}
            </div>
            <div className="text-3xl font-bold text-[var(--text-headings)] mb-2">
                {value.toFixed(1)}
                {suffix}
            </div>
            <div className={`flex items-center gap-1 text-sm font-semibold ${colorClass}`}>
                <Icon className="w-4 h-4" />
                <span>
                    {delta.percentage > 0 ? '+' : ''}
                    {delta.percentage.toFixed(1)}%
                </span>
                <span className="text-[var(--text-muted)] font-normal">vs previous</span>
            </div>
        </div>
    );
};

export const BrandPerformanceSection = ({ data }: BrandPerformanceSectionProps) => {
    return (
        <div className="bg-white rounded-lg p-6 border border-[var(--border-default)]">
            <h2 className="text-xl font-semibold text-[var(--text-headings)] mb-6">
                Brand Performance Overview
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Visibility Score"
                    value={data.current.visibility}
                    delta={data.deltas.visibility}
                />
                <MetricCard
                    label="Share of Answer"
                    value={data.current.share_of_answer}
                    delta={data.deltas.share_of_answer}
                    suffix="%"
                />
                <MetricCard
                    label="Avg Position"
                    value={data.current.average_position}
                    delta={data.deltas.average_position}
                    inverseColor={true}
                />
                <MetricCard
                    label="Sentiment Score"
                    value={data.current.sentiment}
                    delta={data.deltas.sentiment}
                />
            </div>

            {/* Comparison Table */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
                    Period-over-Period Comparison
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--border-default)]">
                                <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-headings)]">
                                    Metric
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-headings)]">
                                    Current
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-headings)]">
                                    Previous
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-headings)]">
                                    Change
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-[var(--border-default)]">
                                <td className="py-3 px-4 text-sm text-[var(--text-body)]">Visibility</td>
                                <td className="py-3 px-4 text-sm text-right text-[var(--text-body)]">
                                    {data.current.visibility.toFixed(1)}
                                </td>
                                <td className="py-3 px-4 text-sm text-right text-[var(--text-body)]">
                                    {data.previous.visibility.toFixed(1)}
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    <span
                                        className={
                                            data.deltas.visibility.percentage > 0
                                                ? 'text-green-600 font-semibold'
                                                : data.deltas.visibility.percentage < 0
                                                    ? 'text-red-600 font-semibold'
                                                    : 'text-[var(--text-muted)]'
                                        }
                                    >
                                        {data.deltas.visibility.percentage > 0 ? '+' : ''}
                                        {data.deltas.visibility.percentage.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-[var(--border-default)]">
                                <td className="py-3 px-4 text-sm text-[var(--text-body)]">Share of Answer</td>
                                <td className="py-3 px-4 text-sm text-right text-[var(--text-body)]">
                                    {data.current.share_of_answer.toFixed(1)}%
                                </td>
                                <td className="py-3 px-4 text-sm text-right text-[var(--text-body)]">
                                    {data.previous.share_of_answer.toFixed(1)}%
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    <span
                                        className={
                                            data.deltas.share_of_answer.percentage > 0
                                                ? 'text-green-600 font-semibold'
                                                : data.deltas.share_of_answer.percentage < 0
                                                    ? 'text-red-600 font-semibold'
                                                    : 'text-[var(--text-muted)]'
                                        }
                                    >
                                        {data.deltas.share_of_answer.percentage > 0 ? '+' : ''}
                                        {data.deltas.share_of_answer.percentage.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-[var(--border-default)]">
                                <td className="py-3 px-4 text-sm text-[var(--text-body)]">Avg Position</td>
                                <td className="py-3 px-4 text-sm text-right text-[var(--text-body)]">
                                    {data.current.average_position.toFixed(1)}
                                </td>
                                <td className="py-3 px-4 text-sm text-right text-[var(--text-body)]">
                                    {data.previous.average_position.toFixed(1)}
                                </td>
                                < td className="py-3 px-4 text-sm text-right">
                                    <span
                                        className={
                                            data.deltas.average_position.percentage < 0
                                                ? 'text-green-600 font-semibold'
                                                : data.deltas.average_position.percentage > 0
                                                    ? 'text-red-600 font-semibold'
                                                    : 'text-[var(--text-muted)]'
                                        }
                                    >
                                        {data.deltas.average_position.percentage > 0 ? '+' : ''}
                                        {data.deltas.average_position.percentage.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4 text-sm text-[var(--text-body)]">Sentiment</td>
                                <td className="py-3 px-4 text-sm text-right text-[var(--text-body)]">
                                    {data.current.sentiment.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-sm text-right text-[var(--text-body)]">
                                    {data.previous.sentiment.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    <span
                                        className={
                                            data.deltas.sentiment.percentage > 0
                                                ? 'text-green-600 font-semibold'
                                                : data.deltas.sentiment.percentage < 0
                                                    ? 'text-red-600 font-semibold'
                                                    : 'text-[var(--text-muted)]'
                                        }
                                    >
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
