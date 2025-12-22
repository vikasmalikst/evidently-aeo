/**
 * TypeScript Types for Optimized Metrics Queries
 * 
 * These types represent data fetched from the new optimized schema:
 * - metric_facts (core reference)
 * - brand_metrics (brand visibility/presence)
 * - competitor_metrics (competitor visibility)
 * - brand_sentiment (brand sentiment)
 * - competitor_sentiment (competitor sentiment)
 */

/**
 * Brand metrics row from new schema
 * Represents data for the brand (not competitors)
 */
export interface BrandMetricsRow {
  // From metric_facts
  collector_result_id: number;
  brand_id: string;
  customer_id: string;
  query_id: string;
  collector_type: string;
  topic: string | null;
  processed_at: string;
  created_at: string;
  
  // From brand_metrics
  visibility_index: number | null;
  share_of_answers: number | null;
  total_brand_mentions: number;
  has_brand_presence: boolean;
  brand_positions: number[];
  brand_first_position: number | null;
  total_word_count: number;
  
  // From brand_sentiment (optional)
  sentiment_score?: number | null;
  sentiment_label?: string | null;
  positive_sentences?: any[];
  negative_sentences?: any[];
}

/**
 * Competitor metrics row from new schema
 * Represents data for a single competitor
 */
export interface CompetitorMetricsRow {
  // From metric_facts
  collector_result_id: number;
  brand_id: string;
  customer_id: string;
  query_id: string;
  collector_type: string;
  topic: string | null;
  processed_at: string;
  created_at: string;
  
  // Competitor identification
  competitor_id: string;
  competitor_name: string;
  
  // From competitor_metrics
  visibility_index: number | null;
  share_of_answers: number | null;
  competitor_mentions: number;
  competitor_positions: number[];
  
  // From competitor_sentiment (optional)
  sentiment_score?: number | null;
  sentiment_label?: string | null;
  positive_sentences?: any[];
  negative_sentences?: any[];
}

/**
 * Combined metrics (brand + competitors)
 */
export interface CombinedMetricsResult {
  brand: BrandMetricsRow[];
  competitors: CompetitorMetricsRow[];
}

/**
 * Options for fetching metrics
 */
export interface FetchMetricsOptions {
  // Required: collector_result IDs to fetch
  collectorResultIds: number[];
  
  // Optional filters
  brandId?: string;
  customerId?: string;
  
  // Optional: include sentiment data
  includeSentiment?: boolean;
  
  // Optional: date range filter
  startDate?: string;
  endDate?: string;
  
  // Optional: collector_type filter
  collectorTypes?: string[];
}

/**
 * Options for fetching by date range (instead of collector_result IDs)
 */
export interface FetchMetricsByDateRangeOptions {
  brandId: string;
  customerId: string;
  startDate: string;
  endDate: string;
  
  // Optional filters
  collectorTypes?: string[];
  topics?: string[];
  includeSentiment?: boolean;
}

/**
 * Aggregated topic metrics
 * Used for topics page analytics
 */
export interface TopicMetricsAggregated {
  topic: string;
  collector_type: string;
  
  // Aggregated brand metrics
  query_count: number;
  avg_share_of_answers: number | null;
  avg_visibility: number | null;
  avg_sentiment: number | null;
  brand_presence_count: number;
  brand_presence_percentage: number;
  
  // Aggregated competitor metrics (industry benchmarks)
  competitor_avg_share?: number | null;
  competitor_avg_visibility?: number | null;
  competitor_avg_sentiment?: number | null;
  competitor_brand_count?: number;
}

/**
 * Distinct collector types result
 */
export interface DistinctCollectorTypesResult {
  collector_types: string[];
}

/**
 * Helper function return types
 */

export interface FetchBrandMetricsResult {
  success: boolean;
  data: BrandMetricsRow[];
  error?: string;
  duration_ms?: number;
}

export interface FetchCompetitorMetricsResult {
  success: boolean;
  data: CompetitorMetricsRow[];
  error?: string;
  duration_ms?: number;
}

export interface FetchCombinedMetricsResult {
  success: boolean;
  data: CombinedMetricsResult;
  error?: string;
  duration_ms?: number;
}

/**
 * Query performance metrics
 */
export interface QueryPerformanceMetrics {
  query_type: string;
  duration_ms: number;
  rows_returned: number;
  timestamp: string;
  success: boolean;
  error?: string;
}

