import React from 'react';
import { RecommendationV3 } from '../../../api/recommendationsV3Api';
import { IconClock, IconBolt, IconTarget, IconArrowUpRight, IconUsers } from '@tabler/icons-react';
import { SafeLogo } from '../../Onboarding/common/SafeLogo';

interface OpportunityStrategyCardProps {
    recommendation: RecommendationV3;
}

export const OpportunityStrategyCard: React.FC<OpportunityStrategyCardProps> = ({ recommendation }) => {
    // Helper to get color for Focus Area
    const getFocusAreaColor = (area: string) => {
        switch (area?.toLowerCase()) {
            case 'visibility': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'soa': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'sentiment': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Helper to get color for Effort
    const getEffortColor = (effort: string) => {
        switch (effort?.toLowerCase()) {
            case 'high': return 'bg-red-100 text-red-700 border-red-200';
            case 'medium': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'low': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Helper to parse Impact/Expected Boost
    const renderImpact = () => {
        const rawImpact = recommendation.expectedBoost || recommendation.impactScore;

        // Default fallback
        if (!rawImpact) {
            return (
                <div className="flex items-center gap-1 text-sm font-bold text-green-600">
                    <IconTarget size={16} className="text-green-500" />
                    +15% Visibility
                </div>
            );
        }

        // Try to parse if it looks like JSON
        if (typeof rawImpact === 'string' && rawImpact.trim().startsWith('{')) {
            try {
                const impactObj = JSON.parse(rawImpact);
                // Render keys as a clean horizontal list
                return (
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(impactObj).map(([key, val]) => (
                            <span key={key} className="text-[11px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                {`${val} ${key.replace('SOA', 'SoA')}`}
                            </span>
                        ))}
                    </div>
                );
            } catch (e) {
                // Fallback if parse fails
                return <span className="text-sm font-bold text-green-600">{rawImpact}</span>;
            }
        }

        // Regular string/number
        return (
            <div className="flex items-center gap-1 text-sm font-bold text-green-600">
                <IconTarget size={16} className="text-green-500" />
                {rawImpact && !String(rawImpact).includes('%')
                    ? `+${Math.round(Number(rawImpact))}% ${recommendation.focusArea?.toUpperCase() || ''}`
                    : rawImpact}
            </div>
        );
    };

    // Helper for Confidence
    const renderConfidence = () => {
        const rawVal = recommendation.confidence || 0.85;
        // If value is <= 1 (e.g. 0.85), multiply by 100. If > 1 (e.g. 85), use as is.
        const displayVal = rawVal <= 1 ? Math.round(rawVal * 100) : Math.round(rawVal);

        return (
            <span className="text-lg font-bold text-green-600">
                {displayVal}%
            </span>
        );
    };

    // Derive "Title" from action or specific field
    const title = recommendation.contentFocus || recommendation.action;

    return (
        <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm my-4 mx-4">
            {/* 1. Header Section */}
            <div className="flex justify-between items-start mb-6">
                <div className="max-w-[80%]">
                    <h2 className="text-xl font-bold text-gray-900 leading-tight mb-2">
                        {title}
                    </h2>
                    {/* Subbuffer removed per user request */}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${recommendation.reviewStatus === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                        recommendation.reviewStatus === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                            'bg-orange-100 text-orange-800 border-orange-200' /* Pending */
                        }`}>
                        {recommendation.reviewStatus === 'approved' ? 'Approved' :
                            recommendation.reviewStatus === 'rejected' ? 'Rejected' : 'Pending'}
                    </span>
                </div>
            </div>

            {/* 2. Strategy Sections (Moved Above Table) */}
            <div className="space-y-6 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <IconBolt size={14} className="text-gray-400" />
                        <h4 className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Why This Matters</h4>
                    </div>

                    <p className="text-sm text-gray-700 leading-relaxed pl-6 border-l-2 border-gray-100">
                        {recommendation.reason || recommendation.explanation || "This recommendation addresses a key gap in your current brand strategy, targeting high-value queries where competitors currently dominate."}
                    </p>
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <IconTarget size={14} className="text-gray-400" />
                        <h4 className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Cross-Channel Strategy</h4>
                    </div>

                    <p className="text-sm text-gray-700 leading-relaxed pl-6 border-l-2 border-gray-100">
                        {/* Placeholder for now as this field might not be in API yet */}
                        Create a LinkedIn carousel summarizing key stats from the {recommendation.assetType?.toLowerCase() || 'content'} with a call-to-action.
                        Use targeted email newsletters to existing subscribers highlighting exclusive insights.
                    </p>
                </div>

                {/* Target Competitors Section */}
                {recommendation.competitors_target && recommendation.competitors_target.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <IconUsers size={14} className="text-gray-400" />
                            <h4 className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Target Competitors</h4>
                        </div>
                        <div className="flex flex-wrap gap-3 pl-6 border-l-2 border-gray-100">
                            {recommendation.competitors_target.map((competitor) => {
                                const name = typeof competitor === 'string' ? competitor : competitor.name;
                                const domain = typeof competitor === 'string' ? competitor : (competitor.domain || competitor.name);
                                const logo = typeof competitor === 'string' ? undefined : (competitor.logo || undefined);

                                return (
                                    <div key={name} className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                                        <SafeLogo
                                            domain={domain}
                                            src={logo}
                                            alt={name}
                                            className="w-5 h-5 rounded-full object-contain bg-white"
                                            size={20}
                                        />
                                        <span className="text-xs font-medium text-gray-700">{name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Data Table Section */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Row 1 */}
                <div className="flex border-b border-gray-200 bg-white">
                    <div className="flex-1 p-3 border-r border-gray-200 last:border-r-0">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Focus Area</p>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getFocusAreaColor(recommendation.focusArea)}`}>
                            {recommendation.focusArea === 'soa' ? 'Share of Answers' :
                                recommendation.focusArea?.charAt(0).toUpperCase() + recommendation.focusArea?.slice(1)}
                        </span>
                    </div>
                    <div className="flex-1 p-3 border-r border-gray-200 last:border-r-0">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Content Type</p>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            {formatAssetType(recommendation.assetType)}
                        </span>
                    </div>
                    <div className="flex-1 p-3 border-r border-gray-200 last:border-r-0">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Confidence</p>
                        {renderConfidence()}
                    </div>
                </div>

                {/* Row 2 */}
                <div className="flex bg-white">
                    <div className="flex-1 p-3 border-r border-gray-200 last:border-r-0">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Timeline</p>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <IconClock size={16} className="text-gray-400" />
                            {recommendation.timeline || '2-3 Weeks'}
                        </div>
                    </div>
                    <div className="flex-1 p-3 border-r border-gray-200 last:border-r-0">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Effort</p>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getEffortColor(recommendation.effort)}`}>
                            {recommendation.effort}
                        </span>
                    </div>
                    <div className="flex-1 p-3 border-r border-gray-200 last:border-r-0">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Impact</p>
                        {renderImpact()}
                    </div>
                </div>
            </div>
        </div>
    );
};

const formatAssetType = (type?: string): string => {
    if (!type) return 'Article';
    return type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};
