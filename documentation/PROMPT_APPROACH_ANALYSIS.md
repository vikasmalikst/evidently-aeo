# Prompt Approach Analysis & Recommendations

## Comparison: Current vs New Approach

### Current System
- **Topics:** 5-8 topics (generated in brand intelligence call)
- **Queries:** Generated separately after topics exist
- **Input:** Brand name + industry + competitors + keywords
- **Intent System:** 4 categories (awareness/comparison/purchase/support)
- **Output Format:** `[{ topic, query, intent, priority }]`

### New System
- **Topics:** 50 topics (5 per intent archetype × 10 archetypes)
- **Queries:** Generated together with topics
- **Input:** Brand name only
- **Intent System:** 10 archetypes (best_of, comparison, alternatives, etc.)
- **Output Format:** Not specified (needs definition)

---

## Pros & Cons Analysis

### ✅ New Approach Advantages

1. **Simpler Input**
   - Only needs brand name (easier for users)
   - Less data collection required upfront

2. **Better Topic-Query Alignment**
   - Topics and queries generated together ensures they match
   - No risk of mismatched topics/queries

3. **More Structured Intent System**
   - 10 specific archetypes vs 4 broad categories
   - More granular intent classification

4. **Comprehensive Coverage**
   - 50 topics provides extensive coverage
   - Better for brands with diverse offerings

### ❌ New Approach Concerns

1. **Too Many Topics (50)**
   - **Problem:** Overwhelming for users to manage
   - **Problem:** Many topics may be irrelevant for smaller brands
   - **Problem:** Harder to prioritize and focus efforts
   - **Problem:** More expensive (larger LLM output)

2. **Rigid Structure**
   - **Problem:** Forces 5 topics per intent (may not fit all brands)
   - **Problem:** Some intents may not apply to certain brands
   - **Problem:** Less flexibility for brand-specific needs

3. **Loss of Context**
   - **Problem:** No industry/competitor context in prompt
   - **Problem:** May generate generic topics for niche brands
   - **Problem:** Can't leverage existing brand intelligence data

4. **Fixed Intent Archetypes**
   - **Problem:** 10 archetypes may not cover all use cases
   - **Problem:** Harder to map to existing 4-category system
   - **Problem:** May need database schema changes

---

## 🎯 Recommended Hybrid Approach

**Best of Both Worlds:**

### Option 1: Adaptive Topic Count (Recommended)
- Generate topics using new prompt structure
- **But:** Allow LLM to generate 3-7 topics per intent (not fixed 5)
- **Result:** ~30-70 topics total (more manageable)
- Keep intent archetypes but make them flexible

### Option 2: Two-Tier System
- **Tier 1:** Generate 8-12 high-level topics (current approach)
- **Tier 2:** For each topic, generate 3-5 sub-topics using new intent archetypes
- **Result:** Better organization, manageable count

### Option 3: Smart Filtering
- Generate all 50 topics using new prompt
- **Then:** Use LLM or rules to filter to top 10-15 most relevant
- **Result:** Best coverage with manageable size

---

## 📋 Output Format Recommendation

### Use Structured JSON (Ask LLM for Specific Format)

**Recommended Format:**
```json
{
  "primaryDomain": "string (1-2 sentences)",
  "topics": [
    {
      "intentArchetype": "best_of|comparison|alternatives|...",
      "topic": "short descriptive phrase",
      "description": "1-2 sentence description",
      "query": "natural language question (no brand name)",
      "priority": 1-5
    }
  ]
}
```

**Why This Format:**
- ✅ Matches current database structure (can map easily)
- ✅ Includes all required fields
- ✅ Easy to parse and validate
- ✅ Can filter/sort by priority
- ✅ Intent archetype clearly defined

**Alternative: Nested by Intent**
```json
{
  "primaryDomain": "string",
  "intents": {
    "best_of": [
      { "topic": "...", "description": "...", "query": "...", "priority": 1 }
    ],
    "comparison": [...],
    ...
  }
}
```

**Recommendation:** Use flat array format (first option) - easier to process and store.

---

## 🔧 Suggested Improvements to New Prompt

### 1. Make Topic Count Flexible
```
For each Intent Archetype, generate 3-7 distinct Topics (not fixed 5).
Generate more topics for intents that are highly relevant to this brand,
and fewer (or skip) intents that are less relevant.
```

### 2. Add Context Awareness
```
You may use the following context if available:
- Industry: [industry]
- Competitors: [competitors]
- Brand description: [description]

Use this context to make topics more relevant and specific.
```

### 3. Add Priority/Relevance Scoring
```
For each topic, assign a priority score (1-5) based on:
- Relevance to the brand's primary domain
- Likely user search volume
- Business value potential
```

### 4. Allow Intent Skipping
```
If an Intent Archetype is not relevant to this brand, you may skip it
or generate fewer topics. Focus on the most relevant intents.
```

### 5. Specify Output Format Explicitly
```
OUTPUT FORMAT (CRITICAL - Return ONLY valid JSON):
{
  "primaryDomain": "1-2 sentence description",
  "topics": [
    {
      "intentArchetype": "best_of|comparison|alternatives|pricing_or_value|use_case|how_to|problem_solving|beginner_explain|expert_explain|technical_deep_dive",
      "topic": "short descriptive phrase (2-5 words)",
      "description": "1-2 sentence explanation",
      "query": "natural language question without brand name",
      "priority": 1-5
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No markdown, no explanations, no text before or after.
```

---

## 💡 Implementation Strategy

### Phase 1: Test New Prompt (Recommended)
1. Implement new prompt as **optional feature flag**
2. Test with 5-10 brands
3. Compare results with current system
4. Measure: topic relevance, query quality, user feedback

### Phase 2: Hybrid Approach
1. Use new prompt structure
2. Add filtering to reduce to 15-20 most relevant topics
3. Keep existing 4-category intent system for backward compatibility
4. Map new archetypes to existing categories

### Phase 3: Full Migration (If Successful)
1. Replace current system
2. Update database schema if needed
3. Migrate existing brands gradually

---

## 🎯 Final Recommendation

**Use the new prompt structure BUT with these modifications:**

1. ✅ **Flexible topic count** (3-7 per intent, not fixed 5)
2. ✅ **Allow intent skipping** (don't force all 10 intents)
3. ✅ **Add context** (industry, competitors if available)
4. ✅ **Filter to top 15-20 topics** (manageable size)
5. ✅ **Use structured JSON output** (specify exact format)
6. ✅ **Add priority scoring** (help with filtering/ranking)
7. ✅ **Map to existing intent system** (backward compatibility)

**Expected Result:**
- ~20-30 high-quality topics (instead of 50)
- Better topic-query alignment
- More structured intent classification
- Still manageable for users
- Compatible with existing system

---

## 📝 Code Changes Summary

### Minimal Changes (Recommended)
1. Add new prompt method (keep old one as fallback)
2. Add topic filtering/ranking logic
3. Map new intent archetypes to existing categories
4. Use existing output format structure
5. Add feature flag to toggle between approaches

### Database Changes
- **Option A:** Add `intent_archetype` column to `brand_topics` table
- **Option B:** Store in `metadata` JSON field (no schema change)
- **Recommendation:** Option B (more flexible, no migration needed)

---

## ⚠️ Risks to Consider

1. **50 topics is too many** - Users may get overwhelmed
2. **Fixed structure** - May not fit all brand types
3. **Loss of context** - Generic topics for niche brands
4. **Cost increase** - Larger LLM outputs = higher costs
5. **Migration complexity** - Existing brands need handling

**Mitigation:** Start with feature flag, test thoroughly, filter topics, keep old system as fallback.

