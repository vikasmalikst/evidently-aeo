# Manage Prompts - Revised Data Model Approach

## Key Insight
The dashboard currently uses `collector_results.question` as the source of prompts, NOT `generated_queries`. Therefore, our versioning system must account for both the **configuration** (what prompts should be tracked) and the **execution** (what prompts are actually being tracked).

---

## Two-Table Model

### Table 1: `generated_queries` - Prompt Configuration (Source of Truth)
**Purpose:** Stores the user's desired prompts that should be tracked.

**Role in System:**
- Modified by users in Manage Prompts page
- Source for data collection service
- Versioned using `prompt_configurations` table
- Defines WHAT should be tracked

**Example Records:**
```
id: uuid-1
query_text: "What are the key features of project management software?"
topic: "Product Features"
brand_id: brand-uuid
is_active: true
```

### Table 2: `collector_results` - Execution Results (What's Being Displayed)
**Purpose:** Stores actual LLM responses to questions.

**Role in System:**
- Created by data collection service
- `question` column contains the actual prompt asked
- Used by dashboard and analytics
- Reflects WHAT is being tracked

**Example Records:**
```
id: 123
query_id: uuid-1  <-- Links back to generated_queries
question: "What are the key features of project management software?"
raw_answer: "Modern project management..."
collector_type: "Claude"
created_at: 2025-11-18
configuration_version: 1  <-- NEW COLUMN NEEDED
```

---

## Critical Addition to Schema

### Update `collector_results` table:
```sql
ALTER TABLE public.collector_results
  ADD COLUMN IF NOT EXISTS configuration_version INTEGER,
  ADD COLUMN IF NOT EXISTS configuration_id UUID REFERENCES public.prompt_configurations(id);

CREATE INDEX idx_collector_results_config_version 
  ON collector_results(brand_id, customer_id, configuration_version);
```

**Why this is critical:**
- Associates each result with the version active at the time
- Enables filtering dashboard by version
- Maintains historical accuracy

---

## Data Flow with Versioning

### 1. Initial Setup (Onboarding)
```
User completes onboarding
  ↓
System saves prompts to generated_queries
  ↓
Create prompt_configurations (Version 1)
  ↓
Create prompt_configuration_snapshots
  ↓
Mark Version 1 as active
```

### 2. First Data Collection
```
Data collection service starts
  ↓
Fetch active version (Version 1)
  ↓
Get prompts from generated_queries WHERE is_active = true
  ↓
Ask LLMs these questions
  ↓
Store in collector_results with:
  - question: "What are the key features..."
  - query_id: uuid-1 (link to generated_queries)
  - configuration_version: 1
  - configuration_id: config-uuid-1
```

### 3. User Edits Prompts
```
User goes to Manage Prompts page
  ↓
Makes changes (add/edit/delete prompts)
  ↓
Click "Preview Impact"
  ↓
System calculates impact based on:
  - Current collector_results data (historical)
  - Projected changes to prompts
  ↓
User clicks "Apply Changes"
  ↓
Transaction:
  1. Update generated_queries (add/edit/delete rows)
  2. Set Version 1 to inactive
  3. Create Version 2 (is_active = true)
  4. Create snapshots for Version 2
  5. Log changes
```

### 4. Subsequent Data Collection
```
Data collection service runs again
  ↓
Fetch active version (NOW Version 2)
  ↓
Get prompts from generated_queries WHERE is_active = true
  ↓
Ask LLMs these NEW/EDITED questions
  ↓
Store in collector_results with:
  - question: "Updated question text..."
  - query_id: uuid-2
  - configuration_version: 2  <-- NEW VERSION
  - configuration_id: config-uuid-2
```

### 5. Dashboard Display
```
User views Dashboard
  ↓
Dashboard queries collector_results
  ↓
Shows results grouped by question
  ↓
Includes data from ALL versions (mixed)
  ↓
User can filter by date range:
  - Nov 1-14: Sees V1 data (historical)
  - Nov 15-onwards: Sees V2 data (current)
```

