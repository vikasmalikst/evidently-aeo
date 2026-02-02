import { supabaseAdmin } from '../config/database';

export type QueryTag = 'bias' | 'blind';

interface BrandTerms {
  brandName: string;
  synonyms: string[];
  products: string[];
}

export class QueryTaggingService {
  private static instance: QueryTaggingService;

  private constructor() {}

  public static getInstance(): QueryTaggingService {
    if (!QueryTaggingService.instance) {
      QueryTaggingService.instance = new QueryTaggingService();
    }
    return QueryTaggingService.instance;
  }

  /**
   * Fetches all relevant terms for a brand (name, synonyms, products)
   * to be used for bias detection.
   */
  async getBrandTerms(brandId: string, knownBrandName?: string): Promise<BrandTerms> {
    try {
      // Fetch brand name if not provided
      let brandName = knownBrandName;
      if (!brandName) {
        const { data: brand, error: brandError } = await supabaseAdmin
          .from('brands')
          .select('name')
          .eq('id', brandId)
          .single();
        
        if (brandError) {
          console.error(`Error fetching brand name for ${brandId}:`, brandError);
        }
        brandName = brand?.name || '';
      }

      // Fetch synonyms and products
      const { data: productData, error: productError } = await supabaseAdmin
        .from('brand_products')
        .select('brand_synonyms, brand_products')
        .eq('brand_id', brandId)
        .single();

      if (productError && productError.code !== 'PGRST116') { // Ignore "Row not found"
        console.warn(`Error fetching brand products for ${brandId}:`, productError.message);
      }

      const synonyms: string[] = [];
      const products: string[] = [];

      if (productData) {
        if (Array.isArray(productData.brand_synonyms)) {
          synonyms.push(...productData.brand_synonyms.map((s: any) => String(s)));
        }
        if (Array.isArray(productData.brand_products)) {
          products.push(...productData.brand_products.map((p: any) => String(p)));
        }
      }

      return {
        brandName: brandName || '',
        synonyms,
        products
      };
    } catch (error) {
      console.error('Unexpected error in getBrandTerms:', error);
      return { brandName: knownBrandName || '', synonyms: [], products: [] };
    }
  }

  /**
   * Determines if a query is 'bias' or 'blind' based on brand terms.
   * - Bias: Contains brand name, synonyms, or product names.
   * - Blind: Does not contain any of the above.
   */
  determineTag(queryText: string, terms: BrandTerms): QueryTag {
    if (!queryText) return 'blind';

    const lowerQuery = queryText.toLowerCase();
    const allTerms = [
      terms.brandName,
      ...terms.synonyms,
      ...terms.products
    ].filter(t => t && t.trim().length > 0);

    // Check for exact substring match (case-insensitive)
    // We might want to be more sophisticated (word boundaries), but substring is the requested start.
    // To avoid matching "Apple" in "Pineapple", we might want word boundaries, 
    // but typically brand names are distinct enough or we accept strict substring for now based on the prompt's simplicity.
    // The previous SQL used `ILIKE %term%`, which is substring. I will stick to substring.
    
    const isBias = allTerms.some(term => lowerQuery.includes(term.toLowerCase()));

    return isBias ? 'bias' : 'blind';
  }

  /**
   * Batch processes queries for a single brand.
   * Useful when we have the brandId and a list of queries.
   */
  async tagQueries(brandId: string, queries: string[], brandName?: string): Promise<QueryTag[]> {
    const terms = await this.getBrandTerms(brandId, brandName);
    return queries.map(q => this.determineTag(q, terms));
  }
}

export const queryTaggingService = QueryTaggingService.getInstance();
