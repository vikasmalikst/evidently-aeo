-- SQL Query to Calculate Brand Presence (Answer Frequency) for Competitors

-- 1. Get the Total Universe (Total AI Responses Analyzed for this Brand)
-- Replace 'YOUR_BRAND_ID' with the actual Brand ID
WITH Universe AS (
    SELECT COUNT(id) as total_responses
    FROM metric_facts
    WHERE brand_id = '5ce3fc1c-24c6-4434-a76e-72ad159030e9'
),

-- 2. Count Competitor Appearances
-- We count rows in competitor_metrics where they have some visibility or share
CompetitorStats AS (
    SELECT 
        bc.competitor_name,
        COUNT(cm.id) as appearance_count
    FROM metric_facts mf
    JOIN competitor_metrics cm ON mf.id = cm.metric_fact_id
    JOIN brand_competitors bc ON cm.competitor_id = bc.id
    WHERE mf.brand_id = '5ce3fc1c-24c6-4434-a76e-72ad159030e9'
    -- Criteria for "Presence": Visibility > 0 OR Share > 0 OR Mentions > 0
    -- Adjust this check based on your strict definition of "Presence"
    AND (cm.visibility_index > 0 OR cm.share_of_answers > 0)
    GROUP BY bc.competitor_name
)

-- 3. Calculate Percentage
SELECT 
    cs.competitor_name,
    cs.appearance_count,
    u.total_responses,
    ROUND((cs.appearance_count::DECIMAL / NULLIF(u.total_responses, 0)) * 100, 2) as brand_presence_percentage
FROM CompetitorStats cs
CROSS JOIN Universe u
ORDER BY brand_presence_percentage DESC;
