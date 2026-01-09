# Recommendations Engine Improvement Plan

## Overview

This plan addresses two critical areas:
1. **Competitor Leakage**: Recommendations are including competitor brands/sources despite explicit prompts to exclude them
2. **Recommendation Quality**: Enhancements needed to make recommendations more meaningful, actionable, and valuable to customers

The recommendations engine is a key differentiator, so these improvements are high priority.

---

## Priority 1: Fix Competitor Leakage (CRITICAL - Do First)

### Problem Statement
The LLM is generating recommendations that mention competitor brands or suggest actions on competitor domains, even when explicitly instructed not to. This is a critical flaw that undermines trust and product value.

### Root Cause Analysis
- **Current approach**: Relies solely on prompt instructions ("Do NOT mention competitors")
- **LLM behavior**: LLMs can ignore or "helpfully" include competitors when they think it's relevant
- **No deterministic filtering**: No code-level enforcement after generation
- **Competitor data in context**: Competitor metrics are included in the prompt context, which may prime the LLM to mention them

### Solution: Multi-Layer Competitor Filtering

#### Layer 1: Pre-Generation Data Filtering (Highest Priority)
**Location**: `backend/src/services/recommendations/recommendation-v3.service.ts` and `recommendation.service.ts`

**Actions**:
1. **Build comprehensive competitor exclusion list**:
   - Extract all competitor names from `brand_competitors` table
   - Include competitor domains (if stored or can be resolved)
   - Add common aliases/variations (e.g., "Acme Corp" → "Acme", "Acme Corporation")
   - Store in a normalized set for fast lookup

2. **Filter source metrics before prompt**:
   - Before building the prompt, filter `sourceMetrics` array to exclude any sources that belong to competitors
   - Match by domain name against competitor domains
   - This prevents competitor sources from appearing in the "Available Citation Sources" list

3. **Remove competitor context from prompt**:
   - Keep competitor metrics for internal gap analysis, but don't include competitor names/domains in the prompt
   - Only include aggregated competitor averages (e.g., "Competitor average SOA: 45%") without naming specific competitors
   - Remove the "Competitors" section that lists competitor names

**Files to Modify**:
- `backend/src/services/recommendations/recommendation-v3.service.ts`:
  - `gatherBrandContext()`: Filter sourceMetrics to exclude competitor domains
  - `generateRecommendationsDirect()`: Remove competitor names from prompt, only include aggregated metrics
- `backend/src/services/recommendations/recommendation.service.ts`:
  - `gatherBrandContext()`: Same filtering
  - `buildPrompt()`: Remove competitor names section

#### Layer 2: Post-Generation Hard Filter (Must-Have Safety Net)
**Location**: After LLM response parsing, before saving to database

**Actions**:
1. **Create competitor detection utility**:
   - Function: `containsCompetitorReference(text: string, competitorNames: string[]): boolean`
   - Check for exact matches, case-insensitive
   - Check for partial matches (competitor name within text)
   - Check for domain matches (if competitor domains are known)

2. **Filter recommendations after parsing**:
   - After parsing LLM JSON response, iterate through each recommendation
   - Check all text fields: `action`, `reason`, `explanation`, `contentFocus`, `citationSource`, `focusSources`
   - If any field contains a competitor reference:
     - **Option A (Recommended)**: Drop the recommendation entirely and log a warning
     - **Option B**: Attempt to regenerate that specific recommendation with stricter constraints
     - **Option C**: Replace competitor mentions with generic terms (e.g., "another provider" → but this is risky)

3. **Validation before database save**:
   - Add a validation step in `saveRecommendationsToDatabase()` or `saveToDatabase()`
   - Re-check all recommendations one final time before insertion
   - Log all filtered recommendations for monitoring

**Files to Create/Modify**:
- **New file**: `backend/src/services/recommendations/competitor-filter.service.ts`
  - `containsCompetitorReference()`
  - `filterCompetitorReferences()`
  - `getCompetitorExclusionList()`
- Modify: `recommendation-v3.service.ts` → `generateRecommendationsDirect()` → after JSON parsing
- Modify: `recommendation.service.ts` → `parseRecommendations()` → after parsing

