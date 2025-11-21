# Collector Services Usage Analysis

## ✅ **ACTIVELY USED SERVICES**

### Primary Collector Services (All Used)

1. **`backend/src/services/data-collection/oxylabs-collector.service.ts`** ✅
   - **Used by:**
     - `data-collection.service.ts` (line 8)
     - `priority-collector.service.ts` (line 8)
   - **Status:** Actively used for ChatGPT, Google AIO, Perplexity via Oxylabs API

2. **`backend/src/services/data-collection/dataforseo-collector.service.ts`** ✅
   - **Used by:**
     - `data-collection.service.ts` (line 9)
     - `priority-collector.service.ts` (line 9)
   - **Status:** Actively used for Baidu, Bing, YouTube, Claude, Perplexity, Google AIO via DataForSEO API

3. **`backend/src/services/data-collection/brightdata-collector.service.ts`** ✅
   - **Used by:**
     - `priority-collector.service.ts` (line 10)
     - `brightdata-background.service.ts` (line 8)
   - **Status:** Actively used for ChatGPT, Bing Copilot, Grok, Gemini via BrightData API

4. **`backend/src/services/data-collection/openrouter-collector.service.ts`** ✅
   - **Used by:**
     - `data-collection.service.ts` (line 12)
   - **Status:** Actively used for Claude, DeepSeek via OpenRouter API

5. **`backend/src/services/data-collection/google-aio-collector.service.ts`** ✅
   - **Used by:**
     - `query-generation.service.ts` (line 1912 - dynamic import)
     - `backend/src/routes/google-aio.routes.ts` (line 2)
   - **Status:** Actively used for batch Google AIO queries via dedicated route

### Orchestration Services (All Used)

6. **`backend/src/services/data-collection/data-collection.service.ts`** ✅
   - **Main orchestrator** - Routes requests to appropriate collectors
   - **Used by:** Routes and other services throughout the codebase
   - **Status:** Core service, actively used

7. **`backend/src/services/data-collection/priority-collector.service.ts`** ✅
   - **Used by:**
     - `data-collection.service.ts` (line 10)
     - `backend/src/routes/data-collection.routes.ts` (line 8)
   - **Status:** Handles priority-based fallback logic, actively used

8. **`backend/src/services/data-collection/brightdata-background.service.ts`** ✅
   - **Used by:** Background processing for BrightData async operations
   - **Status:** Actively used for polling BrightData snapshots

---

## ❌ **UNUSED OR MINIMALLY USED SERVICES**

### Unused Services

1. **`backend/src/services/data-collection/anthropic-collector.service.ts`** ❌
   - **Status:** **NOT USED** - Exists but never imported or referenced anywhere
   - **Note:** Claude is handled via DataForSEO in `priority-collector.service.ts` (line 210), not via direct Anthropic API
   - **Recommendation:** Can be removed unless you plan to use direct Anthropic API as a fallback

---

## 🚫 **SERVICES THAT DON'T EXIST**

The following services mentioned in your list **do not exist** in the codebase:

1. ❌ `backend/src/services/collectors/google-aio-collector.service.ts` 
   - **Reality:** The actual file is at `backend/src/services/data-collection/google-aio-collector.service.ts`

2. ❌ `backend/src/services/collectors/chatgpt-collector.service.ts`
   - **Reality:** ChatGPT is handled via `oxylabs-collector.service.ts` and `brightdata-collector.service.ts`

3. ❌ `backend/src/services/collectors/perplexity-collector.service.ts`
   - **Reality:** Perplexity is handled via `oxylabs-collector.service.ts` and `dataforseo-collector.service.ts`

4. ❌ `backend/src/services/collectors/oxylabs-perplexity-collector.service.ts`
   - **Reality:** Perplexity via Oxylabs is handled in `oxylabs-collector.service.ts`

---

## 📊 **AI/LLM SERVICES (All Used)**

1. **`backend/src/services/query-generation.service.ts`** ✅
   - Uses Cerebras AI API and OpenAI API
   - **Status:** Actively used

2. **`backend/src/services/keywords/keyword-generation.service.ts`** ✅
   - Uses Cerebras AI API and OpenAI API
   - **Status:** Actively used

3. **`backend/src/services/keywords/trending-keywords.service.ts`** ✅
   - Uses Google Gemini API
   - **Status:** Actively used

4. **`backend/src/services/brand.service.ts`** ✅
   - Uses Cerebras AI API and OpenAI API for categorization
   - **Status:** Actively used

5. **`backend/src/services/auth/auth.service.ts`** ✅
   - Google OAuth authentication
   - **Status:** Actively used

---

## 📋 **SUMMARY**

### Total Collector Services: 9
- **Actively Used:** 8 ✅
- **Unused:** 1 ❌ (`anthropic-collector.service.ts`)

### Services That Don't Exist: 4
- All mentioned `collectors/` subdirectory services don't exist (they're in `data-collection/`)

### Recommendation

**You can safely remove:**
- `backend/src/services/data-collection/anthropic-collector.service.ts` (unused)

**All other services are actively used and should be kept.**

---

## 🔍 **How Collectors Are Actually Routed**

1. **ChatGPT:** `priority-collector.service.ts` → Oxylabs → BrightData → OpenAI Direct
2. **Google AIO:** `priority-collector.service.ts` → Oxylabs → BrightData → DataForSEO → Google AIO Direct
3. **Perplexity:** `priority-collector.service.ts` → Oxylabs → BrightData → DataForSEO → Perplexity Direct
4. **Claude:** `priority-collector.service.ts` → DataForSEO (NOT direct Anthropic API)
5. **Bing Copilot:** `priority-collector.service.ts` → BrightData
6. **Grok:** `priority-collector.service.ts` → BrightData
7. **Gemini:** `priority-collector.service.ts` → BrightData → Google Gemini Direct
8. **DeepSeek:** `data-collection.service.ts` → OpenRouter
9. **Baidu:** `data-collection.service.ts` → DataForSEO

