import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX, IconSparkles } from '@tabler/icons-react';
import { SEOScoreCard } from '../../../components/RecommendationsV3/components/SEOScoreCard';

interface ContentAnalysisSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  brandName?: string;
  contentType?: string;
}

export const ContentAnalysisSidebar: React.FC<ContentAnalysisSidebarProps> = ({
  isOpen,
  onClose,
  content,
  brandName,
  contentType
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-[101] flex flex-col border-l border-[#e2e8f0]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#f0f9ff] rounded-lg">
                  <IconSparkles size={20} className="text-[#0ea5e9]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#0f172a]">Content Analysis</h3>
                  <p className="text-[12px] text-[#64748b]">AEO Score & Metrics</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded-lg transition-colors"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
              <div className="space-y-6">
                <SEOScoreCard
                  content={content}
                  brandName={brandName}
                  contentType={contentType}
                />
              </div>
            </div>
            
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
