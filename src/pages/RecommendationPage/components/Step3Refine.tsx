
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    IconMinus,
    IconPlus,
    IconTrash,
    IconFileText,
    IconVideo,
    IconTable,
    IconSocial,
    IconCheck,
    IconChevronDown,
    IconChevronUp
} from '@tabler/icons-react';
import { useRecommendationContext } from '../RecommendationContext';
import { UnifiedContentRenderer } from '../../../components/RecommendationsV3/components/ContentSectionRenderer';
import { AEOScoreBadge } from '../../../components/RecommendationsV3/components/ContentAnalysisTools';
import { ContentAnalysisSidebar } from './ContentAnalysisSidebar';
import { SafeLogo } from '../../../components/Onboarding/common/SafeLogo';
import {
    updateRecommendationStatusV3,
    completeRecommendationV3,
    type RecommendationV3
} from '../../../api/recommendationsV3Api';

export const Step3Refine: React.FC = () => {
    const {
        recommendations,
        isColdStart,
        guideMap,
        contentMap,
        setContentMap,
        expandedRecId,
        setExpandedRecId,
        handleStatusChange,
        setCurrentStep,
        setError,
        setRecommendations,
        brandName
    } = useRecommendationContext();

    const [scorePanel, setScorePanel] = useState<{
        isOpen: boolean;
        content: string;
        brandName?: string;
        contentType?: string;
    }>({
        isOpen: false,
        content: '',
        brandName: '',
        contentType: 'article'
    });

    const [sectionFeedbackMap, setSectionFeedbackMap] = useState<Map<string, Map<string, string>>>(new Map());

    // Helper: Safely parse JSON
    const safeJsonParse = (value: any): any => {
        if (!value || typeof value !== 'string') return value;
        try { return JSON.parse(value); } catch { return value; }
    };

    const extractGuideObject = (raw: any): any => {
        if (raw && typeof raw === 'object' && 'content' in raw) {
            return safeJsonParse(raw.content);
        }
        return safeJsonParse(raw);
    };

    // Helper to extract clean text content for analysis
    const extractVisibleContent = (content: any): string => {
        if (!content) return '';
        if (typeof content === 'string') {
            // Check if it's JSON
            if (content.trim().startsWith('{')) {
                const parsed = safeJsonParse(content);
                if (parsed && typeof parsed === 'object') {
                    return extractVisibleContent(parsed);
                }
            }
            return content;
        }
        if (typeof content === 'object') {
            if (content.content && typeof content.content === 'string') {
                return extractVisibleContent(content.content);
            }
            // If sections array
            if (Array.isArray(content.sections)) {
                return content.sections.map((s: any) => `${s.title}\n${s.content}`).join('\n\n');
            }
        }
        return '';
    };

    const getTemplateForAction = (rec: RecommendationV3): string => {
        if (rec.assetType) return rec.assetType;
        const action = rec.action.toLowerCase();
        if (action.includes('video')) return 'short_video';
        if (action.includes('article') || action.includes('blog')) return 'article';
        if (action.includes('whitepaper') || action.includes('guide')) return 'whitepaper';
        if (action.includes('comparison')) return 'comparison_table';
        return 'article';
    };

    const getContentIcon = (type: string) => {
        switch (type) {
            case 'short_video':
            case 'video':
                return <IconVideo size={20} className="text-rose-500" />;
            case 'comparison_table':
            case 'table':
                return <IconTable size={20} className="text-blue-500" />;
            case 'social':
            case 'social_post':
                return <IconSocial size={20} className="text-purple-500" />;
            case 'whitepaper':
            case 'guide':
                return <IconFileText size={20} className="text-orange-500" />;
            case 'article':
            default:
                return <IconFileText size={20} className="text-emerald-500" />;
        }
    };

    const cleanActionText = (text: string) => {
        return text.replace(/^\[.*?\]\s*/, '').trim();
    };

    const handleToggleComplete = async (rec: RecommendationV3) => {
        if (!rec.id) return;

        // Optimistic update
        const updatedRec = { ...rec, isCompleted: !rec.isCompleted };
        setRecommendations(prev => prev.map(r => r.id === rec.id ? updatedRec : r));

        // If completing, maybe remove from list? Original logic kept it but marked completed.
        // We will keep it but animate.

        try {
            // Note: API for complete/uncomplete
            const response = await completeRecommendationV3(rec.id);
            if (!response.success) {
                // Revert
                setRecommendations(prev => prev.map(r => r.id === rec.id ? rec : r));
                setError?.(response.error || 'Failed to update completion status');
            } else {
                if (!rec.isCompleted) {
                    // Navigate to step 4 or show success? 
                    // Original code waited for user to navigate manually or showed success modal
                    // We'll leave it in the list as completed
                }
            }
        } catch (err: any) {
            setRecommendations(prev => prev.map(r => r.id === rec.id ? rec : r));
            setError?.(err.message);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
        >
            <div className="mb-8">
                <h2 className="text-[20px] font-bold text-[#0f172a]">Review and Refine</h2>
                <p className="text-[14px] text-[#64748b] mt-1">
                    {isColdStart
                        ? 'Cold-start brands skip content generation. Use previous step for implementation guides.'
                        : 'Review generated content and finalize for publication'}
                </p>
            </div>

            {isColdStart && (
                <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-6 mb-6">
                    <p className="text-[13px] text-[#0f172a]">
                        This step is not used for <span className="font-semibold">cold_start</span>. Your execution guides live in Step 2.
                    </p>
                    <div className="mt-4 flex gap-3">
                        <button onClick={() => setCurrentStep(2)} className="px-4 py-2 bg-[#00bcdc] text-white rounded-lg text-sm font-semibold hover:bg-[#00a8c6]">Go to Step 2</button>
                    </div>
                </div>
            )}

            {/* List of Recommendations */}
            <div className="space-y-4">
                <AnimatePresence>
                    {recommendations.map(rec => {
                        const guideRaw = rec.id ? guideMap.get(rec.id) : null;
                        const guideObj = extractGuideObject(guideRaw);
                        const content = rec.id ? contentMap.get(rec.id) : null;
                        const visibleContent = extractVisibleContent(content);
                        const hasContent = !!visibleContent && visibleContent.length > 50;
                        const contentType = getTemplateForAction(rec);
                        const isExpanded = expandedRecId === rec.id;

                        // Logic for displaying guide vs content
                        // For cold start we show guide, for normal we show content editor

                        // Simplified for brevity - in real app we'd copy the full render logic
                        // For now, let's assume we render the Accordion Item structure

                        return (
                            <motion.div
                                key={rec.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 100 }}
                                className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ${isExpanded ? 'border-[#0ea5e9] shadow-md ring-1 ring-[#0ea5e9]/10' : 'border-[#e2e8f0] hover:border-[#cbd5e1]'
                                    }`}
                            >
                                <div
                                    className={`px-5 py-4 cursor-pointer transition-colors ${isExpanded ? 'bg-[#f8fafc]' : 'bg-white hover:bg-[#f8fafc]'
                                        }`}
                                    onClick={() => setExpandedRecId(isExpanded ? null : (rec.id || null))}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Icon Column */}
                                        <div className="mt-0.5 flex-shrink-0 opacity-80">
                                            {getContentIcon(contentType)}
                                        </div>

                                        {/* Content Column */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <h3 className={`text-[15px] font-medium leading-relaxed pr-8 ${rec.isCompleted ? 'text-[#94a3b8] line-through' : 'text-[#1e293b]'
                                                    }`}>
                                                    {cleanActionText(rec.action)}
                                                </h3>

                                                <div className="flex-shrink-0 text-[#94a3b8]">
                                                    {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>


                                    {/* Action Bar (Only visible when Expanded OR if Completed) */}
                                    {/* Actually, let's keep actions visible but subtle */}
                                    <div className="mt-3 flex items-center justify-between gap-2 pl-9">
                                        {/* Domain / Source Display (Left) */}
                                        <div className="flex items-center gap-2">
                                            {rec.citationSource && (
                                                <>
                                                    <div className="w-5 h-5 rounded-md bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-200">
                                                        <SafeLogo 
                                                            domain={rec.citationSource}
                                                            alt={rec.citationSource} 
                                                            className="w-3.5 h-3.5 object-contain" 
                                                            size={14} 
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-500 truncate max-w-[120px]">{rec.citationSource}</span>
                                                </>
                                            )}
                                        </div>

                                        {/* Actions (Right) */}
                                        <div className="flex items-center gap-2">
                                        {!rec.isCompleted ? (
                                            <div className="flex items-center gap-2">
                                                {/* AEO Score Badge - Temporarily Hidden
                                                 {!isColdStart && hasContent && (
                                                     <div className="mr-2" onClick={(e) => e.stopPropagation()}>
                                                         <AEOScoreBadge
                                                             content={visibleContent}
                                                             brandName={brandName}
                                                             contentType={contentType}
                                                             onClick={() => setScorePanel({
                                                                 isOpen: true,
                                                                 content: visibleContent,
                                                                 brandName: brandName,
                                                                 contentType: contentType
                                                             })}
                                                         />
                                                     </div>
                                                 )}
                                                 */}

                                                {/* Regenerate Button - Only visible when there's feedback */}
                                                {(rec.id && (sectionFeedbackMap.get(rec.id)?.size || 0) > 0) && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!rec.id) return;

                                                            const feedbackMap = sectionFeedbackMap.get(rec.id);
                                                            if (!feedbackMap || feedbackMap.size === 0) return;

                                                            const feedbackString = Array.from(feedbackMap.entries())
                                                                .map(([section, note]) => `[SECTION: ${section}] ${note}`)
                                                                .join('\n\n');

                                                            if (!confirm('Regenerate content based on your feedback? This will overwrite the current version.')) return;

                                                            try {
                                                                const { regenerateContentV3 } = await import('../../../api/recommendationsV3Api');
                                                                const response = await regenerateContentV3(rec.id, feedbackString);

                                                                if (response.success && response.data) {
                                                                    const newContent = response.data.content;
                                                                    setContentMap(prev => new Map(prev).set(rec.id!, newContent));
                                                                    setSectionFeedbackMap(prev => {
                                                                        const next = new Map(prev);
                                                                        next.delete(rec.id!);
                                                                        return next;
                                                                    });
                                                                    alert('Content regenerated successfully!');
                                                                } else {
                                                                    alert('Failed to regenerate: ' + (response.error || 'Unknown error'));
                                                                }
                                                            } catch (err: any) {
                                                                console.error(err);
                                                                alert('Error regenerating content: ' + err.message);
                                                            }
                                                        }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg text-[12px] font-medium transition-all shadow-sm"
                                                        title="Refine content based on your feedback"
                                                    >
                                                        <IconPlus size={14} className="text-amber-500" />
                                                        <span>Refine with feedback</span>
                                                    </button>
                                                )}

                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (confirm('Stop tracking?')) handleStatusChange(rec.id!, 'removed'); }}
                                                    className="p-1.5 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fee2e2] rounded-lg transition-colors"
                                                    title="Remove Recommendation"
                                                >
                                                    <IconTrash size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleToggleComplete(rec); }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e2e8f0] text-[#64748b] rounded-lg text-[12px] font-medium hover:bg-[#06c686] hover:text-white hover:border-[#06c686] transition-all shadow-sm"
                                                >
                                                    <IconCheck size={14} />
                                                    <span>Mark Complete</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-[#f0fdf4] text-[#166534] rounded-full text-[12px] font-medium border border-[#bbf7d0]">
                                                <IconCheck size={12} stroke={3} />
                                                Completed
                                            </span>
                                        )}
                                        </div>
                                    </div>
                                </div>
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.div
                                            key="content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                                            className="overflow-hidden"
                                        >
                                            <div className="border-t border-[#e2e8f0]">
                                                {/* Content Display Logic */}
                                                {isColdStart ? (
                                                    guideObj ? (
                                                        <div className="p-6 text-sm">
                                                            {/* Render Guide Object fields - Summary, Plan, etc. */}
                                                            <p className="font-semibold text-[#1e293b] mb-2">Goal: {guideObj?.summary?.goal || 'N/A'}</p>
                                                            <div className="bg-[#0f172a] rounded-lg overflow-hidden">
                                                                <div className="flex items-center px-4 py-2 bg-[#1e293b] border-b border-[#334155]">
                                                                    <span className="text-[11px] font-mono text-[#94a3b8]">JSON Data</span>
                                                                </div>
                                                                <pre className="p-4 text-[11px] font-mono text-[#e2e8f0] overflow-auto max-h-96 custom-scrollbar">
                                                                    {JSON.stringify(guideObj, null, 2)}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    ) : <div className="p-6 text-sm text-[#ef4444]">Guide content not found.</div>
                                                ) : (
                                                    <div className="text-sm">
                                                        {rec.id && contentMap.get(rec.id) ? (
                                                            <UnifiedContentRenderer
                                                                content={rec.id ? contentMap.get(rec.id) || '' : ''}
                                                                isEditing={true}
                                                                onContentChange={(newContent) => {
                                                                    if (!rec.id) return;
                                                                    const newMap = new Map(contentMap);
                                                                    newMap.set(rec.id, newContent);
                                                                    setContentMap(newMap);
                                                                }}
                                                                sectionFeedback={rec.id ? (sectionFeedbackMap.get(rec.id) || new Map()) : new Map()}
                                                                onFeedbackChange={(sectionTitle, feedback) => {
                                                                    if (!rec.id) return;
                                                                    setSectionFeedbackMap(prev => {
                                                                        const next = new Map(prev);
                                                                        const recFeedback = next.get(rec.id!) || new Map();
                                                                        recFeedback.set(sectionTitle, feedback);
                                                                        next.set(rec.id!, recFeedback);
                                                                        return next;

                                                                    });
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="p-12 flex flex-col items-center justify-center text-center">
                                                                <div className="w-8 h-8 border-2 border-[#e2e8f0] border-t-[#0ea5e9] rounded-full animate-spin mb-4" />
                                                                <span className="text-[13px] text-[#64748b]">Loading content...</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            <ContentAnalysisSidebar
                isOpen={scorePanel.isOpen}
                onClose={() => setScorePanel(prev => ({ ...prev, isOpen: false }))}
                content={scorePanel.content}
                brandName={scorePanel.brandName}
                contentType={scorePanel.contentType}
            />
        </motion.div>
    );
};
