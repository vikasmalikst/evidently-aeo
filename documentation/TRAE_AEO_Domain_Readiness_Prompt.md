# Project: AEO Domain Readiness Tool - Platform-Aware Integration for Evidentlyaeo.com

## Context

You are building a **Domain Readiness Analyzer** feature to be integrated into the existing Evidentlyaeo.com platform (an AEO/GEO analytics and optimization platform).

This tool will:
- Benchmark a brand’s website for **LLM search engine crawlability and AI-readiness**.
- Live primarily as a **sidebar feature** called "Domain Readiness".
- Later also run automatically during **brand onboarding** as a pre-flight check.

The prompt below is designed to be used in TRAE SOLO Builder as a **single, comprehensive specification**. It must be treated as the source of truth for strategy, scope, architecture, and constraints.

---

## 1. Platform-Aware Integration Requirements

The AEO Domain Readiness tool is **not** a standalone app. It must integrate cleanly into the existing Evidentlyaeo.com backend and frontend.

### 1.1. Critical Instructions

1. **Do NOT assume database schema or naming conventions.**
   - You must **inspect the existing database schema and models** in the Evidentlyaeo.com codebase before creating new tables or fields.
   - You must **match existing naming conventions** for:
     - Table names (plural vs singular, snake_case vs camelCase, etc.)
     - Column names
     - Primary key and foreign key naming
     - Timestamp columns (e.g., `created_at` vs `createdAt`)

2. **Do NOT invent new brand or user schemas.**
   - The platform already has a **brand table/model** and a **user table/model**.
   - The **brand URL is already known** and stored in the existing schema.
   - The **brand_id (or equivalent)** is part of the existing schema.
   - You must **use** these existing structures and NOT duplicate brand-related data.

3. **Do NOT hardcode new API prefixes or patterns.**
   - Inspect existing API route structure and follow the same conventions:
     - Existing prefixes (e.g., `/api`, `/api/v1`)
     - Existing REST patterns (plural vs singular, nesting under `/brands/:id`, etc.)
     - Existing error response format, status codes, wrappers (e.g., `{ success, data, error }`).

4. **Do NOT impose your own service patterns.**
   - Detect whether the backend uses:
     - Services as classes (e.g., `SomeService`)
     - Functional modules (plain functions)
     - Dependency injection containers
   - Implement the new feature following the **same patterns**.

5. **Do NOT introduce conflicting TypeScript types or naming.**
   - Follow existing conventions:
     - `IUser` vs `User` vs `UserDto` styles
     - `type` vs `interface`
     - DTO naming and location

6. **Do NOT introduce new UI paradigms.**
   - Inspect the frontend:
     - Which UI library is used (Material UI, Chakra, Ant, Tailwind, custom)?
     - How layout components are structured
     - How forms are handled (React Hook Form, Formik, custom)
     - How data is fetched (React Query, SWR, RTK Query, etc.)
   - Implement the "Domain Readiness" feature using **identical patterns and libraries**.

### 1.2. Use Existing Brand Context

- The brand URL (domain) must be obtained from the existing **brand entity/model**, not from new fields.
- The brand identifier must use the existing field and type (e.g., `brand_id`, `brandId`).
- API access should use the **current authenticated user context** to resolve:
  - Current brand
  - Permissions

You may assume:
- Users are associated to one or more brands.
- The platform already has a way to determine "current brand" in the UI and backend.

---

## 2. Feature Overview

### 2.1. Feature Name & Placement

- Feature name in UI: **"Domain Readiness"**
- Primary placement: **Sidebar navigation item** in the main Evidentlyaeo.com app.
- Future placement: integrated into **brand onboarding** flow as a pre-flight domain check.

### 2.2. Core Functional Goal

Given a brand domain, the tool should:
1. Run a series of technical and content checks on the website.
2. Compute an **overall AEO readiness score** (0–100).
3. Provide a breakdown by **four main categories**:
   - Technical Crawlability
   - Content Quality
   - Semantic Structure
   - Accessibility & Brand
4. Highlight **critical issues** and **top improvement priorities**.
5. Show **LLM bot access status** for key crawlers (GPTBot, Claude, Perplexity, etc.).
6. Store results for **historical tracking** and comparison.

---

## 3. Scoring Model (Authoritative)

The scoring model must reflect the relative importance of different aspects for LLM search / AEO.

### 3.1. Category Weights

