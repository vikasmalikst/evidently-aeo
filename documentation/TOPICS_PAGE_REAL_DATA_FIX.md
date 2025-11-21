# Topics Page - Real Data Only Fix

## ✅ Changes Made

### 1. **Backend - Only Show Topics With Collector Results**

**File**: `backend/src/services/brand.service.ts`

**Changed Method**: `getBrandTopicsWithAnalytics()`

**Before**: 
- Fetched ALL topics from `brand_topics` table
- Then tried to enrich with analytics
- Showed all topics even without data

**After**:
- ✅ Queries topics directly from `generated_queries` table
- ✅ Only includes topics that have `collector_results`
- ✅ Only includes topics with `extracted_positions` in date range
- ✅ Returns ONLY topics with actual query execution data

**Data Flow**:
```
1. generated_queries (filter by brand_id, get distinct topics)
   ↓
2. collector_results (join via query_id)
   ↓
3. extracted_positions (join via collector_result_id, filter by date range)
   ↓
4. Group by topic and calculate metrics
```

**Tables Used**:
- ✅ `generated_queries` - Source of topics (topic column)
- ✅ `collector_results` - Links queries to results
- ✅ `extracted_positions` - Analytics data (SoA, sentiment, visibility)
- ✅ `brand_topics` - Metadata only (category, priority) - optional

### 2. **Frontend - Removed Mock Data**

**File**: `src/pages/Topics.tsx`

**Removed**:
- ❌ `import { mockTopicsAnalysisData }`
- ❌ All fallbacks to `mockTopicsAnalysisData`
- ❌ Mock data in loading state
- ❌ Mock data in error state

**Changed**:
- ✅ Shows empty state if no data
- ✅ Only displays real topics from API
- ✅ Filters topics with `totalQueries > 0` in transform function

**Files**: `src/api/topicsApi.ts`

**Changed**:
- ✅ Filters to only topics with `totalQueries > 0`
- ✅ Added optional date range parameters

### 3. **Removed Data Availability Status Section**

**File**: `src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx`

**Removed**:
- ❌ `DataAvailabilityCard` import
- ❌ `<DataAvailabilityCard />` component
- ❌ Data availability card rendering

**Kept**:
- ✅ Status banner (will show when topics exist)

---

## 📊 Current Data Sources

### **Topics Table**: `generated_queries`
- ✅ Column: `topic` - The actual topic name
- ✅ Column: `intent` - Intent type (awareness, comparison, purchase, support)
- ✅ Filter: Must have `collector_results` associated

### **Analytics Data**: `extracted_positions`
- ✅ Column: `share_of_answers_brand` - SoA metric (0-100%)
- ✅ Column: `sentiment_score` - Sentiment (-1 to +1)
- ✅ Column: `visibility_index` - Visibility (0-100)
- ✅ Column: `has_brand_presence` - Boolean presence flag
- ✅ Filter: Date range (`processed_at`)

### **Join Tables**:
- ✅ `collector_results` - Links `generated_queries` to `extracted_positions`
- ✅ `brand_topics` - Metadata (category, priority) - optional enrichment

---

## ❓ What's Missing / Not Available

### **Currently Missing**:

1. **Historical Trends** ❌
   - **Why**: Need time-series aggregation (daily/weekly snapshots)
   - **Impact**: Chart shows flat line, trend shows "→ 0.0x"
   - **Solution**: Build time-series aggregation service

2. **Citation Sources** ❌
   - **Why**: Need source attribution from responses
   - **Impact**: Sources column shows "—"
   - **Solution**: Implement source extraction from `citations` table or `extracted_positions.metadata`

3. **Trend Calculations** ❌
   - **Why**: Need comparison between time periods
   - **Impact**: All trends show "neutral" with 0.0x delta
   - **Solution**: Compare current period vs previous period

4. **Search Volume** ❌
   - **Why**: Removed per user request
   - **Impact**: Column removed entirely

### **Available But Not Yet Implemented**:

1. **Competitor SoA** ⏳
   - **Data**: `extracted_positions.share_of_answers_competitor`
   - **Status**: Data exists, not displayed in table yet

2. **Source URLs** ⏳
   - **Data**: `citations` table or `extracted_positions.metadata.sources`
   - **Status**: May exist, needs query to join

---

## 🎯 How It Works Now

### **Step 1: Query Generation**
1. User selects topics during onboarding OR
2. Topics generated via AI service
3. Stored in `generated_queries` table with `topic` column

### **Step 2: Query Execution**
1. Collectors run queries from `generated_queries`
2. Results stored in `collector_results`
3. Analytics extracted into `extracted_positions`

### **Step 3: Topics Page Display**
1. **Backend**:
   - Gets distinct topics from `generated_queries` that have `collector_results`
   - Joins with `extracted_positions` for analytics
   - Filters by date range
   - Groups by topic and calculates averages
   - Returns ONLY topics with data

2. **Frontend**:
   - Receives topics with analytics
   - Filters again for `totalQueries > 0` (safety check)
   - Displays in table
   - Shows "—" for missing metrics

---

## 🔍 Verification

### **Check Backend Logs**:
Look for:
```
🎯 Fetching topics WITH analytics (only topics with collector_results) for brand <id>
📅 Date range: <start> to <end>
📊 Found X distinct topics with analytics data
✅ Returned X topics with analytics data
```

### **Check Database**:
```sql
-- Verify topics have collector_results
SELECT DISTINCT gq.topic, COUNT(DISTINCT cr.id) as result_count
FROM generated_queries gq
JOIN collector_results cr ON cr.query_id = gq.id
WHERE gq.brand_id = '<your_brand_id>'
GROUP BY gq.topic
HAVING COUNT(DISTINCT cr.id) > 0;

-- Verify analytics data exists
SELECT gq.topic, COUNT(ep.id) as position_count,
       AVG(ep.share_of_answers_brand) as avg_soa,
       AVG(ep.sentiment_score) as avg_sentiment
FROM generated_queries gq
JOIN collector_results cr ON cr.query_id = gq.id
JOIN extracted_positions ep ON ep.collector_result_id = cr.id
WHERE gq.brand_id = '<your_brand_id>'
  AND ep.processed_at >= NOW() - INTERVAL '30 days'
GROUP BY gq.topic;
```

---

## ✅ Summary

**Before**: 
- ❌ Showed ALL topics from `brand_topics` table
- ❌ Many topics had no data (showed "—")
- ❌ Mock data fallback

**After**:
- ✅ Only shows topics from `generated_queries` with collector_results
- ✅ All displayed topics have real analytics data
- ✅ No mock data - real data only
- ✅ Data Availability Status card removed

**What You'll See**:
- ✅ Only topics with actual query execution data
- ✅ Real SoA values (when data exists)
- ✅ Real sentiment scores (when data exists)
- ✅ Real visibility metrics (when data exists)
- ✅ "—" only for truly missing metrics (sources, trends)

---

## 🚀 Next Steps to Populate Missing Data

1. **Historical Trends**: Build time-series aggregation
2. **Citation Sources**: Query `citations` table or extract from `metadata`
3. **Trend Calculations**: Compare periods in backend