---

## Revised API Endpoints

### GET `/api/brands/:brandId/prompts/manage`
Returns prompts from `generated_queries` that are active.

**Query:**
```sql
SELECT 
  gq.id,
  gq.query_text as text,
  gq.topic,
  gq.is_active,
  gq.created_at,
  gq.updated_at,
  -- Get latest response from collector_results
  (
    SELECT cr.raw_answer 
    FROM collector_results cr 
    WHERE cr.query_id = gq.id 
      AND cr.brand_id = gq.brand_id
    ORDER BY cr.created_at DESC 
    LIMIT 1
  ) as latest_response,
  -- Get metrics
  (
    SELECT AVG(ep.sentiment_score)
    FROM extracted_positions ep
    WHERE ep.query_id = gq.id
  ) as avg_sentiment,
  (
    SELECT AVG(ep.visibility_index)
    FROM extracted_positions ep
    WHERE ep.query_id = gq.id
  ) as avg_visibility,
  -- Count how many times this prompt was executed
  (
    SELECT COUNT(*)
    FROM collector_results cr
    WHERE cr.query_id = gq.id
      AND cr.created_at >= $startDate
      AND cr.created_at <= $endDate
  ) as volume_count
FROM generated_queries gq
WHERE gq.brand_id = $brandId
  AND gq.customer_id = $customerId
  AND gq.is_active = true
ORDER BY gq.topic, gq.created_at DESC
```

