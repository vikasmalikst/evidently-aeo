/**
 * Opportunities Section Component for Executive Report
 * Displays recommendations across the 4-step workflow:
 * 1. Opportunities 2. Content Generation 3. Refine 4. Outcome Tracker
 */

import { IconSparkles, IconPlayerPlay, IconEdit, IconTarget, IconChevronRight } from '@tabler/icons-react';

interface OpportunityItem {
    id: string;
    action: string;
    citationSource: string;
    focusArea: string;
    priority: string;
    effort: string;
}

interface TrackOutcomeItem extends OpportunityItem {
    visibility_baseline: number | null;
    visibility_current: number | null;
    soa_baseline: number | null;
    soa_current: number | null;
    sentiment_baseline: number | null;
    sentiment_current: number | null;
    completed_at: string | null;
}

interface OpportunitiesData {
    discover: OpportunityItem[];
    todo: OpportunityItem[];
    refine: OpportunityItem[];
    track: TrackOutcomeItem[];
}

interface OpportunitiesSectionProps {
    data: OpportunitiesData;
}

const RecommendationTable = ({ items, columns, title, icon: Icon, colorClass }: {
    items: any[],
    columns: { label: string, key: string, format?: (val: any) => React.ReactNode }[],
    title: string,
    icon: any,
    colorClass: string
}) => {
    if (!items || items.length === 0) {
        return (
            <div className="executive-sub-section mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg bg-${colorClass}-50 text-${colorClass}-600`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--text-headings)]">{title}</h3>
                </div>
                <div className="p-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-[var(--text-caption)]">No recommendations in this stage.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="executive-sub-section mb-8">
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg bg-${colorClass}-50 text-${colorClass}-600`}>
                    <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-headings)]">{title}</h3>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                    {items.length}
                </span>
            </div>

            <div className="executive-table-container">
                <table className="executive-table">
                    <thead>
                        <tr>
                            {columns.map((col, i) => (
                                <th key={i}>{col.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, i) => (
                            <tr key={item.id || i}>
                                {columns.map((col, j) => (
                                    <td key={j} className={j === 0 ? "font-medium" : ""}>
                                        {col.format ? col.format(item[col.key]) : item[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const OpportunitiesSection = ({ data }: OpportunitiesSectionProps) => {
    // Handle case where opportunities data might not exist in older reports
    if (!data) {
        return (
            <div className="executive-section">
                <div className="executive-section-header">
                    <div className="executive-section-icon action-impact">
                        <IconSparkles className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="executive-section-title">Strategic Growth Opportunities</h2>
                        <p className="text-sm text-[var(--text-caption)] mt-1">
                            AI-powered recommendations mapped across the implementation workflow
                        </p>
                    </div>
                </div>
                <div className="mt-8 p-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-[var(--text-caption)]">
                        This report was generated before the Opportunities section was added.
                        Please generate a new report to see this data.
                    </p>
                </div>
            </div>
        );
    }

    const standardColumns = [
        { label: 'Recommendation Action', key: 'action' },
        { label: 'Source/Domain', key: 'citationSource' },
        { label: 'Focus Area', key: 'focusArea' },
        {
            label: 'Priority', key: 'priority', format: (v: string) => (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${v === 'High' ? 'bg-red-50 text-red-600' :
                    v === 'Medium' ? 'bg-amber-50 text-amber-600' :
                        'bg-blue-50 text-blue-600'
                    }`}>{v}</span>
            )
        },
        { label: 'Effort', key: 'effort' }
    ];

    const trackColumns = [
        { label: 'Recommendation Action', key: 'action' },
        { label: 'Source/Domain', key: 'citationSource' },
        { label: 'Baseline Visibility', key: 'visibility_baseline', format: (v: any) => v !== null ? v.toFixed(2) : '—' },
        { label: 'Baseline SOA%', key: 'soa_baseline', format: (v: any) => v !== null ? `${v.toFixed(1)}%` : '—' },
        { label: 'Baseline Sentiment', key: 'sentiment_baseline', format: (v: any) => v !== null ? v.toFixed(2) : '—' },
        { label: 'Completed', key: 'completed_at', format: (v: any) => v ? new Date(v).toLocaleDateString() : '—' }
    ];

    return (
        <div className="executive-section">
            <div className="executive-section-header">
                <div className="executive-section-icon action-impact">
                    <IconSparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                    <h2 className="executive-section-title">Strategic Growth Opportunities</h2>
                    <p className="text-sm text-[var(--text-caption)] mt-1">
                        AI-powered recommendations mapped across the implementation workflow
                    </p>
                </div>
            </div>

            <div className="mt-8">
                <RecommendationTable
                    title="Opportunities"
                    items={data.discover}
                    columns={standardColumns}
                    icon={IconSparkles}
                    colorClass="purple"
                />

                <RecommendationTable
                    title="Content Generation"
                    items={data.todo}
                    columns={standardColumns}
                    icon={IconPlayerPlay}
                    colorClass="blue"
                />

                <RecommendationTable
                    title="Refine"
                    items={data.refine}
                    columns={standardColumns}
                    icon={IconEdit}
                    colorClass="amber"
                />

                <RecommendationTable
                    title="Outcome Tracker"
                    items={data.track}
                    columns={trackColumns}
                    icon={IconTarget}
                    colorClass="green"
                />
            </div>
        </div>
    );
};
