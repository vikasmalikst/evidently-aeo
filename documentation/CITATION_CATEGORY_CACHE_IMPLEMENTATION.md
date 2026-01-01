# Citation Category Database Cache Implementation

## Overview

Implemented a database-backed caching system for citation categorization to avoid redundant LLM API calls. The system checks the database first before making any API calls, significantly reducing costs and improving performance.

## What Was Implemented

### 1. Database Migration

**File**: `supabase/migrations/20250115000000_create_citation_categories_table.sql`

Created a new `citation_categories` table with:
- `id` (uuid, primary key)
- `customer_id` (uuid, nullable) - For multi-tenant isolation
- `brand_id` (uuid, nullable) - For brand-specific categorization
- `cited_url` (text) - Full citation URL
- `domain` (text) - Extracted domain (used as primary lookup key)
- `category` (text) - Citation category (Editorial, Corporate, Reference, UGC, Social, Institutional)
- `page_name` (text, nullable) - Extracted page name
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Key Features**:
- Unique constraint on `domain` (since categorization is domain-based)
- Indexes on `domain`, `cited_url`, and composite `(customer_id, brand_id, domain)`
- Row Level Security (RLS) policies for multi-tenant isolation
- Automatic `updated_at` trigger

### 2. Consolidated Analysis Service Updates

**File**: `backend/src/services/scoring/consolidated-analysis.service.ts`

**Changes**:
- Added `customerId` and `brandId` to `ConsolidatedAnalysisOptions` interface
- Added `getCachedCitationCategories()` method to check database cache
- Added `storeCitationCategories()` method to store new categorizations
- Modified `analyze()` method to:
  1. Check database cache first for all citations
  2. Only send uncached citations to LLM
  3. Merge cached and LLM results
  4. Store new categorizations in database

**Flow**:
```
1. Check database cache for all citation domains
2. Separate citations into cached and uncached
3. Build prompt with only uncached citations
4. Call LLM API (reduced payload = lower cost)
5. Merge cached + LLM results
6. Store new categorizations in database
```

### 3. Citation Categorization Service Updates

**File**: `backend/src/services/citations/citation-categorization.service.ts`

**Changes**:
- Added Supabase client initialization
- Updated `categorize()` method to:
  1. Check database cache first
  2. Try hardcoded patterns
  3. Try simple heuristics
  4. Fall back to AI if needed
  5. Store all results in database cache
- Added `getCachedCategory()` method
- Added `storeCategoryInCache()` method
- Updated `processCitation()` to accept `customerId` and `brandId` parameters

**Priority Order**:
1. Database cache (fastest, no API call)
2. Hardcoded patterns (fast, reliable)
3. Simple heuristics (fast, medium confidence)
4. AI categorization (slow, expensive, high confidence)

### 4. Citation Extraction Service Updates

**File**: `backend/src/services/citations/citation-extraction.service.ts`

**Changes**:
- Updated `categorizeWithCache()` to accept and pass `customerId` and `brandId`
- Updated all `processCitation()` calls to pass `customerId` and `brandId` from collector results

## Benefits

### Performance
- **Faster categorization**: Database lookups are much faster than LLM API calls
- **Reduced latency**: No network round-trip for cached domains

### Cost Savings
- **Fewer API calls**: Once a domain is categorized, it never needs an API call again
- **Smaller LLM payloads**: Consolidated analysis only sends uncached citations to LLM

### Accuracy
- **Consistent results**: Same domain always gets same category
- **Preserved hardcoded patterns**: Still uses fast, reliable hardcoded patterns first

## Usage

### Running the Migration

```bash
# Apply the migration
supabase migration up

# Or if using Supabase CLI locally
supabase db push
```

### How It Works

1. **First time a domain is seen**:
   - Checks database → Not found
   - Checks hardcoded patterns → May match
   - If not, checks heuristics → May match
   - If not, calls AI → Gets category
   - Stores in database for future use

2. **Subsequent times**:
   - Checks database → Found! ✅
   - Returns immediately (no API call)

### Example

```typescript
// First call for techcrunch.com
const result1 = await citationCategorizationService.categorize(
  'https://techcrunch.com/article',
  true,
  'customer-123',
  'brand-456'
);
// → Checks DB (not found) → Checks hardcoded (found: Editorial) → Stores in DB

// Second call for any techcrunch.com URL
const result2 = await citationCategorizationService.categorize(
  'https://techcrunch.com/different-article',
  true,
  'customer-123',
  'brand-456'
);
// → Checks DB (found: Editorial) → Returns immediately ✅
```

## Database Schema

```sql
CREATE TABLE citation_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  brand_id uuid,
  cited_url text NOT NULL,
  domain text NOT NULL,
  category text NOT NULL CHECK (
    category IN ('Editorial', 'Corporate', 'Reference', 'UGC', 'Social', 'Institutional')
  ),
  page_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(domain)
);
```

## Monitoring

### Check Cache Hit Rate

```sql
-- Total categorizations
SELECT COUNT(*) FROM citation_categories;

-- Categorizations by source (if you add a source column)
SELECT category, COUNT(*) 
FROM citation_categories 
GROUP BY category;

-- Recent additions
SELECT domain, category, created_at 
FROM citation_categories 
ORDER BY created_at DESC 
LIMIT 10;
```

### Cache Performance

The cache is most effective for:
- **High-traffic domains**: techcrunch.com, forbes.com, etc.
- **Repeated citations**: Same domains appear across multiple collector results
- **Batch processing**: Processing many collector results at once

## Future Enhancements

1. **Cache invalidation**: Add ability to refresh categories if needed
2. **Analytics**: Track cache hit rates and API call savings
3. **Batch lookup**: Optimize for bulk domain lookups
4. **TTL**: Optional time-to-live for categories (if categorization logic changes)

## Testing

After implementing, test with:

1. **New domain**: Should call AI and store in DB
2. **Cached domain**: Should return immediately from DB
3. **Hardcoded domain**: Should use hardcoded pattern and store in DB
4. **Multiple citations**: Should batch check database efficiently

## Notes

- The cache is **domain-based**, not URL-based, since categorization is domain-level
- Same domain always gets same category (enforced by unique constraint)
- Database cache works alongside in-memory cache (faster, but lost on restart)
- All categorizations are stored, regardless of source (hardcoded, heuristics, or AI)
