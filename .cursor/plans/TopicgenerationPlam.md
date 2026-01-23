## Goal: Improve topic & prompt generation via web scraping (brand + industry keywords)

The current topic generation produces generic results (for example, **"Agicap features"**) because it relies on limited context from Clearbit or basic LLM knowledge. To improve specificity, we will **scrape the brand’s actual website content** (headings, subheadings, navigation text) and feed this “ground truth” into the Topic Generation LLM.

In addition to brand-specific terms, we also want **industry/category keywords** so the resulting prompts are **neutral** and not overly brand-centric (brand + category language should both be prominent).

## User review required (important)

This approach adds a real-time web request during onboarding/topic generation. Using `axios` should keep it fast, but it may still add **~1–3 seconds** of latency. The plan assumes this is acceptable given the quality improvement.

## Proposed changes

### Backend services

#### [NEW] `website-scraper.service.ts`

- **Tech**: `axios` + `cheerio`
- **Add**: `scrapeHomepage(url: string)`
  - Fetch HTML
  - Extract:
    - `title`
    - meta description
    - headings: `h1`, `h2`, `h3`
    - navigation links (link text)
  - Clean + truncate text to fit prompt context limits

**Also add (keyword context from scraped content)**

- Derive a compact keyword/context payload from the scraped content, for example:
  - **Brand keywords**: product names, feature names, differentiators, branded terms seen in headings/nav
  - **Industry keywords**: category/segment terms inferred from headings/meta/nav (e.g., “cash flow forecasting”, “treasury management”, “accounts payable automation”)
- Output shape (example):
  - `websiteContent` (string summary / condensed text)
  - `brandKeywords: string[]`
  - `industryKeywords: string[]`

#### [MODIFY] `onboarding-intel.service.ts`

- Import `websiteScraperService`.
- In `lookupBrandIntel`, after identifying the domain:
  - Call `websiteScraperService.scrapeHomepage(domain)`.
  - Make the scraped data available to the later topic generation flow.

**Note**

- `lookupBrandIntel` returns `BrandIntelPayload`. We may need to:
  - store the scraped data, or
  - return it so it can be passed to `generateTopicsAndQueries`.

**Correction / dependency**

- `OnboardingIntelService` handles initial brand lookup.
- Topics are generated later via `TopicsQueryGenerationService`.
- We need to identify where `TopicsQueryGenerationService` is called and ensure the scraped content is passed through.

#### [MODIFY] `topics-query-generation.service.ts`

**Refinement**

- `TopicsAndQueriesRequest` currently accepts `description`.
- Options:
  - append the scraped summary into `description`, or
  - add a new `websiteContent` field to the request (cleaner).

**Plan (preferred)**

- Update `TopicsAndQueriesRequest` to include:
  - `websiteContent?: string`
  - `brandKeywords?: string[]`
  - `industryKeywords?: string[]`
- Update `buildPrompt` to include:
  - a “Website Context” section, e.g.:
  - “The following content was scraped from the brand’s homepage: …”
  - a “Brand Keywords” section (bulleted list)
  - an “Industry Keywords” section (bulleted list)

**Prompt requirement (neutrality)**

- Instruct the LLM to generate topics/queries that:
  - use a **balanced mix** of **brand-specific** and **industry/category** terms
  - avoid overly promotional language (use neutral research/comparison phrasing)
  - include category terms even when not explicitly branded (to avoid “{Brand} features” genericity)

#### [MODIFY] `onboarding.routes.ts` / controller

- Identify where `generateTopicsAndQueries` is called.
- Ensure that when the frontend requests topic generation, it can either:
  - trigger scraping on-the-fly (if not done yet), or
  - receive scraped data from the initial onboarding step.

**Simplest approach**

In the Topic Generation endpoint: if `brandUrl` is provided, trigger scraping there before calling the generation service.

## Verification plan

### Manual verification

- **Test scraper**: create `scripts/test-scraper.ts` to run `scrapeHomepage` against `agicap.com` and verify it extracts terms like “Cash Flow Management”, “Liquidity Planning”, etc.
- **Test topic generation**: create `scripts/test-topics-with-scraping.ts` that:
  - scrapes `agicap.com`
  - calls `topicsQueryGenerationService.generateTopicsAndQueries` with the scraped content
  - compares output with “Before” screenshots
    - expectation:
      - brand-specific: features/terms actually present on the homepage
      - industry-specific: category language like “cash flow forecasts”, “treasury”, “ERP integration”, etc.
      - neutral phrasing: comparisons / use-cases, not just “{Brand} features”