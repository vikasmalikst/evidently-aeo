/**
 * Simplified Recommendations Table for V3
 * 
 * Displays only essential columns:
 * - Action
 * - Source/Domain
 * - Focus Area
 * - Priority
 * - Effort Level
 * 
 * Supports expandable rows with detailed information
 */

import { useState } from 'react';
import { IconChevronDown, IconChevronUp, IconTrash } from '@tabler/icons-react';
import { RecommendationV3 } from '../../api/recommendationsV3Api';
import { motion, AnimatePresence } from 'framer-motion';

interface RecommendationsTableV3Props {
  recommendations: RecommendationV3[];
  selectedIds?: Set<string>;
  onSelect?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  showCheckboxes?: boolean;
  showActions?: boolean;
  onAction?: (recommendation: RecommendationV3, action: string) => void;
  actionLabel?: string; // Customize the action button label (e.g., "Generate Guide")
  actionType?: string; // Customize the action identifier sent to onAction (default: "generate-content")
  generatedLabel?: string; // Customize the generated badge label (default: "Generated")
  showStatusDropdown?: boolean;
  onStatusChange?: (recommendationId: string, status: 'pending_review' | 'approved' | 'rejected' | 'removed') => void;
  onStopTracking?: (recommendationId: string) => void;
  generatingContentIds?: Set<string>; // Track which recommendations are currently generating content
}

const FocusAreaBadge = ({ area }: { area: 'visibility' | 'soa' | 'sentiment' }) => {
  const config = {
    visibility: { label: 'Visibility', color: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]' },
    soa: { label: 'SOA', color: 'bg-[#e9d5ff] text-[#6b21a8] border-[#d8b4fe]' },
    sentiment: { label: 'Sentiment', color: 'bg-[#ccfbf1] text-[#134e4a] border-[#99f6e4]' }
  };

  const { label, color } = config[area];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${color}`}>
      {label}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: 'High' | 'Medium' | 'Low' }) => {
  const colors = {
    High: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
    Medium: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
    Low: 'bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${colors[priority]}`}>
      {priority}
    </span>
  );
};

