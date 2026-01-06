import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, ExternalLink } from 'lucide-react';
import { FAQAccordion } from './FAQAccordion';
import { ONBOARDING_FAQS } from '../../data/onboardingFAQs';

interface FAQSectionProps {
  delay?: number; // Animation delay in ms
}

export const FAQSection = ({ delay = 500 }: FAQSectionProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(
    ONBOARDING_FAQS[0]?.id || null // First FAQ open by default
  );

  const topFAQs = useMemo(() => {
    return ONBOARDING_FAQS.sort((a, b) => b.priority - a.priority).slice(0, 6); // Show top 6
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.4, ease: 'easeOut' }}
      className="mt-6 rounded-xl p-6"
      style={{
        backgroundColor: '#f9f9fb',
        border: '1px solid #e8e9ed',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5" style={{ color: '#00bcdc' }} />
          <h3 className="text-base font-semibold" style={{ color: '#1a1d29' }}>
            Learn While You Wait
          </h3>
        </div>
        <a
          href="/faq"
          className="text-xs font-medium flex items-center gap-1 hover:underline transition-opacity"
          style={{ color: '#00bcdc' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          View All FAQs
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Accordion */}
      <FAQAccordion
        faqs={topFAQs}
        expandedId={expandedId}
        onToggle={(id) => setExpandedId(id === expandedId ? null : id)}
      />
    </motion.div>
  );
};

