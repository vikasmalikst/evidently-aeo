import { Opportunity } from '../../../types/opportunity';
import { Flag, TrendingUp, BarChart2, MessageCircle } from 'lucide-react';
import { SafeLogo } from '../../../components/Onboarding/common/SafeLogo';

interface OpportunityFlagsTableProps {
    opportunities: Opportunity[];
    competitors?: { name: string; domain?: string; logo?: string }[];
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
    Critical: { bg: '#fef2f2', text: '#dc2626', icon: '#ef4444' },
    High: { bg: '#fff7ed', text: '#ea580c', icon: '#f97316' },
    Medium: { bg: '#fefce8', text: '#ca8a04', icon: '#eab308' },
    Low: { bg: '#eff6ff', text: '#2563eb', icon: '#3b82f6' }
};

const METRIC_LABELS: Record<string, string> = {
    visibility: 'Visibility',
    soa: 'Share of Answer',
    sentiment: 'Sentiment'
};

const METRIC_ICONS: Record<string, any> = {
    visibility: TrendingUp,
    soa: BarChart2,
    sentiment: MessageCircle
};

export const OpportunityFlagsTable = ({ opportunities, competitors = [] }: OpportunityFlagsTableProps) => {

    const getTypeLabel = (category: number) => {
        if (category === 3) return 'Neutral';
        return 'Branded';
    };

    const getReason = (opp: Opportunity) => {
        const metric = METRIC_LABELS[opp.metricName] || opp.metricName;
        const gap = opp.gap.toFixed(1);

        if (opp.competitor) {
            return `Share of ${metric} is trailing ${opp.competitor} by ${gap} points`;
        }
        return `${metric} is less than threshold by ${gap} points`;
    };

    const getTargetText = (opp: Opportunity) => {
        return `${opp.targetValue.toFixed(0)}%`;
    };

    const getCompetitorInfo = (name: string | null) => {
        if (!name) return null;
        const match = competitors.find(c => c.name.toLowerCase() === name.toLowerCase());
        return match || { name, domain: undefined, logo: undefined };
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-gray-200">
                        {/* Flag Column */}
                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-16 border-r border-gray-200">
                            Flag
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-1/4 border-r border-gray-200">Query Text</th>
                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-24 border-r border-gray-200">Type</th>
                        <th className="text-left px-3 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-gray-200">Reason</th>
                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-24 border-r border-gray-200">KPI</th>
                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-40 border-r border-gray-200">Competitor</th>
                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-24">Target</th>
                    </tr>
                </thead>
                <tbody>
                    {opportunities.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="text-center py-12 text-slate-500">
                                No opportunities match the selected filters.
                            </td>
                        </tr>
                    ) : (
                        opportunities.map((opp) => {
                            const compInfo = getCompetitorInfo(opp.competitor);

                            return (
                                <tr
                                    key={opp.id}
                                    className="border-b border-gray-200 hover:bg-slate-50 transition-colors"
                                >
                                    {/* Flag Icon */}
                                    <td className="text-center px-3 py-3 border-r border-gray-200">
                                        <div className="flex justify-center">
                                            <Flag
                                                size={18}
                                                fill={SEVERITY_COLORS[opp.severity].icon}
                                                stroke={SEVERITY_COLORS[opp.severity].icon}
                                            />
                                        </div>
                                    </td>

                                    {/* Query Text (Cleaned) */}
                                    <td className="px-4 py-3 border-r border-gray-200">
                                        <div className="text-sm font-medium text-slate-800" title={opp.queryText}>
                                            {opp.queryText}
                                        </div>
                                    </td>

                                    {/* Type */}
                                    <td className="text-center px-3 py-3 border-r border-gray-200">
                                        <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold ${opp.queryCategory === 3
                                            ? 'bg-purple-50 text-purple-600 border border-purple-100'
                                            : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                            }`}>
                                            {getTypeLabel(opp.queryCategory)}
                                        </span>
                                    </td>

                                    {/* Reason */}
                                    <td className="px-3 py-3 border-r border-gray-200">
                                        <div className="text-sm text-slate-600">
                                            {getReason(opp)}
                                        </div>
                                    </td>

                                    {/* KPI */}
                                    <td className="text-center px-3 py-3 border-r border-gray-200">
                                        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                                            {METRIC_LABELS[opp.metricName] || opp.metricName}
                                        </span>
                                    </td>

                                    {/* Competitor with Logo */}
                                    <td className="text-center px-3 py-3 border-r border-gray-200">
                                        {compInfo ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <SafeLogo
                                                    src={compInfo.logo}
                                                    domain={compInfo.domain}
                                                    alt={compInfo.name}
                                                    size={20}
                                                    className="w-5 h-5 rounded-full object-contain bg-white border border-gray-100"
                                                />
                                                <span className="text-sm font-medium text-slate-800 truncate max-w-[100px]" title={compInfo.name}>
                                                    {compInfo.name}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="text-center text-slate-400">—</div>
                                        )}
                                    </td>

                                    {/* Target */}
                                    <td className="text-center px-3 py-3">
                                        <div className="text-sm font-mono text-slate-600 font-medium">
                                            {getTargetText(opp)}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};
