import React from 'react';
import { 
    IconChartBar, 
    IconRobot, 
    IconSwords, 
    IconWorld, 
    IconTarget, 
    IconBulb, 
    IconTrendingUp,
    IconFileText
} from '@tabler/icons-react';

export const ReportTableOfContents: React.FC = () => {
    const sections = [
        { title: 'Executive Summary', icon: IconFileText, page: '03', id: 'executive-summary' },
        { title: 'Brand Performance', icon: IconChartBar, page: '04', id: 'brand-performance' },
        { title: 'LLM Performance', icon: IconRobot, page: '05', id: 'llm-performance' },
        { title: 'Competitive Landscape', icon: IconSwords, page: '06', id: 'competitive-landscape' },
        { title: 'Domain Readiness', icon: IconWorld, page: '07', id: 'domain-readiness' },
        { title: 'Actions & Impact', icon: IconTarget, page: '08', id: 'actions-impact' },
        { title: 'Opportunities', icon: IconBulb, page: '09', id: 'opportunities' },
        { title: 'Top Movers', icon: IconTrendingUp, page: '10', id: 'top-movers' },
    ];

    return (
        <div className="report-toc-page flex flex-col min-h-[1123px] w-full p-16 bg-white" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
            {/* Header */}
            <div className="mb-16 border-b border-gray-100 pb-8">
                <h2 className="text-4xl font-bold text-gray-900">Table of Contents</h2>
                <p className="text-lg text-gray-500 mt-2">Report Structure & Key Insights</p>
            </div>

            {/* Content List */}
            <div className="flex-1 flex flex-col gap-6">
                {sections.map((section, index) => (
                    <a 
                        key={index} 
                        href={`#${section.id}`}
                        className="block group no-underline text-inherit"
                    >
                        <div className="flex items-center gap-6 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] group-hover:bg-[var(--accent-primary)] group-hover:text-white transition-colors">
                                <section.icon size={24} stroke={1.5} />
                            </div>
                            <div className="flex-1 border-b border-gray-100 border-dashed pb-4 flex items-end group-hover:border-gray-200">
                                <span className="text-xl font-semibold text-gray-800 group-hover:text-[var(--accent-primary)] transition-colors">{section.title}</span>
                                <div className="flex-1 mx-4 mb-1 border-b-2 border-dotted border-gray-200"></div>
                            </div>
                            {/* Note: Page numbers are placeholders since HTML-to-PDF paging is dynamic, 
                                but giving them numbers implies structure. 
                                If strict accuracy is needed, we'd remove them or calculate.
                                For now, we leave them as visual indicators or remove if user prefers.
                                Let's keep them generic or remove specific numbers to avoid confusion if content shifts.
                            */}
                            {/* <span className="text-xl font-medium text-gray-400 font-mono">{section.page}</span> */}
                        </div>
                    </a>
                ))}
            </div>

            {/* Footer Decoration */}
            <div className="mt-auto pt-8 border-t border-gray-100 flex justify-between items-center text-sm text-gray-400">
                <span>EvidentlyAEO Executive Report</span>
                <span>Page 2</span>
            </div>
        </div>
    );
};
