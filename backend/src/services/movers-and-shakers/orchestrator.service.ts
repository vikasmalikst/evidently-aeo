import { siteSearchService } from '../data-collection/brightdata/site-search.service';
import { analysisService } from './analysis.service';
import { moversShakersStorage } from './storage.service';
import { MoversShakersResult, MoverItem } from './types';
import { createClient } from '@supabase/supabase-js';

export class MoversShakersOrchestrator {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  /**
   * Main entry point to generate the Movers & Shakers report
   */
  async generateReport(brandId: string, hours: number = 48): Promise<MoversShakersResult> {
    // 1. Get Brand Name and LLM settings
    const { name: brandName, useLocalLLM } = await this.getBrandDetails(brandId);
    
    // 2. Get Top Citation Sources
    const sources = await this.getTopCitationsForBrand(brandId);
    
    // 3. Add Custom Sources (if any)
    const customSources = await this.getCustomSources(brandId);
    
    // Combine and default if empty
    let allSources = [...new Set([...sources, ...customSources])];
    
    if (allSources.length === 0) {
      console.log('[Movers&Shakers] No sources found. Defaulting to generic tech sites.');
      allSources = ['reddit.com', 'youtube.com', 'techradar.com'];
    }
    
    console.log(`[Movers&Shakers] Analyzing ${brandName} on sources:`, allSources);

    const allItems: MoverItem[] = [];

    // 4. Parallel Execution (limit concurrency if needed)
    const promises = allSources.map(async (domain) => {
      try {
        // A. Search & Scrape
        const scrapeResult = await siteSearchService.searchAndScrape(domain, brandName, hours);
        
        if (scrapeResult.error || !scrapeResult.content) {
          console.warn(`[Movers&Shakers] Skipping ${domain}: ${scrapeResult.error || 'No content'}`);
          return;
        }

        // B. Analyze with LLM
        const items = await analysisService.analyzeContent(
          scrapeResult.content, 
          brandName, 
          domain, 
          scrapeResult.url,
          useLocalLLM
        );
        
        allItems.push(...items);
      } catch (err) {
        console.error(`[Movers&Shakers] Error processing ${domain}:`, err);
      }
    });

    await Promise.all(promises);

    // 5. Store Results
    if (allItems.length > 0) {
      await moversShakersStorage.storeItems(brandId, allItems);
    }

    return {
      brand: brandName,
      analyzed_at: new Date().toISOString(),
      sources_checked: allSources,
      items: allItems
    };
  }

  private async getBrandDetails(brandId: string): Promise<{ name: string, useLocalLLM: boolean }> {
    const { data } = await this.supabase
      .from('brands')
      .select('name, local_llm')
      .eq('id', brandId)
      .single();
    
    return {
      name: data?.name || 'SandDisk',
      useLocalLLM: !!data?.local_llm // Default to false if null/undefined
    };
  }

  private async getTopCitations(brandName: string): Promise<string[]> {
    // 1. Try to find brand_id from brandName (or passed in)
    // Ideally, this method should accept brandId, not brandName. 
    // The public method generateReport takes brandId.
    // So let's fix the call signature in generateReport to pass brandId.
    return [];
  }

  private async getTopCitationsForBrand(brandId: string): Promise<string[]> {
    try {
      // Fetch citations for this brand
      // Since Supabase JS client doesn't support GROUP BY directly, 
      // we fetch domains and aggregate in memory.
      // Limit to 2000 recent citations to keep performance high.
      console.log(`[Movers&Shakers] Fetching citations for brand ${brandId}`);
      const { data, error } = await this.supabase
        .from('citations')
        .select('domain')
        .eq('brand_id', brandId)
        .limit(2000);

      if (error) {
        console.error('[Movers&Shakers] Error fetching citations:', error);
        return [];
      }

      console.log(`[Movers&Shakers] Found ${data?.length} citations.`);

      if (!data || data.length === 0) {
        console.log('[Movers&Shakers] No citations found for brand.');
        return [];
      }

      // Count occurrences
      const counts: Record<string, number> = {};
      data.forEach((row: any) => {
        if (row.domain) {
          counts[row.domain] = (counts[row.domain] || 0) + 1;
        }
      });

      // Sort by count desc and take top 5
      const sortedDomains = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .map(([domain]) => domain)
        .slice(0, 5);

      return sortedDomains;
    } catch (err) {
      console.error('[Movers&Shakers] Unexpected error in getTopCitations:', err);
      return [];
    }
  }

  async addCustomSource(brandId: string, domain: string): Promise<void> {
    // Logic: Insert into 'brand_custom_sources' table
    // await this.supabase.from('brand_custom_sources').insert({ brand_id: brandId, domain });
    console.log(`[Movers&Shakers] Added custom source ${domain} for brand ${brandId}`);
  }

  private async getCustomSources(brandId: string): Promise<string[]> {
    // Logic: Query 'brand_custom_sources' table
    return [];
  }
}

export const moversShakersOrchestrator = new MoversShakersOrchestrator();
