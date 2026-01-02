# BrightData Collector Requirements

## Country Parameter Handling

For **Google AIO** and **Gemini** collectors executed via BrightData, strict handling of the `country` parameter is required to ensure consistent data collection.

### Requirements

1.  **Default Value**: The `country` parameter must default to `"US"` if not explicitly provided in the request.
2.  **Explicit Override**: If a country is provided (e.g., `"CA"`, `"UK"`), it must be respected.
3.  **Implementation**: This is handled at the service level (`google-aio.service.ts` and `gemini.service.ts`) before sending the payload to BrightData.

### Implementation Details

**Google AIO**:
```typescript
// Enforce country parameter: default to 'US' if not provided
country: request.country || 'US'
```

**Gemini**:
```typescript
// Enforce country parameter: default to 'US' if not provided
country: request.country || 'US'
```

This ensures that queries without a specific country context default to the US market, avoiding ambiguity or potential errors from the upstream provider when the country is missing.
