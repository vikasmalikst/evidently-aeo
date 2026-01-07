# UI Screens - Data Source Mapping

**Critical Question:** Will new data collected show up in the UI?

**Answer:** ⚠️ **PARTIALLY - Depends on which UI screen**

---

## 📊 NEW DATA FLOW

When you run data collection now:
1. ✅ Data writes to **NEW schema** (metric_facts, brand_metrics, etc.)
2. ❌ Data does **NOT** write to `extracted_positions` (old table)
3. ⚠️ UI shows new data **ONLY** if that screen uses new schema

---

## ✅ UI SCREENS SHOWING NEW DATA (6 screens)

These screens are migrated and **WILL show newly collected data**:

### 1. **Dashboard Page** ✅
- **UI Route:** `/brands/:brandId`
- **API Endpoint:** `GET /api/brands/:brandId/dashboard`
- **Backend Service:** `brandDashboardService.getBrandDashboard()` → `payload-builder.ts`
- **Data Source:** ✅ **NEW SCHEMA** (metric_facts, brand_metrics, brand_sentiment)
- **Status:** Fully migrated
- **Shows New Data:** ✅ YES
- **Metrics Shown:**
  - Time series (visibility, share of answers)
  - Per-collector metrics
  - Brand presence

⚠️ **Exception:** Previous period comparison still uses `extracted_positions` (will show 0 for change metrics)

---

### 2. **Source Attribution Page** ✅
- **UI Route:** `/brands/:brandId/sources`
- **API Endpoints:** 
  - `GET /api/brands/:brandId/sources`
  - `GET /api/brands/:brandId/sources/impact-score-trends`
- **Backend Service:** `sourceAttributionService.getSourceAttribution()`
- **Data Source:** ✅ **NEW SCHEMA** (with `USE_OPTIMIZED_SOURCE_ATTRIBUTION=true`)
- **Status:** Fully migrated with feature flag
- **Shows New Data:** ✅ YES
- **Metrics Shown:**
  - Citations per source
  - Share of answer per source
  - Sentiment per source
  - Impact score trends

---

### 3. **Keywords Analytics Page** ✅
- **UI Route:** `/brands/:brandId/keywords`
- **API Endpoint:** `GET /api/brands/:brandId/keywords`
- **Backend Service:** `keywordsAnalyticsService.getKeywordAnalytics()`
- **Data Source:** ✅ **NEW SCHEMA** (with `USE_OPTIMIZED_KEYWORDS_QUERY=true`)
- **Status:** Fully migrated with feature flag
- **Shows New Data:** ✅ YES
- **Metrics Shown:**
  - Brand presence percentage
  - Keyword occurrences
  - Per-keyword metrics

---

### 4. **Sentiment Analysis** ✅
- **Backend Services:** 
  - `combinedSentimentService` (brand sentiment)
  - `competitorSentimentService` (competitor sentiment)
- **Data Source:** ✅ **NEW SCHEMA** (with `USE_OPTIMIZED_SENTIMENT_QUERY=true`)
- **Status:** Fully migrated with feature flags
- **Shows New Data:** ✅ YES
- **Note:** Used internally by other services

---

### 5. **Prompt Metrics** ✅
- **Backend Service:** `promptMetricsService.getVisibilityAndSentiment()`
- **Data Source:** ✅ **NEW SCHEMA** (with `USE_OPTIMIZED_PROMPT_METRICS=true`)
- **Status:** Fully migrated with feature flag
- **Shows New Data:** ✅ YES
- **Note:** Used by prompts analytics

---

### 6. **Position Extraction Check** ✅
- **Backend Service:** `positionExtractionService.extractPositionsForNewResults()`
- **Data Source:** ✅ **NEW SCHEMA** (with `USE_OPTIMIZED_POSITION_CHECK=true`)
- **Status:** Fully migrated with feature flag
- **Shows New Data:** ✅ YES
- **Note:** Internal check to avoid duplicate processing

---

## ❌ UI SCREENS NOT SHOWING NEW DATA (4 screens)

These screens **will NOT show newly collected data** until migrated:

### 1. **Topics Page** ❌
- **UI Route:** `/brands/:brandId/topics`
- **API Endpoint:** `GET /api/brands/:brandId/topics`
- **Backend Service:** `brandService.getBrandTopicsWithAnalytics()`
- **Data Source:** ❌ **OLD SCHEMA** (`extracted_positions`)
- **Status:** **NOT migrated**
- **Shows New Data:** ❌ **NO**
- **Metrics Shown:**
  - Topics with analytics
  - Per-topic SOA, visibility
  - Competitor averages per topic
  - Available models
