# New Topics & Query Generation Implementation Summary

## ✅ What Was Implemented

### 1. New Service File
**File:** `backend/src/services/topics-query-generation.service.ts`

- Implements the improved prompt approach
- Generates topics and queries together
- Flexible topic count (3-7 per intent, filtered to top 15-20)
- Maps new intent archetypes to existing category system
- Uses structured JSON output format

### 2. Modified Brand Intelligence Service
**File:** `backend/src/services/onboarding-intel.service.ts`

- Added `skipTopics` parameter to `generateBrandIntelWithLLM()`
- When `USE_NEW_TOPICS_QUERY_GENERATION=true`, topics are not generated in brand intel call
- Original functionality remains intact (backward compatible)

### 3. Updated Brand Service
**File:** `backend/src/services/brand.service.ts`

- Added integration with new topics+queries service
- Feature flag: `USE_NEW_TOPICS_QUERY_GENERATION` environment variable
- New method: `storeTopicsAndQueriesFromNewService()` - stores topics and queries in database
- New method: `mapIntentArchetypeToIntent()` - maps new archetypes to existing intent system
- Falls back to original approach if feature flag is off or topics already exist

---

## 🔧 How It Works

### Flow with New Approach (Feature Flag ON)

```
1. Brand Onboarding Request
   ↓
2. Brand Intelligence Generation (skips topics)
   ↓
3. Check: Are topics provided by user?
   - YES → Use user topics
   - NO → Use NEW topics+queries service
   ↓
4. New Service generates:
   - Primary domain
   - 20-50 topics (filtered to top 20)
   - 1 query per topic
   - Intent archetypes mapped to categories
   ↓
5. Store in database:
   - Topics → brand_topics table
   - Queries → generated_queries table
   ↓
6. Continue with data collection (unchanged)
```

### Flow with Original Approach (Feature Flag OFF)

```
1. Brand Onboarding Request
   ↓
2. Brand Intelligence Generation (includes topics)
   ↓
3. Store topics in brand_topics
   ↓
4. Generate queries for topics (original service)
   ↓
5. Store queries in generated_queries
   ↓
6. Continue with data collection
```

---

## 🚀 How to Enable

### Environment Variable

Add to your `.env` file:

```bash
USE_NEW_TOPICS_QUERY_GENERATION=true
```

### When It Activates

The new approach is used when:
1. `USE_NEW_TOPICS_QUERY_GENERATION=true`
2. User hasn't provided topics in onboarding request
3. No topics exist from brand intelligence call

Otherwise, the original approach is used (backward compatible).

---

## 📊 Database Schema

### Topics Storage (`brand_topics` table)
- `topic_name`: Topic text
- `category`: Mapped from intent archetype (awareness/comparison/purchase/support)
- `description`: Topic description
- `metadata`: Stores intent archetype, priority, primary domain

### Queries Storage (`generated_queries` table)
- `query_text`: The generated query
- `topic`: Topic name
- `intent`: Mapped from intent archetype
- `priority`: Priority score (1-5)
- `metadata`: Stores intent archetype, generation source

---

## 🔄 Frontend Compatibility

**No frontend changes required!**

The new approach:
- ✅ Uses same database tables
- ✅ Stores data in same format
- ✅ Works with existing API endpoints
- ✅ Frontend receives same data structure

The frontend will automatically see the new topics and queries when fetching from the database.

---

## 🧪 Testing

### Test New Approach

1. Set environment variable:
   ```bash
   export USE_NEW_TOPICS_QUERY_GENERATION=true
   ```

2. Create a new brand via onboarding API (without providing topics)

3. Check logs for:
   - `🚀 Using NEW topics+queries generation approach`
   - `✅ New approach: Generated X topics with queries`

4. Verify in database:
   - Topics in `brand_topics` table
   - Queries in `generated_queries` table
   - Metadata contains intent archetypes

### Test Original Approach

1. Unset or set to false:
   ```bash
   export USE_NEW_TOPICS_QUERY_GENERATION=false
   ```

2. Create a new brand

3. Should use original flow (topics from brand intel, then query generation)

---

## 📝 Key Features

### Improvements in New Approach

1. **Better Alignment**: Topics and queries generated together ensures perfect matching
2. **More Structured**: 10 intent archetypes vs 4 categories
3. **Flexible Count**: 3-7 topics per intent (not fixed 5)
4. **Smart Filtering**: Automatically filters to top 15-20 most relevant topics
5. **Priority Scoring**: Each topic has priority (1-5) for ranking
6. **Simpler Input**: Only needs brand name (uses context if available)

### Backward Compatibility

- ✅ Original approach still works
- ✅ Feature flag controls which approach to use
- ✅ Existing brands unaffected
- ✅ Frontend requires no changes
- ✅ Database schema unchanged (uses metadata for new fields)

---

## 🐛 Troubleshooting

### New approach not activating?

1. Check environment variable is set: `USE_NEW_TOPICS_QUERY_GENERATION=true`
2. Check logs for feature flag status
3. Verify no topics were provided in onboarding request
4. Check Cerebras API key is configured

### Errors storing topics/queries?

1. Check database schema matches expected structure
2. Verify `brand_topics` and `generated_queries` tables exist
3. Check foreign key constraints (brand_id, customer_id)
4. Review error logs for specific database errors

### LLM response parsing errors?

1. Check Cerebras API response in logs
2. Verify JSON structure matches expected format
3. Check max_tokens is sufficient (currently 4000)
4. Review prompt for clarity

---

## 📚 Files Modified

1. ✅ `backend/src/services/topics-query-generation.service.ts` (NEW)
2. ✅ `backend/src/services/onboarding-intel.service.ts` (MODIFIED)
3. ✅ `backend/src/services/brand.service.ts` (MODIFIED)

## 📚 Files NOT Modified (Original Intact)

- ✅ `backend/src/services/query-generation.service.ts` (ORIGINAL - untouched)
- ✅ All frontend files (no changes needed)
- ✅ Database migrations (uses existing schema)

---

## 🎯 Next Steps

1. **Test the new approach** with a few brands
2. **Compare results** with original approach
3. **Gather feedback** on topic quality and relevance
4. **Adjust filtering/ranking** if needed
5. **Consider making it default** if results are better

---

## 💡 Future Enhancements

- Add API endpoint to test new approach independently
- Add UI toggle in frontend to choose approach
- Add metrics to compare both approaches
- Fine-tune topic filtering algorithm
- Add support for custom intent archetypes
