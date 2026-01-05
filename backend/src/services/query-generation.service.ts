import { OpenAI } from 'openai';
import { supabaseAdmin } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface QueryGenerationRequest {
  url: string;
  locale: string;
  country: string;
  industry?: string;
  competitors?: string;
  keywords?: string;
  llm_provider: 'cerebras' | 'openai';
  brand_id?: string;
  customer_id?: string;
  guided_prompts?: string[];
  topics?: string[]; // Add topics to the request
}

export interface NeutralityScore {
  score: number; // 0-1, where 1 is fully neutral
  reason?: string;
  reasonCode?: 'BRAND_MENTION' | 'BRAND_PREFERENCE' | 'BRAND_SPECIFIC' | 'NEUTRAL' | 'COMPARISON_OK';
}

export interface NeutralityValidationReport {
  totalQueries: number;
  filteredQueries: number;
  passedQueries: number;
  filteredByReason: Record<string, number>;
  filteredQueriesDetails: Array<{
    query: string;
    reason: string;
    reasonCode: string;
    score: number;
  }>;
  strictness: 'strict' | 'moderate' | 'lenient';
  averageScore: number;
}

export interface QueryGenerationResponse {
  url: string;
  total_queries: number;
  queries_by_intent: Record<string, number>;
  queries: Array<{
    query: string;
    intent: string;
    brand: string | null;
    template_id: string;
    evidence_snippet: string;
    evidence_source: string;
    locale: string;
    country: string;
  }>;
  processing_time_seconds: number;
  locale: string;
  country: string;
  llm_provider: string;
  generation_id: string;
  neutrality_report?: NeutralityValidationReport;
}

export class QueryGenerationService {
  private openai: OpenAI | null = null;
  private neutralityStrictness: 'strict' | 'moderate' | 'lenient' = 'moderate';

  constructor() {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
    } else {
      console.warn('⚠️ OpenAI API key not configured, using mock responses');
    }
    
