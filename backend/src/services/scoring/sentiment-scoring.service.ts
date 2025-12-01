import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Sentiment Scoring uses CEREBRAS_API_KEY_2 (fallback: CEREBRAS_API_KEY)
const { getSentimentScoringKey, getGeminiKey, getGeminiModel, getCerebrasModel } = require('../../utils/api-key-resolver');
const cerebrasApiKey = getSentimentScoringKey();
const cerebrasModel = getCerebrasModel();
// Accept both GEMINI_API_KEY and GOOGLE_GEMINI_API_KEY for compatibility
const geminiApiKey = getGeminiKey();
// Allow overriding Gemini model via env (supports GOOGLE_GEMINI_MODEL or GEMINI_MODEL)
const geminiModel = getGeminiModel('gemini-1.5-flash');
const huggingFaceToken = process.env.HUGGINGFACE_API_TOKEN;
const huggingFaceModelUrl =
  process.env.HF_SENTIMENT_MODEL_URL ??
  'https://router.huggingface.co/hf-inference/models/distilbert/distilbert-base-uncased-finetuned-sst-2-english';

// Sentiment provider priority: Cerebras > Gemini > Hugging Face
const SENTIMENT_PROVIDER = (process.env.SENTIMENT_PROVIDER || 'cerebras').toLowerCase();

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

// At least one provider must be configured
if (!geminiApiKey && !cerebrasApiKey && !huggingFaceToken) {
  throw new Error('Missing sentiment analysis credentials. Please set at least one: GEMINI_API_KEY, CEREBRAS_API_KEY, or HUGGINGFACE_API_TOKEN');
}

interface SentimentResult {
  label: string;
  score: number;
}

interface SentimentAnalysis extends SentimentResult {
  positiveSentences: string[];
  negativeSentences: string[];
}

interface EntitySentimentAnalysis {
  entityName: string;
  label: string;
  score: number;
  positiveSentences: string[];
  negativeSentences: string[];
}

interface MultiEntitySentimentResult {
  entities: EntitySentimentAnalysis[];
}

export interface SentimentScoreOptions {
  customerId?: string;
  brandIds?: string[];
  since?: string;
  limit?: number;
}

const DEFAULT_SENTIMENT_LIMIT = 150;

