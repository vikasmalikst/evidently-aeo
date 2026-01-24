## Topics API Flow (Interview Prep Guide)

This guide explains, in simple words, how the **Topics API** works end-to-end:

- Frontend triggers the call
- The request reaches the backend via Express routing
- The backend route handler orchestrates scraping + LLM topic generation
- The response is mapped into the shape the frontend expects

---

## What we built (high level)

We enhanced the existing Topics generation flow to include:

- **Brand-specific context** from the brand’s homepage (scraped)
- **Industry/category keywords** inferred from the same homepage content
- A more **neutral** LLM prompt that mixes brand + industry language (not overly promotional)

---

## Mental model: “Request → Route → Service → Response”

When you build an API flow, think in this order:

- **Frontend**: “Call an endpoint”
- **Backend app**: “Mount a router on a base path”
- **Route handler**: “Validate input + orchestrate services”
- **Services**: “Do the actual business logic (scrape, call LLM, etc.)”
- **Return**: “Format response for UI”

---

## Flow diagram (sequence)

1. UI calls `fetchTopicsForBrand(...)`
2. `apiClient.request('/onboarding/topics', ...)` sends HTTP POST to `${baseUrl}/onboarding/topics`
3. Backend Express app has `/api/onboarding` router mounted
4. That router receives `POST /topics`
5. Route handler:
   - validates inputs
   - optionally loads brand info from DB (industry/competitors/topics)
   - scrapes homepage context (if `website_url` is provided)
   - calls the LLM topics service with extra website context + keywords
   - also fetches trending keywords in parallel
   - maps results into frontend-friendly categories
6. Frontend receives JSON and renders topics

---

## Frontend: where the API is called

### The “Topics” API function

The frontend calls the Topics endpoint via `fetchTopicsForBrand()`:

```83:110:/Users/avayasharma/evidently-aeo/src/api/onboardingApi.ts
export async function fetchTopicsForBrand(params: {
  brand_name: string;
  industry: string;
  competitors: string[];
  locale?: string;
  country?: string;
  brand_id?: string;
  website_url?: string;
}): Promise<TopicsResponse> {
  return apiClient.request<TopicsResponse>(
    '/onboarding/topics',
    {
      method: 'POST',
      body: JSON.stringify({
        brand_name: params.brand_name,
        industry: params.industry,
        competitors: params.competitors,
        locale: params.locale || 'en-US',
        country: params.country || 'US',
        brand_id: params.brand_id,
        website_url: params.website_url
      }),
    },
    { 
      requiresAuth: true,
      timeout: 120000 // Increase timeout to 120 seconds for AI topic generation (includes trending topics fetch)
    }
  );
}
```

### How the frontend knows the backend base URL

`apiClient` builds the full URL like:

- `http://localhost:4000/api` in local dev (default)
- or `${origin}/api` in prod environments

```1:25:/Users/avayasharma/evidently-aeo/src/lib/apiClient.ts
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('evidentlyaeo.com')) {
      return `${origin}/api`;
    }
    if (origin.includes('85.239.244.166')) {
      return `${origin}/api`;
    }
  }
  return 'http://localhost:4000/api';
};
```

So when the frontend calls `'/onboarding/topics'`, it becomes:

- **`${API_BASE_URL}/onboarding/topics`**
- Example in dev: `http://localhost:4000/api/onboarding/topics`

---

## Backend: how the route is mounted (Express basics)

### `app.ts` mounts routers onto URL prefixes

In Express, `app.use('/some/base', router)` means:

- the router handles requests under that base path

Here, onboarding routes are mounted at `/api/onboarding`:

```114:131:/Users/avayasharma/evidently-aeo/backend/src/app.ts
// API routes
app.use('/api', executiveReportingRoutes); // Register specific routes first to avoid conflicts
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRouter);
app.use('/api/brands', brandRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/query-generation', queryGenerationRoutes);
app.use('/api/trending-keywords', trendingKeywordsRoutes);
app.use('/api/data-collection', dataCollectionRoutes);
app.use('/api/keywords', keywordGenerationRoutes);
app.use('/api/citations', citationCategorizationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', promptManagementRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/recommendations-v3', recommendationsV3Routes);
app.use('/api/movers-shakers', moversShakersRoutes);
app.use('/api', domainReadinessRoutes);
app.use('/api/report-settings', reportSettingsRoutes);
```

So a request to:

- `POST /api/onboarding/topics`

is handled inside `backend/src/routes/onboarding.routes.ts` at:

- `router.post('/topics', ...)`

---

## Backend: what `onboarding.routes.ts` does (controller responsibilities)

Think of `onboarding.routes.ts` as the **controller layer** for onboarding-related APIs.

