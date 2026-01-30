import React, { useState, useEffect } from 'react';
import { IconPlus, IconTrash, IconChevronUp, IconChevronDown, IconCheck, IconSparkles, IconGripVertical } from '@tabler/icons-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { StructureSection } from './ContentStructureEditor';

interface ContentStructureInlineEditorProps {
    recommendationId: string;
    initialSections?: StructureSection[];
    onSave: (sections: StructureSection[]) => void;
    isSaving: boolean;
}

const DEFAULT_SECTIONS: StructureSection[] = [
    {
        id: "direct_answer",
        title: "Direct Answer",
        content: "Concise answer to the primary question (80–120 words)",
        sectionType: "answer"
    },
    {
        id: "how_it_works",
        title: "How It Works",
        content: "Explain mechanism step-by-step",
        sectionType: "explanation"
    },
    {
        id: "comparison",
        title: "Comparison With Alternatives",
        content: "Objective comparison with competitors",
        sectionType: "comparison"
    },
    {
        id: "limitations",
        title: "Limitations and Trade-Offs",
        content: "What this does NOT solve",
        sectionType: "constraints"
    }
];

export const ContentStructureInlineEditor: React.FC<ContentStructureInlineEditorProps> = ({
    recommendationId,
    initialSections,
    onSave,
    isSaving
}) => {
    const [sections, setSections] = useState<StructureSection[]>(initialSections || DEFAULT_SECTIONS);
    const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        if (saveFeedback) {
            const timer = setTimeout(() => setSaveFeedback(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [saveFeedback]);

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
        <div className="p-5 space-y-4 bg-white rounded-xl border border-slate-200/60 shadow-inner">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <IconSparkles size={18} className="text-blue-500" />
                    </div>
                    <div>
                        <h4 className="text-[14px] font-bold text-slate-800">Content Structure Outline</h4>
                        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Customize the flow for AI Generation</p>
                    </div>
                </div>
                <button
                    onClick={handleAddSection}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[12px] font-bold hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <IconPlus size={14} />
                    Add Section
                </button>
            </div>

            <div className="space-y-3">
                <Reorder.Group axis="y" values={sections} onReorder={handleReorder} className="space-y-3">
                    <AnimatePresence initial={false}>
                        {sections.map((section, index) => (
                            <Reorder.Item
                                key={section.id}
                                value={section}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="group bg-[#f8fafc] border border-slate-200 rounded-lg p-3 hover:border-blue-200 hover:bg-blue-50/30 transition-all shadow-sm cursor-move relative"
                                whileDrag={{ scale: 1.02, boxShadow: "0px 10px 20px rgba(0,0,0,0.1)", zIndex: 50 }}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Drag Handle / Reorder */}
                                    <div className="flex flex-col gap-1 mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-blue-400 transition-colors">
                                        <IconGripVertical size={16} />
                                    </div>

                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={section.title}
                                                onChange={(e) => handleUpdateSection(index, 'title', e.target.value)}
                                                className="flex-1 bg-transparent border-none p-0 text-[13px] font-bold text-slate-800 focus:ring-0 placeholder:text-slate-400"
                                                placeholder="Section Title"
                                                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when interacting with input
                                            />
                                            <button
                                                onClick={() => handleRemoveSection(index)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                                            >
                                                <IconTrash size={14} />
                                            </button>
                                        </div>
                                        <textarea
                                            value={section.content}
                                            onChange={(e) => handleUpdateSection(index, 'content', e.target.value)}
                                            className="w-full bg-white border border-slate-200/60 rounded-md p-2 text-[12px] text-slate-600 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all resize-none shadow-sm"
                                            placeholder="What should this section cover?"
                                            rows={2}
                                            onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when interacting with text area
                                        />
                                    </div>
                                </div>
                            </Reorder.Item>
                        ))}
                    </AnimatePresence>
                </Reorder.Group>
            </div>

            <div className="pt-4 flex items-center justify-between">
                <div className="flex-1 mr-4">
                    <AnimatePresence>
                        {saveFeedback && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className={`text-[12px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-2 ${saveFeedback.type === 'success'
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
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95 flex-shrink-0"
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
    );
};
