# Topic Category Source and Database Queries

## Where Categories Come From

### Current Implementation
**Categories are stored in the `topic_configuration_topics` table** (NEW versioning system), NOT from previous database tables like `brand_topics`.

### Flow:
1. **Storage**: When creating a topic configuration version, categories are stored in:
   - Table: `topic_configuration_topics`
   - Column: `category` (TEXT, nullable)
   - See: `backend/src/services/topic-configuration.service.ts:320`

2. **Retrieval**: When reading topic configurations:
   - Categories are fetched from `topic_configuration_topics` table
   - See: `backend/src/services/topic-configuration.service.ts:44` and `backend/src/services/topic-configuration.service.ts:247-271`

3. **Mapping**: The `mapTopicRow` function extracts category:
   ```typescript
   category: row.category || null
   ```

### Why Topics Show "General"
- If `category` is `null` or `undefined` in `topic_configuration_topics` table, the UI defaults to "General"
- This happens when topics are created without categories or categories weren't set during initial configuration

---

## Database Queries to Check Data

### 1. Check if topic_configurations table exists and has data
```sql
-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'topic_configurations'
);

-- Count configurations
SELECT COUNT(*) as config_count 
FROM public.topic_configurations;

-- List all configurations with their versions
SELECT 
  id, 
  brand_id, 
  customer_id, 
  version, 
  is_active, 
  change_type,
  created_at,
  created_by
FROM public.topic_configurations
ORDER BY brand_id, customer_id, version DESC;
```

### 2. Check topic_configuration_topics table for categories
```sql
-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'topic_configuration_topics'
);

-- See all topics with their categories
SELECT 
  tct.id,
  tct.configuration_id,
  tct.topic_name,
  tct.category,  -- This is where categories are stored!
  tct.source,
  tct.relevance,
  tc.version,
  tc.is_active
FROM public.topic_configuration_topics tct
JOIN public.topic_configurations tc ON tct.configuration_id = tc.id
ORDER BY tc.version DESC, tct.topic_name;

-- Count topics by category
SELECT 
  category,
  COUNT(*) as topic_count
FROM public.topic_configuration_topics
WHERE category IS NOT NULL
GROUP BY category
ORDER BY topic_count DESC;

-- Find topics with NULL categories (these show as "General")
SELECT 
  tct.topic_name,
  tc.version,
  tc.brand_id,
  tc.customer_id
FROM public.topic_configuration_topics tct
JOIN public.topic_configurations tc ON tct.configuration_id = tc.id
WHERE tct.category IS NULL
ORDER BY tc.version DESC;
```

### 3. Check foreign key constraint (created_by issue)
```sql
-- Check if foreign key constraint exists (it shouldn't after applying fix migration)
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conname IN ('topic_configurations_created_by_fkey', 'topic_change_log_changed_by_fkey');

-- Check created_by values (should be UUIDs or NULL, no validation needed since no foreign key)
SELECT 
  created_by,
  COUNT(*) as count
FROM public.topic_configurations
GROUP BY created_by
ORDER BY count DESC;
```

### 5. Update topics with missing categories (if needed)
```sql
-- Example: Set a default category for topics with NULL category
-- (Only run this if you want to set a default, otherwise set specific categories)
UPDATE public.topic_configuration_topics
SET category = 'awareness'  -- or another valid category
WHERE category IS NULL;

-- Verify the update
SELECT 
  category,
  COUNT(*) as count
FROM public.topic_configuration_topics
GROUP BY category;
```

### 5. Check current active configuration
```sql
-- Get current active configuration with all topics and categories
SELECT 
  tc.id as config_id,
  tc.version,
  tc.brand_id,
  tc.customer_id,
  tct.topic_name,
  tct.category,
  tct.source,
  tct.relevance
FROM public.topic_configurations tc
JOIN public.topic_configuration_topics tct ON tct.configuration_id = tc.id
WHERE tc.is_active = true
ORDER BY tc.brand_id, tc.customer_id, tct.topic_name;
```

---

## Fixing the Foreign Key Error

### Problem
The error `insert or update on table "topic_configurations" violates foreign key constraint "topic_configurations_created_by_fkey"` occurred because:
- The migration was trying to reference `public.users(id)` as a foreign key
- But **there is no users table** in this database schema
- The hierarchy is: **Customer → Brand** (not Customer → Brand → User)

### Solution
1. **Fixed the original migration** (`20251127000010_create_topic_versioning_tables.sql`):
   - Removed the foreign key constraint: `REFERENCES public.users(id)`
   - Changed to: `created_by UUID` (no foreign key)

2. **Created a fix migration** (`20251127000011_fix_topic_configurations_foreign_key.sql`):
   - Drops the existing foreign key constraint if the table already exists
   - This migration should be run if you already applied the original migration

3. **Backend code** (already correct):
   - Uses `created_by: userId || null` which is fine since there's no validation needed

### Apply the Fix Migration
If you already have the `topic_configurations` table with the foreign key constraint, run:
```sql
-- This is already in the fix migration file
ALTER TABLE IF EXISTS public.topic_configurations
  DROP CONSTRAINT IF EXISTS topic_configurations_created_by_fkey;

ALTER TABLE IF EXISTS public.topic_change_log
  DROP CONSTRAINT IF EXISTS topic_change_log_changed_by_fkey;
```

---

## Summary

1. **Categories are stored in**: `topic_configuration_topics.category`
2. **Categories are fetched from**: `topic_configuration_topics.category` (when reading configurations)
3. **If category is NULL**: UI shows "General" as default
4. **Foreign key issue**: Fixed - removed invalid foreign key constraint to non-existent `users` table
5. **Database Hierarchy**: Customer (top level) → Brand (under customer) - No users table

