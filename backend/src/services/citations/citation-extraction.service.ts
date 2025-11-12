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

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
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

          // Process each citation (using AI for unknown domains)
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

          if (citationRows.length === 0) {
            stats.skipped++;
            continue;
          }

          // Remove duplicate URLs within the same batch (for same collector_result_id)
          const uniqueCitationRows = citationRows.reduce((acc, row) => {
            const key = `${row.collector_result_id}-${row.url}`;
            if (!acc.has(key)) {
              acc.set(key, row);
            }
            return acc;
          }, new Map<string, typeof citationRows[0]>());

          const uniqueRows = Array.from(uniqueCitationRows.values());

          // Insert citations (using upsert to avoid duplicates)
          const { error: insertError } = await this.supabase
            .from('citations')
            .upsert(uniqueRows, {
              onConflict: 'collector_result_id,url',
              ignoreDuplicates: false, // Update if exists
            });

          if (insertError) {
            console.error(`❌ Error inserting citations for result ${result.id}:`, insertError);
            stats.errors++;
          } else {
            stats.inserted += uniqueRows.length;
            console.log(`✅ Inserted ${uniqueRows.length} citations for result ${result.id}`);
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

    // Insert citations
    const { error: insertError } = await this.supabase
      .from('citations')
      .upsert(uniqueRows, {
        onConflict: 'collector_result_id,url',
        ignoreDuplicates: false,
      });

    if (insertError) {
      throw insertError;
    }

    return uniqueRows.length;
  }
}

export const citationExtractionService = new CitationExtractionService();

