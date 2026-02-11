
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IconCheck, IconArrowLeft, IconRobot, IconPaperclip, IconPlus, IconLoader2, IconFileText, IconTrash } from '@tabler/icons-react';
import { useRecommendationContext } from '../RecommendationContext';
import { RecommendationsTableV3 } from '../../../components/RecommendationsV3/RecommendationsTableV3';
import { ContentStructureInlineEditor } from '../../../components/RecommendationsV3/components/ContentStructureInlineEditor';
import { 
    generateGuideV3, 
    generateStrategyV3, 
    generateContentV3,
    saveContentDraftV3,
    type RecommendationV3,
    type StructureSection
} from '../../../api/recommendationsV3Api';
import { getTemplateForAction, getContentTemplates } from '../../../components/RecommendationsV3/data/structure-templates';
import { invalidateCache } from '../../../lib/apiCache';
import { fetchRecommendationContentLatest } from '../../../api/recommendationsApi';
import { getRecommendationsByStepV3 } from '../../../api/recommendationsV3Api';

export const Step2Strategy: React.FC = () => {
    const { 
        recommendations, 
        isColdStart, 
        handleStatusChange,
        handleNavigate,
        brandName,
        strategyPlans,
        setStrategyPlans,
        setError,
        generationId,
        setRecommendations,
        setCurrentStep,
        setExpandedRecId,
        setExpandedSections,
        setContentMap,
        setGuideMap,
        setIsLoading,
        uploadingContextRecId,
        removingContextFileId,
        handleUploadContext,
        handleRemoveContextFile
    } = useRecommendationContext();

    const [generatingContentIds, setGeneratingContentIds] = useState<Set<string>>(new Set());
    const [generatingStrategyIds, setGeneratingStrategyIds] = useState<Set<string>>(new Set());
    const [customizedStructures, setCustomizedStructures] = useState<Map<string, StructureSection[]>>(new Map());
    const [targetExpandedId, setTargetExpandedId] = useState<string | null>(null);

    // --- Content Generation Logic (Extracted from RecV3) ---

    const handleGenerateGuide = async (recommendation: RecommendationV3, action: string) => {
        if (!recommendation.id || action !== 'generate-guide') return;
        if (generatingContentIds.has(recommendation.id)) return;

        setGeneratingContentIds(prev => new Set(prev).add(recommendation.id!));
        setError?.(null);

        try {
            const response = await generateGuideV3(recommendation.id);
            if (response.success && response.data) {
                 const record = response.data.content;
                 const raw = record?.content ?? record;
                 // Parse if string
                 let parsed = raw;
                 if (typeof raw === 'string') {
                     try { parsed = JSON.parse(raw); } catch {}
                 }
                 setGuideMap(prev => new Map(prev).set(recommendation.id!, parsed));
                 
                 // Manually reload step 3 data to ensure consistency and navigate
                 if (generationId) {
                     const step3Response = await getRecommendationsByStepV3(generationId, 3);
                     if (step3Response.success && step3Response.data?.recommendations) {
                         const recsWithIds = step3Response.data.recommendations
                            .filter(rec => rec.id && rec.id.length > 10)
                            .map(rec => ({ ...rec, id: rec.id! }));
                         setRecommendations(recsWithIds);
                         setCurrentStep(3);
                     }
                 }
            } else {
                setError?.(response.error || 'Failed to generate guide');
            }
        } catch (err: any) {
             setError?.(err.message || 'Failed to generate guide');
        } finally {
            setGeneratingContentIds(prev => {
                const next = new Set(prev);
                next.delete(recommendation.id!);
                return next;
            });
        }
    };

    const handleGenerateStrategy = async (recommendation: RecommendationV3) => {
        if (!recommendation.id || generatingStrategyIds.has(recommendation.id)) return;
        const contentType = getTemplateForAction(recommendation.action, recommendation.assetType);
        if (!contentType) return;

        setGeneratingStrategyIds(prev => new Set(prev).add(recommendation.id!));
        setError?.(null);

        try {
             const templates = getContentTemplates({
                brandName: brandName,
                competitors: recommendation.competitors_target?.map((c: any) => 
                  typeof c === 'string' ? c : c.name
                ).filter(Boolean) || []
              });
              const templateSections = templates[contentType];
              if (!templateSections) throw new Error(`No template found for ${contentType}`);

              const response = await generateStrategyV3(recommendation.id, {
                  templateSections,
                  contentType
              });

              if (response.success && response.data) {
                  setStrategyPlans(prev => new Map(prev).set(recommendation.id!, response.data!));
                  setCustomizedStructures(prev => new Map(prev).set(recommendation.id!, response.data!.structure));
              } else {
                  setError?.(response.error || 'Failed to generate strategy');
              }
        } catch (err: any) {
            setError?.(err.message || 'Failed to generate strategy');
        } finally {
            setGeneratingStrategyIds(prev => {
                const next = new Set(prev);
                next.delete(recommendation.id!);
                return next;
            });
        }
    };

    const handleGenerateContent = async (recommendation: RecommendationV3, action: string) => {
        if (!recommendation.id || action !== 'generate-content') return;
        
        const sections = customizedStructures.get(recommendation.id) || [];
        
        setGeneratingContentIds(prev => new Set(prev).add(recommendation.id!));
        setError?.(null);

        try {
            const response = await generateContentV3(recommendation.id, { 
                contentType: 'draft', 
                structureConfig: { sections } 
            });

            if (response.success && response.data) {
                setContentMap(prev => new Map(prev).set(recommendation.id!, response.data.content));
                
                // Navigate to Step 3
                if (generationId) {
                     const step3Response = await getRecommendationsByStepV3(generationId, 3);
                     if (step3Response.success && step3Response.data?.recommendations) {
                        const recsWithIds = step3Response.data.recommendations
                            .filter(rec => rec.id && rec.id.length > 10)
                            .map(rec => ({ ...rec, id: rec.id! }));
                            
                        setRecommendations(recsWithIds);
                        setExpandedRecId(recommendation.id);
                        setExpandedSections(new Map());
                        setCurrentStep(3);
                     }
                }
            } else {
                setError?.(response.error || 'Failed to generate content');
            }
        } catch (err: any) {
            setError?.(err.message || 'Failed to generate content');
        } finally {
             setGeneratingContentIds(prev => {
                const next = new Set(prev);
                next.delete(recommendation.id!);
                return next;
            });
        }
    };

    // Render Expanded Content (Inline Editor)
    const renderStep2ExpandedContent = (recommendation: RecommendationV3) => {
        const strategyPlan = strategyPlans.get(recommendation.id!);
        const isGeneratingStrategy = generatingStrategyIds.has(recommendation.id!);
        const hasRealStrategy = !!strategyPlan && Array.isArray((strategyPlan as any).structure);

        return (
             <div className="space-y-4">
                {/* Context Upload */}
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
                   <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                           <IconPaperclip size={16} /> Context Documents
                        </h4>
                        <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors ${uploadingContextRecId === recommendation.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                           {uploadingContextRecId === recommendation.id ? (
                               <><IconLoader2 size={14} className="animate-spin" /> Uploading...</>
                           ) : (
                               <><IconPlus size={14} /> Add Document</>
                           )}
                           <input type="file" className="hidden" accept=".pdf,.txt,.docx,.md" disabled={uploadingContextRecId === recommendation.id} onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (file) handleUploadContext(recommendation.id!, file);
                               e.target.value = '';
                           }} />
                        </label>
                   </div>
                   {strategyPlan?.contextFiles?.length ? (
                       <div className="space-y-2">
                           {strategyPlan.contextFiles.map((file: any) => (
                               <div key={file.id} className="flex items-center justify-between bg-white border border-slate-200 rounded p-2 text-xs">
                                   <div className="flex items-center gap-2"><IconFileText size={14} className="text-slate-400" /> <span className="truncate text-slate-600">{file.name}</span></div>
                                   <button onClick={() => handleRemoveContextFile(recommendation.id!, file.id)} disabled={removingContextFileId === file.id} className="text-slate-500 hover:text-red-600"><IconTrash size={14}/></button>
                               </div>
                           ))}
                       </div>
                   ) : <p className="text-xs text-slate-500 italic">Upload context files relevant to this recommendation.</p>}
                </div>

                {/* Strategy Generation Button or Editor */}
                {!hasRealStrategy ? (
                     <div className="-mt-2 bg-gradient-to-br from-cyan-50 via-teal-50 to-cyan-50 border-2 border-t-0 border-cyan-200 rounded-b-xl p-8 text-center">
                        <p className="text-sm text-gray-600 mb-4">AI will analyze recommendation and generate structure</p>
                        <button 
                            onClick={() => handleGenerateStrategy(recommendation)}
                            disabled={isGeneratingStrategy}
                            className="inline-flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-sm font-bold rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg disabled:opacity-50"
                        >
                            {isGeneratingStrategy ? <><IconLoader2 className="animate-spin" size={18} /> Generating Strategy...</> : <><IconRobot size={18} /> Generate Content Strategy</>}
                        </button>
                     </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ContentStructureInlineEditor
                            recommendationId={recommendation.id!}
                            contentType={getTemplateForAction(recommendation.action, recommendation.assetType)}
                            initialSections={customizedStructures.get(recommendation.id!)}
                            competitors={recommendation.competitors_target?.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean) || []}
                            brandName={brandName}
                            onChange={(sections) => {
                                setCustomizedStructures(prev => new Map(prev).set(recommendation.id!, sections));
                            }}
                            onSave={async (sections) => {
                                setGeneratingContentIds(prev => new Set(prev).add(recommendation.id!));
                                try {
                                    const res = await saveContentDraftV3(recommendation.id!, sections);
                                    if (!res.success) throw new Error(res.error);
                                    invalidateCache(new RegExp(`recommendations-v3/${recommendation.id!}/content`));
                                } finally {
                                    setGeneratingContentIds(prev => { const next = new Set(prev); next.delete(recommendation.id!); return next; });
                                }
                            }}
                            isSaving={generatingContentIds.has(recommendation.id!)}
                        />
                    </div>
                )}
             </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
        >
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[#0f172a] mb-1">Content Generation</h2>
                  <p className="text-[14px] text-[#64748b]">
                    {isColdStart ? 'Generate an execution-ready implementation guide' : 'Approve and generate content for chosen actions'}
                  </p>
                </div>
             </div>

             {recommendations.length === 0 ? (
                <div className="bg-white border border-[#e8e9ed] rounded-xl shadow-sm p-12 text-center">
                   <div className="w-16 h-16 bg-[#f0fdf4] rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconCheck size={32} className="text-[#06c686]" />
                   </div>
                   <h3 className="text-[20px] font-semibold text-[#1a1d29] mb-2">To-Do List is empty</h3>
                   <p className="text-[14px] text-[#64748b] max-w-md mx-auto mb-8">
                       You have no pending tasks. Go back to discover more opportunities.
                   </p>
                   <button onClick={() => setCurrentStep(1)} className="inline-flex items-center gap-2 px-6 py-3 bg-[#00bcdc] text-white rounded-lg text-[14px] font-bold hover:bg-[#00a8c6] transition-all shadow-md">
                       <IconArrowLeft size={18} /> Go back to Discover Opportunities
                   </button>
                </div>
             ) : (
                 <RecommendationsTableV3
                    recommendations={recommendations}
                    showActions={true}
                    onAction={isColdStart ? handleGenerateGuide : handleGenerateContent}
                    actionLabel={isColdStart ? 'Generate Guide' : 'Generate'}
                    actionType={isColdStart ? 'generate-guide' : 'generate-content'}
                    generatedLabel={isColdStart ? 'Guide Ready' : 'Generated'}
                    generatingContentIds={generatingContentIds}
                    onStopTracking={(id) => {
                        if (confirm('Stop tracking?')) handleStatusChange(id, 'removed');
                    }}
                    renderExpandedContent={renderStep2ExpandedContent}
                    initialExpandedId={targetExpandedId}
                 />
             )}
        </motion.div>
    );
};
