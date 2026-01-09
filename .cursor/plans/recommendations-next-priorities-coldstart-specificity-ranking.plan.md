# Recommendations Next Priorities Plan (Post Competitor-Fix)

## Goal

Improve recommendation usefulness and trust for:

- **Cold-start brands** (new, sparse data)
- **Poor-performing brands** (very low scores)
- **All brands** (more actionable, data-grounded recommendations with deterministic ranking)

**Scope constraint:** Only the Recommendations V3 flow used by `/recommendations` (backend `recommendation-v3.service.ts`).

---

## Current Gaps (What's Missing from Your Screenshots)

### Gap 1: Cold-Start Detection Missing

**Problem:** Brand with visibility=1, SOA=0.6% gets recommendations like "Publish on slack.com" (too advanced)
**Missing:** Detection that this is a cold-start brand + baseline playbook (foundational steps first)

### Gap 2: Quality Contract Missing

**Problem:**

- "WHY THIS MATTERS" says "Slack has high visibility" but doesn't state: **"Your SOA is 0.6% vs industry benchmark 45%"**
- "Expected boost: +5-10%" is vague - missing: **"Success = SOA increases from 0.6% to 8% within 4 weeks"**
**Missing:** Validation that reason includes numeric gap reference + clear success criteria

### Gap 3: Deterministic Ranking Missing

**Problem:**

- Priority "High" for "Publish on slack.com" - but why? No explanation
- Confidence "80%" - but based on what? No evidence strength
- Same brand might get different priorities on different runs
**Missing:** Computed priority based on gap size + source opportunity + effort, with explainable reasoning

---

## Priority 1 (P1): Cold-Start / Low-Data Recommendation Mode (Baseline Playbook)

### What is "Cold Start"? (Simple Explanation)

**Cold start = A brand that exists but is invisible to AI/search engines.**

Think of it like a new restaurant:

- **Cold start**: Restaurant exists but has no Google listing, no reviews, no website
- **You can't get customers to leave reviews if the restaurant doesn't exist online yet**
- **You need to**: Create Google listing → Get basic info online → Create website → THEN you can optimize

**For brands:**

- Brand exists but AI/search engines don't know it exists
- Very low visibility (e.g., visibility score = 1), very low citations (< 50), very low SOA (< 5%)
- **You can't optimize visibility if you're not visible at all**
- **You need to**: Get indexed → Create basic pages → Get some citations → THEN you can optimize

**Real Example:**

- Brand: "Atlassian Rovo" with visibility=1, SOA=0.6%, citations=64
- **Current problem**: Recommendations say "Publish on slack.com" (too advanced - assumes brand already has foundation)
- **Cold-start needs**: "Ensure your website is indexed by Google", "Create 5 basic FAQ pages", "Submit to 3 directories"

**For Marketing Agencies:**
Agencies work with clients who often:

