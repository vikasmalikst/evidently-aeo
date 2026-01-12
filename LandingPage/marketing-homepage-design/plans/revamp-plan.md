# Marketing Website Revamp Plan - Evidently

## Executive Summary

This plan outlines a comprehensive transformation of the Evidently marketing website from a basic Bolt-generated template to a high-converting, modern SaaS marketing site comparable to Stripe, Linear, Vercel, and Notion. The revamp focuses on product-specific messaging, polished UI/UX, smooth animations, clear value propositions, and conversion optimization.

---

## Phase 1: Deep Analysis Summary

### Current State Assessment

**Strengths:**
- Clean component structure with shadcn/ui
- Good section organization (Hero, Problem, Features, Case Studies, Trust, FAQ, CTA)
- Responsive layout foundation
- Product-specific content already present in some sections
- Modern tech stack (Next.js, TypeScript, Tailwind CSS)

**Critical Gaps Identified:**

1. **Content Issues:**
   - Generic placeholder content in trust section ("Brand Logo", "Tech Company")
   - Missing depth in value proposition messaging
   - FAQ section too brief (only 4 questions)
   - Limited social proof specificity

2. **UI/UX Issues:**
   - Basic visual hierarchy - needs more contrast and spacing
   - Limited animations and micro-interactions
   - No scroll-based reveals or entrance animations
   - Button interactions are minimal
   - Missing visual flow between sections

3. **Conversion Path Issues:**
   - CTAs are present but not optimized for conversion
   - Missing urgency or scarcity elements
   - No pricing section (mentioned in nav but not present)
   - Limited trust signals beyond basic compliance badges

4. **Accessibility & Performance:**
   - No focus states visible
   - Missing keyboard navigation indicators
   - No animation performance optimizations
   - Images may need optimization

---

## Phase 2: Information Architecture

### Final Section Order & Rationale

1. **Navigation (Sticky)**
   - **Why:** Always accessible, enables quick navigation
   - **Enhancement:** Add smooth scroll behavior, active section highlighting

2. **Hero Section**
   - **Why:** First impression, must communicate value in 5 seconds
   - **Enhancement:** Stronger headline, clearer CTA hierarchy, animated dashboard preview

3. **Problem Strip**
   - **Why:** Immediately after hero to create urgency and identify with pain points
   - **Enhancement:** Add visual icons, better spacing, subtle animations

4. **Core Value Proposition (Hero Feature 1)**
   - **Why:** Shows the solution immediately after problem
   - **Enhancement:** Better visual storytelling, interactive elements

5. **Smart Recommendations (Hero Feature 2)**
   - **Why:** Differentiates from competitors, shows unique value
   - **Enhancement:** More compelling visuals, outcome-focused messaging

6. **Feature Grid**
   - **Why:** Comprehensive feature overview for evaluators
   - **Enhancement:** Better card design, hover states, icons

7. **How It Works Section (NEW)**
   - **Why:** Reduces friction, shows simplicity
   - **Enhancement:** Step-by-step visual flow, 3-4 steps max

8. **Case Studies**
   - **Why:** Social proof with specific results
   - **Enhancement:** More detailed metrics, better visual design

9. **Trust Section**
   - **Why:** Builds credibility before pricing/FAQ
   - **Enhancement:** Real logos (or better placeholders), stronger testimonials

10. **Pricing Section (NEW)**
    - **Why:** Critical for conversion, addresses pricing concerns
    - **Enhancement:** Clear tiers, value-focused, FAQ integration

11. **FAQ Section**
    - **Why:** Addresses objections before final CTA
    - **Enhancement:** Expand to 8-10 questions, better categorization

12. **Final CTA Strip**
    - **Why:** Last chance conversion opportunity
    - **Enhancement:** Stronger copy, urgency elements

13. **Footer**
    - **Why:** Navigation and legal requirements
    - **Enhancement:** Better organization, more links

### User Flow & Conversion Path

**Primary Path:** Hero → Problem → Solution → Features → Social Proof → Pricing → FAQ → CTA
**Secondary Path:** Hero → Quick Demo → Pricing → CTA
**Evaluation Path:** Hero → Features → Case Studies → Trust → FAQ → CTA

---

## Phase 3: UI and UX Revamp Plan

### Typography Scale

**Headings:**
- H1 (Hero): `text-5xl lg:text-6xl xl:text-7xl` - Bold, high contrast
- H2 (Section): `text-3xl lg:text-4xl xl:text-5xl` - Clear hierarchy
- H3 (Subsection): `text-xl lg:text-2xl` - Supporting content
- Body: `text-base lg:text-lg` - Readable, comfortable line-height

