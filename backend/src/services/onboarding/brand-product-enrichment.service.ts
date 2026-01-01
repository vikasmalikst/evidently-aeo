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

    const competitorNames = competitors?.map(c => c.competitor_name) || [];
    logger(`📊 Found ${competitorNames.length} competitors: ${competitorNames.join(', ')}`);

    // 3. Prepare Prompt
    const systemPrompt = `You are a market research expert. Your task is to identify all common synonyms, abbreviations, and name variations for a brand and its competitors, as well as their main commercial products.
Respond ONLY with valid JSON in this exact structure:
{
  "brand": {
    "synonyms": ["name1", "name2"],
    "products": ["product1", "product2"]
  },
  "competitors": {
    "Competitor Name": {
      "synonyms": ["name1", "name2"],
      "products": ["product1", "product2"]
    }
  }
}`;

    const userPrompt = `Brand: ${brand.name}
Industry: ${brand.industry || 'General'}
Competitors: ${competitorNames.join(', ')}

Please provide comprehensive synonyms (legal names, abbreviations, common misspellings) and commercial products for the brand and each competitor.`;

    // 4. Call LLM (Ollama or OpenRouter)
    let response: string;
    const useOllama = await shouldUseOllama(brandId);

    try {
      if (useOllama) {
        logger(`🦙 Using local Ollama LLM for enrichment...`);
        response = await callOllamaAPI(systemPrompt, userPrompt, brandId);
      } else {
        logger(`🌐 Using OpenRouter (gpt-4o-mini) for enrichment...`);
        const orResult = await this.openRouterService.executeQuery({
          prompt: userPrompt,
          systemPrompt: systemPrompt,
          model: 'openai/gpt-4o-mini',
        });
        response = orResult.response;
      }

      // Parse and validate JSON
      const cleanedResponse = response.replace(/```json|```/g, '').trim();
      let result: EnrichmentResult;
      try {
        result = JSON.parse(cleanedResponse);
      } catch (e) {
        logger(`⚠️ Failed to parse JSON response directly, attempting to extract JSON...`);
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Response is not valid JSON');
        }
      }

      // 5. Store in Database
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

      logger(`✅ Enrichment completed successfully for ${brand.name}`);
    } catch (error) {
      logger(`❌ Enrichment failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export const brandProductEnrichmentService = new BrandProductEnrichmentService();
