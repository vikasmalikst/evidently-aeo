# Recommendation V3 Service - Modular Structure

This directory contains the modularized Recommendation V3 service, broken down from a single 1700+ line file into focused, maintainable modules.

## Structure

```
recommendation-v3/
├── types.ts                      # All TypeScript interfaces and types
├── utils.ts                      # Utility functions (normalize, format, parse JSON)
├── context-builder.service.ts    # Brand context gathering logic
├── kpi-identification.service.ts # KPI identification via LLM
├── recommendation-generation.service.ts # Recommendation generation via LLM
├── database.service.ts           # Database operations (save KPIs, recommendations)
├── llm.service.ts                # LLM API calls (OpenRouter, Cerebras, Ollama)
└── index.ts                      # Main service class (orchestrator)
```

## Module Responsibilities

### types.ts
- `IdentifiedKPI` - KPI interface
- `RecommendationV3` - Recommendation interface
- `BrandContextV3` - Brand context interface
- `RecommendationV3Response` - Service response interface

### utils.ts
- `normalizePercent()` - Normalize metrics to 0-100 scale
- `normalizeSentiment100()` - Normalize sentiment to 0-100
- `formatValue()` - Format numbers to specific decimals
- `parseLLMJSONResponse()` - Robust JSON parsing from LLM responses

### context-builder.service.ts
- `gatherBrandContext()` - Builds comprehensive brand context including:
  - Overall brand metrics (visibility, SOA, sentiment)
  - Trend analysis (current vs previous period)
  - Competitor metrics
  - Source metrics (from source-attribution service)

### kpi-identification.service.ts
- `identifyKPIs()` - Uses LLM to identify 3-5 key KPIs for a brand
- Handles LLM prompt construction
- Parses and validates LLM response

### recommendation-generation.service.ts
- `generateRecommendationsDirect()` - Generate recommendations directly (no KPI step)
- `generateRecommendationsForKPIs()` - Generate recommendations for specific KPIs
- Enriches recommendations with source metrics
- Handles LLM prompt construction and response parsing

### database.service.ts
- `saveToDatabase()` - Saves KPIs and recommendations to database
- Maps recommendations to KPI IDs
- Returns generation ID

### llm.service.ts
- `callLLM()` - Unified LLM API interface
- Handles OpenRouter (primary)
- Handles Cerebras (fallback)
- Handles Ollama (brand-specific)

### index.ts
- Main `RecommendationV3Service` class
- Orchestrates all modules
- Public API: `generateRecommendations()`
- Exports singleton instance

## Usage

```typescript
import { recommendationV3Service } from './recommendation-v3';

const response = await recommendationV3Service.generateRecommendations(brandId, customerId);
```

## Migration Notes

The original `recommendation-v3.service.ts` file has been split into these modules for better:
- **Maintainability**: Smaller, focused files
- **Testability**: Each module can be tested independently
- **Readability**: Clear separation of concerns
- **Reusability**: Modules can be used independently if needed

