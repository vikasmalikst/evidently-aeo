/**
 * Optimized Metrics Helper
 * 
 * Reusable query helpers for fetching metrics from the new optimized schema.
 * Provides consistent, performant patterns for all services.
 * 
 * Schema Structure:
 * - metric_facts: Core reference table (collector_result_id, brand_id, etc.)
 * - brand_metrics: Brand visibility/presence metrics
 * - competitor_metrics: Competitor visibility metrics
 * - brand_sentiment: Brand sentiment data
 * - competitor_sentiment: Competitor sentiment data
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  BrandMetricsRow,
  CompetitorMetricsRow,
  CombinedMetricsResult,
  FetchMetricsOptions,
  FetchMetricsByDateRangeOptions,
  FetchBrandMetricsResult,
  FetchCompetitorMetricsResult,
  FetchCombinedMetricsResult,
  TopicMetricsAggregated,
  QueryPerformanceMetrics,
} from '../../types/optimized-metrics.types';

export class OptimizedMetricsHelper {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Fetch brand metrics for specific collector_results
   * 
   * Returns brand-level data (visibility, share, presence, sentiment)
   * Optimized for new schema with single query + joins
   * 
   * @param options - Fetch options including collector_result IDs
   * @returns Brand metrics rows
   */
  async fetchBrandMetrics(options: FetchMetricsOptions): Promise<FetchBrandMetricsResult> {
    const startTime = Date.now();
    
    try {
      const {
        collectorResultIds,
        brandId,
        customerId,
        includeSentiment = true,
      } = options;

      if (!collectorResultIds || collectorResultIds.length === 0) {
        return {
          success: true,
          data: [],
          duration_ms: Date.now() - startTime,
        };
      }

      // Build query with joins
      // Note: Using Supabase's nested select syntax for joins
      let query = this.supabase
        .from('metric_facts')
        .select(`
          collector_result_id,
          brand_id,
          customer_id,
          query_id,
          collector_type,
          topic,
          processed_at,
          created_at,
          brand_metrics!inner(
            visibility_index,
            share_of_answers,
            total_brand_mentions,
            has_brand_presence,
            brand_positions,
            brand_first_position,
            total_word_count
          )
          ${includeSentiment ? `,brand_sentiment(
            sentiment_score,
            sentiment_label,
            positive_sentences,
            negative_sentences
          )` : ''}
        `)
        .in('collector_result_id', collectorResultIds);

      // Apply optional filters
      if (brandId) {
        query = query.eq('brand_id', brandId);
      }
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[OptimizedMetricsHelper] Error fetching brand metrics:', error);
        return {
          success: false,
          data: [],
          error: error.message,
          duration_ms: Date.now() - startTime,
        };
      }

      // Flatten nested structure
      const flattenedData: BrandMetricsRow[] = (data || []).map((row: any) => {
        const brandMetrics = Array.isArray(row.brand_metrics) 
          ? row.brand_metrics[0] 
          : row.brand_metrics;
        
        const brandSentiment = Array.isArray(row.brand_sentiment)
          ? row.brand_sentiment[0]
          : row.brand_sentiment;

        return {
          // metric_facts fields
          collector_result_id: row.collector_result_id,
          brand_id: row.brand_id,
          customer_id: row.customer_id,
          query_id: row.query_id,
          collector_type: row.collector_type,
          topic: row.topic,
          processed_at: row.processed_at,
          created_at: row.created_at,
          
          // brand_metrics fields
          visibility_index: brandMetrics?.visibility_index || null,
          share_of_answers: brandMetrics?.share_of_answers || null,
          total_brand_mentions: brandMetrics?.total_brand_mentions || 0,
          has_brand_presence: brandMetrics?.has_brand_presence || false,
          brand_positions: brandMetrics?.brand_positions || [],
          brand_first_position: brandMetrics?.brand_first_position || null,
          total_word_count: brandMetrics?.total_word_count || 0,
          
          // brand_sentiment fields (if included)
          ...(includeSentiment && brandSentiment ? {
            sentiment_score: brandSentiment.sentiment_score,
            sentiment_label: brandSentiment.sentiment_label,
            positive_sentences: brandSentiment.positive_sentences || [],
            negative_sentences: brandSentiment.negative_sentences || [],
          } : {}),
        };
      });

      return {
        success: true,
        data: flattenedData,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[OptimizedMetricsHelper] Unexpected error in fetchBrandMetrics:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Fetch competitor metrics for specific collector_results
   * 
   * Returns competitor-level data for all competitors
   * One row per competitor per collector_result
   * 
   * @param options - Fetch options including collector_result IDs
   * @returns Competitor metrics rows
   */
  async fetchCompetitorMetrics(options: FetchMetricsOptions): Promise<FetchCompetitorMetricsResult> {
    const startTime = Date.now();
    
    try {
      const {
        collectorResultIds,
        brandId,
        customerId,
        includeSentiment = true,
      } = options;

      if (!collectorResultIds || collectorResultIds.length === 0) {
        return {
          success: true,
          data: [],
          duration_ms: Date.now() - startTime,
        };
      }

      // Build query with joins
      let query = this.supabase
        .from('metric_facts')
        .select(`
          collector_result_id,
          brand_id,
          customer_id,
          query_id,
          collector_type,
          topic,
          processed_at,
          created_at,
          competitor_metrics!inner(
            competitor_id,
            visibility_index,
            share_of_answers,
            competitor_mentions,
            competitor_positions,
            brand_competitors!inner(
              competitor_name
            )
          )
          ${includeSentiment ? `,competitor_sentiment(
            competitor_id,
            sentiment_score,
            sentiment_label,
            positive_sentences,
            negative_sentences
          )` : ''}
        `)
        .in('collector_result_id', collectorResultIds);

      // Apply optional filters
      if (brandId) {
        query = query.eq('brand_id', brandId);
      }
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[OptimizedMetricsHelper] Error fetching competitor metrics:', error);
        return {
          success: false,
          data: [],
          error: error.message,
          duration_ms: Date.now() - startTime,
        };
      }

      // Flatten nested structure
      // Note: metric_facts can have multiple competitor_metrics rows
      const flattenedData: CompetitorMetricsRow[] = [];
      
      (data || []).forEach((row: any) => {
        const competitorMetricsList = Array.isArray(row.competitor_metrics)
          ? row.competitor_metrics
          : [row.competitor_metrics];
        
        const competitorSentimentList = Array.isArray(row.competitor_sentiment)
          ? row.competitor_sentiment
          : (row.competitor_sentiment ? [row.competitor_sentiment] : []);

        competitorMetricsList.forEach((cm: any) => {
          if (!cm) return;
          
          const competitorName = cm.brand_competitors?.competitor_name || 'Unknown';
          
          // Find matching sentiment
          const sentiment = competitorSentimentList.find(
            (cs: any) => cs.competitor_id === cm.competitor_id
          );

          flattenedData.push({
            // metric_facts fields
            collector_result_id: row.collector_result_id,
            brand_id: row.brand_id,
            customer_id: row.customer_id,
            query_id: row.query_id,
            collector_type: row.collector_type,
            topic: row.topic,
            processed_at: row.processed_at,
            created_at: row.created_at,
            
            // Competitor identification
            competitor_id: cm.competitor_id,
            competitor_name: competitorName,
            
            // competitor_metrics fields
            visibility_index: cm.visibility_index || null,
            share_of_answers: cm.share_of_answers || null,
            competitor_mentions: cm.competitor_mentions || 0,
            competitor_positions: cm.competitor_positions || [],
            
            // competitor_sentiment fields (if included)
            ...(includeSentiment && sentiment ? {
              sentiment_score: sentiment.sentiment_score,
              sentiment_label: sentiment.sentiment_label,
              positive_sentences: sentiment.positive_sentences || [],
              negative_sentences: sentiment.negative_sentences || [],
            } : {}),
          });
        });
      });

      return {
        success: true,
        data: flattenedData,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[OptimizedMetricsHelper] Unexpected error in fetchCompetitorMetrics:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Fetch combined metrics (brand + competitors) for collector_results
   * 
   * Efficient way to fetch all data in parallel
   * 
   * @param options - Fetch options
   * @returns Combined brand and competitor metrics
   */
  async fetchCombinedMetrics(options: FetchMetricsOptions): Promise<FetchCombinedMetricsResult> {
    const startTime = Date.now();
    
    try {
      // Fetch brand and competitor metrics in parallel
      const [brandResult, competitorResult] = await Promise.all([
        this.fetchBrandMetrics(options),
        this.fetchCompetitorMetrics(options),
      ]);

      // Check for errors
      if (!brandResult.success) {
        return {
          success: false,
          data: { brand: [], competitors: [] },
          error: `Brand metrics error: ${brandResult.error}`,
          duration_ms: Date.now() - startTime,
        };
      }

      if (!competitorResult.success) {
        return {
          success: false,
          data: { brand: brandResult.data, competitors: [] },
          error: `Competitor metrics error: ${competitorResult.error}`,
          duration_ms: Date.now() - startTime,
        };
      }

      return {
        success: true,
        data: {
          brand: brandResult.data,
          competitors: competitorResult.data,
        },
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[OptimizedMetricsHelper] Unexpected error in fetchCombinedMetrics:', error);
      return {
        success: false,
        data: { brand: [], competitors: [] },
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Get distinct collector_types for a brand in a date range
   * 
   * Used for filter dropdowns (e.g., "Show data for ChatGPT only")
   * Optimized query on metric_facts
   * 
   * @param brandId - Brand ID
   * @param customerId - Customer ID
   * @param startDate - Start date (ISO format)
   * @param endDate - End date (ISO format)
   * @returns Array of unique collector_types
   */
  async getDistinctCollectorTypes(
    brandId: string,
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('metric_facts')
        .select('collector_type')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('processed_at', startDate)
        .lte('processed_at', endDate)
        .not('collector_type', 'is', null);

      if (error) {
        console.error('[OptimizedMetricsHelper] Error fetching distinct collector_types:', error);
        return [];
      }

      // Return unique values
      const uniqueTypes = [...new Set((data || []).map(d => d.collector_type))];
      return uniqueTypes.filter(Boolean);
    } catch (error) {
      console.error('[OptimizedMetricsHelper] Unexpected error in getDistinctCollectorTypes:', error);
      return [];
    }
  }

  /**
   * Fetch brand metrics by date range (instead of collector_result IDs)
   * 
   * Useful when you don't have collector_result IDs yet
   * 
   * @param options - Date range and filters
   * @returns Brand metrics rows
   */
  async fetchBrandMetricsByDateRange(
    options: FetchMetricsByDateRangeOptions
  ): Promise<FetchBrandMetricsResult> {
    const startTime = Date.now();
    
    try {
      const {
        brandId,
        customerId,
        startDate,
        endDate,
        collectorTypes,
        topics,
        includeSentiment = true,
      } = options;

      // Build query
      let query = this.supabase
        .from('metric_facts')
        .select(`
          collector_result_id,
          brand_id,
          customer_id,
          query_id,
          collector_type,
          topic,
          processed_at,
          created_at,
          brand_metrics!inner(
            visibility_index,
            share_of_answers,
            total_brand_mentions,
            has_brand_presence,
            brand_positions,
            brand_first_position,
            total_word_count
          )
          ${includeSentiment ? `,brand_sentiment(
            sentiment_score,
            sentiment_label,
            positive_sentences,
            negative_sentences
          )` : ''}
        `)
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('processed_at', startDate)
        .lte('processed_at', endDate);

      // Apply optional filters
      if (collectorTypes && collectorTypes.length > 0) {
        if (collectorTypes.length === 1) {
          query = query.eq('collector_type', collectorTypes[0]);
        } else {
          query = query.in('collector_type', collectorTypes);
        }
      }

      if (topics && topics.length > 0) {
        query = query.in('topic', topics);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[OptimizedMetricsHelper] Error fetching brand metrics by date range:', error);
        return {
          success: false,
          data: [],
          error: error.message,
          duration_ms: Date.now() - startTime,
        };
      }

      // Flatten nested structure (same as fetchBrandMetrics)
      const flattenedData: BrandMetricsRow[] = (data || []).map((row: any) => {
        const brandMetrics = Array.isArray(row.brand_metrics) 
          ? row.brand_metrics[0] 
          : row.brand_metrics;
        
        const brandSentiment = Array.isArray(row.brand_sentiment)
          ? row.brand_sentiment[0]
          : row.brand_sentiment;

        return {
          collector_result_id: row.collector_result_id,
          brand_id: row.brand_id,
          customer_id: row.customer_id,
          query_id: row.query_id,
          collector_type: row.collector_type,
          topic: row.topic,
          processed_at: row.processed_at,
          created_at: row.created_at,
          visibility_index: brandMetrics?.visibility_index || null,
          share_of_answers: brandMetrics?.share_of_answers || null,
          total_brand_mentions: brandMetrics?.total_brand_mentions || 0,
          has_brand_presence: brandMetrics?.has_brand_presence || false,
          brand_positions: brandMetrics?.brand_positions || [],
          brand_first_position: brandMetrics?.brand_first_position || null,
          total_word_count: brandMetrics?.total_word_count || 0,
          ...(includeSentiment && brandSentiment ? {
            sentiment_score: brandSentiment.sentiment_score,
            sentiment_label: brandSentiment.sentiment_label,
            positive_sentences: brandSentiment.positive_sentences || [],
            negative_sentences: brandSentiment.negative_sentences || [],
          } : {}),
        };
      });

      return {
        success: true,
        data: flattenedData,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[OptimizedMetricsHelper] Unexpected error in fetchBrandMetricsByDateRange:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Fetch source attribution metrics (share, mentions, sentiment, visibility)
   * Optimized query for source attribution service
   * 
   * @param options - Query options
   * @returns Source attribution metrics with all required fields
   */
  async fetchSourceAttributionMetrics(options: {
    collectorResultIds: number[];
    brandId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    data: Array<{
      collector_result_id: number;
      share_of_answers_brand: number | null;
      total_brand_mentions: number;
      sentiment_score: number | null;
      visibility_index: number | null;
      competitor_name: string | null;
      topic: string | null;
      processed_at: string;
      metadata?: any;
    }>;
    error?: string;
    duration_ms: number;
  }> {
    const startTime = Date.now();
    const { collectorResultIds, brandId, startDate, endDate } = options;

    if (collectorResultIds.length === 0) {
      return {
        success: true,
        data: [],
        duration_ms: Date.now() - startTime,
      };
    }

    try {
      // Build query: metric_facts with joins to brand_metrics, brand_sentiment, and competitor_metrics
      let query = this.supabase
        .from('metric_facts')
        .select(`
          collector_result_id,
          brand_id,
          topic,
          processed_at,
          created_at,
          brand_metrics!inner(
            share_of_answers,
            total_brand_mentions,
            visibility_index
          ),
          brand_sentiment(
            sentiment_score
          ),
          competitor_metrics(
            competitor_id,
            share_of_answers,
            visibility_index,
            brand_competitors!inner(
              name
            )
          )
        `)
        .in('collector_result_id', collectorResultIds)
        .eq('brand_id', brandId);

      // Add date filters if provided
      if (startDate) {
        query = query.gte('processed_at', startDate);
      }
      if (endDate) {
        query = query.lte('processed_at', endDate);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          data: [],
          error: error.message,
          duration_ms: Date.now() - startTime,
        };
      }

      // Transform results to match legacy format
      const transformed: Array<{
        collector_result_id: number;
        share_of_answers_brand: number | null;
        total_brand_mentions: number;
        sentiment_score: number | null;
        visibility_index: number | null;
        competitor_name: string | null;
        topic: string | null;
        processed_at: string;
        metadata?: any;
      }> = [];

      // Process brand rows (from brand_metrics join)
      if (data) {
        for (const row of data) {
          const bm = Array.isArray(row.brand_metrics) ? row.brand_metrics[0] : row.brand_metrics;
          const bs = Array.isArray(row.brand_sentiment) ? row.brand_sentiment[0] : row.brand_sentiment;
          const cm = Array.isArray(row.competitor_metrics) ? row.competitor_metrics : [];

          if (bm) {
            // Brand row
            transformed.push({
              collector_result_id: row.collector_result_id,
              share_of_answers_brand: bm.share_of_answers,
              total_brand_mentions: bm.total_brand_mentions || 0,
              sentiment_score: bs?.sentiment_score || null,
              visibility_index: bm.visibility_index,
              competitor_name: null,
              topic: row.topic,
              processed_at: row.processed_at,
            });
          }

          // Competitor rows (if any)
          for (const comp of cm) {
            const competitor = Array.isArray(comp.brand_competitors) 
              ? comp.brand_competitors[0] 
              : comp.brand_competitors;
            
            if (competitor) {
              // Access competitor_metrics fields (now properly selected in query)
              const compAny = comp as any; // TypeScript doesn't infer nested select types perfectly
              transformed.push({
                collector_result_id: row.collector_result_id,
                share_of_answers_brand: compAny.share_of_answers || null, // Competitor share
                total_brand_mentions: 0, // Competitors don't have brand mentions
                sentiment_score: null, // Competitor sentiment would be in competitor_sentiment table
                visibility_index: compAny.visibility_index || null, // Competitor visibility
                competitor_name: competitor.name,
                topic: row.topic,
                processed_at: row.processed_at,
              });
            }
          }
        }
      }

      return {
        success: true,
        data: transformed,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Log query performance for monitoring
   * 
   * @param metrics - Performance metrics to log
   */
  logQueryPerformance(metrics: QueryPerformanceMetrics): void {
    console.log('[OptimizedMetricsHelper] Query Performance:', {
      query_type: metrics.query_type,
      duration_ms: metrics.duration_ms,
      rows_returned: metrics.rows_returned,
      success: metrics.success,
      error: metrics.error,
    });
  }
}

/**
 * Create a singleton instance for reuse
 * Import this in services that need optimized queries
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase credentials for OptimizedMetricsHelper');
}

const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

export const optimizedMetricsHelper = new OptimizedMetricsHelper(supabaseClient);

