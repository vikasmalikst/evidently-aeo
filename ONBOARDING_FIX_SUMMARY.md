# Onboarding Flow Fix - Implementation Summary

## Overview
Successfully fixed the complete onboarding process to properly save brand, competitors, AI models, and topics to Supabase, and trigger Cerebras AI query generation based on selected topics.

## ✅ Completed Changes

### Phase 1: Frontend Updates

#### 1.1 Created Brand API Client (`src/api/brandApi.ts`)
- **New file**: `src/api/brandApi.ts`
- Created `submitBrandOnboarding()` function to call `POST /api/brands` endpoint
- Handles complete onboarding data submission with proper error handling
- Logs submission progress for debugging

#### 1.2 Updated Setup Page (`src/pages/Setup.tsx`)
- **Modified**: `src/pages/Setup.tsx`
- Added API submission logic in `handleComplete()` function
- Gathers data from localStorage (brand, competitors from onboarding flow)
- Combines with Setup data (AI models, topics, prompts)
- Submits complete payload to backend API
- Shows loading state during submission
- Shows error state with retry option
- Saves brand ID to localStorage after success
- Only navigates to dashboard after successful API submission

#### 1.3 Updated Summary Component (`src/components/Onboarding/Summary.tsx`)
- **Modified**: `src/components/Onboarding/Summary.tsx`
- Removed dependency on mock `submitOnboarding()` function
- Now properly imports types from mock file but uses real API via Setup page

### Phase 2: Backend Updates

#### 2.1 Updated Type Definitions (`backend/src/types/auth.ts`)
- **Modified**: `backend/src/types/auth.ts`
- Added `ai_models?: string[]` field to `BrandOnboardingRequest` interface
- Added `metadata?: Record<string, any>` field for extensibility

#### 2.2 Updated Brand Service (`backend/src/services/brand.service.ts`)
- **Modified**: `backend/src/services/brand.service.ts`
- **Imported**: `queryGenerationService` for Cerebras AI integration
- **Updated**: `createBrand()` function to:
  - Store AI models in `metadata.ai_models` field
  - Add AI models to `onboarding_artifacts` table
  - Prepare metadata with ai_models, topics, ceo, headquarters, founded_year
  - Store in brand record metadata field

### Phase 3: Cerebras AI Query Generation Integration

#### 3.1 Integrated Query Generation in Brand Creation
- **Modified**: `backend/src/services/brand.service.ts`
- After topics are inserted and categorized, automatically triggers query generation
- Calls `queryGenerationService.generateSeedQueries()` with:
  - `url`: Brand website URL
  - `topics`: Extracted topic labels from `aeo_topics`
  - `llm_provider`: 'cerebras' (primary AI provider)
  - `brand_id`: Newly created brand ID
  - `customer_id`: Customer ID
  - `locale`: 'en-US'
  - `country`: 'US'
  - `industry`, `competitors`, `keywords` from brand data
- Non-blocking: Query generation failure doesn't block brand creation
- Queries are automatically saved to database by query generation service

### Phase 5: Data Collection Services Alignment

#### 5.1 Updated Collector Mappings (`backend/src/services/data-collection/data-collection.service.ts`)
- **Modified**: `backend/src/services/data-collection/data-collection.service.ts`
- Added `copilot` mapping to `bing_copilot` collector
- Added `mistral` mapping (for future implementation)
- Added `copilot` collector configuration (alias for `bing_copilot`)
- Ensures all frontend AI models map to backend collectors

## Data Flow Summary

### Complete Onboarding Flow

```
1. User enters brand info (name, website, industry, description)
   └─> Saved to localStorage: 'onboarding_brand'

2. User selects competitors (3+ required)
   └─> Saved to localStorage: 'onboarding_competitors'
   
3. User navigates to /setup

4. User selects AI models (ChatGPT, Perplexity, Gemini, Copilot, etc.)
   └─> Stored in SetupModal state

5. User selects topics (5+ required from TopicSelectionModal)
   └─> Stored in SetupModal state

6. User completes prompts configuration
   └─> Stored in SetupModal state

7. Setup completion triggers API submission:
   ├─> Gather brand + competitors from localStorage
   ├─> Combine with models + topics + prompts from state
   ├─> Call POST /api/brands with complete payload
   │
   └─> Backend Processing:
       ├─> Create brand record in 'brands' table
       │   └─> Store ai_models in metadata field
       │
       ├─> Insert competitors into 'brand_competitors' table
       │
       ├─> Insert topics into 'brand_topics' table
       │
       ├─> Categorize topics with AI (Cerebras → OpenAI → Rules fallback)
       │
       ├─> Trigger Cerebras AI Query Generation
       │   ├─> Generate neutral queries based on topics
       │   ├─> Save to 'query_generations' table
       │   └─> Save queries to 'queries' table
       │
       └─> Return brand data with artifact ID

8. Frontend saves brand ID and navigates to /dashboard
   └─> Dashboard loads with actual brand data from database
```

## AI Models & Collector Mapping

| Frontend Model ID | Backend Collector | Service Provider |
|------------------|-------------------|------------------|
| `chatgpt` | ChatGPT | Oxylabs → BrightData → OpenAI (fallback) |
| `claude` | Claude | DataForSEO → Priority fallback |
| `gemini` | Gemini | Google Direct → BrightData → Oxylabs |
| `perplexity` | Perplexity | Oxylabs |
| `copilot` | Bing Copilot | BrightData |
| `grok` | Grok | BrightData |
| `deepseek` | DeepSeek | OpenRouter |
| `mistral` | Mistral | (Future implementation) |
| `llama` | - | (Coming Soon - not yet implemented) |

## Files Modified

### Frontend (3 files)
1. `src/api/brandApi.ts` *(NEW)*
2. `src/pages/Setup.tsx`
3. `src/components/Onboarding/Summary.tsx`

### Backend (3 files)
4. `backend/src/types/auth.ts`
5. `backend/src/services/brand.service.ts`
6. `backend/src/services/data-collection/data-collection.service.ts`

## Expected Behavior

### Before Fix
❌ Brand, competitors, topics, AI models only stored in localStorage  
❌ No data persisted to Supabase  
❌ Cerebras AI not triggered for query generation  
❌ Dashboard loaded with mock/localStorage data  

### After Fix
✅ Brand, competitors, topics saved to Supabase  
✅ AI models stored in brand metadata  
✅ Topics automatically categorized using AI (Cerebras/OpenAI)  
✅ Cerebras AI generates neutral queries from topics  
✅ Queries stored in database for future data collection  
✅ Dashboard loads with actual brand data from Supabase  

## Testing Recommendations

1. **Complete Onboarding Flow**
   - Enter brand information
   - Select 3+ competitors
   - Select 1+ AI models
   - Select 5+ topics
   - Complete prompts
   - Verify API call in Network tab
   - Check Supabase tables for data

2. **Database Verification**
   - Check `brands` table for new brand record
   - Check `brand_competitors` table for competitors
   - Check `brand_topics` table for topics with categories
   - Check `query_generations` table for generated queries
   - Check `queries` table for individual queries
   - Verify `metadata.ai_models` in brand record

3. **Dashboard Loading**
   - Navigate to dashboard
   - Verify brand data loads from Supabase (not localStorage)
   - Check console logs for API calls

## Notes

- Query generation is non-blocking: if Cerebras AI fails, brand creation still succeeds
- Topics are categorized using AI with guaranteed fallback to rule-based categorization
- AI models are stored in brand metadata for future reference
- Selected AI models can be used for targeted data collection
- All error states are handled gracefully with user feedback