```ts
// All category scores are 0–100
const overallScore =
  technicalCrawlability   * 0.25 +
  contentQuality          * 0.35 +
  semanticStructure       * 0.25 +
  accessibilityAndBrand   * 0.15;
```

### 3.2. Category Composition

1. **Technical Crawlability (25%)**
   - LLMs.txt presence & basic quality (5%)
   - Robots.txt availability and LLM bot allowance (5%)
   - Sitemap.xml accessibility and basic coverage (5%)
   - Mobile responsiveness (viewport meta tag presence/quality) (5%)
   - Canonical URL implementation (5%)

2. **Content Quality (35%)**
   - Flesch Readability Score (8%) — target ~55–70 range
   - Content depth / word count (10%) — long-form detection (1500+ words)
   - Content freshness (8%) — publish date & age
   - FAQ/structured Q&A content (7%) — FAQ schema or Q&A patterns
   - Brand consistency (2%) — brand name usage & placement

3. **Semantic Structure (25%)**
   - Heading hierarchy (H1/H2/H3 sanity; single H1 recommended) (6%)
   - Semantic HTML5 usage (article, section, main, nav, etc.) (6%)
   - Schema.org high-value types (Article, Product, FAQPage, BreadcrumbList, etc.) (8%)
   - Internal linking (stub/scaffold now; full later) (5%)

4. **Accessibility & Brand (15%)**
   - Image alt text coverage (5%)
   - ARIA labels usage (3%)
   - Metadata quality (title, description) (4%)
   - Open Graph tags (og:title, og:description, og:image) (3%)

---

## 4. Core Data Structures (Conceptual)

You must map these **conceptual** types onto the platform's actual TypeScript/ORM style. Do **not** conflict with existing types; instead, align names and styles.

```ts
// Adapt naming to match existing conventions (e.g., IAeoAuditResult, DomainAuditResult, etc.)
interface AeoAuditResult {
  auditId: string;       // Name and type must follow existing ID patterns
  brandId: string;       // Foreign key to existing brand model
  domain: string;
  timestamp: string;     // Or Date if that’s the platform’s convention
  overallScore: number;
  scoreBreakdown: {
    technicalCrawlability: number;
    contentQuality: number;
    semanticStructure: number;
    accessibilityAndBrand: number;
  };
  detailedResults: Record<string, CategoryResult>;
  botAccessStatus: BotAccessStatus[];
  criticalIssues: Issue[];
  improvementPriorities: string[];
  metadata: AuditMetadata;
}

interface CategoryResult {
  score: number;
  weight: number;
  tests: TestResult[];
  recommendations: string[];
}

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  score: number;           // 0–100
  message: string;
  details?: Record<string, unknown>;
  documentationUrl?: string;
}

interface BotAccessStatus {
  botName: string;
  userAgent: string;
  httpStatus: number | null;
  allowed: boolean;
  allowedInRobotsTxt: boolean;
  message: string;
}

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedElements: number;
  recommendation: string;
  estimatedFixTime: string;  // e.g., "2 hours", "1 day"
  helpUrl?: string;
}

interface AuditMetadata {
  auditTrigger: 'manual' | 'scheduled' | 'onboarding';
  createdBy: string;        // User identifier
  executionTimeMs: number;
}
```

These are conceptual; adjust to match:
- Existing naming patterns (camelCase vs snake_case)
- Existing DTO and entity separation
- Existing serialization rules

---

## 5. Backend Feature: Responsibilities & Modules

### 5.1. High-Level Behavior

Backend responsibilities for Domain Readiness:
1. Determine **current brand** and its **domain** from existing context.
2. Run a set of analyzers (each returns `TestResult[]`).
3. Aggregate the test results into category scores.
4. Compute overall score.
5. Build an `AeoAuditResult` object.
6. Save the audit to the database (history) using existing ORM patterns.
7. Expose API endpoints to:
   - Trigger a new audit
   - Fetch audit history for a brand
   - Fetch a specific audit
   - Export an audit (PDF/JSON)

### 5.2. Analyzer Modules (Pure Logic)

Create analyzer modules that are **schema-agnostic** and only deal with URLs and HTML/content. Each module should be a pure function that can run independently of the platform's DB.

Each analyzer should look like:
```ts
// File name and export pattern should match existing style (function vs class)
export async function analyze(url: string, options?: any): Promise<TestResult[]> {
  // ...
}
```

Required analyzers:

1. **basicCrawlability**
   - Check HTTPS availability (HEAD request to https://domain).
   - Handle redirects.
   - Return tests like:
     - `HTTPS Availability`

2. **robotsAnalysis**
   - Fetch `/robots.txt`.
   - Detect `Allow`/`Disallow` rules for key LLM bots:
     - GPTBot
     - Claude / Anthropic (Claude-Web, anthropic-ai)
     - PerplexityBot
     - CCBot (Common Crawl)
     - AmazonBot
     - Applebot-Extended
     - Meta-ExternalAgent
     - Google-Extended
     - Bingbot
   - Return tests like:
     - `Robots.txt Accessibility`
     - `LLM Bot Access Policy`

3. **llmsTxtAnalysis**
   - Fetch `/llms.txt` (and optional variants like `/llm.txt` if desired).
   - Score based on:
     - Presence
     - Basic content length (non-empty, non-trivial)

4. **htmlStructure**
   - Fetch HTML for main URL.
   - Use `cheerio` (or existing HTML parsing lib, if one is already used).
   - Analyze:
     - Heading hierarchy (H1/H2/H3 counts, single H1 recommended).
     - Semantic HTML elements count (`main`, `article`, `section`, `nav`, `aside`, etc.).
     - Content text extraction (main body text).
     - Word count and long-form detection (1500+ words).
     - Flesch Readability Score (use existing library or simple implementation).

5. **metadataAnalysis**
   - Parse `<head>` for:
     - `<title>`
     - `<meta name="description">`
     - `<meta name="viewport">`
     - `<link rel="canonical">`
     - `<html lang="...">`
     - Open Graph tags: `og:title`, `og:description`, `og:image`
   - Return tests:
     - `Meta Description Quality`
     - `Viewport (Mobile Friendly)`
     - `Canonical URL Presence`
     - `Language Declaration`
     - `Open Graph Tags`

6. **schemaAnalysis**
   - Parse JSON-LD `<script type="application/ld+json">` blocks.
   - Detect and count `@type`, focusing on high-value types:
     - `Article`, `NewsArticle`, `BlogPosting`
     - `Product`
     - `FAQPage`, `QAPage`
     - `BreadcrumbList`
     - `Organization`, `LocalBusiness`
   - Score higher when high-value schema types are present and appear well-formed.

7. **faqAnalysis**
   - Check for `FAQPage` / `QAPage` schema.
   - Additionally, scan content for Q&A patterns:
     - Q/A style text
     - Accordions or expandable FAQ sections
   - Return a `FAQ Content & Schema` test.

8. **canonicalAnalysis**
   - Validate canonical URL:
     - Presence of `<link rel="canonical">`
     - Self-referential correctness (points to same URL or correct canonical)
     - HEAD check for canonical URL (should not be 4xx/5xx)

9. **freshnessAnalysis**
   - Inspect:
     - `article:published_time`
     - `meta[name="publish_date"]`
     - `time[datetime]`
     - JSON-LD `datePublished` / `dateModified`
     - HTTP `Last-Modified` header
   - Compute content age in days.
   - Classify freshness (very fresh, fresh, moderate, stale).

10. **accessibilityAnalysis**
    - Check:
      - `<img>` alt attribute coverage
      - Elements with ARIA attributes
      - Buttons/links without descriptive text

11. **brandConsistency**
    - Infer brand name from brand context (from DB, not from URL alone) when available.
    - Count brand name mentions in:
      - Body text
      - H1
      - First paragraph or first 100 words
      - Meta description
    - Compute density and score.

12. **sitemapAnalysis**
    - Fetch `/sitemap.xml`.
    - Check accessibility and count URLs.

13. **botAccess**
    - For each major bot, send a HEAD request with appropriate `User-Agent`.
    - Track HTTP status and allowed/blocked status.

---

## 6. Orchestrator Service (Domain Readiness Service)

You must implement a service/orchestrator that:

1. Uses the **existing brand model/service** to:
   - Resolve current brand (and its domain) from context.
2. Calls each analyzer with the brand’s domain URL.
3. Aggregates test results and computes category scores.
4. Computes overall score using the weighting model.
5. Constructs an `AeoAuditResult` object using platform conventions.
6. Saves the audit record into the database.
7. Exposes functions for:
   - Running a new audit
   - Fetching audit history for a brand
   - Fetching a specific audit

### 6.1. Discovery First

Before writing the service:
- Inspect existing services to understand:
  - Naming (`*Service`, `*Manager`, `*UseCase`, etc.).
  - How they are instantiated (dependency injection, singletons, factory functions).
  - How they access the database (ORM repository, raw queries, etc.).

Implement the Domain Readiness service **within the same pattern**.

### 6.2. Sample Conceptual Signature

Adapt to match existing conventions:

```ts
// Conceptual example; adapt name, location, and style
class DomainReadinessService {
  async runAudit(options: { brandId: string; userId: string; trigger?: 'manual' | 'scheduled' | 'onboarding'; forceRefresh?: boolean; }): Promise<AeoAuditResult> {
    // 1. Resolve brand and domain from existing brand service/model
    // 2. Check for recent audit if caching is desired
    // 3. Run analyzers (Promise.allSettled)
    // 4. Aggregate scores
    // 5. Save to DB
    // 6. Return AeoAuditResult
  }

  async getAuditHistory(brandId: string, limit?: number): Promise<AeoAuditResult[]> { /* ... */ }

  async getAuditById(auditId: string): Promise<AeoAuditResult | null> { /* ... */ }
}
```

Use whatever DI and class/function patterns are already present in the codebase.

---

## 7. API Design (Respect Existing Patterns)

You must inspect existing APIs to:
- Determine the correct base path (e.g., `/api`, `/api/v1`).
- Determine the correct nesting for brand-specific resources.
- Determine how success/error responses are structured.

### 7.1. Conceptual Endpoints (Adjust Paths & Types)

1. **Trigger a new audit**
   - Method: `POST`
   - Path: something like `/brands/:brandId/domain-readiness/audit` or `/domain-readiness/audit`
   - Request body: optional options (`saveToHistory`, `runAsync`, `forceRefresh`)
   - BrandId: taken from route or context (not from arbitrary input)

2. **Get audit history for a brand**
   - Method: `GET`
   - Path: something like `/brands/:brandId/domain-readiness/audits`

3. **Get specific audit**
   - Method: `GET`
   - Path: something like `/domain-readiness/audit/:auditId`

4. **Export audit**
   - Method: `POST` or `GET`
   - Path: something like `/domain-readiness/audit/:auditId/export`
   - Request body/query: `format = 'pdf' | 'json'`

All responses must follow the platform’s existing response envelope and error handling patterns.

---

## 8. Frontend: Domain Readiness Page & Components

The frontend must integrate into the existing UI architecture and design system.

### 8.1. Discovery

Before adding components:
- Inspect how pages are structured (e.g., `/src/pages`, `/src/features`, `/src/modules`).
- Identify the sidebar/navigation config.
- Identify standard layout components (Page, Card, Grid, etc.).
- Identify typical patterns for:
  - Data fetching (hooks/services)
  - Loading states
  - Error states
  - Typography and colors

### 8.2. Main Page Responsibilities

"Domain Readiness" page should:

1. Show current brand domain (fetched from brand context/state).
2. Offer a "Run Audit" button.
3. Display latest audit summary:
   - Overall score (0–100) with gauge
   - Category breakdown
   - Time of last audit
4. Show detailed sections:
   - Critical issues (top panel)
   - Category breakdown cards (4 categories)
   - Test results (expandable by category)
   - LLM bot access table
   - Audit history (list or chart)
5. Allow exporting the latest audit as PDF/JSON.

### 8.3. Key Components (Match Existing UI Patterns)

Implement these, aligning with existing component and styling conventions:

1. **DomainReadinessPage**
   - Root page container.
   - Connects to brand context and domain readiness APIs.

2. **AuditInputForm**
   - Shows domain (read-only if domain is fixed in brand).
   - "Run Audit" button.

3. **ScoreGauge**
   - Circular gauge or bar showing 0–100 score.
   - Color coding:
     - 0–59: red (Poor)
     - 60–74: yellow (Fair)
     - 75–89: blue (Good)
     - 90–100: green (Excellent)

4. **CategoryBreakdown**
   - Four cards: Technical, Content, Semantic, Accessibility & Brand.
   - Each card displays score + small progress bar.

5. **CriticalIssuesPanel**
   - Top panel listing top critical/high severity issues and recommended actions.

6. **TestResultsList**
   - Group tests by category.
   - Each entry shows:
     - Status icon (pass/warning/fail/info)
     - Test name
     - Score
     - Summary message
     - Expandable details

7. **BotAccessTable**
   - Table listing each LLM bot and its status:
     - Bot name
     - User-Agent
     - HTTP status
     - Allowed/blocked

8. **AuditHistory**
   - History of previous audits for this brand.
   - At minimum: timestamp + overall score.
   - Optionally a trend chart.

9. **ReportExport**
   - Buttons for exporting current audit:
     - "Download JSON"
     - "Download PDF"

### 8.4. Sidebar Integration

- Add "Domain Readiness" as an item in the main sidebar.
- Use the same configuration and routing patterns as other features.
- Ensure that only authorized users/roles can access this feature (use existing RBAC). 

---

## 9. Performance, Caching & Resilience

1. **Performance Targets:**
   - Aim for audits to complete within **45 seconds** for 95% of domains.
   - Timeouts for individual external HTTP requests (e.g., 10s) with graceful fallbacks.

2. **Caching Strategy:**
   - Before running a new audit, optionally check if a recent audit exists (e.g., in last 24 hours).
   - Allow forced refresh when requested.

3. **Async Option (Optional for Later):**
   - Support an asynchronous mode where:
     - Request returns a job ID.
     - Status endpoint reports progress.
     - Useful for slow domains.

4. **Error Resilience:**
   - Use `Promise.allSettled` for running analyzers so one failing test does not kill the whole audit.
   - Mark failed analyzers as `status: 'info'` or `status: 'warning'` with error message.
   - Only fail the entire audit if the domain is fundamentally unreachable.

---

## 10. Testing & Quality

You must conform to existing testing and QA practices.

### 10.1. Testing Patterns

Inspect existing tests to determine:
- Test framework (e.g., Jest, Vitest, Mocha).
- File naming convention (`*.test.ts` or `*.spec.ts`).
- Use of helpers, factories, and test DB.

### 10.2. Tests to Implement

1. **Unit tests**
   - Each analyzer module should have tests for typical and edge cases.

2. **Integration tests**
   - Service-level tests for `runAudit` to ensure correct aggregation.

3. **API tests**
   - Endpoint tests to verify:
     - Authentication
     - Permissions
     - Response formats

4. **Frontend tests**
   - Component tests for Domain Readiness page and core components.

5. **E2E tests (if framework exists)**
   - Full flow: user logs in → selects brand → opens Domain Readiness → runs audit → sees results.

---

## 11. Implementation Phases (Recommended)

### Phase 0: Discovery (Mandatory Before Coding)

1. Inspect existing:
   - Database schema/migrations/ORM models
   - Brand and user models
   - API routing and controllers
   - Service layer patterns
   - Frontend architecture (features/pages/components)
   - UI library and design system
   - Authentication/authorization patterns
   - Error handling conventions

2. Produce a short internal note (in code comments or docs) summarizing:
   - Actual table names and column names to be used for Domain Readiness.
   - Actual API route patterns.
   - Actual service and controller locations.

### Phase 1: Backend Core (Domain Audit Engine)

1. Implement the 13 analyzer modules (pure functions, no DB).
2. Implement the Domain Readiness service/orchestrator using existing patterns.
3. Implement database persistence for audits, using existing ORM and naming.
4. Implement API endpoints for:
   - Triggering an audit
   - Listing audits for a brand
   - Getting a specific audit

### Phase 2: Frontend Page & Components

1. Build "Domain Readiness" page using existing layout and component patterns.
2. Implement API client hooks/services.
3. Build UI components listed above (ScoreGauge, CategoryBreakdown, etc.).
4. Wire up brand context to pre-fill domain and brandId.

### Phase 3: Integration & Polish

1. Add sidebar navigation entry.
2. Add loading and error states.
3. Add PDF/JSON export.
4. Add history view and basic trend visualization.
5. Add onboarding integration (auto-run audit when brand is created, as a future enhancement).

---

## 12. Non-Functional Requirements

- **Maintainability:** Code must follow existing structure and patterns.
- **Scalability:** Capable of handling many audits per day across brands.
- **Security:** Respect existing auth and RBAC. No cross-brand data leakage.
- **Observability:** Use existing logging/metrics patterns to log audit runs and failures.

---

## 13. Summary of Key Constraints for TRAE

1. **Inspect the existing Evidentlyaeo.com codebase and DB before implementing.**
2. **Reuse the existing brand URL and brand_id from the current schema.**
3. **Follow existing naming and architectural conventions everywhere.**
4. **Make analyzers pure and platform-agnostic; make orchestration platform-aware.**
5. **Expose the feature as a sidebar page called "Domain Readiness" and as an onboarding hook later.**

Use this document as the definitive specification when generating code, files, and integration logic for the Domain Readiness tool inside Evidentlyaeo.com.
