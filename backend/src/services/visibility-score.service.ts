import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Minimal env loading consistent with other services
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

export interface ScoreRow {
  customer_id: string | null;
  brand_id: string;
  brand_name: string;
  query_id: string | null; // May be null if question comes from collector_results
  query_text: string;
  execution_id?: string | null;
  collector_type: string; // Type of collector (e.g., Perplexity, Gemini, Grok, Bing Copilot)
  competitor_name: string; // Required: each row represents brand vs this competitor
  // Brand scores (for the brand in this query)
  visibility_index: number | null;
  sentiment_score: number | null; // -1 to 1
  share_of_answers: number | null; // 0-100 percentage
  brand_mention_positions?: number[] | null; // Array of word positions (1-based) where brand appears
  brand_position?: number | null; // First position where brand appears
  brand_positions?: number[] | null; // All positions where brand appears (same as brand_mention_positions)
  // Competitor scores (for this specific competitor)
  visibility_index_competitor: number | null;
  sentiment_score_competitor: number | null; // -1 to 1
  share_of_answers_competitor: number | null; // 0-100 percentage
  competitor_position?: number | null; // First position where competitor appears
  competitor_positions?: number[] | null; // All positions where competitor appears
  // Sentiment sentences (both brand and competitor)
  positive_sentiment_sentences?: string[] | null; // AI-extracted positive sentences for brand
  negative_sentiment_sentences?: string[] | null; // AI-extracted negative sentences for brand
  positive_sentiment_sentences_competitor?: string[] | null; // For competitor
  negative_sentiment_sentences_competitor?: string[] | null; // For competitor
  total_words: number;
}

const CollectorResultRow = z.object({
  id: z.union([z.string(), z.number()]),
  customer_id: z.string().nullable().optional(),
  brand_id: z.string(),
  query_id: z.string().nullable().optional(), // May be null, use question instead
  question: z.string().nullable().optional(), // Use this instead of generated_queries
  execution_id: z.string().nullable().optional(),
  collector_type: z.string(), // Type of collector (e.g., Perplexity, Gemini, Grok)
  raw_answer: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  competitors: z.any().nullable().optional(),
});

const GeneratedQueryRow = z.object({
  id: z.string(),
  query_text: z.string(),
});

const BrandRow = z.object({
  id: z.string(),
  name: z.string(),
  metadata: z.any().nullable().optional(),
});

const CompetitorRow = z.object({
  competitor_name: z.string(),
  metadata: z.any().nullable().optional(),
});

export class VisibilityScoreService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  public async computeAndUpsertForLatestResults(): Promise<number> {
    // Read from collector_results directly (preferred source)
    // Use question column instead of generated_queries
    // NOW INCLUDES collector_type for per-collector scoring
    
    // OPTIMIZATION: Only fetch results that haven't been scored yet
    // This prevents re-processing and saves API calls
    const { data: allResults, error: fetchError } = await this.supabase
      .from('collector_results')
      .select('id, customer_id, brand_id, query_id, question, execution_id, collector_type, raw_answer, brand, competitors, created_at')
      .order('created_at', { ascending: false })
      .limit(100); // Fetch more, filter later
    
    if (fetchError) throw fetchError;
    if (!allResults || allResults.length === 0) return 0;

    // Check which results already have scores
    const resultIds = allResults.map(r => r.id);
    const { data: existingScores, error: scoresError } = await this.supabase
      .from('scores')
      .select('id')
      .in('id', resultIds); // Note: This assumes scores table has a reference to collector_results.id
    
    // For now, we'll check by brand_id + query_id + collector_type combination
    // since we don't have a direct foreign key to collector_results
    const scoredCombinations = new Set<string>();
    
    for (const result of allResults) {
      const { data: existingScore } = await this.supabase
        .from('scores')
        .select('id')
        .eq('brand_id', result.brand_id)
        .eq('query_id', result.query_id)
        .eq('collector_type', result.collector_type)
        .limit(1)
        .maybeSingle();
      
      if (existingScore) {
        scoredCombinations.add(`${result.brand_id}-${result.query_id}-${result.collector_type}`);
      }
    }
    
    // Filter out already-scored results
    const results = allResults.filter(r => {
      const key = `${r.brand_id}-${r.query_id}-${r.collector_type}`;
      return !scoredCombinations.has(key);
    }).slice(0, 50); // Limit to 50 new results
    
    console.log(`📊 Found ${allResults.length} total results, ${results.length} need scoring (${scoredCombinations.size} already scored)`);

    if (results.length === 0) {
      console.log('✅ All results already scored! Nothing to process.');
      return 0;
    }

    let upserted = 0;
    // Process each collector result separately (not aggregated)
    for (const result of results) {
      const parsedResult = CollectorResultRow.parse(result);
      
      // Log which collector we're processing
      console.log(`\n🔍 Processing collector: ${parsedResult.collector_type} (ID: ${parsedResult.id})`);
      
      // Fetch brand data (still needed for brand_id and metadata)
      const brandRes = await this.supabase
        .from('brands')
        .select('id, name, metadata')
        .eq('id', parsedResult.brand_id)
        .single();
      
      if (brandRes.error || !brandRes.data) continue;
      const brand = BrandRow.parse(brandRes.data);
      
      // Use question from collector_results instead of generated_queries
      const questionText = (parsedResult.question || '').trim();
      if (!questionText) continue; // Skip if no question
      
      // Fetch competitors (fallback to brand_competitors if not in collector_results)
      const competitorsRes = await this.supabase
        .from('brand_competitors')
        .select('competitor_name, metadata')
        .eq('brand_id', parsedResult.brand_id)
        .order('priority', { ascending: false });
      
      const brandName = (parsedResult.brand && parsedResult.brand.trim()) || brand.name;
      let competitorsFromCR: string[] = [];
      if (Array.isArray(parsedResult.competitors)) {
        competitorsFromCR = (parsedResult.competitors as any[])
          .map((c) => (typeof c === 'string' ? c : (c?.name || c?.competitor_name || null)))
          .filter((c): c is string => !!c && c.trim().length > 0);
      }
      
      // Build a map of competitor_name -> metadata from brand_competitors for alias lookup
      const competitorMetadataMap = new Map<string, any>();
      (competitorsRes.data || []).forEach((c) => {
        const comp = CompetitorRow.parse(c);
        competitorMetadataMap.set(comp.competitor_name.toLowerCase(), comp.metadata);
      });
      
      // Prefer competitors from collector_results, but enrich with metadata from brand_competitors
      const competitorsList = competitorsFromCR.length > 0
        ? competitorsFromCR.map((name) => {
            // Look up metadata for this competitor from brand_competitors to get aliases
            const metadata = competitorMetadataMap.get(name.toLowerCase()) || null;
            return { competitor_name: name, metadata };
          })
        : ((competitorsRes.data || []).map((c) => CompetitorRow.parse(c)));
      
      // Log for debugging
      console.log(`📊 Processing ${competitorsList.length} competitors for brand ${brandName}:`, 
        competitorsList.map(c => c.competitor_name).join(', '));
      
      if (competitorsList.length === 0) continue;
      
      const rawAnswer = (parsedResult.raw_answer || '').trim();
      if (!rawAnswer) continue;

      // HYBRID APPROACH: LLM for counting, Manual for scoring
      let allMetrics: ScoreRow[];
      
      console.log(`🔬 Using HYBRID approach for ${brandName}: LLM counting + Manual scoring`);
      console.log(`📝 Answer length: ${rawAnswer.length} chars`);
      
      try {
        // Use hybrid approach: LLM for counting, manual for scoring
        allMetrics = await this.computeAllMetricsHybrid(
              parsedResult.customer_id ?? null,
              parsedResult.execution_id ?? null,
              { ...brand, name: brandName },
              questionText,
              parsedResult.query_id ?? null,
          parsedResult.collector_type, // Pass collector type
              competitorsList,
              rawAnswer,
              brand.metadata
            );
            
        // Log summary of hybrid results
            if (allMetrics.length > 0) {
              const firstRow = allMetrics[0];
          console.log(`✅ Hybrid scoring successful for ${brandName} (${parsedResult.collector_type})`);
          console.log(`📊 Results: VI=${firstRow.visibility_index}, SoA=${firstRow.share_of_answers}%, Sentiment=${firstRow.sentiment_score}`);
          console.log(`📍 Brand position: ${firstRow.brand_position}, Competitor positions: ${allMetrics.map(r => `${r.competitor_name}:${r.competitor_position}`).join(', ')}`);
        }
      } catch (error: any) {
        console.error(`❌ Hybrid scoring failed for ${brandName} (${parsedResult.collector_type}). Skipping this result.`);
          console.error(`   Error: ${error.message?.substring(0, 200) || error}`);
          continue;
      }

      // Validate execution_id exists before upserting (or set to null if invalid)
      let executionId = parsedResult.execution_id ?? null;
      if (executionId) {
        const { data: execExists } = await this.supabase
          .from('query_executions')
          .select('id')
          .eq('id', executionId)
          .maybeSingle();
        if (!execExists) {
          console.warn(`Execution ID ${executionId} not found in query_executions, setting to null`);
          executionId = null;
        }
      }

      // Update execution_id in rows if invalid
      allMetrics.forEach((row) => {
        if (!executionId) {
          row.execution_id = null;
        }
      });

      // Upsert all rows (each row has both brand and competitor scores)
      for (const row of allMetrics) {
        await this.upsertScore(row);
        upserted += 1;
      }
    }

