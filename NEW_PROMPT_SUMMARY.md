# New Prompt Summary & Implementation Changes

## Prompt Summary

**Purpose:** Generate Topics and Queries together in a single LLM call during onboarding.

**Key Features:**
- **Input:** Only Brand Name (simpler than current system)
- **Output:** 50 Topics (5 per Intent Archetype × 10 Archetypes) + 50 Queries (1 per Topic)
- **Structure:** Topics organized by 10 predefined Intent Archetypes
- **Queries:** Natural-language questions without brand names

**10 Intent Archetypes:**
1. `best_of`
2. `comparison`
3. `alternatives`
4. `pricing_or_value`
5. `use_case`
6. `how_to`
7. `problem_solving`
8. `beginner_explain`
9. `expert_explain`
10. `technical_deep_dive`

**Output per Topic:**
- Topic name (short descriptive phrase)
- 1-2 sentence description
- One natural-language query (user question format, no brand name)

---

## Major Changes from Current System

| Aspect | Current System | New System |
|--------|---------------|------------|
| **Topics Generated** | 5-8 topics | 50 topics (5 per intent) |
| **Topic Source** | Brand Intelligence call (#1) | Separate call (replaces query generation) |
| **Query Generation** | Separate call after topics | Combined with topic generation |
| **Intent System** | 4 categories (awareness/comparison/purchase/support) | 10 archetypes (best_of, comparison, etc.) |
| **Input Required** | Brand name + industry + competitors + keywords | Brand name only |
| **Output Structure** | Topics array, then queries array | Topics with queries embedded |

---

## Code Changes Required

### 1. **Create New Service Function**
**File:** `backend/src/services/query-generation.service.ts`

**Action:** Add new method `generateTopicsAndQueriesWithNewPrompt()`

**Changes:**
- Replace current `buildCerebrasPrompt()` logic with new prompt structure
- Accept only `brandName` as input (no industry/competitors/keywords needed)
- Parse response to extract 50 topics with their queries
- Map new intent archetypes to existing system if needed

### 2. **Update Brand Intelligence Call**
**File:** `backend/src/services/onboarding-intel.service.ts`

**Action:** Modify `generateBrandIntelWithLLM()` to skip topic generation

**Changes:**
- Remove topics from the brand intelligence prompt (lines 444-462)
- Remove topics from expected JSON response (line 441)
- Topics will now come from the new prompt instead

### 3. **Update Query Generation Flow**
**File:** `backend/src/services/brand.service.ts`

**Action:** Replace query generation call with new topics+queries generation

**Changes:**
- In `createBrand()` method (around line 576), replace:
  ```typescript
  queryGenResult = await queryGenerationService.generateSeedQueries({...})
  ```
- With:
  ```typescript
  const topicsAndQueries = await queryGenerationService.generateTopicsAndQueriesWithNewPrompt(brandName);
  ```

### 4. **Handle New Output Format**
**Action:** Parse and store 50 topics with queries

**Changes:**
- Parse response with structure: `{ intentArchetype: [{ topic, description, query }] }`
- Store topics in `brand_topics` table with new intent archetype
- Store queries in `generated_queries` table linked to topics
- Map intent archetypes to existing category system if needed

### 5. **Database Schema Updates (if needed)**
**Action:** Check if `brand_topics` table supports intent archetypes

**Changes:**
- May need to add `intent_archetype` column to `brand_topics` table
- Or map archetypes to existing `category` field (awareness/comparison/purchase/support)

### 6. **Update Response Parsing**
**File:** `backend/src/services/query-generation.service.ts`

**Action:** Add parser for new JSON structure

**Changes:**
- Parse nested structure: 10 intent groups → 5 topics each → 1 query per topic
- Extract and flatten to existing data structures
- Handle the "primary domain of value" field if included in response

---

## Implementation Steps

1. **Add new prompt method** in `query-generation.service.ts`
2. **Test prompt** with sample brand to verify output format
3. **Update brand intelligence** to skip topic generation
4. **Update onboarding flow** to use new method
5. **Update database** if schema changes needed
6. **Test end-to-end** onboarding with new prompt

---

## Files to Modify

1. `backend/src/services/query-generation.service.ts` - Add new prompt method
2. `backend/src/services/onboarding-intel.service.ts` - Remove topics from brand intel
3. `backend/src/services/brand.service.ts` - Update onboarding flow
4. Database migration (if needed) - Add intent_archetype support

---

## Testing Considerations

- Verify 50 topics are generated (5 per intent × 10 intents)
- Verify queries don't include brand names
- Verify queries are natural-language questions
- Test with different brand types (B2B, B2C, SaaS, e-commerce, etc.)
- Ensure backward compatibility if rolling back

