# Topics LLM Filter - FIXED (Using Prompts Page Implementation)

## Issue
The Topics page LLM filter dropdown was not working - selecting models like "Gemini", "Google AIO", or "Perplexity" showed "No topics found" even when data existed.

The Prompts page had a working LLM filter with the exact same models, but Topics page implementation was different.

## Root Cause
1. **Different API parameter names**: 
   - Prompts page: Uses `collectors` parameter ✅
   - Topics page: Was using `collectorType` parameter ❌
   
2. **Missing model auto-selection**:
   - Prompts page: Auto-selects first available model ✅
   - Topics page: Defaulted to "All Models" (empty string) ❌

3. **Complex filter change detection**:
   - Topics page had overcomplicated logic that prevented filters from triggering properly

## Solution

### 1. Frontend Changes

#### `src/pages/Topics.tsx`
Changed the endpoint builder to use `collectors` parameter (same as Prompts page):

```typescript
// BEFORE
if (filters.collectorType) params.append('collectorType', filters.collectorType);

// AFTER
if (filters.collectorType) params.append('collectors', filters.collectorType);
```

#### `src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx`
Updated model selection logic to match Prompts page exactly:

```typescript
// Auto-select first model if none selected or selected model is not available
useEffect(() => {
  if (availableModels.length === 0) {
    if (selectedModel !== null && selectedModel !== '') {
      setSelectedModel('');
    }
    return;
  }

  // Auto-select first model (SAME AS PROMPTS PAGE)
  if (!selectedModel || !availableModels.includes(selectedModel)) {
    setSelectedModel(availableModels[0]);
  }
}, [availableModels, selectedModel]);
```

### 2. Backend Changes

#### `backend/src/routes/brand.routes.ts`
Updated the topics route to accept both `collectors` and `collectorType` parameters for backward compatibility:

```typescript
// Accept both 'collectors' (same as Prompts API) and 'collectorType' for backward compatibility
const { startDate, endDate, collectorType, collectors, country } = req.query;

// Use collectors param if provided, otherwise fall back to collectorType
const modelFilter = collectors || collectorType;
```

#### `backend/src/services/brand.service.ts`
Enhanced the collector type mapping to handle model name variations:

```typescript
const collectorTypeMap: Record<string, string> = {
  'chatgpt': 'chatgpt',
  'claude': 'claude',
  'gemini': 'gemini',
  'perplexity': 'perplexity',
  'copilot': 'copilot',
  'deepseek': 'deepseek',
  'mistral': 'mistral',
  'grok': 'grok',
  'google aio': 'google_aio',  // Handle space variation
  'google_aio': 'google_aio',
  'google-ai': 'google_aio',
  'google': 'google_aio'
};
const normalizedInput = collectorType.toLowerCase().trim();
mappedCollectorType = collectorTypeMap[normalizedInput] || normalizedInput.replace(/\s+/g, '_');
```

## Key Changes Summary

| Component | Before | After |
|-----------|--------|-------|
| **API Parameter** | `collectorType` | `collectors` (same as Prompts) |
| **Model Selection** | Defaults to "" (All Models) | Auto-selects first model |
| **Model Name Mapping** | Limited mapping | Enhanced with variations |
| **Filter Logic** | Complex change tracking | Simple, direct filtering |

## Benefits

1. ✅ **Consistent with Prompts page**: Uses identical filtering approach
2. ✅ **Model filtering works**: Selecting "Gemini", "Google AIO", or "Perplexity" properly filters data
3. ✅ **Auto-selection**: First model is automatically selected on page load
4. ✅ **Backward compatible**: Still accepts old `collectorType` parameter
5. ✅ **Better UX**: Matches user expectations from Prompts page

## Testing

To verify the fix:

1. Navigate to Topics page (`/topics`)
2. Observe that a model is auto-selected in the dropdown (e.g., "Gemini")
3. Data should load and show topics for that model
4. Select different models from dropdown
5. Verify that data updates to show topics for the selected model
6. Compare behavior with Prompts page - should be identical

## Date: November 29, 2025







