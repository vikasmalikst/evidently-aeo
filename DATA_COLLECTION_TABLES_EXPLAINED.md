# Data Collection - Tables Queried

## When You Click "Collect Data Now" or "Collect & Score"

The backend queries the following table to find queries to execute:

### Primary Table: `generated_queries`

**Query executed:**
```sql
SELECT id, query_text, topic, intent, locale, country
FROM generated_queries
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
  AND is_active = true;
```

**Required columns:**
- `id` - Query ID
- `query_text` - The actual query text to execute
- `topic` - Topic name (optional)
- `intent` - Query intent (optional, defaults to 'data_collection')
- `locale` - Locale (optional, defaults to 'en-US')
- `country` - Country (optional, defaults to 'US')
- `brand_id` - Must match your brand ID
- `customer_id` - Must match your customer ID
- `is_active` - **MUST be `true`** (this is why you're getting "No active queries found")

## Why You're Getting "No Active Queries Found"

The query is looking for records in `generated_queries` where:
1. `brand_id` = your brand ID ✅
2. `customer_id` = your customer ID ✅
3. `is_active` = `true` ❌ **This is likely the issue!**

## How to Check Your Data

Run this SQL query in your Supabase SQL Editor:

```sql
-- Check if queries exist for your brand
SELECT 
  id,
  query_text,
  topic,
  intent,
  locale,
  country,
  brand_id,
  customer_id,
  is_active,
  created_at
FROM generated_queries
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
ORDER BY created_at DESC;
```

**What to look for:**
- If **no rows returned**: Queries were never created during onboarding
- If **rows exist but `is_active = false`**: Queries exist but are inactive
- If **rows exist with `is_active = true`**: Queries should work!

## How to Fix

### Option 1: Activate Existing Queries

If queries exist but are inactive:

```sql
-- Activate all queries for your brand
UPDATE generated_queries
SET is_active = true
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77';
```

### Option 2: Create Queries Manually

If no queries exist, you need to create them. Queries are typically created during onboarding, but you can create them manually:

```sql
-- Example: Create a test query
INSERT INTO generated_queries (
  id,
  generation_id,  -- You may need to create a query_generations record first
  query_text,
  intent,
  brand_id,
  customer_id,
  locale,
  country,
  is_active
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM query_generations WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea' LIMIT 1),
  'What is YouTube?',
  'data_collection',
  '838ba1a6-3dec-433d-bea9-a9bc278969ea',
  '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
  'en-US',
  'US',
  true
);
```

### Option 3: Re-run Onboarding

The proper way is to ensure onboarding completed successfully, which should have created queries in `generated_queries` with `is_active = true`.

## Complete Data Flow

### 1. Onboarding Flow (Creates Queries)
```
User completes onboarding
  ↓
Topics selected
  ↓
Queries generated
  ↓
INSERT INTO generated_queries (..., is_active = true)
```

### 2. Data Collection Flow (Uses Queries)
```
Click "Collect Data Now"
  ↓
Backend queries: SELECT * FROM generated_queries WHERE is_active = true
  ↓
For each query: Execute across collectors
  ↓
INSERT INTO collector_results
```

### 3. Scoring Flow (Uses Collector Results)
```
Click "Score Now"
  ↓
Backend queries: SELECT * FROM collector_results WHERE brand_id = ...
  ↓
Extract positions → INSERT INTO extracted_positions
  ↓
Score sentiments → UPDATE collector_results
  ↓
Extract citations → INSERT INTO citations
```

## Related Tables

### Tables Used During Data Collection:

1. **`generated_queries`** - Source of queries to execute
   - Must have `is_active = true`
   - Must match `brand_id` and `customer_id`

2. **`query_executions`** - Tracks execution status
   - Created automatically during collection
   - Status: pending → running → completed/failed

3. **`collector_results`** - Stores collected data
   - Created after successful collection
   - Contains: raw_answer, citations, urls, etc.

### Tables Used During Scoring:

1. **`collector_results`** - Source data to score
   - Must have `brand_id` and `customer_id`

2. **`extracted_positions`** - Stores extracted brand positions
   - Created during position extraction

3. **`citations`** - Stores extracted citations
   - Created during citation extraction

## Quick Diagnostic Query

Run this to see everything about your brand's data:

```sql
-- Complete diagnostic query
SELECT 
  'Brand Info' as section,
  b.id as brand_id,
  b.name as brand_name,
  b.customer_id
FROM brands b
WHERE b.id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'

UNION ALL

SELECT 
  'Active Queries' as section,
  COUNT(*)::text as count,
  NULL as brand_name,
  NULL as customer_id
FROM generated_queries
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
  AND is_active = true

UNION ALL

SELECT 
  'Inactive Queries' as section,
  COUNT(*)::text as count,
  NULL as brand_name,
  NULL as customer_id
FROM generated_queries
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77'
  AND is_active = false

UNION ALL

SELECT 
  'Collector Results' as section,
  COUNT(*)::text as count,
  NULL as brand_name,
  NULL as customer_id
FROM collector_results
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '8ce361f9-6120-4c64-a441-5ec33a1dfc77';
```

## Summary

**The backend queries `generated_queries` table with:**
- `brand_id` = your brand ID
- `customer_id` = your customer ID  
- `is_active` = `true` ⚠️ **This is the key requirement!**

**To fix:**
1. Check if queries exist: Run the diagnostic query above
2. If queries exist but `is_active = false`: Update them to `true`
3. If no queries exist: Re-run onboarding or create them manually

