import React, { useMemo, useState, useEffect } from 'react';
import { X, Globe } from 'lucide-react';
import { useCachedData } from '@/hooks/useCachedData';
import { useManualBrandDashboard } from '@/manual-dashboard';
import { ValueScoreTable } from '@/components/SourcesR2/ValueScoreTable';
import { ApiResponse, SourceAttributionResponse, EnhancedSource } from '@/types/citation-sources';
import { computeEnhancedSources } from '@/utils/citationAnalysisUtils';
import { getDefaultDateRange } from '@/pages/dashboard/utils';

interface CitationSourcesTableModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CitationSourcesTableModal: React.FC<CitationSourcesTableModalProps> = ({ isOpen, onClose }) => {
    const { selectedBrandId } = useManualBrandDashboard();

    // Default to last 7 days
    const { start: startDate, end: endDate } = getDefaultDateRange();

    const sourcesEndpoint = useMemo(() => {
        if (!selectedBrandId) return null;
        const params = new URLSearchParams({
            startDate,
            endDate
        });
        return `/brands/${selectedBrandId}/sources?${params.toString()}`;
    }, [selectedBrandId, startDate, endDate]);

    const { data: response, loading, error } = useCachedData<ApiResponse<SourceAttributionResponse>>(
        sourcesEndpoint,
        {},
        { requiresAuth: true },
        { enabled: isOpen && !!selectedBrandId, refetchOnMount: false }
    );

    const sourceData = response?.success && response.data ? response.data.sources : [];
    const [processedSources, setProcessedSources] = useState<EnhancedSource[] | null>(null);

    useEffect(() => {
        setProcessedSources(null);
        if (!sourceData.length) return;

        const compute = () => {
            setProcessedSources(computeEnhancedSources(sourceData));
        };

        const requestIdle = (window as any).requestIdleCallback as
            | ((cb: () => void, opts?: { timeout?: number }) => number)
            | undefined;
        const cancelIdle = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;

        if (requestIdle) {
            const id = requestIdle(compute, { timeout: 1500 });
            return () => cancelIdle?.(id);
        }

        const t = window.setTimeout(compute, 50);
        return () => window.clearTimeout(t);
    }, [sourceData]);

    const displaySources = processedSources || [];

    const totalCitations = useMemo(() => {
        return displaySources.reduce((acc, s) => acc + (s.citations || 0), 0);
    }, [displaySources]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            ></div>

            {/* Modal Panel */}
            <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl flex flex-col h-[600px] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Globe className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                Detailed Citation Analysis
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Comprehensive analysis of all citation sources for the last 7 days.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-auto bg-gray-50/50 flex-1">
                    {loading && !processedSources ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                            Failed to load citation data. Please try again later.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                            <ValueScoreTable
                                sources={displaySources}
                                maxHeight="60vh"
                                disableSorting={!processedSources}
                                pagination={{ pageSize: 20 }}
                                // No trend selection
                                highlightedSourceName={null}
                                totalCitations={totalCitations}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