**Font Weights:**
- Headings: `font-bold` (700)
- Subheadings: `font-semibold` (600)
- Body: `font-normal` (400)
- Emphasis: `font-medium` (500)

### Spacing System

**Section Padding:**
- Mobile: `py-16 lg:py-24 xl:py-32`
- Container: `px-4 lg:px-6 xl:px-8`
- Gap between elements: `gap-6 lg:gap-8 xl:gap-12`

**Component Spacing:**
- Cards: `p-6 lg:p-8`
- Buttons: `px-6 py-3 lg:px-8 lg:py-4`
- Grid gaps: `gap-6 lg:gap-8`

### Visual Hierarchy Improvements

1. **Color Contrast:**
   - Increase contrast between foreground and background
   - Use accent color (cyan-500) strategically for CTAs and highlights
   - Add subtle gradients for depth

2. **Card Design:**
   - Enhanced shadows: `shadow-lg hover:shadow-xl`
   - Better borders: `border-2` for emphasis
   - Rounded corners: `rounded-xl lg:rounded-2xl`

3. **Button Hierarchy:**
   - Primary: Solid cyan-500, white text, larger size
   - Secondary: Outline, transparent background
   - Tertiary: Text-only with underline on hover

### Mobile-First Design Decisions

1. **Navigation:**
   - Hamburger menu with smooth slide-in animation
   - Sticky header with backdrop blur

2. **Hero:**
   - Stack content vertically on mobile
   - Image below text on mobile
   - Full-width CTAs on mobile

3. **Grids:**
   - 1 column on mobile
   - 2 columns on tablet
   - 3 columns on desktop

### Accessibility Improvements

1. **Focus States:**
   - Visible focus rings: `focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2`
   - High contrast: `focus:outline-none` with ring

2. **Keyboard Navigation:**
   - All interactive elements keyboard accessible
   - Skip to content link
   - Logical tab order

3. **Color Contrast:**
   - WCAG AA compliance for all text
   - Minimum 4.5:1 ratio for body text
   - Minimum 3:1 ratio for large text

4. **ARIA Labels:**
   - Descriptive labels for icons
   - Section landmarks
   - Button purpose clearly stated

---

## Phase 4: Animation and Interaction Plan

### Animation Strategy

**Library:** Framer Motion (lightweight, performant, React-friendly)

**Performance:**
- Use `will-change` CSS property sparingly
- Prefer `transform` and `opacity` for animations
- Use `useReducedMotion` hook for accessibility
- Lazy load animations on scroll

### Specific Animations

1. **Hero Section:**
   - Fade in + slide up for headline (0.6s delay)
   - Fade in for subheadline (0.8s delay)
   - Stagger fade-in for CTAs (1s delay)
   - Parallax effect for dashboard image
   - Floating metric card animation

2. **Section Entrances:**
   - Scroll-triggered fade-in with `useInView`
   - Stagger children animations (0.1s between items)
   - Slide up from bottom (20px)

3. **Hover Micro-interactions:**
   - Button: Scale (1.05) + shadow increase
   - Cards: Lift effect (translateY -4px) + shadow increase
   - Links: Underline slide-in from left
   - Icons: Rotate or scale on hover

4. **Button Feedback:**
   - Active state: Scale down (0.98)
   - Loading state: Spinner animation
   - Success state: Checkmark animation

5. **Section Transitions:**
   - Smooth scroll behavior
   - Background color transitions between sections
   - Subtle gradient shifts

6. **Interactive Elements:**
   - Accordion: Smooth height transition
   - Tabs: Slide indicator animation
   - Form inputs: Label float animation

### Animation Timing

- **Fast:** 150ms (hover states, button clicks)
- **Medium:** 300ms (card hovers, transitions)
- **Slow:** 600ms (entrance animations, section reveals)

---

## Phase 5: Component Strategy

### Reusable Components to Create

1. **Section Container**
   - Standardized padding, max-width, spacing
   - Props: `variant` (light/dark), `fullWidth`

2. **Feature Card**
   - Icon, title, description
   - Hover states, animations
   - Props: `icon`, `title`, `description`, `href`

3. **CTA Button**
   - Variants: primary, secondary, tertiary
   - Sizes: sm, md, lg
   - Loading and disabled states
   - Icon support

4. **Metric Display**
   - Large number, label, change indicator
   - Animated counter for numbers
   - Props: `value`, `label`, `change`, `trend`

5. **Testimonial Card**
   - Quote, attribution, company
   - Star rating
   - Props: `quote`, `author`, `role`, `company`, `rating`

6. **Logo Grid**
   - Responsive grid of brand logos
   - Grayscale to color on hover
   - Props: `logos` (array of image URLs)

