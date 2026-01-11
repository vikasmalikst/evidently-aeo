import React, { useState } from 'react';
import { AeoAuditResult } from '../types/types';
import { AlertCircle, CheckCircle2, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { TEST_RESOURCES } from '../utils/testResources';

interface ActionItemsTableProps {
    audit: AeoAuditResult;
    selectedCategory: string;
}

export const ActionItemsTable = ({ audit, selectedCategory }: ActionItemsTableProps) => {
    // 1. Group items by Category
    const groupedIssues: Record<string, any[]> = {};

    if (audit.detailedResults) {
        Object.entries(audit.detailedResults).forEach(([categoryKey, catResult]: [string, any]) => {
            // Filter logic
            if (selectedCategory !== 'overall' && categoryKey !== selectedCategory) return;
            if (selectedCategory === 'botAccess') return;
            if (!catResult || !catResult.tests) return;

            const failures = catResult.tests.filter((t: any) => t.status === 'fail' || (t.score !== undefined && t.score < 70));

            if (failures.length > 0) {
                const catName = categoryKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                groupedIssues[catName] = failures;
            }
        });
    }

    const hasIssues = Object.keys(groupedIssues).length > 0;
    const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

    // Toggle logic (default all open? or start collapsed? User said "collapsible link". Let's default open for visibility)
    // Actually, user said "Aggregate Improvements for a KPI together in collapsible link."
    // Let's implement toggle.
    const toggleCat = (catName: string) => {
        setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }));
    };

    // Initialize all as expanded on load (optional)
    React.useEffect(() => {
        const initialExc: Record<string, boolean> = {};
        Object.keys(groupedIssues).forEach(k => initialExc[k] = true);
        setExpandedCats(initialExc);
    }, [Object.keys(groupedIssues).length]);


    if (!hasIssues) {
        return (
            <div className="bg-green-50 p-8 rounded-lg text-center border border-green-100">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-green-800">No Critical Issues Found!</h3>
                <p className="text-green-600">Your domain is well optimized based on current criteria.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="text-red-600 w-5 h-5" />
                <h3 className="font-semibold text-gray-900">Recommended Improvements</h3>
            </div>

            {Object.entries(groupedIssues).map(([catName, issues]) => {
                const isExpanded = expandedCats[catName];

                return (
                    <div key={catName} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        {/* Collapsible Header */}
                        <button
                            onClick={() => toggleCat(catName)}
                            className="w-full px-6 py-4 flex items-center justify-between bg-red-50/50 hover:bg-red-50 transition-colors text-left"
                        >
                            <span className="font-semibold text-gray-800 flex items-center gap-2">
                                {catName}
                                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                                    {issues.length} Issues
                                </span>
                            </span>
                            {isExpanded ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                        </button>

                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="border-t border-gray-100">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 text-gray-500">
                                                <tr>
                                                    <th className="px-6 py-3 font-medium w-1/4">Metric</th>
                                                    <th className="px-6 py-3 font-medium w-1/4">Issue</th>
                                                    <th className="px-6 py-3 font-medium w-1/2">How to Fix</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {issues.map((issue: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-gray-50 group">
                                                        <td className="px-6 py-4 font-medium text-gray-900 align-top">
                                                            {issue.name}
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-600 align-top">
                                                            {issue.message || issue.description}
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-700 align-top">
                                                            <div className="flex items-start gap-2">
                                                                <Wrench className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                                                                <div className="text-sm leading-relaxed">
                                                                    {TEST_RESOURCES[issue.name]?.howToFix ? (
                                                                        <ol className="list-decimal list-inside space-y-1 mt-0.5">
                                                                            {TEST_RESOURCES[issue.name].howToFix.map((step: string, i: number) => (
                                                                                <li key={i}>{step}</li>
                                                                            ))}
                                                                        </ol>
                                                                    ) : (
                                                                        <span>{issue.remediation || issue.how_to_fix || 'Check documentation for remediation steps.'}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
};
