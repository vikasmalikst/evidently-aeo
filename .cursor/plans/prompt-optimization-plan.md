# Prompt Optimization Plan for Recommendations V3

## Current State Analysis

### KPI Identification Prompt (`identifyKPIs`)
**Currently includes:**
1. ✅ Brand name & industry (ESSENTIAL)
2. ✅ Brand metrics: Visibility, SOA, Sentiment (ESSENTIAL)
3. ⚠️ Trends (30d vs previous) - **Potentially helpful but adds complexity**
4. ❌ Competitor summary - **NOT ESSENTIAL for KPI identification**
5. ✅ Top Citation Sources - **Helpful for context but not critical for KPI selection**

### Recommendation Generation Prompt (`generateRecommendationsForKPIs`)
**Currently includes:**
1. ✅ Brand name & industry (ESSENTIAL)
2. ✅ Brand metrics: Visibility, SOA, Sentiment (ESSENTIAL)
3. ✅ Top Citation Sources - **CRITICAL** (needed to generate domain-specific recommendations)
4. ✅ Identified KPIs - **CRITICAL** (needed to generate recommendations per KPI)
5. ✅ No competitor summary (already optimized)
6. ✅ No LLM summary (already optimized)

## Issues Identified

1. **Competitor Summary in KPI Prompt**: 
   - Adds noise without clear benefit
   - KPI identification should focus on brand's own performance gaps
   - Competitor data can be inferred from trends if needed

2. **Trends Data**:
   - Can be helpful but adds complexity
   - May confuse the LLM if trends are inconsistent
   - Brand's current metrics are more important than trends for KPI selection

3. **Top Citation Sources in KPI Prompt**:
   - Not needed for KPI identification
   - Should only be in recommendation generation prompt

## Optimization Plan

### Phase 1: Simplify KPI Identification Prompt
**Remove:**
- ❌ Competitor summary section
- ⚠️ Trends section (optional - keep if user wants)
- ❌ Top Citation Sources (not needed for KPI selection)

**Keep:**
- ✅ Brand name & industry
- ✅ Brand metrics (Visibility, SOA, Sentiment)
- ✅ Clear instructions on what KPIs to identify

**Result:** Cleaner, more focused prompt that helps LLM identify KPIs based on brand's own performance gaps.

### Phase 2: Keep Recommendation Generation Prompt Lean
**Already optimized:**
- ✅ Only includes essential data
- ✅ Focuses on actionable recommendations
- ✅ No unnecessary competitor/LLM summaries

**Potential minor improvements:**
- Could add brief context about why each KPI was selected (from KPI description)

## Expected Benefits

1. **Faster Processing**: Shorter prompts = faster LLM responses
2. **Better Accuracy**: Less noise = more focused KPI identification
3. **Lower Costs**: Fewer tokens = lower API costs
4. **More Reliable**: Simpler prompts = more consistent JSON output
5. **Easier Debugging**: Less data = easier to identify issues

## Implementation Steps

1. Remove competitor summary from `identifyKPIs` prompt
2. Remove trends section (or make optional)
3. Remove Top Citation Sources from KPI identification (keep only in recommendation generation)
4. Simplify KPI identification instructions
5. Test with existing brands to ensure quality maintained
6. Monitor JSON parsing success rate

## Risk Assessment

**Low Risk:**
- Removing competitor summary (brand metrics are sufficient)
- Removing Top Citation Sources from KPI prompt (not needed there)

**Medium Risk:**
- Removing trends (may lose context about declining metrics, but current values are more important)

**Mitigation:**
- Keep trends as optional (can be re-enabled if needed)
- Monitor KPI quality after changes
- Can always add back if recommendations quality degrades

