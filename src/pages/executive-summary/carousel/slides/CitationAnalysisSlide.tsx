import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink, Globe } from 'lucide-react';
import { SafeLogo } from '../../../../components/Onboarding/common/SafeLogo';
import { useExecutiveSummary } from '@/hooks/useExecutiveSummary';
import { useManualBrandDashboard } from '../../../../manual-dashboard';
import { CitationSourceStat } from '../../../../types/executive-summary';
import { CitationSourcesTableModal } from './components/CitationSourcesTableModal';

const getSentimentColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-100';
    return 'text-red-600 bg-red-50 border-red-100';
};

const getSentimentLabel = (score: number) => {
    if (score >= 80) return 'Positive';
    if (score >= 60) return 'Neutral';
    if (score >= 40) return 'Mixed';
    return 'Negative';
};

export const CitationAnalysisSlide: React.FC = () => {
    const { data: summaryData, isLoading } = useExecutiveSummary();
    const { selectedBrand } = useManualBrandDashboard();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Mock data if loading or missing (optional, but good for stability during dev)
    const sources = summaryData?.data?.topCitationSources || [];

    // Logo Component
    const BrandLogo = ({ size = 32, className = '' }: { size?: number, className?: string }) => selectedBrand ? (
        <SafeLogo
            src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
            domain={selectedBrand.homepage_url || undefined}
            alt={selectedBrand.name}
            size={size}
            className={`object-contain rounded ${className}`}
        />
    ) : null;


    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Globe className="w-6 h-6 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Top Citation Sources</h2>
                    </div>
                    <p className="text-gray-600 max-w-3xl">
                        These are the most influential sources where your brand is cited across AI-generated answers.
                        High citation volume often correlates with higher visibility and authority.
                    </p>
                </div>
                {selectedBrand && (
                    <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                        <div className="w-8 h-8 flex items-center justify-center">
                            <BrandLogo />
                        </div>
                        <span className="font-semibold text-gray-700">{selectedBrand.name}</span>
                    </div>
                )}
            </div>

            {/* Content: Table/Grid */}
            <div className="flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-1 text-center">Rank</div>
                    <div className="col-span-4">Source</div>
                    <div className="col-span-2 text-right pointer-events-none group relative flex items-center justify-end gap-1">
                        % Citations
                    </div>
                    <div className="col-span-2 text-center">Sentiment</div>
                    <div className="col-span-3 text-right pr-4">Metric Avg</div>
                </div>

                {/* Table Body */}
                <div className="overflow-y-auto flex-1 p-2">
                    {sources.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <p>No citation data available for this period.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sources.map((source: CitationSourceStat, index: number) => (
                                <motion.div
                                    key={source.name}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="grid grid-cols-12 gap-4 items-center p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                                >
                                    {/* Rank */}
                                    <div className="col-span-1 flex justify-center">
                                        <div className={`
                                            w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                                            ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                index === 1 ? 'bg-gray-100 text-gray-700' :
                                                    index === 2 ? 'bg-orange-100 text-orange-800' :
                                                        'text-gray-500'}
                                        `}>
                                            {index + 1}
                                        </div>
                                    </div>

                                    {/* Source Info */}
                                    <div className="col-span-4 flex items-center gap-3 overflow-hidden">
                                        <SafeLogo
                                            src="" // Logo service handles domain fallback
                                            domain={source.url || source.name}
                                            alt={source.name}
                                            size={32}
                                            className="w-8 h-8 rounded bg-white shadow-sm border border-gray-100 shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <div className="font-semibold text-gray-900 truncate">
                                                {source.name}
                                            </div>
                                            <a
                                                href={source.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs text-gray-400 hover:text-blue-500 truncate flex items-center gap-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {new URL(source.url || 'https://' + source.name).hostname}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>

                                    {/* % Citations */}
                                    <div className="col-span-2 flex flex-col justify-center items-end">
                                        <span className="text-sm font-bold text-gray-900">
                                            {source.percentCitations}%
                                        </span>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full"
                                                style={{ width: `${source.percentCitations}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Sentiment */}
                                    <div className="col-span-2 flex justify-center">
                                        <span className={`
                                            px-2.5 py-1 rounded-full text-xs font-medium border
                                            ${getSentimentColor(source.sentiment)}
                                        `}>
                                            {getSentimentLabel(source.sentiment)}
                                        </span>
                                    </div>

                                    {/* Metrics (SoA & Mention) */}
                                    <div className="col-span-3 flex justify-end items-center gap-4 pr-4">
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500">SoA</div>
                                            <div className="font-semibold text-gray-900">{source.soa}%</div>
                                        </div>
                                        <div className="w-px h-8 bg-gray-200" />
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500">Mentions</div>
                                            <div className="font-semibold text-gray-900">{source.mentionRate}%</div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group flex items-center gap-2 px-4 py-2 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 font-medium rounded-lg border border-gray-200 hover:border-blue-200 transition-all shadow-sm"
                    >
                        View Full Analysis
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>

            <CitationSourcesTableModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
};
