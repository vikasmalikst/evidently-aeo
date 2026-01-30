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

import React, { useState } from 'react';
import { IconChevronDown, IconChevronUp, IconTrash } from '@tabler/icons-react';
import { RecommendationV3 } from '../../api/recommendationsV3Api';
import { SafeLogo } from '../Onboarding/common/SafeLogo';
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
  renderExpandedContent?: (recommendation: RecommendationV3) => React.ReactNode;
  onNavigate?: (step: number) => void;
}

const JourneyTracker = ({
  rec,
  onNavigate
}: {
  rec: RecommendationV3;
  onNavigate?: (step: number) => void;
}) => {
  // Determine current stage for coloring dots
  // 1: Approved (Always true here)
  // 2: Content Gen (isContentGenerated)
  // 3: Refine (isContentGenerated && !isCompleted)
  // 4: Outcome (isCompleted)

  let currentStage = 1; // Base: Approved
  let stageLabel = 'Drafting'; // Default next step is Drafting (Content Gen)
  let targetStep = 2; // Clicking takes to Content Gen

  if (rec.isCompleted) {
    currentStage = 4;
    stageLabel = 'Tracking';
    targetStep = 4;
  } else if (rec.isContentGenerated) {
    currentStage = 3;
    stageLabel = 'Refine';
    targetStep = 3;
  } else {
    // Just approved
    currentStage = 2;
    stageLabel = 'Drafting';
    targetStep = 2;
  }

  return (
    <div
      className="flex flex-col items-start justify-center cursor-pointer group py-1"
      onClick={(e) => {
        e.stopPropagation();
        onNavigate?.(targetStep);
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {[1, 2, 3, 4].map((step) => {
          // Color logic:
          // Past steps: Solid Green
          // Current step: Solid Green (or highlighted)
          // Future steps: Gray

          let colorClass = 'bg-gray-200';

          // Step 1 (Approved) is always done if we see this
          if (step === 1) {
            colorClass = 'bg-[#06c686]';
          }
          // For other steps
          else if (step <= currentStage) {
            colorClass = 'bg-[#06c686]';
            // Add ring for current active stage
            if (step === currentStage) {
              colorClass += ' ring-2 ring-[#06c686]/30';
            }
          }

          return (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${colorClass}`}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-bold text-[#06c686] uppercase tracking-wide group-hover:text-[#05a870] flex items-center gap-1">
        {stageLabel}
        <strong className="text-xs">→</strong>
      </span>
    </div>
  );
};

const FocusAreaBadge = ({ area }: { area: 'visibility' | 'soa' | 'sentiment' }) => {
  const config = {
    visibility: { label: 'Visibility', color: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe] shadow-sm shadow-blue-100' },
    soa: { label: 'SOA', color: 'bg-[#e9d5ff] text-[#6b21a8] border-[#d8b4fe] shadow-sm shadow-purple-100' },
    sentiment: { label: 'Sentiment', color: 'bg-[#ccfbf1] text-[#134e4a] border-[#99f6e4] shadow-sm shadow-teal-100' }
  };

  const { label, color } = config[area];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${color}`}>
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
  generatingContentIds = new Set(),
  renderExpandedContent,
  onNavigate
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
    <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9] border-b border-[#e2e8f0]">
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
              <th className="px-4 py-4 text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider min-w-[400px]">
                Recommendation
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-[200px]">
                Source/Domain
              </th>
              {showStatusDropdown && (
                <th className="px-4 py-4 text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-[160px]">
                  Status
                </th>
              )}
              {showActions && (
                <th className="px-4 py-3 text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-[150px]">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#f1f5f9]">
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
                  const hasDetails = rec.reason || rec.explanation || rec.expectedBoost || rec.impactScore || rec.kpi || (rec.howToFix && rec.howToFix.length > 0) || renderExpandedContent;

                  return (
                    <React.Fragment key={recId}>
                      <motion.tr
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
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'} hover:bg-[#f0f9ff] transition-all duration-200 cursor-pointer`}
                      >
                        {showCheckboxes && (
                          <td className="px-4 py-3">
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
                        <td className="px-4 py-5">
                          <div className="flex items-start gap-3">
                            {hasDetails && (
                              <button
                                onClick={() => toggleExpand(recId)}
                                className="p-1.5 hover:bg-[#00bcdc]/10 rounded-lg transition-all duration-200 flex-shrink-0 mt-0.5 group"
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? (
                                  <IconChevronUp size={16} className="text-[#00bcdc] group-hover:text-[#0096b0] transition-colors" />
                                ) : (
                                  <IconChevronDown size={16} className="text-[#94a3b8] group-hover:text-[#00bcdc] transition-colors" />
                                )}
                              </button>
                            )}
                            <div className="flex flex-col gap-1.5">
                              {/* Recommendation Action as main display */}
                              <p className="text-[14px] text-[#0f172a] font-semibold leading-relaxed">
                                {rec.action?.replace(/^\[.*?\]\s*/, '') || rec.contentFocus || 'No action specified'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-5">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 w-5 h-5 rounded overflow-hidden bg-white border border-slate-100 flex items-center justify-center">
                              <SafeLogo
                                domain={rec.citationSource}
                                className="w-4 h-4 object-contain"
                                size={16}
                                alt={rec.citationSource}
                              />
                            </div>
                            <p className="text-[12px] text-[var(--text-body)] truncate max-w-[150px]" title={rec.citationSource}>
                              {rec.citationSource}
                            </p>
                          </div>
                        </td>
                        {showStatusDropdown && (
                          <td className="px-4 py-3">
                            <div className="relative group min-w-[140px]">
                              {/* Journey Tracker for Approved Items */}
                              {rec.reviewStatus === 'approved' ? (
                                <JourneyTracker rec={rec} onNavigate={onNavigate} />
                              ) : (
                                /* Pending/Rejected/Removed - Styled as Dot + Text (Dropdown Trigger) */
                                <div className="relative flex flex-col items-start justify-center py-1 group">
                                  {/* Hidden Select for Interaction */}
                                  <select
                                    value={rec.reviewStatus || 'pending_review'}
                                    onChange={(e) => {
                                      const newStatus = e.target.value as 'pending_review' | 'approved' | 'rejected' | 'removed';
                                      if (rec.id && onStatusChange) {
                                        onStatusChange(rec.id, newStatus);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                    aria-label="Change status"
                                  >
                                    <option value="pending_review">Pending Review</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="removed">Stop Tracking</option>
                                  </select>

                                  {/* Visual: Dot */}
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${rec.reviewStatus === 'rejected' ? 'bg-[#ef4444]' :
                                      rec.reviewStatus === 'removed' ? 'bg-[#94a3b8]' :
                                        'bg-[#f97316] ring-2 ring-[#f97316]/30' // Orange for Pending
                                      }`} />
                                  </div>

                                  {/* Visual: Text + Arrow */}
                                  <span className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${rec.reviewStatus === 'rejected' ? 'text-[#ef4444]' :
                                    rec.reviewStatus === 'removed' ? 'text-[#64748b]' :
                                      'text-[#f97316]'
                                    }`}>
                                    {rec.reviewStatus === 'rejected' ? 'Rejected' :
                                      rec.reviewStatus === 'removed' ? 'Removed' :
                                        'Pending'}
                                    <IconChevronDown size={10} stroke={3} className="opacity-70" />
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                        {showActions && (
                          <td className="px-4 py-3">
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
                      {isExpanded && (
                        <tr key={`${recId}-details`} className="bg-white">
                          <td colSpan={showCheckboxes ? (showStatusDropdown ? (showActions ? 6 : 5) : (showActions ? 5 : 4)) : (showStatusDropdown ? (showActions ? 5 : 4) : (showActions ? 4 : 3))} className="px-0 py-0">
                            {/* Content Area - Unified with table row */}
                            {renderExpandedContent ? (
                              <div className="border-t border-[#e2e8f0]">
                                {renderExpandedContent(rec)}
                              </div>
                            ) : (

                              <div className="flex">
                                {/* Left Sidebar - Quick Stats */}
                                <div className="w-48 bg-[#f8fafc] border-r border-[#e2e8f0] p-4 flex-shrink-0">
                                  <div className="space-y-4">
                                    {/* Confidence */}
                                    {rec.confidence !== undefined && rec.confidence !== null && (
                                      <div>
                                        <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wide mb-1.5">Confidence</p>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-[#e2e8f0] rounded-full h-1.5 overflow-hidden">
                                            <div
                                              className="h-full bg-gradient-to-r from-[#00bcdc] to-[#0891b2] rounded-full"
                                              style={{ width: `${rec.confidence}%` }}
                                            />
                                          </div>
                                          <span className="text-[12px] font-bold text-[#0f172a]">{rec.confidence}%</span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Timeline */}
                                    {rec.timeline && (
                                      <div>
                                        <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wide mb-1">Timeline</p>
                                        <p className="text-[13px] font-semibold text-[#0f172a]">{rec.timeline}</p>
                                      </div>
                                    )}

                                    {/* Effort */}
                                    {rec.effort && (
                                      <div>
                                        <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wide mb-1">Effort</p>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${rec.effort === 'Low' ? 'bg-[#d1fae5] text-[#065f46]' :
                                          rec.effort === 'Medium' ? 'bg-[#fef3c7] text-[#92400e]' :
                                            'bg-[#fee2e2] text-[#991b1b]'
                                          }`}>
                                          {rec.effort}
                                        </span>
                                      </div>
                                    )}

                                    {/* Expected Boost */}
                                    {rec.expectedBoost && (
                                      <div>
                                        <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wide mb-1">Expected Boost</p>
                                        {rec.expectedBoost.trim().startsWith('{') ? (
                                          <div className="space-y-1.5 mt-1.5">
                                            {(() => {
                                              try {
                                                const boostObj = JSON.parse(rec.expectedBoost);
                                                return Object.entries(boostObj).map(([key, val]) => (
                                                  <div key={key} className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-medium text-[#64748b] truncate">{key}</span>
                                                    <span className="text-[11px] font-bold text-[#06c686] flex-shrink-0 bg-[#06c686]/10 px-1.5 py-0.5 rounded text-center min-w-[32px]">{String(val)}</span>
                                                  </div>
                                                ));
                                              } catch (e) {
                                                return <p className="text-[12px] font-medium text-[#0f172a] leading-snug">{rec.expectedBoost}</p>;
                                              }
                                            })()}
                                          </div>
                                        ) : (
                                          <p className="text-[12px] font-medium text-[#0f172a] leading-snug">{rec.expectedBoost}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right Content - Details */}
                                <div className="flex-1 p-5 space-y-4">
                                  {/* Why This Matters */}
                                  {(rec.reason || rec.explanation) && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="w-5 h-5 rounded bg-[#f1f5f9] flex items-center justify-center">
                                          <svg className="w-3 h-3 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                          </svg>
                                        </div>
                                        <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Why This Matters</p>
                                      </div>
                                      <p className="text-[13px] text-[#374151] leading-relaxed">{rec.reason}</p>
                                      {rec.explanation && (
                                        <p className="text-[12px] text-[#64748b] mt-2 pl-7">{rec.explanation}</p>
                                      )}
                                    </div>
                                  )}

                                  {/* Cross-Channel Strategy */}
                                  {rec.focusSources && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="w-5 h-5 rounded bg-[#f1f5f9] flex items-center justify-center">
                                          <svg className="w-3 h-3 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                        </div>
                                        <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Cross-Channel Strategy</p>
                                      </div>
                                      <p className="text-[13px] text-[#374151] leading-relaxed">{rec.focusSources}</p>
                                    </div>
                                  )}

                                  {/* How to Fix */}
                                  {rec.howToFix && rec.howToFix.length > 0 && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="w-5 h-5 rounded bg-[#f1f5f9] flex items-center justify-center">
                                          <svg className="w-3 h-3 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </svg>
                                        </div>
                                        <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Implementation Steps</p>
                                      </div>
                                      <ol className="space-y-1.5 pl-7">
                                        {rec.howToFix.map((step, i) => (
                                          <li key={i} className="flex items-start gap-2">
                                            <span className="w-5 h-5 rounded-full bg-[#00bcdc] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                            <span className="text-[13px] text-[#374151]">{step}</span>
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
