import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe } from 'lucide-react';
import { TopicsRankedTable } from '@/pages/TopicsAnalysis/components/TopicsRankedTable';
import { KpiToggle, MetricType } from '@/components/Visibility/KpiToggle';
import { useTopicsAnalysisData } from '@/hooks/useTopicsAnalysisData';
import { useManualBrandDashboard } from '@/manual-dashboard';
import { SafeLogo } from '@/components/Onboarding/common/SafeLogo';

interface TopicAnalysisTableModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TopicAnalysisTableModal: React.FC<TopicAnalysisTableModalProps> = ({
    isOpen,
    onClose
}) => {
    const { selectedBrand } = useManualBrandDashboard();
    const [metricType, setMetricType] = useState<MetricType>('share');

    // Default to last 30 days
    const filters = useMemo(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);

        // Format as YYYY-MM-DD
        const formatDate = (date: Date) => date.toISOString().split('T')[0];

        return {
            startDate: formatDate(start),
            endDate: formatDate(end)
        };
    }, []);

    const {
        topicsData,
        isLoading,
        competitors,
        selectedCompetitors
    } = useTopicsAnalysisData(filters);

    if (!isOpen) return null;

    // Map metricType for Table (which expects limited set)
    // TopicsRankedTable expects 'share' | 'visibility' | 'sentiment'
    const tableMetricType = (['share', 'visibility', 'sentiment'].includes(metricType)
        ? metricType
        : 'share') as 'share' | 'visibility' | 'sentiment';

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="p-2 bg-purple-50 rounded-lg">
                                            <Globe className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-900">Topic Performance Analysis</h2>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        Detailed breakdown of your brand's performance across key topics.
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* KPI Toggle */}
                            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                                <KpiToggle
                                    metricType={metricType}
                                    onChange={setMetricType}
                                    allowedMetricTypes={['visibility', 'share', 'sentiment']}
                                />
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-auto bg-gray-50/50 p-6">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                                    </div>
                                ) : topicsData?.topics ? (
                                    <TopicsRankedTable
                                        topics={topicsData.topics}
                                        categories={topicsData.categories.map(c => c.name)}
                                        metricType={tableMetricType}
                                        competitors={competitors}
                                        selectedCompetitors={selectedCompetitors}
                                        brandLogo={selectedBrand?.metadata?.logo || selectedBrand?.metadata?.brand_logo}
                                        brandName={selectedBrand?.name}
                                        brandDomain={selectedBrand?.homepage_url || undefined}
                                        // Disable filters inside modal for simplicity, or handle state if needed
                                        selectedTopics={new Set(topicsData.topics.map(t => t.id))}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                        <p>No topic data available.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
