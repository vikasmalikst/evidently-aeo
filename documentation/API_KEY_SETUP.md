# API Key Setup Guide

## 🔑 Numbered API Keys for Operations

This system uses numbered API keys to distribute load across different operations and avoid rate limiting. Each operation has its own dedicated key with fallback support.

## Environment Variables

Add these to your `.env` file:

```bash
# ==========================================
# Position Extraction (KEY_1)
# ==========================================
# Used for: Extracting brand/competitor mention positions from collector results
CEREBRAS_API_KEY_1=xxx

# ==========================================
# Sentiment Scoring (KEY_2)
# ==========================================
# Used for: Analyzing sentiment of collector results
CEREBRAS_API_KEY_2=xxx

# ==========================================
# Citation Categorization (KEY_3)
# ==========================================
# Used for: Categorizing citations/URLs from collector results
GOOGLE_GEMINI_API_KEY_3=xxx

# ==========================================
# Topic/Query Generation (KEY_4)
# ==========================================
# Used for: Generating topics and queries during onboarding
CEREBRAS_API_KEY_4=xxx

# ==========================================
# Fallback Keys (Required)
# ==========================================
# These are used if specific numbered keys are not set
CEREBRAS_API_KEY=xxx
GOOGLE_GEMINI_API_KEY=xxx

# Optional: Alternative Gemini key name
GEMINI_API_KEY=xxx
```

## Key Mapping

| Key Variable | Operation | Service | Fallback |
|-------------|-----------|---------|----------|
| `CEREBRAS_API_KEY_1` | Position Extraction | `position-extraction.service.ts` | `CEREBRAS_API_KEY` |
| `CEREBRAS_API_KEY_2` | Sentiment Scoring | `sentiment-scoring.service.ts` | `CEREBRAS_API_KEY` |
| `GOOGLE_GEMINI_API_KEY_3` | Citation Categorization | `citation-categorization.service.ts` | `GOOGLE_GEMINI_API_KEY` or `GEMINI_API_KEY` |
| `CEREBRAS_API_KEY_4` | Topic/Query Generation | `topics-query-generation.service.ts` | `CEREBRAS_API_KEY` |

## Benefits

1. **Rate Limit Isolation**: Each operation uses a separate key, preventing rate limit conflicts
2. **Parallel Processing**: Multiple operations can run simultaneously without competing for the same key
3. **Graceful Fallback**: If a specific key isn't set, the system falls back to the generic key
4. **Easy Management**: Clear naming convention makes it easy to manage multiple keys

## Setup Instructions

### Minimal Setup (Single Key)
If you only have one Cerebras key and one Gemini key:

```bash
CEREBRAS_API_KEY=your_single_cerebras_key
GOOGLE_GEMINI_API_KEY=your_single_gemini_key
```

All operations will use these fallback keys.

### Recommended Setup (Multiple Keys)
For optimal performance, set all numbered keys:

```bash
CEREBRAS_API_KEY_1=key_for_positions
CEREBRAS_API_KEY_2=key_for_sentiment
GOOGLE_GEMINI_API_KEY_3=key_for_citations
CEREBRAS_API_KEY_4=key_for_generation

# Still required as fallback
CEREBRAS_API_KEY=fallback_key
GOOGLE_GEMINI_API_KEY=fallback_key
```

## Code Implementation

The API key resolver (`utils/api-key-resolver.ts`) handles key selection automatically:

```typescript
import { 
  getPositionExtractionKey,
  getSentimentScoringKey,
  getCitationCategorizationKey,
  getTopicQueryGenerationKey
} from '../../utils/api-key-resolver';

// Position extraction will use KEY_1 or fallback
const key1 = getPositionExtractionKey();

// Sentiment scoring will use KEY_2 or fallback
const key2 = getSentimentScoringKey();

// Citation categorization will use KEY_3 or fallback
const key3 = getCitationCategorizationKey();

// Topic generation will use KEY_4 or fallback
const key4 = getTopicQueryGenerationKey();
```

## Migration from Old Keys

If you're migrating from the old descriptive keys:

**Old:**
```bash
CEREBRAS_API_KEY_POSITION=xxx
CEREBRAS_API_KEY_SENTIMENT=xxx
GOOGLE_GEMINI_API_KEY_CITATIONS=xxx
CEREBRAS_API_KEY_GENERATION=xxx
```

**New (Current):**
```bash
CEREBRAS_API_KEY_1=xxx      # Same as CEREBRAS_API_KEY_POSITION
CEREBRAS_API_KEY_2=xxx      # Same as CEREBRAS_API_KEY_SENTIMENT
GOOGLE_GEMINI_API_KEY_3=xxx # Same as GOOGLE_GEMINI_API_KEY_CITATIONS
CEREBRAS_API_KEY_4=xxx      # Same as CEREBRAS_API_KEY_GENERATION
```

Simply rename the keys in your `.env` file - no code changes needed (code uses the resolver functions).

## Testing

To verify your keys are set correctly, check the logs when services start:

```
✅ Position extraction using CEREBRAS_API_KEY_1
✅ Sentiment scoring using CEREBRAS_API_KEY_2
✅ Citation categorization using GOOGLE_GEMINI_API_KEY_3
✅ Topic generation using CEREBRAS_API_KEY_4
```

If a numbered key is not set, you'll see:
```
⚠️ Using fallback key: CEREBRAS_API_KEY
```

## Troubleshooting

### All operations using same key
**Problem**: All operations seem to use the same API key  
**Solution**: Check that numbered keys are set correctly in `.env` file

### Rate limiting still occurring
**Problem**: Getting rate limited even with multiple keys  
**Solution**: 
1. Verify you're using different API keys (not the same key for all)
2. Check that keys have sufficient rate limits
3. Ensure parallel operations are actually using different keys (check logs)

### Service not finding keys
**Problem**: Service throws "API key not configured" error  
**Solution**: 
1. Check `.env` file is in correct location (backend/.env or root .env)
2. Verify key names match exactly (case-sensitive)
3. Restart the backend server after changing `.env`

## Support

For issues with API key configuration, check:
1. Environment variable loading logs at startup
2. Service-specific error messages
3. `utils/api-key-resolver.ts` for resolver logic

