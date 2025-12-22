/**
 * Position Extraction Service
 * 
 * Extracts brand and competitor mention positions from raw collector answers.
 * Uses LLM (Cerebras primary, Gemini fallback) to identify where brands/products
 * and competitors are mentioned in the text.
 * 
 * This service is separate from scoring logic to keep concerns isolated.
 */

import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { consolidatedAnalysisService, ConsolidatedAnalysisOptions } from './consolidated-analysis.service';

// Load environment variables
dotenv.config();

// Feature flag: Use consolidated analysis service
const USE_CONSOLIDATED_ANALYSIS = process.env.USE_CONSOLIDATED_ANALYSIS === 'true';

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

const CollectorResultRow = z.object({
  id: z.number(),
  customer_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  query_id: z.string().uuid(),
  question: z.string(),
  execution_id: z.string().uuid().nullable(),
  collector_type: z.string(),
  raw_answer: z.string(),
  brand: z.string(),
  // Handle both formats: ["Nike", "Adidas"] OR [{competitor_name: "Nike"}]
  competitors: z.union([
    z.array(z.string()), // Format 1: ["Nike", "Adidas"]
    z.array(z.object({ competitor_name: z.string() })), // Format 2: [{competitor_name: "Nike"}]
  ]),
  created_at: z.string(),
  topic: z.string().nullable().optional(), // Topic column
  metadata: z.any().optional(),
  citations: z.any().optional(), // Citations array (can be string[] or object[])
  urls: z.any().optional(), // URLs array (can be string[] or object[])
});

const BrandRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  metadata: z.any().optional(),
});

interface PositionInsertRow {
  customer_id: string | null;
  brand_id: string;
  query_id: string;
  collector_type: string;
  collector_result_id: number;
  brand_name: string;
  competitor_name: string | null;
  raw_answer: string;
  brand_first_position: number | null;
  brand_positions: number[];
  competitor_positions: number[];
  total_brand_mentions: number;
  competitor_mentions: number;
  total_word_count: number;
  visibility_index: number | null;
  visibility_index_competitor: number | null;
  share_of_answers_brand: number | null;
  share_of_answers_competitor: number | null;
  total_brand_product_mentions: number;
  total_competitor_product_mentions: number;
  has_brand_presence: boolean;
  processed_at: string;
  topic?: string | null; // Topic column
  metadata?: Record<string, any> | null;
}

interface PositionExtractionPayload {
  brandRow: PositionInsertRow;
  competitorRows: PositionInsertRow[];
  productNames?: string[]; // Product names extracted during processing
}

export interface ExtractPositionsOptions {
  customerId?: string;
  brandIds?: string[];
  since?: string;
  limit?: number;
  /**
   * Optional: Specific collector_result IDs to process
   * If provided, only these IDs will be processed (ignores other filters)
   * This ensures position extraction processes the same results that were analyzed
   */
  collectorResultIds?: number[];
}

const DEFAULT_POSITION_LIMIT = 500;

// ============================================================================
// POSITION EXTRACTION SERVICE
// ============================================================================

export class PositionExtractionService {
  private supabase: SupabaseClient;
  private cerebrasApiKey: string | null;
  private geminiApiKey: string | null;
  private geminiModel: string;
  
