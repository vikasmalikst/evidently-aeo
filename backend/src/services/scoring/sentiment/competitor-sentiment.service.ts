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

const sentimentDelayMs = parseInt(process.env.SENTIMENT_DELAY_MS || '0', 10);
const competitorGroupLimit = parseInt(process.env.COMPETITOR_SENTIMENT_GROUP_LIMIT || '15', 10);

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

if (!openRouterApiKey) {
  throw new Error('Missing OpenRouter credentials (OPENROUTER_API_KEY)');
}

export interface CompetitorSentimentAnalysis {
  entityName: string;
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

export class CompetitorSentimentService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  public async scoreCompetitorSentiment(options: SentimentScoreOptions = {}): Promise<number> {
    const limit = Math.max(options.limit ?? DEFAULT_SENTIMENT_LIMIT, 1);

    console.log('\n🎯 Starting competitor sentiment scoring (OpenRouter) ...');
    if (options.customerId) console.log(`   ▶ customer: ${options.customerId}`);
    if (options.brandIds?.length) console.log(`   ▶ brands: ${options.brandIds.join(', ')}`);
    if (options.since) console.log(`   ▶ since: ${options.since}`);
    console.log('   ▶ limit:', limit, '\n');

    // Feature flag: Use optimized query (new schema) vs legacy (extracted_positions)
    const USE_OPTIMIZED_SENTIMENT_QUERY = process.env.USE_OPTIMIZED_SENTIMENT_QUERY === 'true';
    
    let positionRows: any[] = [];
    let error: any = null;

    if (USE_OPTIMIZED_SENTIMENT_QUERY) {
      console.log('   ⚡ Using optimized competitor sentiment query (new schema)');
      
      // OPTIMIZED: Query metric_facts + competitor_metrics for rows without sentiment
      let query = this.supabase
        .from('metric_facts')
        .select(`
          id,
          collector_result_id,
          brand_id,
          customer_id,
          processed_at,
          competitor_metrics!inner(
            competitor_id,
            brand_competitors!inner(competitor_name)
          )
        `)
        .not('collector_result_id', 'is', null)
        .order('processed_at', { ascending: false })
        .limit(limit * 10);

      if (options.customerId) query = query.eq('customer_id', options.customerId);
      if (options.brandIds?.length) query = query.in('brand_id', options.brandIds);
      if (options.since) query = query.gte('processed_at', options.since);

      const { data, error: queryError } = await query;
      error = queryError;

      // Check if competitor_sentiment exists for each row
      if (data && data.length > 0) {
        // Flatten competitor_metrics and check for existing sentiment
        const competitorMetricPairs: Array<{ metric_fact_id: number; competitor_id: string; competitor_name: string }> = [];
        
        data.forEach(d => {
          const cms = Array.isArray(d.competitor_metrics) ? d.competitor_metrics : [d.competitor_metrics];
          cms.forEach((cm: any) => {
            if (cm) {
              const bc = Array.isArray(cm.brand_competitors) ? cm.brand_competitors[0] : cm.brand_competitors;
              if (bc && bc.competitor_name) {
                competitorMetricPairs.push({
                  metric_fact_id: d.id,
                  competitor_id: cm.competitor_id,
                  competitor_name: bc.competitor_name,
                });
              }
            }
          });
        });

        // Check which already have sentiment
        const metricFactIds = [...new Set(competitorMetricPairs.map(p => p.metric_fact_id))];
        const { data: existingSentiments } = await this.supabase
          .from('competitor_sentiment')
          .select('metric_fact_id, competitor_id')
          .in('metric_fact_id', metricFactIds);

        const existingSentimentKeys = new Set((existingSentiments || []).map(s => `${s.metric_fact_id}:${s.competitor_id}`));

        // Transform to match old format and filter out rows with existing sentiment
        positionRows = competitorMetricPairs
          .filter(p => !existingSentimentKeys.has(`${p.metric_fact_id}:${p.competitor_id}`))
          .map(p => {
            const metricFact = data.find(d => d.id === p.metric_fact_id);
            return {
              id: p.metric_fact_id,
              collector_result_id: metricFact?.collector_result_id,
              competitor_name: p.competitor_name,
              sentiment_score_competitor: null,
              sentiment_label_competitor: null,
              brand_id: metricFact?.brand_id,
              customer_id: metricFact?.customer_id,
              processed_at: metricFact?.processed_at,
            };
          });
      }
    } else {
      console.log('   📋 Using legacy competitor sentiment query (extracted_positions)');
      
      // LEGACY: Query extracted_positions
      let query = this.supabase
        .from('extracted_positions')
        .select('id, collector_result_id, competitor_name, sentiment_score_competitor, sentiment_label_competitor, brand_id, customer_id, processed_at')
        .is('sentiment_score_competitor', null)
        .not('competitor_name', 'is', null)
        .neq('competitor_name', '')
        .not('collector_result_id', 'is', null)
        .order('processed_at', { ascending: false })
        .limit(limit * 10);

      if (options.customerId) query = query.eq('customer_id', options.customerId);
      if (options.brandIds?.length) query = query.in('brand_id', options.brandIds);
      if (options.since) query = query.gte('processed_at', options.since);

      const { data, error: queryError } = await query;
      positionRows = data || [];
      error = queryError;
    }