#### Layer 3: Structured Output Enforcement
**Location**: Prompt engineering + response parsing

**Actions**:
1. **Enforce structured JSON with validation**:
   - Add explicit schema validation in the prompt
   - Use JSON schema or TypeScript types to validate parsed responses
   - Ensure `citationSource` is validated against the allowed list (already partially done)

2. **Citation source whitelist validation**:
   - After parsing, validate that `citationSource` is in the pre-filtered allowed list
   - If not, either drop the recommendation or replace with closest match from allowed list

**Files to Modify**:
- `recommendation-v3.service.ts`: Add validation after JSON parsing
- `recommendation.service.ts`: Add validation after JSON parsing

#### Layer 4: Enhanced Prompting (Supporting Layer)
**Location**: Prompt building functions

**Actions**:
1. **Strengthen prompt instructions**:
   - Move competitor exclusion to the top of RULES section
   - Use stronger language: "CRITICAL: Any recommendation mentioning a competitor will be automatically rejected"
   - Add examples of what NOT to do
   - Use negative examples in few-shot prompting if possible

2. **Remove competitor priming**:
   - Don't include competitor names in the prompt at all (only aggregated metrics)
   - If competitor comparison is needed, phrase as "industry average" or "benchmark"

**Files to Modify**:
- `recommendation-v3.service.ts` → `generateRecommendationsDirect()` → prompt building
- `recommendation.service.ts` → `buildPrompt()` → prompt building

### Implementation Order (Priority 1)
1. **Week 1**: Layer 1 (Pre-generation filtering) - Highest impact, prevents the problem at source
2. **Week 1**: Layer 2 (Post-generation filter) - Safety net, catches any leaks
3. **Week 2**: Layer 3 (Structured validation) - Quality assurance
4. **Week 2**: Layer 4 (Enhanced prompting) - Supporting improvement

### Success Metrics
- **Competitor leakage rate**: 0% (zero recommendations mentioning competitors)
- **False positive rate**: < 1% (legitimate recommendations incorrectly filtered)
- **Monitoring**: Log all filtered recommendations for review

---

## Priority 2: Improve Recommendation Meaningfulness

### Problem Statement
Recommendations need to be more meaningful, specific, and actionable. Current recommendations may be too generic or not tied closely enough to actual data gaps.

### Gap Analysis

#### Gap 1: Weak Data-to-Recommendation Linkage
**Current State**:
- Recommendations are generated from high-level metrics (visibility, SOA, sentiment)
- Connection between detected problems and specific recommendations is sometimes weak
- LLM may generate recommendations that don't directly address the root cause

**Improvement**:
1. **Strengthen problem-to-recommendation mapping**:
   - Each recommendation must explicitly reference a detected problem ID (e.g., "[P1]")
   - Include actual metric values in the recommendation reason
   - Show the gap being addressed (e.g., "Your SOA is 30% vs 45% benchmark")

2. **Add evidence-based reasoning**:
   - Include specific data points: "Source X has 50 citations but 0% SOA for your brand"
   - Reference actual trends: "SOA declined 15% in the last 30 days"
   - Link to specific sources with metrics

**Files to Modify**:
- `recommendation-v3.service.ts` → `generateRecommendationsDirect()` → prompt building
- `recommendation.service.ts` → `buildPrompt()` → include more specific problem details

#### Gap 2: Generic vs. Specific Actions
**Current State**:
- Some recommendations may be too generic ("Create high-quality content")
- Not specific enough about what type of content, where, and why

**Improvement**:
1. **Enforce specific action format**:
   - Ban generic phrases in prompt: "Do NOT use phrases like 'create high-quality content' or 'improve SEO'"
   - Require specific actions: "Publish a data-driven report on [specific topic] targeting [specific source]"
   - Include content type, topic, and target source in every action

2. **Add content strategy details**:
   - Specify content format (article, FAQ, video script, etc.)
   - Include target keywords/topics
   - Reference specific source requirements (e.g., "Reddit requires community engagement")