    // Load neutrality strictness from environment variable
    const strictness = process.env['QUERY_NEUTRALITY_STRICTNESS'];
    if (strictness === 'strict' || strictness === 'moderate' || strictness === 'lenient') {
      this.neutralityStrictness = strictness;
    }
  }

  /**
   * Generate seed queries from brand information
   */
  async generateSeedQueries(request: QueryGenerationRequest): Promise<QueryGenerationResponse> {
    const startTime = Date.now();
    const generationId = uuidv4();

    try {
      // Extract brand name from URL or use as-is
      let brandName = this.extractBrandName(request.url);

      if (request.brand_id) {
        try {
          const { data: existingBrand } = await supabaseAdmin
            .from('brands')
            .select('name')
            .eq('id', request.brand_id)
            .single();
          if (existingBrand?.name) {
            brandName = existingBrand.name;
          }
        } catch (brandLookupError) {
          console.warn('⚠️ Failed to lookup existing brand name, falling back to URL-derived value:', brandLookupError);
        }
      }
      
      // Generate queries based on provider - Cerebras primary, OpenAI fallback
      let queries: Array<{ topic: string; query: string; intent: string; priority: number }>;
      
      try {
        if (request.llm_provider === 'openai') {
          console.log('🤖 Using OpenAI as requested provider');
          queries = await this.generateWithOpenAI(request, brandName);
        } else if (request.llm_provider === 'cerebras') {
          console.log('🧠 Using Cerebras AI as primary provider');
          queries = await this.generateWithCerebras(request, brandName);
        } else {
          console.log('🧠 No provider specified, using Cerebras as default (primary)');
          queries = await this.generateWithCerebras(request, brandName);
        }
      } catch (error) {
        console.error('❌ Primary provider failed, trying fallback:', error);
        // Try fallback if primary fails - ONLY AI providers, no guided queries
        if (request.llm_provider === 'openai' && this.openai) {
          console.log('🔄 OpenAI failed, falling back to Cerebras');
          try {
            queries = await this.generateWithCerebras(request, brandName);
          } catch (cerebrasError) {
            console.error('❌ Cerebras also failed:', cerebrasError);
            throw new Error('All AI providers failed. Please check your API keys and try again.');
          }
        } else if (request.llm_provider === 'cerebras') {
          console.log('🔄 Cerebras failed, falling back to OpenAI');
          try {
            queries = await this.generateWithOpenAI(request, brandName);
          } catch (openaiError) {
            console.error('❌ OpenAI also failed:', openaiError);
            throw new Error('All AI providers failed. Please check your API keys and try again.');
          }
        } else {
          console.log('🔄 No provider specified, trying Cerebras first, then OpenAI');
            try {
              queries = await this.generateWithCerebras(request, brandName);
            } catch (cerebrasError) {
            console.log('🔄 Cerebras failed, trying OpenAI');
            try {
              queries = await this.generateWithOpenAI(request, brandName);
            } catch (openaiError) {
              console.error('❌ Both AI providers failed:', { cerebrasError, openaiError });
              throw new Error('All AI providers failed. Please check your API keys and try again.');
            }
          }
        }
      }

      // CRITICAL: Process queries FIRST before saving to database
      // This ensures NO fallback queries are saved to database
      
      // Enforce topic completeness and uniqueness FIRST
      if (request.topics && request.topics.length > 0) {
        console.log(`📋 Enforcing topic completeness for ${request.topics.length} topics...`);
        queries = await this.enforceTopicCompletenessAndUniqueness(queries, request, brandName);
      }
      
      // Remove duplicates before formatting (safety check)
      const uniqueQueries = this.removeDuplicateQueries(queries);
      
      // Validate query neutrality with enhanced scoring and reporting
      const { neutralQueries, neutralityReport } = this.validateAndFilterNeutralQueriesWithScoring(
        uniqueQueries, 
        brandName, 
        request.competitors
      );
      
      // Log neutrality validation summary
      console.log(`📊 Neutrality validation summary (${this.neutralityStrictness} mode):`);
      console.log(`   Total queries: ${neutralityReport.totalQueries}`);
      console.log(`   Passed: ${neutralityReport.passedQueries} (${Math.round((neutralityReport.passedQueries / neutralityReport.totalQueries) * 100)}%)`);
      console.log(`   Filtered: ${neutralityReport.filteredQueries} (${Math.round((neutralityReport.filteredQueries / neutralityReport.totalQueries) * 100)}%)`);
      console.log(`   Average neutrality score: ${neutralityReport.averageScore.toFixed(2)}`);
      
      if (Object.keys(neutralityReport.filteredByReason).length > 0) {
        console.log(`   Filtered by reason:`, neutralityReport.filteredByReason);
      }
      
      if (neutralQueries.length < uniqueQueries.length) {
        const removedCount = uniqueQueries.length - neutralQueries.length;
        console.warn(`⚠️ Removed ${removedCount} non-neutral queries that mentioned brand name "${brandName}"`);
        console.warn(`   Remaining neutral queries: ${neutralQueries.length}`);
      } else {
        console.log(`✅ All ${neutralQueries.length} queries passed neutrality validation`);
      }
      
      // Log the AI-generated queries
      console.log(`🤖 Final Generated ${neutralQueries.length} neutral queries for ${brandName}:`);
      neutralQueries.forEach((q, index) => {
        console.log(`  ${index + 1}. [${q.topic || 'N/A'}] [${q.intent}] ${q.query}`);
      });
      
      // Final validation
      if (request.topics && request.topics.length > 0) {
        const queryTexts = neutralQueries.map(q => q.query.toLowerCase().trim());
        const duplicates = queryTexts.filter((query, index) => queryTexts.indexOf(query) !== index);
        if (duplicates.length > 0) {
          console.error(`❌ CRITICAL: Still found ${duplicates.length} duplicate queries after enforcement!`);
          duplicates.forEach(dup => {
            const dupQueries = neutralQueries.filter(q => q.query.toLowerCase().trim() === dup);
            console.error(`  Duplicate: "${dup}" appears in topics: ${dupQueries.map(q => q.topic).join(', ')}`);
          });
        } else {
          console.log(`✅ No duplicate queries found - all queries are unique!`);
        }
        
        // Verify all topics have queries
        const generatedTopics = neutralQueries.map(q => q.topic).filter(Boolean);
        const missingTopics = request.topics.filter(topic => !generatedTopics.includes(topic));
        if (missingTopics.length > 0) {
          console.error(`❌ CRITICAL: Missing queries for ${missingTopics.length} topics: ${missingTopics.join(', ')}`);
        } else {
          console.log(`✅ All ${request.topics.length} topics have queries!`);
        }
      }
      
      // Only use AI-generated queries, don't fall back to generic ones
      let aeoTopics;
      if (neutralQueries.length >= 4) {
        console.log(`✅ Using ${neutralQueries.length} AI-generated neutral queries (no fallback needed)`);
        aeoTopics = neutralQueries.slice(0, 8); // Take up to 8 queries
      } else {
        console.warn(`⚠️ Only ${neutralQueries.length} AI-generated neutral queries available, but proceeding with AI queries only`);
        aeoTopics = neutralQueries;
      }

      // NOW save to database - AFTER all processing, with final queries only
      // This ensures NO fallback queries are saved
      brandName = await this.saveGenerationToDatabase(generationId, request, aeoTopics, request.llm_provider, brandName);

      const runTime = Date.now() - startTime;
      const runTimeSeconds = runTime / 1000;

      // Convert queries to the expected format
    const formattedQueries = aeoTopics.map((q, index) => ({
      query: q.query,
      intent: q.intent,
      brand: brandName,
      template_id: `template-${index + 1}`,
      evidence_snippet: `Generated query for ${brandName} ${q.topic}`,
      evidence_source: `AI Generated`,
      locale: request.locale,
      country: request.country
    }));

      // Create queries_by_intent mapping
      const queriesByIntent: Record<string, number> = {};
      formattedQueries.forEach(q => {
        queriesByIntent[q.intent] = (queriesByIntent[q.intent] || 0) + 1;
      });

      return {
        url: request.url,
        total_queries: formattedQueries.length,
        queries_by_intent: queriesByIntent,
        queries: formattedQueries,
        processing_time_seconds: runTimeSeconds,
        locale: request.locale,
        country: request.country,
        llm_provider: request.llm_provider,
        generation_id: generationId,
        neutrality_report: neutralityReport
      };

    } catch (error) {
      console.error('Error generating queries:', error);
      throw new Error(`Query generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate queries using Cerebras AI
   */
  private async generateWithCerebras(request: QueryGenerationRequest, brandName: string): Promise<Array<{ topic: string; query: string; intent: string; priority: number }>> {
    const cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
    const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
    
    if (!cerebrasApiKey || cerebrasApiKey === 'your_cerebras_api_key_here') {
      console.warn('⚠️ Cerebras API key not configured, using guided queries');
      return this.generateGuidedQueries(request, brandName);
    }

    try {
      // Build comprehensive prompt for Cerebras
      const prompt = this.buildCerebrasPrompt(request, brandName);
      
      const response = await fetch('https://api.cerebras.ai/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cerebrasApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: cerebrasModel,
          prompt: prompt,
          max_tokens: 2000,
          temperature: 0.7,
          stop: ['---END---']
        })
      });

      if (!response.ok) {
        throw new Error(`Cerebras API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const generatedText = data.choices?.[0]?.text || '';
      
      if (!generatedText.trim()) {
        throw new Error('Empty response from Cerebras API');
      }

      // Parse the generated queries
      const parsed = await this.parseCerebrasResponse(generatedText, request, brandName);
      return parsed;
      
    } catch (error) {
      console.error('❌ Cerebras API failed:', error);
      
      // Try OpenAI as fallback if available
      if (request.llm_provider !== 'openai' && this.openai) {
        console.log('🔄 Cerebras failed, trying OpenAI as fallback...');
        try {
          return await this.generateWithOpenAI(request, brandName);
        } catch (openaiError) {
          console.error('❌ OpenAI fallback also failed:', openaiError);
        }
      }
      
      console.log('🔄 Falling back to guided queries');
      return this.generateGuidedQueries(request, brandName);
    }
  }

  /**
   * Build comprehensive but concise prompt for Cerebras AI
   */
  private buildCerebrasPrompt(request: QueryGenerationRequest, brandName: string): string {
    const industry = request.industry || 'General';
    const competitors = request.competitors ? request.competitors.split(',').map(c => c.trim()) : [];
    const keywords = request.keywords ? request.keywords.split(',').map(k => k.trim()) : [];
    const topics = request.topics || [];
    
    return `You are an expert SEO and AEO specialist. Generate neutral, industry-focused search queries.

BRAND CONTEXT:
Industry: ${industry}
Competitors: ${competitors.join(', ') || 'None'}
Keywords: ${keywords.join(', ') || 'None'}
Market: ${request.country} (${request.locale})

CRITICAL NEUTRALITY RULES:
- Generate NEUTRAL, INDUSTRY-FOCUSED queries without brand mentions
- Queries should help customers find and evaluate options in the ${industry} industry
- ONLY mention brand names in COMPARISON queries when competitors are provided
- Think from customer perspective: "How would someone search when researching ${industry} options?"

QUALITY STANDARDS:
- Generate queries real users would type into Google
- Make queries specific, actionable, and search-optimized
- Use natural language matching how people actually search
- Include long-tail keywords and specific use cases
- Cover customer journey: awareness → comparison → purchase → support
- Use industry-specific terminology and features
- Add location-specific queries when relevant for ${request.country}
- Include troubleshooting and support queries

FORBIDDEN:
- Brand-specific queries like "What is [brand]?", "How does [brand] work?"
- Queries mentioning brand name unless it's a comparison with competitors
- Generic queries that don't relate to the assigned topic
- Duplicate or similar queries across topics

${topics.length > 0 ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 ABSOLUTE UNIQUENESS REQUIREMENT - THIS IS CRITICAL 🚫
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOPICS REQUIRED (generate EXACTLY 1 unique query per topic):
${topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ZERO TOLERANCE FOR DUPLICATES - FOLLOW THESE RULES EXACTLY ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1: ABSOLUTE TOPIC EXCLUSIVITY
   Each query MUST be SO SPECIFIC to its topic that it CANNOT possibly apply to ANY other topic.
   If a query could even REMOTELY apply to another topic, it is FORBIDDEN and MUST be rewritten.

RULE 2: MANDATORY TOPIC-SPECIFIC KEYWORDS
   Every query MUST include keywords or phrases that are UNIQUE to its assigned topic.
   Generic terms like "brand", "products", "services" are FORBIDDEN unless combined with topic-specific terms.

RULE 3: SEMANTIC DISTINCTION TEST
   Before finalizing each query, ask yourself:
   - "If I swapped this query to a different topic, would it still make sense?" → If YES, REWRITE IT
   - "Does this query contain information ONLY relevant to this topic?" → If NO, REWRITE IT
   - "Would a user searching this query be looking SPECIFICALLY for this topic?" → If NO, REWRITE IT

RULE 4: PRE-GENERATION VALIDATION
   BEFORE generating any query, you MUST:
   1. Review ALL other topics in the list
   2. Ensure your query is fundamentally different from queries for other topics
   3. Verify the query uses terminology unique to THIS topic
   4. Confirm the query addresses a question ONLY relevant to THIS topic

RULE 5: QUERY TEXT UNIQUENESS
   The EXACT query text must NEVER appear for multiple topics.
   Even if queries are semantically similar, they are FORBIDDEN.
   Each query must be COMPLETELY DISTINCT in both wording AND meaning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TOPIC-SPECIFIC GENERATION STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EACH topic, follow this process:

STEP 1: Analyze the topic
   - What is the CORE subject of this topic?
   - What specific information would users seek about this topic?
   - What terminology is UNIQUE to this topic?

STEP 2: Generate topic-specific query
   - Include topic-specific keywords in the query
   - Make the query so specific that it ONLY applies to this topic
   - Use long-tail keywords that narrow the focus to THIS topic

STEP 3: Cross-check against ALL other topics
   - Could this query apply to Topic 2? If YES → REWRITE with more specificity
   - Could this query apply to Topic 3? If YES → REWRITE with more specificity
   - Continue checking against ALL topics in the list

STEP 4: Finalize only if unique
   - Query is specific to THIS topic only
   - Query uses topic-unique terminology
   - Query addresses a question ONLY relevant to THIS topic
   - Query would NOT make sense if assigned to any other topic

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CORRECT EXAMPLES (Study these carefully - NEUTRAL INDUSTRY-FOCUSED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Topic: "Menu & Nutrition"
❌ BAD: "What does ${brandName} offer?" 
   → Mentions brand unnecessarily
✅ GOOD: "What are the nutritional values and calorie counts to consider when choosing ${industry} options?"
   → Neutral, industry-focused, no brand mention

Topic: "Pricing & Value"  
❌ BAD: "What does ${brandName} cost?"
   → Mentions brand unnecessarily
✅ GOOD: "What pricing tiers and value options are available in the ${industry} industry?"
   → Neutral, industry-focused, helps customers evaluate options

Topic: "Delivery & App Experience"
❌ BAD: "How does ${brandName} work?"
   → Mentions brand unnecessarily
✅ GOOD: "What features should I look for in a ${industry} mobile app and delivery service?"
   → Neutral, helps customers understand what to expect

Topic: "Product Features"
❌ BAD: "What are ${brandName}'s products?"
   → Mentions brand unnecessarily
✅ GOOD: "What are the most important features and specifications to compare in ${industry} products?"
   → Neutral, industry-focused, helps customers make informed decisions

Topic: "Customer Reviews"
❌ BAD: "What do people think about ${brandName}?"
   → Mentions brand unnecessarily
✅ GOOD: "How to evaluate customer reviews and ratings when choosing ${industry} options?"
   → Neutral, helps customers understand evaluation criteria

Topic: "Competitor Comparison" (ONLY case where brand names are allowed)
${competitors.length > 0 ? `✅ GOOD: "How does ${brandName} compare to ${competitors[0]} in terms of features?"
   → Comparison query with competitor - ALLOWED` : `⚠️ NO COMPETITORS: Use neutral comparison like "What factors to compare when evaluating ${industry} options?"`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ FORBIDDEN PATTERNS (NEVER use these - BRAND MENTIONS PROHIBITED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FORBIDDEN: Brand-specific queries (unless comparing with competitors)
   ❌ "What is ${brandName}?"
   ❌ "How does ${brandName} work?"
   ❌ "What does ${brandName} offer?"
   ❌ "What are ${brandName}'s products?"
   ❌ "Is ${brandName} good?"
   ❌ "What are ${brandName}'s services?"
   ❌ "Where can I find ${brandName}?"
   ❌ "How to use ${brandName}?"
   ❌ "What are ${brandName}'s benefits?"

CORRECT: Industry-focused neutral queries
   ✅ "What factors matter when choosing ${industry} products?"
   ✅ "How to evaluate ${industry} options?"
   ✅ "What features are important in ${industry} services?"
   ✅ "What are the key considerations for ${industry} purchases?"

ALLOWED: Brand comparison queries (ONLY when competitors provided)
${competitors.length > 0 ? `   ✅ "How does ${brandName} compare to ${competitors[0]}?"
   ✅ "Which is better: ${brandName} or ${competitors[0]}?"` : `   ⚠️ No competitors provided - use neutral comparisons instead`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 MANDATORY VALIDATION CHECKLIST (Check ALL before returning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EACH query, verify:

✅ UNIQUENESS CHECK:
   [ ] Query text is EXACTLY unique - no other topic has the same query
   [ ] Query meaning is UNIQUE - even if reworded, it wouldn't apply to other topics
   [ ] Query is semantically distinct from ALL other generated queries

✅ TOPIC EXCLUSIVITY CHECK:
   [ ] Query explicitly/implicitly references ONLY its assigned topic
   [ ] Query would NOT make sense if assigned to any other topic
   [ ] Query uses terminology UNIQUE to this topic
   [ ] Query addresses a question ONLY relevant to this topic

✅ SPECIFICITY CHECK:
   [ ] Query includes topic-specific keywords (not generic terms)
   [ ] Query is specific enough that it could ONLY apply to this topic
   [ ] Query uses long-tail keywords that narrow focus to THIS topic

✅ CROSS-TOPIC CHECK:
   [ ] Checked against Topic 1: Query would NOT apply ✅
   [ ] Checked against Topic 2: Query would NOT apply ✅
   [ ] Checked against ALL other topics: Query would NOT apply ✅

INTENT ASSIGNMENT:
- awareness: Learning about industry, discovering features, understanding benefits (NEUTRAL)
- comparison: Comparing options, evaluating alternatives (USE BRAND NAME ONLY IF COMPETITORS PROVIDED)
- purchase: Pricing, buying decisions, deals, where to buy (NEUTRAL)
- support: Troubleshooting, help, customer service, returns, refunds (NEUTRAL)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return JSON array with EXACTLY ${topics.length} queries (one per topic):
[
  {
    "topic": "Topic Name",
    "query": "Specific query that ONLY applies to this topic - must be unique",
    "intent": "awareness|comparison|purchase|support",
    "priority": 1
  }
]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 FINAL VALIDATION BEFORE RETURNING 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Count queries: Must equal ${topics.length} exactly
2. Check for duplicates: NO two queries should have the same text
3. Check for semantic similarity: NO two queries should have similar meaning
4. Verify topic coverage: ALL ${topics.length} topics must have a query
5. Verify uniqueness: Each query MUST be exclusive to its assigned topic
6. Cross-reference: Each query checked against ALL other topics - must be unique
7. VERIFY NEUTRALITY: Queries must be industry-focused, NO brand mentions (except competitor comparisons)

CRITICAL: If ANY query could apply to another topic, you MUST regenerate it with more specificity.
CRITICAL: Return EXACTLY ${topics.length} unique queries. Zero duplicates. Zero overlaps.
CRITICAL: Keep queries NEUTRAL - help customers evaluate ${industry} options, not specific brands.` : `GENERATE 8 QUERIES (EXACTLY 2 per intent):

For each query, consider:
- What specific problem does this solve for the user?
- What stage of the customer journey is this for?
- What specific information is the user seeking?
- How can this query drive business value?

MANDATORY INTENT DISTRIBUTION (EXACTLY 2 QUERIES PER INTENT):
1. AWARENESS (2 queries) - Brand discovery, learning about features, general info
2. COMPARISON (2 queries) - Competitor comparisons, vs alternatives, better than
3. PURCHASE (2 queries) - Buying decisions, pricing, where to buy, deals
4. SUPPORT (2 queries) - Customer service, troubleshooting, help, returns, refunds

CRITICAL REQUIREMENTS:
- Generate EXACTLY 2 queries for EACH intent (8 total)
- Do NOT skip any intent category
- Support queries MUST include: help, troubleshooting, customer service, returns, refunds
- Each query must be unique and brand-specific

SUPPORT INTENT EXAMPLES:
- "How to contact [brand] customer support?"
- "What is [brand]'s return policy?"
- "How to get refund from [brand]?"
- "Troubleshooting [brand] [product] issues"

SPECIFIC GUIDANCE FOR EACH CATEGORY:
- Product Discovery: Use specific product names, features, and benefits
- Pricing & Value: Include cost-related terms, discounts, and value propositions
- Competitor Analysis: Use comparison language with specific competitor names
- User Experience: Focus on reviews, ratings, and customer experiences
- Support: Include help, troubleshooting, and problem-solving terms
- Industry-Specific: Use industry-specific terminology and use cases

PURCHASE-INTENT QUERIES SHOULD INCLUDE:
- Specific product names and models
- Price ranges and cost comparisons
- Buying guides and recommendations
- Where to buy and purchase options
- Discount codes and deals
- Value propositions and benefits
- Comparison with alternatives
- Customer reviews and ratings
`}

QUERY DIVERSITY REQUIREMENTS:
- Generate completely unique queries - avoid any repetition or similarity
- Each query should target a different aspect of the brand
- Use different query structures and keywords for each query
- Ensure queries are distinct and don't overlap in content or intent
- Cover different user intents: informational, navigational, transactional, commercial
- NEVER use generic fallback queries like "What is [brand] and how does it work?"
- Make each query specific to the brand's products, services, or industry
- Use real user search patterns and language

CRITICAL: Generate ONLY specific, brand-focused queries. Do not use any generic templates or fallback queries.

Return as JSON array with exactly one query per topic. Format:
[
  {
    "topic": "Topic Name",
    "query": "Specific query for this topic only",
    "intent": "awareness|comparison|purchase|support",
    "priority": 1
  }
]

CRITICAL VALIDATION BEFORE RETURNING:
1. Count the queries - must equal the number of topics exactly
2. Verify each query mentions or implies its assigned topic
3. Verify no two queries could logically apply to the same topic
4. Verify each query uses topic-specific keywords or context
5. Verify queries are semantically distinct (not just different wording)

CRITICAL: Return exactly one query per topic. No duplicates across topics. Each query must be EXCLUSIVE to its assigned topic.`;
  }

  /**
   * Ensure balanced distribution of queries across all intents (8 total, 2 per intent)
   */
  private ensureBalancedDistribution(queries: Array<{ topic: string; query: string; intent: string; priority: number }>): Array<{ topic: string; query: string; intent: string; priority: number }> {
    const requiredIntents = ['awareness', 'comparison', 'purchase', 'support'];
    const expectedPerIntent = 2; // 2 queries per intent = 8 total
    const totalExpected = 8;
    
    // Group queries by intent
    const intentGroups = queries.reduce((acc, q) => {
      if (!acc[q.intent]) acc[q.intent] = [];
      acc[q.intent].push(q);
      return acc;
    }, {} as Record<string, Array<{ topic: string; query: string; intent: string; priority: number }>>);
    
    const balancedQueries: Array<{ topic: string; query: string; intent: string; priority: number }> = [];
    
    // Ensure each intent has exactly 2 queries (8 total)
    requiredIntents.forEach(intent => {
      const intentQueries = intentGroups[intent] || [];
      
      if (intentQueries.length >= expectedPerIntent) {
        // Take the first 2 queries
        balancedQueries.push(...intentQueries.slice(0, expectedPerIntent));
        console.log(`✅ ${intent}: Using ${expectedPerIntent} existing queries`);
      } else if (intentQueries.length > 0) {
        // Take what we have - NO FALLBACK
        balancedQueries.push(...intentQueries);
        console.log(`⚠️ ${intent}: Only ${intentQueries.length} queries available (expected ${expectedPerIntent}) - no fallback generated`);
      } else {
        // No queries for this intent - skip it, NO FALLBACK
        console.warn(`❌ ${intent}: No queries available - skipping (no fallback generated)`);
      }
    });
    
    // Return what we have - don't try to fill gaps with fallbacks
    if (balancedQueries.length !== totalExpected) {
      console.warn(`⚠️ Expected ${totalExpected} queries, got ${balancedQueries.length}. Returning ${balancedQueries.length} AI-generated queries (no fallbacks)`);
    }
    
    // If we have too many, take the first 8
    if (balancedQueries.length > totalExpected) {
      return balancedQueries.slice(0, totalExpected);
    }
    
    // Remove any duplicate queries
    const uniqueQueries = this.removeDuplicateQueries(balancedQueries);
    
    // Final validation
    if (uniqueQueries.length !== totalExpected) {
      console.error(`❌ Failed to generate exactly ${totalExpected} unique queries. Got ${uniqueQueries.length}`);
    }
    
    return uniqueQueries;
  }

  /**
   * Ensure exactly 8 AEO topics with balanced distribution (2 per intent)
   */
  private ensureAEOBalance(queries: Array<{ topic: string; query: string; intent: string; priority: number }>, brandName: string): Array<{ topic: string; query: string; intent: string; priority: number }> {
    const requiredIntents = ['awareness', 'comparison', 'purchase', 'support'];
    const expectedPerIntent = 2;
    const totalExpected = 8;
    
    console.log(`🎯 Ensuring AEO balance: ${queries.length} queries for ${brandName}`);
    
    // Group queries by intent
    const intentGroups = queries.reduce((acc, q) => {
      if (!acc[q.intent]) acc[q.intent] = [];
      acc[q.intent].push(q);
      return acc;
    }, {} as Record<string, Array<{ topic: string; query: string; intent: string; priority: number }>>);
    
    const balancedQueries: Array<{ topic: string; query: string; intent: string; priority: number }> = [];
    
    // Ensure each intent has exactly 2 queries
    requiredIntents.forEach(intent => {
      const intentQueries = intentGroups[intent] || [];
      
      if (intentQueries.length >= expectedPerIntent) {
        // Take the first 2 queries
        balancedQueries.push(...intentQueries.slice(0, expectedPerIntent));
        console.log(`✅ ${intent}: Using ${expectedPerIntent} existing queries`);
      } else if (intentQueries.length > 0) {
        // Take what we have - NO FALLBACK
        balancedQueries.push(...intentQueries);
        console.log(`⚠️ ${intent}: Only ${intentQueries.length} queries available (expected ${expectedPerIntent}) - no fallback generated`);
      } else {
        // No queries for this intent - skip it, NO FALLBACK
        console.warn(`❌ ${intent}: No queries available - skipping (no fallback generated)`);
      }
    });
    
    // Return what we have - don't try to fill gaps with fallbacks
    if (balancedQueries.length !== totalExpected) {
      console.warn(`⚠️ AEO Balance: Expected ${totalExpected}, got ${balancedQueries.length}. Returning ${balancedQueries.length} AI-generated queries (no fallbacks)`);
    }
    
    // If we have too many, take the first 8
    if (balancedQueries.length > totalExpected) {
      return balancedQueries.slice(0, totalExpected);
    }
    
    // Remove duplicates
    const uniqueQueries = this.removeDuplicateQueries(balancedQueries);
    
    // Final count validation
    const finalCount = uniqueQueries.length;
    console.log(`🎯 AEO Balance Result: ${finalCount} queries (${requiredIntents.map(intent => 
      `${intent}: ${uniqueQueries.filter(q => q.intent === intent).length}`
    ).join(', ')})`);
    
    if (finalCount !== totalExpected) {
      console.error(`❌ AEO Balance Failed: Expected ${totalExpected}, got ${finalCount}`);
    }
    
    return uniqueQueries;
  }

  /**
   * Enforce topic completeness and uniqueness - regenerate missing or duplicate queries
   */
  private async enforceTopicCompletenessAndUniqueness(
    queries: Array<{ topic: string; query: string; intent: string; priority: number }>,
    request: QueryGenerationRequest,
    brandName: string
  ): Promise<Array<{ topic: string; query: string; intent: string; priority: number }>> {
    const expectedTopics = request.topics || [];
    const finalQueries: Array<{ topic: string; query: string; intent: string; priority: number }> = [];
    const queryTexts = new Set<string>();
    
    // First, identify valid unique queries
    const topicToQuery = new Map<string, { topic: string; query: string; intent: string; priority: number }>();
    
    // Track which topics already have queries to prevent duplicates
    const topicsWithQueries = new Set<string>();
    
    for (const query of queries) {
      const normalizedQuery = query.query.toLowerCase().trim();
      
      // Skip if query text is duplicate (same query for multiple topics)
      if (queryTexts.has(normalizedQuery)) {
        console.warn(`⚠️ Duplicate query text detected: "${query.query}"`);
        console.warn(`   First seen for topic: ${Array.from(queryTexts).find((_, i) => i === queryTexts.size - 1) || 'unknown'}`);
        console.warn(`   Duplicate for topic: ${query.topic}`);
        continue; // Skip this duplicate
      }
      
      // Skip if topic already has a query (one-to-one mapping only)
      if (query.topic && topicsWithQueries.has(query.topic)) {
        console.warn(`⚠️ Topic "${query.topic}" already has a query. Skipping duplicate.`);
        continue;
      }
      
      // Check semantic similarity
      let isSimilar = false;
      for (const existingText of queryTexts) {
        if (this.areQueriesSemanticallySimilar(normalizedQuery, existingText)) {
          console.warn(`⚠️ Semantically similar query: "${query.query}" (Topic: ${query.topic})`);
          isSimilar = true;
          break;
        }
      }
      
      // Only add if: query is unique, topic is valid, and topic doesn't already have a query
      if (!isSimilar && query.topic && expectedTopics.includes(query.topic) && !topicsWithQueries.has(query.topic)) {
        queryTexts.add(normalizedQuery);
        topicsWithQueries.add(query.topic);
        topicToQuery.set(query.topic, query);
        console.log(`✅ Assigned query to topic "${query.topic}": "${query.query}"`);
      }
    }
    
    // Identify topics with duplicate queries (same query text assigned to multiple topics)
    const queryTextToTopics = new Map<string, string[]>();
    queries.forEach(q => {
      const normalized = q.query.toLowerCase().trim();
      if (!queryTextToTopics.has(normalized)) {
        queryTextToTopics.set(normalized, []);
      }
      queryTextToTopics.get(normalized)!.push(q.topic);
    });
    
    // Find queries that appear in multiple topics
    const duplicateQueries = Array.from(queryTextToTopics.entries())
      .filter(([_, topics]) => topics.length > 1)
      .map(([queryText, topics]) => ({ queryText, topics }));
    
    // Identify topics that need regeneration (missing or have duplicates)
    const topicsNeedingRegeneration = new Set<string>();
    expectedTopics.forEach(topic => {
      if (!topicToQuery.has(topic)) {
        topicsNeedingRegeneration.add(topic); // Missing
      } else {
        const query = topicToQuery.get(topic)!;
        const normalized = query.query.toLowerCase().trim();
        // Check if this query is used by multiple topics
        const topicsWithSameQuery = queryTextToTopics.get(normalized) || [];
        if (topicsWithSameQuery.length > 1) {
          topicsNeedingRegeneration.add(topic); // Duplicate
          console.warn(`⚠️ Topic "${topic}" has duplicate query "${query.query}" - will regenerate`);
        }
      }
    });
    
    if (topicsNeedingRegeneration.size > 0) {
      console.warn(`⚠️ Regenerating queries for ${topicsNeedingRegeneration.size} topics (missing or duplicates): ${Array.from(topicsNeedingRegeneration).join(', ')}`);
      
      // Remove topics that need regeneration from current mapping
      topicsNeedingRegeneration.forEach(topic => {
        if (topicToQuery.has(topic)) {
          const oldQuery = topicToQuery.get(topic)!;
          queryTexts.delete(oldQuery.query.toLowerCase().trim());
          topicToQuery.delete(topic);
        }
      });
      
      // Generate unique queries for topics needing regeneration
      for (const topic of topicsNeedingRegeneration) {
        try {
          const generatedQuery = await this.generateQueryForSingleTopic(topic, brandName, request, Array.from(queryTexts));
          if (generatedQuery) {
            const normalized = generatedQuery.query.toLowerCase().trim();
            // Double-check uniqueness
            if (!queryTexts.has(normalized)) {
              queryTexts.add(normalized);
              topicToQuery.set(topic, generatedQuery);
              console.log(`✅ Generated query for "${topic}": "${generatedQuery.query}"`);
            } else {
              console.warn(`⚠️ Generated query for "${topic}" is still a duplicate after normalization - skipping (no fallback)`);
              // NO FALLBACK - skip this topic if we can't generate a unique query
            }
          }
        } catch (error) {
          console.error(`❌ Failed to generate query for topic "${topic}":`, error);
          // NO FALLBACK - skip this topic if AI generation fails
          console.warn(`⚠️ Skipping topic "${topic}" - AI query generation failed, no fallback will be used`);
        }
      }
    }
    
    // Build final array - only include queries that were successfully generated by AI
    // NO FALLBACK QUERIES - if AI fails, skip that topic
    const missingTopics: string[] = [];
    for (const topic of expectedTopics) {
      if (topicToQuery.has(topic)) {
        finalQueries.push(topicToQuery.get(topic)!);
      } else {
        missingTopics.push(topic);
        console.warn(`⚠️ No query generated for topic "${topic}" - AI generation failed, skipping (no fallback)`);
      }
    }
    
    if (missingTopics.length > 0) {
      console.warn(`❌ CRITICAL: Missing queries for ${missingTopics.length} topics: ${missingTopics.join(', ')}`);
      console.warn(`⚠️ These topics will be skipped - no fallback queries will be generated`);
    }
    
    // Final validation
    const finalQueryTexts = finalQueries.map(q => q.query.toLowerCase().trim());
    const duplicates = finalQueryTexts.filter((text, index) => finalQueryTexts.indexOf(text) !== index);
    
    if (duplicates.length > 0) {
      console.error(`❌ Still have duplicates after regeneration: ${duplicates.join(', ')}`);
    }
    
    console.log(`✅ Final result: ${finalQueries.length} AI-generated queries for ${expectedTopics.length} topics (${missingTopics.length} topics skipped due to AI failure)`);
    
    return finalQueries;
  }

  /**
   * Generate a query for a single topic ensuring uniqueness
   */
  private async generateQueryForSingleTopic(
    topic: string,
    brandName: string,
    request: QueryGenerationRequest,
    existingQueries: string[]
  ): Promise<{ topic: string; query: string; intent: string; priority: number } | null> {
    const prompt = `You are generating a search query for ${brandName} specifically for the topic: "${topic}"

CRITICAL REQUIREMENTS:
1. Generate ONE unique query that is SPECIFIC to this topic only
2. The query must NOT be similar to these existing queries:
${existingQueries.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

3. The query must be topic-specific - it should ONLY make sense for "${topic}" and not for other topics
4. Use topic-specific keywords and terminology related to "${topic}"
5. Make the query specific enough that it cannot apply to other topics

Industry: ${request.industry || 'General'}
Competitors: ${request.competitors || 'None'}

Generate a single query as JSON:
{"topic": "${topic}", "query": "your unique topic-specific query here", "intent": "awareness|comparison|purchase|support", "priority": 1}`;

    try {
      if (request.llm_provider === 'openai' && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert SEO specialist generating unique, topic-specific search queries.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 200
        });
        
        const response = completion.choices[0]?.message?.content;
        if (response) {
          const jsonMatch = response.match(/\{[^}]+\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              topic: parsed.topic || topic,
              query: parsed.query || '',
              intent: parsed.intent || 'awareness',
              priority: parsed.priority || 1
            };
          }
        }
      } else {
        // Use Cerebras
        const cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
        const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
        
        if (cerebrasApiKey && cerebrasApiKey !== 'your_cerebras_api_key_here') {
          const response = await fetch('https://api.cerebras.ai/v1/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cerebrasApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: cerebrasModel,
              prompt: prompt,
              max_tokens: 200,
              temperature: 0.8,
              stop: ['---END---']
            })
          });

          if (response.ok) {
            const data = await response.json() as any;
            const generatedText = data.choices?.[0]?.text || '';
            const jsonMatch = generatedText.match(/\{[^}]+\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return {
                topic: parsed.topic || topic,
                query: parsed.query || '',
                intent: parsed.intent || 'awareness',
                priority: parsed.priority || 1
              };
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error generating query for topic "${topic}":`, error);
    }
    
    return null;
  }

  /**
   * Generate a topic-specific fallback query when AI fails
   * DISABLED: No fallback queries should be generated
   */
  private generateTopicSpecificFallback(
    topic: string,
    brandName: string,
    request: QueryGenerationRequest,
    existingQueries: string[]
  ): { topic: string; query: string; intent: string; priority: number } | null {
    // FALLBACK DISABLED - Return null instead of generating fallback queries
    console.warn(`🚫 Fallback query generation disabled for topic "${topic}" - returning null`);
    return null;
  }

  /**
   * Validate that queries are topic-specific and unique
   */
  private validateTopicSpecificQueries(
    queries: Array<{ topic: string; query: string; intent: string; priority: number }>,
    expectedTopics: string[]
  ): Array<{ topic: string; query: string; intent: string; priority: number }> {
    if (expectedTopics.length === 0) {
      return queries; // No topic validation needed
    }

    const validatedQueries: Array<{ topic: string; query: string; intent: string; priority: number }> = [];
    const queryTexts = new Set<string>();
    const topicMap = new Map<string, Array<{ topic: string; query: string; intent: string; priority: number }>>();

    // Group queries by topic
    queries.forEach(q => {
      if (!topicMap.has(q.topic)) {
        topicMap.set(q.topic, []);
      }
      topicMap.get(q.topic)!.push(q);
    });

    // Validate each expected topic has exactly one query
    expectedTopics.forEach(expectedTopic => {
      const topicQueries = topicMap.get(expectedTopic) || [];
      
      if (topicQueries.length === 0) {
        console.warn(`⚠️ No query found for expected topic: "${expectedTopic}"`);
        return;
      }

      // Take the first query for this topic (AI should generate only one)
      const selectedQuery = topicQueries[0];
      const normalizedQuery = selectedQuery.query.toLowerCase().trim();

      // Check for duplicate query text across different topics
      if (queryTexts.has(normalizedQuery)) {
        console.warn(`⚠️ Duplicate query detected across topics: "${selectedQuery.query}" (Topic: ${expectedTopic})`);
        console.warn(`⚠️ This query may apply to multiple topics - should be more topic-specific`);
        // Still include it, but log the warning
      }

      queryTexts.add(normalizedQuery);
      validatedQueries.push({
        ...selectedQuery,
        topic: expectedTopic // Ensure topic matches expected topic exactly
      });
    });

    // Check for queries with topics not in expected list
    queries.forEach(q => {
      if (!expectedTopics.includes(q.topic) && !q.topic.startsWith('Generated Topic')) {
        console.warn(`⚠️ Query with unexpected topic "${q.topic}": "${q.query}"`);
      }
    });

    return validatedQueries;
  }

  /**
   * Remove duplicate queries based on query text
   */
  private removeDuplicateQueries(queries: Array<{ topic: string; query: string; intent: string; priority: number }>): Array<{ topic: string; query: string; intent: string; priority: number }> {
    const seen = new Set<string>();
    const uniqueQueries: Array<{ topic: string; query: string; intent: string; priority: number }> = [];
    const topicToQuery = new Map<string, string>(); // Track which topic uses which query
    
    for (const query of queries) {
      const normalizedQuery = query.query.toLowerCase().trim();
      
      // Check for exact duplicate
      if (seen.has(normalizedQuery)) {
        const originalTopic = topicToQuery.get(normalizedQuery);
        console.warn(`⚠️ Duplicate query removed: "${query.query}"`);
        console.warn(`   Original topic: ${originalTopic}, Duplicate topic: ${query.topic}`);
        continue;
      }
      
      // Check for semantic similarity (same core meaning)
      let isDuplicate = false;
      for (const existingQuery of seen) {
        if (this.areQueriesSemanticallySimilar(normalizedQuery, existingQuery)) {
          console.warn(`⚠️ Semantically similar query detected: "${query.query}"`);
          console.warn(`   Similar to: "${queries.find(q => q.query.toLowerCase().trim() === existingQuery)?.query}"`);
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        seen.add(normalizedQuery);
        topicToQuery.set(normalizedQuery, query.topic);
        uniqueQueries.push(query);
      }
    }
    
    return uniqueQueries;
  }

  /**
   * Check if two queries are semantically similar (same core meaning)
   */
  private areQueriesSemanticallySimilar(query1: string, query2: string): boolean {
    // Normalize both queries
    const q1 = query1.toLowerCase().trim().replace(/[^\w\s]/g, ' ');
    const q2 = query2.toLowerCase().trim().replace(/[^\w\s]/g, ' ');
    
    // Extract key words (remove common stop words)
    const stopWords = new Set(['what', 'is', 'are', 'the', 'a', 'an', 'how', 'does', 'do', 'where', 'when', 'who', 'why', 'can', 'will', 'to', 'for', 'and', 'or', 'but', 'in', 'on', 'at', 'by', 'of', 'with']);
    const words1 = q1.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    const words2 = q2.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    
    // Check for significant overlap in meaningful words
    const commonWords = words1.filter(w => words2.includes(w));
    const similarityRatio = commonWords.length / Math.max(words1.length, words2.length);
    
    // If more than 70% of meaningful words overlap, consider them similar
    return similarityRatio > 0.7 && commonWords.length >= 3;
  }

  /**
   * Generate fallback queries for missing intents - DISABLED
   * All queries should be AI-generated, no fallbacks
   */
  private generateFallbackQueriesForMissingIntents(missingIntents: string[], brandName: string, request: QueryGenerationRequest): Array<{ topic: string; query: string; intent: string; priority: number }> {
    console.log('🚫 Fallback query generation disabled - all queries must be AI-generated');
    return [];
  }

  /**
   * Generate fallback queries for missing intents
   * DISABLED: No fallback queries should be generated
   */
  private generateFallbackQueriesForIntent(intent: string, topic: string): Array<{ topic: string; query: string; intent: string; priority: number }> {
    // FALLBACK DISABLED - Return empty array instead of generating fallback queries
    console.warn(`🚫 Fallback query generation disabled for intent "${intent}" and topic "${topic}" - returning empty array`);
    return [];
  }

  /**
   * Validate that queries cover all required categories with balanced distribution
   */
  private validateQueryCoverage(queries: Array<{ topic: string; query: string; intent: string; priority: number }>): boolean {
    const requiredIntents = ['awareness', 'comparison', 'purchase', 'support'];
    const intentCounts = queries.reduce((acc, q) => {
      acc[q.intent] = (acc[q.intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Check if all intents are covered
    const missingIntents = requiredIntents.filter(intent => !intentCounts[intent]);
    if (missingIntents.length > 0) {
      console.warn(`⚠️ Missing queries for intents: ${missingIntents.join(', ')}`);
      return false;
    }
    
    // Check for balanced distribution (should have 2 queries per intent for 8 total)
    const expectedPerIntent = 2;
    const unbalancedIntents = requiredIntents.filter(intent => 
      intentCounts[intent] !== expectedPerIntent
    );
    
    if (unbalancedIntents.length > 0) {
      console.warn(`⚠️ Unbalanced intent distribution:`, intentCounts);
      console.warn(`Expected ${expectedPerIntent} queries per intent, got:`, intentCounts);
    }
    
    return true;
  }

  /**
   * Parse Cerebras API response
   */
  private async parseCerebrasResponse(generatedText: string, request: QueryGenerationRequest, brandName: string): Promise<Array<{ topic: string; query: string; intent: string; priority: number }>> {
    try {
      // console.log('🧠 Raw Cerebras response for queries:', generatedText); // Removed verbose logging
      
      // Try multiple JSON extraction methods
      let jsonStr = '';
      
      // Method 1: Look for JSON array with balanced brackets
      const jsonMatch = generatedText.match(/\[[\s\S]*?\](?=\s*$|\s*[^,\]])/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
        // console.log('🧠 Extracted JSON array (method 1):', jsonStr); // Removed verbose logging
      } else {
        // Method 2: Look for the first complete JSON array
        const lines = generatedText.split('\n');
        let jsonLines = [];
        let bracketCount = 0;
        let inJson = false;
        
        for (const line of lines) {
          if (line.trim().startsWith('[')) {
            inJson = true;
            bracketCount = 0;
            jsonLines = [];
          }
          
          if (inJson) {
            jsonLines.push(line);
            bracketCount += (line.match(/\[/g) || []).length;
            bracketCount -= (line.match(/\]/g) || []).length;
            
            if (bracketCount === 0 && line.trim().endsWith(']')) {
              jsonStr = jsonLines.join('\n');
              // console.log('🧠 Extracted JSON array (method 2):', jsonStr); // Removed verbose logging
              break;
            }
          }
        }
      }
      
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        
        if (Array.isArray(parsed)) {
          const queries = parsed.map((item, index) => ({
            topic: item.topic || `Generated Topic ${index + 1}`,
            query: item.query || '',
            intent: item.intent || 'Other',
            priority: item.priority || index + 1
          }));
          
          // If topics are provided, enforce completeness and uniqueness
          if (request.topics && request.topics.length > 0) {
            const enforcedQueries = await this.enforceTopicCompletenessAndUniqueness(queries, request, brandName);
            return enforcedQueries;
          }
          
          // Remove duplicates based on query text
          const uniqueQueries = this.removeDuplicateQueries(queries);
          
          // Ensure balanced distribution and validate
          const balancedQueries = this.ensureBalancedDistribution(uniqueQueries);
          this.validateQueryCoverage(balancedQueries);
          return balancedQueries;
        }
      }
      
      // console.log('🧠 No valid JSON found, using fallback parsing'); // Removed verbose logging
      
      // Fallback: parse line by line
      const lines = generatedText.split('\n').filter(line => line.trim());
      const queries = [];
      
      for (let i = 0; i < Math.min(lines.length, 25); i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('{') && !line.startsWith('[')) {
          queries.push({
            topic: `Generated Topic ${i + 1}`,
            query: line,
            intent: 'Other',
            priority: i + 1
          });
        }
      }
      
      // console.log(`🧠 Fallback parsing found ${queries.length} queries`); // Removed verbose logging
      
      if (queries.length > 0) {
        // Ensure balanced distribution and validate
        const balancedQueries = this.ensureBalancedDistribution(queries);
        this.validateQueryCoverage(balancedQueries);
        return balancedQueries;
      } else {
        return this.generateGuidedQueries(request, brandName);
      }
      
    } catch (error) {
      console.error('❌ Failed to parse Cerebras response:', error);
      return this.generateGuidedQueries(request, brandName);
    }
  }

  /**
   * Generate AEO-focused guided queries for data collector agents
   * Based on manager's example queries for detailed, technical comparisons
   */
  private generateGuidedQueries(request: QueryGenerationRequest, brandName: string): Array<{ topic: string; query: string; intent: string; priority: number }> {
    const industry = request.industry || 'General';
    const competitors = request.competitors ? request.competitors.split(',').map(c => c.trim()) : [];
    const keywords = request.keywords ? request.keywords.split(',').map(k => k.trim()) : [];
    
    // Generate industry-appropriate queries based on the actual industry
    const queries = [];

    // Industry-specific query generation
    if (industry.toLowerCase().includes('sportswear') || industry.toLowerCase().includes('apparel') || industry.toLowerCase().includes('fashion')) {
      // Sportswear/Apparel industry queries
      if (competitors.length > 0) {
        queries.push(
          `How does ${brandName} quality compare to ${competitors[0]}?`,
          `Which brand offers better durability: ${brandName} or ${competitors[0]}?`,
          `Does ${brandName} provide better comfort than ${competitors[0]}?`,
          `How does ${brandName} pricing compare to ${competitors[0]}?`,
          `Which brand has better customer service: ${brandName} or ${competitors[0]}?`,
          `Does ${brandName} offer more size options than ${competitors[0]}?`,
          `How does ${brandName} sustainability compare to ${competitors[0]}?`,
          `Which brand has better return policy: ${brandName} or ${competitors[0]}?`
        );
      }

      // Product-specific queries for sportswear (NEUTRAL)
      queries.push(
        `What are the key features to look for in running shoes?`,
        `How to evaluate athletic wear performance for workouts?`,
        `What makes quality sneakers stand out in the ${industry} industry?`,
        `What are the typical sizing considerations for ${industry} apparel?`,
        `What materials are commonly used in high-quality ${industry} products?`,
        `How to determine the right fit when buying ${industry} clothing?`,
        `What care instructions are important for ${industry} products?`,
        `How to assess product durability in ${industry} items?`
      );
    } else if (industry.toLowerCase().includes('automotive') || industry.toLowerCase().includes('vehicle') || industry.toLowerCase().includes('car')) {
      // Automotive industry queries
      if (competitors.length > 0) {
        queries.push(
          `How does ${brandName} performance compare to ${competitors[0]}?`,
          `Which brand offers better fuel efficiency: ${brandName} or ${competitors[0]}?`,
          `Does ${brandName} have better safety ratings than ${competitors[0]}?`,
          `How does ${brandName} pricing compare to ${competitors[0]}?`,
          `Which brand has better reliability: ${brandName} or ${competitors[0]}?`,
          `Does ${brandName} offer better warranty than ${competitors[0]}?`,
          `How does ${brandName} technology compare to ${competitors[0]}?`,
          `Which brand has better resale value: ${brandName} or ${competitors[0]}?`
        );
      }

      // Product-specific queries for automotive (NEUTRAL)
      queries.push(
        `What are the key features to look for when choosing a vehicle?`,
        `How to compare fuel efficiency across different ${industry} options?`,
        `What makes a quality vehicle stand out in today's market?`,
        `What safety technologies are important in modern vehicles?`,
        `What engine specifications matter most when buying a vehicle?`,
        `How to evaluate interior quality in ${industry} purchases?`,
        `What are typical maintenance costs for vehicles in this category?`,
        `What warranty coverage should I expect from ${industry} manufacturers?`
      );
    } else {
      // Generic industry queries
      if (competitors.length > 0) {
        queries.push(
          `How does ${brandName} compare to ${competitors[0]}?`,
          `Which brand offers better value: ${brandName} or ${competitors[0]}?`,
          `Does ${brandName} have better customer service than ${competitors[0]}?`,
          `How does ${brandName} pricing compare to ${competitors[0]}?`,
          `Which brand has better quality: ${brandName} or ${competitors[0]}?`,
          `Does ${brandName} offer better features than ${competitors[0]}?`,
          `How does ${brandName} reputation compare to ${competitors[0]}?`,
          `Which brand has better reviews: ${brandName} or ${competitors[0]}?`
        );
      }

      // Generic product queries (NEUTRAL)
      queries.push(
        `What are the key features to look for in ${industry} products?`,
        `How to evaluate quality when choosing ${industry} options?`,
        `What makes a product stand out in the ${industry} industry?`,
        `What customer service standards should I expect in ${industry}?`,
        `What are the benefits of different ${industry} options?`,
        `How to compare pricing across ${industry} providers?`,
        `How to evaluate reviews when choosing ${industry} products?`,
        `What warranty coverage is typical in the ${industry} industry?`
      );
    }

    // Generic Industry Awareness Queries (NEUTRAL)
    queries.push(
      `What factors make ${industry} options stand out in the market?`,
      `How to evaluate reliability and trustworthiness in ${industry} providers?`,
      `What company history and track record matters when choosing ${industry} options?`,
      `What certifications and awards are important in the ${industry} industry?`,
      `What security measures should I expect from ${industry} providers?`
    );

    // Add keyword-specific technical queries if keywords are provided
    if (keywords.length > 0) {
      keywords.slice(0, 5).forEach(keyword => {
        queries.push(
          `How does ${brandName}'s ${keyword} performance compare to ${competitors[0] || 'competitors'}?`,
          `Which solution handles ${keyword} better—${brandName} or ${competitors[0] || 'competitors'}?`,
          `Does ${brandName} offer more ${keyword} options than ${competitors[0] || 'competitors'}?`,
          `How does ${brandName}'s ${keyword} technology differ from ${competitors[0] || 'competitors'}?`,
          `Is ${brandName}'s ${keyword} implementation more efficient than ${competitors[0] || 'competitors'}?`
        );
      });
    }

    // Add industry-specific technical queries
    const industrySpecificQueries = this.getIndustrySpecificTechnicalQueries(brandName, industry, competitors);
    queries.push(...industrySpecificQueries);

    // If no competitors, add more industry-specific queries (NEUTRAL)
    if (competitors.length === 0) {
      queries.push(
        `What are the latest technology innovations in the ${industry} industry?`,
        `How do leading ${industry} providers stay ahead of trends?`,
        `What future developments are shaping the ${industry} market?`,
        `How to ensure system reliability when choosing ${industry} solutions?`,
        `What makes technology cutting-edge in the ${industry} space?`,
        `What performance benchmarks matter most in ${industry}?`,
        `How to evaluate optimization for different ${industry} use cases?`,
        `What scalability and capacity considerations matter for ${industry} solutions?`,
        `How do ${industry} providers handle system maintenance and updates?`,
        `What integration capabilities should I expect from ${industry} solutions?`
      );
    }

    // Remove duplicates and limit to reasonable number
    const uniqueQueries = this.removeDuplicateQueries(
      queries.map((query, index) => ({
      topic: this.extractTopicFromQuery(query),
      query: query,
      intent: this.extractIntentFromQuery(query),
      priority: index + 1
      }))
    );
    
    const formattedQueries = uniqueQueries.slice(0, 25);
    
    // Ensure balanced distribution and validate
    const balancedQueries = this.ensureBalancedDistribution(formattedQueries);
    this.validateQueryCoverage(balancedQueries);
    
    return balancedQueries;
  }


  /**
   * Get industry-specific technical AEO queries with detailed comparisons
   */
  private getIndustrySpecificTechnicalQueries(brandName: string, industry: string, competitors: string[]): string[] {
    const industryLower = industry.toLowerCase();
    const competitor1 = competitors[0] || 'competitors';
    const competitor2 = competitors[1] || 'market leaders';
    
    if (industryLower.includes('retail') || industryLower.includes('ecommerce')) {
      return [
        `How does ${brandName}'s shipping speed compare to ${competitor1} in different regions?`,
        `Which e-commerce platform has better inventory management—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer faster checkout than ${competitor1}?`,
        `How does ${brandName}'s return processing time compare to ${competitor1}?`,
        `Which platform has better mobile performance—${brandName} or ${competitor1}?`,
        `Does ${brandName} support more payment methods than ${competitor1}?`,
        `How does ${brandName}'s search functionality compare to ${competitor1}?`,
        `Which platform has better customer review system—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer better personalization than ${competitor1}?`,
        `How does ${brandName}'s site speed compare to ${competitor1}?`
      ];
    }
    
    if (industryLower.includes('saas') || industryLower.includes('software')) {
      return [
        `How does ${brandName}'s API response time compare to ${competitor1}?`,
        `Which SaaS platform has better uptime—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer more integrations than ${competitor1}?`,
        `How does ${brandName}'s data processing speed compare to ${competitor1}?`,
        `Which platform has better scalability—${brandName} or ${competitor1}?`,
        `Does ${brandName} provide faster customer support than ${competitor1}?`,
        `How does ${brandName}'s security features compare to ${competitor1}?`,
        `Which platform has better documentation—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer more customization than ${competitor1}?`,
        `How does ${brandName}'s performance monitoring compare to ${competitor1}?`
      ];
    }
    
    if (industryLower.includes('finance') || industryLower.includes('banking')) {
      return [
        `How does ${brandName}'s transaction processing speed compare to ${competitor1}?`,
        `Which financial platform has better fraud detection—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer more investment options than ${competitor1}?`,
        `How does ${brandName}'s interest rates compare to ${competitor1}?`,
        `Which platform has better mobile banking—${brandName} or ${competitor1}?`,
        `Does ${brandName} provide faster loan approval than ${competitor1}?`,
        `How does ${brandName}'s security measures compare to ${competitor1}?`,
        `Which platform has better customer service—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer more financial products than ${competitor1}?`,
        `How does ${brandName}'s compliance standards compare to ${competitor1}?`
      ];
    }
    
    if (industryLower.includes('healthcare') || industryLower.includes('medical')) {
      return [
        `How does ${brandName}'s diagnostic accuracy compare to ${competitor1}?`,
        `Which medical platform has better patient outcomes—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer faster appointment scheduling than ${competitor1}?`,
        `How does ${brandName}'s treatment success rate compare to ${competitor1}?`,
        `Which platform has better emergency response—${brandName} or ${competitor1}?`,
        `Does ${brandName} provide more specialized care than ${competitor1}?`,
        `How does ${brandName}'s technology integration compare to ${competitor1}?`,
        `Which platform has better patient satisfaction—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer more treatment options than ${competitor1}?`,
        `How does ${brandName}'s research capabilities compare to ${competitor1}?`
      ];
    }
    
    if (industryLower.includes('automotive') || industryLower.includes('vehicle')) {
      return [
        `How does ${brandName}'s fuel efficiency compare to ${competitor1}?`,
        `Which vehicle has better safety ratings—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer more advanced features than ${competitor1}?`,
        `How does ${brandName}'s acceleration compare to ${competitor1}?`,
        `Which brand has better reliability—${brandName} or ${competitor1}?`,
        `Does ${brandName} provide more warranty coverage than ${competitor1}?`,
        `How does ${brandName}'s technology integration compare to ${competitor1}?`,
        `Which platform has better resale value—${brandName} or ${competitor1}?`,
        `Does ${brandName} offer more customization than ${competitor1}?`,
        `How does ${brandName}'s maintenance costs compare to ${competitor1}?`
      ];
    }
    
    // Default technical queries for any industry
    return [
      `How does ${brandName}'s core performance compare to ${competitor1}?`,
      `Which solution has better reliability—${brandName} or ${competitor1}?`,
      `Does ${brandName} offer more features than ${competitor1}?`,
      `How does ${brandName}'s efficiency compare to ${competitor1}?`,
      `Which platform has better scalability—${brandName} or ${competitor1}?`,
      `Does ${brandName} provide better support than ${competitor1}?`,
      `How does ${brandName}'s innovation compare to ${competitor1}?`,
      `Which solution has better user experience—${brandName} or ${competitor1}?`,
      `Does ${brandName} offer more value than ${competitor1}?`,
      `How does ${brandName}'s market position compare to ${competitor1}?`
    ];
  }

  /**
   * Get industry-specific AEO queries (legacy method for backward compatibility)
   */
  private getIndustrySpecificQueries(brandName: string, industry: string): string[] {
    const industryLower = industry.toLowerCase();
    
    if (industryLower.includes('retail') || industryLower.includes('ecommerce')) {
      return [
        `What is ${brandName}'s shipping and delivery policy?`,
        `What payment methods does ${brandName} accept?`,
        `How does ${brandName} handle product availability and stock?`,
        `What is ${brandName}'s approach to customer data privacy?`
      ];
    }
    
    if (industryLower.includes('saas') || industryLower.includes('software')) {
      return [
        `What integrations does ${brandName} support?`,
        `What is ${brandName}'s uptime and reliability record?`,
        `How does ${brandName} handle data backup and recovery?`,
        `What training and documentation does ${brandName} provide?`
      ];
    }
    
    if (industryLower.includes('finance') || industryLower.includes('banking')) {
      return [
        `What security measures does ${brandName} use to protect customer data?`,
        `What regulatory compliance does ${brandName} maintain?`,
        `How does ${brandName} handle fraud prevention?`,
        `What insurance or guarantees does ${brandName} provide?`
      ];
    }
    
    if (industryLower.includes('healthcare') || industryLower.includes('medical')) {
      return [
        `What medical certifications or licenses does ${brandName} have?`,
        `How does ${brandName} ensure patient data privacy and HIPAA compliance?`,
        `What quality standards does ${brandName} follow?`,
        `How does ${brandName} handle emergency situations?`
      ];
    }
    
    // Default industry queries
    return [
      `What quality standards and processes does ${brandName} follow?`,
      `How does ${brandName} ensure customer satisfaction?`,
      `What guarantees or warranties does ${brandName} provide?`,
      `How does ${brandName} measure and improve their service quality?`
    ];
  }

  /**
   * Generate queries using OpenAI
   */
  private async generateWithOpenAI(request: QueryGenerationRequest, brandName: string): Promise<Array<{ topic: string; query: string; intent: string; priority: number }>> {
    if (!this.openai) {
      console.warn('⚠️ OpenAI not configured, falling back to mock queries');
      return this.generateMockQueries(request, brandName);
    }

    const systemPrompt = `You are an SEO expert generating search queries for ${brandName}.

REQUIREMENTS:
- Generate queries real users would type into Google
- Make queries specific, actionable, and brand-focused
- Cover customer journey: awareness → comparison → purchase → support
- NEVER use generic queries like "What is [brand]?"
- Include specific product names, features, use cases
- Use natural language and real search patterns

FORBIDDEN: Generic templates, "What is [brand] and how does it work?", "Benefits of [brand]"`;

    const topics = request.topics || [];
    
    const userPrompt = `BRAND: ${brandName}
INDUSTRY: ${request.industry || 'General'}
COMPETITORS: ${request.competitors || 'None'}
MARKET: ${request.country} (${request.locale})

${topics.length > 0 ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 ABSOLUTE UNIQUENESS REQUIREMENT - THIS IS CRITICAL 🚫
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOPICS TO GENERATE QUERIES FOR:
${topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ZERO TOLERANCE FOR DUPLICATES - FOLLOW THESE RULES EXACTLY ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1: ABSOLUTE TOPIC EXCLUSIVITY
   Each query MUST be SO SPECIFIC to its topic that it CANNOT possibly apply to ANY other topic.
   If a query could even REMOTELY apply to another topic, it is FORBIDDEN and MUST be rewritten.

RULE 2: MANDATORY TOPIC-SPECIFIC KEYWORDS
   Every query MUST include keywords or phrases that are UNIQUE to its assigned topic.
   Generic terms like "brand", "products", "services" are FORBIDDEN unless combined with topic-specific terms.

RULE 3: SEMANTIC DISTINCTION TEST
   Before finalizing each query, ask yourself:
   - "If I swapped this query to a different topic, would it still make sense?" → If YES, REWRITE IT
   - "Does this query contain information ONLY relevant to this topic?" → If NO, REWRITE IT
   - "Would a user searching this query be looking SPECIFICALLY for this topic?" → If NO, REWRITE IT

RULE 4: PRE-GENERATION VALIDATION
   BEFORE generating any query, you MUST:
   1. Review ALL other topics in the list
   2. Ensure your query is fundamentally different from queries for other topics
   3. Verify the query uses terminology unique to THIS topic
   4. Confirm the query addresses a question ONLY relevant to THIS topic

RULE 5: QUERY TEXT UNIQUENESS
   The EXACT query text must NEVER appear for multiple topics.
   Even if queries are semantically similar, they are FORBIDDEN.
   Each query must be COMPLETELY DISTINCT in both wording AND meaning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TOPIC-SPECIFIC GENERATION STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EACH topic, follow this process:

STEP 1: Analyze the topic
   - What is the CORE subject of this topic?
   - What specific information would users seek about this topic?
   - What terminology is UNIQUE to this topic?

STEP 2: Generate topic-specific query
   - Include topic-specific keywords in the query
   - Make the query so specific that it ONLY applies to this topic
   - Use long-tail keywords that narrow the focus to THIS topic

STEP 3: Cross-check against ALL other topics
   - Could this query apply to Topic 2? If YES → REWRITE with more specificity
   - Could this query apply to Topic 3? If YES → REWRITE with more specificity
   - Continue checking against ALL topics in the list

STEP 4: Finalize only if unique
   - Query is specific to THIS topic only
   - Query uses topic-unique terminology
   - Query addresses a question ONLY relevant to THIS topic
   - Query would NOT make sense if assigned to any other topic

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CORRECT EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Topic: "Menu & Nutrition"
❌ BAD: "What does ${brandName} offer?" → Too generic, could apply to any topic
✅ GOOD: "What are the nutritional values and calorie counts for ${brandName} menu items?"
   → Includes "nutritional values", "calorie counts", "menu items" - UNIQUE to this topic

Topic: "Pricing & Value"  
❌ BAD: "What does ${brandName} cost?" → Too vague, could apply to products, services, or other topics
✅ GOOD: "What are ${brandName}'s pricing tiers and which option offers the best value for money?"
   → Includes "pricing tiers", "best value" - UNIQUE to pricing topic

Topic: "Delivery & App Experience"
❌ BAD: "How does ${brandName} work?" → Too generic, could apply to any topic
✅ GOOD: "How long does ${brandName} delivery take and what features are available in their mobile app?"
   → Includes "delivery take", "mobile app" - UNIQUE to delivery/app topic

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ FORBIDDEN PATTERNS (NEVER use these)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FORBIDDEN: Generic queries that could apply to multiple topics
   ❌ "What is ${brandName}?"
   ❌ "How does ${brandName} work?"
   ❌ "What does ${brandName} offer?"
   ❌ "What are ${brandName}'s products?"
   ❌ "Is ${brandName} good?"

FORBIDDEN: Queries without topic-specific keywords
   ❌ "Where can I find ${brandName}?"
   ❌ "How to use ${brandName}?"
   ❌ "What are ${brandName}'s benefits?"

FORBIDDEN: Queries that could apply to other topics
   ❌ "What are ${brandName}'s prices?" (could apply to "Pricing" or "Products" topics)
   ✅ MUST be: "What are ${brandName}'s pricing tiers and which option offers best value?" (specific to pricing)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 MANDATORY VALIDATION CHECKLIST (Check ALL before returning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EACH query, verify:

✅ UNIQUENESS CHECK:
   [ ] Query text is EXACTLY unique - no other topic has the same query
   [ ] Query meaning is UNIQUE - even if reworded, it wouldn't apply to other topics
   [ ] Query is semantically distinct from ALL other generated queries

✅ TOPIC EXCLUSIVITY CHECK:
   [ ] Query explicitly/implicitly references ONLY its assigned topic
   [ ] Query would NOT make sense if assigned to any other topic
   [ ] Query uses terminology UNIQUE to this topic
   [ ] Query addresses a question ONLY relevant to this topic

✅ SPECIFICITY CHECK:
   [ ] Query includes topic-specific keywords (not generic terms)
   [ ] Query is specific enough that it could ONLY apply to this topic
   [ ] Query uses long-tail keywords that narrow focus to THIS topic

✅ CROSS-TOPIC CHECK:
   [ ] Checked against Topic 1: Query would NOT apply ✅
   [ ] Checked against Topic 2: Query would NOT apply ✅
   [ ] Checked against ALL other topics: Query would NOT apply ✅

INTENT ASSIGNMENT:
- awareness: Learning about industry, discovering features, understanding benefits (NEUTRAL)
- comparison: Comparing options, evaluating alternatives (USE BRAND NAME ONLY IF COMPETITORS PROVIDED)
- purchase: Pricing, buying decisions, deals, where to buy (NEUTRAL)
- support: Troubleshooting, help, customer service, returns, refunds (NEUTRAL)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return JSON array with EXACTLY ${topics.length} queries (one per topic):
[
  {
    "topic": "Topic Name",
    "query": "Specific query that ONLY applies to this topic - must be unique",
    "intent": "awareness|comparison|purchase|support",
    "priority": 1
  }
]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 FINAL VALIDATION BEFORE RETURNING 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Count queries: Must equal ${topics.length} exactly
2. Check for duplicates: NO two queries should have the same text
3. Check for semantic similarity: NO two queries should have similar meaning
4. Verify topic coverage: ALL ${topics.length} topics must have a query
5. Verify uniqueness: Each query MUST be exclusive to its assigned topic
6. Cross-reference: Each query checked against ALL other topics - must be unique

CRITICAL: If ANY query could apply to another topic, you MUST regenerate it with more specificity.
CRITICAL: Return EXACTLY ${topics.length} unique queries. Zero duplicates. Zero overlaps.` : `GENERATE 8 QUERIES (EXACTLY 2 per intent):

MANDATORY INTENT DISTRIBUTION:
- awareness (2 queries): Brand discovery, learning about features, general info
- comparison (2 queries): Competitor comparisons, vs alternatives, better than
- purchase (2 queries): Buying decisions, pricing, where to buy, deals
- support (2 queries): Customer service, troubleshooting, help, returns, refunds

CRITICAL REQUIREMENTS:
- Generate EXACTLY 2 queries for EACH intent (8 total)
- Do NOT skip any intent category
- Support queries MUST include: help, troubleshooting, customer service, returns, refunds
- Each query must be unique and brand-specific

SUPPORT INTENT EXAMPLES:
- "How to contact [brand] customer support?"
- "What is [brand]'s return policy?"
- "How to get refund from [brand]?"
- "Troubleshooting [brand] [product] issues"`}

Return JSON array:
[{"topic": "Topic Name", "query": "Specific query for this topic only", "intent": "awareness|comparison|purchase|support", "priority": 1}]

CRITICAL VALIDATION BEFORE RETURNING:
1. Count the queries - must equal the number of topics exactly
2. Verify each query mentions or implies its assigned topic
3. Verify no two queries could logically apply to the same topic
4. Verify each query uses topic-specific keywords or context
5. Verify queries are semantically distinct (not just different wording)`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response - handle markdown formatting
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsedQueries = JSON.parse(jsonStr);
      
      if (!Array.isArray(parsedQueries)) {
        console.error('❌ OpenAI response is not an array:', parsedQueries);
        throw new Error('Invalid response format from OpenAI');
      }
      
      const queries = parsedQueries.map((item, index) => ({
        topic: item.topic || `Generated Topic ${index + 1}`,
        query: item.query || '',
        intent: item.intent || 'awareness',
        priority: item.priority || index + 1
      }));
      
      // If topics are provided, enforce completeness and uniqueness
      if (request.topics && request.topics.length > 0) {
        const enforcedQueries = await this.enforceTopicCompletenessAndUniqueness(queries, request, brandName);
        return enforcedQueries;
      }
      
      return queries;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate queries with OpenAI');
    }
  }


  /**
   * Generate mock queries when all other methods fail
   */
  private generateMockQueries(request: QueryGenerationRequest, brandName: string): Array<{ topic: string; query: string; intent: string; priority: number }> {
    const topics = [
      'Product Information',
      'Pricing & Value',
      'Competitor Comparison',
      'Brand Reputation',
      'Services & Features',
      'Customer Reviews',
      'Location & Hours',
      'Menu & Nutrition'
    ];

    return topics.map((topic, index) => ({
      topic,
      query: `${brandName} ${topic.toLowerCase()}`,
      intent: topic.toLowerCase().replace(' & ', ' '),
      priority: index + 1
    }));
  }

  /**
   * Extract topic from query prompt
   */
  private extractTopicFromQuery(prompt: string): string {
    if (prompt.includes('products and services')) return 'Product Information';
    if (prompt.includes('pricing and costs')) return 'Pricing & Value';
    if (prompt.includes('vs competitors')) return 'Competitor Comparison';
    if (prompt.includes('customer reviews')) return 'Customer Reviews';
    if (prompt.includes('features and benefits')) return 'Services & Features';
    if (prompt.includes('how to use')) return 'Getting Started';
    if (prompt.includes('support and customer service')) return 'Customer Support';
    if (prompt.includes('latest news')) return 'News & Updates';
    return 'General Information';
  }

  /**
   * Extract intent from query prompt
   */
  private extractIntentFromQuery(prompt: string): string {
    if (prompt.includes('products and services')) return 'product information';
    if (prompt.includes('pricing and costs')) return 'pricing value';
    if (prompt.includes('vs competitors')) return 'competitor comparison';
    if (prompt.includes('customer reviews')) return 'customer reviews';
    if (prompt.includes('features and benefits')) return 'services features';
    if (prompt.includes('how to use')) return 'getting started';
    if (prompt.includes('support and customer service')) return 'customer support';
    if (prompt.includes('latest news')) return 'news updates';
    return 'general information';
  }

  /**
   * Extract brand name from URL or use as-is
   */
  private extractBrandName(url: string): string {
    // If it's a URL, extract domain name
    if (url.includes('http') || url.includes('www')) {
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        return urlObj.hostname.replace('www.', '').split('.')[0];
      } catch {
        return url;
      }
    }
    return url;
  }

  /**
   * Get search intent for a topic
   */
  private getIntentForTopic(topic: string): string {
    const intentMap: Record<string, string> = {
      'Menu Nutrition': 'informational',
      'Whopper Ingredients': 'informational',
      'Pricing & Value': 'commercial',
      'Franchise Opportunities': 'navigational',
      'Sustainability Practices': 'informational',
      'Food Safety': 'informational',
      'Delivery & App Experience': 'transactional',
      'Brand Reputation': 'informational'
    };
    return intentMap[topic] || 'informational';
  }

  /**
   * Save generation results to database
   */
  private async saveGenerationToDatabase(
    generationId: string,
    request: QueryGenerationRequest,
    queries: Array<{ topic: string; query: string; intent: string; priority: number }>,
    provider: string,
    initialBrandName: string
  ): Promise<string> {
    try {
      // First, create a brand if it doesn't exist
      let brandId = request.brand_id;
      let brandName = initialBrandName;

      if (brandId && brandId !== 'test-brand-id') {
        try {
          const { data: existingBrand } = await supabaseAdmin
            .from('brands')
            .select('name')
            .eq('id', brandId)
            .single();
          if (existingBrand?.name) {
            brandName = existingBrand.name;
          }
        } catch (lookupError) {
          console.warn('⚠️ Could not fetch brand name for existing brand, keeping provided value:', lookupError);
        }
      }

      if (!brandId || brandId === 'test-brand-id') {
        // Create a default brand for this customer
        if (!brandName) {
          brandName = this.extractBrandName(request.url);
        }
        const { data: newBrand, error: brandError } = await supabaseAdmin
          .from('brands')
          .insert({
            customer_id: request.customer_id,
            name: brandName,
            slug: brandName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            homepage_url: request.url,
            industry: request.industry || 'General',
            summary: `Auto-created brand for ${brandName}`,
            status: 'active'
          })
          .select()
          .single();

        if (brandError) {
          console.error('Error creating brand:', brandError);
          throw new Error(`Failed to create brand: ${brandError.message}`);
        }

        brandId = newBrand.id;
        brandName = newBrand.name || brandName;
        console.log(`✅ Created brand: ${brandName} (${brandId})`);
      }

      // Save query generation record
      const { data: generationRows, error } = await supabaseAdmin
        .from('query_generations')
        .insert({
          id: generationId,
          brand_id: brandId,
          customer_id: request.customer_id,
          total_queries: queries.length,
          locale: request.locale,
          country: request.country,
          strategy: 'universal_prompt',
          // Note: brand_name column doesn't exist in query_generations table
          queries_by_intent: this.groupQueriesByIntent(queries),
          processing_time_seconds: 0,
          metadata: {
            provider,
            url: request.url,
            industry: request.industry,
            competitors: request.competitors,
            keywords: request.keywords,
            brand_name: brandName // Store brand name in metadata instead
          }
        })
        .select('id, brand_id, total_queries, created_at')
        .single();

      if (error) {
        console.error('Error saving query generation:', error);
        throw new Error(`Failed to save query generation: ${error.message}`);
      }

      // Save individual queries
      const queryInserts = queries.map((q, index) => ({
        generation_id: generationId,
        brand_id: brandId,
        // Note: brand_name column doesn't exist in generated_queries table
        customer_id: request.customer_id,
        query_text: q.query,
        intent: q.intent,
        brand: brandName,
        template_id: `template-${index}`,
        evidence_snippet: `Generated query for ${q.topic}`,
        evidence_source: 'query_generation_service',
        locale: request.locale,
        country: request.country,
        topic: q.topic, // Store topic in dedicated column
        metadata: {
          topic: q.topic, // CRITICAL: Preserve topic for frontend mapping (backward compatibility)
          topic_name: q.topic, // Also store as topic_name for compatibility
          priority: q.priority,
          index,
          provider,
          brand_name: brandName // Store brand name in metadata instead
        }
      }));

      const { error: queriesError } = await supabaseAdmin
        .from('generated_queries')
        .insert(queryInserts);

      if (queriesError) {
        console.error('Error saving generated queries:', queriesError);
        throw new Error(`Failed to save generated queries: ${queriesError.message}`);
      }

      console.log(
        `✅ Stored query generation ${generationRows.id} for brand ${brandId} (${queries.length} queries)`
      );
      const previewCount = Math.min(3, queryInserts.length);
      if (previewCount > 0) {
        console.log(
          `📝 Sample inserted queries:`,
          queryInserts.slice(0, previewCount).map((q) => q.query_text)
        );
      } else {
        console.log('ℹ️ No generated queries to log (query array empty).');
      }
      return brandName;
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  }

  /**
   * Group queries by intent for database storage
   */
  private groupQueriesByIntent(queries: Array<{ topic: string; query: string; intent: string; priority: number }>): Record<string, number> {
    const grouped: Record<string, number> = {};
    queries.forEach(q => {
      grouped[q.intent] = (grouped[q.intent] || 0) + 1;
    });
    return grouped;
  }

  /**
   * Validate and filter queries to ensure neutrality with enhanced scoring
   * Returns both filtered queries and a detailed validation report
   */
  private validateAndFilterNeutralQueriesWithScoring(
    queries: Array<{ topic: string; query: string; intent: string; priority: number }>,
    brandName: string,
    competitors?: string
  ): {
    neutralQueries: Array<{ topic: string; query: string; intent: string; priority: number }>;
    neutralityReport: NeutralityValidationReport;
  } {
    if (!brandName) {
      // No brand name to check against - all queries pass
      const report: NeutralityValidationReport = {
        totalQueries: queries.length,
        filteredQueries: 0,
        passedQueries: queries.length,
        filteredByReason: {},
        filteredQueriesDetails: [],
        strictness: this.neutralityStrictness,
        averageScore: 1.0
      };
      return { neutralQueries: queries, neutralityReport: report };
    }

    const normalizedBrandName = brandName.toLowerCase().trim();
    const competitorList = competitors ? competitors.split(',').map(c => c.trim().toLowerCase()) : [];
    
    // Expanded forbidden patterns with severity scores
    const forbiddenPatterns: Array<{ pattern: string; severity: number; reasonCode: string }> = [
      // High severity patterns (score 0.0-0.2)
      { pattern: `what is ${normalizedBrandName}`, severity: 0.0, reasonCode: 'BRAND_MENTION' },
      { pattern: `how does ${normalizedBrandName}`, severity: 0.0, reasonCode: 'BRAND_MENTION' },
      { pattern: `what does ${normalizedBrandName}`, severity: 0.0, reasonCode: 'BRAND_MENTION' },
      { pattern: `what are ${normalizedBrandName}`, severity: 0.0, reasonCode: 'BRAND_MENTION' },
      { pattern: `where can i find ${normalizedBrandName}`, severity: 0.1, reasonCode: 'BRAND_SPECIFIC' },
      { pattern: `how to use ${normalizedBrandName}`, severity: 0.1, reasonCode: 'BRAND_SPECIFIC' },
      
      // Medium severity patterns (score 0.3-0.5)
      { pattern: `${normalizedBrandName}'s`, severity: 0.3, reasonCode: 'BRAND_PREFERENCE' },
      { pattern: `${normalizedBrandName} offers`, severity: 0.3, reasonCode: 'BRAND_PREFERENCE' },
      { pattern: `${normalizedBrandName} provides`, severity: 0.3, reasonCode: 'BRAND_PREFERENCE' },
      { pattern: `${normalizedBrandName} features`, severity: 0.4, reasonCode: 'BRAND_PREFERENCE' },
      { pattern: `${normalizedBrandName} products`, severity: 0.4, reasonCode: 'BRAND_PREFERENCE' },
      { pattern: `${normalizedBrandName} services`, severity: 0.4, reasonCode: 'BRAND_PREFERENCE' },
      { pattern: `is ${normalizedBrandName}`, severity: 0.4, reasonCode: 'BRAND_PREFERENCE' },
      
      // Lower severity patterns (score 0.6-0.8)
      { pattern: `buy ${normalizedBrandName}`, severity: 0.6, reasonCode: 'BRAND_PREFERENCE' },
      { pattern: `${normalizedBrandName} review`, severity: 0.7, reasonCode: 'BRAND_PREFERENCE' },
      { pattern: `${normalizedBrandName} pricing`, severity: 0.7, reasonCode: 'BRAND_PREFERENCE' },
      { pattern: `${normalizedBrandName} vs`, severity: 0.8, reasonCode: 'COMPARISON_OK' },
      { pattern: `${normalizedBrandName} compared to`, severity: 0.8, reasonCode: 'COMPARISON_OK' }
    ];

    const neutralQueries: Array<{ topic: string; query: string; intent: string; priority: number }> = [];
    const filteredQueriesDetails: Array<{
      query: string;
      reason: string;
      reasonCode: string;
      score: number;
    }> = [];
    const filteredByReason: Record<string, number> = {};
    let totalScore = 0;
    let passedCount = 0;
    let filteredCount = 0;

    queries.forEach(query => {
      const neutralityScore = this.scoreQueryNeutrality(
        query.query,
        normalizedBrandName,
        competitorList,
        query.intent,
        forbiddenPatterns
      );

      totalScore += neutralityScore.score;

      // Determine filtering threshold based on strictness
      let threshold = 0.5; // Default moderate
      if (this.neutralityStrictness === 'strict') {
        threshold = 0.8; // Only queries with score >= 0.8 pass
      } else if (this.neutralityStrictness === 'lenient') {
        threshold = 0.3; // Queries with score >= 0.3 pass
      }

      if (neutralityScore.score >= threshold) {
        neutralQueries.push(query);
        passedCount++;
      } else {
        filteredCount++;
        const reasonCode = neutralityScore.reasonCode || 'BRAND_MENTION';
        filteredByReason[reasonCode] = (filteredByReason[reasonCode] || 0) + 1;
        
        filteredQueriesDetails.push({
          query: query.query,
          reason: neutralityScore.reason || 'Query mentions brand without proper context',
          reasonCode: reasonCode,
          score: neutralityScore.score
        });

        console.log(`🚫 Filtered non-neutral query (score ${neutralityScore.score.toFixed(2)}): "${query.query}" - ${neutralityScore.reason}`);
      }
    });

    const averageScore = queries.length > 0 ? totalScore / queries.length : 1.0;

    const neutralityReport: NeutralityValidationReport = {
      totalQueries: queries.length,
      filteredQueries: filteredCount,
      passedQueries: passedCount,
      filteredByReason,
      filteredQueriesDetails,
      strictness: this.neutralityStrictness,
      averageScore
    };

    return { neutralQueries, neutralityReport };
  }

  /**
   * Score query neutrality (0-1, where 1 is fully neutral)
   */
  private scoreQueryNeutrality(
    query: string,
    normalizedBrandName: string,
    competitorList: string[],
    intent: string,
    forbiddenPatterns: Array<{ pattern: string; severity: number; reasonCode: string }>
  ): NeutralityScore {
    const queryLower = query.toLowerCase().trim();
    
    // Check if query contains brand name
    if (!queryLower.includes(normalizedBrandName)) {
      return {
        score: 1.0,
        reason: 'Query does not mention brand',
        reasonCode: 'NEUTRAL'
      };
    }

    // Allow brand mentions in comparison queries if competitors are provided
    if (intent === 'comparison' && competitorList.length > 0) {
      // Check if query mentions at least one competitor along with brand
      const mentionsCompetitor = competitorList.some(competitor => 
        queryLower.includes(competitor)
      );
      
      if (mentionsCompetitor) {
        // This is a valid comparison query - allow it but with slightly lower score
        return {
          score: 0.9,
          reason: 'Valid comparison query with competitor',
          reasonCode: 'COMPARISON_OK'
        };
      }
    }

    // Check against forbidden patterns
    for (const patternInfo of forbiddenPatterns) {
      if (queryLower.includes(patternInfo.pattern)) {
        return {
          score: patternInfo.severity,
          reason: `Query matches forbidden pattern: "${patternInfo.pattern}"`,
          reasonCode: patternInfo.reasonCode as 'BRAND_MENTION' | 'BRAND_PREFERENCE' | 'BRAND_SPECIFIC' | 'NEUTRAL' | 'COMPARISON_OK'
        };
      }
    }

    // If brand is mentioned but not in a forbidden pattern and not a comparison,
    // assign a moderate penalty based on context
    const brandMentionCount = (queryLower.match(new RegExp(normalizedBrandName, 'g')) || []).length;
    const baseScore = 0.5;
    const penalty = Math.min(brandMentionCount * 0.2, 0.4); // Max penalty of 0.4
    
    return {
      score: Math.max(baseScore - penalty, 0.1),
      reason: `Query mentions brand "${normalizedBrandName}" without proper competitor context`,
      reasonCode: 'BRAND_MENTION'
    };
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use validateAndFilterNeutralQueriesWithScoring instead
   */
  private validateAndFilterNeutralQueries(
    queries: Array<{ topic: string; query: string; intent: string; priority: number }>,
    brandName: string,
    competitors?: string
  ): Array<{ topic: string; query: string; intent: string; priority: number }> {
    const { neutralQueries } = this.validateAndFilterNeutralQueriesWithScoring(queries, brandName, competitors);
    return neutralQueries;
  }
}

export const queryGenerationService = new QueryGenerationService();
