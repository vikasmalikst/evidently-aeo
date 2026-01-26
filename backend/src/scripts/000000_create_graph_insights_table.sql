-- Create a table to store Graph Algorithm Snapshots for accountability
CREATE TABLE IF NOT EXISTS recommendations_v3_graph_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- The full result of the PageRank/quadrant calculation (X/Y coords, Strength)
    keyword_quadrant_data JSONB DEFAULT '[]'::JSONB,
    
    -- Specific Insights found by the graph (Opportunity Gaps, Battlegrounds, etc.)
    -- These are what feed the Recommendation Prompt
    opportunity_gaps JSONB DEFAULT '[]'::JSONB,
    battlegrounds JSONB DEFAULT '[]'::JSONB,
    strongholds JSONB DEFAULT '[]'::JSONB,
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'recommendation_engine', -- 'recommendation_engine' or 'manual_analysis'
    generation_id UUID -- Optional link to a specific recommendation generation run
);

-- Index for fast retrieval by brand
CREATE INDEX IF NOT EXISTS idx_graph_insights_brand_id ON recommendations_v3_graph_insights(brand_id);
CREATE INDEX IF NOT EXISTS idx_graph_insights_created_at ON recommendations_v3_graph_insights(created_at);
