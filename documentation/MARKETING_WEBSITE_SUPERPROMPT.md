# Superprompt: Build Marketing Website for Evidently

## Project Overview

**Evidently** is a comprehensive brand intelligence and competitive analysis platform that tracks and analyzes how brands appear in AI-generated answers across major AI models (ChatGPT, Claude, Grok, etc.) and search engines. The platform provides real-time insights into brand visibility, sentiment, market share, and competitive positioning in the AI-powered search landscape.

### Core Value Proposition

Evidently helps businesses understand and improve their presence in AI-generated responses, which is becoming increasingly critical as AI assistants replace traditional search engines. The platform tracks brand mentions, analyzes sentiment, measures visibility metrics, and provides actionable insights to improve brand positioning in AI responses.

### Key Features & Capabilities

1. **Visibility Index** - Measures brand's average prominence across all AI-generated answers with position-weighted visibility calculations
2. **Share of Answers (SOA)** - Tracks brand's share of total answer space across all AI models, showing relative market presence
3. **Sentiment Score** - Analyzes how brands are discussed in AI-generated answers (range: -1 to +1, with 0 being neutral)
4. **Brand Presence** - Percentage of queries where brand appears in AI-generated answers
5. **AI Sources Analysis** - Tracks mentions across different AI providers (ChatGPT, Claude, Grok, etc.)
6. **Search Sources Analysis** - Monitors brand visibility across search engines and editorial sources
7. **Topic Analysis** - Identifies which topics and themes are associated with brand mentions
8. **Competitor Comparison** - Compare brand performance against competitors in AI-generated answers
9. **Keyword Tracking** - Monitor specific keywords and their performance
10. **Prompt Management** - Manage and analyze queries used to test brand visibility
11. **Historical Trends** - Track performance over time with date range filtering
12. **Source Attribution** - Identify which sources (editorial, brand sites, etc.) are cited in AI answers

### Target Audience

- Marketing teams and brand managers
- SEO professionals
- Competitive intelligence analysts
- Product managers
- CMOs and marketing executives
- Businesses looking to optimize their AI visibility

### Technical Stack (for reference)

- Frontend: React 18, TypeScript, Vite
- Styling: Tailwind CSS
- UI Components: Lucide React icons, Chart.js for data visualization
- State Management: Zustand
- Routing: React Router v7

---

## Design Requirements

### Theme & Visual Style

**Theme:** Light theme only (no dark mode needed for marketing site)

**Color Palette:**
- Primary Accent: `#00bcdc` (Cyan/Teal)
- Accent Hover: `#0096b0` (Darker Cyan)
- Accent Light: `rgba(0, 188, 220, 0.1)`
- Success: `#06c686` (Green)
- Error: `#f94343` (Red)
- Warning: `#f9db43` (Yellow)
- Background Primary: `#ffffff`
- Background Secondary: `#f4f4f6`
- Background Tertiary: `#e8e9ed`
- Text Headings: `#1a1d29`
- Text Body: `#212534`
- Text Caption: `#393e51`
- Border Default: `#e8e9ed`
- Border Strong: `#c6c9d2`

**Data Visualization Colors:**
- `#06B6d4` (Cyan)
- `#498cf9` (Blue)
- `#ac59fb` (Purple)
- `#fa8a40` (Orange)
- `#f155a2` (Pink)

### Typography

**Primary Font:** Sora (Google Fonts)
- Use for: Headings, body text, navigation, buttons, general UI
- Font stack: `'Sora', system-ui, -apple-system, sans-serif`

**Data Font:** IBM Plex Sans (Google Fonts)
- Use for: Tables, charts, data visualizations, metrics, statistics
- Font stack: `'IBM Plex Sans', system-ui, -apple-system, sans-serif`

**Font Usage Guidelines:**
- All headings (h1, h2, h3, etc.) should use Sora
- Body text and paragraphs should use Sora
- Any data tables, charts, or numerical displays should use IBM Plex Sans
- Metrics, statistics, and KPI cards should use IBM Plex Sans for numbers

### UI Component Library

**Use Shadcn/ui components** as the primary component library. The website should leverage:
- Button components
- Card components
- Badge components
- Input components
- Select/Dropdown components
- Dialog/Modal components
- Tabs components
- Accordion components
- Tooltip components
- And other Shadcn/ui components as needed

**Additional UI Enhancements:**
- Use Lucide React for icons (consistent with the dashboard)
- Implement smooth animations and transitions
- Use modern, clean design patterns
- Ensure responsive design (mobile-first approach)
- Implement proper spacing and visual hierarchy

---

## Website Structure & Content

### Required Pages/Sections

1. **Hero Section**
   - Compelling headline about AI visibility and brand intelligence
   - Subheadline explaining the value proposition
   - Clear call-to-action buttons (e.g., "Get Started", "Request Demo")
   - Visual element (illustration, graphic, or hero image)

