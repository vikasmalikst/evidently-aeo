import { useMemo } from 'react';
import { AeoAuditResult } from '../types/types';
import { VisibilityChart } from '../../../components/Visibility/VisibilityChart';

interface TrendChartsProps {
    history: AeoAuditResult[];
    orientation?: 'horizontal' | 'vertical'; // Kept for prop compatibility, but we enforce specific layout now
    categoryFilter?: string;
}

export const TrendCharts = ({ history, categoryFilter }: TrendChartsProps) => {
    // Transform history data for VisibilityChart
    const chartData = useMemo(() => {
        if (!history || history.length === 0) return null;

        // Sort history by date just in case
        const sortedHistory = [...history].sort((a, b) =>
            new Date(a.auditDate || a.timestamp).getTime() - new Date(b.auditDate || b.timestamp).getTime()
        );

        const labels = sortedHistory.map(h => {
            const d = new Date(h.auditDate || h.timestamp);
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        });

        const categories = [
            { key: 'technicalCrawlability', name: 'Technical', color: '#3b82f6' },
            { key: 'contentQuality', name: 'Content', color: '#a855f7' },
            { key: 'semanticStructure', name: 'Semantic', color: '#10b981' },
            { key: 'accessibilityAndBrand', name: 'Access & Brand', color: '#f97316' },
            { key: 'aeoOptimization', name: 'AEO', color: '#6366f1' },
        ];

        // If filter is active, show only that category. If not, show all? 
        // User asked for "Historical Trend" in context of a generic modal.
        // If coming from "Overall", maybe show all?
        // But the modal trigger is usually inside `TestResultsList` which might be filtered?
        // `TestResultsList` handles "All" (Overall) or "Specific".
        // If categoryFilter is present, show only that ONE line.
        // If not, show ALL lines.

        const activeCategories = categoryFilter
            ? categories.filter(c => c.key === categoryFilter)
            : categories;

        const datasets = activeCategories.map(cat => {
            const data = sortedHistory.map(h => {
                const val = h.scoreBreakdown[cat.key as keyof typeof h.scoreBreakdown];
                return typeof val === 'number' ? Math.round(val) : null;
            });

            return {
                id: cat.key,
                label: cat.name,
                data: data,
                // We can assume real data here if history is real
                isRealData: new Array(data.length).fill(true)
            };
        });

        return {
            labels,
            datasets
        };

    }, [history, categoryFilter]);

    // Models for color mapping
    const models = useMemo(() => [
        { id: 'technicalCrawlability', name: 'Technical', color: '#3b82f6' },
        { id: 'contentQuality', name: 'Content', color: '#a855f7' },
        { id: 'semanticStructure', name: 'Semantic', color: '#10b981' },
        { id: 'accessibilityAndBrand', name: 'Access & Brand', color: '#f97316' },
        { id: 'aeoOptimization', name: 'AEO', color: '#6366f1' },
    ], []);

    const selectedModels = useMemo(() => {
        if (categoryFilter) return [categoryFilter];
        return models.map(m => m.id);
    }, [categoryFilter, models]);

    if (!history || history.length === 0) {
        return (
            <div className="text-center py-10 text-gray-400">
                No historical data available.
            </div>
        );
    }

    if (!chartData) return null;

    return (
        <div className="w-full h-[400px]"> {/* Fixed height container, width fully responsive */}
            <VisibilityChart
                data={chartData}
                chartType="line"
                selectedModels={selectedModels}
                activeTab="brand" // Dummy tab to satisfy props
                loading={false}
                models={models}
                metricType="visibility" // Uses 0-100 scale logic roughly
            />
        </div>
    );
};
