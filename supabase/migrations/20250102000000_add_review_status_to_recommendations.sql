/*
  # Add Review Status to Recommendations
  
  Adds review_status column to recommendations table for Step 1 review workflow.
  Values: 'pending_review' (default), 'approved', 'rejected'
*/

-- Add review_status column with default value
ALTER TABLE public.recommendations 
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending_review' 
  CHECK (review_status IN ('pending_review', 'approved', 'rejected'));

-- Update existing recommendations: if is_approved = true, set review_status = 'approved'
UPDATE public.recommendations 
  SET review_status = 'approved' 
  WHERE is_approved = true AND review_status = 'pending_review';

-- Create index for filtering by review_status
CREATE INDEX IF NOT EXISTS idx_recommendations_review_status 
  ON public.recommendations(review_status);

-- Create index for filtering by generation_id and review_status (for Step 1 filtering)
CREATE INDEX IF NOT EXISTS idx_recommendations_generation_review_status 
  ON public.recommendations(generation_id, review_status);

