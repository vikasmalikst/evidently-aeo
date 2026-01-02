import { webUnlockerService } from './web-unlocker.service';

type SiteSearchScrapeResult = {
  domain: string;
  brand: string;
  url: string;
  content?: string;
  error?: string;
  service: 'WebUnlockerService';
};

export class SiteSearchService {
  
  private generateSearchUrl(domain: string, brand: string, hours: number = 48): string {
    const cleanDomain = domain.replace(/\/$/, '').replace(/^https?:\/\//, '');
    
    // Time filter logic
    // For many sites, there isn't a standard URL param for time.
    // However, if we are searching via Google "site:domain brand", we can use tbs=qdr:d (24h) or qdr:w (week)
    // Here we try to construct a site-specific search URL.
    
    if (cleanDomain.includes('techradar.com')) {
      // TechRadar uses /search?searchTerm=...
      // It doesn't seem to have a clear URL param for time in the basic search.
      return `https://${cleanDomain}/search?searchTerm=${encodeURIComponent(brand)}`;
    }
    
    if (cleanDomain.includes('reddit.com')) {
        // Reddit: /search/?q=brand&t=week
        const timeFilter = hours <= 24 ? 'day' : 'week';
        return `https://www.reddit.com/search/?q=${encodeURIComponent(brand)}&t=${timeFilter}`;
    }

    if (cleanDomain.includes('youtube.com')) {
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(brand)}`;
    }

    // Generic fallback
    return `https://${cleanDomain}/search?q=${encodeURIComponent(brand)}`;
  }

  /**
   * Main entry point: Search a site for a brand and scrape the results.
   * Intelligently routes to specific services for Social Media.
   */
  async searchAndScrape(domain: string, brand: string, hours: number = 48): Promise<SiteSearchScrapeResult> {
    const searchUrl = this.generateSearchUrl(domain, brand, hours);
    console.log(`[SiteSearch] Searching site: ${searchUrl}`);
    
    try {
        const markdown = await webUnlockerService.scrapeUrl(searchUrl, 'markdown');
        return {
            domain: domain,
            brand: brand,
            url: searchUrl,
            content: markdown,
            service: 'WebUnlockerService'
        };
    } catch (error: any) {
        console.error(`[SiteSearch] Failed to scrape ${domain}:`, error.message);
        return {
            domain: domain,
            brand: brand,
            url: searchUrl,
            error: error.message,
            service: 'WebUnlockerService'
        };
    }
  }
}

export const siteSearchService = new SiteSearchService();