    if (error) throw error;
    if (!positionRows || positionRows.length === 0) {
      console.log(`✅ No pending competitor sentiment rows found (${USE_OPTIMIZED_SENTIMENT_QUERY ? 'optimized' : 'legacy'})`);
      return 0;
    }

    console.log(`   📊 Found ${positionRows.length} competitor rows without sentiment (${USE_OPTIMIZED_SENTIMENT_QUERY ? 'optimized' : 'legacy'})`);

    const groupedByCollectorResult = new Map<number, Array<typeof positionRows[0]>>();
    for (const row of positionRows) {
      const crid = row.collector_result_id;
      if (!crid) continue;
      if (!groupedByCollectorResult.has(crid)) groupedByCollectorResult.set(crid, []);
      groupedByCollectorResult.get(crid)!.push(row);
    }

    let processed = 0;
    let failed = 0;
    let processedGroups = 0;
    const maxGroups = Math.min(limit, competitorGroupLimit);

    for (const [collectorResultId, rows] of Array.from(groupedByCollectorResult.entries()).slice(0, maxGroups)) {
      try {
        processedGroups++;
        const competitorNames = [...new Set(rows.map(r => r.competitor_name!).filter(Boolean))];
        console.log(`\n📊 Processing competitor group ${processedGroups}/${Math.min(groupedByCollectorResult.size, limit)}: collector_result_id=${collectorResultId} (${rows.length} rows, ${competitorNames.length} competitors)`);

        const { data: collectorResult, error: crError } = await this.supabase
          .from('collector_results')
          .select('id, raw_answer')
          .eq('id', collectorResultId)
          .single();
        if (crError || !collectorResult || !collectorResult.raw_answer) {
          console.warn(`⚠️ Skipping group ${collectorResultId}: no raw_answer`);
          for (const row of rows) {
            await this.updatePositionRowsSentiment([row.id], {
              entityName: row.competitor_name || '',
              label: 'NEUTRAL',
              score: 0,
              positiveSentences: [],
              negativeSentences: [],
            });
            processed++;
          }
          continue;
        }

        if (competitorNames.length === 0) {
          console.warn(`⚠️ Skipping group ${collectorResultId}: no competitors`);
          continue;
        }

        // Check if we have consolidated analysis result
        let sentimentMap: Map<string, CompetitorSentimentAnalysis>;
        
        if (USE_CONSOLIDATED_ANALYSIS) {
          try {
            // Try to get from cache (if position extraction already ran)
            const cached = (consolidatedAnalysisService as any).cache.get(collectorResultId);
            if (cached?.sentiment?.competitors) {
              // Build sentiment map from consolidated result
              sentimentMap = new Map();
              for (const compName of competitorNames) {
                const compSentiment = cached.sentiment.competitors[compName];
                if (compSentiment) {
                  sentimentMap.set(compName, {
                    entityName: compName,
                    label: compSentiment.label,
                    score: compSentiment.score,
                    positiveSentences: compSentiment.positiveSentences || [],
                    negativeSentences: compSentiment.negativeSentences || []
                  });
                } else {
                  // Default if competitor not in consolidated result
                  sentimentMap.set(compName, {
                    entityName: compName,
                    label: 'NEUTRAL',
                    score: 0,
                    positiveSentences: [],
                    negativeSentences: []
                  });
                }
              }
              console.log(`📦 Using consolidated competitor sentiment for collector_result ${collectorResultId}`);
            } else {
              // Fallback to individual analysis
              sentimentMap = await this.analyzeCompetitorSentimentWithOpenRouter(collectorResult.raw_answer, competitorNames);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to get consolidated sentiment, falling back:`, error instanceof Error ? error.message : error);
            sentimentMap = await this.analyzeCompetitorSentimentWithOpenRouter(collectorResult.raw_answer, competitorNames);
          }
        } else {
          sentimentMap = await this.analyzeCompetitorSentimentWithOpenRouter(collectorResult.raw_answer, competitorNames);
        }
        for (const row of rows) {
          const competitorName = row.competitor_name!;
          const sentiment = sentimentMap.get(competitorName) || {
            entityName: competitorName,
            label: 'NEUTRAL',
            score: 0,
            positiveSentences: [],
            negativeSentences: [],
          };
          await this.updatePositionRowsSentiment([row.id], sentiment);
          processed++;
          console.log(`   ✅ ${competitorName}: ${sentiment.label} (${sentiment.score.toFixed(2)})`);
        }

        if (processedGroups < maxGroups) {
          await this.sleep(sentimentDelayMs);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed += rows.length;
        console.error(`❌ Failed competitor sentiment scoring for collector_result_id=${collectorResultId}: ${message}`);
      }
    }

    console.log(`\n✅ Competitor sentiment scoring complete! Updated ${processed} rows from ${processedGroups} groups (${failed} failed)`);
    return processed;
  }

  private async analyzeCompetitorSentimentWithOpenRouter(
    text: string,
    competitorNames: string[],
  ): Promise<Map<string, CompetitorSentimentAnalysis>> {
    const maxWords = 8000;
    const truncated = this.truncateToWordLimit(text, maxWords);
    const competitorsList = competitorNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n');

    const prompt = `Analyze the sentiment for each of the following competitors mentioned in the text below.

Competitors to analyze:
${competitorsList}

For each competitor, provide:
1. Sentiment label: POSITIVE, NEGATIVE, or NEUTRAL
2. Sentiment score: A precise decimal number from -1.0 (very negative) to 1.0 (very positive)


Text to analyze:
${text}

Respond with ONLY valid JSON in this exact format:
{
  "competitors": [
    {
      "competitorName": "${competitorNames[0]}",
      "label": "POSITIVE|NEGATIVE|NEUTRAL",
      "score": -1.0 to 1.0 (precise decimal),
      
    }
  ]
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

    const models = ['openai/gpt-oss-120b:free', 'openai/gpt-5-nano'];
    let lastError: Error | null = null;
    let data: any = null;

    for (const model of models) {
      try {
        data = await callOpenRouter(model);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`⚠️ OpenRouter competitor sentiment attempt failed for model "${model}": ${lastError.message}`);
      }
    }

    if (!data && lastError) {
      throw new Error(`OpenRouter competitor sentiment failed after fallbacks: ${lastError.message}`);
    }

    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in OpenRouter response');
    const result = JSON.parse(jsonMatch[0]) as any;

    const sentimentMap = new Map<string, CompetitorSentimentAnalysis>();
    const competitors = Array.isArray(result.competitors) ? result.competitors : [];
    for (const competitor of competitors) {
      const competitorName = competitor.competitorName || '';
      if (!competitorName) continue;
      sentimentMap.set(competitorName, {
        entityName: competitorName,
        label: (competitor.label || 'NEUTRAL').toUpperCase(),
        score: Math.max(-1, Math.min(1, parseFloat(String(competitor.score)) || 0)),
        positiveSentences: Array.isArray(competitor.positiveSentences) ? competitor.positiveSentences : [],
        negativeSentences: Array.isArray(competitor.negativeSentences) ? competitor.negativeSentences : [],
      });
    }

    for (const name of competitorNames) {
      if (!sentimentMap.has(name)) {
        sentimentMap.set(name, { entityName: name, label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] });
      }
    }

    return sentimentMap;
  }

  private async updatePositionRowsSentiment(
    positionIds: number[],
    sentiment: CompetitorSentimentAnalysis,
  ): Promise<void> {
    if (positionIds.length === 0) return;
    const { error } = await this.supabase
      .from('extracted_positions')
      .update({
        sentiment_label_competitor: sentiment.label,
        sentiment_score_competitor: sentiment.score,
        sentiment_positive_sentences_competitor: sentiment.positiveSentences,
        sentiment_negative_sentences_competitor: sentiment.negativeSentences,
      })
      .in('id', positionIds);
    if (error) throw error;
  }

  private truncateToWordLimit(text: string, limit = 2000): string {
    const words = text.split(/\s+/);
    if (words.length <= limit) return text;
    return words.slice(0, limit).join(' ');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const competitorSentimentService = new CompetitorSentimentService();

