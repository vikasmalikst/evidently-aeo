FAQ Integration on Onboarding Loading Screen - Implementation Plan

Overview

Add an interactive FAQ section below the progress tracking on the onboarding loading screen to keep users engaged while data is being collected. The FAQs will be displayed in an attractive, animated accordion-style component with smooth transitions.

---

Design Goals

Engage Users: Keep users informed and engaged during the 60+ second wait time

Reduce Anxiety: Answer common questions about what's happening

Beautiful UI: Modern, polished design with smooth animations

Non-Intrusive: Doesn't distract from progress tracking

Responsive: Works on all screen sizes

Accessible: Keyboard navigation, screen reader support

---

Component Architecture

1. New Components to Create

src/components/Progress/

├── ProgressModal.tsx (modify existing)

└── FAQSection.tsx (new)

├── FAQAccordion.tsx (new)

└── FAQItem.tsx (new)

2. Data Structure

// src/data/onboardingFAQs.ts

export interface FAQItem {

id: string;

category: 'getting-started' | 'onboarding' | 'data-collection' | 'metrics' | 'troubleshooting';

question: string;

answer: string;

priority: number; // 1-5, higher = shown first

keywords: string[]; // For search/filtering

}

export const ONBOARDING_FAQS: FAQItem[] = [

// Curated subset from FAQ.md relevant to onboarding

];

---

UI/UX Design

Layout Structure

┌─────────────────────────────────────────┐

│ Header (Logo + Title) │

├─────────────────────────────────────────┤

│ Progress Card │

│ ├─ Progress Bar │

│ ├─ Stage Indicators │

│ ├─ Queries/Results Count │

│ └─ Available Data KPIs │

├─────────────────────────────────────────┤

│ FAQ Section (NEW) │

│ ├─ Section Header │

│ │ ├─ "Learn While You Wait" │

│ │ ├─ Category Filter (optional) │

│ │ └─ Search (optional) │

│ ├─ FAQ Accordion │

│ │ ├─ FAQ Item 1 (expanded by default) │

│ │ ├─ FAQ Item 2 │

│ │ ├─ FAQ Item 3 │

│ │ └─ ... (max 5-6 visible) │

│ └─ "View All FAQs" Link │

└─────────────────────────────────────────┘

Visual Design

FAQ Section Container:

Background: #f9f9fb (matches existing design)

Border: 1px solid #e8e9ed

Border radius: 12px

Padding: 24px

Margin: 24px 0 0 0

Box shadow: Subtle elevation on hover

FAQ Item (Accordion):

Background: #ffffff when closed, #f8fafc when open

Border: 1px solid #e2e8f0

Border radius: 8px

Padding: 16px 20px

Margin: 8px 0

Hover: Slight scale (1.01) + shadow increase

Transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)

Question (Header):

Font: Sora, font-semibold, `text-[14px]`

Color: #1a1d29 (navy)

Icon: ChevronDown (rotates 180° when open)

Icon color: #64748b (gray)

Hover: Icon color → #00bcdc (cyan)

Answer (Content):

Font: Sora, `text-[13px]`

Color: #475569 (slate)

Line height: 1.6

Padding: 12px 0 0 0

Animation: Fade in + slide down

---

Animation Strategy

1. Entrance Animation (FAQ Section)

Trigger: After progress card is visible (500ms delay)

Animation:

Fade in: opacity: 0 → 1 (400ms)

Slide up: translateY: 20px → 0 (400ms)

Easing: cubic-bezier(0.4, 0, 0.2, 1)

Implementation: framer-motion motion.div with initial, animate, transition

2. FAQ Item Expand/Collapse

Trigger: Click on question header

Animation:

Height: Auto (smooth expand)

Opacity: 0 → 1 for answer content

Icon rotation: 0° → 180°

Duration: 300ms

Easing: cubic-bezier(0.4, 0, 0.2, 1)

Implementation: framer-motion AnimatePresence + motion.div

3. Stagger Animation (Multiple Items)

Trigger: On initial load

Animation: Each FAQ item animates in with 100ms delay between items

Implementation: framer-motion variants with staggerChildren

4. Hover Effects

Question Header:

Scale: 1 → 1.01

Shadow: Increase elevation

Icon color: #64748b → #00bcdc

Duration: 200ms

Easing: ease-out

5. Scroll Animation (Optional)

If FAQs exceed viewport, add subtle fade at bottom indicating more content

Smooth scroll to expanded item if it's partially off-screen

---

FAQ Content Strategy

Curated FAQs for Onboarding (Priority Order)

"How long does onboarding take?" (Priority: 5)

Category: onboarding

Answer: Brief explanation of timeline

"What is Visibility Index?" (Priority: 5)

Category: metrics

Answer: Clear, concise definition

"What is Share of Answer (SOA)?" (Priority: 5)

Category: metrics

Answer: Explanation with example

"What is Sentiment Score?" (Priority: 4)

Category: metrics

Answer: Brief explanation

"Which AI models does AnswerIntel track?" (Priority: 4)

Category: data-collection

Answer: List of models

"How long does data collection take?" (Priority: 4)

Category: data-collection

Answer: Time estimates

"Why do I see zeros or missing data?" (Priority: 3)

Category: troubleshooting

Answer: Common reasons

"Can I add custom queries?" (Priority: 3)

Category: onboarding

Answer: Yes, with instructions

Total: 6-8 FAQs visible initially (expandable to view all)

---

Implementation Steps

Phase 1: Data Preparation

✅ Create src/data/onboardingFAQs.ts

Extract relevant FAQs from FAQ.md

Structure as FAQItem[]

Add priority scores

Add categories

Phase 2: Component Development

✅ Create FAQItem.tsx