### Custom Components

1. **Hero Section**
   - Custom layout with image positioning
   - Floating metric card
   - Animated background gradients

2. **How It Works**
   - Step-by-step visual flow
   - Connector lines between steps
   - Animated progress indicator

3. **Pricing Table**
   - Three-tier layout
   - Feature comparison
   - Toggle for annual/monthly

4. **FAQ Accordion**
   - Enhanced styling
   - Search functionality (optional)
   - Category filtering

### Component Abstraction Justification

- **Reusability:** Feature cards, CTAs used multiple times
- **Consistency:** Standardized spacing and styling
- **Maintainability:** Single source of truth for styles
- **Performance:** Smaller bundle size with shared components

---

## Phase 6: UI Libraries and Tools

### Recommended Libraries

1. **Framer Motion** (`framer-motion`)
   - **Why:** Industry standard for React animations
   - **Use:** Scroll animations, entrance effects, micro-interactions
   - **Size:** ~50KB gzipped
   - **Justification:** Essential for premium feel

2. **Lucide React** (Already installed)
   - **Why:** Consistent icon system
   - **Use:** All icons throughout site
   - **Justification:** Already in use, maintain consistency

3. **React Intersection Observer** (`react-intersection-observer`)
   - **Why:** Efficient scroll-triggered animations
   - **Use:** Section reveals, lazy loading
   - **Size:** ~2KB gzipped
   - **Justification:** Better than custom implementation

### Tools to Avoid

1. **Heavy animation libraries** (GSAP, Three.js)
   - **Why:** Overkill for marketing site
   - **Impact:** Increases bundle size unnecessarily

2. **Additional UI component libraries**
   - **Why:** shadcn/ui already provides everything needed
   - **Impact:** Avoids dependency bloat

### Performance Optimizations

1. **Image Optimization:**
   - Use Next.js `Image` component
   - WebP format with fallbacks
   - Lazy loading for below-fold images

2. **Code Splitting:**
   - Dynamic imports for heavy components
   - Route-based code splitting

3. **Animation Performance:**
   - Use `transform` and `opacity` only
   - Avoid animating `width`, `height`, `top`, `left`
   - Use `will-change` sparingly

---

## Phase 7: Marketing and Content Strategy

### Product Understanding

**Evidently** is an AI Visibility Analytics Platform that helps brands:
- Track visibility across AI platforms (Google AI Overviews, ChatGPT, Perplexity, Gemini)
- Monitor competitive positioning and Share of Answer
- Get AI-specific optimization recommendations
- Prove ROI of Answer Engine Optimization (AEO) efforts

**Target Audience:**
- Marketing leaders at SaaS, E-commerce, and Enterprise companies
- SEO/AEO specialists
- Growth teams
- Product marketers

**Key Pain Points:**
1. Can't see where brand appears in AI answers
2. Losing visibility to competitors in AI search
3. Can't prove ROI of AEO efforts
4. Generic SEO advice doesn't work for AI

**Competitive Differentiation:**
- Real-time data from actual AI queries (not simulations)
- Platform-specific recommendations
- Competitive benchmarking
- ROI tracking and reporting

### Content Revamp

#### Hero Section
**Headline (Current):** "See where your brand ranks in AI answers—before your competitors do."
**New Headline:** "Win in AI Search Before Your Competitors Even Know They're Losing"

**Subheadline (Enhanced):**
"Track your brand's visibility across Google AI Overviews, ChatGPT, Perplexity, and Gemini. Get data-driven recommendations that actually work. Prove ROI to your CFO."

**CTA Copy:**
- Primary: "Start Free Trial" (14 days, no credit card)
- Secondary: "Book a Demo" (30-min call, no pitch)

#### Problem Statement (Enhanced)
More emotional, outcome-focused language:
- "Your #1 rankings mean nothing if AI doesn't mention you"
- "You're invisible in the future of search—and losing revenue every day"
- "You can't optimize what you can't measure"

#### Value Propositions
1. **Real-Time Visibility:** "See exactly where you appear in AI answers—updated hourly, not monthly"
2. **Competitive Intelligence:** "Know your Share of Answer vs. top 5 competitors. Identify gaps. Win."
3. **Actionable Recommendations:** "Get AI-specific optimization advice—not generic SEO tips"
4. **ROI Proof:** "Connect visibility gains to qualified leads and pipeline impact"

#### Feature Descriptions (Outcome-Focused)
- Instead of: "Share of Answer Tracking"
- Say: "Know if you're gaining or losing ground—see your Share of Answer vs. competitors in real-time"

