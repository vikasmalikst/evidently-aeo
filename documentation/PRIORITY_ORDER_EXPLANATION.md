# Citation Categorization Priority Order - Explanation

## What is Priority Order?

The **priority order** is the sequence in which the system tries to categorize a citation URL. It goes from fastest/cheapest to slowest/most expensive, stopping as soon as it finds a match.

## The 4-Step Priority Order

### 1. Database Cache (Fastest, No API Call) ⚡
**What it does**: Checks if we've seen this domain before and already categorized it.

**How it works**:
- Queries the `citation_categories` table by domain
- If found → Returns immediately (no API call, no processing)
- If not found → Moves to next step

**Example**:
```
URL: https://techcrunch.com/article-123
→ Check database for "techcrunch.com"
→ Found! Category: "Editorial"
→ Return immediately ✅ (0ms, $0)
```

**Benefits**:
- ⚡ Fastest (database query ~1-5ms)
- 💰 Free (no API costs)
- ✅ Consistent (same domain = same category)

---

### 2. Hardcoded Patterns (Fast, Reliable) 🎯
**What it does**: Checks against a list of known domains we've pre-defined in code.

**How it works**:
- Compares domain against hardcoded list (e.g., `techcrunch.com`, `forbes.com`)
- If matches → Returns category immediately
- Also stores in database for future use (step 1)

**Example**:
```
URL: https://techcrunch.com/new-article
→ Check hardcoded patterns
→ Matches: techcrunch.com → "Editorial"
→ Store in database
→ Return "Editorial" ✅ (1ms, $0)
```

**Benefits**:
- ⚡ Very fast (in-memory check)
- 💰 Free (no API costs)
- 🎯 100% accurate (we know these domains)

**Note**: After this migration, all hardcoded domains are pre-populated in the database, so they'll be caught in step 1 instead!

---

### 3. Simple Heuristics (Fast, Medium Confidence) 🔍
**What it does**: Uses simple pattern matching rules (e.g., `.edu` = Institutional, `wiki` = Reference).

**How it works**:
- Checks domain for patterns:
  - Ends with `.edu` → Institutional
  - Ends with `.gov` → Institutional
  - Contains `wiki` → Reference
  - Contains `news` or `blog` → Editorial
  - Contains `review` → UGC
- If matches → Returns category
- Stores in database for future use

**Example**:
```
URL: https://harvard.edu/research
→ Check heuristics
→ Ends with ".edu" → "Institutional"
→ Store in database
→ Return "Institutional" ✅ (1ms, $0)
```

**Benefits**:
- ⚡ Fast (pattern matching)
- 💰 Free (no API costs)
- 📊 Medium confidence (works for common patterns)

---

### 4. AI Categorization (Slow, Expensive) 🤖
**What it does**: Makes an API call to an LLM (Cerebras/Gemini) to categorize the domain.

**How it works**:
- Sends domain to AI service
- AI analyzes and returns category
- Stores in database for future use (so next time it's step 1!)

**Example**:
```
URL: https://obscure-startup.com
→ Check database (not found)
→ Check hardcoded (not found)
→ Check heuristics (no match)
→ Call AI API
→ AI returns: "Corporate"
→ Store in database
→ Return "Corporate" ✅ (500-2000ms, $0.001-0.01)
```

**Benefits**:
- 🧠 Intelligent (can categorize unknown domains)
- 📈 High confidence (AI analysis)
- ⚠️ Slow (500-2000ms API call)
- 💰 Costs money (per API call)

---

## Visual Flow

```
Citation URL comes in
        ↓
┌───────────────────────┐
│ 1. Database Cache?    │ ← Fastest, Free
│    ✅ Found → Return  │
│    ❌ Not Found       │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 2. Hardcoded Pattern? │ ← Fast, Free
│    ✅ Match → Return  │
│    ❌ No Match        │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 3. Simple Heuristics? │ ← Fast, Free
│    ✅ Match → Return  │
│    ❌ No Match        │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 4. AI Categorization  │ ← Slow, Costs Money
│    ✅ Return          │
│    Store in DB        │
└───────────────────────┘
```

## Why This Order?

1. **Cost Efficiency**: Check free options first, only pay for AI when needed
2. **Speed**: Fast checks first, slow API calls last
3. **Learning**: Once AI categorizes something, it's cached (becomes step 1 next time)

## Real-World Example

**First time seeing `techcrunch.com`**:
1. Database cache → Not found
2. Hardcoded pattern → ✅ Found! "Editorial"
3. Store in database
4. Return "Editorial"

**Second time seeing `techcrunch.com`** (different URL):
1. Database cache → ✅ Found! "Editorial"
2. Return immediately (skips steps 2-4)

**First time seeing `obscure-startup.com`**:
1. Database cache → Not found
2. Hardcoded pattern → Not found
3. Simple heuristics → No match
4. AI categorization → "Corporate"
5. Store in database
6. Return "Corporate"

**Second time seeing `obscure-startup.com`**:
1. Database cache → ✅ Found! "Corporate"
2. Return immediately

## After Pre-Population

After running the migration that pre-populates hardcoded domains:

- All hardcoded domains (techcrunch.com, forbes.com, etc.) are now in the database
- They'll be caught in **step 1** (database cache) instead of step 2
- Even faster! ⚡⚡⚡
