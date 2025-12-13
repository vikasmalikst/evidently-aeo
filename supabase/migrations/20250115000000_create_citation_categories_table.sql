/*
  # Create Citation Categories Cache Table
  
  This migration creates a table to cache citation categorizations by domain/URL
  to avoid redundant LLM API calls for the same domains.
  
  ## New Table
  
  ### `citation_categories`
  - `id` (uuid, primary key) - Unique identifier
  - `customer_id` (uuid, nullable) - Customer ID (for multi-tenant isolation)
  - `brand_id` (uuid, nullable) - Brand ID (for brand-specific categorization if needed)
  - `cited_url` (text) - Full citation URL
  - `domain` (text) - Extracted domain from URL
  - `category` (text) - Citation category (Editorial, Corporate, Reference, UGC, Social, Institutional)
  - `page_name` (text, nullable) - Extracted page name
  - `created_at` (timestamptz) - When the categorization was first cached
  - `updated_at` (timestamptz) - Last update timestamp
  
  ## Indexes
  - Index on `domain` for fast lookups (most common query)
  - Index on `cited_url` for exact URL matches
  - Composite index on `customer_id, brand_id, domain` for tenant-specific lookups
  - Unique constraint on `domain` to prevent duplicates (since categorization is domain-based)
*/

-- Create citation_categories table
CREATE TABLE IF NOT EXISTS public.citation_categories (
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
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_citation_categories_domain 
  ON public.citation_categories(domain);

CREATE INDEX IF NOT EXISTS idx_citation_categories_cited_url 
  ON public.citation_categories(cited_url);

CREATE INDEX IF NOT EXISTS idx_citation_categories_customer_brand_domain 
  ON public.citation_categories(customer_id, brand_id, domain) 
  WHERE customer_id IS NOT NULL AND brand_id IS NOT NULL;

-- Unique constraint on domain (since categorization is domain-based, same domain = same category)
-- Note: We use domain as unique key since categorization is domain-based, not URL-based
CREATE UNIQUE INDEX IF NOT EXISTS idx_citation_categories_domain_unique 
  ON public.citation_categories(domain);

-- Add foreign key constraints (optional, for referential integrity)
-- These are commented out in case brands/customers can be deleted
-- ALTER TABLE public.citation_categories
--   ADD CONSTRAINT fk_citation_categories_customer 
--   FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- ALTER TABLE public.citation_categories
--   ADD CONSTRAINT fk_citation_categories_brand 
--   FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;

-- Enable Row Level Security (optional, for multi-tenant isolation)
ALTER TABLE public.citation_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all records
CREATE POLICY "Service role can manage citation categories"
  ON public.citation_categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Authenticated users can read their own customer's records
CREATE POLICY "Users can read own customer citation categories"
  ON public.citation_categories FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_citation_categories_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_citation_categories_updated_at ON public.citation_categories;
CREATE TRIGGER update_citation_categories_updated_at
  BEFORE UPDATE ON public.citation_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_citation_categories_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.citation_categories IS 
  'Caches citation categorizations by domain to avoid redundant LLM API calls. Categories are domain-based, so same domain always has same category.';

COMMENT ON COLUMN public.citation_categories.domain IS 
  'Extracted domain from URL (e.g., "techcrunch.com"). Used as primary lookup key.';

COMMENT ON COLUMN public.citation_categories.cited_url IS 
  'Full citation URL. Stored for reference but categorization is domain-based.';

COMMENT ON COLUMN public.citation_categories.category IS 
  'Citation category: Editorial, Corporate, Reference, UGC, Social, or Institutional.';
