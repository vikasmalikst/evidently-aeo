# Versioning & Coverage Issues - Analysis & Fixes

## ✅ Versioning Status: **IMPLEMENTED**

### Database ✅
- Migration file: `supabase/migrations/20251118000000_create_prompt_versioning_tables.sql`
- Tables created:
  - `prompt_configurations` - stores version metadata
  - `prompt_configuration_snapshots` - stores prompt snapshots per version
  - `prompt_metrics_snapshots` - stores metrics per version

### Backend ✅  
- Service: `backend/src/services/prompt-management/prompt-versioning.service.ts`
- Batch endpoint: `POST /api/brands/:brandId/prompts/batch`
- **Versions ARE created** when you click "Confirm & Recalibrate"

### Issue Found
- Versions are created correctly in backend
- Version history IS refreshed after changes (line 508 in ManagePrompts.tsx)
- **Possible Issue**: UI might not immediately show new version count - this should auto-refresh

## ❌ Preview Impact: Uses Local Calculations (NOT REAL DATA)

### Current Implementation
- Uses local calculation from `impactCalculator.ts` 
- Backend API exists but result is ignored
- Calculation is simplified and not accurate

### Backend API Available
- Endpoint: `POST /api/brands/:brandId/prompts/calculate-impact`
- Returns accurate impact with:
  - Coverage changes
  - Visibility score estimates
  - Topic coverage analysis
  - Warnings

### Fix Needed
- Update to use backend API response instead of local calculation

## ❌ Coverage: Uses Placeholder Formula

### Current Formula (WRONG)
```typescript
const coverage = Math.min(100, totalPrompts * 1.5) // Doesn't make sense!
```

### Proper Formula (EXISTS)
```typescript
function calculateCoverageScore(promptCount: number, topicCount: number): number {
  const baseScore = Math.min((promptCount / 50) * 60, 60) // Max 60 points for prompts
  const topicScore = Math.min((topicCount / 10) * 40, 40) // Max 40 points for topics
  return baseScore + topicScore // Total max 100 points
}
```

### What Coverage Represents
A score (0-100) that combines:
- **Prompt Volume** (0-60 points): More prompts = better coverage
- **Topic Diversity** (0-40 points): More topics = better diversity
- **Higher coverage** = better prompt setup for comprehensive visibility tracking

### Fix Applied
- ✅ Updated backend to use proper `calculateCoverageScore` function

