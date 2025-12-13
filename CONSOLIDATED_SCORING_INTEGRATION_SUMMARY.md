# Consolidated Scoring Integration - Summary

## ✅ What Was Implemented

### 1. Consolidated Analysis Service (`consolidated-analysis.service.ts`)
- **Single API call** for products, citations, and sentiment
- **Database caching** for citation categories (checks `citation_categories` table first)
- **Sentiment scores**: 1-100 scale (no positive/negative sentences)
- **Score-to-label mapping**: <55=negative, 55-65=neutral, >65=positive

### 2. Consolidated Scoring Service (`consolidated-scoring.service.ts`)
- **New service** that orchestrates consolidated analysis + database writes
- **Process flow**:
  1. Run consolidated analysis (stores citations, caches products & sentiment)
  2. Run position extraction (uses cached products, calculates character positions)
  3. Store sentiment in `extracted_positions` (after positions exist)

### 3. Brand Scoring Orchestrator Updates (`brand-scoring.orchestrator.ts`)
- **Feature flag**: `USE_CONSOLIDATED_ANALYSIS=true` to enable new approach
- **Automatic fallback**: Uses legacy approach if flag is false
- **New method**: `scoreBrandWithConsolidatedAnalysis()` 

### 4. Database Writes

#### Citations Table
- ✅ `url`, `domain`, `category`, `page_name` from consolidated analysis
- ✅ `customer_id`, `brand_id`, `collector_result_id` from collector result
- ✅ Upsert on conflict (`collector_result_id, url`)

#### Extracted Positions Table
- ✅ **Products**: Used from consolidated analysis cache (via position extraction service)
- ✅ **Positions**: Calculated by position extraction service (character indices)
- ✅ **Sentiment**: Stored from consolidated analysis:
  - `sentiment_label` and `sentiment_score` for brand rows
  - `sentiment_label_competitor` and `sentiment_score_competitor` for competitor rows

#### Citation Categories Table
- ✅ Automatically populated when new domains are categorized
- ✅ Pre-populated with hardcoded domains (via migration)

## 🔄 Processing Flow

```
1. Brand Scoring Orchestrator
   ↓
2. Consolidated Scoring Service
   ↓
3. For each collector_result:
   a. Run Consolidated Analysis
      - Get products (brand + competitors)
      - Categorize citations (check DB cache first)
      - Analyze sentiment (brand + competitors)
      - Store citations in `citations` table
      - Cache results in memory
   ↓
4. Run Position Extraction (batch)
   - Uses cached products from consolidated analysis
   - Calculates character positions
   - Stores positions in `extracted_positions` table
   ↓
5. Store Sentiment
   - Updates `extracted_positions` with sentiment scores
   - Brand rows: sentiment_label, sentiment_score
   - Competitor rows: sentiment_label_competitor, sentiment_score_competitor
```

## 📊 Data Flow

### Consolidated Analysis → Database

**Products**:
- Cached in memory (keyed by `collector_result_id`)
- Used by position extraction service
- Stored in `collector_results.metadata.product_names`

**Citations**:
- Directly inserted into `citations` table
- Category from consolidated analysis
- Domain cached in `citation_categories` table

**Sentiment**:
- Cached in memory (keyed by `collector_result_id`)
- Stored in `extracted_positions` after positions are calculated
- Scores in 1-100 scale

## 🎯 Key Features

### 1. Database Caching
- Citation categories checked in database first
- Hardcoded domains pre-populated
- New domains automatically cached after categorization

### 2. Cost Efficiency
- **Before**: 3-5+ API calls per collector_result
- **After**: 1 API call per collector_result
- **Savings**: ~70-80% reduction in API costs

### 3. Backward Compatibility
- Feature flag allows gradual rollout
- Legacy approach still available
- No breaking changes

## ⚙️ Configuration

### Enable Consolidated Analysis

```bash
# In .env file
USE_CONSOLIDATED_ANALYSIS=true
```

### Run Migrations

```bash
# Create citation_categories table
supabase migration up 20250115000000_create_citation_categories_table.sql

# Populate hardcoded domains
supabase migration up 20250115000001_populate_citation_categories_hardcoded.sql
```

## ✅ Testing Readiness

See `TESTING_READINESS_CHECKLIST.md` for complete testing guide.

### Quick Verification

1. **Check migrations applied**:
   ```sql
   SELECT COUNT(*) FROM citation_categories; -- Should be ~30+
   ```

2. **Check feature flag**:
   ```bash
   echo $USE_CONSOLIDATED_ANALYSIS  # Should be 'true'
   ```

3. **Run brand scoring**:
   ```typescript
   await brandScoringService.scoreBrand({
     brandId: 'test-brand-id',
     customerId: 'test-customer-id',
   });
   ```

4. **Verify data**:
   - Citations have categories
   - Sentiment scores are 1-100
   - Products are extracted
   - Positions are calculated

## 🚀 Ready to Test?

**YES!** If:
- ✅ Migrations applied
- ✅ `USE_CONSOLIDATED_ANALYSIS=true` in `.env`
- ✅ API keys configured
- ✅ Backend can start without errors

See `TESTING_READINESS_CHECKLIST.md` for detailed testing steps.
