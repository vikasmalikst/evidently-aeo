<!-- e09504b1-4cb1-48de-b820-6a283cc0a393 deb72996-a3dd-4016-a4e6-24bdd9a50be6 -->
# Recommendations V3 Revamp Plan

## Overview

Transform the recommendations system to use a KPI-first approach where the LLM first identifies key KPIs/metrics for a brand, then generates 2-3 recommendations per KPI. Implement a 4-step workflow with simplified table columns and KPI result tracking.

## Key Changes

### 1. Prompt Engineering Changes

**File**: `backend/src/services/recommendations/recommendation.service.ts`

- **Current**: Prompt analyzes detected problems and generates recommendations
- **New**: Two-phase prompt approach:

  1. **Phase 1**: Ask LLM to identify 3-5 key KPIs/metrics that are most important for this brand based on their data
  2. **Phase 2**: For each identified KPI, generate 2-3 specific recommendations to improve that KPI

**Implementation**:

- Modify `buildPrompt()` to first request KPI identification
- Add new method `identifyKPIs()` that calls LLM to get KPIs
- Update prompt to request recommendations grouped by KPI (2-3 per KPI)
- Store KPI information in recommendation records (new field: `target_kpi_id` or similar)

### 2. Database Schema Updates

**Files**: New migration file in `supabase/migrations/`

**New Tables/Columns**:

- `recommendation_kpis` table:
  - `id` (uuid, primary key)
  - `generation_id` (uuid, foreign key)
  - `brand_id` (uuid)
  - `customer_id` (uuid)
  - `kpi_name` (varchar) - e.g., "Visibility Index", "SOA %"
  - `kpi_description` (text) - Why this KPI matters for this brand
  - `current_value` (numeric) - Current KPI value
  - `target_value` (numeric) - Target/improved value
  - `display_order` (integer)
  - `created_at`, `updated_at` (timestamps)

- `recommendations` table additions:
  - `kpi_id` (uuid, foreign key to `recommendation_kpis`) - Links recommendation to its KPI
  - `is_approved` (boolean, default false) - Step 1 → Step 2
  - `is_content_generated` (boolean, default false) - Step 2 → Step 3
  - `is_completed` (boolean, default false) - Step 3 → Step 4
  - `completed_at` (timestamp, nullable)
  - `kpi_before_value` (numeric, nullable) - KPI value before action
  - `kpi_after_value` (numeric, nullable) - KPI value after action (collected next day)

- `recommendation_completions` table (optional, for tracking):
  - `id` (uuid, primary key)
  - `recommendation_id` (uuid, foreign key)
  - `completed_at` (timestamp)
  - `kpi_before_value` (numeric)
  - `kpi_after_value` (numeric, nullable) - Populated by cron job next day

### 3. Simplified Table Columns

**Files**: `src/pages/RecommendationsV3.tsx` (new file)

**Columns to display**:

- Action (what to do)
- Source/Domain (citation source)
- Focus Area (visibility/soa/sentiment)
- Priority (High/Medium/Low)
- Effort Level (Low/Medium/High)

**Remove from table** (keep in expanded view if needed):

- Impact Score, Mention Rate, SOA, Sentiment, Citations (move to details)
- Timeline, Confidence (move to details)
- Expected Boost (move to details)

### 4. 4-Step Workflow Implementation

#### Step 1: Generate & Review

- Display all generated recommendations in simplified table
- Each row has checkbox for selection/approval
- Bulk approve button
- Shows: Action, Source/Domain, Focus Area, Priority, Effort Level
- User can approve individual or bulk approve selected items

#### Step 2: Approved Recommendations

- Show only approved recommendations (`is_approved = true`)
- Same simplified table format
- Each row has "Generate Content" button
- Button triggers content generation (reuse existing `recommendationContentService`)
- Track `is_content_generated` flag

#### Step 3: Content Review

- Show recommendations with generated content
- Display content in expandable/collapsible section per recommendation
- User can review generated content
- Each recommendation has checkbox labeled "Completed" (mark as implemented/posted)

#### Step 4: Results Tracking

- Show completed recommendations (`is_completed = true`)
- Display two KPI scores side-by-side:
  - **Current Result**: KPI value at time of completion (`kpi_before_value`)
  - **Improved Result**: KPI value collected next day via cron (`kpi_after_value`)
- Show message: "Results will be collected tomorrow" for recently completed items
- Visual comparison (before/after with percentage change)

### 5. Backend API Changes

**File**: `backend/src/routes/recommendations.routes.ts`

**New Endpoints**:

- `POST /api/recommendations-v3/generate` - Generate recommendations with KPI-first approach
- `GET /api/recommendations-v3/:generationId/steps` - Get recommendations by step (1-4)
- `PATCH /api/recommendations-v3/:recommendationId/approve` - Approve recommendation (Step 1 → 2)
- `POST /api/recommendations-v3/:recommendationId/content` - Generate content (Step 2 → 3)
- `PATCH /api/recommendations-v3/:recommendationId/complete` - Mark as completed (Step 3 → 4)
- `GET /api/recommendations-v3/:generationId/kpis` - Get identified KPIs for a generation

**Modified Endpoints**:

- Update existing recommendation endpoints to support new workflow states

### 6. Frontend Components

