# extracted_positions Table - Usage Analysis

**Date:** December 23, 2025  
**Question:** Can we remove the `extracted_positions` table?  
**Answer:** ❌ **NO - Still needed by multiple services**

---

## ✅ MIGRATED SERVICES (Using New Schema)

These services have been migrated to use the new schema with feature flags. When flags are **OFF**, they fall back to `extracted_positions`.

| Service | Feature Flag | Status |
|---------|--------------|--------|
| **Position Extraction** | `USE_OPTIMIZED_POSITION_CHECK` | ✅ Migrated (existence check only) |
| **Brand Dashboard** | N/A | ✅ Migrated (main query) |
| **Source Attribution** | `USE_OPTIMIZED_SOURCE_ATTRIBUTION` | ✅ Migrated (3 query points) |
| **Sentiment Services** | `USE_OPTIMIZED_SENTIMENT_QUERY` | ✅ Migrated (brand + competitor) |
| **Prompt Metrics** | `USE_OPTIMIZED_PROMPT_METRICS` | ✅ Migrated |
| **Keywords Analytics** | `USE_OPTIMIZED_KEYWORDS_QUERY` | ✅ Migrated |

---

## ❌ NOT YET MIGRATED (Actively Reading from extracted_positions)

These services are **still actively querying** `extracted_positions` and have **NO optimized alternative**:

### 1. **Brand Topics Service** (`brand.service.ts`)
- **Lines:** 1468, 1493, 1517, 1930
- **Usage:** 
  - Get distinct collector types (models)
  - Fetch positions for topics with analytics
  - Calculate competitor averages per topic
- **Impact:** HIGH - Core analytics feature
- **Complexity:** HIGH - Large service with complex queries

### 2. **Prompts Analytics Service** (`prompts-analytics.service.ts`)
- **Lines:** 734
- **Usage:**
  - Fetch visibility and mention counts for prompt analysis
- **Impact:** HIGH - Prompt performance tracking
- **Complexity:** MEDIUM

### 3. **Recommendation Services**
#### `recommendation.service.ts`
- **Lines:** 605, 635, 736, 830, 985
- **Usage:**
  - Overall brand metrics (current + previous period)
  - Competitor metrics
  - Per-LLM metrics
  - Source-level SOA and sentiment
- **Impact:** HIGH - AI-powered recommendations
- **Complexity:** HIGH

#### `recommendation-v3.service.ts`
- **Lines:** 186, 214, 272, 379
- **Usage:**
  - Similar to v1 (overall, previous, competitors, per-LLM)
- **Impact:** HIGH - Next-gen recommendations
- **Complexity:** HIGH

### 4. **Brand Sentiment Service** (`brand-sentiment.service.ts`)
- **Lines:** 63
- **Usage:**
  - Get top N sentiment results for labeling
- **Impact:** MEDIUM - Sentiment labeling UI
- **Complexity:** LOW

### 5. **Consolidated Scoring Service** (`consolidated-scoring.service.ts`)
- **Lines:** 285, 294
- **Usage:**
  - Check if positions and sentiment exist before scoring
- **Impact:** LOW - Validation checks only
- **Complexity:** LOW

### 6. **Dashboard - Previous Period** (`payload-builder.ts`)
- **Lines:** 1701
- **Usage:**
  - Previous period comparison data
- **Impact:** MEDIUM - Dashboard change metrics
- **Complexity:** LOW - Single query

---

## 📊 SUMMARY

### Current State
- ✅ **6 services migrated** with feature flags
- ❌ **7 services still using** `extracted_positions`:
  1. Brand Topics Service (HIGH complexity)
  2. Prompts Analytics Service (MEDIUM complexity)
  3. Recommendation Service v1 (HIGH complexity)
  4. Recommendation Service v3 (HIGH complexity)
  5. Brand Sentiment Service (LOW complexity)
  6. Consolidated Scoring Service (LOW complexity)
  7. Dashboard Previous Period (LOW complexity)

### ⚠️ Can We Remove extracted_positions? **NO**

**Reasons:**
1. **7 services** are still actively reading from it
2. **4 HIGH-impact services** depend on it:
   - Brand Topics (core analytics)
   - Prompts Analytics (performance tracking)
   - Recommendations v1 & v3 (AI insights)
3. **Legacy fallback paths** exist when feature flags are OFF
4. **Historical data** is still valuable

---

## 📅 NEXT STEPS TO REMOVE extracted_positions

### Phase 1: Enable All Feature Flags (DONE ✅)
- ✅ `USE_OPTIMIZED_POSITION_CHECK=true`
- ✅ `USE_OPTIMIZED_SENTIMENT_QUERY=true`
- ✅ `USE_OPTIMIZED_PROMPT_METRICS=true`
- ✅ `USE_OPTIMIZED_KEYWORDS_QUERY=true`
- ✅ `USE_OPTIMIZED_SOURCE_ATTRIBUTION=true`

### Phase 2: Migrate Remaining Services (TODO)
Priority order:
1. **Brand Topics Service** (HIGH priority - 2-3 days)
2. **Prompts Analytics Service** (HIGH priority - 1 day)
3. **Dashboard Previous Period** (MEDIUM priority - 2 hours)
4. **Brand Sentiment Service** (LOW priority - 2 hours)
5. **Consolidated Scoring Service** (LOW priority - 1 hour)
6. **Recommendation Services** (LOW priority - can use compat view longer)

### Phase 3: Remove Legacy Fallback Code (TODO)
- Remove all `if (!USE_OPTIMIZED_...) { ... }` legacy code blocks
- Remove feature flag checks
- Keep only optimized paths

### Phase 4: Drop extracted_positions Table (TODO)
- Verify all services work correctly
- Monitor for 2 weeks
- Archive historical data if needed
- Drop table: `DROP TABLE extracted_positions;`

---

## ⏱️ ESTIMATED TIME TO COMPLETE REMOVAL

| Phase | Effort | Status |
|-------|--------|--------|
| Phase 1: Enable Flags | 0 days | ✅ Done |
| Phase 2: Migrate Services | 5-7 days | ⏳ In Progress |
| Phase 3: Remove Fallbacks | 1 day | ⏸️ Pending |
| Phase 4: Drop Table | 2 weeks monitoring + 1 hour | ⏸️ Pending |
| **TOTAL** | **3-4 weeks** | **~40% Complete** |

---

## 🎯 RECOMMENDATION

**DO NOT remove `extracted_positions` yet.** 

Complete the migration of the 7 remaining services first, then monitor for stability before dropping the table. The compatibility view (`extracted_positions_compat`) can help bridge the gap for lower-priority services.

**Current Progress:** 40% complete (6 of 15 services migrated)

