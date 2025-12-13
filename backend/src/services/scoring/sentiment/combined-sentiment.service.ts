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
const combinedGroupLimit = parseInt(process.env.COMBINED_SENTIMENT_GROUP_LIMIT || '20', 10);

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

export interface CompetitorSentimentAnalysis extends SentimentAnalysis {
  entityName: string;
}

export interface CombinedSentimentResult {
  brand: SentimentAnalysis;
  competitors: CompetitorSentimentAnalysis[];
}

export interface SentimentScoreOptions {
  customerId?: string;
  brandIds?: string[];
  since?: string;
  limit?: number;
}

const DEFAULT_SENTIMENT_LIMIT = 150;

export class CombinedSentimentService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  public async scoreCombinedSentiment(options: SentimentScoreOptions = {}): Promise<number> {
    const limit = Math.max(options.limit ?? DEFAULT_SENTIMENT_LIMIT, 1);

    console.log('\n🎯 Starting combined sentiment scoring (OpenRouter) ...');
    if (options.customerId) console.log(`   ▶ customer: ${options.customerId}`);
    if (options.brandIds?.length) console.log(`   ▶ brands: ${options.brandIds.join(', ')}`);
    if (options.since) console.log(`   ▶ since: ${options.since}`);
    console.log('   ▶ limit:', limit, '\n');

