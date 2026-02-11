import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX, IconPlus, IconLoader2, IconAlertCircle } from '@tabler/icons-react';
import { RecommendationV3 } from '../../../api/recommendationsV3Api';

interface AddCustomRecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (recommendation: Partial<RecommendationV3>) => Promise<void>;
  isSubmitting: boolean;
}

export const AddCustomRecommendationModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}: AddCustomRecommendationModalProps) => {
  const [formData, setFormData] = useState<Partial<RecommendationV3>>({
    action: '',
    assetType: 'article',
    focusArea: 'visibility',
    priority: 'Medium',
    effort: 'Medium',
    citationSource: 'customer-input',
    kpi: 'Visibility Index',
    expectedBoost: '5-10%'
  });

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.action?.trim()) {
      setError('Recommendation title is required');
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
      // Reset form
      setFormData({
        action: '',
        assetType: 'article',
        focusArea: 'visibility',
        priority: 'Medium',
        effort: 'Medium',
        citationSource: 'customer-input',
        kpi: 'Visibility Index',
        expectedBoost: '5-10%'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create recommendation');
    }
  };

  const assetTypes = [
    { value: 'article', label: 'Expert Article' },
    { value: 'whitepaper', label: 'Executive Report / Whitepaper' },
    { value: 'short_video', label: 'Short-form Video (Shorts/Reels)' },
    { value: 'expert_community_response', label: 'Expert Community Response' },
    { value: 'podcast', label: 'Podcast Script' },
    { value: 'comparison_table', label: 'Comparison Table' },
    { value: 'social_media_thread', label: 'Social Media Thread' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#00bcdc]/10 rounded-lg">
                  <IconPlus size={20} className="text-[#00bcdc]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-slate-900">Add Custom Recommendation</h3>
                  <p className="text-[12px] text-slate-500">Manually define an opportunity for generation</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* Action Title */}
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                    Recommendation Title (Action)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Create a technical comparison guide for enterprise users"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc] transition-all"
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                  />
                </div>

                {/* Citation Source / Domain */}
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                    Citation Source / Domain
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. reddit.com, evidently.ai"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc] transition-all"
                    value={formData.citationSource}
                    onChange={(e) => setFormData({ ...formData, citationSource: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    The primary domain or source this recommendation originates from.
                  </p>
                </div>

                {/* Row 1: Asset Type & Focus Area */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                      Asset Type
                    </label>
                    <select
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc] transition-all cursor-pointer"
                      value={formData.assetType}
                      onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                    >
                      {assetTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                      Focus Area
                    </label>
                    <select
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc] transition-all cursor-pointer"
                      value={formData.focusArea}
                      onChange={(e) => setFormData({ ...formData, focusArea: e.target.value as any })}
                    >
                      <option value="visibility">Visibility</option>
                      <option value="soa">Share of Answers</option>
                      <option value="sentiment">Sentiment</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Priority & Effort */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                      Priority
                    </label>
                    <select
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc] transition-all cursor-pointer"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                      Effort
                    </label>
                    <select
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc] transition-all cursor-pointer"
                      value={formData.effort}
                      onChange={(e) => setFormData({ ...formData, effort: e.target.value as any })}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: KPI & Boost */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                      Target KPI
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Visibility Score"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc] transition-all"
                      value={formData.kpi}
                      onChange={(e) => setFormData({ ...formData, kpi: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                      Expected Boost
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +12%"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/20 focus:border-[#00bcdc] transition-all"
                      value={formData.expectedBoost}
                      onChange={(e) => setFormData({ ...formData, expectedBoost: e.target.value })}
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[13px]"
                  >
                    <IconAlertCircle size={16} />
                    {error}
                  </motion.div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-8 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-[14px] font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#00bcdc] hover:bg-[#00a8c6] disabled:bg-slate-300 text-white text-[14px] font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <IconLoader2 size={18} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <IconPlus size={18} />
                      Add Recommendation
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
