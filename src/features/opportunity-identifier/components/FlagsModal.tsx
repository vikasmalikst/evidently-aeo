import { useRef, useEffect, useMemo, useState } from 'react';
import { X, Flag } from 'lucide-react';
import { OpportunityFlagsTable } from './OpportunityFlagsTable';
import { useCachedData } from '../../../hooks/useCachedData';
import { OpportunityResponse, Opportunity } from '../../../types/opportunity';
import { apiClient } from '../../../lib/apiClient';

interface FlagsModalProps {
    isOpen: boolean;
    onClose: () => void;
    brandId: string | undefined;
    competitors?: { name: string; domain?: string; logo?: string }[];
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export const FlagsModal = ({ isOpen, onClose, brandId, competitors = [] }: FlagsModalProps) => {
    const [recommendationMap, setRecommendationMap] = useState<Record<string, string>>({});

    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Fetch recommendation map
    useEffect(() => {
        if (!brandId || !isOpen) return;

        const fetchMap = async () => {
            try {
                const response = await apiClient.get<ApiResponse<{ map: Record<string, string> }>>(
                    `/brands/${brandId}/recommendations/map`
                );
                if (response.success && response.data) {
                    setRecommendationMap(response.data.map || {});
                }
            } catch (err) {
                console.error('Failed to fetch recommendation map:', err);
            }
        };

        fetchMap();
    }, [brandId, isOpen]);

    // Data Fetching Logic (Reused from OpportunitiesPage)
    const endpoint = useMemo(() => {
        if (!brandId || !isOpen) return null;
        // Default to a reasonable range if needed, or stick to default 14 days logic
        // For simplicity in this modal, we'll hardcode 14 days or use what we can
        const params = new URLSearchParams({ days: '14' });
        return `/brands/${brandId}/opportunities?${params.toString()}`;
    }, [brandId, isOpen]);

    const { data: response, loading } = useCachedData<OpportunityResponse>(
        endpoint,
        {},
        { requiresAuth: true },
        { enabled: !!endpoint, refetchOnMount: false }
    );

    // Filter Logic - Unique Flags (One per query)
    const uniqueFlags = useMemo(() => {
        if (!response?.opportunities) return [];

        const opportunities = response.opportunities;
        const unique = new Map<string, Opportunity>();

        opportunities.forEach(opp => {
            const existing = unique.get(opp.queryId);
            // Keep the one with highest priority score
            if (!existing || opp.priorityScore > existing.priorityScore) {
                unique.set(opp.queryId, opp);
            }
        });

        // Convert to array and sort by priority
        return Array.from(unique.values()).sort((a, b) => b.priorityScore - a.priorityScore);
    }, [response]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                            <Flag size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Opportunity Flags</h2>
                            <p className="text-sm text-slate-500">
                                {uniqueFlags.length} active flags requiring attention
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                    {loading && !response ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span className="ml-3 text-sm text-slate-500 font-medium">Loading flags...</span>
                        </div>
                    ) : (
                        <OpportunityFlagsTable
                            opportunities={uniqueFlags}
                            competitors={competitors}
                            recommendationMap={recommendationMap}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
