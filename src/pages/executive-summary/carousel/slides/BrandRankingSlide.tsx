import React, { useState, useMemo } from 'react';
import { useDashboardData } from '../../../dashboard/hooks/useDashboardData';
import { useManualBrandDashboard } from '../../../../manual-dashboard';
import { RankingRow } from './components/RankingRow';
import { RankingDetailsModal, RankingDetailItem } from './components/RankingDetailsModal';
import { RankingSidePanel } from './components/RankingSidePanel';
import { Loader2, AlertTriangle, ExternalLink, Info, HelpCircle, CheckCircle2 } from 'lucide-react';
import { SafeLogo } from '../../../../components/Onboarding/common/SafeLogo';

export const BrandRankingSlide: React.FC = () => {
    const { dashboardData, dashboardLoading } = useDashboardData();
    const { selectedBrand } = useManualBrandDashboard();
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [sidePanelOpen, setSidePanelOpen] = useState(false);
    const [activeHelpKpi, setActiveHelpKpi] = useState<{ title: string; desc: string; details: string[] } | null>(null);

    // --- Data Processing & Rank Calculation ---
    const rankings = useMemo(() => {
        if (!dashboardData) return null;

        const { brandSummary, competitorVisibility } = dashboardData;

        // Helper to get value
        const getVal = (source: any, kpi: 'visibility' | 'share' | 'sentiment' | 'brandPresence') => {
            if (!source) return 0;
            switch (kpi) {
                case 'visibility':
                    return source.visibility || 0;
                case 'share':
                    let shareVal = source.share || 0;
                    // Fix: Check if it is already percentage (e.g. > 1) or decimal (<= 1)
                    // If it's effectively 0, treat as 0. 
                    if (shareVal > 0 && shareVal <= 1) {
                        shareVal *= 100;
                    }
                    return shareVal;
                case 'sentiment':
                    return source.sentiment || 0;
                case 'brandPresence':
                    return source.brandPresencePercentage || 0;
                default:
                    return 0;
            }
        };

        // Calculate Rank for a KPI
        const calculateRank = (kpi: 'visibility' | 'share' | 'sentiment' | 'brandPresence') => {
            const brandVal = getVal(brandSummary, kpi);
            let betterCount = 0;
            let totalCompVal = 0;
            let compCount = 0;

            competitorVisibility?.forEach(comp => {
                const compVal = getVal(comp, kpi);
                if (compVal > brandVal) betterCount++;
                if (compVal > 0) { // Only count valid data for avg
                    totalCompVal += compVal;
                    compCount++;
                }
            });

            return {
                rank: 1 + betterCount,
                brandVal,
                compAvg: compCount > 0 ? totalCompVal / compCount : 0
            };
        };

        return {
            visibility: calculateRank('visibility'),
            share: calculateRank('share'),
            sentiment: calculateRank('sentiment'),
            presence: calculateRank('brandPresence')
        };
    }, [dashboardData]);


    const kpiDefinitions = {
        presence: {
            title: 'Brand Presence',
            desc: 'The percentage of total queries where your brand is mentioned at all.',
            details: [
                'Measures pure establishment in the LLM ecosystem.',
                'A query counts as "present" if your brand appears anywhere in the response.',
                'Low scores indicate invisibility for your target keywords.'
            ],
            unit: '%',
            target: { value: 50, operator: '>' as const, label: '> 50%' }
        },
        visibility: {
            title: 'Visibility Score',
            desc: 'A weighted score of how prominent your brand is in LLM answers based on frequency and ranking position.',
            details: [
                'Higher rank in the LLM list (e.g. #1 vs #5) increases this score.',
                'Frequency of mentions boosts this score.',
                'The most comprehensive metric for "Share of Shelf".'
            ],
            unit: '',
            target: { value: 30, operator: '>' as const, label: '> 30' }
        },
        share: {
            title: 'Share of Answer',
            desc: 'The percentage of times your brand appears compared to your direct competitors.',
            details: [
                'Calculated relative to the competitor set you are tracking.',
                'Shows if you are dominating the conversation vs your rivals.',
                '100% means you appear as often as all competitors combined (dominance).'
            ],
            unit: '%',
            target: { value: 10, operator: '>' as const, label: '> 10%' }
        },
        sentiment: {
            title: 'Sentiment Score',
            desc: 'The qualitative tone of the answers cited by LLMs regarding your brand (1-100).',
            details: [
                'Analyzes adjectives and context around your brand mentions.',
                'Scores < 50 indicate negative perception.',
                'Scores > 80 indicate strong advocacy and trust.'
            ],
            unit: '',
            target: { value: 70, operator: '>' as const, label: '> 70' }
        }
    };

    const handleOpenHelp = (key: 'presence' | 'visibility' | 'share' | 'sentiment') => {
        setActiveHelpKpi(kpiDefinitions[key]);
        setSidePanelOpen(true);
    };

    const getAllDetails = (): RankingDetailItem[] => {
        if (!rankings) return [];

        const getStatus = (val: number, target: number) => {
            if (val >= target) return 'green';
            if (val >= target * 0.7) return 'yellow';
            return 'red';
        };

        const rows = [
            { key: 'presence', ...kpiDefinitions.presence, stats: rankings.presence },
            { key: 'visibility', ...kpiDefinitions.visibility, stats: rankings.visibility },
            { key: 'share', ...kpiDefinitions.share, stats: rankings.share },
            { key: 'sentiment', ...kpiDefinitions.sentiment, stats: rankings.sentiment },
        ];

        return rows.map(r => ({
            kpi: r.title,
            target: r.target,
            avg: r.stats.brandVal,
            status: getStatus(r.stats.brandVal, r.target.value),
            rank: r.stats.rank,
            compAvg: r.stats.compAvg,
            unit: r.unit
        }));
    };


    if (dashboardLoading && !dashboardData) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
    }

    if (!rankings) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <AlertTriangle className="w-10 h-10 mb-2 opacity-50" />
                <p>Ranking data unavailable.</p>
            </div>
        );
    }

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

    return (
        <div className="h-full flex flex-col relative overflow-hidden">
            {/* Header with Title and Logo */}
            <div className="flex justify-between items-center mb-6 px-4 pt-2">
                <h2 className="text-2xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
                    Insights - Brand Ranking
                </h2>
                {selectedBrand && (
                    <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                        <div className="w-8 h-8 flex items-center justify-center">
                            <BrandLogo />
                        </div>
                        <span className="font-semibold text-gray-700">{selectedBrand.name}</span>
                    </div>
                )}
            </div>

            {/* List - Constrained Width to avoid Arrows */}
            {/* Added px-12 to ensure arrows (absolute positioned) don't overlap content */}
            <div className="flex-1 space-y-4 overflow-y-auto px-12 pb-20">
                <div
                    onClick={() => handleOpenHelp('presence')}
                    className="cursor-pointer"
                >
                    <RankingRow
                        rank={rankings.presence.rank}
                        kpiName="Brand Presence"
                        kpiDefinition="Frequency your brand is mentioned across all AI responses."
                        color="#4f46e5"
                    />
                </div>
                <div
                    onClick={() => handleOpenHelp('visibility')}
                    className="cursor-pointer"
                >
                    <RankingRow
                        rank={rankings.visibility.rank}
                        kpiName="Brand Visibility"
                        kpiDefinition="Combined score of mention frequency and ranking position."
                        color="#3b82f6"
                    />
                </div>
                <div
                    onClick={() => handleOpenHelp('share')}
                    className="cursor-pointer"
                >
                    <RankingRow
                        rank={rankings.share.rank}
                        kpiName="Share of Answer"
                        kpiDefinition="Your brand's share of voice compared to direct competitors."
                        color="#10b981"
                    />
                </div>
                <div
                    onClick={() => handleOpenHelp('sentiment')}
                    className="cursor-pointer"
                >
                    <RankingRow
                        rank={rankings.sentiment.rank}
                        kpiName="Brand Sentiment"
                        kpiDefinition="Average tone of AI mentions (1-100 scale)."
                        color="#f59e0b"
                    />
                </div>
            </div>

            {/* Consolidated Details Link at Bottom */}
            <div className="absolute bottom-0 left-0 right-0 py-6 bg-gradient-to-t from-white via-white to-transparent flex justify-center z-10 pointer-events-none">
                <button
                    onClick={() => setDetailsModalOpen(true)}
                    className="pointer-events-auto flex items-center space-x-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-full transition-all shadow-lg hover:shadow-xl active:scale-95 transform hover:-translate-y-0.5"
                >
                    <Info className="w-4 h-4" />
                    <span>View Complete Ranking Details</span>
                    <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                </button>
            </div>

            {/* Side Panel for Education */}
            <RankingSidePanel
                isOpen={sidePanelOpen}
                onClose={() => setSidePanelOpen(false)}
                title={activeHelpKpi?.title || ''}
                description={activeHelpKpi?.desc || ''}
            >
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center">
                        <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                        Understanding this Metric
                    </h4>
                    <ul className="space-y-3">
                        {activeHelpKpi?.details.map((detail, idx) => (
                            <li key={idx} className="flex items-start text-sm text-gray-700 bg-blue-50/50 p-3 rounded-lg border border-blue-50">
                                <CheckCircle2 className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                                {detail}
                            </li>
                        ))}
                    </ul>
                </div>
            </RankingSidePanel>

            {/* Modal */}
            <RankingDetailsModal
                isOpen={detailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                title="Brand Performance Rankings"
                description="Detailed breakdown of your brand's standing across all key metrics compared to competitors."
                data={getAllDetails()}
                headerContent={
                    selectedBrand && (
                        <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center p-1">
                            <BrandLogo size={32} />
                        </div>
                    )
                }
            />
        </div>
    );
};