export class SentimentScoringService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  /**
   * Score sentiment for collector_results rows that do not yet have a sentiment result.
   * Returns the number of rows updated.
   */
  public async scorePending(options: SentimentScoreOptions = {}): Promise<number> {
    const limit = Math.max(options.limit ?? DEFAULT_SENTIMENT_LIMIT, 1);

    console.log('\n🎯 Starting sentiment scoring...');
    
    // Show which provider is being used
    let providerInfo = 'Unknown';
    if (SENTIMENT_PROVIDER === 'cerebras' && cerebrasApiKey) {
      providerInfo = 'Cerebras (primary, high token limit)';
    } else if (SENTIMENT_PROVIDER === 'gemini' && geminiApiKey) {
      providerInfo = 'Gemini (1M token limit - no truncation needed!)';
    } else if (huggingFaceToken) {
      providerInfo = 'Hugging Face (512 token limit - may truncate)';
    }
    console.log(`   ▶ Provider: ${providerInfo}`);
    
    if (options.customerId) {
      console.log(`   ▶ customer: ${options.customerId}`);
    }
    if (options.brandIds?.length) {
      console.log(`   ▶ brands: ${options.brandIds.join(', ')}`);
    }
    if (options.since) {
      console.log(`   ▶ since: ${options.since}`);
    }
    console.log('   ▶ limit:', limit, '\n');

    // Query collector_results that need sentiment scoring
    let query = this.supabase
      .from('collector_results')
      .select(
        'id, raw_answer, sentiment_label, sentiment_score, sentiment_positive_sentences, sentiment_negative_sentences, query_id, metadata'
      )
      .is('sentiment_label', null)
      .not('raw_answer', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }
    if (options.brandIds && options.brandIds.length > 0) {
      query = query.in('brand_id', options.brandIds);
    }
    if (options.since) {
      query = query.gte('created_at', options.since);
    }

    const { data: rows, error } = await query;

    if (error) {
      throw error;
    }

    if (!rows || rows.length === 0) {
      console.log('✅ No pending sentiment rows found');
      return 0;
    }

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      try {
        console.log(`\n📊 Processing ${i + 1}/${rows.length}: collector_results.id=${row.id}`);
        
        // Check if raw_answer exists and is not empty
        if (!row.raw_answer || row.raw_answer.trim().length === 0) {
          console.warn(`⚠️ Skipping row ${row.id}: empty raw_answer`);
          // Set neutral sentiment for empty answers
          const { error: updateError } = await this.supabase
            .from('collector_results')
            .update({
              sentiment_label: 'NEUTRAL',
              sentiment_score: 0,
              sentiment_positive_sentences: [],
              sentiment_negative_sentences: [],
            })
            .eq('id', row.id);

          if (!updateError) {
            processed += 1;
            console.log(`✅ Set neutral sentiment for empty answer (id=${row.id})`);
          }
          continue;
        }

        const sentiment = await this.analyzeSentiment(row.raw_answer);

        // Get topic from generated_queries if query_id exists
        let topic: string | null = null;
        if (row.query_id) {
          try {
            const { data: queryData, error: queryError } = await this.supabase
              .from('generated_queries')
              .select('topic, metadata')
              .eq('id', row.query_id)
              .single();
            
            if (!queryError && queryData) {
              // Priority: 1) topic column, 2) metadata->>'topic_name', 3) metadata->>'topic'
              topic = queryData.topic || 
                      queryData.metadata?.topic_name || 
                      queryData.metadata?.topic || 
                      null;
            }
          } catch (err) {
            console.warn(`⚠️ Could not fetch topic for query_id ${row.query_id}:`, err);
          }
        }
        
        // Prepare metadata update - merge topic into existing metadata (for backward compatibility)
        const currentMetadata = row.metadata || {};
        const updatedMetadata = {
          ...currentMetadata,
          ...(topic ? { topic } : {})
        };

        // Update collector_results with sentiment and topic (both in column and metadata for backward compatibility)
        const updateData: any = {
          sentiment_label: sentiment.label,
          sentiment_score: sentiment.score,
          sentiment_positive_sentences: sentiment.positiveSentences,
          sentiment_negative_sentences: sentiment.negativeSentences,
          topic: topic || null, // Store topic in dedicated column
          metadata: updatedMetadata
        };

        const { error: updateError } = await this.supabase
          .from('collector_results')
          .update(updateData)
          .eq('id', row.id);

        if (updateError) {
          throw updateError;
        }

        processed += 1;
        const topicInfo = topic ? ` | Topic: ${topic}` : '';
        console.log(
          `✅ Sentiment scored: ${sentiment.label} (${sentiment.score.toFixed(2)}) | Positive: ${sentiment.positiveSentences.length}, Negative: ${sentiment.negativeSentences.length}${topicInfo}`
        );

        // Add delay between API calls to avoid rate limits (except for last item)
        if (i < rows.length - 1) {
          await this.sleep(2000); // 2 second delay between requests to avoid rate limits
        }
      } catch (scoringError) {
        const message =
          scoringError instanceof Error ? scoringError.message : String(scoringError);
        
        // Check if it's a rate limit error (429)
        const isRateLimit = message.includes('429') || 
                           message.includes('rate limit') || 
                           message.includes('too many requests') ||
                           message.includes('request_quota_exceeded');
        
        if (isRateLimit) {
          console.warn(`⚠️ Rate limit hit for row ${row.id}. Skipping this row (not scoring).`);
          console.warn(`   Waiting 60 seconds before continuing...`);
          await this.sleep(60000); // Wait 60 seconds on rate limit
          // Don't increment failed, don't update DB - just skip this row
          continue;
        }
        
        failed += 1;
        console.error(
          `❌ Failed sentiment scoring for collector_results.id=${row.id}: ${message}`
        );
        // For non-rate-limit errors, don't update DB - skip the row
        // Only update DB on successful scoring
      }
    }

    console.log(`\n✅ Sentiment scoring complete! Updated ${processed}/${rows.length} rows (${failed} failed)`);
    return processed;
  }

  /**
   * Score sentiment for extracted_positions rows (both brand and competitors).
   * Groups by collector_result_id to analyze once per answer, then updates all related rows.
   * Returns the number of rows updated.
   */
  public async scoreExtractedPositions(options: SentimentScoreOptions = {}): Promise<number> {
    const limit = Math.max(options.limit ?? DEFAULT_SENTIMENT_LIMIT, 1);

    console.log('\n🎯 Starting sentiment scoring for extracted_positions (brand + competitors)...');
    
    // Force Cerebras for competitor sentiment analysis
    if (!cerebrasApiKey) {
      throw new Error('Cerebras API key required for competitor sentiment scoring. Please set CEREBRAS_API_KEY or CEREBRAS_API_KEY_2');
    }
    console.log(`   ▶ Provider: Cerebras (required for multi-entity analysis)`);
    
    if (options.customerId) {
      console.log(`   ▶ customer: ${options.customerId}`);
    }
    if (options.brandIds?.length) {
      console.log(`   ▶ brands: ${options.brandIds.join(', ')}`);
    }
    if (options.since) {
      console.log(`   ▶ since: ${options.since}`);
    }
    console.log('   ▶ limit:', limit, '\n');

    // Query extracted_positions that need sentiment scoring
    let query = this.supabase
      .from('extracted_positions')
      .select(
        'id, collector_result_id, brand_name, competitor_name, sentiment_score, sentiment_label, brand_id, customer_id, processed_at'
      )
      .is('sentiment_score', null)
      .not('collector_result_id', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(limit * 10); // Get more rows since we'll group by collector_result_id

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }
    if (options.brandIds && options.brandIds.length > 0) {
      query = query.in('brand_id', options.brandIds);
    }
    if (options.since) {
      query = query.gte('processed_at', options.since);
    }

    const { data: positionRows, error } = await query;

    if (error) {
      throw error;
    }

    if (!positionRows || positionRows.length === 0) {
      console.log('✅ No pending sentiment rows found in extracted_positions');
      return 0;
    }

    // Group by collector_result_id
    const groupedByCollectorResult = new Map<number, Array<typeof positionRows[0]>>();
    for (const row of positionRows) {
      const collectorResultId = row.collector_result_id;
      if (!collectorResultId) continue;
      
      if (!groupedByCollectorResult.has(collectorResultId)) {
        groupedByCollectorResult.set(collectorResultId, []);
      }
      groupedByCollectorResult.get(collectorResultId)!.push(row);
    }

    console.log(`📊 Found ${positionRows.length} position rows grouped into ${groupedByCollectorResult.size} unique collector results\n`);

    let processed = 0;
    let failed = 0;
    let processedGroups = 0;

    // Process each group (one API call per collector_result_id)
    for (const [collectorResultId, rows] of Array.from(groupedByCollectorResult.entries()).slice(0, limit)) {
      try {
        processedGroups++;
        console.log(`\n📊 Processing group ${processedGroups}/${Math.min(groupedByCollectorResult.size, limit)}: collector_result_id=${collectorResultId} (${rows.length} position rows)`);

        // Get raw_answer from collector_results
        const { data: collectorResult, error: crError } = await this.supabase
          .from('collector_results')
          .select('id, raw_answer, brand_id, customer_id')
          .eq('id', collectorResultId)
          .single();

        if (crError || !collectorResult || !collectorResult.raw_answer) {
          console.warn(`⚠️ Skipping group ${collectorResultId}: no raw_answer found`);
          // Set neutral sentiment for all rows in this group
          await this.updatePositionRowsSentiment(
            rows.map(r => r.id),
            { entityName: '', label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] },
            null
          );
          processed += rows.length;
          continue;
        }

        const rawAnswer = collectorResult.raw_answer.trim();
        if (rawAnswer.length === 0) {
          console.warn(`⚠️ Skipping group ${collectorResultId}: empty raw_answer`);
          await this.updatePositionRowsSentiment(
            rows.map(r => r.id),
            { entityName: '', label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] },
            null
          );
          processed += rows.length;
          continue;
        }

        // Extract entities (brand + competitors) from position rows
        const brandRow = rows.find(r => !r.competitor_name || r.competitor_name.trim().length === 0);
        const competitorRows = rows.filter(r => r.competitor_name && r.competitor_name.trim().length > 0);
        
        const brandName = brandRow?.brand_name || rows[0]?.brand_name || 'Brand';
        const competitorNames = [...new Set(competitorRows.map(r => r.competitor_name!).filter(Boolean))];

        if (competitorNames.length === 0 && !brandRow) {
          console.warn(`⚠️ Skipping group ${collectorResultId}: no brand or competitor rows found`);
          continue;
        }

        // Analyze sentiment for all entities in one API call
        const entitySentiments = await this.analyzeMultiEntitySentiment(
          rawAnswer,
          brandName,
          competitorNames
        );

        // Update brand row if exists
        if (brandRow) {
          const brandSentiment = entitySentiments.find(e => 
            e.entityName.toLowerCase() === brandName.toLowerCase()
          ) || entitySentiments.find(e => e.entityName.toLowerCase() === 'brand');
          
          if (brandSentiment) {
            await this.updatePositionRowsSentiment(
              [brandRow.id],
              brandSentiment,
              brandName
            );
            processed++;
            console.log(`   ✅ Brand sentiment: ${brandSentiment.label} (${brandSentiment.score.toFixed(2)})`);
          }
        }

        // Update competitor rows
        for (const competitorRow of competitorRows) {
          const competitorName = competitorRow.competitor_name!;
          const competitorSentiment = entitySentiments.find(e => 
            e.entityName.toLowerCase() === competitorName.toLowerCase()
          );

          if (competitorSentiment) {
            await this.updatePositionRowsSentiment(
              [competitorRow.id],
              competitorSentiment,
              competitorName
            );
            processed++;
            console.log(`   ✅ ${competitorName} sentiment: ${competitorSentiment.label} (${competitorSentiment.score.toFixed(2)})`);
          } else {
            // Set neutral if not found
            await this.updatePositionRowsSentiment(
              [competitorRow.id],
              { entityName: competitorName, label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] },
              competitorName
            );
            processed++;
            console.log(`   ⚠️ ${competitorName}: sentiment not found, set to NEUTRAL`);
          }
        }

        // Add delay between API calls to avoid rate limits (except for last item)
        if (processedGroups < Math.min(groupedByCollectorResult.size, limit)) {
          await this.sleep(2000); // 2 second delay between requests
        }
      } catch (scoringError) {
        const message = scoringError instanceof Error ? scoringError.message : String(scoringError);
        
        // Check if it's a rate limit error (429)
        const isRateLimit = message.includes('429') || 
                           message.includes('rate limit') || 
                           message.includes('too many requests') ||
                           message.includes('request_quota_exceeded');
        
        if (isRateLimit) {
          console.warn(`⚠️ Rate limit hit for collector_result_id ${collectorResultId}. Skipping this group.`);
          console.warn(`   Waiting 60 seconds before continuing...`);
          await this.sleep(60000); // Wait 60 seconds on rate limit
          continue;
        }
        
        failed += rows.length;
        console.error(`❌ Failed sentiment scoring for collector_result_id=${collectorResultId}: ${message}`);
      }
    }

    console.log(`\n✅ Extracted positions sentiment scoring complete! Updated ${processed} rows from ${processedGroups} groups (${failed} failed)`);
    return processed;
  }

  /**
   * Update extracted_positions rows with sentiment data
   */
  private async updatePositionRowsSentiment(
    positionIds: number[],
    sentiment: EntitySentimentAnalysis,
    entityName: string | null
  ): Promise<void> {
    if (positionIds.length === 0) return;

    const updateData: any = {
      sentiment_label: sentiment.label,
      sentiment_score: sentiment.score,
      sentiment_positive_sentences: sentiment.positiveSentences,
      sentiment_negative_sentences: sentiment.negativeSentences,
    };

    const { error } = await this.supabase
      .from('extracted_positions')
      .update(updateData)
      .in('id', positionIds);

    if (error) {
      throw error;
    }
  }

  /**
   * Analyze sentiment for multiple entities (brand + competitors) in one API call using Cerebras
   */
  private async analyzeMultiEntitySentiment(
    text: string,
    brandName: string,
    competitorNames: string[]
  ): Promise<EntitySentimentAnalysis[]> {
    if (!cerebrasApiKey) {
      throw new Error('Cerebras API key not configured');
    }

    // Truncate to 20k words max
    const maxWords = 20000;
    const truncated = this.truncateToWordLimit(text, maxWords);

    const entities = [brandName, ...competitorNames];
    const entitiesList = entities.map((name, idx) => `${idx + 1}. ${name}`).join('\n');

    const prompt = `Analyze the sentiment for each of the following entities mentioned in the text below.

Entities to analyze:
${entitiesList}

For each entity, provide:
1. Sentiment label: POSITIVE, NEGATIVE, or NEUTRAL
2. Sentiment score: A precise decimal number from -1.0 (very negative) to 1.0 (very positive)
   - Use granular scores like 0.23, -0.45, 0.67, -0.12, 0.89, etc.
   - Avoid rounding to common values like 0.80, 0.70, 0.00
   - Calculate based on how the entity is discussed in the text
3. List of positive sentences mentioning this entity
4. List of negative sentences mentioning this entity

Text to analyze:
${truncated}

Respond with ONLY valid JSON in this exact format:
{
  "entities": [
    {
      "entityName": "${brandName}",
      "label": "POSITIVE|NEGATIVE|NEUTRAL",
      "score": -1.0 to 1.0 (precise decimal),
      "positiveSentences": ["sentence 1", "sentence 2"],
      "negativeSentences": ["sentence 1", "sentence 2"]
    },
    {
      "entityName": "CompetitorName",
      "label": "POSITIVE|NEGATIVE|NEUTRAL",
      "score": -1.0 to 1.0 (precise decimal),
      "positiveSentences": ["sentence 1"],
      "negativeSentences": ["sentence 1"]
    }
  ]
}`;

    try {
      const fullPrompt = `You are a sentiment analysis expert. Always respond with valid JSON only, no explanations.

${prompt}`;

      const response = await fetch('https://api.cerebras.ai/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cerebrasApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: cerebrasModel,
          prompt: fullPrompt,
          temperature: 0.3,
          max_tokens: 3000, // Increased for multiple entities
          stop: ['---END---']
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Cerebras API error: ${response.status} ${errorText}`);
        (error as any).statusCode = response.status;
        throw error;
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.text || data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in Cerebras response');
      }

      // Extract JSON from response
      let jsonStr = '';
      let cleanContent = content.trim();
      if (cleanContent.includes('```json')) {
        cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (cleanContent.includes('```')) {
        cleanContent = cleanContent.replace(/```\s*/g, '');
      }
      
      // Find JSON object by counting braces
      let braceCount = 0;
      let startIdx = -1;
      for (let i = 0; i < cleanContent.length; i++) {
        if (cleanContent[i] === '{') {
          if (startIdx === -1) startIdx = i;
          braceCount++;
        } else if (cleanContent[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            jsonStr = cleanContent.substring(startIdx, i + 1);
            break;
          }
        }
      }
      
      if (!jsonStr) {
        const jsonMatch = cleanContent.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }
      
      if (!jsonStr) {
        console.warn('⚠️ No valid JSON found in Cerebras response. Content preview:', content.substring(0, 500));
        throw new Error('No JSON found in Cerebras response');
      }

      const result = JSON.parse(jsonStr) as MultiEntitySentimentResult;
      
      if (!result.entities || !Array.isArray(result.entities)) {
        throw new Error('Invalid response format: entities array not found');
      }

      // Normalize and validate results
      return result.entities.map(entity => ({
        entityName: entity.entityName || '',
        label: (entity.label || 'NEUTRAL').toUpperCase(),
        score: Math.max(-1, Math.min(1, parseFloat(String(entity.score)) || 0)),
        positiveSentences: Array.isArray(entity.positiveSentences) ? entity.positiveSentences : [],
        negativeSentences: Array.isArray(entity.negativeSentences) ? entity.negativeSentences : [],
      }));
    } catch (error) {
      console.error('Cerebras multi-entity sentiment analysis failed:', error);
      // Return neutral sentiment for all entities on error
      return entities.map(name => ({
        entityName: name,
        label: 'NEUTRAL',
        score: 0,
        positiveSentences: [],
        negativeSentences: [],
      }));
    }
  }

  private async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    if (!text || text.trim().length === 0) {
      return { label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] };
    }

    // Use Cerebras (primary) or Gemini (fallback) for full text analysis (no chunking needed due to high token limits)
    if (SENTIMENT_PROVIDER === 'cerebras' && cerebrasApiKey) {
      try {
        return await this.analyzeSentimentWithCerebras(text);
      } catch (error) {
        console.warn('⚠️ Cerebras sentiment analysis failed, trying Gemini fallback...');
        if (geminiApiKey) {
          try {
            return await this.analyzeSentimentWithGemini(text);
          } catch (geminiError) {
            console.warn('⚠️ Gemini fallback also failed, using Hugging Face...');
            // Fall through to Hugging Face
          }
        }
        // Fall through to Hugging Face if no Gemini fallback
      }
    }
    
    if (SENTIMENT_PROVIDER === 'gemini' && geminiApiKey) {
      try {
        return await this.analyzeSentimentWithGemini(text);
      } catch (error) {
        console.warn('⚠️ Gemini sentiment analysis failed, trying Cerebras fallback...');
        if (cerebrasApiKey) {
          return await this.analyzeSentimentWithCerebras(text);
        }
        throw error;
      }
    }

    // Fallback to Hugging Face with chunking (for backward compatibility)
    console.log('   ⚠️ Using Hugging Face fallback (512 token limit - text will be chunked)');
    const chunks = this.chunkTextForModel(text);
    const chunkScores: number[] = [];

    for (const chunk of chunks) {
      const result = await this.callHuggingFaceModel(chunk);
      const normalized = this.normalizeScore(result.label, result.score);
      chunkScores.push(normalized);
    }

    // For sentence extraction, use Hugging Face (sentences are short)
    const sentences = this.extractSentences(text);
    const sentenceResults = await this.scoreSentences(sentences);

    const aggregatedScore =
      chunkScores.length === 0
        ? 0
        : chunkScores.reduce((sum, score) => sum + score, 0) / chunkScores.length;

    const label =
      aggregatedScore > 0.1 ? 'POSITIVE' : aggregatedScore < -0.1 ? 'NEGATIVE' : 'NEUTRAL';

    return {
      label,
      score: Math.round(aggregatedScore * 100) / 100,
      positiveSentences: sentenceResults.positive,
      negativeSentences: sentenceResults.negative,
    };
  }

  private extractTopCandidate(payload: any): { label: string; score: number } | null {
    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return null;
      }

      const first = payload[0];
      if (Array.isArray(first) && first.length > 0) {
        return typeof first[0] === 'object' ? first[0] : null;
      }

      if (typeof first === 'object' && first !== null) {
        return first as { label: string; score: number };
      }
    }

    if (payload?.label && payload?.score !== undefined) {
      return payload as { label: string; score: number };
    }

    return null;
  }

  private normalizeScore(label: string, score: number): number {
    const upperLabel = label.toUpperCase();
    const boundedScore = Math.max(0, Math.min(1, score ?? 0));

    if (upperLabel.includes('NEG')) {
      return -boundedScore;
    }

    if (upperLabel.includes('POS')) {
      return boundedScore;
    }

    return 0;
  }

  /**
   * Truncate text to a safe word limit that won't exceed Hugging Face's 512 token limit.
   * Using a conservative ratio: ~1.3 tokens per word on average, so 200 words ≈ 260 tokens (safe)
   */
  private truncateToWordLimit(text: string, limit = 200): string {
    const words = text.split(/\s+/);
    if (words.length <= limit) {
      return text;
    }
    return words.slice(0, limit).join(' ');
  }

  /**
   * Chunk text for model processing.
   * Using 200 words per chunk to stay well under 512 token limit (~260 tokens per chunk)
   */
  private chunkTextForModel(text: string, maxTokensPerChunk = 200): string[] {
    const sentences = this.extractSentences(text);
    if (sentences.length === 0) {
      return [];
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const candidate =
        currentChunk.length > 0 ? `${currentChunk} ${sentence}` : sentence;
      const wordCount = candidate.split(/\s+/).length;
      
      // Check if adding this sentence would exceed the limit
      if (wordCount > maxTokensPerChunk) {
        // If current chunk has content, save it
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }
        // If the sentence itself is too long, truncate it
        if (sentence.split(/\s+/).length > maxTokensPerChunk) {
          const truncatedSentence = this.truncateToWordLimit(sentence, maxTokensPerChunk);
          currentChunk = truncatedSentence;
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk = candidate;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private async scoreSentences(sentences: string[]): Promise<{
    positive: string[];
    negative: string[];
  }> {
    const positive: string[] = [];
    const negative: string[] = [];

    const limitedSentences = sentences.slice(0, 12);

    for (let i = 0; i < limitedSentences.length; i++) {
      const sentence = limitedSentences[i];
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      try {
        const result = await this.callHuggingFaceModel(trimmed);
        const normalized = this.normalizeScore(result.label, result.score);

        if (normalized >= 0.3) {
          positive.push(trimmed);
        } else if (normalized <= -0.3) {
          negative.push(trimmed);
        }

        // Add small delay between sentence scoring to avoid rate limits
        if (i < limitedSentences.length - 1) {
          await this.sleep(100); // 100ms delay between sentences
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Failed to score sentence sentiment: ${message}`);
        // Continue with next sentence even if one fails
      }
    }

    return { positive, negative };
  }

  /**
   * Analyze sentiment using Google Gemini (recommended - 1M token limit!)
   */
  private async analyzeSentimentWithGemini(text: string): Promise<SentimentAnalysis> {
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Truncate to 50k words max (Gemini can handle much more, but this is safe)
    const maxWords = 50000;
    const truncated = this.truncateToWordLimit(text, maxWords);

    const prompt = `Analyze the sentiment of the following text and provide:
1. Overall sentiment label: POSITIVE, NEGATIVE, or NEUTRAL
2. Sentiment score: -1.0 (very negative) to 1.0 (very positive)
3. List of positive sentences (sentences with positive sentiment)
4. List of negative sentences (sentences with negative sentiment)

Text to analyze:
${truncated}

Respond with ONLY valid JSON in this exact format:
{
  "label": "POSITIVE|NEGATIVE|NEUTRAL",
  "score": -1.0 to 1.0,
  "positiveSentences": ["sentence 1", "sentence 2"],
  "negativeSentences": ["sentence 1", "sentence 2"]
}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2000,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;
      
      // Check for API errors in response
      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      // Check if response was blocked or filtered
      if (data.candidates?.[0]?.finishReason) {
        const finishReason = data.candidates[0].finishReason;
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
          console.warn(`⚠️ Gemini response blocked/filtered (reason: ${finishReason}), using neutral sentiment`);
          return { label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] };
        }
      }
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content || content.trim().length === 0) {
        console.warn('⚠️ Empty content in Gemini response, using neutral sentiment');
        return { label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] };
      }

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ No JSON found in Gemini response, response preview:', content.substring(0, 200));
        return { label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] };
      }

      const result = JSON.parse(jsonMatch[0]);
      
      return {
        label: result.label?.toUpperCase() || 'NEUTRAL',
        score: Math.max(-1, Math.min(1, parseFloat(result.score) || 0)),
        positiveSentences: Array.isArray(result.positiveSentences) ? result.positiveSentences : [],
        negativeSentences: Array.isArray(result.negativeSentences) ? result.negativeSentences : [],
      };
    } catch (error) {
      console.error('Gemini sentiment analysis failed:', error instanceof Error ? error.message : error);
      // Fallback to neutral - don't throw, just return neutral sentiment
      return { label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] };
    }
  }

  /**
   * Analyze sentiment using Cerebras (high token limit, good fallback)
   */
  private async analyzeSentimentWithCerebras(text: string): Promise<SentimentAnalysis> {
    if (!cerebrasApiKey) {
      throw new Error('Cerebras API key not configured');
    }

    // Truncate to 20k words max (Cerebras can handle large contexts)
    const maxWords = 20000;
    const truncated = this.truncateToWordLimit(text, maxWords);

    const prompt = `Analyze the sentiment of the following text and provide:
1. Overall sentiment label: POSITIVE, NEGATIVE, or NEUTRAL
2. Sentiment score: A precise decimal number from -1.0 (very negative) to 1.0 (very positive)
   - Use granular scores like 0.23, -0.45, 0.67, -0.12, 0.89, etc.
   - Avoid rounding to common values like 0.80, 0.70, 0.00
   - Calculate based on the ratio of positive to negative sentiment
   - Be precise: if text is mostly positive with some negatives, use 0.65-0.75, not 0.80
3. List of positive sentences (sentences with positive sentiment)
4. List of negative sentences (sentences with negative sentiment)

Text to analyze:
${truncated}

Respond with ONLY valid JSON in this exact format:
{
  "label": "POSITIVE|NEGATIVE|NEUTRAL",
  "score": -1.0 to 1.0 (precise decimal, e.g., 0.67, -0.23, 0.45),
  "positiveSentences": ["sentence 1", "sentence 2"],
  "negativeSentences": ["sentence 1", "sentence 2"]
}`;

    try {
      // Use /v1/completions endpoint (not /v1/chat/completions) for Cerebras
      const fullPrompt = `You are a sentiment analysis expert. Always respond with valid JSON only, no explanations.

${prompt}`;

      const response = await fetch('https://api.cerebras.ai/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cerebrasApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: cerebrasModel,
          prompt: fullPrompt,
          temperature: 0.3, // Increased from 0.1 to get more varied, granular scores
          max_tokens: 2000,
          stop: ['---END---']
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Cerebras API error: ${response.status} ${errorText}`);
        // Preserve status code for rate limit detection
        (error as any).statusCode = response.status;
        throw error;
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.text || data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in Cerebras response');
      }

      // Extract JSON from response (handle markdown code blocks and extra text)
      // First, try to find JSON object boundaries more precisely
      let jsonStr = '';
      
      // Remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.includes('```json')) {
        cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (cleanContent.includes('```')) {
        cleanContent = cleanContent.replace(/```\s*/g, '');
      }
      
      // Find the first complete JSON object by counting braces
      let braceCount = 0;
      let startIdx = -1;
      for (let i = 0; i < cleanContent.length; i++) {
        if (cleanContent[i] === '{') {
          if (startIdx === -1) startIdx = i;
          braceCount++;
        } else if (cleanContent[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            jsonStr = cleanContent.substring(startIdx, i + 1);
            break;
          }
        }
      }
      
      // Fallback to regex if brace counting didn't work
      if (!jsonStr) {
        const jsonMatch = cleanContent.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }
      
      if (!jsonStr) {
        console.warn('⚠️ No valid JSON found in Cerebras response. Content preview:', content.substring(0, 500));
        throw new Error('No JSON found in Cerebras response');
      }

      const result = JSON.parse(jsonStr);
      
      return {
        label: result.label?.toUpperCase() || 'NEUTRAL',
        score: Math.max(-1, Math.min(1, parseFloat(result.score) || 0)),
        positiveSentences: Array.isArray(result.positiveSentences) ? result.positiveSentences : [],
        negativeSentences: Array.isArray(result.negativeSentences) ? result.negativeSentences : [],
      };
    } catch (error) {
      console.error('Cerebras sentiment analysis failed:', error);
      // Fallback to neutral
      return { label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] };
    }
  }

  /**
   * Call Hugging Face model (legacy/fallback - has 512 token limit)
   */
  private async callHuggingFaceModel(text: string, retries = 3): Promise<{ label: string; score: number }> {
    // Truncate to 200 words max to stay well under 512 token limit
    // Hugging Face models typically have 512 token limit, and ~1.3 tokens per word on average
    // So 200 words ≈ 260 tokens, leaving plenty of headroom
    const truncated = this.truncateToWordLimit(text, 200);

    if (!truncated || truncated.trim().length === 0) {
      return { label: 'NEUTRAL', score: 0 };
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Add timeout to fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(huggingFaceModelUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${huggingFaceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: truncated }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          
          // Handle rate limiting (429)
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
            
            if (attempt < retries) {
              console.warn(`⚠️ Rate limit hit (429), waiting ${waitTime}ms before retry ${attempt + 1}/${retries}...`);
              await this.sleep(waitTime);
              continue;
            }
            throw new Error(`Hugging Face API rate limit exceeded after ${retries} attempts`);
          }

          // Handle token limit errors (400 with tensor size error)
          if (response.status === 400 && errorText.includes('tensor') && errorText.includes('512')) {
            // Text is too long - use much smaller truncation and try once more
            console.warn(`⚠️ Text too long for model (exceeds 512 tokens), using minimal truncation (100 words)...`);
            const minimalTruncated = this.truncateToWordLimit(text, 100); // Very aggressive truncation
            // Only try once more with minimal truncation, don't recurse
            if (minimalTruncated !== truncated) {
              const minimalResponse = await fetch(huggingFaceModelUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${huggingFaceToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inputs: minimalTruncated }),
                signal: controller.signal,
              });
              
              if (minimalResponse.ok) {
                const minimalData = await minimalResponse.json();
                const candidate = this.extractTopCandidate(minimalData);
                if (candidate) {
                  return candidate;
                }
              }
            }
            // If still fails, return neutral sentiment instead of throwing
            console.warn(`⚠️ Text still too long even with minimal truncation, using neutral sentiment`);
            return { label: 'NEUTRAL', score: 0 };
          }

          // Handle other errors
          if (response.status >= 500 && attempt < retries) {
            const waitTime = Math.pow(2, attempt) * 1000;
            console.warn(`⚠️ Server error (${response.status}), waiting ${waitTime}ms before retry ${attempt + 1}/${retries}...`);
            await this.sleep(waitTime);
            continue;
          }

          throw new Error(`Hugging Face API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const candidate = this.extractTopCandidate(data);
        if (!candidate) {
          return { label: 'NEUTRAL', score: 0 };
        }
        return candidate;
      } catch (error) {
        // Handle timeout/abort
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < retries) {
            console.warn(`⚠️ Request timeout, retrying ${attempt + 1}/${retries}...`);
            await this.sleep(Math.pow(2, attempt) * 1000);
            continue;
          }
          throw new Error('Hugging Face API request timeout after retries');
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          if (attempt < retries) {
            console.warn(`⚠️ Network error, retrying ${attempt + 1}/${retries}...`);
            await this.sleep(Math.pow(2, attempt) * 1000);
            continue;
          }
          throw new Error(`Network error: ${error.message}`);
        }

        // If it's the last attempt or not a retryable error, throw
        if (attempt === retries || !(error instanceof Error)) {
          throw error;
        }

        // Wait before retry
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('Failed to call Hugging Face API after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractSentences(text: string): string[] {
    return text
      .replace(/\r?\n+/g, ' ')
      .split(/(?<=[.?!])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
  }
}

export const sentimentScoringService = new SentimentScoringService();


