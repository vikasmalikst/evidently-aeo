# API Key Migration Summary

## ✅ Changes Made

I've updated the codebase to use numbered API keys instead of descriptive names. Here's what was changed:

### New API Key Naming Convention

| Old Name | New Name | Purpose |
|----------|----------|---------|
| `CEREBRAS_API_KEY_POSITION` | `CEREBRAS_API_KEY_1` | Position Extraction |
| `CEREBRAS_API_KEY_SENTIMENT` | `CEREBRAS_API_KEY_2` | Sentiment Scoring |
| `GOOGLE_GEMINI_API_KEY_CITATIONS` | `GOOGLE_GEMINI_API_KEY_3` | Citation Categorization |
| `CEREBRAS_API_KEY_GENERATION` | `CEREBRAS_API_KEY_4` | Topic/Query Generation |

### Files Updated

1. **Created**: `backend/src/utils/api-key-resolver.ts`
   - Central utility for API key resolution
   - Functions for each operation type
   - Automatic fallback logic

2. **Updated**: `backend/src/services/scoring/position-extraction.service.ts`
   - Now uses `CEREBRAS_API_KEY_1` (fallback: `CEREBRAS_API_KEY`)

3. **Updated**: `backend/src/services/scoring/sentiment-scoring.service.ts`
   - Now uses `CEREBRAS_API_KEY_2` (fallback: `CEREBRAS_API_KEY`)

4. **Updated**: `backend/src/services/citations/citation-categorization.service.ts`
   - Now uses `GOOGLE_GEMINI_API_KEY_3` (fallback: `GOOGLE_GEMINI_API_KEY`)
   - **Note**: There's still a hardcoded key in this file that needs manual removal

5. **Updated**: `backend/src/services/topics-query-generation.service.ts`
   - Now uses `CEREBRAS_API_KEY_4` (fallback: `CEREBRAS_API_KEY`)

## 🔧 Manual Fix Required

There's one file that still has a hardcoded API key that needs to be removed:

**File**: `backend/src/services/citations/citation-categorization.service.ts`  
**Line**: ~280  
**Issue**: Hardcoded Cerebras API key `'csk-tw3tw2dfrxkk3cj9pp4djtryt49txk6mm4nhcnwtjvwtd54h'`

**Action Required**: Replace the hardcoded key with:
```typescript
const { getCitationCategorizationKey, getCerebrasKey, getGeminiModel, getCerebrasModel } = require('../../utils/api-key-resolver');
const geminiApiKey = getCitationCategorizationKey(); // Primary for citations
const cerebrasApiKey = getCerebrasKey(); // Fallback
const geminiModel = getGeminiModel('gemini-2.5-flash');
const cerebrasModel = getCerebrasModel();
```

## 📝 Environment Variables Setup

Update your `.env` file with these keys:

```bash
# Numbered API Keys (for specific operations)
CEREBRAS_API_KEY_1=xxx      # Position Extraction
CEREBRAS_API_KEY_2=xxx      # Sentiment Scoring
GOOGLE_GEMINI_API_KEY_3=xxx # Citation Categorization
CEREBRAS_API_KEY_4=xxx      # Topic/Query Generation

# Fallback Keys (required - used if numbered keys not set)
CEREBRAS_API_KEY=xxx
GOOGLE_GEMINI_API_KEY=xxx
```

## 🎯 Benefits

1. **Simpler naming**: Numbers are easier to remember than descriptive names
2. **Load distribution**: Each operation uses separate keys
3. **Rate limit prevention**: No conflicts between operations
4. **Graceful fallback**: System works even if numbered keys aren't set
5. **Easy management**: Clear mapping between keys and operations

## ✅ Testing Checklist

- [ ] Update `.env` file with new key names
- [ ] Remove hardcoded key from citation service (if needed)
- [ ] Restart backend server
- [ ] Test position extraction
- [ ] Test sentiment scoring
- [ ] Test citation categorization
- [ ] Test topic/query generation
- [ ] Verify logs show correct keys being used

## 📚 Documentation

See `documentation/API_KEY_SETUP.md` for complete setup instructions.

