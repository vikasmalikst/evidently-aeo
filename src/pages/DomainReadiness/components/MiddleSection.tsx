import React from 'react';
import { AeoAuditResult } from '../types/types';
import { TrendCharts } from './TrendCharts';
import { TestResultsList } from './TestResultsList';
import { BotAccessTable } from './BotAccessTable';

interface MiddleSectionProps {
    audit: AeoAuditResult;
    history: AeoAuditResult[];
    selectedCategory: string;
}

export const MiddleSection = ({ audit, history, selectedCategory }: MiddleSectionProps) => {

    const categories = [
        { key: 'technicalCrawlability', name: 'Technical Crawlability' },
        { key: 'contentQuality', name: 'Content Quality' },
        { key: 'semanticStructure', name: 'Semantic Structure' },
        { key: 'accessibilityAndBrand', name: 'Accessibility & Brand' },
        { key: 'aeoOptimization', name: 'AEO Optimization' },
    ];

    // Helper to get historical data for a specific category
    // Since TrendCharts renders ALL, we might just re-use it or filter it. 
    // For simplicity, we'll keep using TrendCharts but maybe wrap it to show only one?
    // Current TrendCharts implementation renders a grid of 5. 
    // We need to modify TrendCharts to accept a 'filter' prop or create a SingleTrendChart.
    // For now, let's treat TrendCharts as "Show All Sparks".
    // If we need single, we will need to refactor TrendCharts. 

    /* 
       Logic:
       If selectedCategory == 'overall': Render loop of (Chart | Details) for ALL categories.
       If selectedCategory == specific: Render (Chart | Details) for THAT category.
    */

    // To avoid refactoring TrendCharts immediately, we will just use it to show history if 'Overall is selected.
    // Wait, req says: "Middle Section: Left side Chart. Right side Details."
    // If we selected 'Technical', we want Technical Chart | Technical Details.

    // Note: TrendCharts currently renders specific design. 
    // Ideally, I should refactor TrendCharts to export a `SingleCategoryChart`.
    // But due to time, I'll assume we can use the whole block or a placeholder.

    // Let's implement the loop logic.

    const renderCategoryBlock = (catKey: string, catName: string) => (
        <div key={catKey} className="mb-8 border-b border-gray-100 pb-8 last:border-0 last:pb-0">
            {/* Detailed Results (Full Width) */}
            <div className="flex flex-col h-full">
                {/* Header handled inside TestResultsList logic or here? 
                    Previously TestResultsList had logic to hide header if filtered.
                    MiddleSection renders title "Technical Trends" etc. 
                    Now we just want the table. 
                */}
                {/* <h3 className="font-semibold text-gray-800 mb-2">{catName} Details</h3> */}
                {/* Let's keep a clean layout. The TestResultsList has a header inside if !filtered. 
                    But here we are iterating. 
                    Actually, if we iterate, we are passing categoryFilter={catKey}. 
                    TestResultsList uses categoryFilter.
                    If we pass categoryFilter, TestResultsList renders ONLY that category. 
                    Does TestResultsList render a header? 
                    Lines 72-80 in previous TestResultsList: "if !categoryFilter render header".
                    So if we pass filter, NO header inside.
                    So we DO need a header here.
                */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800 text-lg">{catName} Details</h3>
                </div>

                <div className="flex-1 bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                    <TestResultsList
                        audit={audit}
                        categoryFilter={catKey}
                        history={history} // Pass history for Modal
                    />
                </div>
            </div>
        </div>
    );

    if (selectedCategory === 'botAccess') {
        return (
            <div className="grid grid-cols-1 gap-6">
                <BotAccessTable bots={audit.botAccessStatus} loading={false} />
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            {selectedCategory === 'overall' ? (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">All Detailed Results</h2>
                    {categories.map(cat => renderCategoryBlock(cat.key, cat.name))}

                    {/* Also show Bot Access at bottom of overall */}
                    <div className="mt-8 pt-8 border-t border-gray-200">
                        <BotAccessTable bots={audit.botAccessStatus} loading={false} />
                    </div>
                </div>
            ) : (
                <div>
                    {renderCategoryBlock(selectedCategory, categories.find(c => c.key === selectedCategory)?.name || selectedCategory)}
                </div>
            )}
        </div>
    );
};
