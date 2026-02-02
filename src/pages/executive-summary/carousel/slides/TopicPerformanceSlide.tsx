import React from 'react';
import { useExecutiveSummary } from '@/hooks/useExecutiveSummary';
import { useManualBrandDashboard } from '@/manual-dashboard';
import { SafeLogo } from '@/components/Onboarding/common/SafeLogo';
import { Loader2, BrainCircuit, Info, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { TopicAnalysisTableModal } from './components/TopicAnalysisTableModal';

export const TopicPerformanceSlide: React.FC = () => {
    const { data: summaryData, isLoading } = useExecutiveSummary();
    const { selectedBrand } = useManualBrandDashboard();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Logo Component (reused)
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

    const leadership = summaryData?.data?.topicLeadership || {
        visibility: 0,
        soa: 0,
        sentiment: 0,
        presence: 0
    };

    const stats = [
        {
            label: '% topics where Brand leads Competitors on Visibility',
            value: leadership.visibility,
            color: 'bg-blue-100 text-blue-800'
        },
        {
            label: '% topics where Brand leads Competitors on SOA',
            value: leadership.soa,
            color: 'bg-purple-100 text-purple-800'
        },
        {
            label: '% topics where Brand leads Competitors on Sentiments',
            value: leadership.sentiment,
            color: 'bg-yellow-100 text-yellow-800'
        },
        {
            label: '% topics where Brand leads Competitors on Brand Presence',
            value: leadership.presence,
            color: 'bg-indigo-100 text-indigo-800'
        }
    ];

    return (
        <div className="h-full flex flex-col max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <BrainCircuit className="w-6 h-6 text-purple-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Brand Topics Performance</h2>
                    </div>
                    <p className="text-gray-600 max-w-3xl flex items-center">
                        <Info className="w-4 h-4 mr-1.5 opacity-70" />
                        Topics represent categories of questions used to benchmark your brand’s presence in different LLMs.
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

            {/* Content */}
            <div className="flex-1 flex flex-col justify-center pb-20 px-8 relative">
                <div className="space-y-6">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center"
                        >
                            {/* Box with Number */}
                            <div className={`
                                w-24 h-20 rounded-lg shadow-sm flex items-center justify-center 
                                text-2xl font-bold border border-white/50
                                shrink-0 mr-6
                                ${stat.color.replace('text-', 'bg-').replace('100', '50')} 
                                ${stat.color}
                            `}>
                                {stat.value}%
                            </div>

                            {/* Text Description */}
                            <div className="text-xl text-gray-800 font-medium">
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Bottom Action */}
                <div className="absolute bottom-4 right-0">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group flex items-center gap-2 px-4 py-2 bg-white hover:bg-purple-50 text-purple-600 hover:text-purple-700 font-medium rounded-lg border border-gray-200 hover:border-purple-200 transition-all shadow-sm"
                    >
                        View Detailed Analysis
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>

            <TopicAnalysisTableModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
};