**Files to Modify**:
- Prompt building in both recommendation services
- Add validation to ensure actions meet specificity requirements

#### Gap 3: Missing Impact Quantification
**Current State**:
- `expectedBoost` is provided but may not be well-calibrated
- No clear connection between action and expected metric improvement

**Improvement**:
1. **Calibrate expected boost**:
   - Base `expectedBoost` on actual historical data when available
   - Use source-specific benchmarks (e.g., "Similar brands saw 5-10% SOA increase on Reddit")
   - Provide ranges with confidence levels

2. **Add impact breakdown**:
   - Show which specific metric will improve (Visibility, SOA, or Sentiment)
   - Quantify the expected change in absolute terms (e.g., "SOA: 30% → 35%")
   - Include timeline for when impact should be visible

**Files to Modify**:
- Add impact calculation logic based on historical data
- Update prompt to request more specific impact predictions

#### Gap 4: Lack of Prioritization Logic
**Current State**:
- Priority (High/Medium/Low) is assigned by LLM without clear criteria
- No systematic way to rank recommendations by ROI or urgency

**Improvement**:
1. **Implement data-driven prioritization**:
   - Calculate priority score based on:
     - Gap size (larger gaps = higher priority)
     - Trend direction (declining metrics = higher priority)
     - Source authority (higher impact sources = higher priority)
     - Effort required (lower effort + high impact = higher priority)
   - Use calculated score to assign priority, not just LLM judgment

2. **Add ROI calculation**:
   - Estimate effort vs. impact ratio
   - Rank recommendations by expected ROI
   - Surface "quick wins" (low effort, high impact) first

**Files to Modify**:
- `recommendation-v3.service.ts` → Add `calculatePriorityScore()` method
- `recommendation.service.ts` → Enhance `rankRecommendations()` with priority scoring
- Update database schema if needed to store calculated priority scores

#### Gap 5: Insufficient Context About Customer's Current State
**Current State**:
- Recommendations may suggest actions the customer is already doing
   - No check against existing content/activities
   - May recommend sources where customer already has presence

