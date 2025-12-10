/*
  # Add Citation Category to Recommendations
  
  This migration adds a citation_category column to the recommendations table
  to categorize recommendations based on citation source categories:
  - Priority Partnerships
  - Reputation Management
  - Growth Opportunities
  - Monitor
*/

-- Add citation_category column to recommendations table
ALTER TABLE public.recommendations
ADD COLUMN IF NOT EXISTS citation_category TEXT CHECK (
  citation_category IN (
    'Priority Partnerships',
    'Reputation Management',
    'Growth Opportunities',
    'Monitor'
  )
);

-- Add index for fast filtering by category
CREATE INDEX IF NOT EXISTS idx_recommendations_citation_category 
  ON public.recommendations(citation_category);

-- Add comment for documentation
COMMENT ON COLUMN public.recommendations.citation_category IS 
  'Categorizes recommendation based on citation source strategy: Priority Partnerships (high authority + coverage gap), Reputation Management (negative sentiment + high visibility), Growth Opportunities (emerging opportunities), Monitor (stable/low-risk)';