**New File**: `src/pages/RecommendationsV3.tsx`

- Main page component with step navigation
- Step indicator component (shows current step 1-4)
- Simplified recommendations table component
- Content display component for Step 3
- Results comparison component for Step 4

**New Components**:

- `src/components/RecommendationsV3/StepIndicator.tsx` - Visual step progress
- `src/components/RecommendationsV3/RecommendationsTable.tsx` - Simplified table
- `src/components/RecommendationsV3/ContentReview.tsx` - Step 3 content display
- `src/components/RecommendationsV3/ResultsTracking.tsx` - Step 4 KPI comparison

### 7. Cron Job for KPI Collection

**File**: New cron job file or add to existing scheduler

**Functionality**:

- Run daily (e.g., 2 AM)
- Find recommendations marked as completed yesterday
- Query current KPI values from `extracted_positions` table
- Update `kpi_after_value` in recommendations table
- Calculate and store improvement percentage

### 8. UI/UX Enhancements

**Color Theme** (maintain existing):

- Use existing CSS variables from `src/styles/tokens.css`:
  - Primary accent: `#00bcdc` (--accent-primary)
  - Success: `#06c686` (--success500)
  - Background: `#f4f4f6` (--bg-secondary)
  - Text: `#1a1d29` (--text-headings)

**Step Indicator Design**:

- Horizontal progress bar showing 4 steps
- Active step highlighted in accent color
- Completed steps in success color
- Clickable steps for navigation

**Table Design**:

- Clean, minimal design matching existing table styles
- Hover effects on rows
- Checkbox styling consistent with existing design
- Badge components for Priority/Effort/Focus Area (reuse from V2)

**Content Display**:

- Expandable cards for each recommendation's content
- Copy-to-clipboard functionality
- Preview/edit capabilities

**Results Display**:

- Side-by-side comparison cards
- Visual indicators (arrows, percentage changes)
- Color coding (green for improvement, red for decline)

### 9. Route Configuration

**File**: `src/App.tsx`

Add new route:

```tsx
<Route path="/recommendations-v3" element={<RecommendationsV3 />} />
```

### 10. API Client Updates

**File**: `src/api/recommendationsApi.ts` (or create new file)

Add functions for:

- `generateRecommendationsV3(brandId)`
- `getRecommendationsByStep(generationId, step)`
- `approveRecommendation(recommendationId)`
- `markRecommendationComplete(recommendationId)`
- `getKPIsForGeneration(generationId)`

## Implementation Order

1. **Database Migration** - Create new tables and columns
2. **Backend Service Updates** - Modify prompt logic for KPI-first approach
3. **Backend API Routes** - Add new endpoints for workflow steps
4. **Frontend API Client** - Add API functions
5. **Frontend Components** - Build step indicator, simplified table, content review, results tracking
6. **Main Page** - Assemble 4-step workflow UI
7. **Cron Job** - Implement daily KPI collection
8. **Testing & Refinement** - Test workflow end-to-end

## Additional Suggestions

1. **Bulk Operations**: Add "Approve All" and "Generate Content for All" buttons
2. **Filters**: Allow filtering by KPI, Focus Area, Priority in each step
3. **Export**: Export recommendations to CSV/PDF at any step
4. **Notifications**: Notify users when KPI results are available (Step 4)
5. **Analytics**: Track completion rates, time-to-complete, KPI improvements
6. **Undo Actions**: Allow un-approving or un-completing recommendations
7. **Comments/Notes**: Add ability to add notes to recommendations at each step
8. **Templates**: Save common approval/content patterns as templates

## Technical Considerations

- **State Management**: Use React state for current step and selected recommendations
- **Persistence**: All state changes should be persisted to database immediately
- **Optimistic Updates**: Update UI optimistically, then sync with backend
- **Error Handling**: Graceful error handling at each step with retry options
- **Loading States**: Show loading indicators during content generation
- **Responsive Design**: Ensure mobile-friendly layout for all steps

### To-dos

- [ ] Create database migration for recommendation_kpis table, update recommendations table with workflow fields (is_approved, is_content_generated, is_completed, kpi_id, kpi_before_value, kpi_after_value)
- [ ] Modify recommendation.service.ts to implement KPI-first prompt: Phase 1 identifies KPIs, Phase 2 generates 2-3 recommendations per KPI
- [ ] Add new API endpoints in recommendations.routes.ts for workflow steps: approve, generate content, complete, and get by step
- [ ] Create/update API client functions for RecommendationsV3 endpoints (generate, approve, complete, get by step, get KPIs)
- [ ] Build StepIndicator component showing 4-step progress with navigation
- [ ] Create RecommendationsTable component with simplified columns: Action, Source/Domain, Focus Area, Priority, Effort Level
- [ ] Implement Step 1 UI: display all recommendations with checkboxes and bulk approve functionality
- [ ] Implement Step 2 UI: show approved recommendations with Generate Content buttons
- [ ] Implement Step 3 UI: display generated content with completed checkboxes
- [ ] Implement Step 4 UI: show completed recommendations with before/after KPI comparison
- [ ] Assemble RecommendationsV3.tsx page with step navigation and state management
- [ ] Create cron job to collect KPI values next day after completion and update kpi_after_value
- [ ] Add /recommendations-v3 route to App.tsx routing configuration