Accordion item component

Question header with chevron icon

Answer content area

Expand/collapse logic

Animations with framer-motion

✅ Create FAQAccordion.tsx

Container for multiple FAQ items

State management (which items are open)

Stagger animations

Max 1 item open at a time (or allow multiple)

✅ Create FAQSection.tsx

Main container

Section header ("Learn While You Wait")

Optional: Category filter

Optional: Search functionality

"View All FAQs" link

Entrance animations

Phase 3: Integration

✅ Integrate into ProgressModal.tsx

Add FAQ section below progress card

Only show in fullpage mode

Conditional rendering (show after 2-3 seconds)

Responsive layout adjustments

Phase 4: Polish & Optimization

✅ Add smooth scroll behavior

Scroll to expanded FAQ if off-screen

Prevent layout shift

✅ Add keyboard navigation

Tab navigation

Enter/Space to expand

Arrow keys to navigate between items

✅ Add accessibility

ARIA labels

Screen reader announcements

Focus management

✅ Performance optimization

Lazy load FAQ content if needed

Memoize components

Optimize animations

---

Technical Implementation Details

FAQItem Component

// src/components/Progress/FAQItem.tsx

import { useState } from 'react';

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

className="w-full text-left p-4 rounded-lg bg-white border border-gray-200 hover:border-cyan-500 hover:shadow-md transition-all duration-200 flex items-center justify-between group"

aria-expanded={isOpen}

aria-controls={`faq-answer-${faq.id}`}

>

<span className="font-semibold text-sm text-navy flex-1 pr-4">

{faq.question}

</span>

<motion.div

animate={{ rotate: isOpen ? 180 : 0 }}

transition={{ duration: 0.3 }}

className="flex-shrink-0"

>

<ChevronDown

className="w-5 h-5 text-gray-500 group-hover:text-cyan-500 transition-colors"

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

className="p-4 pt-3 text-sm text-slate-600 leading-relaxed"

dangerouslySetInnerHTML={{ __html: faq.answer }}

/>

</motion.div>

)}

</AnimatePresence>

</motion.div>

);

};

FAQSection Component

// src/components/Progress/FAQSection.tsx

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

return ONBOARDING_FAQS

.sort((a, b) => b.priority - a.priority)

.slice(0, 6); // Show top 6

}, []);

return (

<motion.div

initial={{ opacity: 0, y: 20 }}

animate={{ opacity: 1, y: 0 }}

transition={{ delay: delay / 1000, duration: 0.4, ease: 'easeOut' }}

className="mt-6 rounded-xl p-6"

style={{

backgroundColor: '#f9f9fb',

border: '1px solid #e8e9ed'

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

className="text-xs font-medium flex items-center gap-1 hover:underline"

style={{ color: '#00bcdc' }}

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

Integration into ProgressModal

// In ProgressModal.tsx, add after mainContent:

{/* FAQ Section - Only in fullpage mode, show after 2 seconds */}

{mode === 'fullpage' && elapsedTime >= 2 && (

<FAQSection delay={2000} />

)}

---

Responsive Design

Mobile (< 768px)

FAQ section: Full width, reduced padding (16px)

FAQ items: Smaller font sizes (text-xs for questions)

Accordion: Touch-friendly tap targets (min 44px height)

Stack layout: Single column

Tablet (768px - 1024px)

FAQ section: Standard padding (24px)

FAQ items: Standard sizes

Two-column layout possible if space allows

Desktop (> 1024px)

FAQ section: Max width constraint if needed

FAQ items: Full sizes

Hover effects enabled

---

Accessibility Features

Keyboard Navigation

Tab to navigate between FAQ items

Enter/Space to expand/collapse

Arrow keys to move between items

Escape to close expanded item

Screen Reader Support

aria-expanded on question buttons

aria-controls linking question to answer

aria-label for icon buttons

Semantic HTML (<button>, <section>)

Focus Management

Focus moves to expanded answer when opened

Focus trap within FAQ section (optional)

Visible focus indicators

Reduced Motion

Respect prefers-reduced-motion

Disable animations if user prefers

---

Performance Considerations

Lazy Loading: FAQ content only loads when section is visible

Memoization: Memoize FAQ list sorting/filtering

Animation Performance: Use transform and opacity (GPU-accelerated)

Bundle Size: Tree-shake unused framer-motion features

---

Testing Checklist

- [ ] FAQs render correctly on initial load

- [ ] Animations work smoothly

- [ ] Expand/collapse works (click, keyboard)

- [ ] Responsive design on mobile/tablet/desktop

- [ ] Accessibility (keyboard nav, screen readers)

- [ ] Performance (no jank, smooth 60fps)

- [ ] Integration with ProgressModal (no layout shifts)

- [ ] "View All FAQs" link works

- [ ] FAQ content is accurate and helpful

---

Future Enhancements (Optional)

Search Functionality: Filter FAQs by keyword

Category Filtering: Filter by category (Getting Started, Metrics, etc.)

Analytics: Track which FAQs are most viewed

Personalization: Show FAQs based on user's progress stage

Progressive Disclosure: Show more FAQs as time passes

Related FAQs: Suggest related FAQs when one is expanded

---

Timeline Estimate

Phase 1 (Data): 1 hour

Phase 2 (Components): 4-6 hours

Phase 3 (Integration): 2 hours

Phase 4 (Polish): 3-4 hours

Total: ~10-13 hours

---

Success Metrics

Engagement: Users expand at least 2-3 FAQs on average

Time on Page: Users stay on loading screen longer (less bounce)

Support Tickets: Reduction in onboarding-related support questions

User Feedback: Positive feedback on helpfulness of FAQs

---

Plan created: January 2025

Status: Ready for Implementation