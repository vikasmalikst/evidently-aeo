# Testing Readiness Checklist - Consolidated Analysis Integration

## ✅ Implementation Complete

### 1. Consolidated Analysis Service
- ✅ Single API call for products, citations, and sentiment
- ✅ Database caching for citation categories
- ✅ Sentiment scores in 1-100 scale (no sentences)
- ✅ Proper score-to-label mapping (<55=negative, 55-65=neutral, >65=positive)

### 2. Database Integration
- ✅ `citation_categories` table created
- ✅ Hardcoded domains pre-populated
- ✅ Citations stored with categories
- ✅ Sentiment stored in `extracted_positions`
- ✅ Products used from consolidated analysis cache

### 3. Brand Scoring Orchestrator
- ✅ Integrated consolidated scoring service
- ✅ Feature flag: `USE_CONSOLIDATED_ANALYSIS=true`
- ✅ Falls back to legacy approach if flag is false
- ✅ Proper error handling

## 🔧 Configuration Required

### Environment Variables

Add to your `.env` file:

```bash
# Enable consolidated analysis (set to 'true' to use new approach)
USE_CONSOLIDATED_ANALYSIS=true

# OpenRouter configuration (should already exist)
OPENROUTER_API_KEY=your_key
OPENROUTER_SITE_URL=your_site_url
OPENROUTER_SITE_TITLE=your_site_title

# Supabase configuration (should already exist)
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

### Database Migrations

Run these migrations in order:

```bash
# 1. Create citation_categories table
supabase migration up 20250115000000_create_citation_categories_table.sql

# 2. Populate hardcoded domains
supabase migration up 20250115000001_populate_citation_categories_hardcoded.sql
```

Or if using Supabase CLI:
```bash
supabase db push
```

## 📋 Pre-Testing Checklist

### Database Setup
- [ ] Migrations applied successfully
- [ ] `citation_categories` table exists
- [ ] Hardcoded domains populated (check: `SELECT COUNT(*) FROM citation_categories;` should be ~30+)
- [ ] `extracted_positions` table exists
- [ ] `citations` table exists

### Code Setup
- [ ] `USE_CONSOLIDATED_ANALYSIS=true` in `.env`
- [ ] All dependencies installed (`npm install` or equivalent)
- [ ] Backend server can start without errors
- [ ] No TypeScript compilation errors

### API Keys
- [ ] `OPENROUTER_API_KEY` is set and valid
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set and valid

## 🧪 Testing Steps

### 1. Test Brand Onboarding

1. **Create a new brand** through your onboarding flow
2. **Add competitors** (at least 1-2)
3. **Trigger data collection** (collector results should be created)
4. **Run brand scoring**:
   ```typescript
   await brandScoringService.scoreBrand({
     brandId: 'your-brand-id',
     customerId: 'your-customer-id',
   });
   ```

### 2. Verify Data in Database

#### Check Citations
```sql
SELECT 
  url, 
  domain, 
  category, 
  page_name 
FROM citations 
WHERE brand_id = 'your-brand-id' 
ORDER BY created_at DESC 
LIMIT 10;
```
- ✅ Citations should have `category` populated
- ✅ Citations should have `page_name` populated (if available)
- ✅ Categories should be one of: Editorial, Corporate, Reference, UGC, Social, Institutional

#### Check Citation Categories Cache
```sql
SELECT 
  domain, 
  category, 
  page_name,
  created_at
FROM citation_categories 
ORDER BY created_at DESC 
LIMIT 20;
```
- ✅ Should see hardcoded domains (techcrunch.com, forbes.com, etc.)
- ✅ Should see new domains from your test (if any)

#### Check Extracted Positions
```sql
SELECT 
  collector_result_id,
  brand_name,
  competitor_name,
  sentiment_label,
  sentiment_score,
  sentiment_label_competitor,
  sentiment_score_competitor,
  total_brand_mentions
FROM extracted_positions 
WHERE brand_id = 'your-brand-id' 
ORDER BY processed_at DESC 
LIMIT 10;
```
- ✅ `sentiment_label` should be POSITIVE, NEGATIVE, or NEUTRAL
- ✅ `sentiment_score` should be between 1-100
- ✅ `sentiment_label_competitor` should be populated for competitor rows
- ✅ `sentiment_score_competitor` should be between 1-100

#### Check Products
```sql
SELECT 
  metadata->>'product_names' as products
FROM collector_results 
WHERE brand_id = 'your-brand-id' 
AND metadata->>'product_names' IS NOT NULL
LIMIT 5;
```
- ✅ Products should be extracted and stored in metadata

### 3. Verify API Call Efficiency

Check logs for:
- ✅ "Using consolidated analysis" messages
- ✅ "Using cached citation categories" messages
- ✅ Single API call per collector_result (not multiple calls)

### 4. Test Error Handling

1. **Test with invalid brand_id**: Should handle gracefully
2. **Test with no citations**: Should still work
3. **Test with no competitors**: Should still work
4. **Test with API failure**: Should log error and continue

## 🐛 Common Issues & Solutions

### Issue: "Citation categories table doesn't exist"
**Solution**: Run the migrations:
```bash
supabase migration up
```

### Issue: "No sentiment scores in extracted_positions"
**Solution**: 
- Check that positions were extracted first
- Check that `USE_CONSOLIDATED_ANALYSIS=true`
- Check logs for errors

### Issue: "Citations don't have categories"
**Solution**:
- Check that consolidated analysis ran successfully
- Check `citation_categories` table for cached domains
- Check logs for categorization errors

### Issue: "Multiple API calls still happening"
**Solution**:
- Verify `USE_CONSOLIDATED_ANALYSIS=true` in `.env`
- Restart backend server after changing env vars
- Check that consolidated scoring service is being called

## 📊 Expected Results

### Performance
- **API Calls**: 1 per collector_result (instead of 3-5+)
- **Cost**: ~70-80% reduction in API costs
- **Speed**: Faster processing (single round-trip)

### Data Quality
- **Sentiment Scores**: 1-100 scale, properly labeled
- **Citation Categories**: All citations categorized
- **Products**: Extracted and stored correctly
- **Positions**: Character positions calculated correctly

## ✅ Ready to Test?

If all items in the Pre-Testing Checklist are complete, you're ready to test!

### Quick Test Command

```bash
# In your backend directory
npm run test:scoring  # If you have a test script
# Or trigger through your API/CLI
```

### Monitoring During Test

Watch for these log messages:
- `🚀 Using consolidated analysis for brand scoring...`
- `📊 Processing collector_result...`
- `✅ Consolidated analysis complete`
- `✅ Citations stored`
- `✅ Position extraction complete`
- `✅ Updated brand sentiment`
- `✅ Updated competitor sentiment`

## 🎯 Success Criteria

Test is successful if:
1. ✅ All collector results are processed
2. ✅ Citations have categories
3. ✅ Sentiment scores are in 1-100 range
4. ✅ Products are extracted
5. ✅ Positions are calculated
6. ✅ Only 1 API call per collector_result
7. ✅ No errors in logs

## 📝 Next Steps After Testing

If testing is successful:
1. Monitor for 24-48 hours in production
2. Compare results with legacy approach (if running in parallel)
3. Gradually increase `limit` for batch processing
4. Monitor API costs to verify savings

If issues are found:
1. Check error logs
2. Verify database state
3. Test with `USE_CONSOLIDATED_ANALYSIS=false` to compare
4. Review this checklist for missed steps
