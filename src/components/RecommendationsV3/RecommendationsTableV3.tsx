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

import React, { useState, useEffect } from 'react';
import { IconChevronDown, IconChevronUp, IconTrash, IconDotsVertical, IconCheck, IconSparkles } from '@tabler/icons-react';
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
  onNavigate?: (step: number, recommendationId?: string) => void;
  initialExpandedId?: string | null;
  customActionLabel?: (recommendation: RecommendationV3) => string;
  customActionType?: (recommendation: RecommendationV3) => string;
}

const JourneyTracker = ({
  rec,
  onNavigate
}: {
  rec: RecommendationV3;
  onNavigate?: (step: number, recommendationId?: string) => void;
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
    stageLabel = 'Approved';
    targetStep = 4;
  } else if (rec.isContentGenerated) {
    currentStage = 3;
    stageLabel = 'Approved';
    targetStep = 3;
  } else {
    // Just approved
    currentStage = 2;
    stageLabel = 'Approved';
    targetStep = 2;
  }

  return (<div
    className="flex flex-col items-start justify-center cursor-pointer group py-1"
    onClick={(e) => {
      e.stopPropagation();
      onNavigate?.(targetStep, rec.id);
    }}
  >
    <div className="flex items-center gap-1.5 mb-1.5">
      {[1, 2, 3, 4].map((step) => {
        // Determine step state
        const isComplete = step <= currentStage;
        const isCurrent = step === currentStage;
        const isFuture = step > currentStage;

        // Color grading: Subtle emerald tones
        let dotClass = 'bg-slate-200';
        if (isComplete) {
          dotClass = 'bg-emerald-500';
        }

        return (
          <motion.div
            key={step}
            initial={false}
            animate={{
              scale: isCurrent ? 1.35 : 1,
              opacity: isFuture ? 0.3 : 1
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${dotClass} ${isCurrent ? 'ring-2 ring-emerald-400/30 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : ''
              } ${isComplete ? 'shadow-sm shadow-emerald-200' : ''
              }`}
            style={{
              background: isComplete
                ? 'radial-gradient(circle at 30% 30%, #34d399, #059669)'
                : isFuture
                  ? '#cbd5e1'
                  : undefined
            }}
          />
        );
      })}
    </div>
    <motion.span
      initial={{ opacity: 0.9 }}
      animate={{ opacity: [0.9, 1, 0.9] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide group-hover:text-emerald-700 flex items-center gap-1"
    >
      {stageLabel}
      <strong className="text-xs opacity-60">→</strong>
    </motion.span>
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
  // Elegant text-only: using opacity and weight to create hierarchy
  const styles = {
    High: 'text-slate-900 font-bold opacity-100',
    Medium: 'text-slate-700 font-semibold opacity-80',
    Low: 'text-slate-500 font-medium opacity-60'
  };

  return (
    <span className={`inline-flex items-center text-[10px] uppercase tracking-[0.2em] transition-opacity hover:opacity-100 min-w-[60px] ${styles[priority]}`}>
      {priority}
    </span>
  );
};

const EffortBadge = ({ effort }: { effort: 'Low' | 'Medium' | 'High' }) => {
  // Elegant text-only
  const styles = {
    High: 'text-slate-900 font-bold opacity-100',
    Medium: 'text-slate-700 font-semibold opacity-80',
    Low: 'text-slate-500 font-medium opacity-60'
  };

  return (
    <span className={`inline-flex items-center text-[10px] uppercase tracking-[0.2em] transition-opacity hover:opacity-100 min-w-[60px] ${styles[effort]}`}>
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
  onNavigate,
  initialExpandedId,
  customActionLabel,
  customActionType
}: RecommendationsTableV3Props) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    initialExpandedId ? new Set([initialExpandedId]) : new Set()
  );
  // Only calculate selection state if checkboxes are shown
  const allSelected = showCheckboxes && recommendations.length > 0 && recommendations.every(r => r.id && selectedIds.has(r.id));
  const someSelected = showCheckboxes && recommendations.some(r => r.id && selectedIds.has(r.id));

  // Auto-expand the first recommendation on mount if available
  useEffect(() => {
    // If initialExpandedId is provided, respect it and don't auto-expand first item
    if (initialExpandedId) {
      setExpandedRows(new Set([initialExpandedId]));
      return;
    }

    if (recommendations.length > 0 && recommendations[0].id) {
      setExpandedRows(new Set([recommendations[0].id]));
    }
  }, [recommendations.length, initialExpandedId]); // Only run when recommendations list loads/changes significantly

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
              <th className="px-4 py-4 text-center text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-12">
                #
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider min-w-[400px]">
                Recommendation
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-[200px]">
                Source/Domain
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-[80px]">
                Priority
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-[80px]">
                Effort
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
                <td colSpan={12} className="px-6 py-12 text-center text-sm text-[var(--text-caption)]">
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
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#00bcdc]/5'} hover:bg-[#f0f9ff] transition-all duration-200 cursor-pointer`}
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
                        <td className="px-4 py-6">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#00bcdc] text-white text-[10px] font-bold shadow-sm">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-4 py-6">
                          <div className="flex items-start gap-3">
                            {hasDetails && (
                              <button
                                onClick={() => toggleExpand(recId)}
                                className={`p-1.5 hover:bg-[#00bcdc]/10 rounded-lg transition-all duration-200 flex-shrink-0 mt-0.5 group relative ${!isExpanded && index === 0 ? 'animate-pulse ring-2 ring-[#00bcdc]/30' : ''
                                  }`}
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
                              <p className="text-[14px] text-[#0f172a] font-normal leading-relaxed">
                                {rec.action?.replace(/^\[.*?\]\s*/, '') || rec.contentFocus || 'No action specified'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-6">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex-shrink-0 w-6 h-6 rounded overflow-hidden bg-white border border-slate-100 flex items-center justify-center">
                              <SafeLogo
                                domain={rec.citationSource}
                                className="w-4 h-4 object-contain"
                                size={16}
                                alt={rec.citationSource}
                              />
                            </div>
                            <p className="text-[11px] text-[var(--text-body)] truncate max-w-[150px] leading-tight" title={rec.citationSource}>
                              {rec.citationSource}
                            </p>
                          </div>
                        </td>

                        {/* Priority Column */}
                        <td className="px-4 py-6">
                          {rec.priority && (
                            <PriorityBadge priority={rec.priority} />
                          )}
                        </td>

                        {/* Effort Column */}
                        <td className="px-4 py-6">
                          {rec.effort && (
                            <EffortBadge effort={rec.effort} />
                          )}
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
                                const displayLabel = customActionLabel ? customActionLabel(rec) : actionLabel;
                                const actionTypeValue = customActionType ? customActionType(rec) : actionType;

                                // Action Group Container
                                return (
                                  <div className="flex items-center">
                                    {/* Primary Action Button */}
                                    <div className="relative z-10">
                                      {isGenerating ? (
                                        <motion.span
                                          initial={{ opacity: 0, scale: 0.9 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          className="inline-flex items-center px-3 py-1.5 rounded-l-lg text-[11px] font-semibold border bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200 shadow-sm min-h-[32px]"
                                        >
                                          <motion.div
                                            className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full mr-2"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                                          />
                                          Generating...
                                        </motion.span>
                                      ) : isGenerated ? (
                                        <motion.span
                                          initial={{ opacity: 0, scale: 0.8 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                          className="inline-flex items-center px-3 py-1.5 rounded-l-lg text-[11px] font-semibold border bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-200 shadow-sm min-h-[32px]"
                                        >
                                          <IconCheck size={14} className="mr-1.5" />
                                          {generatedLabel}
                                        </motion.span>
                                      ) : (
                                        <motion.button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onAction(rec, actionTypeValue);
                                          }}
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                          className="flex items-center px-3 py-1.5 rounded-l-lg text-[11px] font-bold border-y border-l border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm hover:shadow-md hover:from-emerald-400 hover:to-teal-400 transition-all min-h-[32px]"
                                        >
                                          <IconSparkles size={14} className="mr-1.5" />
                                          {displayLabel}
                                        </motion.button>
                                      )}
                                    </div>

                                    {/* Secondary Actions Menu Trigger */}
                                    <div className="relative group/menu border-l border-white/20 -ml-px z-0">
                                      <button
                                        className={`flex items-center justify-center w-8 h-[32px] rounded-r-lg border-y border-r transition-colors ${isGenerated
                                          ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                          : isGenerating
                                            ? 'bg-orange-50 border-amber-200 hover:bg-orange-100'
                                            : 'bg-teal-500 border-teal-500 text-white hover:bg-teal-400'
                                          }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Toggle menu logic could go here if not using CSS hover
                                        }}
                                      >
                                        <IconDotsVertical size={16} className={isGenerated || isGenerating ? 'text-slate-600' : 'text-white'} />
                                      </button>

                                      {/* Dropdown Menu */}
                                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 transform origin-top-right z-50">
                                        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">More Actions</p>
                                        </div>

                                        {/* Status: Pending Review */}
                                        {onStatusChange && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (rec.id) onStatusChange(rec.id, 'pending_review');
                                            }}
                                            className="w-full text-left px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 hover:text-[#00bcdc] flex items-center gap-2 transition-colors"
                                          >
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                                            Move to Pending Review
                                          </button>
                                        )}

                                        {/* Stop Tracking */}
                                        {onStopTracking && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (rec.id) onStopTracking(rec.id);
                                            }}
                                            className="w-full text-left px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors rounded-b-lg border-t border-slate-100"
                                          >
                                            <IconTrash size={14} />
                                            Stop Tracking
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                        )}

                      </motion.tr>
                      {isExpanded && (
                        <tr key={`${recId}-details`} className="bg-white">
                          <td colSpan={showCheckboxes ? (showStatusDropdown ? (showActions ? 8 : 7) : (showActions ? 7 : 6)) : (showStatusDropdown ? (showActions ? 7 : 6) : (showActions ? 6 : 5))} className="px-0 py-0">
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
