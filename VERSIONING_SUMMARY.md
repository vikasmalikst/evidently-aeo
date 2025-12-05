# Versioning & Coverage - Summary

## ✅ Versioning Status: FULLY IMPLEMENTED

### Database ✅
- Tables created via migration: `20251118000000_create_prompt_versioning_tables.sql`
- `prompt_configurations` - stores versions
- `prompt_configuration_snapshots` - stores prompt snapshots per version

### Backend ✅
- Service: `prompt-versioning.service.ts`
- Route: `POST /api/brands/:brandId/prompts/batch` creates new versions
- **Versions ARE created when you click "Confirm & Recalibrate"**

### How It Works:
1. When you delete/edit/add prompts → they're added to `pendingChanges`
2. Click "Preview impact" → shows estimated impact
3. Click "Confirm & Recalibrate" → calls `applyBatchChanges` API
4. API creates a NEW version in database
5. UI refreshes version history automatically

### Why You Might See "0 versions":
- No version has been created yet (need to confirm changes first)
- Or version history needs to be refreshed

## ❌ Preview Impact: Currently Uses Local Calculations

**Issue**: Uses simplified local math instead of backend API
**Backend API Exists**: `POST /api/brands/:brandId/prompts/calculate-impact`
**Fix**: Need to use backend API for accurate data

## ✅ Coverage: Fixed to Use Proper Formula

**Was**: `Math.min(100, totalPrompts * 1.5)` - wrong
**Now**: `calculateCoverageScore(promptCount, topicCount)` - correct

**What Coverage Means**:
- Score 0-100 combining:
  - Prompt volume (0-60 points)
  - Topic diversity (0-40 points)
- Higher = better prompt coverage for visibility tracking