- ✅ Have a website (but it's not indexed or optimized)
- ✅ Have some content (but not optimized for AI discoverability)
- ❌ Haven't submitted to directories
- ❌ Haven't created "answer-first" content (FAQs, "What is X", "How to use X")
- ❌ Don't have basic trust pages (Pricing, Security, Integrations)

**So yes, cold start is common even for agency clients.**

### Problem

When data is sparse (few citations/positions/metrics), the LLM either:

- **hallucinates source-specific tactics** (e.g., "Publish on slack.com" when brand has 0 citations there)
- **produces generic advice** not tied to measurable goals (e.g., "improve SEO")
- **assumes brand has foundation** when it doesn't (e.g., suggesting advanced tactics for brands with visibility=1)

**Current Gap (from your screenshots):**

- Brand with visibility=1, SOA=0.6% gets recommendations like "Publish on slack.com"
- These are **too advanced** - brand needs foundational steps first
- No detection that this is a cold-start brand
- No baseline playbook for brands that are invisible

### Outcome

If a brand is cold-start / low-data, the system returns a **deterministic baseline playbook** with concrete actions and measurable leading indicators (citations, indexation, brand presence), without relying on fragile source-specific inference.

**Instead of:** "Publish on slack.com" (assumes brand is already visible)
**Provide:** "Ensure your website is indexed by Google" → "Create 5 FAQ pages" → "Submit to 3 directories" → THEN optimize

### Definition: Cold-Start Trigger (deterministic)

Add a function that computes a `dataMaturity` classification:

- `cold_start` if ANY of these are true:
- total citations in date range < **N1** (suggested: 50)
- unique domains with citations < **N2** (suggested: 5)
- total extracted positions < **N3** (suggested: 10)
- OR overall visibility score < **N4** (suggested: 5, if available in context)
- OR SOA < **N5** (suggested: 5%)
- `low_data` if below softer thresholds (e.g., citations < 100, visibility < 15)
- `normal` otherwise

**Default Thresholds (to be finalized with product team):**

- N1 = 50 citations (very sparse)
- N2 = 5 unique domains (very few sources mention brand)
- N3 = 10 extracted positions (very few AI mentions)
- N4 = 5 visibility score (barely visible)
- N5 = 5% SOA (very low share of answers)

**Action:** Finalize N1–N5 with product + data team (start with conservative defaults, feature-flagged).

### What to Generate in Cold-Start Mode

Return **8–12** baseline recommendations from a **template library**, each with:

- `action` (explicit artifact + distribution channel)
- `reason` (ties to the cold-start diagnosis + expected leading indicator)
- `priority` (deterministic)
- `expectedBoost` (conservative; ranges OK)
- `successCriteria` (measurable)
- `confidence` = `low` or `medium` (never `high` in cold-start)

**Template categories (minimum set):**

1. **Technical discoverability** (foundation):

- "Ensure your website is indexed by Google" (check indexation status)
- "Submit XML sitemap to Google Search Console"
- "Fix robots.txt to allow crawling"
- "Set up canonical URLs to avoid duplicate content"

2. **"Answer-first" content set** (what AI searches for):

- "Create FAQ page: 'What is [Brand Name]?'"
- "Create FAQ page: 'How to use [Brand Name]?'"
- "Create FAQ page: '[Brand Name] use cases'"
- "Create FAQ page: '[Brand Name] alternatives'"
- "Create FAQ page: '[Brand Name] alternatives' (neutral language; do NOT name competitors)"

3. **Product trust pages** (credibility):

- "Create Pricing page with clear tiers"
- "Create Security/Privacy page"
- "Create Integrations page"
- "Create Documentation landing page"

4. **Distribution starter set** (get initial citations):

- "Submit to Product Hunt (if applicable)"
- "Submit to G2/Capterra (if applicable)"
- "Submit to industry-specific directories"
- "Create GitHub repository (if applicable)"
- "Participate in relevant Reddit communities (non-promotional)"

5. **Citation acquisition** (get mentioned):

- "Reach out to 3-5 industry blogs for mentions"
- "Submit case study to industry publications"
- "Get listed in 'Best [category] tools' roundups"

### Implementation Details

- Add `dataMaturity` to the V3 brand context.
- Add a `coldStartRecommendationTemplates.ts` module that exports deterministic templates + ranking rules.
- In the generation flow:
- If `dataMaturity === cold_start` (or `low_data`): **skip KPI-first LLM generation** OR run LLM only to lightly customize wording (optional).
- Return template-driven recs with deterministic ranking and validation.

### Files to Modify / Add

- Modify: `backend/src/services/recommendations/recommendation-v3.service.ts`
- compute `dataMaturity`
- short-circuit to cold-start templates
- Add: `backend/src/services/recommendations/cold-start-templates.ts`
- template definitions + deterministic ranking
- (Optional) Add: `backend/src/services/recommendations/recommendation-confidence.service.ts`

### Acceptance Criteria

- For cold-start brands, recommendations contain **no source hallucinations**, are **all executable**, and include **success criteria**.
- UI shows no empty state; user gets a meaningful “first steps” plan.
- Logging shows `dataMaturity` classification and chosen path.

---

## Priority 2 (P2): Enforce “Specific + Data-Grounded” Recommendations (Validation + Auto-Rewrite)

### Problem

Even for normal-data brands, recommendations can be:

- **too generic** (“improve SEO”, “create content”, “enhance visibility”)
- **missing the "why now"** (metric gap - doesn't explain current state vs target)
- **missing concrete artifact** (what exactly to create - page type, content type, topic)
- **missing success criteria** (how to measure success - vague "5-10%" vs "SOA: 0.6% → 8% within 4 weeks")

**Current Gap (from your screenshots):**

- "WHY THIS MATTERS" says "Slack has high visibility" but doesn't state: **"Your SOA is 0.6% vs industry benchmark 45%"**
- "Expected boost: +5-10%" is vague - missing: **"Success = SOA increases from 0.6% to 8% within 4 weeks"**
- No validation that reason field includes numeric gap reference

### Outcome

Every recommendation must meet a strict minimum spec. If not, it is either:

- auto-rewritten (safe transform), or
- dropped (with logs), or
- regenerated (optional later).

### Add a Recommendation Quality Contract (deterministic)

Define `RecommendationQuality` rules applied post-parse:

**Must include:**

1. **Target KPI** (visibility/SOA/sentiment/brand presence) - ✅ Already have
2. **Gap reference** (at least one numeric metric from context if available)

- ❌ **Missing**: Reason should say "Your SOA is 0.6% vs industry benchmark 45%"
- ✅ **Good**: "Your SOA is 0.6% vs industry benchmark 45%"

3. **Concrete artifact** (page type/content type + topic)

- ❌ **Bad**: "Create content"
- ✅ **Good**: "Create FAQ page on 'What is [Brand]?'"

4. **Channel or placement target** (owned site or non-competitor allowed domain class)

- ✅ Already have (citationSource)

5. **Success criteria** (leading indicator + time window)

- ❌ **Bad**: "Expected boost: +5-10%"
- ✅ **Good**: "Success = SOA increases from 0.6% to 8% within 4 weeks"

**Must NOT include:**

- Banned generic phrases list (configurable):
- "improve SEO"
- "create content"
- "enhance visibility"
- "optimize marketing"
- "build presence"
- Competitor references (already enforced in current V3 via competitor filtering; out of scope for this plan)

### Implementation: Validator + Optional Rewriter

Create:

- `validateRecommendation(rec, context): { ok, reasons[] }`
- `rewriteGenericRecommendation(rec, context): rec | null`
- Only safe rewrites: add missing fields from context, swap generic phrasing into structured action template

Apply in two places:

- After LLM JSON parse (already the post-filter stage exists)
- Right before DB save (final gate already exists; extend to quality contract)

### Files to Modify / Add

- Add: `backend/src/services/recommendations/recommendation-quality.service.ts`
- validator + (optional) rewriter
- Modify: `backend/src/services/recommendations/recommendation-v3.service.ts`
- call validator after parse + before save
- log `dropped/re-written` counts and reasons

### Acceptance Criteria

- >90% recommendations satisfy quality contract on a representative sample.
- Any dropped recommendation has a logged reason.
- No “generic-only” actions reach UI.

---

## Priority 3 (P3): Deterministic Ranking + Confidence Scoring (Replace Pure LLM Priority)

### Problem

**Current State:**

- Priority is **LLM-assigned** (line 1583 in recommendation-v3.service.ts just parses LLM output)
- Priority labels are **inconsistent** (same gap might get "High" or "Medium" randomly)
- Priority is **not explainable** (no reason why it's High/Medium/Low)
- Confidence is **arbitrary** (e.g., "80%" with no basis in data)

**Current Gap (from your screenshots):**

- Priority "High" for "Publish on slack.com" - but why? No explanation
- Confidence "80%" - but based on what? No evidence strength
- Same brand might get different priorities on different runs

### Outcome

Priority is computed deterministically and is explainable, with a confidence signal.

### Deterministic Scoring Model

**Replace LLM-assigned priority with computed priority:**

Compute:

1. **`impactScore`** (gap size + source opportunity + trend):

- Gap size: How big is the problem? (e.g., SOA 0.6% vs 45% = huge gap = high impact)
- Source opportunity: How valuable is the source? (e.g., slack.com has 64 citations, high impact score)
- Trend: Is it getting worse? (declining metrics = higher urgency)

2. **`effortScore`** (heuristic: content effort + technical effort + distribution effort):

- Content effort: How hard to create? (FAQ = low, whitepaper = high)
- Technical effort: Any dev work needed? (none = low, API integration = high)
- Distribution effort: How hard to publish? (own site = low, guest post = high)

3. **`priorityScore = impactScore / effortScore`** (bounded and normalized):

- High impact + low effort = high priority
- High impact + high effort = medium priority
- Low impact + low effort = low priority

4. **`confidence`** (based on evidence strength):

- **`high`**: Strong supporting metrics + matched sources (e.g., source has 100+ citations, brand has 0% SOA there)
- **`medium`**: Partial data support (e.g., source has some citations, brand has some presence)
- **`low`**: Cold-start templates or weak evidence (e.g., no citations, no data)

**Map to UI priority buckets:**

- `priorityScore >= T_high` (e.g., 0.7) → **High**
- `priorityScore >= T_med` (e.g., 0.4) → **Medium**
- else → **Low**

**Add `priorityReason` field** (optional, for debugging/UI):

- "High priority: Large SOA gap (0.6% vs 45% benchmark) + low effort (FAQ page)"
- "Medium priority: Moderate gap + high effort (whitepaper)"

### Implementation Details

Prefer a small, explainable model first (no ML):

- weight constants stored in config
- include `priorityReason` string (optional) for debugging/UI

### Files to Modify / Add

- Add: `backend/src/services/recommendations/recommendation-ranking.service.ts`
- Modify: `backend/src/services/recommendations/recommendation-v3.service.ts`
- compute + attach deterministic `priority`, `priorityScore`, `confidence`
- ensure consistent ordering returned to UI

### Acceptance Criteria

- **Ordering is stable and explainable** (same brand + same data = same priority order)
- **Cold-start recs never show `high` confidence** (they're templates, not data-driven)
- **Priority aligns with observed gap sizes** (large gaps = higher priority, small gaps = lower priority)
- **Confidence reflects evidence strength** (high confidence only when strong metrics support it)
- **PriorityReason is logged** (for debugging and future UI display)

---

## Rollout Plan (Feature Flags)

### Flags

- `recs_v3_cold_start_mode`
- `recs_v3_quality_contract`
- `recs_v3_deterministic_ranking`

### Rollout Steps

- Enable for internal brands → 5% → 25% → 100%
- Monitor:
- drop/rewrite counts
- time-to-generate
- user engagement (click/complete)

---

## Instrumentation (Minimum)

Log per generation:

- brandId, dateRange
- dataMaturity
- counts: generated, filtered (competitor) [already exists], dropped (quality), rewritten (quality)
- top-3 reasons for drops
- avg priorityScore distribution

---

## Open Decisions (Need Your Input)

1. Cold-start thresholds (N1–N4) and date-range assumptions
2. Template list finalization (8–12 vs 12–15)
3. Whether to auto-rewrite generic recs (safe transform) or drop-only v1