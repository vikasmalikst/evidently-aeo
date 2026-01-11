import { useState } from 'react';
import { AeoAuditResult } from '../types/types';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Info, ExternalLink, Lightbulb, ArrowUpRight } from 'lucide-react';
import { TEST_RESOURCES } from '../utils/testResources';

interface TestResultsListProps {
  audit: AeoAuditResult;
  loading?: boolean;
  progress?: {
    active: boolean;
    buckets: Record<string, { total: number; completed: number }>;
  };
  categoryFilter?: string;
}

type CategoryKey = 'technicalCrawlability' | 'contentQuality' | 'semanticStructure' | 'accessibilityAndBrand' | 'aeoOptimization';

export function TestResultsList({ audit, loading, progress, categoryFilter }: TestResultsListProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow(prev => (prev === id ? null : id));
  };

  const allCategories: { name: string; key: CategoryKey; data: any }[] = [
    { name: 'Technical Crawlability', key: 'technicalCrawlability', data: audit.detailedResults.technicalCrawlability },
    { name: 'Content Quality', key: 'contentQuality', data: audit.detailedResults.contentQuality },
    { name: 'Semantic Structure', key: 'semanticStructure', data: audit.detailedResults.semanticStructure },
    { name: 'Accessibility & Brand', key: 'accessibilityAndBrand', data: audit.detailedResults.accessibilityAndBrand },
    { name: 'AEO Optimization', key: 'aeoOptimization', data: audit.detailedResults.aeoOptimization },
  ];

  // Filter to single category if categoryFilter is provided
  const categories = categoryFilter
    ? allCategories.filter(cat => cat.key === categoryFilter)
    : allCategories;

  const getIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />;
    if (status === 'fail') return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
    if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />;
    return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        if (!cat.data || !cat.data.tests) return null;

        return (
          <div key={cat.key} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Category Header (if we are showing all categories, otherwise MiddleSection handles title) */}
            {/* Since MiddleSection handles title when filtered, we might want to hide it if filtered? 
                 But MiddleSection title is outside. Let's keep a subtle header here or purely the table.
                 User asked for table. Let's do a table structure. 
             */}
            {!categoryFilter && (
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded border ${getScoreBadgeColor(cat.data.score)}`}>
                  Category Score: {cat.data.score}
                </span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 font-medium w-1/4">Metric</th>
                    <th className="px-6 py-3 font-medium w-1/2">Result</th>
                    <th className="px-6 py-3 font-medium w-1/6 text-center">Score</th>
                    <th className="px-6 py-3 font-medium w-1/12 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cat.data.tests.map((test: any, idx: number) => {
                    const uniqueId = `${cat.key}-${idx}`;
                    const resource = TEST_RESOURCES[test.name];
                    const isExpanded = expandedRow === uniqueId;

                    return (
                      <div key={idx} style={{ display: 'contents' }}>
                        <tr className="hover:bg-blue-50/50 transition-colors group">
                          {/* Metric */}
                          <td className="px-6 py-4 font-medium text-gray-900 align-top">
                            {test.name}
                          </td>

                          {/* Result */}
                          <td className="px-6 py-4 text-gray-600 align-top">
                            <div className="flex items-start gap-3">
                              {getIcon(test.status)}
                              <span className="text-sm leading-relaxed">
                                {test.message || test.description || 'No details available.'}
                              </span>
                            </div>
                          </td>

                          {/* Score */}
                          <td className="px-6 py-4 text-center align-top">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${getScoreBadgeColor(test.score)}`}>
                              {test.score}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-right align-top">
                            <div className="flex items-center justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                              {/* Learn More */}
                              {(test.documentationUrl || resource?.learnMoreUrl) && (
                                <a
                                  href={test.documentationUrl || resource?.learnMoreUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Learn More"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              )}

                              {/* How to Fix Toggle */}
                              {resource?.howToFix && test.status !== 'pass' && (
                                <button
                                  onClick={() => toggleRow(uniqueId)}
                                  className={`transition-colors ${isExpanded ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'}`}
                                  title="How to fix"
                                >
                                  <Lightbulb size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Row for Fix */}
                        {isExpanded && resource?.howToFix && (
                          <tr className="bg-purple-50/50">
                            <td colSpan={4} className="px-6 py-4 mx-4">
                              <div className="ml-0 md:ml-[25%] bg-white border border-purple-100 rounded-lg p-4 shadow-sm relative">
                                <div className="absolute left-[-8px] top-[-8px]">
                                  <div className="bg-purple-100 p-1 rounded-full">
                                    <Lightbulb size={14} className="text-purple-600" />
                                  </div>
                                </div>
                                <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wide mb-2">How to Fix</h4>
                                <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                  {resource.howToFix.map((fix: string, i: number) => (
                                    <li key={i}>{fix}</li>
                                  ))}
                                </ol>
                              </div>
                            </td>
                          </tr>
                        )}
                      </div>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
