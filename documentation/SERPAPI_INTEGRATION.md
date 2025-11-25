# SerpApi Integration for Bing Copilot

## Overview

SerpApi has been integrated as the **Priority 1** collector for Bing Copilot, with BrightData falling back to **Priority 2**. This change addresses the reliability and speed issues we were experiencing with BrightData's synchronous requests and excessive async polling times.

## Implementation Details

### Files Created/Modified

1. **New Service**: `backend/src/services/data-collection/serpapi-collector.service.ts`
   - Implements SerpApi Bing Copilot collector
   - Handles response parsing from SerpApi's JSON structure
   - Extracts answer text from `text_blocks` array
   - Extracts citations/URLs from `references` and `snippet_links`

2. **Updated**: `backend/src/services/data-collection/priority-collector.service.ts`
   - Added SerpApi import
   - Updated `bing_copilot` collector configuration:
     - **Priority 1**: `serpapi_bing_copilot` (60 second timeout)
     - **Priority 2**: `brightdata_bing_copilot` (5 minute timeout)
   - Added `callSerpApiProvider()` method
   - Added routing logic in `callProviderAPI()`

## Configuration

### Environment Variable

Add the following to your `.env` file:

```bash
SERPAPI_API_KEY=your_serpapi_api_key_here
```

### Priority Configuration

The Bing Copilot collector now uses the following priority order:

```typescript
{
  collector_type: 'bing_copilot',
  providers: [
    {
      name: 'serpapi_bing_copilot',
      priority: 1,
      enabled: true,
      timeout: 60000, // 60 seconds (synchronous)
      retries: 2,
      fallback_on_failure: true
    },
    {
      name: 'brightdata_bing_copilot',
      priority: 2,
      enabled: true,
      timeout: 300000, // 5 minutes (async polling)
      retries: 2,
      fallback_on_failure: true
    }
  ]
}
```

## API Integration

### Request Format

SerpApi uses a simple GET request to their search endpoint:

```typescript
GET https://serpapi.com/search.json?engine=bing_copilot&q={query}&api_key={api_key}
```

### Response Structure

SerpApi returns a structured JSON response with:

- `header`: Main answer heading (optional)
- `text_blocks`: Array of content blocks (paragraphs, headings, lists, code, tables)
- `references`: Array of citation objects with URLs
- `snippet_links`: Links embedded in text blocks

### Data Extraction

The service extracts:

1. **Answer Text**: Combines all `text_blocks` into a formatted answer
   - Paragraphs: Direct text
   - Headings: Formatted with markdown headers
   - Lists: Numbered list items
   - Code blocks: Formatted with language tags
   - Tables: Converted to markdown format

2. **Citations/URLs**: Extracted from:
   - `references` array (primary source)
   - `snippet_links` in text blocks (embedded links)

## Benefits

### Speed Improvements
- **Synchronous responses**: No polling required
- **60-second timeout**: Much faster than BrightData's 5-10 minute async polling
- **Immediate results**: Better UX for users

### Reliability
- **Higher success rate**: SerpApi's synchronous API is more reliable
- **Consistent response format**: Structured JSON with predictable schema
- **Better error handling**: Clear error messages from API

### Fallback Strategy
- If SerpApi fails, automatically falls back to BrightData
- Maintains backward compatibility
- No breaking changes to existing functionality

## Testing

To test the integration:

1. Ensure `SERPAPI_API_KEY` is set in your `.env` file
2. Trigger a Bing Copilot data collection request
3. Check logs for:
   - `🚀 Executing Bing Copilot query via SerpApi`
   - `✅ SerpApi Bing Copilot response extracted`
4. Verify response contains:
   - Answer text extracted from text_blocks
   - Citations/URLs from references

## Monitoring

Watch for these log messages:

- **Success**: `✅ SerpApi Bing Copilot response extracted - Answer length: X, Citations: Y`
- **Failure**: `❌ SerpApi Bing Copilot error: [error message]`
- **Fallback**: If SerpApi fails, you'll see BrightData logs as fallback kicks in

## Future Enhancements

Potential improvements:

1. **Additional SerpApi Engines**: Support for other AI models if SerpApi adds them
2. **Caching**: Cache SerpApi responses to reduce API calls
3. **Rate Limiting**: Implement rate limiting based on SerpApi's limits
4. **Webhook Support**: If SerpApi adds webhook support for async operations

## References

- SerpApi Documentation: https://serpapi.com/
- SerpApi Bing Copilot: https://serpapi.com/bing-copilot-api
- API Key Management: https://serpapi.com/manage-api-key

