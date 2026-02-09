/**
 * PlanReviewInline
 *
 * Inline (non-modal) version of PlanReviewModal.
 * Renders inside the Step 2 expandable table row.
 * Light theme to integrate with the surrounding table UI.
 * Keeps ALL editing, reordering, context-management, and approve functionality.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    IconX, IconCheck, IconRefresh, IconEdit, IconListDetails, IconBrain,
    IconPlus, IconTrash, IconDeviceFloppy, IconArrowUp, IconArrowDown, IconPaperclip
} from '@tabler/icons-react';
import { updateTemplatePlan } from '../../../api/recommendationsV3Api';
import { ContextManagerModal } from './ContextManagerModal';
import { TemplatePlan } from '../../../../backend/src/services/recommendations/recommendation.types';

interface TemplateSection {
    id: string;
    type: 'heading' | 'section' | 'faq' | 'cta';
    heading_level?: 1 | 2 | 3 | 4;
    text_template: string;
    instructions: string[];
    word_count_target?: string;
    keywords_to_include?: string[];
}

interface PlanReviewInlineProps {
    plan: TemplatePlan;
    onApprove: () => void;
    onRegenerate: () => void;
    isProcessing: boolean;
    onPlanUpdated?: (updatedPlan: TemplatePlan) => void;
}

export const PlanReviewInline: React.FC<PlanReviewInlineProps> = ({
    plan,
    onApprove,
    onRegenerate,
    isProcessing,
    onPlanUpdated
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedPlan, setEditedPlan] = useState<TemplatePlan | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
    const [showContextManager, setShowContextManager] = useState(false);

    const currentPlan = isEditing && editedPlan ? editedPlan : plan;

    // ── Editing helpers ──────────────────────────────────────────────
    const startEditing = () => {
        setEditedPlan(JSON.parse(JSON.stringify(plan)));
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setEditedPlan(null);
        setIsEditing(false);
    };

    const saveChanges = async () => {
        if (!editedPlan) return;
        setIsSaving(true);
        try {
            const response = await updateTemplatePlan(editedPlan.recommendationId, editedPlan);
            if (response.success) {
                onPlanUpdated?.(editedPlan);
                setIsEditing(false);
                setEditedPlan(null);
            } else {
                alert(`Error: ${(response as any).error}`);
            }
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const updateSection = (sectionId: string, field: string, value: any) => {
        if (!editedPlan) return;
        setEditedPlan({
            ...editedPlan,
            structure: editedPlan.structure.map(s =>
                s.id === sectionId ? { ...s, [field]: value } : s
            )
        });
    };

    const updateInstruction = (sectionId: string, idx: number, value: string) => {
        if (!editedPlan) return;
        setEditedPlan({
            ...editedPlan,
            structure: editedPlan.structure.map(s => {
                if (s.id === sectionId) {
                    const newInstructions = [...s.instructions];
                    newInstructions[idx] = value;
                    return { ...s, instructions: newInstructions };
                }
                return s;
            })
        });
    };

    const addInstruction = (sectionId: string) => {
        if (!editedPlan) return;
        setEditedPlan({
            ...editedPlan,
            structure: editedPlan.structure.map(s =>
                s.id === sectionId ? { ...s, instructions: [...s.instructions, 'New instruction'] } : s
            )
        });
    };

    const removeInstruction = (sectionId: string, idx: number) => {
        if (!editedPlan) return;
        setEditedPlan({
            ...editedPlan,
            structure: editedPlan.structure.map(s => {
                if (s.id === sectionId) {
                    const kept = s.instructions.filter((_, i) => i !== idx);
                    return { ...s, instructions: kept.length > 0 ? kept : ['Add instruction'] };
                }
                return s;
            })
        });
    };

    const addSection = () => {
        if (!editedPlan) return;
        const newSection: TemplateSection = {
            id: `section_${Date.now()}`,
            type: 'heading',
            heading_level: 2,
            text_template: 'New Section',
            instructions: ['Add instructions here']
        };
        setEditedPlan({ ...editedPlan, structure: [...editedPlan.structure, newSection] });
    };

    const removeSection = (sectionId: string) => {
        if (!editedPlan) return;
        if (editedPlan.structure.length <= 1) { alert('Cannot delete the last section'); return; }
        setSectionToDelete(sectionId);
    };
    const confirmDeleteSection = () => {
        if (!editedPlan || !sectionToDelete) return;
        setEditedPlan({ ...editedPlan, structure: editedPlan.structure.filter(s => s.id !== sectionToDelete) });
        setSectionToDelete(null);
    };
    const cancelDeleteSection = () => setSectionToDelete(null);

    const moveSectionUp = (sectionId: string) => {
        if (!editedPlan) return;
        const idx = editedPlan.structure.findIndex(s => s.id === sectionId);
        if (idx <= 0) return;
        const arr = [...editedPlan.structure];
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        setEditedPlan({ ...editedPlan, structure: arr });
    };
    const moveSectionDown = (sectionId: string) => {
        if (!editedPlan) return;
        const idx = editedPlan.structure.findIndex(s => s.id === sectionId);
        if (idx < 0 || idx >= editedPlan.structure.length - 1) return;
        const arr = [...editedPlan.structure];
        [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
        setEditedPlan({ ...editedPlan, structure: arr });
    };

    const moveInstructionUp = (sectionId: string, i: number) => {
        if (!editedPlan || i <= 0) return;
        setEditedPlan({
            ...editedPlan,
            structure: editedPlan.structure.map(s => {
                if (s.id === sectionId) {
                    const arr = [...s.instructions];
                    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                    return { ...s, instructions: arr };
                }
                return s;
            })
        });
    };
    const moveInstructionDown = (sectionId: string, i: number) => {
        if (!editedPlan) return;
        const sec = editedPlan.structure.find(s => s.id === sectionId);
        if (!sec || i >= sec.instructions.length - 1) return;
        setEditedPlan({
            ...editedPlan,
            structure: editedPlan.structure.map(s => {
                if (s.id === sectionId) {
                    const arr = [...s.instructions];
                    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                    return { ...s, instructions: arr };
                }
                return s;
            })
        });
    };

    const handleContextUpdate = (updatedPlan: TemplatePlan) => {
        onPlanUpdated?.(updatedPlan);
        if (isEditing && editedPlan) {
            setEditedPlan({
                ...editedPlan,
                additional_context: updatedPlan.additional_context,
                context_files: updatedPlan.context_files
            });
        }
    };

    // ── Render ────────────────────────────────────────────────────────
    return (
        <>
            <div className="bg-white">
                {/* Header Bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                            <IconBrain className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-bold text-slate-900">Content Strategy Plan</h3>
                            <p className="text-[12px] text-slate-500">Review the AI-generated plan, then approve to generate content.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowContextManager(true)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5
                            ${(currentPlan.context_files?.length || 0) > 0 || currentPlan.additional_context
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        <IconPaperclip className="w-3.5 h-3.5" />
                        Manage Context
                        {((currentPlan.context_files?.length || 0) > 0 || currentPlan.additional_context) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                    {/* Strategy Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Channel</div>
                            <div className="text-[13px] font-semibold text-slate-900">
                                {currentPlan.targetChannel}
                                {currentPlan.content_type && (
                                    <>
                                        <span className="text-slate-300 mx-1.5">&middot;</span>
                                        <span className="text-slate-600 capitalize">{currentPlan.content_type.replace(/_/g, ' ')}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Entity Focus</div>
                            <div className="text-[13px] font-semibold text-slate-900">{currentPlan.primary_entity}</div>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">AEO Targets</div>
                            <div className="flex gap-2 mt-1 flex-wrap">
                                {currentPlan.aeo_extraction_targets?.snippet?.required && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Snippet</span>
                                )}
                                {currentPlan.aeo_extraction_targets?.list?.required && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">List</span>
                                )}
                                {currentPlan.aeo_extraction_targets?.table?.required && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">Table</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Plan of Action */}
                    {currentPlan.action_description && (
                        <div className="bg-indigo-50/60 p-4 rounded-lg border border-indigo-200">
                            <div className="flex items-start gap-3">
                                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
                                    <IconBrain className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1.5">Plan of Action</h4>
                                    <p className="text-[13px] text-slate-700 leading-relaxed">{currentPlan.action_description}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Proposed Content Structure */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                            <IconListDetails className="w-4 h-4 text-indigo-500" />
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Proposed Content Structure</h3>
                        </div>

                        <div className="space-y-2.5 relative">
                            {/* Vertical connector */}
                            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-slate-100 z-0" />

                            {currentPlan.structure.map((section, idx) => (
                                <div
                                    key={section.id}
                                    className="group relative z-10 bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-500 shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {/* Type badges + reorder */}
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border
                                                        ${section.type === 'heading' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                                            section.type === 'faq' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                section.type === 'cta' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                    'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                        {section.type}
                                                    </span>
                                                    {section.heading_level && (
                                                        <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200">H{section.heading_level}</span>
                                                    )}
                                                </div>
                                                {isEditing && (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => moveSectionUp(section.id)} disabled={idx === 0}
                                                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
                                                            <IconArrowUp className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => moveSectionDown(section.id)} disabled={idx === currentPlan.structure.length - 1}
                                                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
                                                            <IconArrowDown className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Section heading */}
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={section.text_template}
                                                    onChange={(e) => updateSection(section.id, 'text_template', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 text-[14px] font-semibold mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                                                />
                                            ) : (
                                                <h4 className="text-[14px] font-semibold text-slate-900 mb-3 leading-snug">{section.text_template}</h4>
                                            )}

                                            {/* Instructions */}
                                            {section.instructions.length > 0 && (
                                                <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Instructions</p>
                                                    {isEditing ? (
                                                        <div className="space-y-2">
                                                            {section.instructions.map((inst, i) => (
                                                                <div key={i} className="flex gap-2 items-center">
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <button onClick={() => moveInstructionUp(section.id, i)} disabled={i === 0}
                                                                            className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed" title="Move up">
                                                                            <IconArrowUp className="w-3 h-3" />
                                                                        </button>
                                                                        <button onClick={() => moveInstructionDown(section.id, i)} disabled={i === section.instructions.length - 1}
                                                                            className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed" title="Move down">
                                                                            <IconArrowDown className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        value={inst}
                                                                        onChange={(e) => updateInstruction(section.id, i, e.target.value)}
                                                                        className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                                    />
                                                                    <button onClick={() => removeInstruction(section.id, i)}
                                                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                                                        <IconX className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <button onClick={() => addInstruction(section.id)}
                                                                className="text-[11px] text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1 font-medium">
                                                                <IconPlus className="w-3 h-3" /> Add Instruction
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <ul className="space-y-1.5">
                                                            {section.instructions.map((inst, i) => (
                                                                <li key={i} className="text-[12px] text-slate-600 flex items-start gap-2">
                                                                    <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                                                    <span>{inst}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}

                                            {/* Delete section (edit mode) */}
                                            {isEditing && (
                                                <>
                                                    <button onClick={() => removeSection(section.id)}
                                                        className="mt-3 text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 font-medium">
                                                        <IconTrash className="w-3 h-3" /> Delete Section
                                                    </button>
                                                    {sectionToDelete === section.id && (
                                                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                                            <motion.div
                                                                initial={{ scale: 0.9, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                className="bg-white border border-slate-200 rounded-lg p-6 max-w-md shadow-2xl"
                                                            >
                                                                <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Section?</h3>
                                                                <p className="text-sm text-slate-600 mb-6">Are you sure? This cannot be undone.</p>
                                                                <div className="flex gap-3 justify-end">
                                                                    <button onClick={cancelDeleteSection}
                                                                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                                                        Cancel
                                                                    </button>
                                                                    <button onClick={confirmDeleteSection}
                                                                        className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {isEditing && (
                                <button onClick={addSection}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-lg text-[12px] text-slate-400 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors font-medium">
                                    <IconPlus className="w-4 h-4" /> Add Section
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRegenerate}
                            disabled={isProcessing || isEditing}
                            className="px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <IconRefresh className="w-3.5 h-3.5" /> Regenerate Plan
                        </button>
                        {!isEditing && (
                            <button
                                onClick={startEditing}
                                disabled={isProcessing}
                                className="px-3 py-1.5 text-[12px] font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <IconEdit className="w-3.5 h-3.5" /> Edit Plan
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={cancelEditing}
                                    className="px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-700 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={saveChanges} disabled={isSaving}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-[12px] font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isSaving ? (
                                        <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                                    ) : (
                                        <><IconDeviceFloppy className="w-3.5 h-3.5" /> Save Changes</>
                                    )}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onApprove}
                                disabled={isProcessing}
                                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-[12px] font-bold rounded-lg shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-emerald-500/40"
                            >
                                {isProcessing ? (
                                    <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating Content...</>
                                ) : (
                                    <><IconCheck className="w-4 h-4" /> Approve & Run Writer</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Context Manager Modal (reused from PlanReviewModal) */}
            <ContextManagerModal
                isOpen={showContextManager}
                onClose={() => setShowContextManager(false)}
                plan={currentPlan}
                onPlanUpdated={handleContextUpdate}
            />
        </>
    );
};
