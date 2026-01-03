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
          visibility_index: brandMetrics?.visibility_index ?? null,
          share_of_answers: brandMetrics?.share_of_answers ?? null,
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
            visibility_index: cm.visibility_index ?? null,
            share_of_answers: cm.share_of_answers ?? null,
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
          visibility_index: brandMetrics?.visibility_index ?? null,
          share_of_answers: brandMetrics?.share_of_answers ?? null,
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
   * Fetch competitor metrics by date range
   * Similar to fetchBrandMetricsByDateRange but for competitors
   * 
   * @param options - Fetch options including competitor ID
   * @returns Competitor metrics rows
   */
  async fetchCompetitorMetricsByDateRange(options: {
    competitorId: string;
    brandId: string;
    customerId: string;
    startDate: string;
    endDate: string;
    includeSentiment?: boolean;
  }): Promise<FetchCompetitorMetricsResult> {
    const startTime = Date.now();
    
    try {
      const {
        competitorId,
        brandId,
        customerId,
        startDate,
        endDate,
        includeSentiment = true,
      } = options;

      // Build query - query metric_facts and join competitor_metrics filtered by competitor_id
      // Query competitor_metrics directly and join with metric_facts for date filtering
      let query = this.supabase
        .from('competitor_metrics')
        .select(`
          metric_fact_id,
          competitor_id,
          visibility_index,
          share_of_answers,
          competitor_mentions,
          competitor_positions,
          metric_facts!inner(
            collector_result_id,
            brand_id,
            customer_id,
            query_id,
            collector_type,
            topic,
            processed_at,
            created_at
          )
          ${includeSentiment ? `,competitor_sentiment(
            sentiment_score,
            sentiment_label
          )` : ''}
        `)
        .eq('competitor_id', competitorId)
        .eq('metric_facts.brand_id', brandId)
        .eq('metric_facts.customer_id', customerId)
        .gte('metric_facts.processed_at', startDate)
        .lte('metric_facts.processed_at', endDate);

      const { data, error } = await query;

      if (error) {
        console.error('[OptimizedMetricsHelper] Error fetching competitor metrics by date range:', error);
        return {
          success: false,
          data: [],
          error: error.message,
          duration_ms: Date.now() - startTime,
        };
      }

      // Flatten nested structure
      const flattenedData: CompetitorMetricsRow[] = (data || []).map((row: any) => {
        const metricFact = Array.isArray(row.metric_facts) 
          ? row.metric_facts[0] 
          : row.metric_facts;
        
        const competitorSentiment = Array.isArray(row.competitor_sentiment)
          ? row.competitor_sentiment[0]
          : row.competitor_sentiment;

        return {
          collector_result_id: metricFact?.collector_result_id || null,
          brand_id: metricFact?.brand_id || null,
          customer_id: metricFact?.customer_id || null,
          query_id: metricFact?.query_id || null,
          collector_type: metricFact?.collector_type || null,
          topic: metricFact?.topic || null,
          processed_at: metricFact?.processed_at || null,
          created_at: metricFact?.created_at || null,
          competitor_id: competitorId,
          competitor_name: null, // Will be populated from brand_competitors if needed
          visibility_index: row.visibility_index ?? null,
          share_of_answers: row.share_of_answers ?? null,
          competitor_mentions: row.competitor_mentions || 0,
          competitor_positions: row.competitor_positions || [],
          ...(includeSentiment && competitorSentiment ? {
            sentiment_score: competitorSentiment.sentiment_score,
            sentiment_label: competitorSentiment.sentiment_label,
          } : {}),
        };
      });

      return {
        success: true,
        data: flattenedData,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[OptimizedMetricsHelper] Unexpected error in fetchCompetitorMetricsByDateRange:', error);
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
              competitor_name
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

      console.log(`   🔍 [fetchSourceAttributionMetrics] Query params:`, {
        collectorResultIds: collectorResultIds.length,
        brandId,
        startDate,
        endDate,
      });

      if (error) {
        console.error(`   ❌ [fetchSourceAttributionMetrics] Query error:`, error);
        return {
          success: false,
          data: [],
          error: error.message,
          duration_ms: Date.now() - startTime,
        };
      }

      console.log(`   📊 [fetchSourceAttributionMetrics] Raw query result: ${data?.length || 0} rows`);

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
                share_of_answers_brand: compAny.share_of_answers ?? null, // Competitor share
                total_brand_mentions: 0, // Competitors don't have brand mentions
                sentiment_score: null, // Competitor sentiment would be in competitor_sentiment table
                visibility_index: compAny.visibility_index ?? null, // Competitor visibility
                competitor_name: competitor.competitor_name,
                topic: row.topic,
                processed_at: row.processed_at,
              });
            }
          }
        }
      }

      console.log(`   ✅ [fetchSourceAttributionMetrics] Transformed: ${transformed.length} rows`);
      if (transformed.length > 0) {
        console.log(`   📝 [fetchSourceAttributionMetrics] Sample row:`, {
          collector_result_id: transformed[0].collector_result_id,
          share_of_answers_brand: transformed[0].share_of_answers_brand,
          total_brand_mentions: transformed[0].total_brand_mentions,
          sentiment_score: transformed[0].sentiment_score,
          visibility_index: transformed[0].visibility_index,
        });
      }

      return {
        success: true,
        data: transformed,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`   ❌ [fetchSourceAttributionMetrics] Exception:`, error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Fetch distinct collector types (models) for a brand in a date range
   * Used by Topics page to populate "Available Models" filter
   * 
   * @param options - Query options
   * @returns Set of distinct collector types
   */
  async fetchDistinctCollectorTypes(options: {
    brandId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    data: Set<string>;
    duration_ms: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const { brandId, startDate, endDate } = options;

    try {
      let query = this.supabase
        .from('metric_facts')
        .select('collector_type')
        .eq('brand_id', brandId)
        .not('collector_type', 'is', null);

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
          data: new Set(),
          duration_ms: Date.now() - startTime,
          error: error.message,
        };
      }

      const collectorTypes = new Set<string>();
      (data || []).forEach((row: any) => {
        if (row.collector_type) {
          collectorTypes.add(row.collector_type);
        }
      });

      return {
        success: true,
        data: collectorTypes,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        data: new Set(),
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch positions for topics with all necessary metrics
   * Used by Topics page to get brand metrics grouped by topic
   * 
   * @param options - Query options
   * @returns Array of positions with topic, SOA, visibility, sentiment
   */
  async fetchTopicPositions(options: {
    brandId: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    collectorTypes?: string[];
    collectorResultIds?: number[];
  }): Promise<{
    success: boolean;
    data: Array<{
      collector_result_id: number;
      collector_type: string;
      topic: string | null;
      processed_at: string;
      share_of_answers_brand: number | null;
      visibility_index: number | null;
      has_brand_presence: boolean;
      sentiment_score: number | null;
    }>;
    duration_ms: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const { brandId, customerId, startDate, endDate, collectorTypes, collectorResultIds } = options;

    try {
      let query = this.supabase
        .from('metric_facts')
        .select(`
          collector_result_id,
          collector_type,
          topic,
          processed_at,
          brand_metrics!inner(
            share_of_answers,
            visibility_index,
            has_brand_presence
          ),
          brand_sentiment(
            sentiment_score
          )
        `)
        .eq('brand_id', brandId);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      if (startDate) {
        query = query.gte('processed_at', startDate);
      }
      if (endDate) {
        query = query.lte('processed_at', endDate);
      }
      if (collectorTypes && collectorTypes.length > 0) {
        if (collectorTypes.length === 1) {
          query = query.eq('collector_type', collectorTypes[0]);
        } else {
          query = query.in('collector_type', collectorTypes);
        }
      }
      if (collectorResultIds && collectorResultIds.length > 0) {
        query = query.in('collector_result_id', collectorResultIds);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          data: [],
          duration_ms: Date.now() - startTime,
          error: error.message,
        };
      }

      // Transform to match expected format
      const transformed = (data || []).map((row: any) => {
        const bm = Array.isArray(row.brand_metrics) ? row.brand_metrics[0] : row.brand_metrics;
        const bs = Array.isArray(row.brand_sentiment) ? row.brand_sentiment[0] : row.brand_sentiment;

        return {
          collector_result_id: row.collector_result_id,
          collector_type: row.collector_type,
          topic: row.topic,
          processed_at: row.processed_at,
          share_of_answers_brand: bm?.share_of_answers ?? null,
          visibility_index: bm?.visibility_index ?? null,
          has_brand_presence: bm?.has_brand_presence || false,
          sentiment_score: bs?.sentiment_score || null,
        };
      });

      return {
        success: true,
        data: transformed,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch competitor metrics per topic for comparison
   * Used by Topics page to show competitor performance
   * Returns SOA, visibility, sentiment with timestamps for trend calculation
   * 
   * @param options - Query options
   * @returns Array of competitor positions grouped by topic
   */
  async fetchCompetitorMetricsByTopic(options: {
    customerId: string;
    currentBrandId: string;
    currentBrandName?: string;
    topicNames: string[];
    startDate?: string;
    endDate?: string;
    collectorTypes?: string[];
    competitorNames?: string[]; // Filter by specific competitors
  }): Promise<{
    success: boolean;
    data: Array<{
      topic: string;
      brand_id: string;
      competitor_id: string | null;
      competitor_name: string | null;
      share_of_answers: number | null;
      visibility_index: number | null;
      sentiment_score: number | null;
      processed_at: string;
    }>;
    duration_ms: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const { customerId, currentBrandId, currentBrandName, topicNames, startDate, endDate, collectorTypes, competitorNames } = options;

    if (topicNames.length === 0) {
      return {
        success: true,
        data: [],
        duration_ms: Date.now() - startTime,
      };
    }

    try {
      // Get all brands for this customer
      const { data: brands, error: brandsError } = await this.supabase
        .from('brands')
        .select('id')
        .eq('customer_id', customerId);

      if (brandsError || !brands || brands.length === 0) {
        return {
          success: false,
          data: [],
          duration_ms: Date.now() - startTime,
          error: brandsError?.message || 'No brands found',
        };
      }

      const allBrandIds = brands.map(b => b.id);

      // Build query for competitor metrics
      let query = this.supabase
        .from('metric_facts')
        .select(`
          topic,
          brand_id,
          processed_at,
          collector_type,
          competitor_metrics!inner(
            competitor_id,
            share_of_answers,
            visibility_index,
            brand_competitors!inner(
              competitor_name
            )
          ),
          competitor_sentiment(
            sentiment_score
          )
        `)
        .in('brand_id', allBrandIds)
        .in('topic', topicNames)
        .not('topic', 'is', null);

      if (startDate) {
        query = query.gte('processed_at', startDate);
      }
      if (endDate) {
        query = query.lte('processed_at', endDate);
      }
      if (collectorTypes && collectorTypes.length > 0) {
        if (collectorTypes.length === 1) {
          query = query.eq('collector_type', collectorTypes[0]);
        } else {
          query = query.in('collector_type', collectorTypes);
        }
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          data: [],
          duration_ms: Date.now() - startTime,
          error: error.message,
        };
      }

      // Transform and filter data
      const transformed: Array<{
        topic: string;
        brand_id: string;
        competitor_id: string | null;
        competitor_name: string | null;
        share_of_answers: number | null;
        visibility_index: number | null;
        sentiment_score: number | null;
        processed_at: string;
      }> = [];

      (data || []).forEach((row: any) => {
        const topic = row.topic;
        if (!topic) return;

        // Handle competitor_metrics (can be array or single object)
        const cms = Array.isArray(row.competitor_metrics) ? row.competitor_metrics : [row.competitor_metrics];
        const cs = Array.isArray(row.competitor_sentiment) ? row.competitor_sentiment[0] : row.competitor_sentiment;

        cms.forEach((cm: any) => {
          if (!cm) return;

          // Get competitor name
          const competitorNameObj = Array.isArray(cm.brand_competitors) ? cm.brand_competitors[0] : cm.brand_competitors;
          const competitorName = competitorNameObj?.competitor_name || null;

          if (!competitorName) return;

          const normalizedCompetitorName = competitorName.toLowerCase().trim();

          // Exclude current brand when it appears as competitor
          if (currentBrandName && normalizedCompetitorName === currentBrandName.toLowerCase().trim()) {
            return;
          }

          // Filter by specific competitor names if provided
          if (competitorNames && competitorNames.length > 0) {
            const normalizedCompetitorNames = competitorNames.map(n => n.toLowerCase().trim());
            if (!normalizedCompetitorNames.includes(normalizedCompetitorName)) {
              return;
            }
          }

          // Only include if at least one metric is present
          const hasMetric = 
            (cm.share_of_answers !== null && cm.share_of_answers !== undefined) ||
            (cm.visibility_index !== null && cm.visibility_index !== undefined) ||
            (cs?.sentiment_score !== null && cs?.sentiment_score !== undefined);

          if (!hasMetric) return;

          transformed.push({
            topic,
            brand_id: row.brand_id,
            competitor_id: cm.competitor_id,
            competitor_name: competitorName,
            share_of_answers: cm.share_of_answers,
            visibility_index: cm.visibility_index,
            sentiment_score: cs?.sentiment_score || null,
            processed_at: row.processed_at,
          });
        });
      });

      return {
        success: true,
        data: transformed,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch prompts analytics data (visibility, sentiment, mentions, competitors)
   * Used by Prompts Analytics page to show metrics per prompt
   * 
   * @param options - Query options
   * @returns Array of rows with visibility, sentiment, mentions, competitor data
   */
  async fetchPromptsAnalytics(options: {
    brandId: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    queryIds?: string[];
    collectorResultIds?: number[];
  }): Promise<{
    success: boolean;
    data: Array<{
      query_id: string | null;
      collector_result_id: number | null;
      collector_type: string | null;
      visibility_index: number | null;
      sentiment_score: number | null;
      total_brand_mentions: number | null;
      total_brand_product_mentions: number | null;
      competitor_names: string[];
      competitor_count: number;
      competitor_product_count: number;
    }>;
    duration_ms: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const { brandId, customerId, startDate, endDate, queryIds, collectorResultIds } = options;

    try {
      // FIXED: Query from collector_results first, then LEFT JOIN to metric_facts
      // This ensures ALL collector_results are returned, even if they don't have metric_facts yet
      // Previously querying from metric_facts with INNER JOIN excluded unscored collector_results
      
      // Build base query on collector_results
      let collectorQuery = this.supabase
        .from('collector_results')
        .select(`
          id,
          query_id,
          collector_type,
          created_at,
          metric_facts(
            query_id,
            processed_at,
            brand_metrics(
              visibility_index,
              total_brand_mentions,
              total_brand_product_mentions
            ),
            brand_sentiment(
              sentiment_score
            ),
            competitor_metrics(
              competitor_id,
              competitor_mentions,
              total_competitor_product_mentions,
              brand_competitors(
                competitor_name
              )
            )
          )
        `)
        .eq('brand_id', brandId);

      if (customerId) {
        collectorQuery = collectorQuery.eq('customer_id', customerId);
      }
      
      // IMPORTANT: When collectorResultIds are provided, don't apply date filters
      // The IDs are already filtered by the calling code, and date filters might exclude valid results
      // Only apply date filters when querying by queryIds or when no specific IDs are provided
      if (collectorResultIds && collectorResultIds.length > 0) {
        // When specific IDs are provided, use them directly (no date filter)
        collectorQuery = collectorQuery.in('id', collectorResultIds);
      } else {
        // Only apply date filters when NOT filtering by specific collector_result_ids
        if (startDate) {
          collectorQuery = collectorQuery.gte('created_at', startDate);
        }
        if (endDate) {
          collectorQuery = collectorQuery.lte('created_at', endDate);
        }
        if (queryIds && queryIds.length > 0) {
          collectorQuery = collectorQuery.in('query_id', queryIds);
        }
      }

      const { data: collectorData, error: collectorError } = await collectorQuery;

      if (collectorError) {
        console.error(`[OptimizedMetrics] Collector query error:`, collectorError);
        return {
          success: false,
          data: [],
          duration_ms: Date.now() - startTime,
          error: collectorError.message,
        };
      }

      // Debug: Log raw Supabase response structure for first few rows
      if (collectorData && collectorData.length > 0) {
        console.log(`[OptimizedMetrics] 🔍 Raw Supabase response (first 2 rows):`, 
          JSON.stringify(collectorData.slice(0, 2).map((cr: any) => ({
            id: cr.id,
            collector_type: cr.collector_type,
            has_metric_facts: !!cr.metric_facts,
            metric_facts_type: Array.isArray(cr.metric_facts) ? 'array' : typeof cr.metric_facts,
            metric_facts_length: Array.isArray(cr.metric_facts) ? cr.metric_facts.length : (cr.metric_facts ? 1 : 0),
            metric_facts_structure: cr.metric_facts ? {
              id: Array.isArray(cr.metric_facts) ? cr.metric_facts[0]?.id : cr.metric_facts.id,
              has_brand_metrics: !!(Array.isArray(cr.metric_facts) ? cr.metric_facts[0]?.brand_metrics : cr.metric_facts.brand_metrics),
              brand_metrics_type: Array.isArray(cr.metric_facts) 
                ? (Array.isArray(cr.metric_facts[0]?.brand_metrics) ? 'array' : typeof cr.metric_facts[0]?.brand_metrics)
                : (Array.isArray(cr.metric_facts.brand_metrics) ? 'array' : typeof cr.metric_facts.brand_metrics),
              brand_metrics_data: Array.isArray(cr.metric_facts)
                ? (Array.isArray(cr.metric_facts[0]?.brand_metrics) 
                    ? cr.metric_facts[0].brand_metrics[0] 
                    : cr.metric_facts[0]?.brand_metrics)
                : (Array.isArray(cr.metric_facts.brand_metrics)
                    ? cr.metric_facts.brand_metrics[0]
                    : cr.metric_facts.brand_metrics)
            } : null
          })), null, 2)
        );
      }

      // Transform collector_results data to match expected format
      // Each collector_result may have 0 or 1 metric_facts row
      const transformed = (collectorData || []).map((cr: any) => {
        // Get metric_facts (should be array with 0 or 1 element, or single object)
        const mf = Array.isArray(cr.metric_facts) 
          ? (cr.metric_facts.length > 0 ? cr.metric_facts[0] : null)
          : cr.metric_facts;
        
        // Extract brand_metrics, brand_sentiment, competitor_metrics from metric_facts
        const bm = mf?.brand_metrics 
          ? (Array.isArray(mf.brand_metrics) ? mf.brand_metrics[0] : mf.brand_metrics)
          : null;
        const bs = mf?.brand_sentiment
          ? (Array.isArray(mf.brand_sentiment) ? mf.brand_sentiment[0] : mf.brand_sentiment)
          : null;
        const cms = mf?.competitor_metrics
          ? (Array.isArray(mf.competitor_metrics) ? mf.competitor_metrics : [mf.competitor_metrics])
          : [];

        // Extract competitor names and SUM competitor mentions and product mentions
        const competitorNames: string[] = [];
        let totalCompetitorMentions = 0;
        let totalCompetitorProductMentions = 0;
        cms.forEach((cm: any) => {
          if (cm) {
            const bc = Array.isArray(cm.brand_competitors) ? cm.brand_competitors[0] : cm.brand_competitors;
            if (bc?.competitor_name) {
              competitorNames.push(bc.competitor_name);
            }
            // SUM competitor mentions
            if (cm.competitor_mentions !== null && cm.competitor_mentions !== undefined) {
              const mentions = typeof cm.competitor_mentions === 'number' 
                ? cm.competitor_mentions 
                : Number(cm.competitor_mentions);
              if (Number.isFinite(mentions) && mentions >= 0) {
                totalCompetitorMentions += mentions;
              }
            }
            // SUM competitor product mentions
            if (cm.total_competitor_product_mentions !== null && cm.total_competitor_product_mentions !== undefined) {
              const productMentions = typeof cm.total_competitor_product_mentions === 'number' 
                ? cm.total_competitor_product_mentions 
                : Number(cm.total_competitor_product_mentions);
              if (Number.isFinite(productMentions) && productMentions >= 0) {
                totalCompetitorProductMentions += productMentions;
              }
            }
          }
        });

        const transformedRow = {
          query_id: mf?.query_id ?? cr.query_id,
          collector_result_id: cr.id,
          collector_type: cr.collector_type,
          // IMPORTANT: use nullish coalescing to preserve 0 values (0 mentions is valid)
          visibility_index: bm?.visibility_index ?? null,
          sentiment_score: bs?.sentiment_score ?? null,
          total_brand_mentions: bm?.total_brand_mentions ?? null,
          total_brand_product_mentions: bm?.total_brand_product_mentions ?? null,
          competitor_names: competitorNames,
          competitor_count: totalCompetitorMentions,
          competitor_product_count: totalCompetitorProductMentions,
        };

        // Debug: Log transformation for rows with missing data
        if (cr.id && (!bm || bm.total_brand_mentions === null || bm.total_brand_mentions === undefined)) {
          console.log(`[OptimizedMetrics] 🔍 Transformation for collector ${cr.id}:`, {
            has_metric_facts: !!mf,
            metric_fact_id: mf?.id,
            has_brand_metrics: !!bm,
            brand_metrics_id: bm?.id,
            raw_brand_mentions: bm?.total_brand_mentions,
            raw_product_mentions: bm?.total_brand_product_mentions,
            transformed_brand_mentions: transformedRow.total_brand_mentions,
            transformed_product_mentions: transformedRow.total_brand_product_mentions,
            competitor_count: transformedRow.competitor_count
          });
        }

        return transformedRow;
      });

      // Log the query being executed (for debugging)
      console.log(`[OptimizedMetrics] Fetching prompts analytics from collector_results:`, {
        brandId,
        customerId,
        startDate,
        endDate,
        queryIdsCount: queryIds?.length || 0,
        collectorResultIdsCount: collectorResultIds?.length || 0
      });

      // Debug: Log what we got back
      console.log(`[OptimizedMetrics] Query returned ${collectorData?.length || 0} collector_results`);
      if (collectorData && collectorData.length > 0) {
        const withMetrics = collectorData.filter((cr: any) => {
          const mf = Array.isArray(cr.metric_facts) ? cr.metric_facts[0] : cr.metric_facts;
          return mf !== null && mf !== undefined;
        });
        const withoutMetrics = collectorData.filter((cr: any) => {
          const mf = Array.isArray(cr.metric_facts) ? cr.metric_facts[0] : cr.metric_facts;
          return mf === null || mf === undefined;
        });
        console.log(`[OptimizedMetrics] Collector_results with metrics: ${withMetrics.length}, without metrics: ${withoutMetrics.length}`);
        
        // Log sample of collector_result_ids that don't have metrics
        if (withoutMetrics.length > 0 && collectorResultIds && collectorResultIds.length > 0) {
          const missingIds = withoutMetrics
            .map((cr: any) => cr.id)
            .filter((id: any) => id !== null)
            .slice(0, 10);
          console.log(`[OptimizedMetrics] Sample collector_result_ids WITHOUT metrics:`, missingIds);
          
          // Check if these IDs were requested
          const requestedButMissing = missingIds.filter((id: number) => collectorResultIds.includes(id));
          if (requestedButMissing.length > 0) {
            console.warn(`[OptimizedMetrics] ⚠️ ${requestedButMissing.length} requested collector_result_ids have no metrics:`, requestedButMissing);
          }
        }
        
        // Log sample of collector_result_ids that DO have metrics
        if (withMetrics.length > 0) {
          const withMetricsIds = withMetrics
            .map((cr: any) => {
              const mf = Array.isArray(cr.metric_facts) ? cr.metric_facts[0] : cr.metric_facts;
              const bm = mf?.brand_metrics ? (Array.isArray(mf.brand_metrics) ? mf.brand_metrics[0] : mf.brand_metrics) : null;
              return {
                id: cr.id,
                brand_mentions: bm?.total_brand_mentions ?? null,
                product_mentions: bm?.total_brand_product_mentions ?? null
              };
            })
            .slice(0, 5);
          console.log(`[OptimizedMetrics] Sample collector_result_ids WITH metrics:`, withMetricsIds);
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
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
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

