/*
  # Add CASCADE DELETE to collector_results.brand_id and extracted_positions.brand_id foreign keys

  ## Problem
  When a brand is deleted from the brands table, related rows in collector_results
  and extracted_positions are not automatically deleted, leaving orphaned records.

  ## Solution
  This migration ensures that when a brand is deleted, all related collector_results
  and extracted_positions are automatically deleted via CASCADE DELETE.

  ## Changes
  1. Drop existing foreign key constraints on collector_results.brand_id and extracted_positions.brand_id if they exist (without CASCADE)
  2. Clean up orphaned records (rows where brand_id doesn't exist in brands table)
  3. Add new foreign key constraints with ON DELETE CASCADE
  4. Ensure proper indexing for performance
*/

-- ============================================================================
-- Step 1: Drop existing foreign key constraints (if any) to allow cleanup
-- ============================================================================

-- Drop existing constraints on collector_results
DO $$
DECLARE
    constraint_name text;
    brand_id_attnum smallint;
BEGIN
    -- Get the attribute number for brand_id
    SELECT attnum INTO brand_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'public.collector_results'::regclass
      AND attname = 'brand_id';

    -- Find the foreign key constraint name for collector_results.brand_id -> brands.id
    IF brand_id_attnum IS NOT NULL THEN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'public.collector_results'::regclass
          AND confrelid = 'public.brands'::regclass
          AND contype = 'f'
          AND conkey = ARRAY[brand_id_attnum];

        -- If constraint exists, drop it
        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.collector_results DROP CONSTRAINT IF EXISTS %I', constraint_name);
            RAISE NOTICE 'Dropped existing foreign key constraint: %', constraint_name;
        END IF;
    END IF;
END $$;

-- Drop existing constraints on extracted_positions
DO $$
DECLARE
    constraint_name text;
    brand_id_attnum smallint;
BEGIN
    -- Get the attribute number for brand_id
    SELECT attnum INTO brand_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'public.extracted_positions'::regclass
      AND attname = 'brand_id';

    -- Find the foreign key constraint name for extracted_positions.brand_id -> brands.id
    IF brand_id_attnum IS NOT NULL THEN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'public.extracted_positions'::regclass
          AND confrelid = 'public.brands'::regclass
          AND contype = 'f'
          AND conkey = ARRAY[brand_id_attnum];

        -- If constraint exists, drop it
        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.extracted_positions DROP CONSTRAINT IF EXISTS %I', constraint_name);
            RAISE NOTICE 'Dropped existing foreign key constraint: %', constraint_name;
        END IF;
    END IF;
END $$;

-- Also drop constraints by name if they exist (in case the above didn't catch them)
ALTER TABLE public.collector_results
  DROP CONSTRAINT IF EXISTS collector_results_brand_id_fkey;

ALTER TABLE public.extracted_positions
  DROP CONSTRAINT IF EXISTS extracted_positions_brand_id_fkey;

-- ============================================================================
-- Step 2: Clean up orphaned records (where brand_id doesn't exist in brands table)
-- ============================================================================

-- Delete orphaned records from collector_results
DO $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.collector_results
    WHERE brand_id IS NOT NULL
      AND brand_id NOT IN (SELECT id FROM public.brands);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % orphaned records from collector_results', deleted_count;
END $$;

-- Delete orphaned records from extracted_positions
DO $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.extracted_positions
    WHERE brand_id IS NOT NULL
      AND brand_id NOT IN (SELECT id FROM public.brands);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % orphaned records from extracted_positions', deleted_count;
END $$;

-- ============================================================================
-- Step 3: Add foreign key constraints with CASCADE DELETE
-- ============================================================================
-- Fix collector_results.brand_id foreign key
-- ============================================================================

DO $$
DECLARE
    constraint_name text;
    brand_id_attnum smallint;
BEGIN
    -- Get the attribute number for brand_id
    SELECT attnum INTO brand_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'public.collector_results'::regclass
      AND attname = 'brand_id';

    -- Find the foreign key constraint name for collector_results.brand_id -> brands.id
    IF brand_id_attnum IS NOT NULL THEN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'public.collector_results'::regclass
          AND confrelid = 'public.brands'::regclass
          AND contype = 'f'
          AND conkey = ARRAY[brand_id_attnum];

        -- If constraint exists, drop it
        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.collector_results DROP CONSTRAINT IF EXISTS %I', constraint_name);
            RAISE NOTICE 'Dropped existing foreign key constraint: %', constraint_name;
        ELSE
            RAISE NOTICE 'No existing foreign key constraint found on collector_results.brand_id';
        END IF;
    END IF;
END $$;

-- Add foreign key constraint with CASCADE DELETE for collector_results
ALTER TABLE public.collector_results
  ADD CONSTRAINT collector_results_brand_id_fkey
  FOREIGN KEY (brand_id)
  REFERENCES public.brands(id)
  ON DELETE CASCADE;

-- Ensure there's an index on brand_id for performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_collector_results_brand_id 
  ON public.collector_results(brand_id)
  WHERE brand_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON CONSTRAINT collector_results_brand_id_fkey ON public.collector_results IS 
  'Foreign key to brands table. When a brand is deleted, all related collector_results are automatically deleted via CASCADE.';

-- ============================================================================
-- Fix extracted_positions.brand_id foreign key
-- ============================================================================

-- Add foreign key constraint with CASCADE DELETE for extracted_positions
ALTER TABLE public.extracted_positions
  ADD CONSTRAINT extracted_positions_brand_id_fkey
  FOREIGN KEY (brand_id)
  REFERENCES public.brands(id)
  ON DELETE CASCADE;

-- Ensure there's an index on brand_id for performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_extracted_positions_brand_id 
  ON public.extracted_positions(brand_id)
  WHERE brand_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON CONSTRAINT extracted_positions_brand_id_fkey ON public.extracted_positions IS 
  'Foreign key to brands table. When a brand is deleted, all related extracted_positions are automatically deleted via CASCADE.';
