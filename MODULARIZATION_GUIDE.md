# Recommendations V3 Modularization Guide

This guide documents the modularization of Recommendations V3 codebase, splitting large files (1000+ lines) into smaller, maintainable modules.

## Backend Modularization Status

### ✅ Completed Modules

1. **types.ts** - All TypeScript interfaces and types
2. **utils.ts** - Utility functions (normalize, format, parse JSON)
3. **context-builder.service.ts** - Brand context gathering (~350 lines extracted)
4. **database.service.ts** - Database operations (~130 lines extracted)

### 🔄 Remaining Work

#### 1. LLM Service (`llm.service.ts`)
Extract LLM API calls into a unified service:
- `callOpenRouter(prompt, options)` - Primary LLM provider
- `callCerebras(prompt, options)` - Fallback provider
- `callOllama(prompt, brandId, options)` - Brand-specific provider
- `callLLM(prompt, options)` - Unified interface that tries providers in order

**Location to extract from:** `recommendation-v3.service.ts` lines 562-625 (KPI identification), 1268-1329 (recommendations), 876-997 (direct recommendations)

#### 2. KPI Identification Service (`kpi-identification.service.ts`)
Extract KPI identification logic:
- `identifyKPIs(context)` - Main method
- Uses LLM service for API calls
- Uses utils for normalization and parsing

**Location to extract from:** `recommendation-v3.service.ts` lines 499-754

#### 3. Recommendation Generation Service (`recommendation-generation.service.ts`)
Extract recommendation generation logic:
- `generateRecommendationsDirect(context)` - Direct generation (no KPI step)
- `generateRecommendationsForKPIs(context, kpis)` - KPI-based generation
- Uses LLM service for API calls
- Enriches recommendations with source metrics

**Location to extract from:** `recommendation-v3.service.ts` lines 759-1175

#### 4. Main Service (`index.ts`)
Orchestrate all modules:
```typescript
import { contextBuilderService } from './context-builder.service';
import { kpiIdentificationService } from './kpi-identification.service';
import { recommendationGenerationService } from './recommendation-generation.service';
import { databaseService } from './database.service';
import type { RecommendationV3Response } from './types';

class RecommendationV3Service {
  async generateRecommendations(brandId: string, customerId: string): Promise<RecommendationV3Response> {
    // 1. Gather context
    const context = await contextBuilderService.gatherBrandContext(brandId, customerId);
    if (!context) return { success: false, kpis: [], recommendations: [], message: 'Failed to gather context' };
    
    // 2. Generate recommendations directly (simplified flow)
    const recommendations = await recommendationGenerationService.generateRecommendationsDirect(context);
    
    // 3. Enrich with source metrics (done in generation service)
    
    // 4. Save to database
    const generationId = await databaseService.saveToDatabase(brandId, customerId, [], recommendations, context);
    
    if (!generationId) {
      return { success: false, kpis: [], recommendations: [], message: 'Failed to save to database' };
    }
    
    return {
      success: true,
      generationId,
      kpis: [],
      recommendations,
      brandId,
      brandName: context.brandName
    };
  }
}

export const recommendationV3Service = new RecommendationV3Service();
```

## Frontend Modularization Status

### 📁 Target Structure

```
src/components/RecommendationsV3/
├── RecommendationsTableV3.tsx (existing)
├── StepIndicator.tsx (existing)
├── hooks/
│   ├── useRecommendationsV3.ts        # Main state management hook
│   ├── useStepNavigation.ts           # Step navigation logic
│   └── useStatusFilter.ts             # Status filtering logic
├── components/
│   ├── Step1Review.tsx                # Step 1: Review & Status Management
│   ├── Step2ContentGeneration.tsx     # Step 2: Content Generation
│   ├── Step3ContentReview.tsx         # Step 3: Content Review
│   ├── Step4Results.tsx               # Step 4: Results Tracking
│   ├── StatusFilter.tsx               # Status filter dropdown
│   ├── LoadingState.tsx               # Loading UI
│   └── ErrorState.tsx                 # Error UI
└── utils/
    └── contentParser.ts               # Content parsing utilities
```

### 🔄 Extraction Plan

#### 1. Custom Hooks

**useRecommendationsV3.ts** (~200 lines)
- All state declarations
- Data loading logic
- Generation logic
- Returns: state, handlers, loading flags

**useStepNavigation.ts** (~150 lines)
- Step navigation logic
- Manual loading flags
- Step data loading
- Returns: navigateToStep function, loading state

**useStatusFilter.ts** (~50 lines)
- Status filter state
- Local filtering logic
- Returns: filtered recommendations, filter controls

#### 2. Step Components

**Step1Review.tsx** (~100 lines)
- Step 1 UI
- Status filter
- Recommendations table with status dropdowns

**Step2ContentGeneration.tsx** (~80 lines)
- Step 2 UI
- Bulk content generation button
- Recommendations table

**Step3ContentReview.tsx** (~400 lines)
- Step 3 UI
- Content display (v1.0 and v2.0 formats)
- Completion checkboxes
- Expanded sections management

**Step4Results.tsx** (~200 lines)
- Step 4 UI
- Results table
- KPI comparison display

#### 3. Shared Components

**StatusFilter.tsx** (~40 lines)
- Status filter dropdown component

**LoadingState.tsx** (~30 lines)
- Loading spinner UI

**ErrorState.tsx** (~30 lines)
- Error message display

#### 4. Main Page (RecommendationsV3.tsx) - Reduced to ~300 lines
- Layout structure
- Brand selection
- Step indicator
- Routes to step components
- Uses hooks for state management

## Migration Steps

### Backend

1. ✅ Create types.ts
2. ✅ Create utils.ts
3. ✅ Create context-builder.service.ts
4. ✅ Create database.service.ts
5. ⏳ Create llm.service.ts
6. ⏳ Create kpi-identification.service.ts
7. ⏳ Create recommendation-generation.service.ts
8. ⏳ Update index.ts to use all modules
9. ⏳ Update routes to import from index.ts
10. ⏳ Test and verify

### Frontend

1. ⏳ Create hooks directory and extract hooks
2. ⏳ Create components directory and extract step components
3. ⏳ Create shared components
4. ⏳ Update main page to use hooks and components
5. ⏳ Update imports
6. ⏳ Test and verify

## Benefits

- **Maintainability**: Smaller files are easier to understand and modify
- **Testability**: Each module can be tested independently
- **Reusability**: Modules can be used in other contexts
- **Readability**: Clear separation of concerns
- **Collaboration**: Multiple developers can work on different modules

## Notes

- All modules should maintain the same external API
- Types are shared across modules via types.ts
- Utils are shared via utils.ts
- Main service orchestrates all modules

