-- Add query_id to recommendations table to link back to the source query
-- Note: generated_queries PK is "id", not "query_id"
ALTER TABLE "recommendations" 
ADD COLUMN IF NOT EXISTS "query_id" uuid REFERENCES "generated_queries" ("id") ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_recommendations_query_id ON recommendations(query_id);
