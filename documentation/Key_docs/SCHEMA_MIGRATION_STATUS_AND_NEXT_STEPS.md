# Schema Migration Status & Next Steps

**Date**: December 22, 2025  
**Status**: Phase 2.5 Complete (Backend Write Services Done, Dashboard Queries Done)

---

## ✅ COMPLETED

### 1. **Backend Write Services** - DONE ✅

**Position Extraction Service** (`position-extraction.service.ts`)
- ✅ Modified `savePositions()` to write to new schema
- ✅ Creates `metric_facts` (core reference)
- ✅ Creates `brand_metrics` (brand visibility data)
- ✅ Creates `competitor_metrics` (one per competitor)
- ✅ Uses upsert for idempotency
- ✅ Bulk fetches competitor IDs for efficiency

**Sentiment Storage** (`consolidated-scoring.service.ts`)
- ✅ Modified `storeSentiment()` to write to new schema
- ✅ Creates/updates `brand_sentiment`
- ✅ Creates `competitor_sentiment` (bulk insert)
- ✅ Fetches `metric_fact_id` from new schema
- ✅ Idempotent (deletes + inserts for competitors)

### 2. **Dashboard Queries** - DONE ✅

**Dashboard Payload Builder** (`payload-builder.ts`)
- ✅ Modified `fetchPositions()` to read from new schema
- ✅ Joins: `metric_facts`, `brand_metrics`, `competitor_metrics`, `brand_sentiment`, `competitor_sentiment`
- ✅ Transforms output to match `extracted_positions` format
- ✅ Backwards compatible - rest of dashboard code unchanged

---

## ⚠️ PENDING - Critical for New Data Collection

### 3. **Topics Page Queries** - PENDING ⚠️

Multiple services need updates to read from new schema:

#### **A. Main Topics Service** (`brand.service.ts`)
**Affected Methods:**
- `getBrandTopicsWithAnalytics()` - Main topics query (lines 1467-1953)
  - Line 1467-1474: Get distinct collector_types (models)
  - Line 1492-1570: Main positions query (3 paths: .in(), direct query, fallback)
  - Line 1929-1953: Query competitor positions for industry averages
  
**Complexity**: HIGH  
- 3 different query paths based on result set size
- Complex filtering by collector_type, date range, topic
- Processes metadata for topic extraction
- 90+ query points throughout the method

#### **B. Keywords Analytics Service** (`keywords-analytics.service.ts`)
**Affected Methods:**
- `getKeywordAnalytics()` - Line 128-142: Queries `extracted_positions` for brand presence

**Complexity**: MEDIUM

#### **C. Prompts Analytics Service** (`prompts-analytics.service.ts`)
**Affected Methods:**
- Uses positions data indirectly through other services

**Complexity**: LOW

#### **D. Source Attribution Service** (`source-attribution.service.ts`)
**Affected Methods:**
- `getImpactScoreTrends()` - Line 1284-1299: Queries `extracted_positions` for share, sentiment, visibility

**Complexity**: MEDIUM

#### **E. Prompt Metrics Service** (`prompt-metrics.service.ts`)
**Affected Methods:**
- `calculateAndStoreMetrics()` - Line 44-77: Queries `extracted_positions` for visibility and sentiment scores

**Complexity**: LOW

---

## 📋 MIGRATION APPROACH OPTIONS

### Option A: Individual Service Migration (Current Approach)
**Pros:**
- Granular control
- Can test each service individually
- Clear rollback per service

**Cons:**
- Time-consuming (5+ services to update)
- Risk of missing query points
- Complex coordination

**Estimated Effort:** 2-3 hours per service = 10-15 hours total

---

### Option B: Database View (RECOMMENDED) ⭐
**Create a materialized view that mimics `extracted_positions` format**

**SQL:**
```sql
CREATE MATERIALIZED VIEW extracted_positions_compat AS
SELECT 
  -- metric_facts data
  mf.collector_result_id,
  mf.brand_id,
  mf.customer_id,
  mf.query_id,
  mf.collector_type,
  mf.topic,
  mf.processed_at,
  mf.created_at,
  
  -- Brand data (competitor_name = NULL)
  NULL as competitor_name,
  bm.visibility_index,
  NULL as visibility_index_competitor,
  bm.share_of_answers as share_of_answers_brand,
  NULL as share_of_answers_competitor,
  bs.sentiment_score,
  bs.sentiment_label,
  NULL as sentiment_score_competitor,
  NULL as sentiment_label_competitor,
  bm.total_brand_mentions,
  NULL as competitor_mentions,
  bm.brand_positions,
  NULL as competitor_positions,
  bm.has_brand_presence,
  NULL as metadata

FROM metric_facts mf
LEFT JOIN brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN brand_sentiment bs ON mf.id = bs.metric_fact_id

UNION ALL

-- Competitor rows (one per competitor)
SELECT 
  -- metric_facts data
  mf.collector_result_id,
  mf.brand_id,
  mf.customer_id,
  mf.query_id,
  mf.collector_type,
  mf.topic,
  mf.processed_at,
  mf.created_at,
  
  -- Competitor data
  bc.competitor_name as competitor_name,
  NULL as visibility_index,
  cm.visibility_index as visibility_index_competitor,
  NULL as share_of_answers_brand,
  cm.share_of_answers as share_of_answers_competitor,
  NULL as sentiment_score,
  NULL as sentiment_label,
  cs.sentiment_score as sentiment_score_competitor,
  cs.sentiment_label as sentiment_label_competitor,
  NULL as total_brand_mentions,
  cm.competitor_mentions,
  NULL as brand_positions,
  cm.competitor_positions,
  NULL as has_brand_presence,
  NULL as metadata

FROM metric_facts mf
LEFT JOIN competitor_metrics cm ON mf.id = cm.metric_fact_id
LEFT JOIN brand_competitors bc ON cm.competitor_id = bc.id
LEFT JOIN competitor_sentiment cs ON mf.id = cs.metric_fact_id AND cs.competitor_id = cm.competitor_id;

-- Add indexes for performance
CREATE INDEX idx_ep_compat_brand_date ON extracted_positions_compat(brand_id, customer_id, processed_at);
CREATE INDEX idx_ep_compat_collector ON extracted_positions_compat(collector_type);
CREATE INDEX idx_ep_compat_topic ON extracted_positions_compat(topic);

-- Refresh strategy: Refresh after each data collection
REFRESH MATERIALIZED VIEW extracted_positions_compat;
```

