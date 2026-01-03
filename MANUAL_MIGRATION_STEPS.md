# Manual Migration Steps - Product Mentions

## Execution Order

Run these queries **in order** in your Supabase SQL Editor:

---

## Step 1: Create Helper Function

**Run this FIRST** - Creates the function needed for counting word occurrences:

```sql
CREATE OR REPLACE FUNCTION count_word_occurrences(
  text_to_search TEXT,
  word_to_find TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  word_count INTEGER := 0;
  search_text_lower TEXT;
  word_lower TEXT;
  escaped_word TEXT;
BEGIN
  -- Handle null inputs
  IF text_to_search IS NULL OR word_to_find IS NULL OR LENGTH(TRIM(word_to_find)) = 0 THEN
    RETURN 0;
  END IF;
  
  -- Convert to lowercase for case-insensitive matching
  search_text_lower := LOWER(text_to_search);
  word_lower := LOWER(TRIM(word_to_find));
  
  -- Escape special regex characters in the word
  escaped_word := regexp_replace(word_lower, '([\[\](){}.*+?^$|\\])', '\\\1', 'g');
  
  -- Count occurrences using regexp_matches with word boundaries
  -- \m = word start, \M = word end (PostgreSQL word boundary markers)
  -- This ensures we match whole words only, not partial matches
  SELECT COUNT(*) INTO word_count
  FROM regexp_matches(search_text_lower, '\m' || escaped_word || '\M', 'g');
  
  -- regexp_matches returns NULL if no matches, COUNT(*) returns 0 in that case
  RETURN COALESCE(word_count, 0);
END;
$$;
```

**Expected result**: Function created successfully

---

## Step 2: Update Brand Product Mentions

**Run this SECOND** - Populates `brand_metrics.total_brand_product_mentions`:

```sql
UPDATE public.brand_metrics bm
SET total_brand_product_mentions = COALESCE(
  (
    SELECT SUM(
      count_word_occurrences(
        cr.raw_answer,
        product_name.value::TEXT
      )
    )
    FROM public.metric_facts mf
    INNER JOIN public.collector_results cr ON cr.id = mf.collector_result_id
    INNER JOIN public.consolidated_analysis_cache cac ON cac.collector_result_id = cr.id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(cac.products->'brand', '[]'::jsonb)
    ) AS product_name
    WHERE mf.id = bm.metric_fact_id
  ),
  0
)
WHERE EXISTS (
  SELECT 1
  FROM public.metric_facts mf
  INNER JOIN public.collector_results cr ON cr.id = mf.collector_result_id
  INNER JOIN public.consolidated_analysis_cache cac ON cac.collector_result_id = cr.id
  WHERE mf.id = bm.metric_fact_id
    AND cac.products IS NOT NULL
    AND cac.products->'brand' IS NOT NULL
    AND jsonb_array_length(COALESCE(cac.products->'brand', '[]'::jsonb)) > 0
);
```

**Expected result**: Shows number of rows updated (e.g., "UPDATE 1234")

---

## Step 3: Check Brand Update Results (Optional)

**Run this to see summary**:

```sql
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.brand_metrics
  WHERE total_brand_product_mentions > 0;
  
  RAISE NOTICE '✅ Updated brand_metrics.total_brand_product_mentions for % rows', updated_count;
END $$;
```

**Expected result**: Notice message showing count of rows with product mentions > 0

---

## Step 4: Update Competitor Product Mentions

**Run this THIRD** - Populates `competitor_metrics.total_competitor_product_mentions`:

```sql
UPDATE public.competitor_metrics cm
SET total_competitor_product_mentions = COALESCE(
  (
    SELECT SUM(
      count_word_occurrences(
        cr.raw_answer,
        product_name.value::TEXT
      )
    )
    FROM public.metric_facts mf
    INNER JOIN public.collector_results cr ON cr.id = mf.collector_result_id
    INNER JOIN public.consolidated_analysis_cache cac ON cac.collector_result_id = cr.id
    INNER JOIN public.brand_competitors bc ON bc.id = cm.competitor_id
    -- Find the matching competitor key (case-insensitive) and extract products
    CROSS JOIN LATERAL (
      SELECT jsonb_array_elements_text(
        COALESCE(
          (
            SELECT cac.products->'competitors'->comp_key
            FROM jsonb_object_keys(cac.products->'competitors') AS comp_key
            WHERE LOWER(comp_key) = LOWER(bc.competitor_name)
            LIMIT 1
          ),
          '[]'::jsonb
        )
      ) AS value
    ) AS product_name
    WHERE mf.id = cm.metric_fact_id
      AND cac.products IS NOT NULL
      AND cac.products->'competitors' IS NOT NULL
      -- Ensure competitor exists in the products JSONB
      AND EXISTS (
        SELECT 1
        FROM jsonb_object_keys(cac.products->'competitors') AS comp_key
        WHERE LOWER(comp_key) = LOWER(bc.competitor_name)
      )
  ),
  0
)
WHERE EXISTS (
  SELECT 1
  FROM public.metric_facts mf
  INNER JOIN public.collector_results cr ON cr.id = mf.collector_result_id
  INNER JOIN public.consolidated_analysis_cache cac ON cac.collector_result_id = cr.id
  INNER JOIN public.brand_competitors bc ON bc.id = cm.competitor_id
  WHERE mf.id = cm.metric_fact_id
    AND cac.products IS NOT NULL
    AND cac.products->'competitors' IS NOT NULL
    -- Match competitor name (case-insensitive)
    AND EXISTS (
      SELECT 1
      FROM jsonb_object_keys(cac.products->'competitors') AS comp_key
      WHERE LOWER(comp_key) = LOWER(bc.competitor_name)
    )
);
```

