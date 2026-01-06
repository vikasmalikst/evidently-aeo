import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { consolidatedAnalysisService } from '../consolidated-analysis.service';

dotenv.config();

// Feature flag: Use consolidated analysis service
const USE_CONSOLIDATED_ANALYSIS = process.env.USE_CONSOLIDATED_ANALYSIS === 'true';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const openRouterSiteUrl = process.env.OPENROUTER_SITE_URL;
const openRouterSiteTitle = process.env.OPENROUTER_SITE_TITLE;
const openRouterModel = process.env.OPENROUTER_MODEL;

const sentimentDelayMs = parseInt(process.env.SENTIMENT_DELAY_MS || '0', 10);
const brandGroupLimit = parseInt(process.env.BRAND_SENTIMENT_GROUP_LIMIT || '20', 10);

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

if (!openRouterApiKey) {
  throw new Error('Missing OpenRouter credentials (OPENROUTER_API_KEY)');
}

export interface SentimentAnalysis {
  label: string;
  score: number;
  positiveSentences: string[];
  negativeSentences: string[];
}

export interface SentimentScoreOptions {
  customerId?: string;
  brandIds?: string[];
  since?: string;
  limit?: number;
}

const DEFAULT_SENTIMENT_LIMIT = 150;

export class BrandSentimentService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  public async scoreBrandSentiment(options: SentimentScoreOptions = {}): Promise<number> {
    const limit = Math.max(options.limit ?? DEFAULT_SENTIMENT_LIMIT, 1);

    console.log('\n🎯 Starting brand sentiment scoring (OpenRouter) ...');
    if (options.customerId) console.log(`   ▶ customer: ${options.customerId}`);
    if (options.brandIds?.length) console.log(`   ▶ brands: ${options.brandIds.join(', ')}`);
    if (options.since) console.log(`   ▶ since: ${options.since}`);
    console.log('   ▶ limit:', limit, '\n');

    let query = this.supabase
      .from('extracted_positions')
      .select('id, collector_result_id, brand_name, competitor_name, sentiment_score, sentiment_label, brand_id, customer_id, processed_at, total_brand_mentions')
      .is('sentiment_score', null)
      .or('competitor_name.is.null,competitor_name.eq.')
      .not('collector_result_id', 'is', null)
      .gt('total_brand_mentions', 0)
      .order('processed_at', { ascending: false })
      .limit(limit * 10);

    if (options.customerId) query = query.eq('customer_id', options.customerId);
    if (options.brandIds?.length) query = query.in('brand_id', options.brandIds);
    if (options.since) query = query.gte('processed_at', options.since);

    const { data: positionRows, error } = await query;
    if (error) throw error;
    if (!positionRows || positionRows.length === 0) {
      console.log('✅ No pending brand sentiment rows found in extracted_positions');
      return 0;
    }

    const brandRows = positionRows.filter(row =>
      (!row.competitor_name || row.competitor_name.trim().length === 0) &&
      (row.total_brand_mentions ?? 0) > 0,
    );
    const groupedByCollectorResult = new Map<number, Array<typeof positionRows[0]>>();
    for (const row of brandRows) {
      const crid = row.collector_result_id;
      if (!crid) continue;
      if (!groupedByCollectorResult.has(crid)) groupedByCollectorResult.set(crid, []);
      groupedByCollectorResult.get(crid)!.push(row);
    }

    let processed = 0;
    let failed = 0;
    let processedGroups = 0;
    const maxGroups = Math.min(limit, brandGroupLimit);

    for (const [collectorResultId, rows] of Array.from(groupedByCollectorResult.entries()).slice(0, maxGroups)) {
      try {
        processedGroups++;
        console.log(`\n📊 Processing brand group ${processedGroups}/${Math.min(groupedByCollectorResult.size, limit)}: collector_result_id=${collectorResultId} (${rows.length} position rows)`);

        const { data: collectorResult, error: crError } = await this.supabase
          .from('collector_results')
          .select('id, raw_answer')
          .eq('id', collectorResultId)
          .single();
        if (crError || !collectorResult || !collectorResult.raw_answer) {
          console.warn(`⚠️ Skipping group ${collectorResultId}: no raw_answer`);
          for (const row of rows) {
            await this.updatePositionRowsSentiment([row.id], { label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] });
            processed++;
          }
          continue;
        }

        const brandName = rows[0]?.brand_name || 'Brand';
        
        // Check if we have consolidated analysis result
        let sentiment;
        if (USE_CONSOLIDATED_ANALYSIS) {
          try {
            // Try to get from cache (if position extraction already ran)
            const cached = (consolidatedAnalysisService as any).cache.get(collectorResultId);
            if (cached?.sentiment?.brand) {
              sentiment = {
                label: cached.sentiment.brand.label,
                score: cached.sentiment.brand.score,
                positiveSentences: cached.sentiment.brand.positiveSentences || [],
                negativeSentences: cached.sentiment.brand.negativeSentences || []
              };
              console.log(`📦 Using consolidated brand sentiment for collector_result ${collectorResultId}`);
            } else {
              // Fallback to individual analysis
              sentiment = await this.analyzeSentimentWithOpenRouter(
                collectorResult.raw_answer,
                brandName,
              );
            }
          } catch (error) {
            console.warn(`⚠️ Failed to get consolidated sentiment, falling back:`, error instanceof Error ? error.message : error);
            sentiment = await this.analyzeSentimentWithOpenRouter(
              collectorResult.raw_answer,
              brandName,
            );
          }
        } else {
          sentiment = await this.analyzeSentimentWithOpenRouter(
            collectorResult.raw_answer,
            brandName,
          );
        }
        for (const row of rows) {
          await this.updatePositionRowsSentiment([row.id], sentiment);
          processed++;
        }
        console.log(`   ✅ Brand sentiment: ${sentiment.label} (${sentiment.score.toFixed(2)})`);

        if (processedGroups < maxGroups) {
          await this.sleep(sentimentDelayMs);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed += rows.length;
        console.error(`❌ Failed brand sentiment scoring for collector_result_id=${collectorResultId}: ${message}`);
      }
    }

