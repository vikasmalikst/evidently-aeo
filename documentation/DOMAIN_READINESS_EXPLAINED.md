# Domain Readiness: Explained

## What is Domain Readiness?

**Domain Readiness** is an automated audit tool that evaluates how well your website is optimized for **AI Engine Optimization (AEO)**. It analyzes your domain's technical setup, content quality, and structure to determine how easily AI systems (like ChatGPT, Claude, Perplexity) can discover, crawl, and understand your brand.

## What Does It Do?

Domain Readiness runs a comprehensive analysis of your website across **4 main categories**:

### 1. **Technical Crawlability (25% weight)**
Checks if AI bots can actually access and crawl your site:
- ✅ **LLMs.txt** presence and quality
- ✅ **Robots.txt** configuration for LLM bot access
- ✅ **Sitemap.xml** availability and coverage
- ✅ **Mobile responsiveness** (viewport meta tags)
- ✅ **Canonical URL** implementation

**Why it matters:** If AI bots can't crawl your site, they can't learn about your brand.

### 2. **Content Quality (35% weight)**
Evaluates the quality and structure of your content:
- ✅ **Readability score** (Flesch score, target: 55-70)
- ✅ **Content depth** (long-form content detection, 1500+ words)
- ✅ **Content freshness** (publish dates, recency)
- ✅ **FAQ/structured Q&A** content presence
- ✅ **Brand consistency** (brand name usage)

**Why it matters:** High-quality, readable content helps AI systems understand and recommend your brand accurately.

### 3. **Semantic Structure (25% weight)**
Checks how well your HTML is structured for AI understanding:
- ✅ **Heading hierarchy** (H1/H2/H3 structure, single H1 recommended)
- ✅ **Semantic HTML5** usage (article, section, main, nav elements)
- ✅ **Schema.org markup** (Article, Product, FAQPage, BreadcrumbList)
- ✅ **Internal linking** structure

**Why it matters:** Proper semantic structure helps AI understand the context and relationships in your content.

### 4. **Accessibility & Brand (15% weight)**
Ensures your brand is properly represented:
- ✅ **Image alt text** coverage
- ✅ **ARIA labels** usage
- ✅ **Metadata quality** (title, description)
- ✅ **Open Graph tags** (og:title, og:description, og:image)

**Why it matters:** Rich metadata helps AI systems create accurate summaries and recommendations about your brand.

## How It Works

1. **Run Audit**: Click "Run Audit" in the Domain Readiness page
2. **Analysis**: The system crawls your website and runs 13+ different analyzers
3. **Scoring**: Each category gets a score (0-100), weighted by importance
4. **Overall Score**: Calculated as:
   ```
   Overall Score = 
     (Technical × 0.25) + 
     (Content × 0.35) + 
     (Semantic × 0.25) + 
     (Accessibility × 0.15)
   ```
5. **Results**: You see:
   - Overall readiness score (0-100)
   - Category breakdown
   - Detailed test results (pass/fail/warning)
   - Critical issues and priorities
   - LLM bot access status (GPTBot, Claude, Perplexity, etc.)

## What Does the Score Mean?

- **0-59**: 🔴 **Poor** - Major issues preventing AI discovery
- **60-74**: 🟡 **Fair** - Some optimization needed
- **75-89**: 🔵 **Good** - Well-optimized, minor improvements possible
- **90-100**: 🟢 **Excellent** - Highly optimized for AI engines

## How Can It Help Users?

### 1. **Identify Technical Blockers**
- Discover if robots.txt is blocking AI bots
- Find missing LLMs.txt files
- Detect crawlability issues

### 2. **Content Optimization Guidance**
- See if content is too complex or too simple
- Identify missing FAQ content
- Check content freshness

### 3. **Structure Improvements**
- Find heading hierarchy issues
- Identify missing schema markup
- Discover semantic HTML gaps

### 4. **Brand Representation**
- Ensure brand name is consistently used
- Check metadata quality
- Verify Open Graph tags

### 5. **Track Progress Over Time**
- Run audits periodically to track improvements
- Compare scores across time
- Measure impact of changes

## Connection to Recommendation Engine

Domain Readiness can be **powerfully integrated** with the recommendation engine to:

1. **Prioritize Recommendations**: Use readiness scores to prioritize which recommendations to show first
2. **Context-Aware Suggestions**: Generate recommendations based on specific readiness failures
3. **Technical Foundation First**: For cold_start brands, ensure technical readiness before content recommendations
4. **Gap Analysis**: Compare readiness gaps with recommendation opportunities
5. **Success Tracking**: Measure if recommendations improve readiness scores over time

See the implementation plan below for detailed integration strategy.