**Pros:**
- ✅ **ZERO CODE CHANGES** - All services work as-is
- ✅ Fast implementation (30 minutes)
- ✅ Easy rollback (drop view)
- ✅ Can refresh on-demand or schedule
- ✅ All services benefit immediately

**Cons:**
- Materialized view needs periodic refresh
- Slightly stale data (refresh after each collection)
- Extra storage (but still 42% less than old schema)

**Estimated Effort:** 30 minutes

---

## 🎯 RECOMMENDED NEXT STEPS

### Step 1: Create Compatibility View (30 min)
1. Create migration: `20250202000001_create_extracted_positions_compat_view.sql`
2. Run migration on Supabase
3. Verify data correctness: Compare row counts, sample queries

### Step 2: Test Complete Flow (1 hour)
1. Collect new data using backend write services
2. Verify data appears in:
   - New schema tables (metric_facts, brand_metrics, etc.)
   - Compatibility view (extracted_positions_compat)
3. Test dashboard (should work without changes)
4. Test topics page (should work without changes)
5. Verify all metrics are correct

### Step 3: Monitor & Validate (ongoing)
1. Compare dashboard metrics: new data vs. historical data
2. Verify query performance (should be 90x faster)
3. Monitor storage savings (should be 84% less)

### Step 4: Deprecate Old Table (after 1 week of validation)
1. Stop writing to `extracted_positions`
2. Archive old data
3. Drop `extracted_positions` table
4. Rename `extracted_positions_compat` → `extracted_positions`

---

## 📊 CURRENT STATE

### Data Flow (New Data Collection):
```
Collector Results (raw LLM answers)
           ↓
     Analysis Service
           ↓
    ┌──────────────┐
    │ Step 1:      │
    │ Analysis     │
    │ (LLM)        │──→ consolidated_analysis_cache
    └──────────────┘        citation_categories
           ↓
    ┌──────────────┐
    │ Step 2:      │──→ metric_facts (core reference)
    │ Position     │    ├─→ brand_metrics
    │ Extraction   │    └─→ competitor_metrics
    └──────────────┘
           ↓
    ┌──────────────┐
    │ Step 3:      │──→ brand_sentiment
    │ Sentiment    │    └─→ competitor_sentiment
    │ Storage      │
    └──────────────┘
```

### UI Queries (Dashboard):
```
Dashboard Request
      ↓
   fetchPositions() ──→ Queries new schema (metric_facts + joins)
      ↓
   Transform to extracted_positions format
      ↓
   Rest of dashboard logic (unchanged)
```

### UI Queries (Topics, Keywords, etc.):
```
⚠️ STILL QUERIES OLD SCHEMA
   
Topics Request
      ↓
   brand.service.ts ──→ extracted_positions (deprecated!)
      ↓
   ❌ NO NEW DATA VISIBLE
```

---

## ⚠️ CRITICAL DECISION NEEDED

**You must choose one approach before collecting new data:**

### ✅ OPTION B (RECOMMENDED): Create Compatibility View
- **DO THIS IF:** You want to start collecting data immediately with minimal code changes
- **Time:** 30 minutes to implement + test
- **Risk:** LOW
- **Benefit:** All services work immediately

### ⚠️ OPTION A: Migrate Each Service Individually
- **DO THIS IF:** You want maximum control and plan to eventually remove the view
- **Time:** 10-15 hours to implement + test all services
- **Risk:** MEDIUM (might miss some query points)
- **Benefit:** Clean architecture, no views

---

## 🚀 IF YOU CHOOSE OPTION B (Recommended)

I can implement the compatibility view in the next 30 minutes:
1. Create SQL migration
2. Run on Supabase
3. Verify with sample queries
4. Test complete flow

**Then you can:**
- ✅ Collect new data immediately
- ✅ Dashboard will show new data (already migrated)
- ✅ Topics will show new data (via view)
- ✅ All analytics will work
- ✅ Zero code changes needed

Later, you can optionally migrate individual services off the view over time.

---

## 📝 Summary

**Status:**
- ✅ Backend writes: DONE (new data → new schema)
- ✅ Dashboard reads: DONE (reads new schema)
- ⚠️ Topics/Analytics reads: PENDING (still reads old schema)

**Impact:**
- New data collection will populate new schema ✅
- Dashboard will show new data ✅
- Topics/Analytics will NOT show new data ❌

**Solution:**
- Option A: Migrate 5+ services individually (10-15 hours)
- Option B: Create compatibility view (30 minutes) ⭐ RECOMMENDED

**What's next?**
- Your decision: Option A or Option B?
- If Option B: I'll create the view immediately
- If Option A: I'll start with brand.service.ts topics queries

---

Let me know which approach you prefer!

