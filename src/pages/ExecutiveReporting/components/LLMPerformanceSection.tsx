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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(data.by_llm).map(([llmName, metrics]: [string, any]) => (
                    <div key={llmName} className="p-4 border border-[var(--border-default)] rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <SafeLogo
                                domain={getLLMDomain(llmName)}
                                alt={llmName}
                                size={32}
                                className="w-8 h-8 object-contain rounded-full bg-gray-50 p-1 border border-gray-100"
                            />
                            <div className="font-semibold text-[var(--text-headings)]">{llmName}</div>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-[var(--text-muted)]">Visibility:</span>
                                <span className="font-medium">{metrics.visibility?.toFixed(1) || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--text-muted)]">Avg Position:</span>
                                <span className="font-medium">{metrics.average_position?.toFixed(1) || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--text-muted)]">SOA:</span>
                                <span className="font-medium">{metrics.share_of_answer?.toFixed(1) || 'N/A'}%</span>
                            </div>
                        </div>
                    </div>
                ))}
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
                                    {comp.visibility?.toFixed(1) || '0.0'}
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    {comp.share_of_answer?.toFixed(1) || '0.0'}%
                                </td>
                                <td className="py-3 px-4 text-sm text-right">
                                    <span className={`
                                        ${(comp.sentiment || 0) > 0 ? 'text-green-600' : (comp.sentiment || 0) < 0 ? 'text-red-600' : 'text-gray-500'}
                                    `}>
                                        {(comp.sentiment || 0).toFixed(1)}
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

            <div className="flex items-center gap-8 mb-6">
                <div>
                    <div className="text-sm text-[var(--text-muted)] mb-1">Overall Score</div>
                    <div className="text-4xl font-bold text-[var(--text-headings)]">
                        {data.overall_score?.toFixed(0) || 0}
                        <span className="text-xl text-[var(--text-muted)]">/100</span>
                    </div>
                </div>
                <div>
                    <span
                        className={`text-sm font-semibold ${data.score_delta?.percentage > 0
                            ? 'text-green-600'
                            : data.score_delta?.percentage < 0
                                ? 'text-red-600'
                                : 'text-[var(--text-muted)]'
                            }`}
                    >
                        {data.score_delta?.percentage > 0 ? '+' : ''}
                        {data.score_delta?.percentage?.toFixed(1) || 0}% vs previous
                    </span>
                </div>
            </div>

            {/* KPI Cards */}
            {data.sub_scores && Object.keys(data.sub_scores).length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {Object.entries(data.sub_scores).map(([key, item]: [string, any]) => (
                        <div key={key} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                            <div className="text-xs text-gray-500 uppercase font-medium mb-1">{item.label}</div>
                            <div className={`text-lg font-bold ${item.score >= 80 ? 'text-green-600' :
                                item.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                {item.score?.toFixed(0) || 0}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {data.key_deficiencies && data.key_deficiencies.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-[var(--text-headings)] mb-3">
                        Key Deficiencies
                    </h3>
                    <div className="space-y-2">
                        {data.key_deficiencies.slice(0, 5).map((def: any, index: number) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg"
                            >
                                <div
                                    className={`px-2 py-1 rounded text-xs font-semibold ${def.severity === 'critical'
                                        ? 'bg-red-100 text-red-700'
                                        : def.severity === 'high'
                                            ? 'bg-orange-100 text-orange-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                        }`}
                                >
                                    {def.severity}
                                </div>
                                <div className="flex-1 text-sm text-[var(--text-body)]">
                                    <span className="font-medium">{def.category}:</span> {def.description}
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
                                    className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm flex justify-between items-center"
                                >
                                    <span className="font-medium text-[var(--text-headings)]">{item.name}</span>
                                    <span className="font-bold text-green-700">
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
                                    className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm flex justify-between items-center"
                                >
                                    <span className="font-medium text-[var(--text-headings)]">{item.name}</span>
                                    <span className="font-bold text-red-700">
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
