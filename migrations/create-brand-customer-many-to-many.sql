/*
  # Create Many-to-Many Relationship Between Brands and Customers
  
  This migration creates a junction table to allow a single brand to be 
  associated with multiple customers.
  
  ## IMPORTANT CONSIDERATIONS:
  
  1. **Breaking Change**: This fundamentally changes the data model
  2. **Application Code**: All queries filtering by customer_id will need updates
  3. **Data Migration**: Existing brands will need entries in the junction table
  4. **Backward Compatibility**: Consider keeping customer_id on brands for migration period
  
  ## Approach Options:
  
  ### Option A: Pure Junction Table (Recommended for new implementations)
  - Remove customer_id from brands table
  - Use only brand_customers junction table
  - Requires full application rewrite
  
  ### Option B: Hybrid Approach (Recommended for existing systems)
  - Keep customer_id on brands as "primary owner"
  - Add brand_customers for additional access
  - Gradual migration path
  
  This script implements Option B (Hybrid) for safer migration.
*/

-- ============================================================================
-- STEP 1: Create Junction Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brand_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Relationship metadata
  is_primary_owner BOOLEAN NOT NULL DEFAULT false,  -- Marks the primary customer
  access_level TEXT NOT NULL DEFAULT 'full' CHECK (access_level IN ('full', 'read_only', 'limited')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one brand can only have one primary owner
  CONSTRAINT unique_primary_owner_per_brand UNIQUE (brand_id, is_primary_owner) 
    DEFERRABLE INITIALLY DEFERRED,
  
  -- Prevent duplicate brand-customer pairs
  CONSTRAINT unique_brand_customer_pair UNIQUE (brand_id, customer_id)
);

-- ============================================================================
-- STEP 2: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_brand_customers_brand_id 
  ON public.brand_customers(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_customers_customer_id 
  ON public.brand_customers(customer_id);

CREATE INDEX IF NOT EXISTS idx_brand_customers_primary_owner 
  ON public.brand_customers(brand_id, is_primary_owner) 
  WHERE is_primary_owner = true;

-- ============================================================================
-- STEP 3: Migrate Existing Data
-- ============================================================================
-- This populates the junction table with existing brand-customer relationships

INSERT INTO public.brand_customers (brand_id, customer_id, is_primary_owner, access_level)
SELECT 
  id as brand_id,
  customer_id,
  true as is_primary_owner,  -- Mark existing customer as primary owner
  'full' as access_level
FROM public.brands
WHERE customer_id IS NOT NULL
ON CONFLICT (brand_id, customer_id) DO NOTHING;

-- ============================================================================
-- STEP 4: Create Helper Functions
-- ============================================================================

-- Function to get all customers for a brand
CREATE OR REPLACE FUNCTION get_brand_customers(p_brand_id UUID)
RETURNS TABLE (
  customer_id UUID,
  is_primary_owner BOOLEAN,
  access_level TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bc.customer_id,
    bc.is_primary_owner,
    bc.access_level,
    bc.created_at
  FROM public.brand_customers bc
  WHERE bc.brand_id = p_brand_id
  ORDER BY bc.is_primary_owner DESC, bc.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get all brands for a customer
CREATE OR REPLACE FUNCTION get_customer_brands(p_customer_id UUID)
RETURNS TABLE (
  brand_id UUID,
  is_primary_owner BOOLEAN,
  access_level TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bc.brand_id,
    bc.is_primary_owner,
    bc.access_level,
    bc.created_at
  FROM public.brand_customers bc
  WHERE bc.customer_id = p_customer_id
  ORDER BY bc.is_primary_owner DESC, bc.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if customer has access to brand
CREATE OR REPLACE FUNCTION customer_has_brand_access(
  p_customer_id UUID,
  p_brand_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.brand_customers 
    WHERE customer_id = p_customer_id 
      AND brand_id = p_brand_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Add RLS Policies (if using Row Level Security)
-- ============================================================================

ALTER TABLE public.brand_customers ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can view their own brand relationships
CREATE POLICY "Customers can view own brand relationships"
  ON public.brand_customers FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers 
      WHERE id = (SELECT customer_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Policy: Only primary owners can modify relationships
CREATE POLICY "Primary owners can manage brand relationships"
  ON public.brand_customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_customers bc
      INNER JOIN public.users u ON u.customer_id = bc.customer_id
      WHERE bc.brand_id = brand_customers.brand_id
        AND bc.is_primary_owner = true
        AND u.id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Create View for Backward Compatibility
-- ============================================================================
-- This view helps maintain backward compatibility during migration

CREATE OR REPLACE VIEW public.brands_with_customers AS
SELECT 
  b.*,
  bc.customer_id as primary_customer_id,  -- For backward compatibility
  array_agg(bc.customer_id) FILTER (WHERE bc.customer_id IS NOT NULL) as all_customer_ids,
  count(bc.customer_id) as customer_count
FROM public.brands b
LEFT JOIN public.brand_customers bc ON bc.brand_id = b.id
GROUP BY b.id, bc.customer_id, bc.is_primary_owner
HAVING bc.is_primary_owner = true OR bc.is_primary_owner IS NULL;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

/*
-- Add a customer to an existing brand
INSERT INTO public.brand_customers (brand_id, customer_id, is_primary_owner, access_level)
VALUES ('brand-uuid', 'customer-uuid', false, 'full')
ON CONFLICT (brand_id, customer_id) DO UPDATE
SET access_level = EXCLUDED.access_level;

-- Get all customers for a brand
SELECT * FROM get_brand_customers('brand-uuid');

-- Get all brands for a customer
SELECT * FROM get_customer_brands('customer-uuid');

-- Check if customer has access
SELECT customer_has_brand_access('customer-uuid', 'brand-uuid');

-- Remove a customer from a brand (only primary owner can do this)
DELETE FROM public.brand_customers
WHERE brand_id = 'brand-uuid' 
  AND customer_id = 'customer-uuid'
  AND is_primary_owner = false;  -- Can't delete primary owner this way
*/

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

/*
-- To rollback this migration:
DROP VIEW IF EXISTS public.brands_with_customers;
DROP FUNCTION IF EXISTS customer_has_brand_access(UUID, UUID);
DROP FUNCTION IF EXISTS get_customer_brands(UUID);
DROP FUNCTION IF EXISTS get_brand_customers(UUID);
DROP TABLE IF EXISTS public.brand_customers;
*/

