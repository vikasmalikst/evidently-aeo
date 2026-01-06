import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { FAQItem as FAQItemType } from '../../data/onboardingFAQs';

interface FAQItemProps {
  faq: FAQItemType;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}

export const FAQItem = ({ faq, isOpen, onToggle, index }: FAQItemProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="mb-2"
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-4 rounded-lg transition-all duration-200 flex items-center justify-between group"
        style={{
          backgroundColor: isOpen ? '#f8fafc' : '#ffffff',
          border: '1px solid #e2e8f0',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.01)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${faq.id}`}
      >
        <span className="font-semibold text-sm flex-1 pr-4" style={{ color: '#1a1d29' }}>
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="flex-shrink-0"
        >
          <ChevronDown
            className="w-5 h-5 transition-colors"
            style={{ color: isOpen ? '#00bcdc' : '#64748b' }}
          />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              id={`faq-answer-${faq.id}`}
              className="p-4 pt-3 text-sm leading-relaxed faq-answer-content"
              style={{ color: '#475569' }}
              dangerouslySetInnerHTML={{ __html: faq.answer }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