const EffortBadge = ({ effort }: { effort: 'Low' | 'Medium' | 'High' }) => {
  const colors = {
    High: 'bg-[#fed7aa] text-[#9a3412] border-[#fdba74]',
    Medium: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
    Low: 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${colors[effort]}`}>
      {effort}
    </span>
  );
};

// const SourceBadge = ({ source }: { source?: 'domain_audit' | 'ai_generated' }) => {
//   if (source === 'domain_audit') {
//     return (
//       <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
//         🔧 Technical Fix
//       </span>
//     );
//   }
//   return (
//     <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
//       🤖 AI Recommendation
//     </span>
//   );
// };

export const RecommendationsTableV3 = ({
  recommendations,
  selectedIds = new Set(),
  onSelect,
  onSelectAll,
  showCheckboxes = false,
  showActions = false,
  onAction,
  actionLabel = 'Generate',
  actionType = 'generate-content',
  generatedLabel = 'Generated',
  showStatusDropdown = false,
  onStatusChange,
  onStopTracking,
  generatingContentIds = new Set()
}: RecommendationsTableV3Props) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  // Only calculate selection state if checkboxes are shown
  const allSelected = showCheckboxes && recommendations.length > 0 && recommendations.every(r => r.id && selectedIds.has(r.id));
  const someSelected = showCheckboxes && recommendations.some(r => r.id && selectedIds.has(r.id));

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)]">
            <tr>
              {showCheckboxes && (
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    className="w-4 h-4 rounded border-[#cbd5e1] text-[#00bcdc] focus:ring-2 focus:ring-[#00bcdc]"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider min-w-[400px]">
                Recommendation
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider w-[200px]">
                Source/Domain
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider w-[120px]">
                Focus Area
              </th>
              {showStatusDropdown && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider w-[160px]">
                  Status
                </th>
              )}
              {showActions && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider w-[150px]">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--border-default)]">
            {recommendations.length === 0 ? (
              <tr>
                <td colSpan={showCheckboxes ? (showStatusDropdown ? (showActions ? 6 : 5) : (showActions ? 5 : 4)) : (showStatusDropdown ? (showActions ? 5 : 4) : (showActions ? 4 : 3))} className="px-6 py-12 text-center text-sm text-[var(--text-caption)]">
                  No recommendations found
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false} mode="popLayout">
                {recommendations.map((rec, index) => {
                  const recId = rec.id || `rec-${index}`;
                  const isExpanded = expandedRows.has(recId);
                  const hasDetails = rec.reason || rec.explanation || rec.expectedBoost || rec.impactScore || rec.kpi || (rec.howToFix && rec.howToFix.length > 0);

                  return (
                    <>
                      <motion.tr
                        key={recId}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          x: 100, // Slide right ("dumped")
                          y: 20,  // Drop down slightly
                          scale: 0.9,
                          rotate: 5, // Tilted drop
                          transition: { duration: 0.4, ease: "backIn" }
                        }}
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'} hover:bg-[#f1f5f9] transition-colors`}
                      >
                        {showCheckboxes && (
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={rec.id ? selectedIds.has(rec.id) : false}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (rec.id) {
                                  onSelect?.(rec.id, e.target.checked);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-[#cbd5e1] text-[#00bcdc] focus:ring-2 focus:ring-[#00bcdc] cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2">
                            {hasDetails && (
                              <button
                                onClick={() => toggleExpand(recId)}
                                className="p-1 hover:bg-[#e2e8f0] rounded transition-colors flex-shrink-0 mt-0.5"
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? (
                                  <IconChevronUp size={16} className="text-[#64748b]" />
                                ) : (
                                  <IconChevronDown size={16} className="text-[#64748b]" />
                                )}
                              </button>
                            )}
                            <div className="flex flex-col gap-1.5">
                              {/* Content Type Badge */}
                              {rec.action && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-gradient-to-r from-[#eef2ff] to-[#e0e7ff] text-[#4338ca] border border-[#c7d2fe] w-fit">
                                  {rec.action.match(/^\[(.*?)\]/)?.[1] || 'Article'}
                                </span>
                              )}
                              {/* Title (contentFocus) as main display */}
                              <p className="text-[14px] text-[var(--text-headings)] font-semibold leading-snug">
                                {rec.contentFocus || rec.action?.replace(/^\[.*?\]\s*/, '') || 'Untitled Recommendation'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-[12px] text-[var(--text-body)]">
                            {rec.citationSource}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <FocusAreaBadge area={rec.focusArea} />
                        </td>
                        {showStatusDropdown && (
                          <td className="px-4 py-4">
                            <div className="relative">
                              <select
                                value={rec.reviewStatus || 'pending_review'}
                                onChange={(e) => {
                                  const newStatus = e.target.value as 'pending_review' | 'approved' | 'rejected' | 'removed';
                                  if (rec.id && onStatusChange) {
                                    onStatusChange(rec.id, newStatus);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Change status for ${rec.action?.substring(0, 30)}`}
                                className={`w-full pl-9 pr-8 py-2 border rounded-lg text-[13px] font-medium cursor-pointer transition-all appearance-none focus:outline-none focus:ring-2 focus:ring-offset-1 ${rec.reviewStatus === 'approved'
                                    ? 'border-[#06c686] bg-[#f0fdf4] text-[#027a48] focus:ring-[#06c686]'
                                    : rec.reviewStatus === 'rejected'
                                      ? 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b] focus:ring-[#ef4444]'
                                      : 'border-[#fde68a] bg-[#fffbeb] text-[#92400e] focus:ring-[#f59e0b]'
                                  }`}
                                style={{
                                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L10 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                                  backgroundSize: '10px 6px',
                                  backgroundPosition: 'right 8px center',
                                  backgroundRepeat: 'no-repeat'
                                }}
                              >
                                <option value="pending_review">Pending Review</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="removed">Stop Tracking</option>
                              </select>
                              {/* Status indicator dot */}
                              <div
                                className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${rec.reviewStatus === 'approved'
                                    ? 'bg-[#06c686]'
                                    : rec.reviewStatus === 'rejected'
                                      ? 'bg-[#ef4444]'
                                      : 'bg-[#f59e0b]'
                                  }`}
                              />
                            </div>
                          </td>
                        )}
                        {showActions && (
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {onAction && (() => {
                                const isGenerating = generatingContentIds.has(rec.id || '');
                                const isGenerated = rec.isContentGenerated;

                                if (isGenerating) {
                                  return (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-[#fef3c7] text-[#92400e] border-[#fde68a]">
                                      <div className="w-3 h-3 border-2 border-[#92400e] border-t-transparent rounded-full animate-spin mr-1.5" />
                                      Generating...
                                    </span>
                                  );
                                }

                                if (isGenerated) {
                                  return (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]">
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      {generatedLabel}
                                    </span>
                                  );
                                }

                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAction(rec, actionType);
                                    }}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-[#06c686] text-white border-[#05a870] hover:bg-[#05a870] transition-colors cursor-pointer"
                                  >
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {actionLabel}
                                  </button>
                                );
                              })()}
                              {onStopTracking && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (rec.id) onStopTracking(rec.id);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                  title="Stop Tracking"
                                >
                                  <IconTrash size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}

                      </motion.tr>
                      {isExpanded && hasDetails && (
                        <tr key={`${recId}-details`} className="bg-[#fafbfc]">
                          <td colSpan={showCheckboxes ? (showStatusDropdown ? (showActions ? 6 : 5) : (showActions ? 5 : 4)) : (showStatusDropdown ? (showActions ? 5 : 4) : (showActions ? 4 : 3))} className="px-4 py-4">
                            <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 space-y-4 shadow-sm">
                              {/* Action - What to Do (Full Width) */}
                              <div className="bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9] rounded-lg p-4 border border-[#e2e8f0]">
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-[#00bcdc] bg-opacity-10 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-[#00bcdc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1">What to Do</p>
                                    <p className="text-[14px] text-[#0f172a] leading-relaxed">
                                      {rec.action?.replace(/^\[.*?\]\s*/, '') || 'No action specified'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Two Column Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Strategic Rationale - muted professional style */}
                                {(rec.reason || rec.explanation) && (
                                  <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-6 h-6 rounded-md bg-[#6b7280] bg-opacity-10 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                      </div>
                                      <p className="text-[11px] font-bold text-[#4b5563] uppercase tracking-wide">Why This Matters</p>
                                    </div>
                                    <p className="text-[13px] text-[#374151] leading-relaxed">{rec.reason}</p>
                                    {rec.explanation && (
                                      <p className="text-[12px] text-[#6b7280] mt-2 pt-2 border-t border-[#e5e7eb]">{rec.explanation}</p>
                                    )}
                                  </div>
                                )}

                                {/* Expected Impact - muted professional style */}
                                <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-md bg-[#6b7280] bg-opacity-10 flex items-center justify-center">
                                      <svg className="w-3.5 h-3.5 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                      </svg>
                                    </div>
                                    <p className="text-[11px] font-bold text-[#4b5563] uppercase tracking-wide">Expected Impact</p>
                                  </div>
                                  <div className="space-y-2">
                                    {rec.expectedBoost && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[12px] font-medium text-[#6b7280]">Boost:</span>
                                        <span className="text-[13px] font-semibold text-[#374151]">{rec.expectedBoost}</span>
                                      </div>
                                    )}
                                    {rec.confidence !== undefined && rec.confidence !== null && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[12px] font-medium text-[#6b7280]">Confidence:</span>
                                        <div className="flex-1 bg-[#e5e7eb] rounded-full h-2 overflow-hidden">
                                          <div 
                                            className="h-full bg-gradient-to-r from-[#00bcdc] to-[#0891b2] rounded-full transition-all"
                                            style={{ width: `${rec.confidence}%` }}
                                          />
                                        </div>
                                        <span className="text-[12px] font-bold text-[#374151]">{rec.confidence}%</span>
                                      </div>
                                    )}
                                    {rec.kpi && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[12px] font-medium text-[#6b7280]">Primary KPI:</span>
                                        <span className="text-[13px] text-[#374151]">{rec.kpi}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Execution Details */}
                                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-md bg-[#6366f1] bg-opacity-10 flex items-center justify-center">
                                      <svg className="w-3.5 h-3.5 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                      </svg>
                                    </div>
                                    <p className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">Execution Plan</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    {rec.timeline && (
                                      <div>
                                        <p className="text-[10px] text-[#94a3b8] uppercase font-medium">Timeline</p>
                                        <p className="text-[13px] font-medium text-[#334155]">{rec.timeline}</p>
                                      </div>
                                    )}
                                    {rec.effort && (
                                      <div>
                                        <p className="text-[10px] text-[#94a3b8] uppercase font-medium">Effort Level</p>
                                        <p className="text-[13px] font-medium text-[#334155]">{rec.effort}</p>
                                      </div>
                                    )}
                                    {rec.citationSource && (
                                      <div className="col-span-2">
                                        <p className="text-[10px] text-[#94a3b8] uppercase font-medium">Target Platform</p>
                                        <p className="text-[13px] font-medium text-[#334155]">{rec.citationSource}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Cross-Channel Strategy - muted professional style */}
                                {rec.focusSources && (
                                  <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-6 h-6 rounded-md bg-[#6b7280] bg-opacity-10 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                      <p className="text-[11px] font-bold text-[#4b5563] uppercase tracking-wide">Cross-Channel Strategy</p>
                                    </div>
                                    <p className="text-[13px] text-[#374151] leading-relaxed">{rec.focusSources}</p>
                                  </div>
                                )}
                              </div>

                              {/* How to Fix (for domain audit recommendations) - muted professional style */}
                              {rec.howToFix && rec.howToFix.length > 0 && (
                                <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-md bg-[#6b7280] bg-opacity-10 flex items-center justify-center">
                                      <svg className="w-3.5 h-3.5 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                    </div>
                                    <p className="text-[11px] font-bold text-[#4b5563] uppercase tracking-wide">How to Fix</p>
                                  </div>
                                  <ol className="space-y-2">
                                    {rec.howToFix.map((step, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="w-5 h-5 rounded-full bg-[#00bcdc] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                        <span className="text-[13px] text-[#374151]">{step}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

