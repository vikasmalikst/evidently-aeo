/**
 * Consolidated Scoring Service
 * 
 * Uses consolidated analysis service to perform all scoring operations in a single API call:
 * - Product extraction (brand + competitors)
 * - Citation categorization
 * - Sentiment analysis (brand + competitors)
 * 
 * Then stores all results in the appropriate database tables.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { consolidatedAnalysisService, ConsolidatedAnalysisOptions } from './consolidated-analysis.service';
import { positionExtractionService } from './position-extraction.service';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials');
}

interface ConsolidatedScoringOptions {
  brandId: string;
  customerId: string;
  since?: string;
  limit?: number;
}

interface ConsolidatedScoringResult {
  processed: number;
  positionsProcessed: number;
  sentimentsProcessed: number;
  citationsProcessed: number;
  errors: Array<{ collectorResultId: number; error: string }>;
}

export class ConsolidatedScoringService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  /**
   * Score brand using consolidated analysis
   */
  async scoreBrand(options: ConsolidatedScoringOptions): Promise<ConsolidatedScoringResult> {
    const { brandId, customerId, since, limit = 50 } = options;

    console.log(`\n🎯 Starting consolidated scoring for brand ${brandId}...`);
    if (since) console.log(`   ▶ since: ${since}`);
    console.log(`   ▶ limit: ${limit}\n`);

    const result: ConsolidatedScoringResult = {
      processed: 0,
      positionsProcessed: 0,
      sentimentsProcessed: 0,
      citationsProcessed: 0,
      errors: [],
    };

    // Fetch collector results that need processing
    let query = this.supabase
      .from('collector_results')
      .select('id, customer_id, brand_id, query_id, question, execution_id, collector_type, raw_answer, brand, competitors, created_at, metadata, citations, urls, topic')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .not('raw_answer', 'is', null) // Only process results with raw_answer
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: collectorResults, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch collector results: ${fetchError.message}`);
    }

    if (!collectorResults || !Array.isArray(collectorResults) || collectorResults.length === 0) {
      console.log('✅ No collector results found to process');
      return result;
    }

    // Check which results already have positions (to avoid reprocessing)
    const processedCollectorResults = new Set<number>();
    for (const cr of collectorResults) {
      if (!cr || !cr.id) {
        continue;
      }
      
      const { data: existing } = await this.supabase
        .from('extracted_positions')
        .select('id')
        .eq('collector_result_id', cr.id)
        .limit(1)
        .maybeSingle();

      if (existing) {
        processedCollectorResults.add(cr.id);
      }
    }

    const resultsToProcess = collectorResults.filter(r => r && r.id && !processedCollectorResults.has(r.id) && r.raw_answer);

    if (resultsToProcess.length === 0) {
      console.log('✅ All collector results already processed');
      return result;
    }

    console.log(`📊 Processing ${resultsToProcess.length} collector results...\n`);

    // Step 1: Run consolidated analysis for all results (stores citations, caches products & sentiment)
    const analysisResults = new Map<number, any>();
    for (const collectorResult of resultsToProcess) {
      if (!collectorResult || !collectorResult.id) {
        continue;
      }
      
      try {
        // Validate required fields
        if (!collectorResult.raw_answer || collectorResult.raw_answer.trim().length === 0) {
          console.warn(`⚠️ Skipping collector_result ${collectorResult.id}: no raw_answer`);
          continue;
        }

        const analysis = await this.runConsolidatedAnalysis(collectorResult, brandId, customerId);
        if (analysis) {
          analysisResults.set(collectorResult.id, analysis);
          result.processed++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({
          collectorResultId: collectorResult.id,
          error: errorMsg,
        });
        console.error(`❌ Failed consolidated analysis for collector_result ${collectorResult.id}:`, errorMsg);
      }
    }

    // Step 2: Run position extraction (uses cached products from consolidated analysis)
    // This calculates character positions and stores them in extracted_positions
    try {
      const { positionExtractionService } = await import('./position-extraction.service');
      const positionsCount = await positionExtractionService.extractPositionsForNewResults({
        customerId,
        brandIds: [brandId],
        since,
        limit: limit,
      });
      result.positionsProcessed = positionsCount;
      console.log(`   ✅ Position extraction complete: ${positionsCount} results processed`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({
        collectorResultId: 0,
        error: `Position extraction failed: ${errorMsg}`,
      });
      console.error(`❌ Position extraction failed:`, errorMsg);
    }

    // Step 3: Store sentiment in extracted_positions (now that positions exist)
    for (const collectorResult of resultsToProcess) {
      if (!collectorResult || !collectorResult.id) {
        continue;
      }
      
      const analysis = analysisResults.get(collectorResult.id);
      if (analysis && analysis.sentiment) {
        try {
          // Get competitor names from the analysis
          const competitorNames = analysis.sentiment.competitors 
            ? Object.keys(analysis.sentiment.competitors) 
            : [];
          await this.storeSentiment(collectorResult, analysis, competitorNames);
          result.sentimentsProcessed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️ Failed to store sentiment for collector_result ${collectorResult.id}:`, errorMsg);
        }
      }
    }

    // Citations are already stored in runConsolidatedAnalysis
    result.citationsProcessed = result.processed;

    console.log(`\n✅ Consolidated scoring complete!`);
    console.log(`   Processed: ${result.processed}`);
    console.log(`   Errors: ${result.errors.length}`);

    return result;
  }

  /**
   * Run consolidated analysis and store citations
   * Returns the analysis result for later use
   */
  private async runConsolidatedAnalysis(
    collectorResult: any,
    brandId: string,
    customerId: string
  ): Promise<any> {
    const collectorResultId = collectorResult.id;

    console.log(`\n📊 Processing collector_result ${collectorResultId}...`);

    // Get brand metadata
    const { data: brand, error: brandError } = await this.supabase
      .from('brands')
      .select('id, name, metadata')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      throw new Error(`Brand not found: ${brandId} - ${brandError?.message || 'Unknown error'}`);
    }

    // Ensure brand name exists
    if (!brand.name) {
      throw new Error(`Brand name is missing for brand ${brandId}`);
    }

    // Get competitor metadata
    const { data: competitorRows } = await this.supabase
      .from('brand_competitors')
      .select('competitor_name, metadata')
      .eq('brand_id', brandId);

    const competitorMetadataMap = new Map<string, any>();
    (competitorRows || []).forEach((row) => {
      competitorMetadataMap.set(row.competitor_name.toLowerCase(), row.metadata);
    });

    // Normalize competitors - ensure it's an array
    const competitors = Array.isArray(collectorResult.competitors) ? collectorResult.competitors : [];
    const normalizedCompetitors = competitors.map((comp: any) =>
      typeof comp === 'string' ? { competitor_name: comp } : comp
    );
    const competitorNames = normalizedCompetitors
      .map((c: any) => c && c.competitor_name ? c.competitor_name : null)
      .filter((name): name is string => Boolean(name));

    // Extract citations - ensure we always have an array
    let citations: string[] = [];
    if (collectorResult.citations) {
      if (Array.isArray(collectorResult.citations)) {
        citations = collectorResult.citations
          .map((c: any) => (typeof c === 'string' ? c : c.url || c))
          .filter((url: any): url is string => typeof url === 'string' && url.startsWith('http'));
      }
    }
    if (citations.length === 0 && collectorResult.urls) {
      if (Array.isArray(collectorResult.urls)) {
        citations = collectorResult.urls.filter((url: any): url is string =>
          typeof url === 'string' && url.startsWith('http')
        );
      }
    }

    // Ensure raw_answer is not null
    const rawAnswer = collectorResult.raw_answer || '';
    
    if (!rawAnswer || rawAnswer.trim().length === 0) {
      throw new Error(`Collector result ${collectorResultId} has no raw_answer`);
    }

    // Call consolidated analysis
    const analysis = await consolidatedAnalysisService.analyze({
      brandName: brand.name || 'Brand',
      brandMetadata: { ...(brand.metadata || {}), customer_id: customerId, brand_id: brandId },
      competitorNames: competitorNames || [],
      competitorMetadata: competitorMetadataMap,
      rawAnswer: rawAnswer,
      citations: citations || [],
      collectorResultId,
      customerId,
      brandId,
    });

    console.log(`   ✅ Consolidated analysis complete`);
    console.log(`      Products: ${(analysis.products?.brand?.length || 0)} brand, ${Object.keys(analysis.products?.competitors || {}).length} competitors`);
    console.log(`      Citations: ${Object.keys(analysis.citations || {}).length}`);
    console.log(`      Sentiment: Brand ${analysis.sentiment?.brand?.label || 'NEUTRAL'} (${analysis.sentiment?.brand?.score || 60})`);

    // Store citations with categories
    await this.storeCitations(collectorResult, analysis, brandId, customerId);

    console.log(`   ✅ Citations stored for collector_result ${collectorResultId}`);

    // Return analysis for later use (sentiment storage after positions are extracted)
    return analysis;
  }


  /**
   * Store sentiment in extracted_positions table
   */
  private async storeSentiment(
    collectorResult: any,
    analysis: any,
    competitorNames: string[]
  ): Promise<void> {
    // Validate analysis has sentiment data
    if (!analysis || !analysis.sentiment) {
      console.warn(`   ⚠️ No sentiment data in analysis for collector_result ${collectorResult.id}`);
      return;
    }

    // Get all position rows for this collector result
    const { data: positionRows, error } = await this.supabase
      .from('extracted_positions')
      .select('id, competitor_name')
      .eq('collector_result_id', collectorResult.id);

    if (error) {
      throw new Error(`Failed to fetch position rows: ${error.message}`);
    }

    if (!positionRows || positionRows.length === 0) {
      console.log(`   ⚠️ No position rows found for collector_result ${collectorResult.id}, skipping sentiment update`);
      return;
    }

    // Update brand sentiment (rows without competitor_name)
    if (analysis.sentiment.brand) {
      const brandRows = positionRows.filter(row => !row.competitor_name || row.competitor_name.trim() === '');
      if (brandRows.length > 0) {
        const brandIds = brandRows.map(r => r.id);
        const { error: updateError } = await this.supabase
          .from('extracted_positions')
          .update({
            sentiment_label: analysis.sentiment.brand.label || 'NEUTRAL',
            sentiment_score: analysis.sentiment.brand.score || 60,
          })
          .in('id', brandIds);

        if (updateError) {
          throw new Error(`Failed to update brand sentiment: ${updateError.message}`);
        }
        console.log(`   ✅ Updated brand sentiment for ${brandIds.length} rows`);
      }
    }

    // Update competitor sentiment
    if (analysis.sentiment.competitors && competitorNames && competitorNames.length > 0) {
      for (const compName of competitorNames) {
        const compRows = positionRows.filter(
          row => row.competitor_name && row.competitor_name.toLowerCase() === compName.toLowerCase()
        );

        if (compRows.length > 0 && analysis.sentiment.competitors[compName]) {
          const compSentiment = analysis.sentiment.competitors[compName];
          const compIds = compRows.map(r => r.id);
          const { error: updateError } = await this.supabase
            .from('extracted_positions')
            .update({
              sentiment_label_competitor: compSentiment.label || 'NEUTRAL',
              sentiment_score_competitor: compSentiment.score || 60,
            })
            .in('id', compIds);

          if (updateError) {
            console.warn(`   ⚠️ Failed to update competitor sentiment for ${compName}: ${updateError.message}`);
          } else {
            console.log(`   ✅ Updated competitor sentiment for ${compName} (${compIds.length} rows)`);
          }
        }
      }
    }
  }

  /**
   * Store citations with categories
   */
  private async storeCitations(
    collectorResult: any,
    analysis: any,
    brandId: string,
    customerId: string
  ): Promise<void> {
    // Ensure citations object exists
    if (!analysis.citations || typeof analysis.citations !== 'object') {
      console.log(`   ⚠️ No citations to store for collector_result ${collectorResult.id}`);
      return;
    }

    const citationsToInsert = Object.entries(analysis.citations)
      .filter(([url, cat]: [string, any]) => {
        // Filter out invalid entries
        return url && typeof url === 'string' && cat && cat.category;
      })
      .map(([url, cat]: [string, any]) => {
        // Extract domain from URL
        let domain = '';
        try {
          const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
          domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
        } catch {
          const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
          domain = match ? match[1].toLowerCase() : url.toLowerCase();
        }

        return {
          customer_id: customerId,
          brand_id: brandId,
          query_id: collectorResult.query_id,
          execution_id: collectorResult.execution_id,
          collector_result_id: collectorResult.id,
          url: url,
          domain: domain,
          page_name: cat.pageName || null,
          category: cat.category,
          metadata: {
            categorization_source: 'consolidated_analysis',
          },
        };
      });

    if (citationsToInsert.length === 0) {
      return;
    }

    // Upsert citations
    const { error: insertError } = await this.supabase
      .from('citations')
      .upsert(citationsToInsert, {
        onConflict: 'collector_result_id,url',
        ignoreDuplicates: false,
      });

    if (insertError) {
      throw new Error(`Failed to insert citations: ${insertError.message}`);
    }

    console.log(`   ✅ Stored ${citationsToInsert.length} citations`);
  }
}

export const consolidatedScoringService = new ConsolidatedScoringService();
