import { supabaseAdmin } from '../../config/database';
import { callOllamaAPI, shouldUseOllama } from '../scoring/ollama-client.service';
import { OpenRouterCollectorService } from '../data-collection/openrouter-collector.service';

/**
 * Service to enrich brand and competitor data with synonyms and commercial products
 * using LLMs (Ollama or OpenRouter).
 */
export interface EnrichmentResult {
  brand: {
    synonyms: string[];
    products: string[];
  };
  competitors: Record<string, {
    synonyms: string[];
    products: string[];
  }>;
}

export class BrandProductEnrichmentService {
  private openRouterService: OpenRouterCollectorService;

  constructor() {
    this.openRouterService = new OpenRouterCollectorService();
  }

  private buildPrompts(params: {
    brandName: string;
    industry?: string | null;
    competitors: string[];
  }): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are a market research expert. Your task is to identify all common synonyms, abbreviations, and name variations for a brand and its competitors, as well as their main commercial product names. Make sure the commercial product names are specific and not generic terms liek Burrito for Chipotle or Water Bottle for Larq or Soap for Tide.

IMPORTANT: You MUST return a JSON object containing keys for the main brand AND EVERY SINGLE COMPETITOR listed in the prompt, even if you have to leave their lists empty. Do not skip any competitor.

Respond ONLY with valid JSON in this exact structure:
{
  "brand": {
    "synonyms": ["name1", "name2"],
    "products": ["product1", "product2"]
  },
  "competitors": {
    "Competitor Name 1": {
      "synonyms": ["name1", "name2"],
      "products": ["product1", "product2"]
    },
    "Competitor Name 2": { ... }
  }
}`;

    const userPrompt = `Brand: ${params.brandName}
Industry: ${params.industry || 'General'}
Competitors: ${params.competitors.join(', ')}

Please provide comprehensive synonyms (legal names, abbreviations, common misspellings) and commercial products for the brand and EACH of the ${params.competitors.length} competitors listed above.`;

    return { systemPrompt, userPrompt };
  }

  private parseEnrichmentResponse(response: string, logger: (msg: string) => void): EnrichmentResult {
    const cleanedResponse = response.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(cleanedResponse) as EnrichmentResult;
    } catch (_e) {
      logger(`⚠️ Failed to parse JSON response directly, attempting to extract JSON...`);
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Response is not valid JSON');
      }
      return JSON.parse(jsonMatch[0]) as EnrichmentResult;
    }
  }

  private async generateEnrichment(params: {
    brandName: string;
    industry?: string | null;
    competitors: string[];
    forceOpenRouter?: boolean;
    brandIdForOllamaDecision?: string;
  }, logger: (msg: string) => void): Promise<EnrichmentResult> {
    logger(`🔍 Enrichment requested for brand "${params.brandName}" with ${params.competitors.length} competitors: ${params.competitors.join(', ')}`);
    const { systemPrompt, userPrompt } = this.buildPrompts(params);

    const canUseOllama =
      !params.forceOpenRouter &&
      !!params.brandIdForOllamaDecision &&
      (await shouldUseOllama(params.brandIdForOllamaDecision));

    if (canUseOllama) {
      logger(`🦙 Using local Ollama LLM for enrichment...`);
      const response = await callOllamaAPI(systemPrompt, userPrompt, params.brandIdForOllamaDecision!);
      return this.parseEnrichmentResponse(response, logger);
    }

    logger(`🌐 Using OpenRouter (gpt-4o-mini) for enrichment...`);
    const orResult = await this.openRouterService.executeQuery({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      model: 'openai/gpt-4o-mini',
      collectorType: 'content',
    });
    return this.parseEnrichmentResponse(orResult.response, logger);
  }

  async previewEnrichment(params: {
    brandName: string;
    industry?: string | null;
    competitors: string[];
  }, logger: (msg: string) => void): Promise<EnrichmentResult> {
    return this.generateEnrichment(
      {
        brandName: params.brandName,
        industry: params.industry,
        competitors: params.competitors,
        forceOpenRouter: true,
      },
      logger
    );
  }

  async saveEnrichmentToDatabase(brandId: string, result: EnrichmentResult, logger: (msg: string) => void): Promise<void> {
    logger(`💾 Saving enrichment data to database...`);
    const { error: upsertError } = await supabaseAdmin
      .from('brand_products')
      .upsert({
        brand_id: brandId,
        brand_synonyms: result.brand.synonyms,
        brand_products: result.brand.products,
        competitor_data: result.competitors,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'brand_id'
      });

    if (upsertError) throw upsertError;
  }

  async enrichBrand(brandId: string, logger: (msg: string) => void): Promise<void> {
    logger(`🚀 Starting enrichment for brand ID: ${brandId}`);

    // 1. Fetch brand details
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('name, industry, customer_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      throw new Error(`Failed to fetch brand: ${brandError?.message || 'Not found'}`);
    }

    // 2. Fetch competitors
    const { data: competitors, error: compError } = await supabaseAdmin
      .from('brand_competitors')
      .select('competitor_name')
      .eq('brand_id', brandId);

    if (compError) {
      throw new Error(`Failed to fetch competitors: ${compError.message}`);
    }

    const competitorNames = competitors?.map(c => c.competitor_name) || [];
    logger(`📊 Found ${competitorNames.length} competitors: ${competitorNames.join(', ')}`);

    try {
      const result = await this.generateEnrichment(
        {
          brandName: brand.name,
          industry: brand.industry,
          competitors: competitorNames,
          brandIdForOllamaDecision: brandId,
        },
        logger
      );

      await this.saveEnrichmentToDatabase(brandId, result, logger);

      logger(`✅ Enrichment completed successfully for ${brand.name}`);
    } catch (error) {
      logger(`❌ Enrichment failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export const brandProductEnrichmentService = new BrandProductEnrichmentService();
