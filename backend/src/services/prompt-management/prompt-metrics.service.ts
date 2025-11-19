/**
 * Prompt Metrics Service
 * Handles calculation and storage of metrics for prompt configurations
 */

import { supabaseAdmin } from '../../config/database'
import { DatabaseError } from '../../types/auth'
import { PromptMetricsSnapshot } from './types'
import { roundToPrecision, calculateCoverageScore } from './utils'

export class PromptMetricsService {
  /**
   * Calculate and store metrics for a configuration version
   */
  async calculateAndStoreMetrics(
    configurationId: string,
    brandId: string,
    customerId: string
  ): Promise<PromptMetricsSnapshot> {
    // Get snapshots for this configuration
    const { data: snapshots, error: snapshotsError } = await supabaseAdmin
      .from('prompt_configuration_snapshots')
      .select('query_id, topic')
      .eq('configuration_id', configurationId)
      .eq('is_included', true)

    if (snapshotsError) {
      throw new DatabaseError(`Failed to fetch snapshots: ${snapshotsError.message}`)
    }

    const queryIds = snapshots?.map(s => s.query_id) || []
    const totalPrompts = queryIds.length
    
    // Count unique topics
    const uniqueTopics = new Set(snapshots?.map(s => s.topic) || [])
    const totalTopics = uniqueTopics.size

    // Calculate metrics based on historical data
    let avgVisibility: number | null = null
    let avgSentiment: number | null = null

    if (queryIds.length > 0) {
      // Fetch visibility scores
      const { data: visibilityData } = await supabaseAdmin
        .from('extracted_positions')
        .select('visibility_index')
        .in('query_id', queryIds)
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .is('competitor_name', null) // Only brand metrics

      const visibilityScores = visibilityData
        ?.map(v => typeof v.visibility_index === 'number' ? v.visibility_index : null)
        .filter((v): v is number => v !== null) || []

      if (visibilityScores.length > 0) {
        const avg = visibilityScores.reduce((sum, v) => sum + v, 0) / visibilityScores.length
        avgVisibility = roundToPrecision(avg * 100, 2) // Convert to 0-100 scale
      }

      // Fetch sentiment scores
      const { data: sentimentData } = await supabaseAdmin
        .from('extracted_positions')
        .select('sentiment_score')
        .in('query_id', queryIds)
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .is('competitor_name', null) // Only brand metrics

      const sentimentScores = sentimentData
        ?.map(s => typeof s.sentiment_score === 'number' ? s.sentiment_score : null)
        .filter((s): s is number => s !== null) || []

      if (sentimentScores.length > 0) {
        const avg = sentimentScores.reduce((sum, s) => sum + s, 0) / sentimentScores.length
        avgSentiment = roundToPrecision(avg, 2)
      }
    }

    // Calculate coverage score
    const coverageScore = calculateCoverageScore(totalPrompts, totalTopics)

    // Count how many analyses have been performed with this configuration
    const { count: analysesCount } = await supabaseAdmin
      .from('collector_results')
      .select('*', { count: 'exact', head: true })
      .eq('configuration_id', configurationId)

    // Store metrics
    const metricsData = {
      configuration_id: configurationId,
      total_prompts: totalPrompts,
      total_topics: totalTopics,
      coverage_score: coverageScore,
      avg_visibility_score: avgVisibility,
      avg_sentiment_score: avgSentiment,
      analyses_count: analysesCount || 0,
      metrics_data: {
        calculated_at: new Date().toISOString(),
        query_ids: queryIds
      }
    }

    const { data: metricsSnapshot, error: metricsError } = await supabaseAdmin
      .from('prompt_metrics_snapshots')
      .upsert(metricsData, {
        onConflict: 'configuration_id'
      })
      .select()
      .single()

    if (metricsError) {
      throw new DatabaseError(`Failed to store metrics: ${metricsError.message}`)
    }

    return {
      id: metricsSnapshot.id,
      configurationId: metricsSnapshot.configuration_id,
      totalPrompts: metricsSnapshot.total_prompts,
      totalTopics: metricsSnapshot.total_topics,
      coverageScore: metricsSnapshot.coverage_score,
      avgVisibilityScore: metricsSnapshot.avg_visibility_score,
      avgSentimentScore: metricsSnapshot.avg_sentiment_score,
      analysesCount: metricsSnapshot.analyses_count,
      calculatedAt: metricsSnapshot.calculated_at,
      metricsData: metricsSnapshot.metrics_data || {}
    }
  }

  /**
   * Get metrics for a configuration
   */
  async getMetrics(configurationId: string): Promise<PromptMetricsSnapshot | null> {
    const { data, error } = await supabaseAdmin
      .from('prompt_metrics_snapshots')
      .select('*')
      .eq('configuration_id', configurationId)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(`Failed to fetch metrics: ${error.message}`)
    }

    if (!data) {
      return null
    }

    return {
      id: data.id,
      configurationId: data.configuration_id,
      totalPrompts: data.total_prompts,
      totalTopics: data.total_topics,
      coverageScore: data.coverage_score,
      avgVisibilityScore: data.avg_visibility_score,
      avgSentimentScore: data.avg_sentiment_score,
      analysesCount: data.analyses_count,
      calculatedAt: data.calculated_at,
      metricsData: data.metrics_data || {}
    }
  }

  /**
   * Recalculate metrics for a configuration (useful after data changes)
   */
  async recalculateMetrics(
    configurationId: string,
    brandId: string,
    customerId: string
  ): Promise<PromptMetricsSnapshot> {
    // Delete existing metrics
    await supabaseAdmin
      .from('prompt_metrics_snapshots')
      .delete()
      .eq('configuration_id', configurationId)

    // Recalculate and store
    return this.calculateAndStoreMetrics(configurationId, brandId, customerId)
  }

  /**
   * Update analyses count for a configuration
   * Called when a new collector_result is created
   */
  async incrementAnalysesCount(configurationId: string): Promise<void> {
    // Get current count
    const metrics = await this.getMetrics(configurationId)
    
    if (!metrics) {
      return
    }

    // Increment
    const { error } = await supabaseAdmin
      .from('prompt_metrics_snapshots')
      .update({ analyses_count: metrics.analysesCount + 1 })
      .eq('configuration_id', configurationId)

    if (error) {
      console.error('Failed to increment analyses count:', error)
      // Don't throw - this is not critical
    }
  }
}

export const promptMetricsService = new PromptMetricsService()