    let query = this.supabase
      .from('extracted_positions')
      .select('id, collector_result_id, brand_name, competitor_name, sentiment_score, sentiment_label, brand_id, customer_id, processed_at, total_brand_mentions')
      .is('sentiment_score', null)
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
      console.log('✅ No pending combined sentiment rows found in extracted_positions');
      return 0;
    }

    // Group by collector_result_id to get all entities (brand + competitors) for each result
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
    const maxGroups = Math.min(limit, combinedGroupLimit);

    for (const [collectorResultId, rows] of Array.from(groupedByCollectorResult.entries()).slice(0, maxGroups)) {
      try {
        processedGroups++;
        const brandName = rows[0]?.brand_name || 'Brand';
        const competitorNames = [...new Set(rows.map(r => r.competitor_name).filter(Boolean))];

        console.log(`\n📊 Processing combined group ${processedGroups}/${Math.min(groupedByCollectorResult.size, limit)}: collector_result_id=${collectorResultId} (${rows.length} rows, brand: ${brandName}, competitors: ${competitorNames.length})`);

        const { data: collectorResult, error: crError } = await this.supabase
          .from('collector_results')
          .select('id, raw_answer')
          .eq('id', collectorResultId)
          .single();
        if (crError || !collectorResult || !collectorResult.raw_answer) {
          console.warn(`⚠️ Skipping group ${collectorResultId}: no raw_answer`);
          for (const row of rows) {
            const neutralSentiment = {
              label: 'NEUTRAL' as const,
              score: 60, // Neutral score in 1-100 scale
              positiveSentences: [] as string[],
              negativeSentences: [] as string[],
            };
            if (row.competitor_name) {
              await this.updateCompetitorPositionRowsSentiment([row.id], { ...neutralSentiment, entityName: row.competitor_name });
            } else {
              await this.updateBrandPositionRowsSentiment([row.id], neutralSentiment);
            }
            processed++;
          }
          continue;
        }

        // Check if we have consolidated analysis result
        let combinedSentiment;
        if (USE_CONSOLIDATED_ANALYSIS) {
          try {
            // Try to get from cache (if position extraction already ran)
            const cached = (consolidatedAnalysisService as any).cache.get(collectorResultId);
            if (cached?.sentiment) {
              // Build combined sentiment from consolidated result
              // Scores are already in 1-100 scale from consolidated service
              const brandScore = cached.sentiment.brand?.score 
                ? this.normalizeScoreTo100Scale(cached.sentiment.brand.score) // Still normalize in case it's old format
                : 60;
              const brandSentiment = cached.sentiment.brand ? {
                label: cached.sentiment.brand.label,
                score: brandScore,
                positiveSentences: cached.sentiment.brand.positiveSentences || [], // Handle both old and new format
                negativeSentences: cached.sentiment.brand.negativeSentences || []
              } : {
                label: 'NEUTRAL',
                score: 60, // Neutral score in 1-100 scale
                positiveSentences: [],
                negativeSentences: []
              };

              const competitorSentiments = competitorNames.map(compName => {
                const compSentiment = cached.sentiment.competitors?.[compName];
                if (compSentiment) {
                  const compScore = this.normalizeScoreTo100Scale(compSentiment.score);
                  return {
                    entityName: compName,
                    label: compSentiment.label,
                    score: compScore,
                    positiveSentences: compSentiment.positiveSentences || [], // Handle both old and new format
                    negativeSentences: compSentiment.negativeSentences || []
                  };
                } else {
                  return {
                    entityName: compName,
                    label: 'NEUTRAL',
                    score: 60, // Neutral score in 1-100 scale
                    positiveSentences: [],
                    negativeSentences: []
                  };
                }
              });

              combinedSentiment = {
                brand: brandSentiment,
                competitors: competitorSentiments
              };
              console.log(`📦 Using consolidated combined sentiment for collector_result ${collectorResultId}`);
            } else {
              // Fallback to individual analysis
              combinedSentiment = await this.analyzeCombinedSentimentWithOpenRouter(
                collectorResult.raw_answer,
                brandName,
                competitorNames
              );
            }
          } catch (error) {
            console.warn(`⚠️ Failed to get consolidated sentiment, falling back:`, error instanceof Error ? error.message : error);
            combinedSentiment = await this.analyzeCombinedSentimentWithOpenRouter(
              collectorResult.raw_answer,
              brandName,
              competitorNames
            );
          }
        } else {
          combinedSentiment = await this.analyzeCombinedSentimentWithOpenRouter(
            collectorResult.raw_answer,
            brandName,
            competitorNames
          );
        }

        // Log parsed sentiment for debugging
        console.log(`   📝 Parsed brand sentiment: ${combinedSentiment.brand.label} (${Math.round(combinedSentiment.brand.score)}/100)`);
        console.log(`   📝 Parsed ${combinedSentiment.competitors.length} competitor sentiments`);

        // Update all position rows with their respective sentiments
        for (const row of rows) {
          if (row.competitor_name && row.competitor_name.trim().length > 0) {
            // Find the competitor sentiment - use case-insensitive matching
            const competitorSentiment = combinedSentiment.competitors.find(
              c => c.entityName === row.competitor_name || 
                   c.entityName.toLowerCase() === row.competitor_name.toLowerCase() ||
                   c.entityName.trim() === row.competitor_name.trim()
            );
            
            if (competitorSentiment) {
              await this.updateCompetitorPositionRowsSentiment([row.id], competitorSentiment);
              console.log(`   ✅ Competitor ${row.competitor_name}: ${competitorSentiment.label} (${Math.round(competitorSentiment.score)}/100) | Positive: ${competitorSentiment.positiveSentences.length}, Negative: ${competitorSentiment.negativeSentences.length}`);
            } else {
              // Fallback to neutral if not found
              const neutralSentiment = {
                entityName: row.competitor_name,
                label: 'NEUTRAL' as const,
                score: 60,
                positiveSentences: [] as string[],
                negativeSentences: [] as string[]
              };
              await this.updateCompetitorPositionRowsSentiment([row.id], neutralSentiment);
              console.log(`   ⚠️ Competitor ${row.competitor_name} not found in parsed results, using NEUTRAL (60/100)`);
            }
          } else {
            // Update brand sentiment for rows without competitor_name
            await this.updateBrandPositionRowsSentiment([row.id], combinedSentiment.brand);
            console.log(`   ✅ Brand ${brandName}: ${combinedSentiment.brand.label} (${Math.round(combinedSentiment.brand.score)}/100) | Positive: ${combinedSentiment.brand.positiveSentences.length}, Negative: ${combinedSentiment.brand.negativeSentences.length}`);
          }
          processed++;
        }

        if (processedGroups < maxGroups) {
          await this.sleep(sentimentDelayMs);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed += rows.length;
        console.error(`❌ Failed combined sentiment scoring for collector_result_id=${collectorResultId}: ${message}`);
      }
    }

    console.log(`\n✅ Combined sentiment scoring complete! Updated ${processed} rows from ${processedGroups} groups (${failed} failed)`);
    return processed;
  }

  /**
   * Determine sentiment label based on score (1-100 scale)
   * 1-55: NEGATIVE
   * 55-65: NEUTRAL
   * 65-100: POSITIVE
   */
  private getSentimentLabelFromScore(score: number): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    if (score >= 65) return 'POSITIVE';
    if (score >= 55) return 'NEUTRAL';
    return 'NEGATIVE';
  }

  /**
   * Convert score to 1-100 scale if it's in -1 to 1 scale
   * If already in 1-100 scale, return as-is
   */
  private normalizeScoreTo100Scale(score: number): number {
    // If score is between -1 and 1, convert to 1-100 scale
    if (score >= -1 && score <= 1 && score !== 0) {
      // Convert -1 to 1 scale to 1-100 scale
      // -1 -> 1, 0 -> 60, 1 -> 100
      return Math.round(((score + 1) / 2) * 99) + 1;
    }
    // If score is already in 1-100 range or outside both ranges, clamp to 1-100
    return Math.max(1, Math.min(100, score));
  }

  private async analyzeCombinedSentimentWithOpenRouter(
    text: string,
    brandName: string,
    competitorNames: string[],
  ): Promise<CombinedSentimentResult> {
    const maxWords = 8000;
    const truncated = this.truncateToWordLimit(text, maxWords);
    const competitorsList = competitorNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n');

    const prompt = `Analyze the sentiment for the brand "${brandName}" and each of the following competitors mentioned in the text below.

Brand: ${brandName}

Competitors to analyze:
${competitorsList}

For the brand and each competitor, provide:
1. Sentiment score: An integer from 1 to 100, where:
   - 1-55: Bad/negative sentiment
   - 55-65: Neutral sentiment
   - 65-100: Positive/good sentiment
2. Sentiment label: POSITIVE, NEGATIVE, or NEUTRAL (determined by the score range above)
3. List of positive sentences (sentences with positive sentiment)
4. List of negative sentences (sentences with negative sentiment)

Text to analyze:
${text}

Respond with ONLY valid JSON in this exact format:
{
  "brand": {
    "label": "POSITIVE|NEGATIVE|NEUTRAL",
    "score": 1 to 100,
    "positiveSentences": ["sentence 1", "sentence 2"],
    "negativeSentences": ["sentence 1", "sentence 2"]
  },
  "competitors": [
    {
      "entityName": "${competitorNames[0]}",
      "label": "POSITIVE|NEGATIVE|NEUTRAL",
      "score": 1 to 100,
      "positiveSentences": ["sentence 1", "sentence 2"],
      "negativeSentences": ["sentence 1", "sentence 2"]
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

    const models = ['openai/gpt-oss-20b', 'openai/gpt-5-nano'];
    let lastError: Error | null = null;
    let data: any = null;

    for (const model of models) {
      try {
        data = await callOpenRouter(model);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`⚠️ OpenRouter combined sentiment attempt failed for model "${model}": ${lastError.message}`);
      }
    }

    if (!data && lastError) {
      throw new Error(`OpenRouter combined sentiment failed after fallbacks: ${lastError.message}`);
    }

    const content = data.choices?.[0]?.message?.content || '';
    
    if (!content || content.trim().length === 0) {
      throw new Error('Empty content in OpenRouter response');
    }

    // Be tolerant of wrappers (e.g., Markdown fences or prose around JSON) - same approach as brand-sentiment service
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

    // Validate that we have at least a brand object
    if (!result.brand) {
      console.warn('⚠️ No brand object found in response, using neutral sentiment for brand');
      result.brand = { label: 'NEUTRAL', score: 60, positiveSentences: [], negativeSentences: [] };
    }

    // Parse brand sentiment with validation (1-100 scale)
    const rawBrandScore = parseFloat(String(result.brand?.score || 60));
    const brandScore = Math.max(1, Math.min(100, isNaN(rawBrandScore) ? 60 : rawBrandScore));
    const brandLabelFromScore = this.getSentimentLabelFromScore(brandScore);
    const brandLabelFromApi = (result.brand?.label || '').toUpperCase().trim();
    
    // Use label from score if API label is invalid or doesn't match score range
    let brandLabel = brandLabelFromScore;
    if (['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(brandLabelFromApi)) {
      // If API label matches the score-determined label, use it; otherwise prefer score-based label
      const apiLabelMatchesScore = 
        (brandLabelFromApi === 'POSITIVE' && brandScore >= 65) ||
        (brandLabelFromApi === 'NEGATIVE' && brandScore < 55) ||
        (brandLabelFromApi === 'NEUTRAL' && brandScore >= 55 && brandScore < 65);
      
      if (apiLabelMatchesScore) {
        brandLabel = brandLabelFromApi;
      } else {
        console.warn(`⚠️ Brand label "${brandLabelFromApi}" doesn't match score ${brandScore}, using score-based label "${brandLabelFromScore}"`);
      }
    }

    const brandSentiment = {
      label: brandLabel,
      score: brandScore,
      positiveSentences: Array.isArray(result.brand?.positiveSentences) 
        ? result.brand.positiveSentences.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        : [],
      negativeSentences: Array.isArray(result.brand?.negativeSentences)
        ? result.brand.negativeSentences.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        : [],
    };

    // Parse competitor sentiments with robust matching (1-100 scale)
    // Handle both entityName and competitorName field names (for flexibility)
    const competitorsArray = Array.isArray(result.competitors) ? result.competitors : [];
    const competitorResults = competitorNames.map(compName => {
      // Try to find competitor by exact match, case-insensitive match, or trimmed match
      const found = competitorsArray.find((c: any) => {
        const entityName = (c.entityName || c.competitorName || '').trim();
        return entityName === compName || 
               entityName.toLowerCase() === compName.toLowerCase() ||
               entityName === compName.trim();
      });

      if (found) {
        // Parse competitor score (1-100 scale)
        const rawCompScore = parseFloat(String(found.score || 60));
        const compScore = Math.max(1, Math.min(100, isNaN(rawCompScore) ? 60 : rawCompScore));
        const compLabelFromScore = this.getSentimentLabelFromScore(compScore);
        const compLabelFromApi = (found.label || '').toUpperCase().trim();
        
        // Use label from score if API label is invalid or doesn't match score range
        let compLabel = compLabelFromScore;
        if (['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(compLabelFromApi)) {
          // If API label matches the score-determined label, use it; otherwise prefer score-based label
          const apiLabelMatchesScore = 
            (compLabelFromApi === 'POSITIVE' && compScore >= 65) ||
            (compLabelFromApi === 'NEGATIVE' && compScore < 55) ||
            (compLabelFromApi === 'NEUTRAL' && compScore >= 55 && compScore < 65);
          
          if (apiLabelMatchesScore) {
            compLabel = compLabelFromApi;
          } else {
            console.warn(`⚠️ Competitor "${compName}" label "${compLabelFromApi}" doesn't match score ${compScore}, using score-based label "${compLabelFromScore}"`);
          }
        }

        return {
          entityName: compName, // Use the original name we searched for
          label: compLabel,
          score: compScore,
          positiveSentences: Array.isArray(found.positiveSentences)
            ? found.positiveSentences.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
            : [],
          negativeSentences: Array.isArray(found.negativeSentences)
            ? found.negativeSentences.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
            : [],
        };
      } else {
        // Competitor not found in analysis, return neutral
        console.warn(`⚠️ Competitor "${compName}" not found in API response, using neutral sentiment`);
        return {
          entityName: compName,
          label: 'NEUTRAL',
          score: 60, // Neutral score in 1-100 scale
          positiveSentences: [],
          negativeSentences: [],
        };
      }
    });

    return {
      brand: brandSentiment,
      competitors: competitorResults,
    };
  }

  private async updateBrandPositionRowsSentiment(
    positionIds: number[],
    sentiment: SentimentAnalysis,
  ): Promise<void> {
    if (positionIds.length === 0) return;
    
    // Validate sentiment data before updating (1-100 scale)
    const validLabel = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(sentiment.label) 
      ? sentiment.label 
      : 'NEUTRAL';
    // Clamp score to 1-100 range
    const validScore = Math.max(1, Math.min(100, isNaN(sentiment.score) ? 60 : sentiment.score));
    const validPositiveSentences = Array.isArray(sentiment.positiveSentences) 
      ? sentiment.positiveSentences.filter(s => typeof s === 'string')
      : [];
    const validNegativeSentences = Array.isArray(sentiment.negativeSentences)
      ? sentiment.negativeSentences.filter(s => typeof s === 'string')
      : [];

    const { error } = await this.supabase
      .from('extracted_positions')
      .update({
        sentiment_label: validLabel,
        sentiment_score: validScore,
        sentiment_positive_sentences: validPositiveSentences,
        sentiment_negative_sentences: validNegativeSentences,
      })
      .in('id', positionIds);
      
    if (error) {
      console.error(`❌ Failed to update brand sentiment for positions [${positionIds.join(', ')}]:`, error);
      throw error;
    }
  }

  private async updateCompetitorPositionRowsSentiment(
    positionIds: number[],
    sentiment: CompetitorSentimentAnalysis,
  ): Promise<void> {
    if (positionIds.length === 0) return;
    
    // Validate sentiment data before updating (1-100 scale)
    const validLabel = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(sentiment.label)
      ? sentiment.label
      : 'NEUTRAL';
    // Clamp score to 1-100 range
    const validScore = Math.max(1, Math.min(100, isNaN(sentiment.score) ? 60 : sentiment.score));
    const validPositiveSentences = Array.isArray(sentiment.positiveSentences)
      ? sentiment.positiveSentences.filter(s => typeof s === 'string')
      : [];
    const validNegativeSentences = Array.isArray(sentiment.negativeSentences)
      ? sentiment.negativeSentences.filter(s => typeof s === 'string')
      : [];

    const { error } = await this.supabase
      .from('extracted_positions')
      .update({
        sentiment_label_competitor: validLabel,
        sentiment_score_competitor: validScore,
        sentiment_positive_sentences_competitor: validPositiveSentences,
        sentiment_negative_sentences_competitor: validNegativeSentences,
      })
      .in('id', positionIds);
      
    if (error) {
      console.error(`❌ Failed to update competitor sentiment for positions [${positionIds.join(', ')}]:`, error);
      throw error;
    }
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

export const combinedSentimentService = new CombinedSentimentService();
