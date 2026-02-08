import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX, IconCheck, IconRefresh, IconEdit, IconListDetails, IconBrain, IconPlus, IconTrash, IconDeviceFloppy, IconArrowUp, IconArrowDown, IconPaperclip } from '@tabler/icons-react';
import { updateTemplatePlan } from '../../../api/recommendationsV3Api';
import { ContextUploadSection } from './ContextUploadSection';

interface TemplateSection {
    id: string;
    type: 'heading' | 'section' | 'faq' | 'cta';
    heading_level?: 1 | 2 | 3 | 4;
    text_template: string;
    instructions: string[];
    word_count_target?: string;
    keywords_to_include?: string[];
}

interface TemplatePlan {
    version: '1.0';
    recommendationId: string;
    targetChannel: string;
    content_type?: string;
    primary_entity: string;
    action_description?: string;
    structure: TemplateSection[];
    aeo_extraction_targets: any;
    additional_context?: string; // Add this field
}

interface PlanReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: TemplatePlan | null;
    onApprove: () => void;
    onRegenerate: () => void;
    isProcessing: boolean;
    onPlanUpdated?: (updatedPlan: TemplatePlan) => void;
}

export const PlanReviewModal: React.FC<PlanReviewModalProps> = ({
    isOpen,
    onClose,
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
    const [showContext, setShowContext] = useState(false);

    if (!isOpen || !plan) return null;

    const currentPlan = isEditing && editedPlan ? editedPlan : plan;

    // Helper functions for editing
    const startEditing = () => {
        setEditedPlan(JSON.parse(JSON.stringify(plan))); // Deep clone
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
                alert(`Error: ${response.error}`);
            }
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleContextUpdate = (newContext: string) => {
        if (!isEditing) {
            // Auto-start editing mode if user types context
            const newPlan = JSON.parse(JSON.stringify(plan));
            newPlan.additional_context = newContext;
            setEditedPlan(newPlan);
            setIsEditing(true);
        } else if (editedPlan) {
            setEditedPlan({
                ...editedPlan,
                additional_context: newContext
            });
        }
    };


    const updateSection = (sectionId: string, field: string, value: any) => {
        if (!editedPlan) return;
        const updated = {
            ...editedPlan,
            structure: editedPlan.structure.map(s =>
                s.id === sectionId ? { ...s, [field]: value } : s
            )
        };
        setEditedPlan(updated);
    };

    const updateInstruction = (sectionId: string, idx: number, value: string) => {
        if (!editedPlan) return;
        const updated = {
            ...editedPlan,
            structure: editedPlan.structure.map(s => {
                if (s.id === sectionId) {
                    const newInstructions = [...s.instructions];
                    newInstructions[idx] = value;
                    return { ...s, instructions: newInstructions };
                }
                return s;
            })
        };
        setEditedPlan(updated);
    };

    const addInstruction = (sectionId: string) => {
        if (!editedPlan) return;
        const updated = {
            ...editedPlan,
            structure: editedPlan.structure.map(s => {
                if (s.id === sectionId) {
                    return { ...s, instructions: [...s.instructions, 'New instruction'] };
                }
                return s;
            })
        };
        setEditedPlan(updated);
    };

    const removeInstruction = (sectionId: string, idx: number) => {
        if (!editedPlan) return;
        const updated = {
            ...editedPlan,
            structure: editedPlan.structure.map(s => {
                if (s.id === sectionId) {
                    const newInstructions = s.instructions.filter((_, i) => i !== idx);
                    return { ...s, instructions: newInstructions.length > 0 ? newInstructions : ['Add instruction'] };
                }
                return s;
            })
        };
        setEditedPlan(updated);
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
        setEditedPlan({
            ...editedPlan,
            structure: [...editedPlan.structure, newSection]
        });
    };

    const removeSection = (sectionId: string) => {
        if (!editedPlan) return;
        if (editedPlan.structure.length <= 1) {
            alert('Cannot delete the last section');
            return;
        }
        // Set the section to delete, which will trigger confirmation UI
        setSectionToDelete(sectionId);
    };

    const confirmDeleteSection = () => {
        if (!editedPlan || !sectionToDelete) return;
        setEditedPlan({
            ...editedPlan,
            structure: editedPlan.structure.filter(s => s.id !== sectionToDelete)
        });
        setSectionToDelete(null);
    };

    const cancelDeleteSection = () => {
        setSectionToDelete(null);
    };

    const moveSectionUp = (sectionId: string) => {
        if (!editedPlan) return;
        const index = editedPlan.structure.findIndex(s => s.id === sectionId);
        if (index <= 0) return; // Already at top

        const newStructure = [...editedPlan.structure];
        [newStructure[index - 1], newStructure[index]] = [newStructure[index], newStructure[index - 1]];
        setEditedPlan({ ...editedPlan, structure: newStructure });
    };

    const moveSectionDown = (sectionId: string) => {
        if (!editedPlan) return;
        const index = editedPlan.structure.findIndex(s => s.id === sectionId);
        if (index < 0 || index >= editedPlan.structure.length - 1) return; // Already at bottom

        const newStructure = [...editedPlan.structure];
        [newStructure[index], newStructure[index + 1]] = [newStructure[index + 1], newStructure[index]];
        setEditedPlan({ ...editedPlan, structure: newStructure });
    };

    const moveInstructionUp = (sectionId: string, instructionIndex: number) => {
        if (!editedPlan || instructionIndex <= 0) return;

        const updated = {
            ...editedPlan,
            structure: editedPlan.structure.map(s => {
                if (s.id === sectionId) {
                    const newInstructions = [...s.instructions];
                    [newInstructions[instructionIndex - 1], newInstructions[instructionIndex]] =
                        [newInstructions[instructionIndex], newInstructions[instructionIndex - 1]];
                    return { ...s, instructions: newInstructions };
                }
                return s;
            })
        };
        setEditedPlan(updated);
    };

    const moveInstructionDown = (sectionId: string, instructionIndex: number) => {
        if (!editedPlan) return;

        const section = editedPlan.structure.find(s => s.id === sectionId);
        if (!section || instructionIndex >= section.instructions.length - 1) return;

        const updated = {
            ...editedPlan,
            structure: editedPlan.structure.map(s => {
                if (s.id === sectionId) {
                    const newInstructions = [...s.instructions];
                    [newInstructions[instructionIndex], newInstructions[instructionIndex + 1]] =
                        [newInstructions[instructionIndex + 1], newInstructions[instructionIndex]];
                    return { ...s, instructions: newInstructions };
                }
                return s;
            })
        };
        setEditedPlan(updated);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                                    <IconBrain className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        Review Content Plan
                                    </h2>
                                    <p className="text-sm text-slate-400 mt-0.5">
                                        Step 1 of 2: Approve the AI-generated strategy before writing.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowContext(!showContext)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                                        ${showContext
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    <IconPaperclip className="w-4 h-4" />
                                    {currentPlan.additional_context ? 'Edit Context' : 'Add Context'}
                                    {currentPlan.additional_context && !showContext && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    )}
                                </button>
                                <div className="w-px h-6 bg-slate-700 mx-1" />
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                                >
                                    <IconX className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Collapsible Context Section */}
                        <AnimatePresence>
                            {showContext && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden border-b border-slate-700 bg-slate-800/30"
                                >
                                    <div className="p-6">
                                        <ContextUploadSection
                                            recommendationId={currentPlan.recommendationId}
                                            existingContext={currentPlan.additional_context}
                                            onContextUpdated={handleContextUpdate}
                                            isEditing={true} // Always editable when open
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Context Upload Section REMOVED from here */}

                            {/* Strategy Summary Card */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">Target Channel</div>
                                    <div className="text-sm font-semibold text-white">
                                        {currentPlan.targetChannel}
                                        {currentPlan.content_type && (
                                            <>
                                                <span className="text-slate-500 mx-1.5">•</span>
                                                <span className="text-slate-300 capitalize">
                                                    {currentPlan.content_type.replace(/_/g, ' ')}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">Entity Focus</div>
                                    <div className="text-sm font-semibold text-white">{currentPlan.primary_entity}</div>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">AEO Targets</div>
                                    <div className="flex gap-2 mt-1 flex-wrap">
                                        {currentPlan.aeo_extraction_targets?.snippet?.required && (
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">Snippet</span>
                                        )}
                                        {currentPlan.aeo_extraction_targets?.list?.required && (
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">List</span>
                                        )}
                                        {currentPlan.aeo_extraction_targets?.table?.required && (
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30">Table</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Plan of Action - New Horizontal Card */}
                            {currentPlan.action_description && (
                                <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-5 rounded-lg border border-indigo-500/30">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 shrink-0">
                                            <IconBrain className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Plan of Action</h4>
                                            <p className="text-sm text-slate-200 leading-relaxed">
                                                {currentPlan.action_description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Plan Structure */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <IconListDetails className="w-5 h-5 text-indigo-400" />
                                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                                        Proposed Content Structure
                                    </h3>
                                </div>

                                <div className="space-y-3 relative">
                                    {/* Vertical connector line */}
                                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-800/50 z-0" />

                                    {currentPlan.structure.map((section, idx) => (
                                        <div
                                            key={section.id}
                                            className="group relative z-10 bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-800/50 transition-colors ml-0"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 shadow-sm">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border
                              ${section.type === 'heading' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' :
                                                                    section.type === 'faq' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                                                                        section.type === 'cta' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                                                                            'bg-slate-600/10 text-slate-300 border-slate-600/20'}`}>
                                                                {section.type}
                                                            </span>
                                                            {section.heading_level && (
                                                                <span className="text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">H{section.heading_level}</span>
                                                            )}
                                                        </div>
                                                        {isEditing && (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => moveSectionUp(section.id)}
                                                                    disabled={idx === 0}
                                                                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    title="Move section up"
                                                                >
                                                                    <IconArrowUp className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => moveSectionDown(section.id)}
                                                                    disabled={idx === currentPlan.structure.length - 1}
                                                                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    title="Move section down"
                                                                >
                                                                    <IconArrowDown className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={section.text_template}
                                                            onChange={(e) => updateSection(section.id, 'text_template', e.target.value)}
                                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-base font-semibold mb-3"
                                                        />
                                                    ) : (
                                                        <h4 className="text-base font-semibold text-white mb-3 leading-snug">
                                                            {section.text_template}
                                                        </h4>
                                                    )}

                                                    {section.instructions.length > 0 && (
                                                        <div className="bg-slate-900/50 rounded-md p-3 border border-slate-800/50">
                                                            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Instructions</p>
                                                            {isEditing ? (
                                                                <div className="space-y-2">
                                                                    {section.instructions.map((inst, i) => (
                                                                        <div key={i} className="flex gap-2 items-center">
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <button
                                                                                    onClick={() => moveInstructionUp(section.id, i)}
                                                                                    disabled={i === 0}
                                                                                    className="p-0.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                                                                                    title="Move instruction up"
                                                                                >
                                                                                    <IconArrowUp className="w-3 h-3" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => moveInstructionDown(section.id, i)}
                                                                                    disabled={i === section.instructions.length - 1}
                                                                                    className="p-0.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                                                                                    title="Move instruction down"
                                                                                >
                                                                                    <IconArrowDown className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                            <input
                                                                                type="text"
                                                                                value={inst}
                                                                                onChange={(e) => updateInstruction(section.id, i, e.target.value)}
                                                                                className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200"
                                                                            />
                                                                            <button
                                                                                onClick={() => removeInstruction(section.id, i)}
                                                                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                                                            >
                                                                                <IconX className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => addInstruction(section.id)}
                                                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1"
                                                                    >
                                                                        <IconPlus className="w-3 h-3" />
                                                                        Add Instruction
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <ul className="space-y-1.5">
                                                                    {section.instructions.map((inst, i) => (
                                                                        <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1.5 shrink-0 opacity-50" />
                                                                            <span>{inst}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    )}

                                                    {isEditing && (
                                                        <>
                                                            <button
                                                                onClick={() => removeSection(section.id)}
                                                                className="mt-3 text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                                                            >
                                                                <IconTrash className="w-3 h-3" />
                                                                Delete Section
                                                            </button>

                                                            {/* Confirmation Dialog for this section */}
                                                            {sectionToDelete === section.id && (
                                                                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                                                    <motion.div
                                                                        initial={{ scale: 0.9, opacity: 0 }}
                                                                        animate={{ scale: 1, opacity: 1 }}
                                                                        className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md shadow-2xl"
                                                                    >
                                                                        <h3 className="text-lg font-bold text-white mb-2">Delete Section?</h3>
                                                                        <p className="text-sm text-slate-300 mb-6">
                                                                            Are you sure you want to delete this section? This action cannot be undone.
                                                                        </p>
                                                                        <div className="flex gap-3 justify-end">
                                                                            <button
                                                                                onClick={cancelDeleteSection}
                                                                                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                            <button
                                                                                onClick={confirmDeleteSection}
                                                                                className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                                                                            >
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
                                        <button
                                            onClick={addSection}
                                            className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-lg text-sm text-slate-400 hover:text-indigo-400 flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <IconPlus className="w-4 h-4" />
                                            Add Section
                                        </button>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-700 bg-slate-800/80 backdrop-blur flex items-center justify-between z-20">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onRegenerate}
                                    className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors flex items-center gap-2"
                                    disabled={isProcessing || isEditing}
                                >
                                    <IconRefresh className="w-4 h-4" />
                                    Regenerate Plan
                                </button>
                                {!isEditing && (
                                    <button
                                        onClick={startEditing}
                                        className="px-4 py-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors flex items-center gap-2"
                                        disabled={isProcessing}
                                    >
                                        <IconEdit className="w-4 h-4" />
                                        Edit Plan
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={cancelEditing}
                                            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveChanges}
                                            disabled={isSaving}
                                            className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-sm font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <IconDeviceFloppy className="w-4 h-4" />
                                                    Save Changes
                                                </>
                                            )}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                                            disabled={isProcessing}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={onApprove}
                                            disabled={isProcessing}
                                            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Generating Final Content...
                                                </>
                                            ) : (
                                                <>
                                                    <IconCheck className="w-4 h-4" />
                                                    Approve & Run Writer
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