- **Impact:** 🔴 **HIGH** - Core analytics feature

---

### 2. **Prompts Analytics Page** ❌
- **UI Route:** `/brands/:brandId/prompts`
- **API Endpoint:** `GET /api/brands/:brandId/prompts`
- **Backend Service:** `promptsAnalyticsService.getPromptAnalytics()`
- **Data Source:** ❌ **OLD SCHEMA** (`extracted_positions`)
- **Status:** **NOT migrated**
- **Shows New Data:** ❌ **NO**
- **Metrics Shown:**
  - Prompt performance
  - Visibility per prompt
  - Mention counts
  - Keyword matching
- **Impact:** 🔴 **HIGH** - Prompt optimization feature

---

### 3. **Recommendations Page** ❌
- **UI Route:** `/recommendations`
- **API Endpoints:** 
  - `GET /api/recommendations`
  - `GET /api/recommendations-v3`
- **Backend Services:** 
  - `recommendationService` (v1)
  - `recommendationV3Service` (v3)
- **Data Source:** ❌ **OLD SCHEMA** (`extracted_positions`)
- **Status:** **NOT migrated**
- **Shows New Data:** ❌ **NO**
- **Metrics Shown:**
  - AI-generated recommendations
  - Brand context analysis
  - Competitor comparison
  - Per-LLM insights
- **Impact:** 🔴 **HIGH** - AI insights feature

---

### 4. **Sentiment Labeling UI** ❌
- **Backend Service:** `brandSentimentService.getTopSentimentForLabeling()`
- **Data Source:** ❌ **OLD SCHEMA** (`extracted_positions`)
- **Status:** **NOT migrated**
- **Shows New Data:** ❌ **NO**
- **Impact:** 🟡 **MEDIUM** - Sentiment labeling interface

---

## 📋 SUMMARY TABLE

| UI Screen | Shows New Data? | Data Source | Priority |
|-----------|----------------|-------------|----------|
| **Dashboard** | ✅ YES (mostly) | New schema | - |
| **Source Attribution** | ✅ YES | New schema | - |
| **Keywords Analytics** | ✅ YES | New schema | - |
| **Topics Page** | ❌ **NO** | Old schema | 🔴 HIGH |
| **Prompts Analytics** | ❌ **NO** | Old schema | 🔴 HIGH |
| **Recommendations** | ❌ **NO** | Old schema | 🔴 HIGH |
| **Sentiment Labeling** | ❌ **NO** | Old schema | 🟡 MEDIUM |

---

## ⚠️ CRITICAL IMPACT

### What Happens After New Data Collection?

**Bose Brand Example (just collected):**
- ✅ **Dashboard** → Shows new data (SOA, visibility, sentiment)
- ✅ **Source Attribution** → Shows new sources with SOA/sentiment
- ✅ **Keywords** → Shows new keyword data
- ❌ **Topics** → Shows **NOTHING NEW** (old data only)
- ❌ **Prompts** → Shows **NOTHING NEW** (old data only)
- ❌ **Recommendations** → Uses **OLD DATA** for AI insights

### User Experience:
- User collects new data ✅
- User goes to Dashboard → Sees new data ✅
- User goes to Topics page → **NO NEW DATA!** ❌ **CONFUSING!**
- User goes to Prompts → **NO NEW DATA!** ❌ **CONFUSING!**
- User gets Recommendations → **Based on OLD DATA!** ❌ **INACCURATE!**

---

## 🎯 RECOMMENDATION

**URGENT:** Migrate the 3 high-priority screens **IMMEDIATELY** to avoid user confusion:

### Priority 1 (Critical - 1 week):
1. **Topics Page** (2-3 days) - Core analytics
2. **Prompts Analytics** (1-2 days) - Performance tracking

### Priority 2 (Important - 1 week):
3. **Dashboard Previous Period** (4 hours) - Change metrics
4. **Sentiment Labeling** (4 hours) - Labeling UI

### Priority 3 (Nice to have - 2 weeks):
5. **Recommendations** (3-5 days) - Can use compatibility view temporarily

**Without these migrations, users will be confused why new data shows up on some pages but not others!**

---

## 🔧 CURRENT FEATURE FLAGS STATUS

All migrated screens require these flags to be **ON** (currently all enabled):

```bash
USE_OPTIMIZED_POSITION_CHECK=true
USE_OPTIMIZED_SENTIMENT_QUERY=true
USE_OPTIMIZED_PROMPT_METRICS=true
USE_OPTIMIZED_KEYWORDS_QUERY=true
USE_OPTIMIZED_SOURCE_ATTRIBUTION=true
```

If any flag is set to `false`, that screen will fall back to `extracted_positions` (old data).