    return upserted;
  }


  private upsertSchema = z.object({
    customer_id: z.string().nullable(),
    brand_id: z.string(),
    brand_name: z.string(),
    query_id: z.string().nullable(),
    query_text: z.string(),
    execution_id: z.string().nullable().optional(),
    collector_type: z.string(), // NEW: collector type
    competitor_name: z.string(), // Required now
    // Brand scores
    visibility_index: z.number().nullable(),
    sentiment_score: z.number().nullable().optional(),
    share_of_answers: z.number().nullable().optional(),
    brand_mention_positions: z.array(z.number()).nullable().optional(),
    // Competitor scores
    visibility_index_competitor: z.number().nullable().optional(),
    sentiment_score_competitor: z.number().nullable().optional(),
    share_of_answers_competitor: z.number().nullable().optional(),
    // Sentiment sentences
    positive_sentiment_sentences: z.array(z.string()).nullable().optional(),
    negative_sentiment_sentences: z.array(z.string()).nullable().optional(),
    positive_sentiment_sentences_competitor: z.array(z.string()).nullable().optional(),
    negative_sentiment_sentences_competitor: z.array(z.string()).nullable().optional(),
    total_words: z.number(),
  });

  private async upsertScore(row: ScoreRow): Promise<void> {
    const payload = this.upsertSchema.parse(row);
    
    // Convert string arrays to JSONB for PostgreSQL
    const dbPayload: any = {
      ...payload,
      positive_sentiment_sentences: payload.positive_sentiment_sentences 
        ? JSON.stringify(payload.positive_sentiment_sentences) 
        : null,
      negative_sentiment_sentences: payload.negative_sentiment_sentences 
        ? JSON.stringify(payload.negative_sentiment_sentences) 
        : null,
      positive_sentiment_sentences_competitor: payload.positive_sentiment_sentences_competitor 
        ? JSON.stringify(payload.positive_sentiment_sentences_competitor) 
        : null,
      negative_sentiment_sentences_competitor: payload.negative_sentiment_sentences_competitor 
        ? JSON.stringify(payload.negative_sentiment_sentences_competitor) 
        : null,
      brand_mention_positions: payload.brand_mention_positions 
        ? JSON.stringify(payload.brand_mention_positions) 
        : null,
      // Add position columns
      brand_position: row.brand_position || null,
      brand_positions: row.brand_positions 
        ? JSON.stringify(row.brand_positions) 
        : null,
      competitor_position: row.competitor_position || null,
      competitor_positions: row.competitor_positions 
        ? JSON.stringify(row.competitor_positions) 
        : null,
    };
    
    // Handle upsert (competitor_name and collector_type are now required)
    // First try to find existing row
    const query = this.supabase
      .from('scores')
      .select('id')
      .eq('brand_id', row.brand_id)
      .eq('query_id', row.query_id)
      .eq('competitor_name', row.competitor_name)
      .eq('collector_type', row.collector_type); // NEW: include collector_type in unique check
    
    const { data: existing, error: findError } = await query.maybeSingle();
    
    if (findError && findError.code !== 'PGRST116') throw findError; // PGRST116 = no rows
    
    if (existing) {
      // Update existing row
      const { error } = await this.supabase
        .from('scores')
        .update(dbPayload)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      // Insert new row
      const { error } = await this.supabase.from('scores').insert(dbPayload);
      if (error) throw error;
    }
  }

  // HYBRID APPROACH: LLM for counting, Manual for scoring
  private async computeAllMetricsHybrid(
    customerId: string | null,
    executionId: string | null,
    brand: z.infer<typeof BrandRow>,
    questionText: string,
    queryId: string | null,
    collectorType: string, // NEW: collector type for this result
    competitors: z.infer<typeof CompetitorRow>[],
    rawAnswer: string,
    brandMetadata?: any
  ): Promise<ScoreRow[]> {
    console.log(`\n🔬 HYBRID SCORING: LLM Counting + Manual Formulas`);
    
    // Step 1: Use LLM to count mentions (including product names)
    const counts = await this.countMentionsWithLLM(
      brand.name,
      competitors,
      rawAnswer,
      brandMetadata
    );
    
    console.log(`📊 LLM Counts:`, counts);
    
    // Step 2: Calculate word count and positions manually
    const normalizedAnswer = rawAnswer.replace(/\s+/g, ' ').trim();
    const tokens = this.tokenize(normalizedAnswer);
    const totalWords = tokens.length;
    
    // Get brand aliases for position finding
    const brandAliases = this.getAliases(brandMetadata || {}, brand.name);
    const brandOccurrences = this.findOccurrences(tokens, brandAliases);
    const brandPositions = brandOccurrences.positions;
    
    // Get competitor positions
    const competitorPositionsMap = new Map<string, number[]>();
    for (const comp of competitors) {
      const compAliases = this.getAliases(comp.metadata || {}, comp.competitor_name);
      const compOccurrences = this.findOccurrences(tokens, compAliases);
      competitorPositionsMap.set(comp.competitor_name, compOccurrences.positions);
    }
    
    // Step 3: Calculate sentiment manually (simple keyword matching)
    const brandSentences = this.findOccurrencesWithSentiment(tokens, brandAliases, normalizedAnswer);
    const brandSentiment = this.sentimentScore(brandSentences.sentences);
    const brandSentimentSentences = this.extractSentimentSentences(brandSentences.sentences, brand.name);
    
    // Step 4: Calculate scores using manual formulas
    const brandCount = counts.brand;
    const totalCompetitorMentions = Object.values(counts.competitors).reduce((sum, count) => sum + count, 0);
    
    // Brand scores (same for all rows)
    const brandVisibility = this.visibilityIndex(brandCount, brandPositions, totalWords);
    const brandShareOfAnswers = this.shareOfAnswers(brandCount, totalCompetitorMentions);
    
    console.log(`✅ Brand Scores: VI=${brandVisibility}, SoA=${brandShareOfAnswers}%, Sentiment=${brandSentiment}`);
    
    // Step 5: Create one row per competitor
    const rows: ScoreRow[] = competitors.map((comp) => {
      const compCount = counts.competitors[comp.competitor_name] || 0;
      const compPositions = competitorPositionsMap.get(comp.competitor_name) || [];
      
      // Competitor scores
      const compVisibility = this.visibilityIndex(compCount, compPositions, totalWords);
      const compShareOfAnswers = this.shareOfAnswers(compCount, brandCount);
      
      // Competitor sentiment
      const compAliases = this.getAliases(comp.metadata || {}, comp.competitor_name);
      const compSentences = this.findOccurrencesWithSentiment(tokens, compAliases, normalizedAnswer);
      const compSentiment = this.sentimentScore(compSentences.sentences);
      const compSentimentSentences = this.extractSentimentSentences(compSentences.sentences, comp.competitor_name);
      
      return {
        customer_id: customerId,
        brand_id: brand.id,
        brand_name: brand.name,
        query_id: queryId,
        query_text: questionText,
        execution_id: executionId,
        collector_type: collectorType, // NEW: include collector type
        competitor_name: comp.competitor_name,
        // Brand scores
        visibility_index: brandVisibility,
        sentiment_score: brandSentiment,
        share_of_answers: brandShareOfAnswers,
        brand_mention_positions: brandPositions.length > 0 ? brandPositions : null,
        brand_position: brandPositions.length > 0 ? brandPositions[0] : null,
        brand_positions: brandPositions.length > 0 ? brandPositions : null,
        // Competitor scores
        visibility_index_competitor: compVisibility,
        sentiment_score_competitor: compSentiment,
        share_of_answers_competitor: compShareOfAnswers,
        competitor_position: compPositions.length > 0 ? compPositions[0] : null,
        competitor_positions: compPositions.length > 0 ? compPositions : null,
        // Sentiment sentences
        positive_sentiment_sentences: brandSentimentSentences.positive,
        negative_sentiment_sentences: brandSentimentSentences.negative,
        positive_sentiment_sentences_competitor: compSentimentSentences.positive,
        negative_sentiment_sentences_competitor: compSentimentSentences.negative,
        total_words: totalWords,
      };
    });
    
    return rows;
  }

  // LLM-based mention counting (includes product names)
  private async countMentionsWithLLM(
    brandName: string,
    competitors: z.infer<typeof CompetitorRow>[],
    rawAnswer: string,
    brandMetadata?: any
  ): Promise<{ brand: number; competitors: { [key: string]: number } }> {
    // Step 1: Extract product names using LLM (gracefully handle failures)
    let productNames: string[] = [];
    try {
      productNames = await this.extractProductNames(brandMetadata || {}, brandName, rawAnswer);
      console.log(`🔍 Extracted ${productNames.length} product names for ${brandName}: ${productNames.slice(0, 5).join(', ')}${productNames.length > 5 ? '...' : ''}`);
    } catch (error) {
      console.warn(`⚠️ Product extraction failed, continuing with brand name only:`, error instanceof Error ? error.message : error);
      productNames = [];
    }
    
    // Step 2: Build simplified counting prompt
    const allBrandTerms = [brandName, ...productNames].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
    
    const prompt = `Count how many times each brand/product is mentioned in the text. Be thorough and count ALL occurrences.

BRAND: "${brandName}"
COUNT AS ${brandName}: ${allBrandTerms.join(', ')}

COMPETITORS: ${competitors.map(c => c.competitor_name).join(', ')}

TEXT TO ANALYZE:
${rawAnswer.substring(0, 3000)}

INSTRUCTIONS:
1. Count EVERY mention of the brand name and its products
2. Count EVERY mention of each competitor
3. Case-insensitive matching
4. Partial matches count (e.g., "Big Mac burger" counts as 1 mention of "Big Mac")

Return ONLY a JSON object with counts:
{
  "${brandName}": <count>,
  ${competitors.map(c => `"${c.competitor_name}": <count>`).join(',\n  ')}
}`;

    // Call LLM (use Cerebras or Gemini) with rate limit handling
    const cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
    const geminiApiKey = process.env['GEMINI_API_KEY'];
    
    let response: string | null = null;
    
    // Try Cerebras first
    if (cerebrasApiKey) {
      try {
        const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'llama3.1-8b';
        const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cerebrasApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: cerebrasModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.1,
          }),
        });
        
        if (res.status === 429) {
          console.warn('⚠️ Cerebras rate limit hit, trying Gemini...');
        } else if (!res.ok) {
          const errorText = await res.text();
          console.warn(`⚠️ Cerebras API error: ${res.status} ${res.statusText} - ${errorText.substring(0, 200)}`);
        } else {
          const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
          response = data.choices?.[0]?.message?.content;
        }
      } catch (error) {
        console.warn('⚠️ Cerebras request failed:', error instanceof Error ? error.message : error);
      }
    }
    
    // Try Gemini as fallback
    if (!response && geminiApiKey) {
      try {
        const geminiModel = process.env['GEMINI_MODEL'] || 'gemini-2.0-flash-exp';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
          }),
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.warn(`⚠️ Gemini API error: ${res.status} ${res.statusText} - ${errorText.substring(0, 200)}`);
        } else {
          const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          response = data.candidates?.[0]?.content?.parts?.[0]?.text;
        }
      } catch (error) {
        console.warn('⚠️ Gemini request failed:', error instanceof Error ? error.message : error);
      }
    }
    
    // If both APIs failed, throw error
    if (!response) {
      throw new Error('All LLM APIs failed or rate limited. Cannot count mentions.');
    }
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to parse LLM response: ${response.substring(0, 200)}`);
    }
    
    const counts = JSON.parse(jsonMatch[0]);
    
    // Extract brand count and competitor counts
    const brandCount = counts[brandName] || 0;
    const competitorCounts: { [key: string]: number } = {};
    
    for (const comp of competitors) {
      competitorCounts[comp.competitor_name] = counts[comp.competitor_name] || 0;
    }
    
    return {
      brand: brandCount,
      competitors: competitorCounts,
    };
  }

  // AI-based scoring (primary method) - DEPRECATED, use computeAllMetricsHybrid instead
  private async computeAllMetricsWithAI(
    customerId: string | null,
    executionId: string | null,
    brand: z.infer<typeof BrandRow>,
    questionText: string, // From collector_results.question
    queryId: string | null, // May be null
    collectorType: string, // Type of collector (e.g., Perplexity, Gemini, Grok, Bing Copilot)
    competitors: z.infer<typeof CompetitorRow>[],
    rawAnswer: string,
    brandMetadata?: any,
    validationData?: { 
      expectedWordCount: number; 
      expectedBrandMentions: number;
      expectedFirstPosition: number | null;
      expectedVI: number | null;
      expectedSoA: number | null;
    }
  ): Promise<ScoreRow[]> {
    const cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
    const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
    if (!cerebrasApiKey) throw new Error('Cerebras API key not configured');

    // Pre-calculate everything using our exact method (for determinism)
    const normalizedAnswerForCalc = rawAnswer.replace(/\s+/g, ' ').trim();
    const tokensForCalc = this.tokenize(normalizedAnswerForCalc);
    const wordCount = tokensForCalc.length;
    
    // Find brand mentions using our exact method
    const brandAliases = this.getAliases(brandMetadata || {}, brand.name);
    const brandOccurrences = this.findOccurrences(tokensForCalc, brandAliases);
    const brandMentions = brandOccurrences.occurrences;
    const brandPositions = brandOccurrences.positions;
    const firstPosition = brandPositions[0] || null;
    
    // Pre-calculate competitor mentions
    const competitorMentionsMap = new Map<string, { mentions: number; positions: number[] }>();
    for (const comp of competitors) {
      const compAliases = this.getAliases(comp.metadata || {}, comp.competitor_name);
      const compOccurrences = this.findOccurrences(tokensForCalc, compAliases);
      competitorMentionsMap.set(comp.competitor_name, {
        mentions: compOccurrences.occurrences,
        positions: compOccurrences.positions
      });
    }
    
    // Build SYSTEM message (instructions + pre-calculated values)
    // Note: buildSystemMessage is async because it extracts product names with LLM
    const systemMessage = await this.buildSystemMessage(
      brand.name,
      competitors,
      wordCount,
      brandMentions,
      brandPositions,
      competitorMentionsMap,
      brandMetadata,
      rawAnswer
    );
    
    // Build USER message (answer text only)
    const userMessage = `Analyze this answer text and calculate scores using the pre-calculated values from SYSTEM:\n\n${rawAnswer}`;
    
    // Use /v1/chat/completions with messages array (better SYSTEM/USER separation)
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cerebrasApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cerebrasModel,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 2500,
        temperature: 0,
        stop: ['```', '---'], // Stop on markdown code blocks
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Cerebras API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`);
    }

    const data = await response.json() as any;
    // Handle both chat/completions format (messages) and completions format (text)
    const generatedText = (data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '').toString().trim();
    
    // Log raw AI response for debugging
    console.log(`📥 Raw AI response (first 500 chars): ${generatedText.substring(0, 500)}...`);
    
    const aiResult = this.parseAIResponse(generatedText, brand.name, competitors);
    
    // Log parsed result structure for debugging
    console.log(`📊 Parsed AI result structure:`, {
      hasBrandMetrics: !!(aiResult as any).brand_metrics,
      hasCompetitors: Array.isArray((aiResult as any).competitors),
      hasScores: !!(aiResult as any).scores,
      brandVisibility: (aiResult as any).brand_metrics?.visibility_index ?? (aiResult as any).scores?.visibility_index?.[brand.name],
      competitorsCount: Array.isArray((aiResult as any).competitors) ? (aiResult as any).competitors.length : 'N/A'
    });
    
    // Validate AI used our provided values (strict validation since we provided exact values)
    const aiWordCount = (aiResult as any).total_words ?? null;
    const aiBrandMentions = (aiResult as any).brand_metrics?.mentions ?? null;
    const aiFirstPosition = (aiResult as any).brand_metrics?.positions?.[0] ?? null;
    
    let hasDiscrepancy = false;
    const discrepancies: string[] = [];
    
    // Validate word count (must match exactly since we provided it)
    if (aiWordCount !== null && aiWordCount !== wordCount) {
      hasDiscrepancy = true;
      discrepancies.push(`Word count: AI=${aiWordCount}, Expected=${wordCount} (must match exactly)`);
    }
    
      // AI counts brand mentions including product names - just log for reference (no strict validation)
      // AI uses its own intelligence to identify and count product mentions
      if (aiBrandMentions !== null) {
        console.log(`📊 AI counted ${aiBrandMentions} brand mentions (includes product names it identified)`);
        if (aiBrandMentions !== brandMentions) {
          console.log(`   Our base count (without product names): ${brandMentions} mentions`);
          if (aiBrandMentions > brandMentions) {
            console.log(`   AI found ${aiBrandMentions - brandMentions} additional mentions (likely product names)`);
          }
        }
      }
    
      // AI finds first position including product names - just log for reference (no strict validation)
      // AI might find first position at product name (e.g., GPT-4 at position 4) vs our base position
      if (aiFirstPosition !== null && firstPosition !== null && aiFirstPosition !== firstPosition) {
        console.log(`📊 AI found first position at ${aiFirstPosition} (may include product names), our base first position was ${firstPosition}`);
        // Don't treat as error - AI is counting product names too
      }
    
    // Log validation results (only validate word count - AI counts mentions and positions on its own)
    if (hasDiscrepancy) {
      console.warn(`⚠️ VALIDATION WARNING: AI did not use provided word count:`);
      discrepancies.forEach(d => console.warn(`   - ${d}`));
      console.warn(`   Falling back to manual calculation for accuracy`);
      throw new Error(`AI did not use provided word count - using manual calculation instead`);
    } else {
      console.log(`✅ Validation passed: AI used provided word count correctly`);
      console.log(`📊 AI Results: ${wordCount} words ✅, ${aiBrandMentions || 'N/A'} ${brand.name} mentions (AI counted including product names), first position: ${aiFirstPosition || firstPosition || 'none'}`);
    }

    // Parse AI response - handle both old format (scores object) and new format (brand_metrics + competitors array)
    // Use provided word count from pre-calculation (not AI's count)
    const totalWordsFromAI = wordCount; // Use pre-calculated value, not AI's value
    
    // Check if response is in new format (has brand_metrics and competitors array)
    const isNewFormat = !!(aiResult as any).brand_metrics && Array.isArray((aiResult as any).competitors);
    
    console.log(`🔍 Format detection: ${isNewFormat ? 'NEW (brand_metrics + competitors)' : 'OLD (scores object)'}`);
    
    if (isNewFormat) {
      // NEW FORMAT: Direct JSON with brand_metrics and competitors array
      const brandMetrics = (aiResult as any).brand_metrics;
      const competitorsArray = (aiResult as any).competitors;
      
      // Brand scores from AI - round to 2 decimal places
      const brandVisibility = typeof brandMetrics.visibility_index === 'number' 
        ? this.roundToTwoDecimals(brandMetrics.visibility_index) 
        : null;
      const brandSentiment = typeof brandMetrics.sentiment_score === 'number' 
        ? this.roundToTwoDecimals(brandMetrics.sentiment_score) 
        : null;
      const brandSoA = typeof brandMetrics.share_of_answers === 'number' 
        ? this.roundToTwoDecimals(brandMetrics.share_of_answers) 
        : (brandMetrics.share_of_answers ? this.roundToTwoDecimals(parseFloat(String(brandMetrics.share_of_answers).replace('%', ''))) : null);
      
      // Extract brand mention positions from AI response
      // Use AI-provided positions if available, otherwise fall back to pre-calculated positions
      const aiBrandPositions = Array.isArray(brandMetrics.positions) 
        ? brandMetrics.positions
            .filter((p): p is number => typeof p === 'number' && p >= 1)
            .sort((a, b) => a - b) // Sort ascending
        : null;
      // Use AI positions if available, otherwise use pre-calculated positions from function scope
      // brandPositions is calculated earlier in this function (line 374)
      const finalBrandPositions = aiBrandPositions && aiBrandPositions.length > 0 
        ? aiBrandPositions 
        : (brandPositions && brandPositions.length > 0 ? brandPositions : null);
      
      // Filter out non-string values (AI sometimes returns numbers/indices instead of sentence text)
      const brandPositiveSentences = Array.isArray(brandMetrics.positive_sentences) 
        ? (() => {
            const filtered = brandMetrics.positive_sentences
              .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
              .map(s => s.trim());
            return filtered.length > 0 ? filtered : null;
          })()
        : null;
      const brandNegativeSentences = Array.isArray(brandMetrics.negative_sentences) 
        ? (() => {
            const filtered = brandMetrics.negative_sentences
              .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
              .map(s => s.trim());
            return filtered.length > 0 ? filtered : null;
          })()
        : null;
      
      // Create one row per competitor from AI response
      // Map competitors from AI response to our competitor list (ensure all competitors have rows)
      const rows: ScoreRow[] = competitors.map((comp) => {
        // Find matching competitor data from AI response
        const compData = competitorsArray.find((c: any) => 
          c.competitor_name?.toLowerCase() === comp.competitor_name.toLowerCase()
        );
        
        if (!compData) {
          console.warn(`⚠️ Competitor "${comp.competitor_name}" not found in AI response. Using null values.`);
          // Return row with null values if competitor not in AI response
        return {
          customer_id: customerId,
          brand_id: brand.id,
          brand_name: brand.name,
          query_id: queryId,
          query_text: questionText,
          execution_id: executionId,
          collector_type: collectorType,
          competitor_name: comp.competitor_name,
          visibility_index: brandVisibility,
          sentiment_score: brandSentiment,
          share_of_answers: brandSoA,
          brand_mention_positions: finalBrandPositions,
          brand_position: finalBrandPositions && finalBrandPositions.length > 0 ? finalBrandPositions[0] : null,
          brand_positions: finalBrandPositions,
          visibility_index_competitor: null,
          sentiment_score_competitor: null,
          share_of_answers_competitor: null,
          competitor_position: null,
          competitor_positions: null,
          positive_sentiment_sentences: brandPositiveSentences,
          negative_sentiment_sentences: brandNegativeSentences,
          positive_sentiment_sentences_competitor: null,
          negative_sentiment_sentences_competitor: null,
          total_words: totalWordsFromAI,
        };
        }
        
        const compVisibility = typeof compData.visibility_index_competitor === 'number'
          ? this.roundToTwoDecimals(compData.visibility_index_competitor)
          : null;
        const compSentiment = typeof compData.sentiment_score_competitor === 'number'
          ? this.roundToTwoDecimals(compData.sentiment_score_competitor)
          : null;
        const compSoA = typeof compData.share_of_answers_competitor === 'number'
          ? this.roundToTwoDecimals(compData.share_of_answers_competitor)
          : (compData.share_of_answers_competitor ? this.roundToTwoDecimals(parseFloat(String(compData.share_of_answers_competitor).replace('%', ''))) : null);
        
        // Filter out non-string values (AI sometimes returns numbers/indices instead of sentence text)
        const compPositiveSentences = Array.isArray(compData.positive_sentences) 
          ? (() => {
              const filtered = compData.positive_sentences
                .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
                .map(s => s.trim());
              return filtered.length > 0 ? filtered : null;
            })()
          : null;
        const compNegativeSentences = Array.isArray(compData.negative_sentences) 
          ? (() => {
              const filtered = compData.negative_sentences
                .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
                .map(s => s.trim());
              return filtered.length > 0 ? filtered : null;
            })()
          : null;
        
        // Extract competitor positions from AI response
        const compPositionsFromAI = Array.isArray(compData.positions)
          ? compData.positions
              .filter((p): p is number => typeof p === 'number' && p >= 1)
              .sort((a, b) => a - b)
          : null;
        
        // Fall back to pre-calculated positions if AI didn't provide them
        const finalCompPositions = compPositionsFromAI && compPositionsFromAI.length > 0
          ? compPositionsFromAI
          : (competitorMentionsMap.get(comp.competitor_name)?.positions || null);
        
        console.log(`✅ Extracted values for ${comp.competitor_name}:`, {
          visibility_index: brandVisibility,
          visibility_index_competitor: compVisibility,
          sentiment_score: brandSentiment,
          sentiment_score_competitor: compSentiment,
          share_of_answers: brandSoA,
          share_of_answers_competitor: compSoA,
          brand_position: finalBrandPositions?.[0] || null,
          competitor_position: finalCompPositions?.[0] || null
        });
        
        return {
          customer_id: customerId,
          brand_id: brand.id,
          brand_name: brand.name,
          query_id: queryId,
          query_text: questionText,
          execution_id: executionId,
          collector_type: collectorType,
          competitor_name: comp.competitor_name,
          // Brand scores (same across all rows from AI)
          visibility_index: brandVisibility,
          sentiment_score: brandSentiment,
          share_of_answers: brandSoA,
          brand_mention_positions: finalBrandPositions,
          brand_position: finalBrandPositions && finalBrandPositions.length > 0 ? finalBrandPositions[0] : null,
          brand_positions: finalBrandPositions,
          // Competitor scores (specific to this competitor from AI)
          visibility_index_competitor: compVisibility,
          sentiment_score_competitor: compSentiment,
          share_of_answers_competitor: compSoA,
          competitor_position: finalCompPositions && finalCompPositions.length > 0 ? finalCompPositions[0] : null,
          competitor_positions: finalCompPositions,
          // Sentiment sentences from AI
          positive_sentiment_sentences: brandPositiveSentences,
          negative_sentiment_sentences: brandNegativeSentences,
          positive_sentiment_sentences_competitor: compPositiveSentences,
          negative_sentiment_sentences_competitor: compNegativeSentences,
          total_words: totalWordsFromAI,
        };
      });
      
      return rows;
    } else {
      // OLD FORMAT: scores object with nested structure
      const brandPositiveSentences = aiResult.positive_sentences?.[brand.name] ?? null;
      const brandNegativeSentences = aiResult.negative_sentences?.[brand.name] ?? null;
      
      // Brand scores (same for all rows) - round to 2 decimal places
      const brandVisibility = typeof aiResult.scores.visibility_index[brand.name] === 'number'
        ? this.roundToTwoDecimals(aiResult.scores.visibility_index[brand.name])
        : null;
      const brandSentiment = typeof aiResult.scores.sentiment_score[brand.name] === 'number'
        ? this.roundToTwoDecimals(aiResult.scores.sentiment_score[brand.name])
        : null;
      const brandSoA = aiResult.scores.share_of_answers !== null
        ? this.roundToTwoDecimals(parseFloat(aiResult.scores.share_of_answers.replace('%', '')))
        : null;

      // Create one row per competitor with both brand and competitor scores
      const rows: ScoreRow[] = competitors.map((comp) => {
        const compPositiveSentences = aiResult.positive_sentences?.[comp.competitor_name] ?? null;
        const compNegativeSentences = aiResult.negative_sentences?.[comp.competitor_name] ?? null;
        
        // Competitor scores - round to 2 decimal places
        const compVisibility = typeof aiResult.scores.visibility_index[comp.competitor_name] === 'number'
          ? this.roundToTwoDecimals(aiResult.scores.visibility_index[comp.competitor_name])
          : null;
        const compSentiment = typeof aiResult.scores.sentiment_score[comp.competitor_name] === 'number'
          ? this.roundToTwoDecimals(aiResult.scores.sentiment_score[comp.competitor_name])
          : null;
        
        // Get competitor SoA from AI response (in new format) or calculate if not provided
        let compSoA: number | null = null;
        if ((aiResult as any).competitors) {
          const compData = (aiResult as any).competitors.find((c: any) => c.competitor_name === comp.competitor_name);
          if (compData?.share_of_answers_competitor !== undefined) {
            const rawSoA = typeof compData.share_of_answers_competitor === 'number'
              ? compData.share_of_answers_competitor
              : parseFloat(String(compData.share_of_answers_competitor).replace('%', ''));
            compSoA = typeof rawSoA === 'number' ? this.roundToTwoDecimals(rawSoA) : rawSoA;
          }
        }
        
        // If AI didn't provide competitor SoA, don't calculate it manually - return null
        // (No fallback calculations - AI values only)
        
        return {
          customer_id: customerId,
          brand_id: brand.id,
          brand_name: brand.name,
          query_id: queryId,
          query_text: questionText,
          execution_id: executionId,
          collector_type: collectorType,
          competitor_name: comp.competitor_name,
          // Brand scores (same across all rows)
          visibility_index: brandVisibility,
          sentiment_score: brandSentiment,
          share_of_answers: brandSoA,
          // Competitor scores (specific to this competitor)
          visibility_index_competitor: compVisibility,
          sentiment_score_competitor: compSentiment,
          share_of_answers_competitor: compSoA, // Use AI value or null - no manual calculation
          // Sentiment sentences
          positive_sentiment_sentences: brandPositiveSentences,
          negative_sentiment_sentences: brandNegativeSentences,
          positive_sentiment_sentences_competitor: compPositiveSentences,
          negative_sentiment_sentences_competitor: compNegativeSentences,
          total_words: totalWordsFromAI,
        };
      });

      return rows;
    }
  }

  private async buildSystemMessage(
    brandName: string,
    competitors: z.infer<typeof CompetitorRow>[],
    wordCount: number,
    brandMentions: number,
    brandPositions: number[],
    competitorMentionsMap: Map<string, { mentions: number; positions: number[] }>,
    brandMetadata?: any,
    rawAnswer?: string
  ): Promise<string> {
    const compList = competitors.map(c => c.competitor_name);
    
    // Get brand aliases and product names (using hybrid approach with LLM extraction)
    const brandAliases = this.getAliases(brandMetadata || {}, brandName);
    const productNames = await this.extractProductNames(brandMetadata || {}, brandName, rawAnswer);
    console.log(`🔍 Extracted ${productNames.length} product names for ${brandName}: ${productNames.slice(0, 10).join(', ')}${productNames.length > 10 ? '...' : ''}`);
    const allBrandTerms = [brandName, ...brandAliases, ...productNames].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
    
    // Build competitor mentions string
    const competitorMentionsString = Array.from(competitorMentionsMap.entries())
      .map(([name, data]) => `  "${name}": ${data.mentions} mentions (positions: [${data.positions.slice(0, 10).join(', ')}${data.positions.length > 10 ? '...' : ''}])`)
      .join('\n');
    
    // Build JSON template
    const newFormatTemplate = {
      brand_name: brandName,
      total_words: wordCount, // Use provided value
      brand_metrics: {
        mentions: brandMentions, // Use provided value
        positions: brandPositions, // Use provided value
        visibility_index: null,
        sentiment_score: null,
        positive_sentences: [],
        negative_sentences: [],
        share_of_answers: null
      },
      competitors: compList.map(comp => ({
        competitor_name: comp,
        mentions: competitorMentionsMap.get(comp)?.mentions || 0,
        positions: competitorMentionsMap.get(comp)?.positions || [],
        visibility_index_competitor: null,
        sentiment_score_competitor: null,
        positive_sentences: [],
        negative_sentences: [],
        share_of_answers_competitor: null
      })),
      all_competitor_mentions: Array.from(competitorMentionsMap.values()).reduce((sum, data) => sum + data.mentions, 0),
      verification: {
        brand_soa_calculation: "",
        competitor_soa_examples: {}
      }
    };
    
    // Calculate expected VI for reference (shown to AI but not enforced)
    const expectedVI = this.visibilityIndex(brandMentions, brandPositions, wordCount);
    const expectedSoA = this.shareOfAnswers(
      brandMentions,
      Array.from(competitorMentionsMap.values()).reduce((sum, data) => sum + data.mentions, 0)
    );
    
    // Build explicit product names list for AI (from LLM extraction) with STRONG counting instructions
    const productNamesList = productNames.length > 0
      ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY PRODUCT NAMES TO COUNT AS "${brandName}" MENTIONS (EXTRACTED FROM ANSWER TEXT):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${productNames.map((p, idx) => `${idx + 1}. "${p}"`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP-BY-STEP COUNTING PROCESS (YOU MUST FOLLOW THIS EXACTLY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Count Direct Brand Name Mentions
  - Search for "${brandName}" (case-insensitive)
  - Count: ___ mentions

STEP 2: Count EACH Product Name (CRITICAL - DO THIS FOR EVERY PRODUCT):
${productNames.map((p, idx) => `  ${idx + 1}. Search for "${p}" (case-insensitive, partial matches count)
     Example: "Big Mac" matches "big mac", "Big Mac", "BIG MAC", "bigmac"
     Count: ___ mentions of "${p}"
