/**
 * Placeholder components for remaining Executive Reporting sections
 * These provide basic functionality and can be enhanced later
 */

import { IconRobot, IconUsers, IconShieldCheck, IconBolt, IconTrendingUp } from '@tabler/icons-react';

// LLM Performance Section
// Map LLM names to logo URLs (using Clearbit or static assets where possible)
const getLLMLogo = (llmName: string) => {
    const normalize = llmName.toLowerCase();
    if (normalize.includes('chatgpt')) return 'https://logo.clearbit.com/openai.com';
    if (normalize.includes('gemini')) return 'https://logo.clearbit.com/google.com';
    if (normalize.includes('bard')) return 'https://logo.clearbit.com/google.com';
    if (normalize.includes('claude')) return 'https://logo.clearbit.com/anthropic.com';
    if (normalize.includes('perplexity')) return 'https://logo.clearbit.com/perplexity.ai';
    if (normalize.includes('bing')) return 'https://logo.clearbit.com/bing.com';
    if (normalize.includes('meta') || normalize.includes('llama')) return 'https://logo.clearbit.com/meta.com';
    return null;
};

const getDomain = (url: string) => {
    try {
        if (!url) return '';
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        return urlObj.hostname;
    } catch {
        return '';
    }
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
                {Object.entries(data.by_llm).map(([llmName, metrics]: [string, any]) => {
                    const logoUrl = getLLMLogo(llmName);

                    return (
                        <div key={llmName} className="p-4 border border-[var(--border-default)] rounded-lg hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-3">
                                {logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt={`${llmName} logo`}
                                        className="w-8 h-8 object-contain rounded-full bg-gray-50 p-1 border border-gray-100"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs">
                                        {llmName.substring(0, 2).toUpperCase()}
                                    </div>
                                )}
                                {/* Fallback icon if image fails */}
                                <div className="hidden w-8 h-8 rounded-full bg-purple-100 items-center justify-center text-purple-600 font-bold text-xs">
                                    {llmName.substring(0, 2).toUpperCase()}
                                </div>
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
                    );
                })}
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
                        {data.competitors.map((comp: any, index: number) => {
                            const domain = getDomain(comp.website_url);
                            // Use logo.clearbit.com for logos, fallback to generic
                            const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : null;

                            return (
                                <tr key={index} className="border-b border-[var(--border-default)] hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-4 text-sm font-medium">
                                        <div className="flex items-center gap-3">
                                            {logoUrl ? (
                                                <img
                                                    src={logoUrl}
                                                    alt={`${comp.name} logo`}
                                                    className="w-6 h-6 object-contain rounded-full bg-white border border-gray-100"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                    }}
                                                />
                                            ) : (
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${comp.is_brand ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
                                                    {comp.name.substring(0, 1)}
                                                </div>
                                            )}
                                            {/* Fallback icon */}
                                            <div className={`hidden w-6 h-6 rounded-full items-center justify-center text-xs font-bold ${comp.is_brand ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
                                                {comp.name.substring(0, 1)}
                                            </div>

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
                            );
                        })}
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
        </div>
    );
};
