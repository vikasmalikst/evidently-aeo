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
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { RecommendationV3 } from '../../api/recommendationsV3Api';

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
  onStatusChange?: (recommendationId: string, status: 'pending_review' | 'approved' | 'rejected') => void;
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
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider w-[200px]">
                Source/Domain
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider w-[120px]">
                Focus Area
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider w-[120px]">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider w-[120px]">
                Effort Level
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
                <td colSpan={showCheckboxes ? (showStatusDropdown ? (showActions ? 8 : 7) : (showActions ? 7 : 6)) : (showStatusDropdown ? (showActions ? 7 : 6) : (showActions ? 6 : 5))} className="px-6 py-12 text-center text-sm text-[var(--text-caption)]">
                  No recommendations found
                </td>
              </tr>
            ) : (
              recommendations.map((rec, index) => {
                const recId = rec.id || `rec-${index}`;
                const isExpanded = expandedRows.has(recId);
                const hasDetails = rec.reason || rec.explanation || rec.expectedBoost || rec.impactScore || rec.kpi;
                
                return (
                  <>
                    <tr
                      key={recId}
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
                        <div className="flex items-center gap-2">
                          {hasDetails && (
                            <button
                              onClick={() => toggleExpand(recId)}
                              className="p-1 hover:bg-[#e2e8f0] rounded transition-colors"
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? (
                                <IconChevronUp size={16} className="text-[#64748b]" />
                              ) : (
                                <IconChevronDown size={16} className="text-[#64748b]" />
                              )}
                            </button>
                          )}
                          <p className="text-[13px] text-[var(--text-headings)] font-medium leading-snug">
                            {rec.action}
                          </p>
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
                      <td className="px-4 py-4">
                        <PriorityBadge priority={rec.priority} />
                      </td>
                      <td className="px-4 py-4">
                        <EffortBadge effort={rec.effort} />
                      </td>
                      {showStatusDropdown && (
                        <td className="px-4 py-4">
                          <div className="relative">
                            <select
                              value={rec.reviewStatus || 'pending_review'}
                              onChange={(e) => {
                                const newStatus = e.target.value as 'pending_review' | 'approved' | 'rejected';
                                if (rec.id && onStatusChange) {
                                  onStatusChange(rec.id, newStatus);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Change status for ${rec.action?.substring(0, 30)}`}
                              className={`w-full pl-9 pr-8 py-2 border rounded-lg text-[13px] font-medium cursor-pointer transition-all appearance-none focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                rec.reviewStatus === 'approved'
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
                            </select>
                            {/* Status indicator dot */}
                            <div
                              className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                                rec.reviewStatus === 'approved'
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
                        </td>
                      )}
                    </tr>
                    {isExpanded && hasDetails && (
                      <tr key={`${recId}-details`} className="bg-[#f8fafc]">
                        <td colSpan={showCheckboxes ? (showStatusDropdown ? (showActions ? 8 : 7) : (showActions ? 7 : 6)) : (showStatusDropdown ? (showActions ? 7 : 6) : (showActions ? 6 : 5))} className="px-4 py-4">
                          <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Why this matters */}
                            <div className="space-y-2">
                              <p className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide">Why this matters</p>
                              <ul className="list-disc pl-5 space-y-1">
                                {rec.reason && (
                                  <li className="text-[13px] text-[#0f172a]">{rec.reason}</li>
                                )}
                                {rec.explanation && (
                                  <li className="text-[13px] text-[#0f172a]">{rec.explanation}</li>
                                )}
                              </ul>
                            </div>

                            {/* Proof & metrics */}
                            <div className="space-y-2">
                              <p className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide">Proof & metrics</p>
                              <ul className="list-disc pl-5 space-y-1">
                                {rec.citationSource && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Target source:</span>
                                    <span className="text-[#0f172a]">{rec.citationSource}</span>
                                  </li>
                                )}
                                {rec.impactScore && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Impact score:</span>
                                    <span className="text-[#0f172a]">{rec.impactScore}</span>
                                  </li>
                                )}
                                {rec.mentionRate && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Mentions:</span>
                                    <span className="text-[#0f172a]">{rec.mentionRate}</span>
                                  </li>
                                )}
                                {rec.citationCount !== undefined && rec.citationCount !== null && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Citations:</span>
                                    <span className="text-[#0f172a]">{rec.citationCount}</span>
                                  </li>
                                )}
                                {rec.soa && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">SOA:</span>
                                    <span className="text-[#0f172a]">{rec.soa}</span>
                                  </li>
                                )}
                                {rec.sentiment && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Sentiment:</span>
                                    <span className="text-[#0f172a]">{rec.sentiment}</span>
                                  </li>
                                )}
                                {rec.visibilityScore && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Visibility:</span>
                                    <span className="text-[#0f172a]">{rec.visibilityScore}</span>
                                  </li>
                                )}
                              </ul>
                            </div>

                            {/* Focus & plan */}
                            <div className="space-y-2">
                              <p className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide">Focus & plan</p>
                              <ul className="list-disc pl-5 space-y-1">
                                {rec.kpi && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Primary KPI:</span>
                                    <span className="text-[#0f172a]">{rec.kpi} {rec.expectedBoost ? `(${rec.expectedBoost})` : ''}</span>
                                  </li>
                                )}
                                {rec.focusSources && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Focus sources:</span>
                                    <span className="text-[#0f172a]">{rec.focusSources}</span>
                                  </li>
                                )}
                                {rec.contentFocus && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Content angle:</span>
                                    <span className="text-[#0f172a]">{rec.contentFocus}</span>
                                  </li>
                                )}
                              </ul>
                            </div>

                            {/* Timing & confidence */}
                            <div className="space-y-2">
                              <p className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide">Timing & confidence</p>
                              <ul className="list-disc pl-5 space-y-1">
                                {rec.effort && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Effort:</span>
                                    <span className="text-[#0f172a]">{rec.effort}</span>
                                  </li>
                                )}
                                {rec.timeline && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Timeline:</span>
                                    <span className="text-[#0f172a]">{rec.timeline}</span>
                                  </li>
                                )}
                                {rec.confidence !== undefined && rec.confidence !== null && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Confidence:</span>
                                    <span className="text-[#0f172a]">{rec.confidence}%</span>
                                  </li>
                                )}
                                {rec.expectedBoost && (
                                  <li className="text-[13px] text-[#0f172a]">
                                    <span className="font-semibold text-[#475569] mr-1">Expected boost:</span>
                                    <span className="text-[#06c686]">{rec.expectedBoost}</span>
                                  </li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