`).join('')}
STEP 3: Calculate Total Brand Mentions
  Total "${brandName}" mentions = (STEP 1 count) + (Sum of all STEP 2 counts)
  
  Example:
  - "${brandName}" appears 5 times → STEP 1 = 5
  - "${productNames[0]}" appears 10 times → STEP 2.1 = 10
  - ${productNames.length > 1 ? `"${productNames[1]}" appears 3 times → STEP 2.2 = 3` : ''}
  - Total = 5 + 10${productNames.length > 1 ? ' + 3' : ''} = ${5 + 10 + (productNames.length > 1 ? 3 : 0)} mentions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL COUNTING RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **SEARCH THE ENTIRE ANSWER TEXT** - Read through every word
2. **COUNT EVERY OCCURRENCE** - Don't miss any mention
3. **CASE-INSENSITIVE** - "Big Mac", "big mac", "BIG MAC" all count
4. **PARTIAL MATCHES COUNT** - If text says "Big Mac burger", count it
5. **MULTIPLE PRODUCTS = MULTIPLE COUNTS** - If text says "Big Mac and fries", count as 2 mentions
6. **ADD ALL COUNTS TOGETHER** - Brand name + All products = Total mentions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDATION CHECKPOINT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your total mention count should be AT LEAST:
  - Our base count: ${brandMentions} (direct brand mentions only)
  - Plus product mentions (which could be ${productNames.length > 0 ? productNames.length * 2 + ' or more' : 'none'})
  
If your total count is LESS than ${brandMentions}, you are missing mentions!
Double-check that you counted ALL product names above.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      : `\n\n⚠️ WARNING: No product names were extracted from answer text for "${brandName}".\nYou should still use your knowledge to identify common product names (e.g., for OpenAI: GPT-4, ChatGPT, GPT-4 Turbo, etc.) and count them as "${brandName}" mentions.\n\nMake sure to search the entire answer text thoroughly for product names and count EVERY occurrence.`;
    
    return `You are a scoring analyst. Use pre-calculated word count, but COUNT BRAND MENTIONS yourself including product names.