- **It does not contain the “core algorithms”** (that’s in services)
- It **coordinates** multiple services and returns a clean response

Typical responsibilities:

- **validate request body**
- **authenticate user** (via middleware)
- call services like:
  - DB brand lookup (`brandService`)
  - LLM topics generation (`topicsQueryGenerationService`)
  - trending keywords (`trendingKeywordsService`)
  - (new) website scraping (`websiteScraperService`)
- **shape response JSON** for the frontend

---

## Backend: the `/onboarding/topics` handler (the orchestration)

This is the core of the flow: the route handler does multiple things in one request.

Key steps you should remember for interviews:

- **Input validation**: reject bad requests early
- **Deduping**: reuse in-flight promises to avoid duplicate expensive LLM calls
- **Parallelism**: run slow tasks concurrently where possible
- **Best-effort enrichment**: scraping is “nice-to-have”, not a hard dependency

Here is the relevant part of the route where scraping + LLM generation are wired together:

```272:417:/Users/avayasharma/evidently-aeo/backend/src/routes/onboarding.routes.ts
/**
 * POST /onboarding/topics
 * Generate topics for brand using trending keywords and AI categorization
 */
router.post('/topics', authenticateToken, async (req: Request, res: Response) => {
  const requestKey = getTopicsRequestKey(req);
  const existingRequest = topicsRequestCache.get(requestKey);
  // ...
  const requestPromise = (async () => {
    const { brand_name, industry, competitors = [], locale = 'en-US', country = 'US', brand_id, website_url } = req.body;
    // ...
    // Scrape homepage context (best-effort) to improve brand/industry specificity.
    const scrapePromise = (async () => {
      if (!website_url || typeof website_url !== 'string' || !website_url.trim()) return null;
      try {
        return await websiteScraperService.scrapeHomepage(website_url, { brandName: brand_name });
      } catch {
        return null;
      }
    })();
    const topicsPromise = (async () => {
      const scrape = await scrapePromise;
      return topicsQueryGenerationService.generateTopicsAndQueries({
        brandName: brand_name,
        industry: brandIndustry || industry || 'General',
        competitors: brandCompetitors,
        websiteContent: scrape?.websiteContent,
        brandKeywords: scrape?.brandKeywords,
        industryKeywords: scrape?.industryKeywords,
        maxTopics: 20
      });
    })();
    const [topicsAndQueriesResult, trendingResult] = await Promise.all([
      topicsPromise,
      trendingPromise
    ]);
    // ...
  })();
  // ...
});
```

### Why we changed this file

We changed `onboarding.routes.ts` because **this is the place where topic generation is invoked**.

If we had only changed the onboarding “intel lookup” step, the scraped data might never reach the LLM that generates topics (because topics are generated later in a separate endpoint).

So the most reliable integration point is:

- right before calling `topicsQueryGenerationService.generateTopicsAndQueries(...)`

---

## Services: where the real work happens

### `websiteScraperService` (new)

File: `backend/src/services/website-scraper.service.ts`

What it does:

- downloads the homepage HTML
- extracts:
  - title/meta description
  - headings (`h1/h2/h3`)
  - nav link text
- produces:
  - `websiteContent` (condensed context string for prompts)
  - `brandKeywords[]` and `industryKeywords[]`

Important interview concept:

- This is a **pure service**: no Express `req/res` here, just business logic.

### `topicsQueryGenerationService` (updated)

File: `backend/src/services/topics-query-generation.service.ts`

What we changed:

- Request interface now accepts `websiteContent`, `brandKeywords`, `industryKeywords`
- Prompt (`buildPrompt`) includes those fields and instructs the model to:
  - be **neutral**
  - produce a **balanced mix** of brand + industry topics

---

## Quick local testing (optional)

We added scripts so you can test without the full UI:

- **Scrape only**:
  - `backend/src/scripts/test-scraper.ts`
- **Scrape + generate topics**:
  - `backend/src/scripts/test-topics-with-scraping.ts`

Example (from the backend folder):

```bash
npm run -s build
node dist/scripts/test-scraper.js "https://agicap.com" "Agicap"
node dist/scripts/test-topics-with-scraping.js "https://agicap.com" "Agicap" "Cash flow management software"
```

---

## Interview prep: key “why” answers

- **Why put logic in a service instead of the route file?**
  - Routes should orchestrate; services should implement reusable business logic.

- **Why change `onboarding.routes.ts` specifically?**
  - That’s where `POST /onboarding/topics` is implemented and where the LLM topics service is called.

- **Why do scraping as “best-effort”?**
  - Scraping can fail (timeouts, bot protection). We still want topics generated using existing data.

- **Why add keyword lists instead of only raw website text?**
  - Keywords make the prompt more structured and steer the LLM to include brand + industry terms intentionally.

