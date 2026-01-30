import React, { useState, useEffect } from 'react';
import { IconPlus, IconTrash, IconChevronUp, IconChevronDown, IconCheck, IconSparkles, IconGripVertical } from '@tabler/icons-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { StructureSection } from './ContentStructureEditor';
import { CONTENT_TEMPLATES, ContentTemplateType } from '../data/structure-templates';

interface ContentStructureInlineEditorProps {
    recommendationId: string;
    contentType?: ContentTemplateType; // New prop for dynamic templating
    initialSections?: StructureSection[];
    onSave: (sections: StructureSection[]) => void;
    isSaving: boolean;
}

export const ContentStructureInlineEditor: React.FC<ContentStructureInlineEditorProps> = ({
    recommendationId,
    contentType = 'article', // Default to article
    initialSections,
    onSave,
    isSaving
}) => {
    // Initialize sections: Use provided initialSections OR fallback to the correct template based on contentType
    const [sections, setSections] = useState<StructureSection[]>(
        initialSections || CONTENT_TEMPLATES[contentType] || CONTENT_TEMPLATES['article']
    );
    const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        if (saveFeedback) {
            const timer = setTimeout(() => setSaveFeedback(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [saveFeedback]);

    // Update sections if contentType changes and we are using defaults (no initialSections passed)
    useEffect(() => {
        if (!initialSections && contentType) {
            setSections(CONTENT_TEMPLATES[contentType] || CONTENT_TEMPLATES['article']);
        }
    }, [contentType, initialSections]);

    const handleAddSection = () => {
        const newId = `custom_section_${Date.now()}`;
        // Insert at the top instead of bottom
        setSections([
            {
                id: newId,
                title: "New Section",
                content: "Description of what this section should cover",
                sectionType: "custom"
            },
            ...sections
        ]);
    };

    const handleRemoveSection = (index: number) => {
        const newSections = [...sections];
        newSections.splice(index, 1);
        setSections(newSections);
    };

    const handleUpdateSection = (index: number, field: keyof StructureSection, value: string) => {
        const newSections = [...sections];
        newSections[index] = { ...newSections[index], [field]: value };
        setSections(newSections);
    };

    // Reorder handler for framer-motion
    const handleReorder = (newOrder: StructureSection[]) => {
        setSections(newOrder);
    };

    // Explicit move handler relative to index (kept for accessibility if needed, though drag is primary)
    const handleMoveSection = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === sections.length - 1) return;

        const newSections = [...sections];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
        setSections(newSections);
    };

    return (
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200/80 shadow-lg overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-[#00bcdc]/5 via-[#00bcdc]/10 to-[#0891b2]/5 border-b border-[#00bcdc]/10 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00bcdc] to-[#0891b2] flex items-center justify-center shadow-md shadow-cyan-200/50">
                            <IconSparkles size={20} className="text-white" />
                        </div>
                        <div>
                            <h4 className="text-[15px] font-bold text-slate-800">Article Template</h4>
                            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Customize the flow for AI Generation</p>
                        </div>
                    </div>
                    <button
                        onClick={handleAddSection}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-[12px] font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                        <IconPlus size={14} />
                        Add Section
                    </button>
                </div>
            </div>

            {/* Sections Container */}
            <div className="p-5">
                <Reorder.Group axis="y" values={sections} onReorder={handleReorder} className="space-y-3">
                    <AnimatePresence initial={false}>
                        {sections.map((section, index) => (
                            <Reorder.Item
                                key={section.id}
                                value={section}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="group relative"
                                whileDrag={{ scale: 1.02, boxShadow: "0px 8px 24px rgba(0,188,220,0.15)", zIndex: 50 }}
                            >
                                <div className="bg-white rounded-xl border border-slate-200/80 hover:border-[#00bcdc]/30 transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden">
                                    {/* Section Header */}
                                    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50/80 to-white border-b border-slate-100">
                                        {/* Drag Handle */}
                                        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-[#00bcdc] transition-colors">
                                            <IconGripVertical size={18} />
                                        </div>
                                        
                                        {/* Section Number Badge */}
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00bcdc] to-[#0891b2] text-white text-[11px] font-bold flex items-center justify-center shadow-sm flex-shrink-0">
                                            {index + 1}
                                        </div>

                                        {/* Title Input */}
                                        <input
                                            type="text"
                                            value={section.title}
                                            onChange={(e) => handleUpdateSection(index, 'title', e.target.value)}
                                            className="flex-1 bg-transparent border-none p-0 text-[14px] font-semibold text-slate-800 focus:ring-0 focus:outline-none placeholder:text-slate-400"
                                            placeholder="Section Title"
                                            onPointerDown={(e) => e.stopPropagation()}
                                        />

                                        {/* Delete Button */}
                                        <button
                                            onClick={() => handleRemoveSection(index)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            onPointerDown={(e) => e.stopPropagation()}
                                        >
                                            <IconTrash size={14} />
                                        </button>
                                    </div>

                                    {/* Section Content */}
                                    <div className="px-4 py-3">
                                        <textarea
                                            value={section.content}
                                            onChange={(e) => handleUpdateSection(index, 'content', e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-200/60 rounded-lg p-3 text-[13px] text-slate-600 focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc]/40 outline-none transition-all resize-none placeholder:text-slate-400"
                                            placeholder="Describe what this section should cover..."
                                            rows={2}
                                            onPointerDown={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>
                            </Reorder.Item>
                        ))}
                    </AnimatePresence>
                </Reorder.Group>

                {sections.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                        <IconSparkles size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-[13px]">No sections yet. Click "Add Section" to get started.</p>
                    </div>
                )}
            </div>

            {/* Footer - Generate Button */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50/50 to-white border-t border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                        <AnimatePresence>
                            {saveFeedback && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className={`text-[12px] font-semibold py-2 px-4 rounded-lg flex items-center gap-2 ${saveFeedback.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        : 'bg-red-50 text-red-600 border border-red-100'
                                        }`}
                                >
                                    <IconCheck size={14} />
                                    {saveFeedback.message}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <button
                        onClick={async () => {
                            try {
                                await onSave(sections);
                                setSaveFeedback({ type: 'success', message: 'Configuration saved!' });
                            } catch (err: any) {
                                setSaveFeedback({ type: 'error', message: err.message || 'Failed to save' });
                            }
                        }}
                        disabled={isSaving || sections.length === 0}
                        className="flex items-center gap-2.5 px-6 py-2.5 bg-gradient-to-r from-[#00bcdc] to-[#0891b2] text-white rounded-xl text-[13px] font-bold hover:from-[#00a8c6] hover:to-[#0780a3] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-200/40 hover:shadow-xl hover:shadow-cyan-200/50 active:scale-[0.98]"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <IconSparkles size={18} />
                                Generate Content
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