PRECALCULATED VALUES (MUST USE THESE EXACT VALUES):
- Total word count: ${wordCount} (use this exact number - DO NOT recalculate)
- Competitor mentions and positions:
${competitorMentionsString}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND MENTION COUNTING (YOU MUST DO THIS - READ CAREFULLY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your goal: Count EVERY mention of "${brandName}" in the answer text, including:
  1. Direct brand name mentions ("${brandName}")
  2. Product name mentions (listed below)
  3. Brand aliases (variations of the brand name)

${productNamesList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO REPORT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **mentions**: Total count of ALL mentions (brand + products + aliases)
2. **positions**: Array of ALL word positions where ANY mention appears (1-based)
3. **first position**: The EARLIEST position where "${brandName}" OR any product name appears

EXAMPLE OUTPUT:
  {
    "mentions": 25,  // Total: 5 brand + 10 "big mac" + 8 "fries" + 2 "app" = 25
    "positions": [1, 5, 10, 15, 20, ...],  // All positions found
    "first_position": 1  // Earliest mention (could be brand name or product)
  }

CRITICAL RULES:
1. Use provided word count (${wordCount}) - DO NOT count words yourself
2. COUNT brand mentions yourself (including product names) - this is your task
3. Use provided first position (${brandPositions[0] || 'null'}) OR your first found position if different
4. Calculate formulas using YOUR counted mentions and provided word count:
   - VI = (Prominence * 0.6) + (Density * 0.4)
     * Prominence = 1 / Math.log10(first_position + 9)
     * Density = (YOUR_MENTION_COUNT) / ${wordCount}
   - SoA = (YOUR_BRAND_MENTIONS / (YOUR_BRAND_MENTIONS + CompetitorMentions)) * 100
   - Sentiment = (Positive - Negative) / TotalSentences

EXPECTED VALUES (for reference):
- Expected VI: ${expectedVI !== null && expectedVI !== 0 ? expectedVI.toFixed(4) : 'null'}
- Expected SoA: ${expectedSoA !== null ? expectedSoA.toFixed(2) + '%' : 'null'}
- Your calculations should match these expected values (within 5% tolerance)

OUTPUT FORMAT (use this exact structure):
${JSON.stringify(newFormatTemplate, null, 2)}

CRITICAL JSON RULES:
- visibility_index MUST be a number (calculate, don't use formula string)
- sentiment_score MUST be a number (-1.0 to 1.0)
- share_of_answers MUST be a number (0-100), not percentage string
- positive_sentences and negative_sentences MUST be arrays of STRINGS (full sentence text), NOT numbers or indices
  Example: ["This brand is excellent.", "The quality is outstanding."]
  NOT: [2, 5, 8] or any numbers
- All numeric fields must contain ONLY numbers, not formulas or expressions
- Return ONLY valid JSON - no text before { or after }`;
  }


  private parseAIResponse(
    text: string,
    brandName: string,
    competitors: z.infer<typeof CompetitorRow>[]
  ): any {
    // Support both old format (scores object) and new format (brand_metrics + competitors array)
    // Strategy 1: Find JSON object - look for "scores" key which is unique to our format
    let jsonText = text.trim();
    
    // Remove any text before the JSON object starts
    const scoresIndex = jsonText.indexOf('"scores"');
    if (scoresIndex > 0) {
      // Find the opening brace before "scores"
      const beforeScores = jsonText.substring(0, scoresIndex);
      const lastBrace = beforeScores.lastIndexOf('{');
      if (lastBrace >= 0) {
        jsonText = jsonText.substring(lastBrace);
      } else {
        // No brace found, start from scores
        jsonText = '{' + jsonText.substring(scoresIndex - 1);
      }
    }
    
    // Strategy 2: Find complete JSON object boundaries
    const firstBrace = jsonText.indexOf('{');
    if (firstBrace >= 0) {
      let braceCount = 0;
      let endPos = firstBrace;
      let inString = false;
      let escapeNext = false;
      
      for (let i = firstBrace; i < jsonText.length; i++) {
        const char = jsonText[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endPos = i + 1;
              break;
            }
          }
        }
      }
      jsonText = jsonText.substring(firstBrace, endPos);
    }

    // Strategy 2: Sanitize JSON - replace calculation formulas with actual values
    // Cerebras sometimes returns formulas like "6 / ((1 + 10 + 15) / 187)" instead of calculated numbers
    const sanitizedJson = this.sanitizeJsonFormulas(jsonText);
    
    // Log if sanitization changed anything
    if (sanitizedJson !== jsonText) {
      console.log(`🔧 Sanitized JSON: Replaced calculation formulas with actual values`);
      console.log(`   Example change: ${jsonText.substring(0, 100)}... → ${sanitizedJson.substring(0, 100)}...`);
    }
    
    // Strategy 3: Try to parse, return as-is (don't transform to old format)
    try {
      const parsed = JSON.parse(sanitizedJson);
      // Return the parsed JSON as-is - don't transform to old format
      // This allows both old format (scores object) and new format (brand_metrics + competitors) to work
      return parsed;
    } catch (error) {
      // Strategy 3: Try to find JSON starting from "brand_metrics" (new format)
      const brandMetricsIndex = jsonText.indexOf('"brand_metrics"');
      if (brandMetricsIndex > 0) {
        const beforeMetrics = jsonText.substring(0, brandMetricsIndex);
        const lastBrace = beforeMetrics.lastIndexOf('{');
        if (lastBrace >= 0) {
          const newJsonText = jsonText.substring(lastBrace);
          try {
            const parsed = JSON.parse(newJsonText);
            return parsed;
          } catch (e) {
            // Continue to try other methods
          }
        }
      }
      
      // Strategy 4: Try to find just the scores object (old format)
      const scoresMatch = jsonText.match(/"scores"\s*:\s*\{[\s\S]*?\}/);
      if (scoresMatch) {
        try {
          const scoresJson = `{${scoresMatch[0]}}`;
          const parsed = JSON.parse(scoresJson);
          return {
            scores: {
              visibility_index: parsed.scores?.visibility_index ?? {},
              sentiment_score: parsed.scores?.sentiment_score ?? {},
              share_of_answers: parsed.scores?.share_of_answers ?? null,
            },
            positive_sentences: parsed.positive_sentences ?? null,
            negative_sentences: parsed.negative_sentences ?? null,
          };
        } catch (e) {
          // Continue to throw original error
        }
      }
      
      console.error(`❌ Failed to parse AI JSON. Error: ${error}`);
      console.error(`❌ JSON text attempted: ${jsonText.substring(0, 500)}...`);
      throw new Error(`Failed to parse AI JSON: ${error}. Response text: ${text.substring(0, 500)}`);
    }
  }

  // Round numeric values to 2 decimal places (for sentiment scores, visibility indices, etc.)
  private roundToTwoDecimals(value: number | null): number | null {
    if (value === null || value === undefined) return null;
    return Math.round(value * 100) / 100;
  }

  // Sanitize JSON by evaluating calculation formulas
  private sanitizeJsonFormulas(jsonText: string): string {
    let sanitized = jsonText;
    
    // Pattern: Find formulas like "6 / ((1 + 10 + 15 + 25 + 35 + 45) / 187)"
    // Match: number / ((sum expression) / number)
    // This matches inside JSON value position (after colon, before comma/brace)
    const formulaPattern = /:\s*(\d+(?:\.\d+)?)\s*\/\s*\(\s*\(\s*((?:\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)+))\s*\)\s*\/\s*(\d+(?:\.\d+)?)\s*\)\s*([,}])/g;
    
    sanitized = sanitized.replace(formulaPattern, (match, numerator, sumExpr, divisor, after) => {
      try {
        const num = parseFloat(numerator);
        const div = parseFloat(divisor);
        
        // Calculate sum: "1 + 10 + 15 + 25 + 35 + 45" -> sum all numbers
        const sum = sumExpr.split(/\s*\+\s*/).reduce((acc: number, val: string) => {
          return acc + parseFloat(val.trim());
        }, 0);
        
        // Calculate: numerator / (sum / divisor)
        const result = num / (sum / div);
        
        // Replace formula with calculated value
        return `: ${result}${after}`;
      } catch (e) {
        console.warn(`⚠️ Failed to calculate formula: ${match.substring(0, 50)}...`, e);
        return match; // Return original if calculation fails
      }
    });
    
    // Also handle simpler division: "number / number"
    const simpleDivPattern = /:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*([,}])/g;
    sanitized = sanitized.replace(simpleDivPattern, (match, num1, num2, after) => {
      try {
        const result = parseFloat(num1) / parseFloat(num2);
        return `: ${result}${after}`;
      } catch {
        return match;
      }
    });
    
    return sanitized;
  }

  private getAliases(metadata: any, primaryName: string): string[] {
    const aliases: string[] = [primaryName.toLowerCase()]; // Always include primary name (lowercase)
    
    if (metadata && typeof metadata === 'object') {
      // Get aliases from metadata
      const metadataAliases = Array.isArray((metadata as any).aliases)
        ? ((metadata as any).aliases as string[])
        : [];
      metadataAliases.forEach(a => {
        if (a && typeof a === 'string') {
          aliases.push(a.toLowerCase());
        }
      });
    }
    
    // Also add common variations (e.g., "Nike" -> "nike", "Nike Inc" -> "nike inc")
    const variations: string[] = [];
    const words = primaryName.toLowerCase().split(/\s+/);
    if (words.length > 1) {
      // Add first word only (e.g., "New Balance" -> "new", "balance")
      variations.push(...words);
      // Add without common suffixes
      const withoutInc = primaryName.toLowerCase().replace(/\s*(inc|llc|corp|corporation|ltd|limited)\s*$/i, '').trim();
      if (withoutInc && withoutInc !== primaryName.toLowerCase()) {
        variations.push(withoutInc);
      }
    }
    
    return [...new Set([...aliases, ...variations])].filter(Boolean);
  }

  /**
   * Extract product names using LLM extraction from answer text ONLY
   * (No metadata or knowledge base - force LLM extraction every time)
   */
  private async extractProductNames(
    metadata: any,
    primaryName: string,
    answerText?: string
  ): Promise<string[]> {
    const productNames: string[] = [];
    
    // FORCE LLM extraction from answer text (if provided)
    if (answerText) {
      try {
        console.log(`🔍 FORCING LLM extraction of product names from answer text for brand: ${primaryName}`);
        const llmProducts = await this.extractProductNamesWithLLM(primaryName, answerText);
        if (llmProducts.length > 0) {
          productNames.push(...llmProducts);
          console.log(`✅ LLM extracted ${llmProducts.length} product names: ${llmProducts.slice(0, 10).join(', ')}${llmProducts.length > 10 ? '...' : ''}`);
        } else {
          console.log(`⚠️ LLM extraction returned no products for ${primaryName}`);
        }
      } catch (error) {
        console.error(`❌ LLM product extraction failed for ${primaryName}:`, error instanceof Error ? error.message : error);
        // Return empty array if LLM fails (no fallback)
        return [];
      }
    } else {
      console.warn(`⚠️ No answer text provided for product name extraction for ${primaryName}`);
      return [];
    }
    
    // Remove duplicates and return
    return [...new Set(productNames)].filter(Boolean);
  }

  // REMOVED: getCommonBrandProducts() - Not used anymore
  // User requested LLM-only extraction (no knowledge base fallback)
  /*
  private getCommonBrandProducts(brandName: string): string[] {
    ... old implementation removed ...
  }
  */

  /**
   * Extract product names from answer text using LLM (Cerebras or Gemini)
   */
  private async extractProductNamesWithLLM(brandName: string, answerText: string): Promise<string[]> {
    // Try Cerebras first (primary), then Gemini (fallback)
    const cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
    const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
    const geminiApiKey = process.env['GOOGLE_GEMINI_API_KEY'];
    const geminiModel = process.env['GOOGLE_GEMINI_MODEL'] || 'gemini-2.5-flash';
    
    // Try Cerebras first
    if (cerebrasApiKey && cerebrasApiKey !== 'your_cerebras_api_key_here') {
      try {
        return await this.extractWithCerebras(brandName, answerText, cerebrasApiKey, cerebrasModel);
      } catch (error) {
        console.warn('⚠️ Cerebras product extraction failed, trying Gemini...', error instanceof Error ? error.message : error);
      }
    }
    
    // Try Gemini as fallback
    if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        return await this.extractWithGemini(brandName, answerText, geminiApiKey, geminiModel);
      } catch (error) {
        console.warn('⚠️ Gemini product extraction failed:', error instanceof Error ? error.message : error);
      }
    }
    
    // If both fail, return empty array
    return [];
  }

  /**
   * Extract product names using Cerebras API
   */
  private async extractWithCerebras(
    brandName: string,
    answerText: string,
    apiKey: string,
    model: string
  ): Promise<string[]> {
    // Truncate answer text to avoid token limits (first 2000 chars should be enough)
    const truncatedText = answerText.substring(0, 2000);
    
    const prompt = `You are analyzing text for brand: "${brandName}".

TASK: Identify ALL product names in the text that should count as "${brandName}" mentions.

TEXT TO ANALYZE:
${truncatedText}

INSTRUCTIONS:
1. Find ALL product names, model names, service names, or specific item names that belong to "${brandName}"
2. Examples by industry:
   - Tech/AI: "OpenAI" → GPT-4, GPT-4 Turbo, ChatGPT, GPT-3.5, DALL-E
   - Tech/AI: "Google" → Gemini, Gemini Ultra, Bard, Google AI
   - Fashion/Retail: "Zara" → Summer dresses, linen blazer, blazers, TRF collection, Zara Home
   - Fashion/Retail: "Nike" → Air Max, React Infinity, Metcon, Jordan
   - Food: "McDonald's" → Big Mac, fries, Quarter Pounder, McFlurry, McDonald's app
3. Look for: specific product names, collection names, model numbers, app names, service offerings, menu items
4. Return ONLY a JSON array of product names (lowercase, no duplicates)
5. If no product names found, return empty array: []

OUTPUT FORMAT (JSON array only):
["product1", "product2", "product3"]`;

    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'You are a product name extraction assistant. Return only valid JSON arrays.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, // Low temperature for consistency
        max_tokens: 500,
        stop: ['---END---']
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Cerebras API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    if (!content.trim()) {
      throw new Error('Empty response from Cerebras API');
    }

    // Parse JSON array from response
    try {
      // Try to extract JSON array from response (might have extra text)
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const products = JSON.parse(jsonMatch[0]) as string[];
        return products.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .map(p => p.toLowerCase().trim());
      }
      
      // If no array found, try parsing entire content
      const products = JSON.parse(content) as string[];
      return products.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map(p => p.toLowerCase().trim());
    } catch (parseError) {
      throw new Error(`Failed to parse Cerebras response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract product names using Google Gemini API
   */
  private async extractWithGemini(
    brandName: string,
    answerText: string,
    apiKey: string,
    model: string
  ): Promise<string[]> {
    // Truncate answer text to avoid token limits (first 2000 chars should be enough)
    const truncatedText = answerText.substring(0, 2000);
    
    const prompt = `You are analyzing text for brand: "${brandName}".

TASK: Identify ALL product names in the text that should count as "${brandName}" mentions.

TEXT TO ANALYZE:
${truncatedText}

INSTRUCTIONS:
1. Find ALL product names, model names, service names, or specific item names that belong to "${brandName}"
2. Examples by industry:
   - Tech/AI: "OpenAI" → GPT-4, GPT-4 Turbo, ChatGPT, GPT-3.5, DALL-E
   - Tech/AI: "Google" → Gemini, Gemini Ultra, Bard, Google AI
   - Fashion/Retail: "Zara" → Summer dresses, linen blazer, blazers, TRF collection, Zara Home
   - Fashion/Retail: "Nike" → Air Max, React Infinity, Metcon, Jordan
   - Food: "McDonald's" → Big Mac, fries, Quarter Pounder, McFlurry, McDonald's app
3. Look for: specific product names, collection names, model numbers, app names, service offerings, menu items
4. Return ONLY a JSON array of product names (lowercase, no duplicates)
5. If no product names found, return empty array: []

OUTPUT FORMAT (JSON array only):
["product1", "product2", "product3"]`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3, // Low temperature for consistency
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 500,
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`);
    }

    const result = await response.json() as any;
    
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('No candidates in Gemini response');
    }

    const candidate = result.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('No content in Gemini response');
    }

    const content = candidate.content.parts[0].text;
    
    if (!content.trim()) {
      throw new Error('Empty response from Gemini API');
    }

    // Parse JSON array from response
    try {
      // Try to extract JSON array from response (might have extra text)
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const products = JSON.parse(jsonMatch[0]) as string[];
        return products.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .map(p => p.toLowerCase().trim());
      }
      
      // If no array found, try parsing entire content
      const products = JSON.parse(content) as string[];
      return products.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map(p => p.toLowerCase().trim());
    } catch (parseError) {
      throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
  }

  // Compute all metrics for a query: returns one row per competitor, each with brand + competitor scores
  private computeAllMetrics(
    customerId: string | null,
    executionId: string | null,
    brand: z.infer<typeof BrandRow>,
    questionText: string, // From collector_results.question
    queryId: string | null, // May be null
    collectorType: string, // Type of collector (e.g., Perplexity, Gemini, Grok, Bing Copilot)
    competitors: z.infer<typeof CompetitorRow>[],
    rawAnswer: string,
    brandMetadata?: any
  ): ScoreRow[] {
    const normalizedAnswer = rawAnswer.replace(/\s+/g, ' ').trim();
    const tokens = this.tokenize(normalizedAnswer);
    const totalWords = tokens.length;

    // Compute brand metrics once (used in all rows)
    const brandAliases = this.getAliases(brandMetadata, brand.name);
    const { occurrences: occBrand, positions: posBrand, sentences: brandSentences } =
      this.findOccurrencesWithSentiment(tokens, brandAliases, normalizedAnswer);
    const vib = typeof this.visibilityIndex(occBrand, posBrand, totalWords) === 'number'
      ? this.roundToTwoDecimals(this.visibilityIndex(occBrand, posBrand, totalWords))
      : this.visibilityIndex(occBrand, posBrand, totalWords);
    const ssBrandRaw = this.sentimentScore(brandSentences);
    const ssBrand = typeof ssBrandRaw === 'number' ? this.roundToTwoDecimals(ssBrandRaw) : ssBrandRaw;
    const brandSentimentSentences = this.extractSentimentSentences(brandSentences, brand.name);
    
    // Validate visibility index calculation (new formula with Prominence and Density)
    if (vib !== null && vib !== 0) {
      console.log(`📊 Brand visibility calculated: VI = ${vib.toFixed(2)} (Prominence: ${(1 / Math.log10((posBrand[0] || 1) + 9)).toFixed(2)}, Density: ${(occBrand / totalWords).toFixed(4)})`);
    }
    if (ssBrand === 1/7 || ssBrand === 0.14285714285714285) {
      console.warn(`⚠️ Suspicious sentiment_score (1/7 = ${ssBrand}) for brand "${brand.name}"`);
      console.warn(`   This means: 1 positive sentence, 0 negative, 7 total sentences`);
      console.warn(`   Verify if this is realistic or a calculation error`);
    }
    
    // Calculate brand share of answers (against ALL competitors)
    const totalBrandMentions = occBrand;

    // Pre-calculate ALL competitor occurrences using the SAME function for consistency
    // Store both occurrences and full data (for sentiment) to avoid double calculation
    const competitorDataMap = new Map<string, {
      occurrences: number;
      positions: number[];
      sentences: string[];
      aliases: string[];
    }>();
    
    for (const comp of competitors) {
      const compAliases = this.getAliases(comp.metadata, comp.competitor_name);
      const { occurrences, positions, sentences } =
        this.findOccurrencesWithSentiment(tokens, compAliases, normalizedAnswer);
      competitorDataMap.set(comp.competitor_name, {
        occurrences,
        positions,
        sentences,
        aliases: compAliases
      });
    }
    
    // Compute brand Share of Answers (against ALL competitors combined)
      // Use the SAME occurrences calculated above for consistency
      const allCompetitorMentions = Array.from(competitorDataMap.values())
        .reduce((sum, data) => sum + data.occurrences, 0);
      const soaBrandRaw = this.shareOfAnswers(totalBrandMentions, allCompetitorMentions);
      const soaBrand = typeof soaBrandRaw === 'number' ? this.roundToTwoDecimals(soaBrandRaw) : soaBrandRaw;

    // Create one row per competitor with both brand and competitor scores
    const rows: ScoreRow[] = competitors.map((comp) => {
      // Get pre-calculated competitor metrics (ensures consistency with allCompetitorMentions)
      const compData = competitorDataMap.get(comp.competitor_name)!;
      const { occurrences: occComp, positions: posComp, sentences: compSentences, aliases: compAliases } = compData;
      const vicRaw = this.visibilityIndex(occComp, posComp, totalWords);
      const vic = typeof vicRaw === 'number' ? this.roundToTwoDecimals(vicRaw) : vicRaw;
      const ssCompRaw = this.sentimentScore(compSentences);
      const ssComp = typeof ssCompRaw === 'number' ? this.roundToTwoDecimals(ssCompRaw) : ssCompRaw;
      const compSentimentSentences = this.extractSentimentSentences(compSentences, comp.competitor_name);
      
      // Log competitor detection for debugging
      if (occComp === 0) {
        console.log(`⚠️ Competitor "${comp.competitor_name}" not found in answer (aliases tried: ${compAliases.join(', ')})`);
        console.log(`   Sample answer text (first 200 chars): ${normalizedAnswer.substring(0, 200)}...`);
      } else {
        console.log(`✅ Found ${occComp} mentions of "${comp.competitor_name}" at positions ${posComp.slice(0, 5).join(', ')}`);
        console.log(`   Sentences with competitor: ${compSentences.length} | Sentiment score: ${ssComp}`);
        
        // Validate sentiment score calculation
        if (ssComp === 1/7 || ssComp === 0.14285714285714285) {
          console.warn(`⚠️ Suspicious sentiment_score_competitor (1/7 = ${ssComp}) for "${comp.competitor_name}"`);
          console.warn(`   This means: 1 positive sentence, 0 negative, 7 total sentences`);
          console.warn(`   Verify if this is realistic or a calculation error`);
        }
      }
      
      // Validate visibility index calculation (new formula with Prominence and Density)
      if (vic !== null && vic !== 0) {
        const firstPos = posComp[0] || 1;
        const prominence = 1 / Math.log10(firstPos + 9);
        const density = occComp / totalWords;
        console.log(`📊 Competitor "${comp.competitor_name}" visibility: VI = ${vic.toFixed(2)} (Prominence: ${prominence.toFixed(2)}, Density: ${density.toFixed(4)})`);
      }
      
      // Calculate competitor Share of Answers (this specific competitor vs brand - 1-on-1)
      // SoA for competitor = (CompetitorMentions / (CompetitorMentions + BrandMentions)) * 100
      const soaCompRaw = this.shareOfAnswers(occComp, totalBrandMentions);
      const soaComp = typeof soaCompRaw === 'number' ? this.roundToTwoDecimals(soaCompRaw) : soaCompRaw;
      
      // Validation: Ensure logical consistency
      // If brand SoA = 100%, then allCompetitorMentions = 0, so occComp must also be 0
      if (soaBrand === 100 && occComp > 0) {
        console.warn(`⚠️ INCONSISTENCY DETECTED: Brand SoA = 100% but competitor "${comp.competitor_name}" has ${occComp} mentions. This should not happen.`);
        console.warn(`   Brand mentions: ${totalBrandMentions}, All competitor mentions: ${allCompetitorMentions}, This competitor mentions: ${occComp}`);
      }
      
      return {
        customer_id: customerId,
        brand_id: brand.id,
        brand_name: brand.name,
        query_id: queryId,
        query_text: questionText,
        execution_id: executionId,
        collector_type: collectorType,
        competitor_name: comp.competitor_name,
        // Brand scores (same for all rows, representing the brand in this query)
        visibility_index: vib,
        sentiment_score: ssBrand,
        share_of_answers: soaBrand,
        brand_mention_positions: posBrand.length > 0 ? posBrand : null, // Store brand mention positions
        // Competitor scores (specific to this competitor)
        visibility_index_competitor: vic,
        sentiment_score_competitor: ssComp,
        share_of_answers_competitor: soaComp,
        // Sentiment sentences
        positive_sentiment_sentences: brandSentimentSentences.positive.length > 0 
          ? brandSentimentSentences.positive 
          : null,
        negative_sentiment_sentences: brandSentimentSentences.negative.length > 0 
          ? brandSentimentSentences.negative 
          : null,
        positive_sentiment_sentences_competitor: compSentimentSentences.positive.length > 0 
          ? compSentimentSentences.positive 
          : null,
        negative_sentiment_sentences_competitor: compSentimentSentences.negative.length > 0 
          ? compSentimentSentences.negative 
          : null,
        total_words: totalWords,
      };
    });

    return rows;
  }


  private tokenize(text: string): string[] {
    // Split on non-word unicode, keep alphanumerics; lowercase for case-insensitivity
    return text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
  }

  private findOccurrences(tokens: string[], aliases: string[]): { occurrences: number; positions: number[] } {
    const positions: number[] = [];
    const aliasTokenLists = aliases
      .map((a) => a.trim().toLowerCase()) // Normalize to lowercase
      .filter(Boolean)
      .map((a) => this.tokenize(a));

    // Remove duplicates from aliasTokenLists (same token sequence)
    const uniqueAliasTokenLists = Array.from(
      new Map(aliasTokenLists.map(alias => [alias.join(' '), alias])).values()
    );

    for (let i = 0; i < tokens.length; i++) {
      for (const aliasTokens of uniqueAliasTokenLists) {
        if (aliasTokens.length === 0) continue;
        if (i + aliasTokens.length - 1 >= tokens.length) continue;
        let match = true;
        for (let k = 0; k < aliasTokens.length; k++) {
          // Both should already be lowercase from tokenize()
          if (tokens[i + k] !== aliasTokens[k]) {
            match = false;
            break;
          }
        }
        if (match) {
          positions.push(i + 1); // 1-based position
          // Skip ahead to avoid double-counting overlapping matches
          i += aliasTokens.length - 1;
          break; // Found match, move to next token position
        }
      }
    }
    return { occurrences: positions.length, positions };
  }

  private findOccurrencesWithSentiment(
    tokens: string[],
    aliases: string[],
    normalizedAnswer: string
  ): { occurrences: number; positions: number[]; sentences: string[] } {
    const positions: number[] = [];
    const sentences: Set<string> = new Set();
    const aliasTokenLists = aliases
      .map((a) => a.trim())
      .filter(Boolean)
      .map((a) => this.tokenize(a));

    // Extract sentences (simple: split on . ! ?)
    const sentenceMatches = normalizedAnswer.match(/[^.!?]+[.!?]+/g) || [];
    const sentenceMap = new Map<number, string>(); // word position -> sentence

    let wordIndex = 1;
    for (const sentence of sentenceMatches) {
      const sentenceTokens = this.tokenize(sentence);
      for (let i = 0; i < sentenceTokens.length; i++) {
        sentenceMap.set(wordIndex + i, sentence.trim());
      }
      wordIndex += sentenceTokens.length;
    }

    for (let i = 0; i < tokens.length; i++) {
      for (const aliasTokens of aliasTokenLists) {
        if (aliasTokens.length === 0) continue;
        if (i + aliasTokens.length - 1 >= tokens.length) continue;
        let match = true;
        for (let k = 0; k < aliasTokens.length; k++) {
          if (tokens[i + k] !== aliasTokens[k]) {
            match = false;
            break;
          }
        }
        if (match) {
          positions.push(i + 1);
          const sentence = sentenceMap.get(i + 1);
          if (sentence) sentences.add(sentence);
        }
      }
    }
    return { occurrences: positions.length, positions, sentences: Array.from(sentences) };
  }

  private sentimentScore(sentences: string[]): number | null {
    // NULL rules:
    // - If brand never appears in answer -> NULL (not 0)
    // - If no sentences found -> NULL
    // 0 rules:
    // - If brand appears but all sentences are neutral -> 0
    if (sentences.length === 0) return null;

    const positiveKeywords = [
      'good', 'great', 'best', 'excellent', 'love', 'liked', 'awesome', 'effective',
      'recommended', 'positive', 'amazing', 'outstanding', 'superior', 'fantastic',
      'popular', 'preferred', 'leading', 'top', 'quality', 'reliable', 'trusted',
      'favorite', 'better', 'improved', 'successful', 'winning', 'advanced', 'innovative',
      'powerful', 'fast', 'efficient', 'affordable', 'valuable', 'worth', 'satisfied',
      'happy', 'pleased', 'impressive', 'strong', 'durable', 'comfortable'
    ];
    const negativeKeywords = [
      'bad', 'poor', 'terrible', 'hate', 'dislike', 'worst', 'ineffective', 'painful',
      'negative', 'awful', 'horrible', 'inferior', 'disappointing', 'problem', 'issue',
      'complaint', 'faulty', 'broken', 'defective', 'unreliable', 'slow', 'expensive',
      'overpriced', 'waste', 'regret', 'avoid', 'warning', 'dangerous', 'risky',
      'unstable', 'weak', 'cheap', 'flimsy', 'uncomfortable', 'difficult', 'complex'
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const hasPositive = positiveKeywords.some((kw) => lower.includes(kw));
      const hasNegative = negativeKeywords.some((kw) => lower.includes(kw));

      if (hasPositive && !hasNegative) positiveCount++;
      else if (hasNegative && !hasPositive) negativeCount++;
      // If both or neither -> neutral (doesn't increment either)
    }

    // SS = (#Positive - #Negative) / #AllSentences
    // If all neutral -> 0, otherwise calculated value
    return (positiveCount - negativeCount) / sentences.length;
  }

  // Extract positive and negative sentences for manual calculation
  private extractSentimentSentences(
    sentences: string[],
    brandName: string
  ): { positive: string[]; negative: string[] } {
    const positiveKeywords = [
      'good', 'great', 'best', 'excellent', 'love', 'liked', 'awesome', 'effective',
      'recommended', 'positive', 'amazing', 'outstanding', 'superior', 'fantastic',
      'popular', 'preferred', 'leading', 'top', 'quality', 'reliable', 'trusted',
      'favorite', 'better', 'improved', 'successful', 'winning', 'advanced', 'innovative',
      'powerful', 'fast', 'efficient', 'affordable', 'valuable', 'worth', 'satisfied',
      'happy', 'pleased', 'impressive', 'strong', 'durable', 'comfortable'
    ];
    const negativeKeywords = [
      'bad', 'poor', 'terrible', 'hate', 'dislike', 'worst', 'ineffective', 'painful',
      'negative', 'awful', 'horrible', 'inferior', 'disappointing', 'problem', 'issue',
      'complaint', 'faulty', 'broken', 'defective', 'unreliable', 'slow', 'expensive',
      'overpriced', 'waste', 'regret', 'avoid', 'warning', 'dangerous', 'risky',
      'unstable', 'weak', 'cheap', 'flimsy', 'uncomfortable', 'difficult', 'complex'
    ];

    const positive: string[] = [];
    const negative: string[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const hasPositive = positiveKeywords.some((kw) => lower.includes(kw));
      const hasNegative = negativeKeywords.some((kw) => lower.includes(kw));

      if (hasPositive && !hasNegative) {
        positive.push(sentence.trim());
      } else if (hasNegative && !hasPositive) {
        negative.push(sentence.trim());
      }
    }

    return { positive, negative };
  }

  private shareOfAnswers(brandMentions: number, competitorMentions: number): number | null {
    const total = brandMentions + competitorMentions;
    if (total === 0) return null;
    // Return as percentage (0-100)
    return (brandMentions / total) * 100;
  }

  /**
   * Calculate Visibility Index using weighted Prominence and Density formula
   * New Formula: VI = (P * 0.6) + (D * 0.4)
   * - Prominence (P) = 1 / Math.log10(first_position + 9)
   * - Density (D) = occurrences / total_words
   * 
   * @param occurrences - Total number of times the brand/competitor appears
   * @param positions - Array of word positions (1-based) where brand/competitor appears
   * @param totalWords - Total word count in the answer text
   * @returns Visibility Index (number), 0 if not mentioned, or null if calculation impossible
   */
  private visibilityIndex(occurrences: number, positions: number[], totalWords: number): number | null {
    // Edge Case: Empty Text
    // If total_words === 0, calculation is impossible
    if (totalWords === 0) return null;
    
    // Edge Case: Brand Not Present
    // If occurrences === 0, brand was never mentioned
    if (occurrences === 0) return 0;
    
    // Primary Calculation: Brand is Present
    // Need first_position for Prominence calculation
    if (!positions || positions.length === 0) {
      // This shouldn't happen if occurrences > 0, but handle gracefully
      return 0;
    }
    
    const firstPosition = positions[0]; // First appearance position (1-based)
    
    // Validate first_position
    if (!firstPosition || firstPosition < 1) {
      return 0;
    }
    
    // Calculate Density Score (D)
    // D = occurrences / total_words
    const density = occurrences / totalWords;
    
    // Calculate Prominence Score (P)
    // P = 1 / Math.log10(first_position + 9)
    // The + 9 ensures that first_position of 1 results in perfect score of 1.0
    // 1 / log10(1 + 9) = 1 / log10(10) = 1 / 1 = 1.0
    const prominence = 1 / Math.log10(firstPosition + 9);
    
    // Calculate Final Visibility Index
    // VI = (P * 0.6) + (D * 0.4)
    const visibilityIndex = (prominence * 0.6) + (density * 0.4);
    
    return visibilityIndex;
  }

  // ===== Cerebras integration =====
  private useCerebras(): boolean {
    const key = process.env['CEREBRAS_API_KEY'];
    const hasKey = !!key && key !== 'your_cerebras_api_key_here' && key.trim().length > 0;
    if (!hasKey) {
      console.log('⚠️ CEREBRAS_API_KEY not configured, using manual scoring only');
    }
    return hasKey;
  }

  // REMOVED: computeWithCerebras() - Old single VI calculation method (unused)
  // Replaced by computeAllMetricsWithAI() which calculates all metrics at once
  /*
  private async computeWithCerebras(...) {
    ... old implementation removed ...
  }
  */

  // REMOVED: buildCerebrasVisibilityPrompt() - Old prompt builder (unused)
  // Replaced by buildSystemMessage() which uses SYSTEM/USER message separation
  /*
  private buildCerebrasVisibilityPrompt(...) {
    ... old implementation removed ...
  }
  */

  // REMOVED: extractNumber() - Only used by unused computeWithCerebras()
  /*
  private extractNumber(text: string): number | null {
    ... old implementation removed ...
  }
  */
}

export default VisibilityScoreService;


