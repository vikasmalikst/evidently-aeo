/**
 * Executive Report section components
 * Uses SafeLogo for robust logo rendering with fallback support
 */

import {
    IconRobot,
    IconUsers,
    IconShieldCheck,
    IconBolt,
    IconTrendingUp,
    IconSparkles,
    IconSearch,
    IconCircleCheck,
    IconCircleX,
    IconFileText,
    IconTarget
} from '@tabler/icons-react';
import { SafeLogo } from '../../../components/Onboarding/common/SafeLogo';

// Map LLM names to their associated domains for logo resolution
const getLLMDomain = (llmName: string): string | undefined => {
    const normalize = llmName.toLowerCase();
    if (normalize.includes('chatgpt') || normalize.includes('gpt')) return 'openai.com';
    if (normalize.includes('gemini')) return 'google.com';
    if (normalize.includes('bard')) return 'google.com';
    if (normalize.includes('claude')) return 'anthropic.com';
    if (normalize.includes('perplexity')) return 'perplexity.ai';
    if (normalize.includes('bing') || normalize.includes('copilot')) return 'microsoft.com';
    if (normalize.includes('meta') || normalize.includes('llama')) return 'meta.com';
    if (normalize.includes('grok')) return 'x.ai';
    return undefined;
};

export const LLMPerformanceSection = ({ data }: { data: any }) => {
    if (!data || !data.by_llm || Object.keys(data.by_llm).length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-lg p-6 border border-[var(--border-default)]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg">
                    <IconRobot className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    LLM-Specific Performance
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-[var(--border-default)]">
                            <th className="text-left py-3 px-4 text-sm font-semibold">LLM</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold">Visibility</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold">Avg Position</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold">SOA</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold">Sentiment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(data.by_llm).map(([llmName, metrics]: [string, any]) => (
                            <tr key={llmName} className="border-b border-[var(--border-default)] hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-4 text-sm font-medium">
                                    <div className="flex items-center gap-3">
                                        <SafeLogo
                                            domain={getLLMDomain(llmName)}
                                            alt={llmName}
                                            size={24}
                                            className="w-6 h-6 object-contain rounded-full bg-gray-50 p-1 border border-gray-100"
                                        />
                                        <span>{llmName}</span>
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    {metrics.visibility?.toFixed(1) || 'N/A'}
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    {metrics.average_position?.toFixed(1) || 'N/A'}
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    {metrics.share_of_answer?.toFixed(1) || 'N/A'}%
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    <span className={`
                                        ${(metrics.sentiment || 0) > 0 ? 'text-green-600' : (metrics.sentiment || 0) < 0 ? 'text-red-600' : 'text-gray-500'}
                                    `}>
                                        {(metrics.sentiment || 0).toFixed(1)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Competitive Landscape Section
export const CompetitiveLandscapeSection = ({ data }: { data: any }) => {
    if (!data || !data.competitors || data.competitors.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-lg p-6 border border-[var(--border-default)]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-100 rounded-lg">
                    <IconUsers className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    Competitive Landscape
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-[var(--border-default)]">
                            <th className="text-left py-3 px-4 text-sm font-semibold">Competitor</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold">Visibility</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold">Avg Position</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold">SOA</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold">Sentiment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.competitors.map((comp: any, index: number) => (
                            <tr key={index} className="border-b border-[var(--border-default)] hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-4 text-sm font-medium">
                                    <div className="flex items-center gap-3">
                                        <SafeLogo
                                            domain={comp.website_url}
                                            alt={comp.name}
                                            size={24}
                                            className="w-6 h-6 object-contain rounded-full bg-white border border-gray-100"
                                        />
                                        <span className={comp.is_brand ? 'font-bold text-[var(--accent-primary)]' : ''}>
                                            {comp.name} {comp.is_brand && '(You)'}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    {comp.current?.visibility?.toFixed(1) || '0.0'}
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    {comp.current?.average_position?.toFixed(1) || 'N/A'}
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    {comp.current?.share_of_answer?.toFixed(1) || '0.0'}%
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    <span className={`
                                        ${(comp.current?.sentiment || 0) > 0 ? 'text-green-600' : (comp.current?.sentiment || 0) < 0 ? 'text-red-600' : 'text-gray-500'}
                                    `}>
                                        {(comp.current?.sentiment || 0).toFixed(1)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Domain Readiness Section
export const DomainReadinessSection = ({ data }: { data: any }) => {
    if (!data) {
        return null;
    }

    const { sub_scores, overall_score, score_delta } = data;

    return (
        <div className="bg-white rounded-lg p-6 border border-[var(--border-default)]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                    <IconShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    Domain Readiness
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="md:col-span-1 p-6 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-center items-center text-center">
                    <div className="text-sm text-[var(--text-muted)] font-medium mb-2 uppercase tracking-wider">Overall readiness</div>
                    <div className="text-5xl font-black text-[var(--text-headings)] mb-1">
                        {overall_score?.toFixed(0) || 0}
                        <span className="text-2xl text-[var(--text-muted)] ml-1">/100</span>
                    </div>
                    <div
                        className={`text-sm font-bold px-2 py-1 rounded-full ${score_delta?.percentage > 0
                            ? 'bg-green-100 text-green-700'
                            : score_delta?.percentage < 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-[var(--text-muted)]'
                            }`}
                    >
                        {score_delta?.percentage > 0 ? '↑' : score_delta?.percentage < 0 ? '↓' : ''}
                        {Math.abs(score_delta?.percentage || 0).toFixed(1)}% vs previous
                    </div>
                </div>

                <div className="md:col-span-2 overflow-hidden border border-[var(--border-default)] rounded-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-[var(--border-default)]">
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">KPI / Test Category</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Previous</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Current</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Change</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-default)]">
                            {sub_scores && Object.entries(sub_scores).map(([key, item]: [string, any]) => (
                                <tr key={key} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-semibold text-[var(--text-headings)]">
                                        {item.label}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[var(--text-muted)] font-medium text-center">
                                        {item.previous_score?.toFixed(0) || 0}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded text-sm font-bold ${item.score >= 80 ? 'bg-green-100 text-green-700' :
                                            item.score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {item.score?.toFixed(0) || 0}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-3 text-sm font-bold text-right ${item.delta?.percentage > 0
                                        ? 'text-green-600'
                                        : item.delta?.percentage < 0
                                            ? 'text-red-600'
                                            : 'text-gray-400'
                                        }`}>
                                        {item.delta?.percentage > 0 ? '+' : ''}
                                        {item.delta?.percentage?.toFixed(1) || 0}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {data.key_deficiencies && data.key_deficiencies.length > 0 && (
                <div className="pt-6 border-t border-[var(--border-default)]">
                    <h3 className="text-sm font-bold text-[var(--text-headings)] mb-4 flex items-center gap-2 uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Key Deficiencies & Priorities
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.key_deficiencies.slice(0, 6).map((def: any, index: number) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl"
                            >
                                <div
                                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${def.severity === 'critical'
                                        ? 'bg-red-600 text-white'
                                        : def.severity === 'high'
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-yellow-500 text-white'
                                        }`}
                                >
                                    {def.severity}
                                </div>
                                <div className="flex-1 text-sm text-[var(--text-body)] leading-relaxed">
                                    <span className="font-bold text-[var(--text-headings)]">{def.category}:</span> {def.description}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Actions & Impact Section
export const ActionsImpactSection = ({ data }: { data: any }) => {
    if (!data || !data.recommendations) {
        return null;
    }

    const { recommendations } = data;

    const pipelineSteps = [
        {
            label: 'Generated',
            value: recommendations.generated || 0,
            icon: <IconSparkles className="w-5 h-5 text-[var(--accent-primary)]" />,
            borderColor: 'border-l-[var(--accent-primary)]'
        },
        {
            label: 'Pending',
            value: recommendations.needs_review || 0,
            icon: <IconSearch className="w-5 h-5 text-orange-500" />,
            borderColor: 'border-l-orange-500'
        },
        {
            label: 'Approved',
            value: recommendations.approved || 0,
            icon: <IconCircleCheck className="w-5 h-5 text-green-500" />,
            borderColor: 'border-l-green-500'
        },
        {
            label: 'Rejected',
            value: recommendations.rejected || 0,
            icon: <IconCircleX className="w-5 h-5 text-red-500" />,
            borderColor: 'border-l-red-500'
        },
        {
            label: 'Content',
            value: recommendations.content_generated || 0,
            icon: <IconFileText className="w-5 h-5 text-purple-500" />,
            borderColor: 'border-l-purple-500'
        },
        {
            label: 'Implemented',
            value: recommendations.implemented || 0,
            icon: <IconTarget className="w-5 h-5 text-blue-500" />,
            borderColor: 'border-l-blue-500'
        },
    ];

    return (
        <div className="bg-white rounded-lg p-6 border border-[var(--border-default)]">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-[var(--accent-light)] rounded-lg">
                    <IconBolt className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    Recommendation Pipeline & ROI
                </h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {pipelineSteps.map((step, idx) => (
                    <div
                        key={idx}
                        className={`bg-white p-5 border border-[var(--border-default)] ${step.borderColor} border-l-4 rounded-lg text-left transition-all hover:shadow-md hover:-translate-y-0.5`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            {step.icon}
                            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-widest">
                                {step.label}
                            </span>
                        </div>
                        <div className="text-3xl font-bold text-[var(--text-headings)]">
                            {step.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Implementation Rate */}
            <div className="mt-10 pt-8 border-t border-[var(--border-default)]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex-1">
                        <div className="flex justify-between items-end mb-3">
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-headings)]">Implementation Efficiency</h3>
                                <p className="text-[11px] text-[var(--text-muted)]">Conversion of approved strategies into live assets</p>
                            </div>
                            <span className="text-lg font-bold text-[var(--accent-primary)]">
                                {recommendations.approved > 0
                                    ? ((recommendations.implemented / recommendations.approved) * 100).toFixed(0)
                                    : 0}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-[var(--accent-primary)] h-full rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${recommendations.approved > 0 ? (recommendations.implemented / recommendations.approved) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 px-8 py-5 bg-[var(--bg-secondary)] rounded-xl">
                        <div>
                            <div className="text-[10px] text-[var(--text-muted)] uppercase font-black mb-1 tracking-wider">Strategy Approval</div>
                            <div className="text-2xl font-bold text-[var(--text-headings)] flex items-baseline gap-1">
                                {recommendations.generated > 0
                                    ? ((recommendations.approved / recommendations.generated) * 100).toFixed(0)
                                    : 0}
                                <span className="text-sm text-[var(--text-muted)] font-normal">%</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-[var(--text-muted)] uppercase font-black mb-1 tracking-wider">Content Velocity</div>
                            <div className="text-2xl font-bold text-[var(--text-headings)] flex items-baseline gap-1">
                                {recommendations.approved > 0
                                    ? ((recommendations.content_generated / recommendations.approved) * 100).toFixed(0)
                                    : 0}
                                <span className="text-sm text-[var(--text-muted)] font-normal">%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Top Movers Section
export const TopMoversSection = ({ data }: { data: any }) => {
    if (!data) {
        return null;
    }

    const MoverList = ({ title, items, isGain, metricKey }: { title: string, items: any[], isGain: boolean, metricKey: string }) => {
        if (!items || items.length === 0) return (
            <div className="flex-1 flex flex-col items-center justify-center py-4 bg-gray-50/50 rounded-lg border border-dashed border-gray-100 italic text-[10px] text-gray-400">
                No major shifts
            </div>
        );

        return (
            <div className="flex-1">
                <div className="flex items-center justify-between mb-2 px-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isGain ? 'text-green-600' : 'text-red-600'}`}>
                        {title}
                    </span>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-[1fr_45px_55px] gap-1.5 px-2 py-1 bg-gray-50 rounded-md mb-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                    <div>Source</div>
                    <div className="text-center">Impact</div>
                    <div className="text-right">Change</div>
                </div>

                <div className="space-y-1">
                    {items.slice(0, 3).map((item, index) => {
                        const val = item.changes?.[metricKey]?.absolute || 0;
                        const isPos = metricKey === 'average_position';

                        // For position: gains are negative deltas, losses are positive deltas
                        // We want to show ↑ for gains and ↓ for losses
                        const displayGain = isPos ? val < 0 : val > 0;
                        const displayVal = isPos ? Math.abs(val) : val;

                        const impact = item.impact_score || 0;

                        return (
                            <div
                                key={index}
                                className="group grid grid-cols-[1fr_45px_55px] gap-1.5 items-center p-2 bg-white border border-gray-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all duration-200"
                            >
                                <div className="min-w-0 pr-1">
                                    <div className="text-xs font-semibold text-gray-800 truncate leading-tight group-hover:text-indigo-900" title={item.name}>
                                        {item.name}
                                    </div>
                                </div>

                                <div className="flex justify-center">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                        {impact}
                                    </span>
                                </div>

                                <div className="flex justify-end">
                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${displayGain ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                        }`}>
                                        {displayGain ? '↑' : '↓'}
                                        {displayVal.toFixed(isPos ? 1 : 1)}
                                        {(metricKey === 'soa' || metricKey === 'visibility') && '%'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const MetricCard = ({ title, icon: Icon, gains, losses, metricKey }: { title: string, icon: any, gains: any[], losses: any[], metricKey: string }) => (
        <div className="bg-[#fcfcff] border border-indigo-50 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-indigo-50">
                    <Icon className="w-4 h-4 text-indigo-500" />
                </div>
                <h4 className="text-sm font-bold text-gray-800 tracking-tight">{title}</h4>
            </div>
            <div className="flex flex-col xl:flex-row gap-4">
                <MoverList title="Top Gains" items={gains} isGain={true} metricKey={metricKey} />
                <MoverList title="Top Losses" items={losses} isGain={false} metricKey={metricKey} />
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                        <IconTrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Performance Dynamics
                        </h2>
                        <p className="text-sm text-gray-500">Analysis of the most significant shifts in visibility and impact</p>
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {/* Search Queries Section */}
                <div className="relative">
                    <div className="flex items-center gap-2 mb-6 ml-1">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                        <h3 className="text-base font-bold text-gray-800 uppercase tracking-widest text-xs">Search Intent & Share</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 scale-[0.99] origin-left">
                        <MetricCard
                            title="Share of Answer (Market Share)"
                            icon={IconSearch}
                            gains={data.queries?.gains || []}
                            losses={data.queries?.losses || []}
                            metricKey="share_of_answer"
                        />
                        {data.topics?.gains && data.topics.gains.length > 0 && (
                            <MetricCard
                                title="Hot Topics"
                                icon={IconTarget}
                                gains={data.topics.gains}
                                losses={[]} // Topics currently only has gains (top movers)
                                metricKey="combined_score"
                            />
                        )}
                    </div>
                </div>

                {/* Citation Sources Matrix */}
                {data.sources && (
                    <div className="pt-8 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2 ml-1">
                                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                <h3 className="text-base font-bold text-gray-800 uppercase tracking-widest text-xs">Citation Source Matrix</h3>
                            </div>
                            <div className="flex gap-2">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tighter bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                    <IconUsers className="w-3 h-3" /> Top Movers
                                </span>
                            </div>
                        </div>

                        {Object.values(data.sources).every(list => !Array.isArray(list) || list.length === 0) ? (
                            <div className="py-20 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                <div className="p-5 bg-white rounded-full shadow-md shadow-gray-100 mb-4 ring-8 ring-gray-50">
                                    <IconUsers className="w-8 h-8 text-gray-300" />
                                </div>
                                <h5 className="text-base font-bold text-gray-800 mb-1 tracking-tight">Equilibrium Detected</h5>
                                <p className="text-sm text-gray-400 max-w-[320px]">Citation source metrics are showing high stability with no significant outliers this period.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                                <MetricCard
                                    title="Visibility"
                                    icon={IconBolt}
                                    gains={data.sources.visibility_gains}
                                    losses={data.sources.visibility_losses}
                                    metricKey="visibility"
                                />
                                <MetricCard
                                    title="Share of Answer"
                                    icon={IconSearch}
                                    gains={data.sources.soa_gains}
                                    losses={data.sources.soa_losses}
                                    metricKey="soa"
                                />
                                <MetricCard
                                    title="Sentiment"
                                    icon={IconSparkles}
                                    gains={data.sources.sentiment_gains}
                                    losses={data.sources.sentiment_losses}
                                    metricKey="sentiment"
                                />
                                <MetricCard
                                    title="Avg. Position"
                                    icon={IconTarget}
                                    gains={data.sources.position_gains}
                                    losses={data.sources.position_losses}
                                    metricKey="average_position"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
