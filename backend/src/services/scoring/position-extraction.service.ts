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

// Load environment variables
dotenv.config();

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
  metadata: z.any().optional(),
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
}

const DEFAULT_POSITION_LIMIT = 300;

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

    this.cerebrasApiKey = process.env.CEREBRAS_API_KEY || null;
    this.geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || null;
    this.geminiModel = process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash-002';

    if (!this.cerebrasApiKey && !this.geminiApiKey) {
      throw new Error('At least one LLM API key (Cerebras or Gemini) is required');
    }
  }

  // ============================================================================
  // MAIN PUBLIC METHOD
  // ============================================================================

  /**
   * Extract positions for all new collector results
   * Skips results that already have positions extracted
   */
  public async extractPositionsForNewResults(
    options: ExtractPositionsOptions = {}
  ): Promise<number> {
    const limit = Math.max(options.limit ?? DEFAULT_POSITION_LIMIT, 1);
    const fetchLimit = Math.max(limit * 2, limit);

    console.log('\n🎯 Starting position extraction...');
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

    // Fetch collector results (limit to recent ones)
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

    const { data: allResults, error: fetchError } = await query;

    if (fetchError) throw fetchError;
    if (!allResults || allResults.length === 0) {
      console.log('ℹ️  No collector results found');
      return 0;
    }

    // Check which results already have positions in the positions table
    const processedCollectorResults = new Set<number>();

    for (const result of allResults) {
      const { data: existing } = await this.supabase
        .from('extracted_positions')
        .select('id')
        .eq('collector_result_id', result.id)
        .limit(1)
        .maybeSingle();
      
      if (existing) {
        processedCollectorResults.add(result.id);
      }
    }

    // Filter to only new results
    const results = allResults.filter(r => {
      return !processedCollectorResults.has(r.id);
    }).slice(0, limit); // Process configurable batch size

    console.log(`📊 Found ${allResults.length} total results, ${results.length} need position extraction (${processedCollectorResults.size} already processed)`);

    if (results.length === 0) {
      console.log('✅ All results already processed! Nothing to extract.');
      return 0;
    }

    // Process each result
    let processed = 0;
    for (const result of results) {
      try {
        const parsedResult = CollectorResultRow.parse(result);
        console.log(`\n🔍 Processing: ${parsedResult.collector_type} (ID: ${parsedResult.id})`);
        console.log(`   Brand: ${parsedResult.brand}`);
        console.log(`   Query: ${parsedResult.question.substring(0, 80)}...`);

        const positionResult = await this.extractPositions(parsedResult);
        await this.savePositions(positionResult);

        processed++;
        const totalCompetitorMentions = positionResult.competitorRows.reduce((sum, row) => sum + row.competitor_mentions, 0);
        console.log(`✅ Extracted positions for ${parsedResult.brand} (${parsedResult.collector_type})`);
        console.log(`   📊 Brand mentions: ${positionResult.brandRow.total_brand_mentions}, Competitor mentions: ${totalCompetitorMentions} across ${positionResult.competitorRows.length} competitors`);
      } catch (error) {
        console.error(`❌ Error processing result ${result.id}:`, error instanceof Error ? error.message : error);
        // Continue with next result
      }
    }

    console.log(`\n✅ Position extraction complete! Processed ${processed}/${results.length} results`);

    if (this.totalTokenCalls > 0) {
      console.log(
        `\n🔢 Token usage summary → prompt: ${this.totalPromptTokens}, completion: ${this.totalCompletionTokens}, total: ${this.totalPromptTokens + this.totalCompletionTokens} across ${this.totalTokenCalls} calls`
      );
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
    let topicName = this.getTopicNameFromMetadata(result.metadata);

    if (!topicName) {
      try {
        const { data: queryMetadataRow, error: queryMetadataError } = await this.supabase
          .from('generated_queries')
          .select('metadata')
          .eq('id', result.query_id)
          .maybeSingle();

        if (!queryMetadataError && queryMetadataRow?.metadata) {
          topicName = this.getTopicNameFromMetadata(queryMetadataRow.metadata);
        }
      } catch (topicError) {
        console.warn(
          `⚠️ Unable to resolve topic metadata for query ${result.query_id}:`,
          topicError instanceof Error ? topicError.message : topicError
        );
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

    // Get product names (with caching)
    const productNames = await this.getProductNames(
      parsedBrand.id,
      parsedBrand.name,
      parsedBrand.metadata,
      result.raw_answer
    );

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

    // Normalize competitors array (handle both string[] and object[] formats)
    const normalizedCompetitors = result.competitors.map(comp => 
      typeof comp === 'string' 
        ? { competitor_name: comp }
        : comp
    );

    // Fetch competitor metadata to enrich with product names
    const { data: competitorMetadataRows } = await this.supabase
      .from('brand_competitors')
      .select('competitor_name, metadata')
      .eq('brand_id', result.brand_id);

    const competitorMetadataMap = new Map<string, any>();
    (competitorMetadataRows || []).forEach((row) => {
      competitorMetadataMap.set(row.competitor_name.toLowerCase(), row.metadata);
    });

    const enrichedCompetitors = normalizedCompetitors.map((comp) => {
      const metadata = competitorMetadataMap.get(comp.competitor_name.toLowerCase()) || null;
      const productNames = this.extractProductNamesFromMetadata(metadata);
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
      console.log(`   ✅ Using cached product names for ${brandName}`);
      return this.productCache.get(brandId)!;
    }

    // Extract from metadata or LLM
    const products = await this.extractProductNamesWithLLM(brandName, metadata, rawAnswer);
    
    // Cache for future use
    this.productCache.set(brandId, products);
    console.log(`   💾 Cached ${products.length} product names for ${brandName}`);
    
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
    const trimmedAnswer = rawAnswer.length > 2000 ? `${rawAnswer.slice(0, 2000)}...` : rawAnswer;

    const prompt = `You are helping map brand mentions to product names.

Brand: "${brandName}"
Context (metadata, may be empty):
${metadataStr}
Collector answer snippet (may contain product names):
${trimmedAnswer}

Task: List popular or relevant products that belong to "${brandName}". Use BOTH your knowledge and the provided context. Include specific models or collections if present in the snippet. Only return a JSON array of product names (max 12 items). If absolutely nothing is known, return [].

Example response:
["Product 1", "Product 2"]`;

    try {
      const response = await this.callLLM(prompt, 'product-extraction');
      const products = JSON.parse(response);
      
      if (!Array.isArray(products)) {
        console.warn(`   ⚠️  Invalid product response, using brand name only`);
        return [];
      }

      const sanitizedProducts = Array.from(
        new Set(
          products
            .map((product) => (typeof product === 'string' ? this.sanitizeProductName(product) : ''))
            .filter((product) => product.length > 0)
        )
      );
      
      console.log(`   📦 Extracted ${sanitizedProducts.length} products: ${sanitizedProducts.join(', ')}`);
      return sanitizedProducts;
    } catch (error) {
      console.warn(`   ⚠️  Product extraction failed, continuing without products:`, error instanceof Error ? error.message : error);
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

    console.log(`   📍 Brand "${brandName}" positions (word index): ${brandPositions.join(', ') || 'none'}`);
    for (const [competitor, pos] of Object.entries(competitorPositions)) {
      console.log(`   📍 Competitor "${competitor}" positions (word index): ${pos.join(', ') || 'none'}`);
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
        console.log(`   🤖 Calling Cerebras for ${purpose}...`);
        return await this.callCerebras(prompt);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Check if it's a rate limit error
        if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          console.warn(`   ⚠️  Cerebras rate limit hit, trying Gemini...`);
        } else {
          console.warn(`   ⚠️  Cerebras failed (${errorMsg}), trying Gemini...`);
        }
      }
    }

    // Fallback to Gemini
    if (this.geminiApiKey) {
      try {
        console.log(`   🤖 Calling Gemini for ${purpose}...`);
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
        model: 'llama3.1-8b',
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
      console.log(
        `   🔢 Cerebras tokens → prompt: ${promptTokens ?? 'n/a'}, completion: ${completionTokens ?? 'n/a'}, total: ${totalTokens ?? 'n/a'}`
      );
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
      console.log(
        `   🔢 Gemini tokens → prompt: ${promptTokens ?? 'n/a'}, completion: ${completionTokens ?? 'n/a'}, total: ${totalTokens ?? 'n/a'}`
      );
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
   * Save extracted positions to database
   */
  private async savePositions(payload: PositionExtractionPayload): Promise<void> {
    const rows = [
      payload.brandRow,
      ...payload.competitorRows,
    ];

    // Ensure idempotency by deleting existing rows for this collector result
    const { error: deleteError } = await this.supabase
      .from('extracted_positions')
      .delete()
      .eq('collector_result_id', payload.brandRow.collector_result_id);

    if (deleteError) {
      throw new Error(`Failed to reset existing positions: ${deleteError.message}`);
    }

    const { error: insertError } = await this.supabase
      .from('extracted_positions')
      .insert(rows);

    if (insertError) {
      throw new Error(`Failed to save positions: ${insertError.message}`);
    }

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
          console.warn(`⚠️ Could not fetch collector_results metadata to update product names: ${fetchError.message}`);
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
            console.warn(`⚠️ Could not update collector_results metadata with product names: ${updateError.message}`);
          } else {
            console.log(`✅ Updated collector_results metadata with ${payload.productNames.length} product names`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error updating collector_results metadata with product names:`, error instanceof Error ? error.message : error);
      }
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const positionExtractionService = new PositionExtractionService();

