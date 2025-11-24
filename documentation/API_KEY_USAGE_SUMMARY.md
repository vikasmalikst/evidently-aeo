# API Key Usage Summary

## ✅ Scoring Services (Use Numbered Keys)

These services use **numbered API keys** to distribute load and prevent rate limiting:

### 1. Position Extraction
- **Service**: `backend/src/services/scoring/position-extraction.service.ts`
- **API Key**: `CEREBRAS_API_KEY_1` (fallback: `CEREBRAS_API_KEY`)
- **Purpose**: Extracts brand/competitor mention positions from collector results
- **When**: Runs automatically after collector results are stored

### 2. Sentiment Scoring
- **Service**: `backend/src/services/scoring/sentiment-scoring.service.ts`
- **API Key**: `CEREBRAS_API_KEY_2` (fallback: `CEREBRAS_API_KEY`)
- **Purpose**: Analyzes sentiment (positive/negative) of collector results
- **When**: Runs automatically after collector results are stored

### 3. Citation Categorization
- **Service**: `backend/src/services/citations/citation-categorization.service.ts`
- **API Key**: `GOOGLE_GEMINI_API_KEY_3` (fallback: `GOOGLE_GEMINI_API_KEY`)
- **Purpose**: Categorizes citations/URLs from collector results into domains/pages
- **When**: Runs automatically during citation extraction (part of scoring flow)

---

## 🔄 Non-Scoring Services (Use Generic Keys)

These services use **generic API keys** (not numbered):

### 1. Topics/Query Generation
- **Service**: `backend/src/services/topics-query-generation.service.ts`
- **API Key**: `CEREBRAS_API_KEY` (generic)
- **Purpose**: Generates topics and search queries for brands during onboarding
- **When**: Runs during brand onboarding (once per brand)

### 2. Other Generation Services
- Query generation service
- Competitor generation service
- Brand intel service
- All use generic `CEREBRAS_API_KEY` or `GOOGLE_GEMINI_API_KEY`

---

## 📋 Environment Variables Required

### For Scoring Services (Numbered Keys)
```bash
# Position Extraction
CEREBRAS_API_KEY_1=xxx

# Sentiment Scoring
CEREBRAS_API_KEY_2=xxx

# Citation Categorization
GOOGLE_GEMINI_API_KEY_3=xxx
```

### For All Services (Fallback Keys)
```bash
# Required as fallback
CEREBRAS_API_KEY=xxx
GOOGLE_GEMINI_API_KEY=xxx
```

---

## 🎯 Why This Separation?

**Scoring services** run **automatically and frequently**:
- Triggered after each collector result
- Run in parallel (can hit rate limits)
- Need separate keys to prevent conflicts

**Generation services** run **less frequently**:
- Run during onboarding (once per brand)
- Not as time-sensitive
- Can share generic keys

---

## 📝 Summary

| Service Type | Uses Numbered Keys? | Example |
|--------------|---------------------|---------|
| **Scoring Services** | ✅ YES | Position Extraction → KEY_1 |
| **Generation Services** | ❌ NO | Topics Generation → Generic KEY |

