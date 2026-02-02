import React, { useState, useEffect } from 'react';
import { IconPlus, IconTrash, IconSparkles, IconGripVertical, IconDeviceFloppy, IconCheck } from '@tabler/icons-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { StructureSection } from './ContentStructureEditor';
import { TableStructureEditor } from './TableStructureEditor';
import { CONTENT_TEMPLATES, ContentTemplateType } from '../data/structure-templates';

interface ContentStructureInlineEditorProps {
    recommendationId: string;
    contentType?: ContentTemplateType; // New prop for dynamic templating
    initialSections?: StructureSection[];
    onSave: (sections: StructureSection[]) => void;
    onChange?: (sections: StructureSection[]) => void; // Live update parent
    isSaving: boolean;
    competitors?: string[]; // New prop
}

export const ContentStructureInlineEditor: React.FC<ContentStructureInlineEditorProps> = ({
    recommendationId,
    contentType = 'article', // Default to article
    initialSections,
    onSave,
    onChange,
    isSaving,
    competitors
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
    // Also re-applies if competitors change for fresh templates
    useEffect(() => {
        if (!initialSections && contentType) {
            let template = CONTENT_TEMPLATES[contentType] || CONTENT_TEMPLATES['article'];

            // Dynamic override for comparison table
            if (contentType === 'comparison_table' && competitors && competitors.length > 0) {
                 // Deep copy to avoid mutating constant
                 template = JSON.parse(JSON.stringify(template));
                 const tableSection = template.find((s: any) => s.id === 'table');
                 if (tableSection) {
                     const brandCol = '[Brand Name]';
                     const compCols = competitors.map(c => `[${c}]`).join(' | ');
                     const header = `| Feature | ${brandCol} | ${compCols} |`;
                     const separator = `|---|---|${competitors.map(() => '---').join('|')}|`;
                     const row = `| [Feature 1] | [Value] | ${competitors.map(() => '[Value]').join(' | ')} |`;
                     tableSection.content = `${header}\n${separator}\n${row}`;
                 }
            }
            
            setSections(template);
        }
    }, [contentType, initialSections]); // Intentionally omitting competitors from dep to avoid overwrite on edit, unless intentional reset logic is needed


    // Notify parent of changes whenever sections update
    const updateSections = (newSections: StructureSection[]) => {
        setSections(newSections);
        onChange?.(newSections);
    };

    const handleAddSection = () => {
        const newId = `custom_section_${Date.now()}`;
        // Insert at the top instead of bottom
        const newSections = [
            {
                id: newId,
                title: "New Section",
                content: "Description of what this section should cover",
                sectionType: "custom"
            },
            ...sections
        ];
        updateSections(newSections);
    };

    const handleRemoveSection = (index: number) => {
        const newSections = [...sections];
        newSections.splice(index, 1);
        updateSections(newSections);
    };

    const handleUpdateSection = (index: number, field: keyof StructureSection, value: string) => {
        const newSections = [...sections];
        newSections[index] = { ...newSections[index], [field]: value };
        updateSections(newSections);
    };

    // Reorder handler for framer-motion
    const handleReorder = (newOrder: StructureSection[]) => {
        updateSections(newOrder);
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
                            <h4 className="text-[15px] font-bold text-slate-800 capitalize">
                                {contentType.replace(/_/g, ' ')} Template
                            </h4>
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
                                        {/* Use Table Editor for comparison_table sections, otherwise textarea */}
                                        {section.sectionType === 'comparison_table' ? (
                                            <TableStructureEditor
                                                content={section.content}
                                                onChange={(newContent) => handleUpdateSection(index, 'content', newContent)}
                                            />
                                        ) : (
                                            <textarea
                                                value={section.content}
                                                onChange={(e) => handleUpdateSection(index, 'content', e.target.value)}
                                                className="w-full bg-slate-50/50 border border-slate-200/60 rounded-lg p-3 text-[13px] text-slate-600 focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc]/40 outline-none transition-all resize-none placeholder:text-slate-400"
                                                placeholder="Describe what this section should cover..."
                                                rows={2}
                                                onPointerDown={(e) => e.stopPropagation()}
                                            />
                                        )}
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

            {/* Footer - Save Configuration Button */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50/50 to-white border-t border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                        <AnimatePresence>
                            {saveFeedback && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    className={`text-[12px] font-semibold py-2 px-4 rounded-lg flex items-center gap-2 ${saveFeedback.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        : 'bg-red-50 text-red-600 border border-red-100'
                                        }`}
                                >
                                    <motion.div
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.1 }}
                                    >
                                        <IconCheck size={14} />
                                    </motion.div>
                                    {saveFeedback.message}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <motion.button
                        onClick={async () => {
                            try {
                                await onSave(sections);
                                setSaveFeedback({ type: 'success', message: 'Configuration saved!' });
                            } catch (err: any) {
                                setSaveFeedback({ type: 'error', message: err.message || 'Failed to save' });
                            }
                        }}
                        disabled={isSaving || sections.length === 0}
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="group relative flex items-center gap-2.5 px-6 py-2.5 bg-gradient-to-r from-slate-50 to-white border border-slate-200 text-slate-700 rounded-xl text-[13px] font-bold hover:border-slate-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm overflow-hidden"
                    >
                        {/* Subtle hover glow */}
                        <motion.div 
                            className="absolute inset-0 bg-gradient-to-r from-slate-100/0 via-slate-100/50 to-slate-100/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            initial={false}
                        />
                        {isSaving ? (
                            <>
                                <motion.div 
                                    className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                />
                                <span className="relative">Saving...</span>
                            </>
                        ) : (
                            <>
                                <motion.div
                                    className="relative"
                                    whileHover={{ rotate: [0, -10, 10, 0] }}
                                    transition={{ duration: 0.4 }}
                                >
                                    <IconDeviceFloppy size={18} className="text-slate-500 group-hover:text-slate-700 transition-colors" />
                                </motion.div>
                                <span className="relative">Save Configuration</span>
                            </>
                        )}
                    </motion.button>
                </div>
            </div>
        </div>
    );
};