  // Cache for product names (avoid re-extracting for same brand)
  private productCache = new Map<string, string[]>();
  private totalPromptTokens = 0;
  private totalCompletionTokens = 0;
  private totalTokenCalls = 0;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });

    // Position Extraction uses CEREBRAS_API_KEY_1 (fallback: CEREBRAS_API_KEY)
    const { getPositionExtractionKey, getGeminiKey, getGeminiModel } = require('../../utils/api-key-resolver');
    this.cerebrasApiKey = getPositionExtractionKey();
    this.geminiApiKey = getGeminiKey();
    this.geminiModel = getGeminiModel('gemini-1.5-flash-002');

    if (!this.cerebrasApiKey && !this.geminiApiKey) {
      throw new Error('At least one LLM API key (Cerebras or Gemini) is required');
    }
  }

  public async extractPositionsForNewResults(
    options: ExtractPositionsOptions = {}
  ): Promise<number> {
    const limit = Math.max(options.limit ?? DEFAULT_POSITION_LIMIT, 1);
    const fetchLimit = Math.max(limit * 2, limit);
    
    let allResults: any[] = [];

    // If specific collector_result IDs are provided, fetch only those
    // This ensures we process the same results that were analyzed in consolidated analysis
    if (options.collectorResultIds && options.collectorResultIds.length > 0) {
      console.log(`   📌 [Position Extraction] Processing specific collector_result IDs: ${options.collectorResultIds.length} results`);
      console.log(`   📋 [Position Extraction] IDs: ${options.collectorResultIds.slice(0, 10).join(', ')}${options.collectorResultIds.length > 10 ? '...' : ''}`);
      
      const { data: fetchedResults, error: fetchError } = await this.supabase
        .from('collector_results')
        .select('id, customer_id, brand_id, query_id, question, execution_id, collector_type, raw_answer, brand, competitors, created_at, metadata')
        .in('id', options.collectorResultIds);

      if (fetchError) {
        console.error(`   ❌ [Position Extraction] Error fetching collector results:`, fetchError.message);
        throw fetchError;
      }
      
      if (!fetchedResults || fetchedResults.length === 0) {
        console.log(`   ⚠️ [Position Extraction] No collector results found for provided IDs`);
        return 0;
      }

      console.log(`   ✅ [Position Extraction] Fetched ${fetchedResults.length} collector results from database`);
      allResults = fetchedResults;
    } else {
      // Original behavior: fetch collector results based on filters
      let query = this.supabase
        .from('collector_results')
        .select('id, customer_id, brand_id, query_id, question, execution_id, collector_type, raw_answer, brand, competitors, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(fetchLimit);

      if (options.customerId) {
        query = query.eq('customer_id', options.customerId);
      }
      if (options.brandIds && options.brandIds.length > 0) {
        query = query.in('brand_id', options.brandIds);
      }
      if (options.since) {
        query = query.gte('created_at', options.since);
      }

      const { data: fetchedResults, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      if (!fetchedResults || fetchedResults.length === 0) {
        return 0;
      }

      allResults = fetchedResults;
    }

    // Check which results already have positions in the positions table
    console.log(`   🔍 [Position Extraction] Checking which results already have positions...`);
    const processedCollectorResults = new Set<number>();

    for (const result of allResults) {
      const { data: existing, error: checkError } = await this.supabase
        .from('extracted_positions')
        .select('id')
        .eq('collector_result_id', result.id)
        .limit(1)
        .maybeSingle();
      
      if (checkError) {
        console.error(`   ❌ [Position Extraction] Error checking existing positions for collector_result ${result.id}:`, checkError.message);
      }
      
      if (existing) {
        processedCollectorResults.add(result.id);
        console.log(`   ℹ️ [Position Extraction] Collector_result ${result.id} already has positions, will skip`);
      }
    }

    console.log(`   📊 [Position Extraction] Found ${processedCollectorResults.size} results that already have positions`);

    // Filter to only new results (skip if specific IDs were provided - process all of them)
    const results = options.collectorResultIds && options.collectorResultIds.length > 0
      ? allResults.filter(r => r && r.raw_answer) // Only filter by raw_answer if specific IDs provided
      : allResults.filter(r => {
          return !processedCollectorResults.has(r.id);
        }).slice(0, limit); // Process configurable batch size
    
    console.log(`   📊 [Position Extraction] Will process ${results.length} results (${allResults.length} total, ${processedCollectorResults.size} already processed)`);
    
    if (results.length === 0) {
      console.log(`   ⚠️ [Position Extraction] No results to process`);
      return 0;
    }
    
    console.log(`   📋 [Position Extraction] Processing collector_result IDs: ${results.map(r => r.id).slice(0, 10).join(', ')}${results.length > 10 ? '...' : ''}`);

    // Process each result
    let processed = 0;
    for (const result of results) {
      try {
        console.log(`   🔄 [Position Extraction] Processing collector_result ${result.id}...`);
        const parsedResult = CollectorResultRow.parse(result);
        const positionResult = await this.extractPositions(parsedResult);
        const totalRows = 1 + positionResult.competitorRows.length; // brand row + competitor rows
        console.log(`   📊 [Position Extraction] Extracted ${totalRows} position rows for collector_result ${result.id} (1 brand, ${positionResult.competitorRows.length} competitors)`);
        await this.savePositions(positionResult);
        console.log(`   ✅ [Position Extraction] Saved positions for collector_result ${result.id}`);

        processed++;
        const totalCompetitorMentions = positionResult.competitorRows.reduce((sum, row) => sum + row.competitor_mentions, 0);
      } catch (error) {
        console.error(`❌ Error processing result ${result.id}:`, error instanceof Error ? error.message : error);
        // Continue with next result
      }
    }
    if (this.totalTokenCalls > 0) {
    }

    return processed;
  }

  // ============================================================================
  // POSITION EXTRACTION LOGIC
  // ============================================================================

  /**
   * Extract brand and competitor positions from a single collector result
   */
  private async extractPositions(
    result: z.infer<typeof CollectorResultRow>
  ): Promise<PositionExtractionPayload> {
    // Priority: 1) collector_results.topic column, 2) collector_results.metadata, 3) generated_queries.topic column, 4) generated_queries.metadata
    let topicName = result.topic || this.getTopicNameFromMetadata(result.metadata);

    if (!topicName) {
      try {
        const { data: queryMetadataRow, error: queryMetadataError } = await this.supabase
          .from('generated_queries')
          .select('topic, metadata')
          .eq('id', result.query_id)
          .maybeSingle();

        if (!queryMetadataError && queryMetadataRow) {
          // Priority: topic column first, then metadata
          topicName = queryMetadataRow.topic || this.getTopicNameFromMetadata(queryMetadataRow.metadata);
        }
      } catch (topicError) {
      }
    }

    // Fetch brand metadata for product names
    const { data: brand } = await this.supabase
      .from('brands')
      .select('id, name, metadata')
      .eq('id', result.brand_id)
      .single();

    if (!brand) {
      throw new Error(`Brand not found: ${result.brand_id}`);
    }

    const parsedBrand = BrandRow.parse(brand);

    // Normalize competitors array first (needed for both paths)
    const normalizedCompetitors = result.competitors.map(comp => 
      typeof comp === 'string' 
        ? { competitor_name: comp }
        : comp
    );

    // Fetch competitor metadata (needed for both paths)
    const { data: competitorMetadataRows } = await this.supabase
      .from('brand_competitors')
      .select('competitor_name, metadata')
      .eq('brand_id', result.brand_id);

    const competitorMetadataMap = new Map<string, any>();
    (competitorMetadataRows || []).forEach((row) => {
      competitorMetadataMap.set(row.competitor_name.toLowerCase(), row.metadata);
    });

    // Get product names (with caching or consolidated analysis)
    let productNames: string[] = [];
    let competitorProductsMap: Record<string, string[]> = {};

    if (USE_CONSOLIDATED_ANALYSIS) {
      // Use consolidated analysis service
      try {
        // Parse citations from result
        let citations: string[] = [];
        if (Array.isArray(result.citations)) {
          citations = result.citations
            .map(c => typeof c === 'string' ? c : (c.url || c))
            .filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
        } else if (Array.isArray((result as any).urls)) {
          citations = (result as any).urls
            .filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
        }

        // Get competitor names for consolidated service
        const competitorNames = normalizedCompetitors.map(c => 
          typeof c === 'string' ? c : c.competitor_name
        ).filter(Boolean);

        console.log(`🔄 Using consolidated analysis service for collector_result ${result.id}`);
        const consolidated = await consolidatedAnalysisService.analyze({
          brandName: parsedBrand.name,
          brandMetadata: parsedBrand.metadata,
          competitorNames,
          competitorMetadata: competitorMetadataMap,
          rawAnswer: result.raw_answer,
          citations,
          collectorResultId: result.id
        });

        productNames = consolidated.products.brand;
        competitorProductsMap = consolidated.products.competitors;

        // Cache brand products
        this.productCache.set(parsedBrand.id, productNames);

        console.log(`✅ Consolidated analysis: ${productNames.length} brand products, ${Object.keys(competitorProductsMap).length} competitors with products`);
      } catch (error) {
        console.warn(`⚠️ Consolidated analysis failed, falling back to individual extraction:`, error instanceof Error ? error.message : error);
        // Fallback to individual extraction
        productNames = await this.getProductNames(
          parsedBrand.id,
          parsedBrand.name,
          parsedBrand.metadata,
          result.raw_answer
        );
      }
    } else {
      // Use individual product extraction (original method)
      productNames = await this.getProductNames(
        parsedBrand.id,
        parsedBrand.name,
        parsedBrand.metadata,
        result.raw_answer
      );
    }

    // Build position metadata with topic and product names
    const positionMetadata: Record<string, any> = {};
    if (topicName) {
      positionMetadata.topic_name = topicName;
    }
    if (productNames.length > 0) {
      positionMetadata.product_names = productNames;
      positionMetadata.productNames = productNames; // Support both naming conventions
      positionMetadata.products = productNames;
    }

    const enrichedCompetitors = normalizedCompetitors.map((comp) => {
      // Use products from consolidated analysis if available, otherwise from metadata
      let productNames: string[] = [];
      if (USE_CONSOLIDATED_ANALYSIS && competitorProductsMap[comp.competitor_name]) {
        productNames = competitorProductsMap[comp.competitor_name];
      } else {
        const metadata = competitorMetadataMap.get(comp.competitor_name.toLowerCase()) || null;
        productNames = this.extractProductNamesFromMetadata(metadata);
      }
      return {
        competitor_name: comp.competitor_name,
        productNames,
      };
    });

    // Extract positions using LLM
    const positions = this.calculateWordPositions(
      parsedBrand.name,
      productNames,
      enrichedCompetitors,
      result.raw_answer
    );

    // Calculate total mentions
    const competitorNames = enrichedCompetitors.map(c => c.competitor_name);

    // Ensure every competitor has an entry, even if not mentioned
    const competitorPositionMap: Record<string, number[]> = competitorNames.reduce((map, name) => {
      map[name] = [];
      return map;
    }, {} as Record<string, number[]>);

    const competitorProductPositions: Record<string, number[]> = competitorNames.reduce((map, name) => {
      map[name] = [];
      return map;
    }, {} as Record<string, number[]>);

    for (const [name, positionArray] of Object.entries(positions.competitors)) {
      competitorPositionMap[name] = positionArray;
    }

    for (const [name, productPositionArray] of Object.entries(positions.competitorProducts)) {
      competitorProductPositions[name] = productPositionArray;
    }

    const totalBrandMentions = positions.brand.all.length;
    const totalCompetitorMentions = Object.values(competitorPositionMap)
      .reduce((sum, posArray) => sum + posArray.length, 0);
    const totalBrandProductMentions = positions.brandProducts.length;
    const totalCompetitorProductMentions = Object.values(competitorProductPositions)
      .reduce((sum, posArray) => sum + posArray.length, 0);

    const processedAt = new Date().toISOString();
    const hasBrandPresence = totalBrandMentions > 0;

    const brandVisibility = this.calculateVisibilityIndex(totalBrandMentions, positions.brand.all, positions.wordCount);
    const brandShareOfAnswers = this.calculateShareOfAnswers(totalBrandMentions, totalCompetitorMentions);

    const brandRow: PositionInsertRow = {
      customer_id: result.customer_id,
      brand_id: result.brand_id,
      query_id: result.query_id,
      collector_type: result.collector_type,
      collector_result_id: result.id,
      brand_name: parsedBrand.name,
      competitor_name: null,
      raw_answer: result.raw_answer,
      brand_first_position: positions.brand.first,
      brand_positions: positions.brand.all,
      competitor_positions: [],
      total_brand_mentions: totalBrandMentions,
      competitor_mentions: totalCompetitorMentions,
      total_word_count: positions.wordCount,
      visibility_index: brandVisibility,
      visibility_index_competitor: null,
      share_of_answers_brand: brandShareOfAnswers,
      share_of_answers_competitor: null,
      total_brand_product_mentions: totalBrandProductMentions,
      total_competitor_product_mentions: totalCompetitorProductMentions,
      has_brand_presence: hasBrandPresence,
      processed_at: processedAt,
      topic: topicName || null, // Store topic in dedicated column
      metadata: positionMetadata,
    };

    const competitorRows: PositionInsertRow[] = competitorNames.map((competitorName) => {
      const competitorPositionArray = competitorPositionMap[competitorName] ?? [];
      const competitorMentions = competitorPositionArray.length;
      const competitorProductPositionArray = competitorProductPositions[competitorName] ?? [];
      const competitorProductMentions = competitorProductPositionArray.length;
      const competitorVisibility = this.calculateVisibilityIndex(
        competitorMentions,
        competitorPositionArray,
        positions.wordCount
      );
      const remainingCompetitorMentions = totalCompetitorMentions - competitorMentions;
      const competitorShareOfAnswers = this.calculateShareOfAnswers(
        competitorMentions,
        totalBrandMentions + remainingCompetitorMentions
      );

      return {
        customer_id: result.customer_id,
        brand_id: result.brand_id,
        query_id: result.query_id,
        collector_type: result.collector_type,
        collector_result_id: result.id,
        brand_name: parsedBrand.name,
        competitor_name: competitorName,
        raw_answer: result.raw_answer,
        brand_first_position: positions.brand.first,
        brand_positions: positions.brand.all,
        competitor_positions: competitorPositionArray,
        total_brand_mentions: totalBrandMentions,
        competitor_mentions: competitorMentions,
        total_word_count: positions.wordCount,
        visibility_index: brandVisibility,
        visibility_index_competitor: competitorVisibility,
        share_of_answers_brand: brandShareOfAnswers,
        share_of_answers_competitor: competitorShareOfAnswers,
        total_brand_product_mentions: totalBrandProductMentions,
        total_competitor_product_mentions: competitorProductMentions,
        has_brand_presence: hasBrandPresence,
        processed_at: processedAt,
        topic: topicName || null, // Store topic in dedicated column
        metadata: positionMetadata,
      };
    });

    return {
      brandRow,
      competitorRows,
      productNames, // Return product names so they can be saved to collector_results
    };
  }

  // ============================================================================
  // PRODUCT NAME EXTRACTION (WITH CACHING)
  // ============================================================================

  /**
   * Get product names for a brand (cached to avoid redundant LLM calls)
   */
  private async getProductNames(
    brandId: string,
    brandName: string,
    metadata: any,
    rawAnswer: string
  ): Promise<string[]> {
    // Check cache first
    if (this.productCache.has(brandId)) {
      return this.productCache.get(brandId)!;
    }

    // Extract from metadata or LLM
    const products = await this.extractProductNamesWithLLM(brandName, metadata, rawAnswer);
    
    // Cache for future use
    this.productCache.set(brandId, products);
    return products;
  }

  /**
   * Extract product names using LLM
   */
  private async extractProductNamesWithLLM(
    brandName: string,
    metadata: any,
    rawAnswer: string
  ): Promise<string[]> {
    const metadataStr = metadata ? JSON.stringify(metadata, null, 2).substring(0, 600) : 'No metadata provided';

    const prompt = `Your task is to extract only real, commercially branded products made by the brand below.

Brand: "${brandName}"
Context:
${metadataStr}
Snippet:
${rawAnswer}

Rules:
1. Include only official products sold by "${brandName}" — specific product names, SKUs, models, or variants that consumers can buy and that appear in the brand’s catalog or marketing.
2. Exclude all generics: ingredients, materials, components, drug names, categories (e.g., “pain reliever”, “running shoes”, “smartphone”), and any descriptive phrases.
3. Exclude competitors and their products entirely.
4. Exclude side effects, conditions, benefits, use-cases, and features (e.g., “noise cancellation”, “headache relief”, “extra strength formula”).
5. If a name is not clearly an official product of "${brandName}", leave it out.
6. Use both the snippet and your general knowledge, but never invent products.

Output: A JSON array of up to 12 valid product names. If none exist, return [].

`;

    try {
      const response = await this.callLLM(prompt, 'product-extraction');
      const products = JSON.parse(response);
      
      if (!Array.isArray(products)) {
        return [];
      }

      const sanitizedProducts = Array.from(
        new Set(
          products
            .map((product) => (typeof product === 'string' ? this.sanitizeProductName(product) : ''))
            .filter((product) => product.length > 0)
        )
      );
      return sanitizedProducts;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check for token limit errors
      if (errorMsg.includes('token') || errorMsg.includes('context') || errorMsg.includes('length') || errorMsg.includes('400')) {
      } else {
      }
      return [];
    }
  }

  // ============================================================================
  // POSITION EXTRACTION WITH LLM
  // ============================================================================

  // ============================================================================
  // LOCAL POSITION CALCULATION
  // ============================================================================

  private calculateWordPositions(
    brandName: string,
    productNames: string[],
    competitors: Array<{ competitor_name: string; productNames: string[] }>,
    rawAnswer: string
  ): {
    brand: { first: number | null; all: number[] };
    brandProducts: number[];
    competitors: { [competitor: string]: number[] };
    competitorProducts: { [competitor: string]: number[] };
    wordCount: number;
  } {
    const { tokens, normalizedTokens } = this.tokenizeWords(rawAnswer);

    const brandTermTokens = [brandName, ...productNames]
      .map(term => this.normalizeTerm(term))
      .filter(termTokens => termTokens.length > 0);

    const brandPositionsSet = new Set<number>();
    const brandProductPositionsSet = new Set<number>();
    for (const termTokens of brandTermTokens) {
      this.findTermPositions(normalizedTokens, termTokens).forEach(position => {
        brandPositionsSet.add(position);
      });
    }

    for (const productName of productNames) {
      const productTokens = this.normalizeTerm(productName);
      this.findTermPositions(normalizedTokens, productTokens).forEach(position => {
        brandProductPositionsSet.add(position);
      });
    }

    const brandPositions = Array.from(brandPositionsSet).sort((a, b) => a - b);
    const brandFirst = brandPositions.length > 0 ? brandPositions[0] : null;
    const brandProductPositions = Array.from(brandProductPositionsSet).sort((a, b) => a - b);

    const competitorPositions: Record<string, number[]> = {};
    const competitorProductPositions: Record<string, number[]> = {};
    for (const competitor of competitors) {
      const termTokensList = [competitor.competitor_name, ...competitor.productNames]
        .map((term) => this.normalizeTerm(term))
        .filter((tokens) => tokens.length > 0);

      const combinedPositionSet = new Set<number>();
      for (const termTokens of termTokensList) {
        this.findTermPositions(normalizedTokens, termTokens).forEach((position) => {
          combinedPositionSet.add(position);
        });
      }

      competitorPositions[competitor.competitor_name] = Array.from(combinedPositionSet).sort((a, b) => a - b);

      const productPositionSet = new Set<number>();
      for (const productName of competitor.productNames) {
        const productTokens = this.normalizeTerm(productName);
        this.findTermPositions(normalizedTokens, productTokens).forEach((position) => {
          productPositionSet.add(position);
        });
      }
      competitorProductPositions[competitor.competitor_name] = Array.from(productPositionSet).sort((a, b) => a - b);
    }
    for (const [competitor, pos] of Object.entries(competitorPositions)) {
    }

    return {
      brand: { first: brandFirst, all: brandPositions },
      brandProducts: brandProductPositions,
      competitors: competitorPositions,
      competitorProducts: competitorProductPositions,
      wordCount: tokens.length,
    };
  }

  private tokenizeWords(text: string): { tokens: string[]; normalizedTokens: string[] } {
    const matches = text.match(/\b[\p{L}\p{N}’']+\b/gu);
    if (!matches) {
      return { tokens: [], normalizedTokens: [] };
    }

    const tokens = matches.map(token => token);
    const normalizedTokens = tokens.map(token =>
      this.normalizeWord(token)
    );

    return { tokens, normalizedTokens };
  }

  private normalizeWord(word: string): string {
    return word
      .toLowerCase()
      .replace(/^[’']+/u, '')
      .replace(/[’']+$/u, '')
      .replace(/’s$|s’$/u, '')
      .replace(/['’]s$/u, '');
  }

  private normalizeTerm(term: string): string[] {
    const matches = term.match(/\b[\p{L}\p{N}’']+\b/gu);
    if (!matches) {
      return [];
    }
    return matches.map(word => this.normalizeWord(word));
  }

  private findTermPositions(tokens: string[], termTokens: string[]): number[] {
    if (termTokens.length === 0 || tokens.length === 0) {
      return [];
    }

    const positions: number[] = [];
    const termLength = termTokens.length;

    for (let i = 0; i <= tokens.length - termLength; i++) {
      let match = true;
      for (let j = 0; j < termLength; j++) {
        if (tokens[i + j] !== termTokens[j]) {
          match = false;
          break;
        }
      }

      if (match) {
        positions.push(i + 1); // 1-indexed
      }
    }

    return positions;
  }

  private sanitizeProductName(name: string): string {
    let sanitized = name;

    sanitized = sanitized.replace(/\([^)]*\)/g, ' ');
    sanitized = sanitized.replace(/["'`]/g, '');
    sanitized = sanitized.replace(/\s*[-–—:]\s+.*$/, '');
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  private extractProductNamesFromMetadata(metadata: any): string[] {
    if (!metadata) {
      return [];
    }

    const candidates: string[] = [];

    const pushValues = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach((item) => pushValues(item));
        return;
      }
      if (typeof value === 'string') {
        const sanitized = this.sanitizeProductName(value);
        if (sanitized.length > 0) {
          candidates.push(sanitized);
        }
      }
    };

    const possibleKeys = [
      'products',
      'product_names',
      'productNames',
      'aliases',
      'alias',
      'keywords',
      'keyword_aliases',
    ];

    for (const key of possibleKeys) {
      if (metadata[key] !== undefined) {
        pushValues(metadata[key]);
      }
    }

    return Array.from(new Set(candidates));
  }

  private calculateVisibilityIndex(occurrences: number, positions: number[], totalWords: number): number | null {
    if (totalWords === 0) return null;
    if (occurrences === 0) return 0;
    if (!positions || positions.length === 0) return 0;

    const firstPosition = positions[0];
    if (!firstPosition || firstPosition < 1) return 0;

    const density = occurrences / totalWords;
    const prominence = 1 / Math.log10(firstPosition + 9);

    const visibilityIndex = (prominence * 0.6) + (density * 0.4);
    return Math.round(visibilityIndex * 100) / 100;
  }

  private calculateShareOfAnswers(primaryMentions: number, secondaryMentions: number): number | null {
    const total = primaryMentions + secondaryMentions;
    if (total === 0) {
      return null;
    }
    const share = (primaryMentions / total) * 100;
    return Math.round(share * 100) / 100;
  }

  // ============================================================================
  // LLM API CALLS (CEREBRAS PRIMARY, GEMINI FALLBACK) - still used for product extraction
  // ============================================================================

  /**
   * Call LLM API with Cerebras primary and Gemini fallback
   */
  private async callLLM(prompt: string, purpose: string): Promise<string> {
    // Try Cerebras first
    if (this.cerebrasApiKey) {
      try {
        return await this.callCerebras(prompt);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Check if it's a rate limit error
        if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        } else {
        }
      }
    }

    // Fallback to Gemini
    if (this.geminiApiKey) {
      try {
        return await this.callGemini(prompt);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Both Cerebras and Gemini failed. Last error: ${errorMsg}`);
      }
    }

    throw new Error('No LLM API available');
  }

  /**
   * Call Cerebras API
   */
  private async callCerebras(prompt: string): Promise<string> {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.cerebrasApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-3-235b-a22b-instruct-2507',
        messages: [
          {
            role: 'system',
            content: 'You are a precise text analysis assistant. Return only valid JSON, no explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cerebras API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as any;
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('No content in Cerebras response');
    }

    if (data.usage) {
      const promptTokens = data.usage.prompt_tokens ?? data.usage.promptTokens;
      const completionTokens = data.usage.completion_tokens ?? data.usage.completionTokens;
      const totalTokens = data.usage.total_tokens ?? data.usage.totalTokens;
      this.totalPromptTokens += Number(promptTokens ?? 0);
      this.totalCompletionTokens += Number(completionTokens ?? 0);
      this.totalTokenCalls += 1;
    }

    return data.choices[0].message.content.trim();
  }

  /**
   * Call Gemini API
   */
  private async callGemini(prompt: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a precise text analysis assistant. Return only valid JSON, no explanations.\n\n${prompt}`,
            }],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as any;
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No content in Gemini response');
    }

    if (data.usageMetadata) {
      const promptTokens = data.usageMetadata.promptTokenCount ?? data.usageMetadata.prompt_tokens;
      const completionTokens = data.usageMetadata.candidatesTokenCount ?? data.usageMetadata.completion_tokens;
      const totalTokens = data.usageMetadata.totalTokenCount ?? data.usageMetadata.total_tokens;
      this.totalPromptTokens += Number(promptTokens ?? 0);
      this.totalCompletionTokens += Number(completionTokens ?? 0);
      this.totalTokenCalls += 1;
    }

    return data.candidates[0].content.parts[0].text.trim();
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getTopicNameFromMetadata(metadata: any): string | null {
    if (!metadata) {
      return null;
    }

    let parsed: any = metadata;
    if (typeof metadata === 'string') {
      try {
        parsed = JSON.parse(metadata);
      } catch {
        return null;
      }
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const topicName =
      typeof parsed.topic_name === 'string' && parsed.topic_name.trim().length > 0
        ? parsed.topic_name.trim()
        : typeof parsed.topic === 'string' && parsed.topic.trim().length > 0
          ? parsed.topic.trim()
          : null;

    return topicName;
  }

  /**
   * Save extracted positions to NEW OPTIMIZED SCHEMA
   * Writes to: metric_facts, brand_metrics, competitor_metrics
   */
  private async savePositions(payload: PositionExtractionPayload): Promise<void> {
    const collectorResultId = payload.brandRow.collector_result_id;
    const brandRow = payload.brandRow;

    console.log(`   💾 [savePositions] Saving to OPTIMIZED SCHEMA for collector_result ${collectorResultId}`);
    console.log(`      - Brand: ${brandRow.brand_name || 'N/A'}`);
    console.log(`      - Competitors: ${payload.competitorRows.length} (${payload.competitorRows.map(r => r.competitor_name).join(', ')})`);

    // Step 1: Create or update metric_fact (core reference table)
    const metricFact = {
      collector_result_id: collectorResultId,
      brand_id: brandRow.brand_id,
      customer_id: brandRow.customer_id,
      query_id: brandRow.query_id,
      collector_type: brandRow.collector_type,
      topic: brandRow.topic || null,
      processed_at: brandRow.processed_at,
    };

    console.log(`   🚀 [savePositions] Upserting metric_fact...`);
    const { data: metricFactData, error: metricFactError } = await this.supabase
      .from('metric_facts')
      .upsert(metricFact, {
        onConflict: 'collector_result_id',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();

    if (metricFactError || !metricFactData) {
      console.error(`   ❌ [savePositions] Failed to upsert metric_fact:`, metricFactError);
      throw new Error(`Failed to create metric_fact: ${metricFactError?.message}`);
    }

    const metricFactId = metricFactData.id;
    console.log(`   ✅ [savePositions] Metric fact created/updated (id: ${metricFactId})`);

    // Step 2: Create or update brand_metrics
    const brandMetrics = {
      metric_fact_id: metricFactId,
      visibility_index: brandRow.visibility_index,
      share_of_answers: brandRow.share_of_answers_brand,
      brand_first_position: brandRow.brand_first_position,
      brand_positions: brandRow.brand_positions || [],
      total_brand_mentions: brandRow.total_brand_mentions || 0,
      total_word_count: brandRow.total_word_count || 0,
      has_brand_presence: brandRow.has_brand_presence || false,
    };

    console.log(`   🚀 [savePositions] Upserting brand_metrics...`);
    const { error: brandMetricsError } = await this.supabase
      .from('brand_metrics')
      .upsert(brandMetrics, {
        onConflict: 'metric_fact_id',
        ignoreDuplicates: false,
      });

    if (brandMetricsError) {
      console.error(`   ❌ [savePositions] Failed to upsert brand_metrics:`, brandMetricsError);
      throw new Error(`Failed to save brand_metrics: ${brandMetricsError.message}`);
    }

    console.log(`   ✅ [savePositions] Brand metrics saved`);

    // Step 3: Delete existing competitor_metrics for this metric_fact (for idempotency)
    console.log(`   🗑️ [savePositions] Deleting existing competitor_metrics...`);
    const { error: deleteCompError } = await this.supabase
      .from('competitor_metrics')
      .delete()
      .eq('metric_fact_id', metricFactId);

    if (deleteCompError) {
      console.warn(`   ⚠️ [savePositions] Warning deleting competitor_metrics:`, deleteCompError.message);
      // Don't throw - might not exist
    }

    // Step 4: Create competitor_metrics for each competitor
    if (payload.competitorRows.length > 0) {
      console.log(`   🚀 [savePositions] Inserting ${payload.competitorRows.length} competitor_metrics...`);

      // Get competitor IDs from brand_competitors table
      const competitorNames = payload.competitorRows.map(r => r.competitor_name).filter(Boolean) as string[];
      const { data: competitorData, error: compFetchError } = await this.supabase
        .from('brand_competitors')
        .select('id, competitor_name')
        .eq('brand_id', brandRow.brand_id)
        .in('competitor_name', competitorNames);

      if (compFetchError) {
        console.error(`   ❌ [savePositions] Failed to fetch competitor IDs:`, compFetchError);
        throw new Error(`Failed to fetch competitor IDs: ${compFetchError.message}`);
      }

      // Create a map of competitor_name -> competitor_id
      const competitorIdMap = new Map<string, string>();
      (competitorData || []).forEach(comp => {
        competitorIdMap.set(comp.competitor_name, comp.id);
      });

      // Build competitor_metrics rows
      const competitorMetricsRows = [];
      for (const compRow of payload.competitorRows) {
        if (!compRow.competitor_name) continue;

        const competitorId = competitorIdMap.get(compRow.competitor_name);
        if (!competitorId) {
          console.warn(`   ⚠️ [savePositions] Competitor "${compRow.competitor_name}" not found in brand_competitors table`);
          continue;
        }

        competitorMetricsRows.push({
          metric_fact_id: metricFactId,
          competitor_id: competitorId,
          visibility_index: compRow.visibility_index_competitor,
          share_of_answers: compRow.share_of_answers_competitor,
          competitor_positions: compRow.competitor_positions || [],
          competitor_mentions: compRow.competitor_mentions || 0,
        });
      }

      if (competitorMetricsRows.length > 0) {
        const { error: compMetricsError } = await this.supabase
          .from('competitor_metrics')
          .insert(competitorMetricsRows);

        if (compMetricsError) {
          console.error(`   ❌ [savePositions] Failed to insert competitor_metrics:`, compMetricsError);
          throw new Error(`Failed to save competitor_metrics: ${compMetricsError.message}`);
        }

        console.log(`   ✅ [savePositions] Inserted ${competitorMetricsRows.length} competitor_metrics`);
      }
    }

    console.log(`   ✅ [savePositions] Successfully saved to optimized schema (metric_fact_id: ${metricFactId})`);

    // Update collector_results.metadata with product names if available
    if (payload.productNames && payload.productNames.length > 0) {
      try {
        // Fetch current metadata
        const { data: currentResult, error: fetchError } = await this.supabase
          .from('collector_results')
          .select('metadata')
          .eq('id', payload.brandRow.collector_result_id)
          .single();

        if (fetchError) {
          console.warn(`   ⚠️ [savePositions] Could not fetch collector_results metadata:`, fetchError.message);
        } else {
          // Merge product names into existing metadata
          const currentMetadata = currentResult?.metadata || {};
          const updatedMetadata = {
            ...currentMetadata,
            product_names: payload.productNames,
            productNames: payload.productNames, // Support both naming conventions
            products: payload.productNames,
          };

          const { error: updateError } = await this.supabase
            .from('collector_results')
            .update({ metadata: updatedMetadata })
            .eq('id', payload.brandRow.collector_result_id);

          if (updateError) {
            console.warn(`   ⚠️ [savePositions] Could not update collector_results metadata:`, updateError.message);
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ [savePositions] Error updating metadata:`, error);
      }
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const positionExtractionService = new PositionExtractionService();