### GET `/api/brands/:brandId/prompts/dashboard`
Returns actual prompts from `collector_results.question` (what's being shown).

**Query:**
```sql
-- Get unique questions that have been asked
SELECT DISTINCT ON (cr.question)
  cr.question as text,
  cr.query_id,
  cr.configuration_version,
  cr.collector_type,
  COUNT(*) OVER (PARTITION BY cr.question) as usage_count,
  FIRST_VALUE(cr.raw_answer) OVER (
    PARTITION BY cr.question 
    ORDER BY cr.created_at DESC
  ) as latest_response
FROM collector_results cr
WHERE cr.brand_id = $brandId
  AND cr.customer_id = $customerId
  AND cr.created_at >= $startDate
  AND cr.created_at <= $endDate
  AND cr.question IS NOT NULL
ORDER BY cr.question, cr.created_at DESC
```

### POST `/api/brands/:brandId/prompts/batch`
Apply changes and create new version.

**Logic:**
```typescript
async function applyBatchChanges(brandId: string, changes: Changes) {
  return await db.transaction(async (trx) => {
    // 1. Get current active version
    const currentVersion = await getCurrentVersion(brandId, trx);
    
    // 2. Apply changes to generated_queries
    for (const added of changes.added) {
      await trx('generated_queries').insert({
        query_text: added.text,
        topic: added.topic,
        brand_id: brandId,
        is_active: true,
      });
    }
    
    for (const removed of changes.removed) {
      await trx('generated_queries')
        .where({ id: removed.id })
        .update({ is_active: false, archived_at: new Date() });
    }
    
    for (const edited of changes.edited) {
      await trx('generated_queries')
        .where({ id: edited.id })
        .update({ 
          query_text: edited.newText,
          topic: edited.topic,
          updated_at: new Date()
        });
    }
    
    // 3. Deactivate current version
    await trx('prompt_configurations')
      .where({ id: currentVersion.id })
      .update({ is_active: false });
    
    // 4. Create new version
    const newVersion = await trx('prompt_configurations').insert({
      brand_id: brandId,
      version: currentVersion.version + 1,
      is_active: true,
      change_type: determineChangeType(changes),
      change_summary: changes.summary,
    }).returning('*');
    
    // 5. Create snapshots
    const activeQueries = await trx('generated_queries')
      .where({ brand_id: brandId, is_active: true });
    
    for (const query of activeQueries) {
      await trx('prompt_configuration_snapshots').insert({
        configuration_id: newVersion[0].id,
        query_id: query.id,
        topic: query.topic,
        query_text: query.query_text,
        is_included: true,
      });
    }
    
    // 6. Log changes
    await logDetailedChanges(newVersion[0].id, changes, trx);
    
    // 7. Calculate metrics
    await calculateVersionMetrics(newVersion[0].id, trx);
    
    return newVersion[0];
  });
}
```

---

## How Manage Prompts Page Works

### Display Current Prompts
```typescript
// Fetch from generated_queries (configuration)
const prompts = await getActivePrompts(brandId);

// For each prompt, get latest data from collector_results
for (const prompt of prompts) {
  const latestResult = await getLatestCollectorResult(prompt.id);
  prompt.response = latestResult?.raw_answer;
  prompt.lastExecuted = latestResult?.created_at;
  
  const metrics = await getPromptMetrics(prompt.id);
  prompt.avgSentiment = metrics.sentiment;
  prompt.avgVisibility = metrics.visibility;
  prompt.volumeCount = metrics.count;
}
```

### View Historical Version
```typescript
// User selects "Version 2" from dropdown
const version2 = await getVersionDetails(brandId, 2);

// Fetch snapshots for this version
const snapshots = await getVersionSnapshots(version2.id);

// Display prompts as they were in Version 2
// (read-only, cannot edit historical versions)
```

### Calculate Impact
```typescript
// User makes changes, clicks "Preview Impact"
async function calculateImpact(currentPrompts, pendingChanges) {
  // 1. Fetch historical data from collector_results
  const historicalData = await getCollectorResultsForActivePrompts();
  
  // 2. Calculate current metrics
  const currentMetrics = {
    coverage: calculateCoverage(currentPrompts),
    avgVisibility: calculateAvgVisibility(historicalData),
    topicDistribution: getTopicDistribution(currentPrompts),
  };
  
  // 3. Project metrics after changes
  const projectedPrompts = applyChangesToPrompts(currentPrompts, pendingChanges);
  const projectedMetrics = {
    coverage: calculateCoverage(projectedPrompts),
    // Visibility can't be predicted (need actual LLM responses)
    avgVisibility: null, // Show "Unknown until collection runs"
    topicDistribution: getTopicDistribution(projectedPrompts),
  };
  
  // 4. Return comparison
  return {
    current: currentMetrics,
    projected: projectedMetrics,
    changes: {
      coverage: projectedMetrics.coverage - currentMetrics.coverage,
      topicsAdded: findNewTopics(projectedPrompts, currentPrompts),
      topicsRemoved: findRemovedTopics(projectedPrompts, currentPrompts),
    },
    warnings: [
      "New prompts will require data collection before metrics are available",
      "Edited prompts will start fresh metric tracking",
    ],
  };
}
```

---

## Dashboard Behavior with Versions

### Default View (All Data)
```sql
-- Shows all results regardless of version
SELECT 
  cr.question,
  cr.raw_answer,
  cr.collector_type,
  cr.configuration_version,
  cr.created_at
FROM collector_results cr
WHERE cr.brand_id = $brandId
  AND cr.created_at >= $startDate
  AND cr.created_at <= $endDate
ORDER BY cr.created_at DESC
```

**Result:** Mixed data from multiple versions
- Question A (from V1): 50 results
- Question B (edited in V2): 30 results from V1, 20 results from V2
- Question C (added in V2): 20 results

### Filter by Version (Optional Feature)
```sql
-- Show only data from specific version
SELECT 
  cr.question,
  cr.raw_answer,
  cr.collector_type,
  cr.created_at
FROM collector_results cr
WHERE cr.brand_id = $brandId
  AND cr.configuration_version = $selectedVersion
  AND cr.created_at >= $startDate
  AND cr.created_at <= $endDate
ORDER BY cr.created_at DESC
```

**Use Cases:**
- Compare performance between versions
- Analyze impact of prompt changes
- Debug issues with specific version

---

## User Journey Examples

### Example 1: New User Onboarding

**Day 1:**
1. User completes onboarding wizard
2. Selects topics: Product Features, Pricing, Support
3. System generates 20 prompts → Saved to `generated_queries`
4. **Version 1 created** with these 20 prompts
5. User clicks "Complete Setup"

**Day 2-7:**
- Data collection runs daily
- Asks LLMs the 20 questions from Version 1
- Stores responses in `collector_results` with `configuration_version = 1`

**Day 8:**
- User visits Dashboard
- Sees 7 days of data (140 responses: 20 prompts × 7 days)
- All data is from Version 1

### Example 2: Editing Prompts

**Week 2:**
1. User goes to Manage Prompts
2. Views current prompts (from Version 1)
3. Makes changes:
   - Adds 3 new prompts about "Integration"
   - Edits 2 prompts in "Product Features" (wording improvements)
   - Deletes 1 prompt from "Pricing" (not relevant anymore)
4. Clicks "Preview Impact"
5. Sees:
   ```
   Current: 20 prompts, 3 topics
   After Changes: 22 prompts, 4 topics (+Integration)
   
   Changes:
   + 3 prompts added
   - 1 prompt removed
   ✏️ 2 prompts edited
   
   Impact:
   - Coverage: 85% → 92% (+7%)
   - Visibility: Current avg 68.5, New prompts: Unknown
   - Topics: +1 new topic (Integration)
   
   Warnings:
   - Edited prompts will lose historical continuity
   - 1 removed prompt has 7 days of data
   ```
6. User clicks "Apply Changes"
7. **Version 2 created**
8. Data collection uses new configuration starting tomorrow

**Week 3:**
- Data collection runs with Version 2 configuration
- Dashboard shows mixed data:
  - Week 1: Version 1 data (20 prompts)
  - Week 2: Version 1 data (20 prompts)
  - Week 3: Version 2 data (22 prompts)

### Example 3: Reverting to Old Version

**Week 4:**
1. User realizes Version 2 prompts aren't performing well
2. Goes to Manage Prompts
3. Selects "Version 1" from dropdown (read-only view)
4. Reviews prompts from Version 1
5. Clicks "Revert to Version 1"
6. System shows:
   ```
   You're about to revert from Version 2 to Version 1
   
   This will:
   ✓ Create Version 3 with Version 1's configuration
   ✓ Future data collection will use Version 1's prompts
   ✓ Historical data from Version 2 will be preserved
   
   Changes:
   - 3 prompts will be removed (Integration topic)
   + 1 prompt will be restored (Pricing)
   ✏️ 2 prompts will revert to old wording
   ```
7. User confirms
8. **Version 3 created** (identical to Version 1)
9. Data collection uses Version 3 (same prompts as Version 1)

**Week 5:**
- Dashboard shows:
  - Week 1: Version 1 data
  - Week 2: Version 1 data
  - Week 3: Version 2 data (still visible)
  - Week 4: Version 3 data (same prompts as Week 1-2)

---

## Summary of Corrections

### What Changed from Original Plan:

1. **Primary Data Source:** `collector_results.question` (not `generated_queries.query_text`)
2. **Added Column:** `collector_results.configuration_version` to track which version was active
3. **Hybrid Model:** Both tables are needed:
   - `generated_queries` = Configuration (what SHOULD be tracked)
   - `collector_results` = Execution (what IS being tracked)
4. **Dashboard Behavior:** Shows all historical data mixed, optionally filter by version
5. **Impact Calculation:** Based on `collector_results` historical data, not just prompt count

### Why This Matters:

- ✅ Dashboard always shows real data from `collector_results`
- ✅ Manage Prompts controls future data collection
- ✅ Versions track configuration changes over time
- ✅ Historical data remains accurate and unchanged
- ✅ Users can see evolution of their prompt strategy

---

## Next Steps

1. Review this revised approach
2. Confirm understanding of version behavior
3. Begin implementation with corrected data model
4. Test data flow from onboarding → collection → dashboard

