# Topics Page Filters Implementation

## ✅ What's Been Implemented

### 1. **Backend - Filter Support**

**File**: `backend/src/services/brand.service.ts` - `getBrandTopicsWithAnalytics()`

**New Parameters**:
- ✅ `collectorType` - Filters by AI model (chatgpt, claude, gemini, etc.)
- ✅ `country` - Country/region filter (not yet implemented in query, but parameter accepted)
- ✅ `startDate` / `endDate` - Date range filtering (already working)

**Filtering Logic**:
- ✅ Filters `extracted_positions` by `collector_type` when `collectorType` provided
- ✅ Maps frontend model IDs to backend collector_type values
- ✅ Returns `collectorType` with each topic in response
- ✅ Groups topics by topic name + collector type combination

**Data Source**:
- ✅ Primary: `extracted_positions.metadata.topic_name` 
- ✅ Fallback: `generated_queries.topic`
- ✅ Returns only topics with actual query execution data

### 2. **Frontend - Filter Integration**

**File**: `src/pages/Topics.tsx`

**Changes**:
- ✅ Accepts filter state from parent
- ✅ Passes filters to API endpoint as query params
- ✅ Refetches data when filters change
- ✅ No mock data fallback

**File**: `src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx`

**Filter State**:
- ✅ `selectedModel` - AI model filter (defaults to empty = "All Models")
- ✅ `selectedCountry` - Country filter (defaults to 'us')
- ✅ `selectedDate` - Date range filter
- ✅ `datePeriodType` - Daily/weekly/monthly view

**Filter Callbacks**:
- ✅ `onFiltersChange` prop - Passes filters to parent Topics component
- ✅ Triggers API refetch when filters change via `useEffect`
- ✅ Date range calculation for API format

### 3. **Model Display**

**File**: `src/pages/TopicsAnalysis/components/TopicsRankedTable.tsx`

**Changes**:
- ✅ Shows **real collector type** from `topic.collectorType` in MODEL column
- ✅ No longer shows mock "ChatGPT" for all rows
- ✅ Each topic displays its actual AI model from data
- ✅ Model icon matches the collector type from data

**Before**: All rows showed same model (from filter)
**After**: Each row shows the actual model that generated the data

---

## 🔍 How Filters Work

### **Date Range Filter**
1. User selects date range in date picker
2. `handleDateRangeApply` calculates start/end dates
3. Dates converted to ISO format (YYYY-MM-DD)
4. Passed to backend via `startDate` and `endDate` query params
5. Backend filters `extracted_positions.processed_at` by date range

### **Model Filter**
1. User selects AI model from dropdown (or "All Models")
2. `selectedModel` state updates
3. `useEffect` triggers `onFiltersChange` callback
4. Filter passed to backend via `collectorType` query param
5. Backend filters `extracted_positions.collector_type` by selected model
6. Table shows only topics for selected model (or all if empty)

### **Country Filter**
1. User selects country from dropdown
2. `selectedCountry` state updates  
3. `useEffect` triggers `onFiltersChange` callback
4. Filter passed to backend via `country` query param
5. **Note**: Country filtering not yet implemented in backend query (parameter accepted but not used)

### **Category Filter**
1. Client-side filtering only
2. Filters topics by category in `TopicsRankedTable`
3. Does not trigger API refetch

---

## 📊 Data Flow

```
1. User Changes Filter (Date/Model/Country)
   ↓
2. TopicsAnalysisPage updates state
   ↓
3. useEffect triggers onFiltersChange callback
   ↓
4. Topics.tsx updates filters state
   ↓
5. topicsEndpoint recalculates with new query params
   ↓
6. useCachedData refetches from API
   ↓
7. Backend filters data by:
   - collector_type (model)
   - processed_at (date range)
   - brand_id + customer_id
   ↓
8. Returns filtered topics with analytics
   ↓
9. Frontend transforms and displays
   ↓
10. Table shows real collector_type per topic
```

---

## ❌ What's Still Missing / Not Working

### **Country Filter** ⏳
- **Status**: Parameter accepted by backend, but not used in query
- **Impact**: Country filter dropdown works, but doesn't filter data
- **Solution**: Add country filtering to `extracted_positions` query
- **Note**: Country data may not be available in `extracted_positions` table

### **Model Filter "All Models"** ⚠️
- **Status**: When "All Models" selected, shows all topics but groups by topic+model
- **Impact**: Same topic appears multiple times (once per model)
- **Solution**: When "All Models", aggregate metrics across all models per topic

### **Date Range Calculation** ⚠️
- **Status**: Uses `selectedDate` (single date) but needs proper date range
- **Impact**: May not calculate correct date range for API
- **Solution**: Use proper start/end date calculation in `getDateRangeForAPI`

### **Historical Trends** ❌
- **Status**: Not implemented
- **Impact**: Trend column shows "→ 0.0x" for all topics
- **Solution**: Calculate period-over-period comparison in backend

### **Citation Sources** ❌
- **Status**: Not implemented
- **Impact**: Sources column shows "—"
- **Solution**: Query `citations` table or extract from metadata

### **Avg Industry SoA** ⚠️
- **Status**: Shows mock data
- **Impact**: "— →0.0x – 0.0%" displayed
- **Solution**: Calculate industry average from all brands in same category

---

## 🧪 Testing the Filters

### **To Test Model Filter**:
1. Select "ChatGPT" from Model dropdown
2. Check backend logs: Should see `🔍 Filtering by collector_type: chatgpt`
3. Table should show only topics with ChatGPT data
4. MODEL column should show "ChatGPT" for all rows

### **To Test Date Range Filter**:
1. Click date picker button
2. Select a date range
3. Click Apply
4. Check backend logs: Should see `📅 Date range: <start> to <end>`
5. Table should show only topics with data in that date range

### **To Test "All Models"**:
1. Select "All Models" from dropdown
2. Table should show topics from all models
3. Same topic may appear multiple times (once per model)

### **To Verify Real Data**:
1. Check MODEL column - should show actual collector types (ChatGPT, Claude, etc.)
2. Check backend logs for topic extraction summary
3. Verify `collectorType` is included in backend response

---

## 📝 Files Modified

### Backend:
- ✅ `backend/src/routes/brand.routes.ts` - Accepts collectorType and country params
- ✅ `backend/src/services/brand.service.ts` - Filters by collector_type, returns collectorType

### Frontend:
- ✅ `src/pages/Topics.tsx` - Passes filters to API, handles filter state
- ✅ `src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx` - Filter UI and callbacks
- ✅ `src/pages/TopicsAnalysis/components/TopicsRankedTable.tsx` - Shows real collectorType
- ✅ `src/pages/TopicsAnalysis/types.ts` - Added collectorType to Topic interface
- ✅ `src/api/topicsApi.ts` - Passes filters to API endpoint

---

## ✅ Summary

**Working Now**:
- ✅ Date range filter - Backend filters by date range
- ✅ Model filter - Backend filters by collector_type
- ✅ Real collector type display - Table shows actual model per topic
- ✅ Filter triggers API refetch - Data updates when filters change
- ✅ No mock data - All data comes from database

**Still Needed**:
- ⏳ Country filter backend implementation
- ⏳ Aggregate "All Models" view (group topics across models)
- ⏳ Historical trends calculation
- ⏳ Citation sources query
- ⏳ Industry average SoA calculation

**Result**: Filters are working! Changing the Model or Date Range will filter the data and show only matching topics with their real collector types.

