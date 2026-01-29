import React, { useState, useEffect } from 'react';
import { IconPlus, IconTrash, IconGripVertical, IconX, IconCheck } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface StructureSection {
  id: string;
  title: string;
  content: string; // Used as description/intent
  sectionType: string;
}

interface ContentStructureEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sections: StructureSection[]) => void;
  initialSections?: StructureSection[];
  recommendationTitle?: string;
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

export const ContentStructureEditor: React.FC<ContentStructureEditorProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialSections,
  recommendationTitle
}) => {
  const [sections, setSections] = useState<StructureSection[]>(initialSections || DEFAULT_SECTIONS);

  // Reset to initial or default when opened
  useEffect(() => {
    if (isOpen) {
      setSections(initialSections && initialSections.length > 0 ? initialSections : DEFAULT_SECTIONS);
    }
  }, [isOpen, initialSections]);

  const handleAddSection = () => {
    const newId = `custom_section_${Date.now()}`;
    setSections([
      ...sections,
      {
        id: newId,
        title: "New Section",
        content: "Description of what this section should cover",
        sectionType: "custom"
      }
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

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;

    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setSections(newSections);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Customize Content Structure</h2>
            <p className="text-sm text-slate-500 mt-1">
              Define the outline for the AI to follow.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Info */}
        {recommendationTitle && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 text-sm text-blue-700">
            Generating structure for: <span className="font-semibold">{recommendationTitle}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          <AnimatePresence>
            {sections.map((section, index) => (
              <motion.div
                key={section.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border boundary-slate-200 rounded-lg shadow-sm group relative"
              >
                <div className="flex items-start p-4 gap-3">
                  {/* Drag Handle / Move Controls */}
                  <div className="flex flex-col items-center gap-1 mt-2 text-slate-300">
                    <button
                      onClick={() => handleMoveSection(index, 'up')}
                      disabled={index === 0}
                      className="hover:text-slate-600 disabled:opacity-30 p-0.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                    </button>
                    <IconGripVertical size={16} />
                    <button
                      onClick={() => handleMoveSection(index, 'down')}
                      disabled={index === sections.length - 1}
                      className="hover:text-slate-600 disabled:opacity-30 p-0.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                  </div>

                  {/* Content Inputs */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                        Section Title
                      </label>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => handleUpdateSection(index, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all shadow-sm"
                        placeholder="e.g. Introduction"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                        Intent / Description
                      </label>
                      <textarea
                        value={section.content}
                        onChange={(e) => handleUpdateSection(index, 'content', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-slate-600 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm resize-none"
                        placeholder="What should this section cover?"
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Sidebar Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleRemoveSection(index)}
                      className="text-slate-400 hover:text-red-500 p-2 rounded-md hover:bg-red-50 transition-colors"
                      title="Remove section"
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <button
            onClick={handleAddSection}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-medium"
          >
            <IconPlus size={18} />
            Add Section
          </button>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(sections)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
          >
            <IconCheck size={18} />
            Generate Content
          </button>
        </div>
      </motion.div>
    </div>
  );
};
