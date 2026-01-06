import { FAQItem } from './FAQItem';
import type { FAQItem as FAQItemType } from '../../data/onboardingFAQs';

interface FAQAccordionProps {
  faqs: FAQItemType[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}

export const FAQAccordion = ({ faqs, expandedId, onToggle }: FAQAccordionProps) => {
  return (
    <div>
      {faqs.map((faq, index) => (
        <FAQItem
          key={faq.id}
          faq={faq}
          isOpen={expandedId === faq.id}
          onToggle={() => onToggle(faq.id)}
          index={index}
        />
      ))}
    </div>
  );
};

