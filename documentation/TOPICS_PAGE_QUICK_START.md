# Topics Page - Quick Start Guide

## 🎯 What's New

The Topics page at `http://localhost:5173/topics` is now fully functional with real backend integration!

## ✅ Current Features

### 1. **Real Data Integration**
- Fetches topics from your backend (`/brands/:id/topics`)
- Shows actual topic names and categories from your database
- Automatically updates when switching brands

### 2. **Smart Data Handling**
- ✅ Shows real topics when available
- ✅ Falls back to sample data if backend is unavailable
- ✅ Clear indicators for missing analytics data
- ✅ No broken UI elements or confusing errors

### 3. **What You'll See**
- **Working Now:**
  - Topic names and categories
  - Total topics count
  - Category organization
  - Last updated timestamp
  - Interactive table with sorting/filtering

- **Awaiting Data Collection:**
  - Share of Answer metrics (needs query results)
  - Visibility trends (needs historical data)
  - Search volume (needs API integration)
  - Sentiment scores (needs AI analysis)
  - Citation sources (needs source attribution)

## 🚀 How to Use

### Access the Page
1. Navigate to `http://localhost:5173/topics`
2. Make sure you're logged in
3. Select a brand from the brand selector

### Understanding the UI

#### Status Banner (Top of Page)
- **Yellow Banner**: Topics are tracked, but analytics data is pending
- **Green Banner**: All data is available (you'll see this once query results are collected)

#### Data Availability Card
Shows a detailed breakdown of:
- ✅ What data is currently available
- ❌ What data is missing and why
- 📝 What's needed to populate missing data

#### Topics Table
- **Rank**: Topic priority order
- **Topic**: Name and category badge
- **SoA**: Shows "—" until query data is available
- **Trend**: Shows "→ 0.0x" until trend data is available
- **Volume**: Shows "—" until search volume data is integrated
- **Sources**: Shows "—" until citation sources are tracked

### Interactive Features
- ✅ Click column headers to sort
- ✅ Use checkboxes to select topics
- ✅ Filter by category using dropdown
- ✅ Date range selector (ready for time-series data)
- ✅ Country/region selector (ready for geo-specific data)

## 📊 Data Requirements

To see full analytics, your system needs to:

### Immediate (Already Working)
- ✅ Topics stored in `brand_topics` table
- ✅ Categories assigned to topics
- ✅ Active/inactive status tracking

### Next Steps (To Enable Analytics)
1. **Execute Queries**: Run your topics as queries through AI engines
2. **Track Results**: Store responses with brand presence flags
3. **Calculate Metrics**: Aggregate data for Share of Answer
4. **Analyze Sentiment**: Use AI to score brand mentions
5. **Attribute Sources**: Extract and categorize citation sources

See `TOPICS_PAGE_IMPLEMENTATION.md` for detailed technical requirements.

## 🔍 Testing the Page

### Manual Testing Checklist
- [x] Page loads without errors
- [x] Topics display when available
- [x] Brand selector changes topics
- [x] Table sorting works
- [x] Category filtering works
- [x] Missing data shows "—" not errors
- [x] Status banner displays correctly
- [x] Data Availability Card explains missing data
- [x] Responsive on mobile/tablet
- [x] Loading state shows during fetch

### What to Look For

#### With Topics in Database
You should see:
- Your actual topic names
- Correct categories
- Topic count matching your database
- "—" for metrics that need query data

#### Without Topics in Database
You should see:
- Sample/demo data for UI demonstration
- Yellow banner explaining data will load when topics are added
- Fully functional UI ready for real data

## 🐛 Troubleshooting

### Page Shows "No topics tracked yet"
**Cause**: Brand has no topics in database
**Solution**: 
- Go through brand setup/onboarding
- Or add topics directly to `brand_topics` table
- Or run topic generation process

### All Metrics Show "—"
**Cause**: This is expected! Analytics data requires query execution
**Solution**: 
- This is normal behavior
- Data will populate as your monitoring system runs
- See "Data Requirements" section above

### Error Banner Appears
**Cause**: Backend API is unavailable
**Solution**:
- Check backend is running on correct port
- Verify `VITE_BACKEND_URL` environment variable
- Check network/CORS configuration
- Page will still work with sample data

## 📝 Notes for Developers

### API Endpoints Used
```
GET /brands/:id/topics
GET /brands/:id/categories (optional)
```

### Key Files
```
src/api/topicsApi.ts              # API service
src/pages/Topics.tsx              # Entry point
src/pages/TopicsAnalysis/         # Main components
  ├── TopicsAnalysisPage.tsx      # Layout
  ├── components/
  │   ├── TopicsRankedTable.tsx   # Data table
  │   ├── DataAvailabilityCard.tsx # Status indicator
  │   └── TopicsDataStatusBanner.tsx # Top banner
  └── types.ts                    # TypeScript definitions
```

### Environment Variables
```bash
VITE_BACKEND_URL=http://localhost:3000/api
```

## 🎨 UI/UX Highlights

### Graceful Degradation
- Never shows errors for missing data
- Always provides helpful context
- Users understand what's available and what's coming

### Progressive Enhancement
- Works immediately with basic topic data
- Automatically enhances as more data becomes available
- No manual updates needed when data arrives

### Clear Communication
- Status banner at top explains current state
- Data Availability Card shows detailed breakdown
- Tooltips explain what each metric means
- "—" indicates pending data (not errors)

## 🚀 Next Steps

### For Users
1. Review your tracked topics
2. Ensure topics cover your key business areas
3. Wait for analytics to populate (automatic)
4. Monitor Share of Answer when available

### For Developers
1. Implement query execution for topics
2. Store results with brand presence tracking
3. Calculate Share of Answer metrics
4. Watch UI automatically populate with data

## 📚 Additional Resources

- `TOPICS_PAGE_IMPLEMENTATION.md` - Full technical documentation
- `src/pages/TopicsAnalysis/mockData.ts` - Example data structure
- `src/pages/TopicsAnalysis/types.ts` - TypeScript interfaces

---

**Questions?** Check the main implementation guide or review the inline code comments.