    console.log(`\n✅ Brand sentiment scoring complete! Updated ${processed} rows from ${processedGroups} groups (${failed} failed)`);
    return processed;
  }

  private async analyzeSentimentWithOpenRouter(
    text: string,
    brandName: string,
  ): Promise<SentimentAnalysis> {
    // Use full text (no truncation per request)
    const prompt = `Analyze the sentiment for the brand "${brandName}" in the text below and provide:
1. Overall sentiment label: POSITIVE, NEGATIVE, or NEUTRAL
2. Sentiment score: -1.0 (very negative) to 1.0 (very positive)


Brand: ${brandName}

Text to analyze:
${text}

Respond with ONLY valid JSON in this exact format:
{
  "label": "POSITIVE|NEGATIVE|NEUTRAL",
  "score": 1 to 100
 
}`;

    const callOpenRouter = async (model: string) => {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          ...(openRouterSiteUrl ? { 'HTTP-Referer': openRouterSiteUrl } : {}),
          ...(openRouterSiteTitle ? { 'X-Title': openRouterSiteTitle } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
          temperature: 0.6,
          max_tokens: 2500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
      }

      return response.json() as Promise<any>;
    };

    // Primary: openai/gpt-oss-20b, Fallback: OPENROUTER_MODEL (if configured and different), then gpt-5-nano
    const models = [
      'openai/gpt-oss-20b',
      ...(openRouterModel && openRouterModel !== 'openai/gpt-oss-20b' ? [openRouterModel] : []),
      'openai/gpt-5-nano'
    ];
    let lastError: Error | null = null;
    let data: any = null;

    for (const model of models) {
      try {
        data = await callOpenRouter(model);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`⚠️ OpenRouter sentiment attempt failed for model "${model}": ${lastError.message}`);
      }
    }

    if (!data && lastError) {
      throw new Error(`OpenRouter sentiment failed after fallbacks: ${lastError.message}`);
    }

    const content = data?.choices?.[0]?.message?.content || '';

    // Be tolerant of wrappers (e.g., Markdown fences or prose around JSON)
    const sanitized = content.replace(/```(?:json)?/gi, '').trim();
    const firstBrace = sanitized.indexOf('{');
    const lastBrace = sanitized.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error(`No JSON found in OpenRouter response. Raw: ${sanitized.slice(0, 240)}`);
    }

    const jsonText = sanitized.slice(firstBrace, lastBrace + 1);
    let result: any;
    try {
      result = JSON.parse(jsonText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse OpenRouter JSON: ${msg}. Raw: ${sanitized.slice(0, 240)}`);
    }
    return {
      label: result.label?.toUpperCase() || 'NEUTRAL',
      score: Math.max(-1, Math.min(1, parseFloat(result.score) || 0)),
      positiveSentences: Array.isArray(result.positiveSentences) ? result.positiveSentences : [],
      negativeSentences: Array.isArray(result.negativeSentences) ? result.negativeSentences : [],
    };
  }

  private async updatePositionRowsSentiment(
    positionIds: number[],
    sentiment: SentimentAnalysis,
  ): Promise<void> {
    if (positionIds.length === 0) return;
    const { error } = await this.supabase
      .from('extracted_positions')
      .update({
        sentiment_label: sentiment.label,
        sentiment_score: sentiment.score,
        sentiment_positive_sentences: sentiment.positiveSentences,
        sentiment_negative_sentences: sentiment.negativeSentences,
      })
      .in('id', positionIds);
    if (error) throw error;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const brandSentimentService = new BrandSentimentService();

