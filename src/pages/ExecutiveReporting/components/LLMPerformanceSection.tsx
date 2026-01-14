/**
 * Executive Report section components
 * Uses SafeLogo for robust logo rendering with fallback support
 */

import { IconRobot, IconUsers, IconShieldCheck, IconBolt, IconTrendingUp } from '@tabler/icons-react';
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
    if (!data) {
        return null;
    }

    return (
        <div className="bg-white rounded-lg p-6 border border-[var(--border-default)]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <IconBolt className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    Actions & Impact
                </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border border-[var(--border-default)] rounded-lg text-center">
                    <div className="text-2xl font-bold text-[var(--text-headings)]">
                        {data.recommendations?.provided || 0}
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mt-1">Recommendations</div>
                </div>
                <div className="p-4 border border-[var(--border-default)] rounded-lg text-center">
                    <div className="text-2xl font-bold text-[var(--text-headings)]">
                        {data.recommendations?.approved || 0}
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mt-1">Approved</div>
                </div>
                <div className="p-4 border border-[var(--border-default)] rounded-lg text-center">
                    <div className="text-2xl font-bold text-[var(--text-headings)]">
                        {data.recommendations?.content_generated || 0}
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mt-1">Content Created</div>
                </div>
                <div className="p-4 border border-[var(--border-default)] rounded-lg text-center">
                    <div className="text-2xl font-bold text-[var(--text-headings)]">
                        {data.recommendations?.implemented || 0}
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mt-1">Implemented</div>
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

    return (
        <div className="bg-white rounded-lg p-6 border border-[var(--border-default)]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg">
                    <IconTrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    Top Movers
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Query Gains */}
                {data.queries?.gains && data.queries.gains.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold text-green-600 mb-3">Top Query Gains (SOA)</h3>
                        <div className="space-y-2">
                            {data.queries.gains.slice(0, 5).map((item: any, index: number) => (
                                <div
                                    key={index}
                                    className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm flex justify-between items-center gap-3"
                                >
                                    <span
                                        className="font-medium text-[var(--text-headings)] flex-1 truncate"
                                        title={item.query_text || item.name}
                                    >
                                        {item.query_text || item.name}
                                    </span>
                                    <span className="font-bold text-green-700 whitespace-nowrap">
                                        +{item.changes?.share_of_answer?.absolute?.toFixed(1) || item.change || 0}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Query Losses */}
                {data.queries?.losses && data.queries.losses.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold text-red-600 mb-3">Top Query Losses (SOA)</h3>
                        <div className="space-y-2">
                            {data.queries.losses.slice(0, 5).map((item: any, index: number) => (
                                <div
                                    key={index}
                                    className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm flex justify-between items-center gap-3"
                                >
                                    <span
                                        className="font-medium text-[var(--text-headings)] flex-1 truncate"
                                        title={item.query_text || item.name}
                                    >
                                        {item.query_text || item.name}
                                    </span>
                                    <span className="font-bold text-red-700 whitespace-nowrap">
                                        {item.changes?.share_of_answer?.absolute?.toFixed(1) || item.change || 0}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Citation Sources and Topics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Top Citation Sources */}
                {data.sources?.gains && data.sources.gains.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold text-purple-600 mb-3">Top Citation Sources (Impact)</h3>
                        <div className="space-y-2">
                            {data.sources.gains.slice(0, 3).map((item: any, index: number) => (
                                <div
                                    key={index}
                                    className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm flex justify-between items-center"
                                >
                                    <span className="font-medium text-[var(--text-headings)] truncate max-w-[200px]" title={item.name}>
                                        {item.name}
                                    </span>
                                    <span className="font-bold text-purple-700">
                                        {item.changes?.impact_score?.absolute || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Topics */}
                {data.topics?.gains && data.topics.gains.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold text-blue-600 mb-3">Top Topics (Combined Score)</h3>
                        <div className="space-y-2">
                            {data.topics.gains.slice(0, 3).map((item: any, index: number) => (
                                <div
                                    key={index}
                                    className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm flex justify-between items-center"
                                >
                                    <span className="font-medium text-[var(--text-headings)]">{item.name}</span>
                                    <span className="font-bold text-blue-700">
                                        {item.changes?.combined_score?.absolute?.toFixed(2) || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
