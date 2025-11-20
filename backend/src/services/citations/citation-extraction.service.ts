/**
 * Citation Extraction Service
 * Extracts citations from collector_results and stores them in citations table
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { citationCategorizationService } from './citation-categorization.service';

// Load environment variables
loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

export class CitationExtractionService {
  private supabase: SupabaseClient;
  // In-memory cache for this run to avoid re-categorizing the same domain repeatedly
  private domainCategorizationCache: Map<string, {
    url: string;
    domain: string;
    pageName: string | null;
    category: string;
    confidence?: 'high' | 'medium' | 'low';
    source?: 'hardcoded' | 'ai' | 'simple_domain_matching' | 'fallback_default';
  }> = new Map();
  // Tunables (can be overridden via env)
  private readonly perResultConcurrency =
    Number.isFinite(Number(process.env.CITATIONS_CONCURRENCY))
      ? Math.max(1, Number(process.env.CITATIONS_CONCURRENCY))
      : 2; // Process 2 URLs in parallel for better performance
  private readonly interResultDelayMs =
    Number.isFinite(Number(process.env.CITATIONS_INTER_RESULT_DELAY_MS))
      ? Math.max(0, Number(process.env.CITATIONS_INTER_RESULT_DELAY_MS))
      : 500; // Increased from 300 to 500ms for better rate limit handling
  private readonly perCallBaseDelayMs =
    Number.isFinite(Number(process.env.CITATIONS_BASE_DELAY_MS))
      ? Math.max(0, Number(process.env.CITATIONS_BASE_DELAY_MS))
      : 500; // Increased from 200 to 500ms to prevent rate limits

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  /**
   * Simple concurrency runner to cap parallel LLM calls
   */
  private async runWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let inFlight = 0;
    let nextIndex = 0;
    return new Promise((resolve, reject) => {
      const launchNext = () => {
        while (inFlight < limit && nextIndex < items.length) {
          const current = nextIndex++;
          inFlight++;
          Promise.resolve(worker(items[current], current))
            .then((res) => {
              results[current] = res;
            })
            .catch((err) => {
              reject(err);
            })
            .finally(() => {
              inFlight--;
              if (results.length === items.length && nextIndex === items.length && inFlight === 0) {
                resolve(results);
              } else {
                launchNext();
              }
            });
        }
      };
      if (items.length === 0) resolve([]);
      launchNext();
    });
  }

  /**
   * Retry wrapper with exponential backoff + jitter for 429/5xx errors
   */
  private async withBackoff<R>(
    fn: () => Promise<R>,
    opts?: { retries?: number; baseMs?: number; maxMs?: number }
  ): Promise<R> {
    const retries = opts?.retries ?? 5;
    const baseMs = opts?.baseMs ?? 800;
    const maxMs = opts?.maxMs ?? 30000;
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await fn();
      } catch (error: any) {
        const msg = String(error?.message || error);
        const status = (error?.status || error?.response?.status) as number | undefined;
        const isRateLimit = msg.includes('429') || /too many requests/i.test(msg) || status === 429;
        const isServerErr = status && status >= 500;
        if (attempt >= retries || (!isRateLimit && !isServerErr)) {
          throw error;
        }
        const delay = Math.min(
          Math.round((baseMs * Math.pow(2, attempt)) * (0.8 + Math.random() * 0.4)),
          maxMs
        );
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
      }
    }
  }

  /**
   * Categorize with per-domain cache + retries
   */
  private async categorizeWithCache(url: string): Promise<{
    url: string;
    domain: string;
    pageName: string | null;
    category: string;
    confidence?: 'high' | 'medium' | 'low';
    source?: 'hardcoded' | 'ai' | 'simple_domain_matching' | 'fallback_default';
  }> {
    // Extract domain using the same categorization service helper to maximize cache hits
    const domain = citationCategorizationService.extractDomain(url);
    const cached = this.domainCategorizationCache.get(domain);
    if (cached) {
        return {
          url,
          domain: cached.domain,
          pageName: cached.pageName,
          category: cached.category,
          confidence: cached.confidence,
          source: cached.source
        };
    }
    const processed = await this.withBackoff(
      () => citationCategorizationService.processCitation(url, true),
      { retries: 5, baseMs: 700, maxMs: 20000 }
    );
    this.domainCategorizationCache.set(processed.domain, {
      url: processed.url,
      domain: processed.domain,
      pageName: processed.pageName,
      category: processed.category,
      confidence: processed.confidence,
      source: processed.source
    });
    return processed;
  }

  /**
   * Normalize URL: remove fragments, normalize protocol, remove trailing slash
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      urlObj.hash = ''; // Remove fragment
      return urlObj.toString().replace(/\/$/, ''); // Remove trailing slash
    } catch {
      return url; // Return as-is if parsing fails
    }
  }

  /**
   * Check if string looks like a domain name
   */
  private looksLikeDomain(str: string): boolean {
    // Check if string looks like a domain name (e.g., "www.uber.com", "reddit.com")
    return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(str);
  }

  /**
   * Check if string looks like a title or description (not a URL)
   */
  private looksLikeTitleOrDescription(str: string): boolean {
    // Heuristics: titles/descriptions are usually longer, contain spaces, don't have protocols
    if (str.length > 100) return true; // Likely a description
    if (str.includes(' | ') || str.includes(' - ')) return true; // Likely a title with separator
    if (!/^https?:\/\//i.test(str) && str.split(' ').length > 5) return true; // Long text without protocol
    return false;
  }

  /**
   * Extract citations from raw_answer text when citations column is empty
   * Handles markdown format: [1](url), [1]url, and plain URLs
   */
  private extractCitationsFromRawAnswer(rawAnswer: string | null | undefined): string[] {
    if (!rawAnswer || typeof rawAnswer !== 'string') {
      return [];
    }

    const urls: string[] = [];
    const text = rawAnswer.trim();
    const foundUrls = new Set<string>(); // Track found URLs to avoid duplicates

    // Pattern 1: Markdown citations [1](https://...) - highest priority
    const markdownCitationRegex = /\[(\d+)\]\((https?:\/\/[^\s\)]+)\)/gi;
    let match;
    while ((match = markdownCitationRegex.exec(text)) !== null) {
      const url = match[2].trim();
      if (url && !this.isSkippableUrl(url)) {
        const normalized = this.normalizeUrl(url);
        if (!foundUrls.has(normalized)) {
          urls.push(normalized);
          foundUrls.add(normalized);
        }
      }
    }

    // Pattern 2: Numbered citations [1]https://... or [1] https://...
    const numberedCitationRegex = /\[(\d+)\]\s*(https?:\/\/[^\s\)\]]+)/gi;
    while ((match = numberedCitationRegex.exec(text)) !== null) {
      const url = match[2].trim();
      if (url && !this.isSkippableUrl(url)) {
        const normalized = this.normalizeUrl(url);
        if (!foundUrls.has(normalized)) {
          urls.push(normalized);
          foundUrls.add(normalized);
        }
      }
    }

    // Pattern 3: Plain URLs in text (only if we haven't found many markdown citations)
    // This catches any URLs that might not be in markdown format
    // But skip if we already found markdown citations (to avoid noise)
    if (urls.length < 3) {
      const urlRegex = /https?:\/\/[^\s\)\]<>"]+/gi;
      while ((match = urlRegex.exec(text)) !== null) {
        const url = match[0].trim();
        if (url && !this.isSkippableUrl(url)) {
          const normalized = this.normalizeUrl(url);
          if (!foundUrls.has(normalized)) {
            urls.push(normalized);
            foundUrls.add(normalized);
          }
        }
      }
    }

    return urls; // Already deduplicated via Set
  }

  /**
   * Extract URLs from mixed citation array format
   * Handles: objects {url, title, domain}, URLs, domain names, filters titles/descriptions
   */
  private extractUrlsFromCitations(citations: any[]): string[] {
    const urls: string[] = [];
    
    for (const item of citations) {
      if (!item) continue;
      
      // Handle object format: {url, title, domain}
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        if (item.url) {
          const url = String(item.url).trim();
          if (url && !this.isSkippableUrl(url)) {
            urls.push(this.normalizeUrl(url));
          }
        }
        continue;
      }
      
      // Handle string format
      if (typeof item === 'string') {
        const str = item.trim();
        if (!str) continue;
        
        // Skip if it's clearly not a URL (title, description, etc.)
        if (this.looksLikeTitleOrDescription(str)) continue;
        
        // If it's a valid URL, use it
        if (/^https?:\/\//i.test(str)) {
          if (!this.isSkippableUrl(str)) {
            urls.push(this.normalizeUrl(str));
          }
          continue;
        }
        
        // If it looks like a domain name, convert to URL
        if (this.looksLikeDomain(str)) {
          const url = `https://${str}`;
          if (!this.isSkippableUrl(url)) {
            urls.push(this.normalizeUrl(url));
          }
          continue;
        }
      }
    }
    
    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Heuristics to skip junk/non-actionable URLs before hitting LLM
   */
  private isSkippableUrl(raw: string): boolean {
    if (!raw) return true;
    const url = String(raw).trim();
    const lower = url.toLowerCase();
    // Not a URL (but allow domain names that will be converted)
    if (!/^https?:\/\//i.test(url) && !this.looksLikeDomain(url)) return true;
    // Image/CDN/favicon or thumbnail domains
    if (lower.includes('encrypted-tbn') || lower.includes('gstatic.com')) return true;
    if (/\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(lower)) return true;
    // Activity/history pages that are not sources
    if (lower.includes('myactivity.google.com')) return true;
    // Obvious trackers or redirects
    if (lower.includes('utm_') || lower.includes('doubleclick.net')) return true;
    // Very long URLs (likely malformed)
    if (url.length > 500) return true;
    return false;
  }

  /**
   * Extract and store citations from collector_results
   * Processes all collector_results that have citations
   * @param brandId Optional brand ID to filter by - if provided, only processes results for that brand
   */
  async extractAndStoreCitations(brandId?: string): Promise<{
    processed: number;
    inserted: number;
    skipped: number;
    errors: number;
  }> {
    const stats = {
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      if (brandId) {
        console.log(`🔄 Starting citation extraction from collector_results for brand_id: ${brandId}...`);
      } else {
        console.log('🔄 Starting citation extraction from collector_results...');
      }

      // Fetch collector_results - include those with empty citations to extract from raw_answer
      let query = this.supabase
        .from('collector_results')
        .select('id, customer_id, brand_id, query_id, execution_id, citations, urls, raw_answer')
        .order('created_at', { ascending: false });
      
      // Filter by brand_id if provided
      if (brandId) {
        query = query.eq('brand_id', brandId);
      }

      const { data: results, error } = await query;

      if (error) {
        console.error('❌ Error fetching collector_results:', error);
        throw error;
      }

      if (!results || results.length === 0) {
        console.log('✅ No collector_results found');
        return stats;
      }

      console.log(`📊 Found ${results.length} collector_results to process`);

      for (const result of results) {
        try {
          stats.processed++;

          // Parse citations array (can be JSONB or already parsed)
          let citations: any[] = [];
          let hasCitationsInColumn = false;
          
          if (typeof result.citations === 'string') {
            try {
              const parsed = JSON.parse(result.citations);
              if (Array.isArray(parsed) && parsed.length > 0) {
                citations = parsed;
                hasCitationsInColumn = true;
              }
            } catch (parseError) {
              console.warn(`⚠️ Failed to parse citations JSON for result ${result.id}`);
            }
          } else if (Array.isArray(result.citations) && result.citations.length > 0) {
            citations = result.citations;
            hasCitationsInColumn = true;
          }

          // If citations column is empty, try urls column
          if (!hasCitationsInColumn) {
            if (typeof result.urls === 'string') {
              try {
                const parsed = JSON.parse(result.urls);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  citations = parsed;
                  hasCitationsInColumn = true;
                }
              } catch (parseError) {
                console.warn(`⚠️ Failed to parse urls JSON for result ${result.id}`);
              }
            } else if (Array.isArray(result.urls) && result.urls.length > 0) {
              citations = result.urls;
              hasCitationsInColumn = true;
            }
          }

          // Extract URLs from citations array if available
          let urlList: string[] = [];
          if (hasCitationsInColumn && citations.length > 0) {
            // Extract URLs from mixed citation array format
            urlList = this.extractUrlsFromCitations(citations);
          }

          // If no URLs found in citations/urls columns, extract from raw_answer text
          if (urlList.length === 0 && result.raw_answer) {
            console.log(`📝 No citations in column for result ${result.id}, extracting from raw_answer text...`);
            urlList = this.extractCitationsFromRawAnswer(result.raw_answer);
            if (urlList.length > 0) {
              console.log(`✅ Extracted ${urlList.length} URLs from raw_answer text for result ${result.id}`);
            }
          }

          if (urlList.length === 0) {
            stats.skipped++;
            continue;
          }

          // Limit per-result concurrency to avoid provider 429s
          // Tuneable via env if needed later
          const PER_RESULT_CONCURRENCY = this.perResultConcurrency;

          const citationRows = await this.runWithConcurrency<string, {
            customer_id: string;
            brand_id: string;
            query_id: string | null;
            execution_id: string | null;
            collector_result_id: number;
            url: string;
            domain: string;
            page_name: string | null;
            category: string;
            metadata: Record<string, any>;
          }>(
            urlList,
            PER_RESULT_CONCURRENCY,
            async (url) => {
              try {
                // Small base delay between calls to smooth bursts
                if (this.perCallBaseDelayMs > 0) {
                  await new Promise((r) => setTimeout(r, this.perCallBaseDelayMs));
                }
                const processed = await this.categorizeWithCache(url);
                return {
                  customer_id: result.customer_id,
                  brand_id: result.brand_id,
                  query_id: result.query_id,
                  execution_id: result.execution_id,
                  collector_result_id: result.id,
                  url: processed.url,
                  domain: processed.domain,
                  page_name: processed.pageName,
                  category: processed.category,
                  metadata: {
                    categorization_confidence: processed.confidence,
                    categorization_source: processed.source,
                  }
                };
              } catch (e: any) {
                // Surface but do not crash the whole batch; mark as skipped by throwing to be filtered
                console.warn(`⚠️ Failed to categorize ${url}:`, e?.message || e);
                // Return a special marker to be filtered out
                return {
                  customer_id: result.customer_id,
                  brand_id: result.brand_id,
                  query_id: result.query_id,
                  execution_id: result.execution_id,
                  collector_result_id: result.id,
                  url,
                  domain: citationCategorizationService.extractDomain(url),
                  page_name: null,
                  category: 'unknown',
                  metadata: { categorization_source: 'failed' }
                };
              }
            }
          );

          if (citationRows.length === 0) {
            stats.skipped++;
            continue;
          }

          // Remove duplicate URLs within the same batch (for same collector_result_id)
          const uniqueCitationRows = citationRows.reduce((acc, row) => {
            const key = `${row.collector_result_id}-${row.url}`;
            // Filter out failed rows marked as unknown
            if (row.category === 'unknown') {
              return acc;
            }
            if (!acc.has(key)) {
              acc.set(key, row);
            }
            return acc;
          }, new Map<string, typeof citationRows[0]>());

          const uniqueRows = Array.from(uniqueCitationRows.values());

          if (uniqueRows.length === 0) {
            stats.skipped++;
            continue;
          }

          // Validate brand_id exists before inserting (prevent foreign key violations)
          if (result.brand_id) {
            const { data: brandExists, error: brandCheckError } = await this.supabase
              .from('brands')
              .select('id')
              .eq('id', result.brand_id)
              .maybeSingle();

            if (brandCheckError) {
              console.warn(`⚠️ Error checking brand existence for result ${result.id}:`, brandCheckError.message);
              stats.errors++;
              continue;
            }

            if (!brandExists) {
              console.warn(`⚠️ Brand ${result.brand_id} does not exist, skipping citations for result ${result.id}`);
              stats.skipped++;
              continue;
            }
          }

          // Insert citations (using upsert to avoid duplicates)
          const { error: insertError } = await this.supabase
            .from('citations')
            .upsert(uniqueRows, {
              onConflict: 'collector_result_id,url',
              ignoreDuplicates: false, // Update if exists
            });

          if (insertError) {
            // Check if it's a foreign key constraint error
            if (insertError.code === '23503') {
              console.warn(`⚠️ Foreign key constraint violation for result ${result.id} (brand_id may not exist):`, insertError.message);
              stats.skipped++;
            } else {
              console.error(`❌ Error inserting citations for result ${result.id}:`, insertError);
              stats.errors++;
            }
          } else {
            stats.inserted += uniqueRows.length;
            console.log(`✅ Inserted ${uniqueRows.length} citations for result ${result.id}`);
          }

          // Gentle delay between results to prevent continuous pressure
          if (this.interResultDelayMs > 0) {
            await new Promise((r) => setTimeout(r, this.interResultDelayMs));
          }

        } catch (resultError: any) {
          console.error(`❌ Error processing result ${result.id}:`, resultError.message);
          stats.errors++;
        }
      }

      console.log(`✅ Citation extraction complete: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors`);

      return stats;

    } catch (error: any) {
      console.error('❌ Citation extraction service error:', error);
      throw error;
    }
  }

  /**
   * Extract citations for a specific collector_result
   */
  async extractCitationsForResult(collectorResultId: string | number): Promise<number> {
    const { data: result, error } = await this.supabase
      .from('collector_results')
      .select('id, customer_id, brand_id, query_id, execution_id, citations, urls, raw_answer')
      .eq('id', collectorResultId)
      .single();

    if (error || !result) {
      throw new Error(`Collector result ${collectorResultId} not found`);
    }

    // Parse citations array (can be JSONB or already parsed)
    let citations: any[] = [];
    let hasCitationsInColumn = false;
    
    if (typeof result.citations === 'string') {
      try {
        const parsed = JSON.parse(result.citations);
        if (Array.isArray(parsed) && parsed.length > 0) {
          citations = parsed;
          hasCitationsInColumn = true;
        }
      } catch (parseError) {
        throw new Error(`Failed to parse citations JSON for result ${collectorResultId}`);
      }
    } else if (Array.isArray(result.citations) && result.citations.length > 0) {
      citations = result.citations;
      hasCitationsInColumn = true;
    }

    // If citations column is empty, try urls column
    if (!hasCitationsInColumn) {
      if (typeof result.urls === 'string') {
        try {
          const parsed = JSON.parse(result.urls);
          if (Array.isArray(parsed) && parsed.length > 0) {
            citations = parsed;
            hasCitationsInColumn = true;
          }
        } catch (parseError) {
          throw new Error(`Failed to parse urls JSON for result ${collectorResultId}`);
        }
      } else if (Array.isArray(result.urls) && result.urls.length > 0) {
        citations = result.urls;
        hasCitationsInColumn = true;
      }
    }

    // Extract URLs from citations array if available
    let urlList: string[] = [];
    if (hasCitationsInColumn && citations.length > 0) {
      urlList = this.extractUrlsFromCitations(citations);
    }

    // If no URLs found in citations/urls columns, extract from raw_answer text
    if (urlList.length === 0 && result.raw_answer) {
      console.log(`📝 No citations in column for result ${collectorResultId}, extracting from raw_answer text...`);
      urlList = this.extractCitationsFromRawAnswer(result.raw_answer);
      if (urlList.length > 0) {
        console.log(`✅ Extracted ${urlList.length} URLs from raw_answer text for result ${collectorResultId}`);
      }
    }

    if (urlList.length === 0) {
      return 0;
    }

    // Process citations (using AI for unknown domains)
    const citationRows = await Promise.all(
      urlList.map(async (url) => {
        const processed = await citationCategorizationService.processCitation(url, true);
          
          return {
            customer_id: result.customer_id,
            brand_id: result.brand_id,
            query_id: result.query_id, // Direct reference to generated_queries.id
            execution_id: result.execution_id,
            collector_result_id: result.id,
            url: processed.url,
            domain: processed.domain,
            page_name: processed.pageName,
            category: processed.category,
            metadata: {
              categorization_confidence: processed.confidence,
              categorization_source: processed.source,
            }
          };
        })
    );

    // Remove duplicate URLs within the same batch
    const uniqueCitationRows = citationRows.reduce((acc, row) => {
      const key = `${row.collector_result_id}-${row.url}`;
      if (!acc.has(key)) {
        acc.set(key, row);
      }
      return acc;
    }, new Map<string, typeof citationRows[0]>());

    const uniqueRows = Array.from(uniqueCitationRows.values());

    if (uniqueRows.length === 0) {
      return 0;
    }

    // Validate brand_id exists before inserting (prevent foreign key violations)
    if (result.brand_id) {
      const { data: brandExists, error: brandCheckError } = await this.supabase
        .from('brands')
        .select('id')
        .eq('id', result.brand_id)
        .maybeSingle();

      if (brandCheckError) {
        throw new Error(`Error checking brand existence: ${brandCheckError.message}`);
      }

      if (!brandExists) {
        throw new Error(`Brand ${result.brand_id} does not exist, cannot insert citations`);
      }
    }

    // Insert citations
    const { error: insertError } = await this.supabase
      .from('citations')
      .upsert(uniqueRows, {
        onConflict: 'collector_result_id,url',
        ignoreDuplicates: false,
      });

    if (insertError) {
      if (insertError.code === '23503') {
        throw new Error(`Foreign key constraint violation: brand_id ${result.brand_id} does not exist`);
      }
      throw insertError;
    }

    return uniqueRows.length;
  }
}

export const citationExtractionService = new CitationExtractionService();

