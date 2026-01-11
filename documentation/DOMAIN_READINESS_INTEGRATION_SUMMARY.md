# Domain Readiness ↔ Recommendation Engine Integration
## Quick Summary for Implementation

---

## 🎯 Goal

**Prevent redundant recommendations** by filtering out suggestions for technical elements that Domain Readiness already shows are optimized.

**Example:** If Domain Readiness shows XML sitemap is 95/100 (pass), don't recommend "optimize XML sitemap".

---

## 🔧 How It Works

### Step 1: Fetch Latest Audit
When generating recommendations, fetch the latest Domain Readiness audit for the brand.

### Step 2: Filter Recommendations
Before returning recommendations, check each one:
- Extract keywords from recommendation action text
- Match keywords to Domain Readiness test names
- If test **passed** (score ≥ 80) → **Filter out** the recommendation
- If test **failed** (score < 60) → **Keep** the recommendation

### Step 3: Enhance Priority
Boost priority for recommendations that address failed Domain Readiness tests.

---

## 📋 Implementation Files

1. **New Service:** `backend/src/services/recommendations/domain-readiness-filter.service.ts`
   - Keyword mapping
   - Filtering logic
   - Context generation

2. **Update:** `backend/src/services/recommendations/recommendation-v3.service.ts`
   - Import filter service
   - Fetch audit before generating
   - Filter recommendations after generation

3. **Database:** Migration to track audit references

---

## 🔑 Key Mapping

| Domain Readiness Test | Recommendation Keywords |
|----------------------|------------------------|
| XML Sitemap | "sitemap", "xml sitemap", "sitemap.xml" |
| Robots.txt | "robots.txt", "robots", "crawlability" |
| LLMs.txt | "llms.txt", "llm", "ai bot access" |
| FAQ Content | "faq", "frequently asked", "q&a" |
| Schema Markup | "schema", "schema.org", "structured data" |
| Canonical URLs | "canonical", "canonical url" |

---

## ✅ Success Criteria

- **No redundant recommendations** for optimized technical elements
- **Higher priority** for recommendations addressing readiness gaps
- **No performance impact** (< 200ms added latency)
- **Graceful handling** when no audit data exists

---

## 🚀 Quick Start

See full implementation plan: `DOMAIN_READINESS_RECOMMENDATION_INTEGRATION_PLAN.md`