#### How It Works (New Section)
1. **Connect:** Add your brand and competitors (2 minutes)
2. **Monitor:** We track AI visibility across all platforms (automatic)
3. **Optimize:** Get specific recommendations for your brand (weekly reports)
4. **Prove:** Show ROI with visibility-to-revenue metrics (export-ready)

#### Competitive Advantage
- "We query AI models directly—no simulations, no estimates"
- "Platform-specific recommendations—what works for ChatGPT differs from Perplexity"
- "Built for marketing teams—not just SEO specialists"

---

## Phase 8: FAQ Section Enhancement

### Current FAQs (4) - Expand to 10

**New FAQ Categories:**

1. **Product & Platform (3 questions)**
   - What's the difference between AEO and SEO? (existing)
   - Which AI platforms do you track? (existing)
   - How often is data updated? (existing)

2. **Competitive Intelligence (2 questions)**
   - Can I track competitors? (existing)
   - How do you calculate Share of Answer?

3. **Implementation & Onboarding (2 questions)**
   - How long does setup take?
   - Do I need technical resources?

4. **Pricing & Plans (2 questions)**
   - What's included in the free trial?
   - Can I change plans later?

5. **Data & Security (1 question)**
   - How do you ensure data accuracy?

### FAQ Content (New Questions)

**Q: How long does setup take?**
A: Setup takes less than 5 minutes. Add your brand name, industry, and up to 5 competitors. We'll start tracking immediately and you'll see your first results within 24 hours.

**Q: Do I need technical resources to use Evidently?**
A: No. Evidently is designed for marketing teams. No coding, no technical setup. Our recommendations are actionable—you can implement them with your existing content team.

**Q: What's included in the free trial?**
A: The 14-day free trial includes full access to all features: real-time visibility tracking, competitive benchmarking, AI-specific recommendations, and ROI reporting. No credit card required.

**Q: Can I change plans later?**
A: Yes, you can upgrade, downgrade, or cancel anytime. Changes take effect immediately. No long-term contracts or hidden fees.

**Q: How do you calculate Share of Answer?**
A: Share of Answer measures what percentage of AI mentions in your category belong to your brand vs. competitors. We analyze thousands of queries daily across all tracked platforms to ensure statistical significance.

**Q: How do you ensure data accuracy?**
A: We query AI models directly using real user queries—no simulations or estimates. Every data point reflects an actual AI response. We run 100s of queries daily per brand to ensure statistical significance.

---

## Phase 9: Implementation Checklist

### Priority 1: Foundation (Week 1)
- [ ] Install Framer Motion
- [ ] Create reusable component structure
- [ ] Set up animation utilities
- [ ] Implement section container component

### Priority 2: Content & Messaging (Week 1)
- [ ] Rewrite hero section copy
- [ ] Enhance problem statement
- [ ] Update feature descriptions
- [ ] Create "How It Works" section
- [ ] Expand FAQ section

### Priority 3: UI/UX Polish (Week 2)
- [ ] Improve typography scale
- [ ] Enhance spacing system
- [ ] Refine color usage
- [ ] Improve card designs
- [ ] Enhance button hierarchy

### Priority 4: Animations (Week 2)
- [ ] Hero entrance animations
- [ ] Scroll-triggered section reveals
- [ ] Hover micro-interactions
- [ ] Button feedback animations
- [ ] Smooth transitions

### Priority 5: New Sections (Week 2)
- [ ] Create "How It Works" section
- [ ] Create Pricing section
- [ ] Enhance Trust section
- [ ] Improve Footer

### Priority 6: Accessibility & Performance (Week 3)
- [ ] Add focus states
- [ ] Implement keyboard navigation
- [ ] Optimize images
- [ ] Add ARIA labels
- [ ] Performance testing

### Priority 7: Final Polish (Week 3)
- [ ] Cross-browser testing
- [ ] Mobile responsiveness check
- [ ] Animation performance optimization
- [ ] Content review
- [ ] Final QA

---

## Success Metrics

### Conversion Goals
- Increase demo requests by 40%
- Increase free trial signups by 60%
- Reduce bounce rate by 25%
- Increase time on page by 30%

### Quality Goals
- Lighthouse score: 90+ (Performance, Accessibility, Best Practices, SEO)
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Animation frame rate: 60fps

---

## Conclusion

This plan transforms the Evidently marketing website into a high-converting, modern SaaS site that clearly communicates value, builds trust, and drives action. The focus on product-specific messaging, polished UI/UX, smooth animations, and conversion optimization will position Evidently as a premium solution in the AEO space.

**Next Steps:** Begin implementation following the priority checklist, starting with foundation and content updates.