**Improvement**:
1. **Add "already doing" detection**:
   - Check if customer already has content on recommended sources
   - Query `extracted_positions` or `metric_facts` to see if brand already appears on source
   - Filter out recommendations for sources where brand already has strong presence (unless there's a decline)

2. **Focus on gaps, not strengths**:
   - Prioritize recommendations for sources where brand is underperforming
   - Avoid recommending actions on sources where brand is already strong (unless declining)

**Files to Modify**:
- `gatherBrandContext()`: Add check for existing brand presence on sources
- Filter recommendations based on current brand performance on each source

#### Gap 6: Missing Success Criteria and Measurement
**Current State**:
- Recommendations don't clearly define what success looks like
- No way to measure if recommendation was effective after implementation

**Improvement**:
1. **Add success metrics**:
   - Define specific, measurable success criteria for each recommendation
   - Example: "Success = SOA increases from 30% to 35% on reddit.com within 4 weeks"
   - Include baseline metrics to compare against

2. **Add tracking hooks**:
   - Store baseline metrics when recommendation is generated
   - Enable comparison after implementation (already partially done in V3 with `kpi_before_value` and `kpi_after_value`)
   - Add dashboard to show recommendation effectiveness

**Files to Modify**:
- Enhance V3 workflow to capture more baseline metrics
- Add success criteria field to recommendations table
- Create analytics endpoint to track recommendation ROI

### Implementation Order (Priority 2)
1. **Week 3**: Gap 1 (Data-to-recommendation linkage) - Foundation for all other improvements
2. **Week 3**: Gap 2 (Specific actions) - Immediate user-facing improvement
3. **Week 4**: Gap 4 (Prioritization logic) - Helps users focus on what matters
4. **Week 4**: Gap 5 (Current state context) - Prevents redundant recommendations
5. **Week 5**: Gap 3 (Impact quantification) - Enhances trust and decision-making
6. **Week 5**: Gap 6 (Success criteria) - Enables measurement and iteration

---

## Priority 3: Architecture and Quality Improvements

### 3.1 Add Comprehensive Logging and Monitoring

**Problem**: Limited visibility into recommendation generation quality and failures.

**Actions**:
1. **Add structured logging**:
   - Log all prompts (redacted for PII)
   - Log LLM responses (raw and parsed)
   - Log filtered recommendations (competitor leakage, validation failures)
   - Log performance metrics (generation time, token usage, API costs)

2. **Create monitoring dashboard**:
   - Track competitor leakage incidents
   - Monitor recommendation quality scores
   - Track user engagement with recommendations
   - Alert on anomalies (sudden drop in quality, API failures)

**Files to Create**:
- `backend/src/services/recommendations/recommendation-logger.service.ts`
- Add logging throughout recommendation services

### 3.2 Add Quality Evaluation Framework

**Problem**: No systematic way to evaluate recommendation quality.

**Actions**:
1. **Create evaluation criteria**:
   - Relevance score (does it address a real gap?)
   - Specificity score (is the action specific enough?)
   - Actionability score (can the user actually do this?)
   - Evidence score (is it backed by data?)

2. **Build evaluation harness**:
   - Create test set of brands with known gaps
   - Generate recommendations and score them
   - Track quality metrics over time
   - Use for A/B testing improvements

**Files to Create**:
- `backend/src/services/recommendations/recommendation-evaluator.service.ts`
- Test suite for recommendation quality

### 3.3 Improve Error Handling and Fallbacks

**Problem**: Failures in recommendation generation may not be handled gracefully.

**Actions**:
1. **Add retry logic**:
   - Retry LLM calls on transient failures
   - Fallback to simpler prompts if complex generation fails
   - Cache successful generations to avoid regeneration

2. **Add partial success handling**:
   - If some recommendations fail to generate, return the successful ones
   - Log failures for investigation
   - Provide user feedback on partial results

**Files to Modify**:
- Both recommendation services: Add retry logic and error handling

### 3.4 Optimize Performance

**Problem**: Recommendation generation may be slow or expensive.

**Actions**:
1. **Cache brand context**:
   - Cache `gatherBrandContext()` results for a short period (e.g., 1 hour)
   - Invalidate on data updates

2. **Parallelize operations**:
   - Fetch competitor metrics in parallel
   - Fetch source metrics in parallel
   - Use Promise.all where possible

3. **Optimize database queries**:
   - Review and optimize queries in `gatherBrandContext()`
   - Add indexes if needed
   - Use batch queries where possible

**Files to Modify**:
- `gatherBrandContext()` in both services: Add caching and parallelization

---

## Priority 4: User Experience Enhancements

### 4.1 Add Recommendation Explanations

**Problem**: Users may not understand why a recommendation was generated.

**Actions**:
1. **Enhance explanation field**:
   - Include specific data points that led to the recommendation
   - Show the gap being addressed
   - Reference the detected problem

2. **Add "Why this matters" section**:
   - Explain the business impact
   - Show how this connects to overall brand goals
   - Include industry context if relevant

### 4.2 Add Recommendation Templates

**Problem**: Similar recommendations may be generated repeatedly.

**Actions**:
1. **Create recommendation templates**:
   - Common patterns (e.g., "Improve FAQ content on [source]")
   - Allow customization per brand/industry
   - Use templates as starting point for LLM generation

2. **Learn from successful recommendations**:
   - Track which recommendations users complete
   - Identify patterns in successful recommendations
   - Use these patterns to improve future generations

### 4.3 Add Recommendation Validation UI

**Problem**: Users can't easily validate if a recommendation makes sense.

**Actions**:
1. **Show supporting data**:
   - Display the source metrics that led to the recommendation
   - Show trend data
   - Include competitor benchmarks (without naming competitors)

2. **Add "Does this make sense?" feedback**:
   - Allow users to flag recommendations as incorrect
   - Collect feedback to improve future generations
   - Use feedback to refine prompts and logic

---

## Implementation Timeline

### Phase 1: Critical Fixes (Weeks 1-2)
- ✅ Priority 1: Fix competitor leakage (Layers 1-4)
- ✅ Priority 2, Gap 1: Strengthen data-to-recommendation linkage
- ✅ Priority 2, Gap 2: Enforce specific actions

### Phase 2: Quality Improvements (Weeks 3-4)
- ✅ Priority 2, Gap 4: Data-driven prioritization
- ✅ Priority 2, Gap 5: Current state context
- ✅ Priority 3.1: Logging and monitoring

### Phase 3: Enhancement (Weeks 5-6)
- ✅ Priority 2, Gap 3: Impact quantification
- ✅ Priority 2, Gap 6: Success criteria
- ✅ Priority 3.2: Quality evaluation framework
- ✅ Priority 3.3: Error handling improvements

### Phase 4: Optimization (Weeks 7-8)
- ✅ Priority 3.4: Performance optimization
- ✅ Priority 4: User experience enhancements

---

## Success Metrics

### Competitor Leakage
- **Target**: 0% competitor mentions in recommendations
- **Measurement**: Automated detection + manual review sample

### Recommendation Quality
- **Specificity**: >90% of recommendations have specific, actionable actions (not generic)
- **Data linkage**: 100% of recommendations reference a detected problem or data gap
- **User engagement**: Track completion rate, time to complete, user feedback

### Business Impact
- **Recommendation completion rate**: Target >40% (users actually implement recommendations)
- **Metric improvement**: Track if completed recommendations lead to measurable KPI improvements
- **User satisfaction**: Survey users on recommendation usefulness

---

## Risk Mitigation

### Risk 1: Over-filtering (False Positives)
- **Mitigation**: Start with conservative filtering, monitor false positive rate
- **Rollback plan**: Feature flag to disable filtering if needed
- **Monitoring**: Log all filtered recommendations for review

### Risk 2: Performance Degradation
- **Mitigation**: Add caching, optimize queries, monitor performance
- **Rollback plan**: Can disable new features via feature flags

### Risk 3: LLM Quality Regression
- **Mitigation**: A/B test changes, maintain quality evaluation framework
- **Rollback plan**: Keep old prompt/logic as fallback

---

## Dependencies

1. **Competitor data**: Need reliable competitor list per brand (already exists in `brand_competitors` table)
2. **Source domain mapping**: May need to map sources to competitor domains (if not already available)
3. **Historical data**: For impact quantification and ROI calculation
4. **Feature flags**: For gradual rollout and rollback capability

---

## Open Questions

1. **Competitor domain resolution**: Do we have competitor domains stored, or do we need to resolve them?
2. **Filtering aggressiveness**: Should we drop recommendations with competitor mentions, or attempt to regenerate?
3. **User feedback mechanism**: How should we collect and use user feedback on recommendations?
4. **A/B testing framework**: Do we have infrastructure for A/B testing recommendation improvements?

---

## Next Steps

1. **Review and approve this plan** with stakeholders
2. **Answer open questions** above
3. **Create detailed technical specifications** for Priority 1 items
4. **Set up monitoring** for competitor leakage incidents
5. **Begin implementation** with Priority 1, Layer 1 (pre-generation filtering)

---

## Files Summary

### Files to Create
- `backend/src/services/recommendations/competitor-filter.service.ts` - Competitor filtering utilities
- `backend/src/services/recommendations/recommendation-logger.service.ts` - Structured logging
- `backend/src/services/recommendations/recommendation-evaluator.service.ts` - Quality evaluation

### Files to Modify
- `backend/src/services/recommendations/recommendation-v3.service.ts` - Main V3 service
- `backend/src/services/recommendations/recommendation.service.ts` - Main V2 service
- `backend/src/services/recommendations/recommendation-content.service.ts` - Content generation (competitor filtering)

### Database Changes
- May need to add fields for:
  - Competitor exclusion list (cached per brand)
  - Recommendation quality scores
  - Success criteria and baseline metrics
  - Filtering metadata (why a recommendation was filtered)

---

## Notes

- This plan focuses on backend improvements. Frontend changes may be needed to display new fields or handle filtered recommendations.
- All changes should be feature-flagged for gradual rollout.
- Maintain backward compatibility where possible.
- Document all changes thoroughly for future maintenance.