2. **Problem Statement Section**
   - Explain the shift from traditional search to AI-powered search
   - Highlight the challenge: brands need visibility in AI responses
   - Statistics or data points about AI search adoption

3. **Solution Overview**
   - How Evidently solves the problem
   - Key differentiators
   - Visual representation of the platform's capabilities

4. **Features Section**
   - Grid or list of key features with icons
   - Brief descriptions for each feature:
     - Visibility Index tracking
     - Share of Answers measurement
     - Sentiment analysis
     - AI source tracking
     - Competitor comparison
     - Topic analysis
     - Historical trends
   - Use icons from Lucide React

5. **How It Works**
   - Step-by-step explanation of the platform workflow
   - Visual flow or process diagram
   - Simple, easy-to-understand language

6. **Benefits/Value Propositions**
   - What users gain from using Evidently
   - ROI-focused messaging
   - Use cases and scenarios

7. **Metrics & Insights Preview**
   - Show example metrics (without real data)
   - Visual representation of dashboard capabilities
   - Highlight key KPIs: Visibility Index, SOA, Sentiment, Brand Presence

8. **Testimonials/Social Proof** (if applicable)
   - Customer testimonials
   - Case studies
   - Trust indicators

9. **Pricing Section** (if applicable)
   - Pricing tiers or plans
   - Feature comparison
   - Clear call-to-action

10. **FAQ Section**
    - Common questions about the platform
    - Answers about features, implementation, etc.

11. **Footer**
    - Links to important pages
    - Contact information
    - Social media links
    - Legal links (Privacy Policy, Terms of Service)

---

## Design Principles

1. **Modern & Professional** - Clean, contemporary design that reflects a tech-forward brand
2. **Data-Driven Aesthetic** - Incorporate subtle data visualization elements and metrics
3. **Trustworthy** - Professional appearance that builds confidence
4. **Accessible** - Follow WCAG guidelines for accessibility
5. **Performance** - Fast loading times, optimized images, efficient code
6. **Mobile Responsive** - Perfect experience on all device sizes
7. **Consistent Branding** - Use the exact color palette and fonts specified above

---

## Technical Requirements

1. **Framework:** React 18+ with TypeScript
2. **Build Tool:** Vite
3. **Styling:** Tailwind CSS (configured with the fonts and colors above)
4. **Component Library:** Shadcn/ui (install and configure properly)
5. **Icons:** Lucide React
6. **Fonts:** 
   - Import Sora from Google Fonts
   - Import IBM Plex Sans from Google Fonts
7. **No Backend Required** - This is a frontend-only marketing website
8. **Routing:** React Router (for multi-page if needed, or single-page with sections)
9. **Animations:** Use CSS transitions and consider Framer Motion for advanced animations
10. **SEO:** Proper meta tags, semantic HTML, Open Graph tags

---

## Implementation Guidelines

1. **Setup:**
   - Initialize a new Vite + React + TypeScript project
   - Install and configure Tailwind CSS with the custom theme (fonts and colors)
   - Install Shadcn/ui and configure it properly
   - Install Lucide React for icons
   - Set up Google Fonts (Sora and IBM Plex Sans)

2. **Tailwind Configuration:**
   ```javascript
   // tailwind.config.js should include:
   theme: {
     extend: {
       fontFamily: {
         'sans': ['Sora', 'system-ui', '-apple-system', 'sans-serif'],
         'data': ['IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
       },
       colors: {
         // Use the color palette specified above
       }
     }
   }
   ```

3. **Component Structure:**
   - Create reusable components using Shadcn/ui
   - Organize components logically
   - Use TypeScript for type safety
   - Follow React best practices

4. **Content:**
   - Write compelling, benefit-focused copy
   - Use clear, jargon-free language
   - Focus on value propositions
   - Include relevant statistics where appropriate

5. **Visual Elements:**
   - Use the brand colors consistently
   - Apply proper spacing and typography
   - Include relevant illustrations or graphics
   - Use icons from Lucide React appropriately

---

## Deliverables

Create a complete, production-ready marketing website that includes:

1. All required pages/sections listed above
2. Responsive design for all screen sizes
3. Proper font implementation (Sora and IBM Plex Sans)
4. Consistent use of brand colors
5. Shadcn/ui components throughout
6. Smooth animations and interactions
7. SEO-optimized structure
8. Clean, maintainable code
9. Proper TypeScript types
10. README with setup instructions

---

## Additional Notes

- The website should feel premium and professional
- Focus on conversion optimization (clear CTAs, compelling copy)
- Make it easy for visitors to understand the product quickly
- Use visual hierarchy to guide user attention
- Ensure fast page load times
- Test on multiple browsers and devices
- The design should complement the existing dashboard's aesthetic while being optimized for marketing purposes

---

**Start building the marketing website now, following all the specifications above. Make it beautiful, modern, and conversion-focused while maintaining consistency with the Evidently brand identity.**



