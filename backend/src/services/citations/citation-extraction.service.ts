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
      : 1; // Reduced from 2 to 1 to avoid rate limits
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
    source?: 'hardcoded' | 'ai';
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
        source: cached.source as any
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
   * Heuristics to skip junk/non-actionable URLs before hitting LLM
   */
  private isSkippableUrl(raw: string): boolean {
    if (!raw) return true;
    const url = String(raw).trim();
    const lower = url.toLowerCase();
    // Not a URL
    if (!/^https?:\/\//i.test(url)) return true;
    // Image/CDN/favicon or thumbnail domains
    if (lower.includes('encrypted-tbn') || lower.includes('gstatic.com')) return true;
    if (/\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(lower)) return true;
    // Activity/history pages that are not sources
    if (lower.includes('myactivity.google.com')) return true;
    // Obvious trackers or redirects
    if (lower.includes('utm_') || lower.includes('doubleclick.net')) return true;
    return false;
  }

  /**
   * Extract and store citations from collector_results
   * Processes all collector_results that have citations
   */
  async extractAndStoreCitations(): Promise<{
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
      console.log('🔄 Starting citation extraction from collector_results...');

      // Fetch all collector_results with citations
      const { data: results, error } = await this.supabase
        .from('collector_results')
        .select('id, customer_id, brand_id, query_id, execution_id, citations, urls')
        .not('citations', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching collector_results:', error);
        throw error;
      }

      if (!results || results.length === 0) {
        console.log('✅ No collector_results with citations found');
        return stats;
      }

      console.log(`📊 Found ${results.length} collector_results with citations`);

      for (const result of results) {
        try {
          stats.processed++;

          // Parse citations array (can be JSONB or already parsed)
          let citations: string[] = [];
          
          if (typeof result.citations === 'string') {
            try {
              citations = JSON.parse(result.citations);
            } catch (parseError) {
              console.warn(`⚠️ Failed to parse citations JSON for result ${result.id}`);
              stats.skipped++;
              continue;
            }
          } else if (Array.isArray(result.citations)) {
            citations = result.citations;
          } else {
            // Also check urls column as fallback
            if (typeof result.urls === 'string') {
              try {
                citations = JSON.parse(result.urls);
              } catch (parseError) {
                console.warn(`⚠️ Failed to parse urls JSON for result ${result.id}`);
                stats.skipped++;
                continue;
              }
            } else if (Array.isArray(result.urls)) {
              citations = result.urls;
            } else {
              stats.skipped++;
              continue;
            }
          }

          if (!Array.isArray(citations) || citations.length === 0) {
            stats.skipped++;
            continue;
          }

          // Normalize list of URL strings
          const urlList: string[] = citations
            .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            .map((u) => u.trim())
            .filter((u) => !this.isSkippableUrl(u));

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
      .select('id, customer_id, brand_id, query_id, execution_id, citations, urls')
      .eq('id', collectorResultId)
      .single();

    if (error || !result) {
      throw new Error(`Collector result ${collectorResultId} not found`);
    }

    // Parse citations
    let citations: string[] = [];
    
    if (typeof result.citations === 'string') {
      citations = JSON.parse(result.citations);
    } else if (Array.isArray(result.citations)) {
      citations = result.citations;
    } else if (typeof result.urls === 'string') {
      citations = JSON.parse(result.urls);
    } else if (Array.isArray(result.urls)) {
      citations = result.urls;
    }

    if (citations.length === 0) {
      return 0;
    }

    // Process citations (using AI for unknown domains)
    const citationRows = await Promise.all(
      citations
        .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        .map(async (url) => {
          const processed = await citationCategorizationService.processCitation(url.trim(), true);
          
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

