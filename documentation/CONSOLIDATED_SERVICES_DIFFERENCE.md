# Difference Between Consolidated Analysis & Consolidated Scoring Services

## Overview

These are **two different layers** that work together:

1. **`consolidated-analysis.service.ts`** - **Pure Analysis Layer** (LLM operations only)
2. **`consolidated-scoring.service.ts`** - **Orchestration Layer** (calls analysis + database operations)

---

## 📊 Consolidated Analysis Service
**File**: `backend/src/services/scoring/consolidated-analysis.service.ts`

### Purpose
**Pure analysis service** that performs LLM operations in a single API call. It does **NOT** write to the database.

### What It Does
1. ✅ Makes **1 LLM API call** to OpenRouter
2. ✅ Returns structured data:
   - Products (brand + competitors)
   - Citation categorizations
   - Sentiment analysis (brand + competitors)
3. ✅ Checks database cache for citations (reads only)
4. ✅ Caches results in memory (for reuse)

### What It Does NOT Do
- ❌ Does NOT write to database
- ❌ Does NOT fetch collector results
- ❌ Does NOT orchestrate multiple operations
- ❌ Does NOT store sentiment in `extracted_positions`
- ❌ Does NOT store citations in `citations` table

### Input
```typescript
{
  brandName: string,
  brandMetadata?: any,
  competitorNames: string[],
  competitorMetadata?: Map<string, any>,
  rawAnswer: string,
  citations: string[],
  collectorResultId?: number,
  customerId?: string,
  brandId?: string
}
```

### Output
```typescript
{
  products: { brand: string[], competitors: Record<string, string[]> },
  citations: Record<string, { category: string, pageName: string | null }>,
  sentiment: { 
    brand: { label: string, score: number },
    competitors: Record<string, { label: string, score: number }>
  }
}
```

### Key Methods
- `analyze()` - Main method, performs consolidated analysis
- `getCachedCitationCategories()` - Checks database cache (read-only)
- `storeCitationCategories()` - Stores new categorizations in database cache
- `callOpenRouterAPI()` - Makes the LLM API call

---

## 🎯 Consolidated Scoring Service
**File**: `backend/src/services/scoring/consolidated-scoring.service.ts`

### Purpose
**Orchestration service** that coordinates the entire scoring workflow. It uses consolidated analysis and handles all database writes.

### What It Does
1. ✅ **Fetches collector results** from database
2. ✅ **Calls consolidated analysis service** for each result
3. ✅ **Stores citations** in `citations` table
4. ✅ **Triggers position extraction** (uses cached products from consolidated analysis)
5. ✅ **Stores sentiment** in `extracted_positions` table
6. ✅ **Orchestrates the full workflow**

### What It Does NOT Do
- ❌ Does NOT make LLM API calls directly (delegates to consolidated analysis)
- ❌ Does NOT extract positions (delegates to position extraction service)

### Input
```typescript
{
  brandId: string,
  customerId: string,
  since?: string,
  limit?: number
}
```

### Output
```typescript
{
  processed: number,
  positionsProcessed: number,
  sentimentsProcessed: number,
  citationsProcessed: number,
  errors: Array<{ collectorResultId: number, error: string }>
}
```

### Key Methods
- `scoreBrand()` - Main orchestration method
- `runConsolidatedAnalysis()` - Calls consolidated analysis service
- `storeCitations()` - Writes citations to database
- `storeSentiment()` - Writes sentiment to `extracted_positions` table

---

## 🔄 How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│  Brand Scoring Orchestrator                                 │
│  (brand-scoring.orchestrator.ts)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  Consolidated Scoring Service                               │
│  (consolidated-scoring.service.ts)                          │
│  - Orchestration Layer                                      │
│  - Database Operations                                      │
│  - Workflow Management                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├─────────────────┐
                       │                 │
                       ↓                 ↓
        ┌──────────────────────┐  ┌──────────────────────┐
        │  Consolidated        │  │  Position Extraction │
        │  Analysis Service    │  │  Service             │
        │  (LLM Operations)    │  │  (Character          │
        │                      │  │   Positions)         │
        │  - 1 API Call        │  │                      │
        │  - Returns Data      │  │  - Uses cached       │
        │  - No DB Writes      │  │    products          │
        └──────────────────────┘  └──────────────────────┘
                       │
                       ↓
        ┌──────────────────────┐
        │  Database Writes     │
        │  - citations table   │
        │  - extracted_positions│
        └──────────────────────┘
```

## 📋 Detailed Comparison

| Aspect | Consolidated Analysis | Consolidated Scoring |
|--------|----------------------|---------------------|
| **Layer** | Analysis (LLM) | Orchestration (Workflow) |
| **Database Reads** | ✅ Yes (citation cache) | ✅ Yes (collector results, positions) |
| **Database Writes** | ✅ Yes (citation cache only) | ✅ Yes (citations, sentiment) |
| **LLM API Calls** | ✅ Yes (1 call) | ❌ No (delegates) |
| **Fetches Collector Results** | ❌ No | ✅ Yes |
| **Stores Citations** | ❌ No | ✅ Yes |
| **Stores Sentiment** | ❌ No | ✅ Yes |
| **Extracts Positions** | ❌ No | ❌ No (delegates) |
| **Orchestrates Workflow** | ❌ No | ✅ Yes |
| **Input** | Single collector result data | Brand ID, customer ID, filters |
| **Output** | Analysis results (products, citations, sentiment) | Processing statistics |

## 🎯 Use Cases

### Use Consolidated Analysis Service When:
- You already have collector result data
- You just need the analysis results (no database writes needed)
- You want to reuse the analysis in different contexts
- You're building a custom workflow

### Use Consolidated Scoring Service When:
- You want to score a brand end-to-end
- You need all database writes to happen automatically
- You want the full orchestrated workflow
- You're calling from brand scoring orchestrator

## 🔗 Relationship

```
Consolidated Scoring Service
    ↓ (uses)
Consolidated Analysis Service
    ↓ (uses)
OpenRouter API (LLM)
```

**Consolidated Scoring** is a **wrapper/orchestrator** around **Consolidated Analysis**.

## 💡 Analogy

Think of it like a restaurant:

- **Consolidated Analysis Service** = The **chef** (cooks the food / performs analysis)
- **Consolidated Scoring Service** = The **waiter** (takes order, brings food, handles payment / orchestrates workflow)

The chef focuses on cooking (analysis), while the waiter handles the full customer experience (orchestration + database operations).

## 📝 Summary

| Service | Responsibility | Database | LLM |
|---------|---------------|----------|-----|
| **Consolidated Analysis** | Pure analysis | Reads cache, writes cache | ✅ Makes API calls |
| **Consolidated Scoring** | Full orchestration | Reads & writes all tables | ❌ Delegates to analysis |

**In practice**: You typically use **Consolidated Scoring Service** from the orchestrator, which internally uses **Consolidated Analysis Service** for the LLM operations.