**Expected result**: Shows number of rows updated (e.g., "UPDATE 5678")

---

## Step 5: Check Competitor Update Results (Optional)

**Run this to see summary**:

```sql
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.competitor_metrics
  WHERE total_competitor_product_mentions > 0;
  
  RAISE NOTICE '✅ Updated competitor_metrics.total_competitor_product_mentions for % rows', updated_count;
END $$;
```

**Expected result**: Notice message showing count of rows with product mentions > 0

---

## Step 6: Validation Queries (Optional but Recommended)

### 6a. Brand Metrics Summary

```sql
DO $$
DECLARE
  total_brand_rows INTEGER;
  rows_with_products INTEGER;
  max_product_mentions INTEGER;
  avg_product_mentions NUMERIC;
BEGIN
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE total_brand_product_mentions > 0),
         MAX(total_brand_product_mentions),
         ROUND(AVG(total_brand_product_mentions)::NUMERIC, 2)
  INTO total_brand_rows, rows_with_products, max_product_mentions, avg_product_mentions
  FROM public.brand_metrics;
  
  RAISE NOTICE '📊 Brand Metrics Summary:';
  RAISE NOTICE '   Total rows: %', total_brand_rows;
  RAISE NOTICE '   Rows with product mentions > 0: %', rows_with_products;
  RAISE NOTICE '   Max product mentions: %', max_product_mentions;
  RAISE NOTICE '   Avg product mentions: %', avg_product_mentions;
END $$;
```

### 6b. Competitor Metrics Summary

```sql
DO $$
DECLARE
  total_comp_rows INTEGER;
  rows_with_products INTEGER;
  max_product_mentions INTEGER;
  avg_product_mentions NUMERIC;
BEGIN
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE total_competitor_product_mentions > 0),
         MAX(total_competitor_product_mentions),
         ROUND(AVG(total_competitor_product_mentions)::NUMERIC, 2)
  INTO total_comp_rows, rows_with_products, max_product_mentions, avg_product_mentions
  FROM public.competitor_metrics;
  
  RAISE NOTICE '📊 Competitor Metrics Summary:';
  RAISE NOTICE '   Total rows: %', total_comp_rows;
  RAISE NOTICE '   Rows with product mentions > 0: %', rows_with_products;
  RAISE NOTICE '   Max product mentions: %', max_product_mentions;
  RAISE NOTICE '   Avg product mentions: %', avg_product_mentions;
END $$;
```

---

## Quick Reference: Execution Order

1. ✅ **Step 1**: Create `count_word_occurrences()` function
2. ✅ **Step 2**: Update `brand_metrics.total_brand_product_mentions`
3. ⚠️ **Step 3**: (Optional) Check brand update results
4. ✅ **Step 4**: Update `competitor_metrics.total_competitor_product_mentions`
5. ⚠️ **Step 5**: (Optional) Check competitor update results
6. ⚠️ **Step 6**: (Optional) Run validation queries

---

## Troubleshooting

### If Step 1 fails:
- Check that you have CREATE FUNCTION permissions
- The function should already exist if you run it multiple times (it's `CREATE OR REPLACE`)

### If Step 2 or Step 4 shows "UPDATE 0":
- Check if `consolidated_analysis_cache` has data:
  ```sql
  SELECT COUNT(*) FROM public.consolidated_analysis_cache WHERE products IS NOT NULL;
  ```
- Check if `metric_facts` rows exist:
  ```sql
  SELECT COUNT(*) FROM public.metric_facts;
  ```

### If queries are slow:
- This is normal for large datasets
- The updates may take several minutes
- Consider running during off-peak hours

---

## After Migration

Once all steps complete successfully:
1. ✅ Verify data looks correct using Step 6 validation queries
2. ✅ Update backend code to use the new columns
3. ✅ Test the Prompts page to see product counts

