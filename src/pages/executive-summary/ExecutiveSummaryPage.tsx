import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiClient } from '../../lib/apiClient';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { ExecutiveSummaryResponse, TopicGapStat, Opportunity } from '../../types/executive-summary'; // Will define CompetitorInsight locally for now or update types file
import { Loader2, AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Target, Zap, Sparkles, Activity, ChevronRight, Info, ShieldAlert, BrainCircuit, Lightbulb, UserX, BarChart2, Calendar } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { getLatestGenerationV3, RecommendationV3 } from '../../api/recommendationsV3Api';

interface CompetitorInsight {
    competitorName: string;
    totalGaps: number;
    metrics: {
        soa: { gapCount: number; percentage: number };
        sentiment: { gapCount: number; percentage: number };
        visibility: { gapCount: number; percentage: number };
    };
    primaryWeakness: string;
    opportunities: Opportunity[];
}

interface ExecutiveSummarySection {
    headline: string;
    summary?: string;
    items?: string[];
}

interface ExecutiveNarrative {
    overview: ExecutiveSummarySection;
    defenseGap: ExecutiveSummarySection;
    thematicRisks: ExecutiveSummarySection;
    actions: ExecutiveSummarySection;
}

export const ExecutiveSummaryPage: React.FC = () => {
    const { selectedBrandId } = useManualBrandDashboard();
    const [stats, setStats] = useState<ExecutiveSummaryResponse['data'] | null>(null);
    const [narrative, setNarrative] = useState<ExecutiveNarrative | string | null>(null);
    const [generatedAt, setGeneratedAt] = useState<string | null>(null);
    const [loadingStats, setLoadingStats] = useState<boolean>(true);
    const [generatingReport, setGeneratingReport] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

    // Recommendations State
    const [recommendations, setRecommendations] = useState<RecommendationV3[]>([]);
    const [selectedCompetitorForRecs, setSelectedCompetitorForRecs] = useState<string | null>(null);

    // 1. Load Stats and Recommendations on Mount
    useEffect(() => {
        const fetchData = async () => {
            if (!selectedBrandId) return;

            setLoadingStats(true);
            try {
                // Fetch Stats
                const response = await apiClient.get<{ data: ExecutiveSummaryResponse['data'], meta: any, narrative?: ExecutiveNarrative | string }>(`/brands/${selectedBrandId}/executive-summary?days=7`);
                setStats(response.data);
                if (response.narrative) {
                    setNarrative(response.narrative);
                    setGeneratedAt(response.meta.generatedAt);
                }

                // Fetch Recommendations (Parallel-ish but inside safe block)
                try {
                    const recResponse = await getLatestGenerationV3(selectedBrandId);
                    if (recResponse.success && recResponse.data?.recommendations) {
                        setRecommendations(recResponse.data.recommendations);
                    }
                } catch (recErr) {
                    console.warn("Failed to load recommendations:", recErr);
                }

            } catch (err: any) {
                console.error("[ExecutiveSummary] Stats Fetch failed:", err);
                setError("Failed to load Executive Summary data.");
            } finally {
                setLoadingStats(false);
            }
        };
        fetchData();
    }, [selectedBrandId]);

    // 2. Generate Narrative on Button Click
    const handleGenerate = async () => {
        if (!selectedBrandId) return;
        try {
            setGeneratingReport(true);
            const response = await apiClient.post<{ text: ExecutiveNarrative | string, generatedAt: string }>(`/brands/${selectedBrandId}/executive-summary/generate`, { days: 7 });
            setNarrative(response.text);
            setGeneratedAt(response.generatedAt);
        } catch (err: any) {
            console.error("[ExecutiveSummary] Generation failed:", err);
            setError("Failed to generate report. Please try again.");
        } finally {
            setGeneratingReport(false);
        }
    };

    if (!selectedBrandId) return <Layout><div className="p-8">Please select a brand.</div></Layout>;

    // Calculate Health Color
    const getHealthColor = (score: number) => {
        if (score > 80) return 'text-green-600 bg-green-50 border-green-200';
        if (score > 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    return (
        <Layout>
            <div className="p-6 max-w-7xl mx-auto space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Executive Strategy</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            AI-Powered Strategic Analysis
                            {stats?.dateRange && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {new Date(stats.dateRange.start).toLocaleDateString()} - {new Date(stats.dateRange.end).toLocaleDateString()}
                                </span>
                            )}
                        </p>
                    </div>

                    {!loadingStats && stats && (
                        <button
                            onClick={handleGenerate}
                            disabled={generatingReport}
                            className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-medium transition-colors ${generatingReport
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                }`}
                        >
                            {generatingReport ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Analyzing Strategy...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>Generate Exec Summary</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {loadingStats ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>
                ) : error ? (
                    <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-100">{error}</div>
                ) : stats ? (
                    <>
                        {/* 1. High-Level Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Health Score */}
                            <div
                                onClick={() => setIsHealthModalOpen(true)}
                                className={`p-6 rounded-xl border ${getHealthColor(stats.volumeContext.healthScore)} flex items-center justify-between cursor-pointer hover:shadow-md transition-all group`}
                                title="Click to analyze health score details"
                            >
                                <div>
                                    <div className="text-sm font-semibold uppercase tracking-wide opacity-80 flex items-center">
                                        Global Health
                                        <Info className="w-3.5 h-3.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="text-3xl font-bold mt-1">{stats.volumeContext.healthScore}/100</div>
                                </div>
                                <Activity className="w-8 h-8 opacity-50 group-hover:scale-110 transition-transform" />
                            </div>

                            {/* Gap Impact */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Impact Scope</div>
                                    <div className="text-3xl font-bold text-gray-900 mt-1">{stats.volumeContext.gapPercentage}%</div>
                                    <div className="text-xs text-gray-400 mt-1">of queries have gaps</div>
                                </div>
                                <Target className="w-8 h-8 text-blue-100 text-blue-500" />
                            </div>

                            {/* Critical Severity */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <div className="flex items-center space-x-2 mb-1">
                                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Critical Risk</div>
                                        <div className="group relative">
                                            <Info className="w-4 h-4 text-gray-400 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none">
                                                Percentage of queries where your brand is either invisible/unmentioned OR has specific negative sentiment issues.
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">{stats.volumeContext.criticalPercentage}%</div>
                                    <div className="text-xs text-gray-400 mt-1">queries in critical state</div>
                                </div>
                                <AlertTriangle className="w-8 h-8 text-orange-100 text-orange-500" />
                            </div>
                        </div>

                        {/* 2. Narrative Section (Conditional) */}
                        {narrative ? (
                            typeof narrative === 'string' ? (
                                // Legacy Markdown Support
                                <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-blue-50 to-white px-8 py-4 border-b border-blue-100 flex justify-between items-center">
                                        <div className="flex items-center space-x-2">
                                            <Sparkles className="w-5 h-5 text-blue-600" />
                                            <h2 className="text-lg font-bold text-gray-900">Strategic Analysis</h2>
                                        </div>
                                        <span className="text-xs text-gray-400">Generated: {new Date(generatedAt || '').toLocaleDateString()}</span>
                                    </div>
                                    <div className="p-8 prose prose-blue max-w-none prose-headings:font-bold prose-h3:text-gray-800 prose-p:text-gray-600 prose-li:text-gray-600">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {narrative}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ) : (
                                // New Structured UI
                                <div className="space-y-6">
                                    <ExecutiveOverviewCard data={narrative.overview} />

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <DefenseGapCard data={narrative.defenseGap} />
                                        <ThematicRisksCard data={narrative.thematicRisks} />
                                        <StrategicActionsCard data={narrative.actions} />
                                    </div>

                                    <div className="flex justify-end text-xs text-gray-400 mt-2">
                                        Generated: {new Date(generatedAt || '').toLocaleDateString()}
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Sparkles className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Generate Your Strategy Report</h3>
                                <p className="text-gray-500 max-w-md mx-auto mt-2 mb-6">
                                    Unlock usage of our advanced LLM to analyze your performance gaps and write a personalized executive summary.
                                </p>
                                <button
                                    onClick={handleGenerate}
                                    className="inline-flex items-center space-x-2 text-blue-600 font-medium hover:text-blue-800 transition-colors"
                                >
                                    <span>Generate Report Now</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* 3. Competitor Battleground */}
                        <div className="mt-8">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                <Target className="w-5 h-5 mr-2 text-red-500" />
                                Competitor Battleground
                            </h3>
                            <CompetitorBattleground
                                data={stats.competitorInsights}
                                onOpenRecommendations={(compName) => setSelectedCompetitorForRecs(compName)}
                            />
                        </div>

                    </>
                ) : null}
            </div>

            {/* Modal */}
            {stats && (
                <HealthAnalysisModal
                    isOpen={isHealthModalOpen}
                    onClose={() => setIsHealthModalOpen(false)}
                    insights={stats.competitorInsights}
                />
            )}

            {/* Competitor Recommendations Modal */}
            {selectedCompetitorForRecs && (
                <CompetitorRecommendationsModal
                    isOpen={!!selectedCompetitorForRecs}
                    onClose={() => setSelectedCompetitorForRecs(null)}
                    competitorName={selectedCompetitorForRecs}
                    recommendations={recommendations}
                />
            )}
        </Layout>
    );
};

// --- Sub-Components ---

import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';

// New Modal for Competitor Recommendations
const CompetitorRecommendationsModal: React.FC<{ isOpen: boolean; onClose: () => void; competitorName: string; recommendations: RecommendationV3[] }> = ({ isOpen, onClose, competitorName, recommendations }) => {
    const [expandedRecId, setExpandedRecId] = useState<string | null>(null);

    if (!isOpen) return null;

    // Filter Logic: Check if competitor is in the target list OR mentioning it in content
    const filteredRecs = recommendations.filter(rec => {
        // 1. Primary: Check structured target data
        if (rec.competitors_target && rec.competitors_target.length > 0) {
            return rec.competitors_target.some(target => {
                const name = typeof target === 'string' ? target : target.name;
                return name.toLowerCase().includes(competitorName.toLowerCase()) ||
                    competitorName.toLowerCase().includes(name.toLowerCase());
            });
        }

        // 2. Fallback: Search in content content (Action, Reason, Focus)
        const searchContent = `${rec.action || ''} ${rec.reason || ''} ${rec.contentFocus || ''} ${rec.explanation || ''}`.toLowerCase();
        return searchContent.includes(competitorName.toLowerCase());
    });

    const toggleExpand = (id: string) => {
        setExpandedRecId(expandedRecId === id ? null : id);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            ></div>

            {/* Modal Panel */}
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-white">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center">
                            <Target className="w-6 h-6 mr-3 text-red-600" />
                            Strategic Recommendations: {competitorName}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Actionable steps to improve your standing against this competitor.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <UserX className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-0 bg-gray-50/50">
                    {filteredRecs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <Info className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="text-lg font-medium">No specific recommendations found.</p>
                            <p className="text-sm mt-2">Try generating new recommendations in "Improve &gt; Discover".</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 border-t border-gray-100">
                            {filteredRecs.map((rec, index) => {
                                const recId = rec.id || `rec-${index}`;
                                const isExpanded = expandedRecId === recId;

                                return (
                                    <div key={recId} className={`group transition-all duration-200 ${isExpanded ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50'}`}>
                                        {/* Main Row */}
                                        <div
                                            className="p-4 sm:px-6 cursor-pointer flex items-start gap-4"
                                            onClick={() => toggleExpand(recId)}
                                        >
                                            {/* Expand Icon */}
                                            <div className="pt-1 text-gray-400 group-hover:text-blue-500 transition-colors">
                                                {isExpanded ? <ChevronRight className="w-5 h-5 rotate-90 transition-transform" /> : <ChevronRight className="w-5 h-5 transition-transform" />}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    {rec.priority && (
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                                                            ${rec.priority === 'High' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                rec.priority === 'Medium' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                                    'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                            {rec.priority}
                                                        </span>
                                                    )}
                                                    {rec.focusArea && (
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                                                            ${rec.focusArea === 'visibility' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                                rec.focusArea === 'soa' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                                    'bg-teal-50 text-teal-700 border-teal-100'}`}>
                                                            {rec.focusArea}
                                                        </span>
                                                    )}
                                                    {rec.effort && (
                                                        <span className="text-[10px] text-gray-400 font-medium">
                                                            • {rec.effort} Effort
                                                        </span>
                                                    )}
                                                </div>

                                                <h3 className="text-sm font-semibold text-gray-900 leading-snug">
                                                    {rec.action?.replace(/^\[.*?\]\s*/, '') || rec.contentFocus || 'Recommendation Action'}
                                                </h3>
                                            </div>

                                            {/* Source */}
                                            <div className="hidden sm:flex items-center gap-2 max-w-[140px]">
                                                {rec.citationSource && (
                                                    <>
                                                        <div className="w-5 h-5 flex-shrink-0 bg-white border border-gray-200 rounded flex items-center justify-center p-0.5">
                                                            <SafeLogo domain={rec.citationSource} className="w-full h-full object-contain" size={16} alt={rec.citationSource || 'Source'} />
                                                        </div>
                                                        <span className="text-xs text-gray-500 truncate" title={rec.citationSource}>
                                                            {rec.citationSource}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="px-6 pb-6 pl-14 animate-in slide-in-from-top-1 duration-200">
                                                <div className="border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">

                                                    {/* Left: Why it matters */}
                                                    <div className="md:col-span-2 space-y-4">
                                                        {(rec.reason || rec.explanation) && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                                                    <Info className="w-3 h-3 mr-1.5" /> Why This Matters
                                                                </h4>
                                                                <p className="text-sm text-gray-600 leading-relaxed mb-1">
                                                                    {rec.reason}
                                                                </p>
                                                                {rec.explanation && (
                                                                    <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                                                                        {rec.explanation}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {rec.focusSources && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                                                    <BrainCircuit className="w-3 h-3 mr-1.5" /> Strategy
                                                                </h4>
                                                                <p className="text-sm text-gray-600">{rec.focusSources}</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right: Stats & Action */}
                                                    <div className="space-y-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                                                        {rec.expectedBoost && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Expected Impact</h4>
                                                                <div className="text-sm font-semibold text-green-700 flex items-center">
                                                                    <TrendingUp className="w-4 h-4 mr-1.5" />
                                                                    {rec.expectedBoost.includes('{') ? 'High Impact' : rec.expectedBoost}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {rec.confidence && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 flex justify-between">
                                                                    Confidence <span>{rec.confidence}%</span>
                                                                </h4>
                                                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${rec.confidence}%` }}></div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="pt-2">
                                                            <button className="w-full py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center justify-center">
                                                                Apply Strategy
                                                            </button>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CompetitorBattleground: React.FC<{ data: CompetitorInsight[]; onOpenRecommendations: (compName: string) => void }> = ({ data, onOpenRecommendations }) => {
    const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);

    if (!data || data.length === 0) return <div className="text-gray-500 italic">No competitor data availble.</div>;

    const generateNarrative = (comp: CompetitorInsight) => {
        // Find best performing metrics
        const wins = [];
        if (comp.metrics.soa.percentage > 0) wins.push(`SOA scores are better on ${comp.metrics.soa.percentage}% of queries`);
        if (comp.metrics.visibility.percentage > 0) wins.push(`Visibility scores are better on ${comp.metrics.visibility.percentage}% of queries`);
        if (comp.metrics.sentiment.percentage > 0) wins.push(`Sentiment scores are better on ${comp.metrics.sentiment.percentage}% of queries`);

        const comparisonText = wins.length > 0
            ? `${comp.competitorName}'s ${wins.join(', and ')} compared to your brand.`
            : `${comp.competitorName} is currently trailing across major metrics.`;

        // Strategy Logic
        // Defensive if we are losing Visibility (core presence)
        // Offensive if we are losing SOA/Sentiment (need to attack their quality)
        // *User logic seems inverted or variable, let's stick to a robust default*
        // "Brand should launch {offensive/defensive} action plan"
        const isDefensive = comp.metrics.visibility.percentage > 10;
        const actionType = isDefensive ? 'defensive' : 'offensive';
        const focusMetric = comp.primaryWeakness.toUpperCase();

        return (
            <div className="space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-900">{comparisonText}</span>
                    <br />
                    Brand should launch <span className={`font-bold uppercase text-xs px-1.5 py-0.5 rounded ${isDefensive ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{actionType}</span> action plan to improve {focusMetric} against {comp.competitorName}.
                </p>
                <div className="flex flex-col space-y-1">
                    <button className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center group-hover:underline w-fit">
                        Click to view details on queries where Brand lags
                        <ChevronRight className="w-3 h-3 ml-1" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenRecommendations(comp.competitorName);
                        }}
                        className="text-blue-500 hover:text-blue-700 text-xs flex items-center group-hover:underline w-fit"
                    >
                        Click to view recommendations
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {data.map((comp) => (
                <div key={comp.competitorName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200">
                    <div className="p-6 flex flex-col md:flex-row gap-6 cursor-pointer hover:bg-gray-50 group"
                        onClick={() => setExpandedCompetitor(expandedCompetitor === comp.competitorName ? null : comp.competitorName)}>

                        {/* Competitor Icon/Header - Left Column */}
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center border border-red-100">
                                <Target className="w-6 h-6 text-red-500" />
                            </div>
                        </div>

                        {/* Narrative Content - Middle */}
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                {comp.competitorName}
                            </h3>
                            {generateNarrative(comp)}
                        </div>

                        {/* Summary Stats - Right Column */}
                        <div className="flex-shrink-0 flex flex-col items-end justify-center min-w-[100px] border-l border-gray-100 pl-6">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-gray-900">{comp.totalGaps}</div>
                                <div className="text-xs text-gray-500 uppercase font-medium mt-1">Total Gaps</div>
                            </div>
                            <div className={`mt-4 transition-transform duration-300 ${expandedCompetitor === comp.competitorName ? 'rotate-90' : ''}`}>
                                <ChevronRight className="w-5 h-5 text-gray-300" />
                            </div>
                        </div>
                    </div>

                    {/* Drill Down Table */}
                    {expandedCompetitor === comp.competitorName && (
                        <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-in slide-in-from-top-2 duration-200">
                            <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Gap Analysis Details</h4>
                                <span className="text-xs text-gray-500">Displaying top opportunity gaps</span>
                            </div>
                            <CompetitorDetailsTable opportunities={comp.opportunities} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const CompetitorDetailsTable: React.FC<{ opportunities: Opportunity[] }> = ({ opportunities }) => {
    return (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                    <tr>
                        <th className="px-4 py-3 font-medium">Topic</th>
                        <th className="px-4 py-3 font-medium">Query</th>
                        <th className="px-4 py-3 font-medium">KPI Lost</th>
                        <th className="px-4 py-3 text-right font-medium">Gap Delta</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {opportunities.slice(0, 10).map((op) => (
                        <tr key={op.id} className="hover:bg-gray-50/80">
                            <td className="px-4 py-3 text-gray-600">{op.topic || 'General'}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{op.queryText}</td>
                            <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                                    ${op.metricName === 'soa' ? 'bg-purple-50 text-purple-700' :
                                        op.metricName === 'sentiment' ? 'bg-pink-50 text-pink-700' :
                                            'bg-blue-50 text-blue-700'}`}>
                                    {op.metricName}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-red-600">
                                -{op.gap.toFixed(1)}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
                Showing top 10 gaps for this competitor
            </div>
        </div>
    );
};


// --- New Structured UI Components ---

const ExecutiveOverviewCard: React.FC<{ data: ExecutiveSummarySection }> = ({ data }) => {
    return (
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg p-8 text-white mb-8">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center">
                        <Activity className="w-6 h-6 mr-2 opacity-80" />
                        Executive Overview
                    </h2>
                    <h3 className="text-xl font-semibold opacity-90 mb-4">{data.headline}</h3>
                    <p className="text-blue-100 text-lg leading-relaxed max-w-3xl">
                        {data.summary}
                    </p>
                </div>
                <div className="hidden md:block">
                    <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/20">
                        <Sparkles className="w-8 h-8 text-yellow-300" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const DefenseGapCard: React.FC<{ data: ExecutiveSummarySection }> = ({ data }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 h-full flex flex-col">
            <div className="p-5 border-b border-red-50 bg-red-50/30 flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">Defense Gap</h3>
                    <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Competitor Threat</p>
                </div>
            </div>
            <div className="p-6 flex-1">
                <blockquote className="text-sm font-medium text-gray-700 italic border-l-4 border-red-200 pl-4 mb-6">
                    "{data.headline}"
                </blockquote>
                <ul className="space-y-3">
                    {data.items?.map((item, i) => (
                        <li key={i} className="flex items-start text-sm text-gray-600">
                            <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const ThematicRisksCard: React.FC<{ data: ExecutiveSummarySection }> = ({ data }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 h-full flex flex-col">
            <div className="p-5 border-b border-orange-50 bg-orange-50/30 flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                    <BrainCircuit className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">Thematic Risks</h3>
                    <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Topic Weakness</p>
                </div>
            </div>
            <div className="p-6 flex-1">
                <blockquote className="text-sm font-medium text-gray-700 italic border-l-4 border-orange-200 pl-4 mb-6">
                    "{data.headline}"
                </blockquote>
                <ul className="space-y-3">
                    {data.items?.map((item, i) => (
                        <li key={i} className="flex items-start text-sm text-gray-600">
                            <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-orange-400 rounded-full flex-shrink-0" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const StrategicActionsCard: React.FC<{ data: ExecutiveSummarySection }> = ({ data }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 h-full flex flex-col">
            <div className="p-5 border-b border-blue-50 bg-blue-50/30 flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">Strategic Actions</h3>
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Immediate Fixes</p>
                </div>
            </div>
            <div className="p-6 flex-1">
                <div className="space-y-4">
                    {data.items?.map((item, i) => (
                        <div key={i} className="flex items-start bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                            <div className="mr-3 mt-0.5 text-blue-600 font-bold text-xs border border-blue-200 w-5 h-5 flex items-center justify-center rounded-full bg-white flex-shrink-0">
                                {i + 1}
                            </div>
                            <span className="text-sm text-gray-700 font-medium">{item}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- New Sub-Components for Drill Down ---

const HealthAnalysisModal: React.FC<{ isOpen: boolean; onClose: () => void; insights: CompetitorInsight[] }> = ({ isOpen, onClose, insights }) => {
    if (!isOpen) return null;

    // Aggregate all opportunities from all competitors into a single flat list for the "Global" view
    const allOpportunities = insights.flatMap(insight =>
        insight.opportunities.map(op => ({
            ...op,
            competitorName: insight.competitorName // Add competitor context to the op
        }))
    ).sort((a, b) => b.gap - a.gap);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            ></div>

            {/* Modal Panel */}
            <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-white">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center">
                            <Activity className="w-6 h-6 mr-3 text-blue-600" />
                            Global Health Analysis
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Deep dive into queries negatively impacting your Global Health Score.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <UserX className="w-6 h-6 rotate-45" /> {/* Using X icon */}
                    </button>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                            <tr>
                                <th className="px-8 py-4 font-medium">Query</th>
                                <th className="px-6 py-4 font-medium">Topic</th>
                                <th className="px-6 py-4 font-medium">Winning Competitor</th>
                                <th className="px-6 py-4 font-medium">Metric Lost</th>
                                <th className="px-6 py-4 text-right font-medium">Gap Severity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {allOpportunities.map((op, idx) => (
                                <tr key={`${op.id}-${idx}`} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-8 py-4 font-medium text-gray-900 leading-relaxed">
                                        {op.queryText}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                            {op.topic || 'General'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-900 font-medium flex items-center">
                                        <Target className="w-4 h-4 mr-2 text-gray-400 group-hover:text-red-500 transition-colors" />
                                        {op.competitorName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium capitalize border
                                            ${op.metricName === 'soa' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                op.metricName === 'sentiment' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                                                    'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                            {op.metricName}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-mono font-bold text-red-600">-{op.gap.toFixed(1)}%</span>
                                            <span className={`text-[10px] uppercase tracking-wider font-bold mt-1 
                                                ${op.severity === 'Critical' ? 'text-red-600' : 'text-orange-500'}`}>
                                                {op.severity}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="bg-gray-50/80 px-8 py-4 border-t border-gray-100 text-xs text-center text-gray-500">
                    Showing {allOpportunities.length} critical gaps affecting your health score.
                </div>
            </div>
        </div>
    );
};
