/**
 * Prompt CRUD Service
 * Handles create, read, update, delete operations for prompts
 */

import { supabaseAdmin } from '../../config/database'
import { DatabaseError } from '../../types/auth'
import { ManagedPrompt, PromptTopic, ManagePromptsResponse } from './types'
import { parseMetadata, extractTopicName, slugify, roundToPrecision } from './utils'

export class PromptCrudService {
  /**
   * Get all active prompts for a brand (for management UI)
   */
  async getActivePrompts(brandId: string, customerId: string): Promise<ManagePromptsResponse> {
    // Fetch brand info
    const { data: brandRow, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .eq('id', brandId)
      .eq('customer_id', customerId)
      .maybeSingle()

    if (brandError) {
      throw new DatabaseError(`Failed to load brand: ${brandError.message}`)
    }

    if (!brandRow) {
      throw new DatabaseError('Brand not found for customer')
    }

    // Get current active version
    const { data: activeConfig, error: configError } = await supabaseAdmin
      .from('prompt_configurations')
      .select('id, version')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .maybeSingle()

    // Fetch active queries
    const { data: queryRows, error: queryError} = await supabaseAdmin
      .from('generated_queries')
      .select('id, query_text, metadata, created_at')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (queryError) {
      throw new DatabaseError(`Failed to load prompts: ${queryError.message}`)
    }

    const queries = queryRows || []
    const queryIds = queries.map(q => q.id)

    // Fetch latest responses for each prompt
    const responseMap = new Map<string, { response: string; timestamp: string; collectorType: string }>()
    
    if (queryIds.length > 0) {
      const { data: responseRows } = await supabaseAdmin
        .from('collector_results')
        .select('query_id, raw_answer, created_at, collector_type')
        .in('query_id', queryIds)
        .not('raw_answer', 'is', null)
        .order('created_at', { ascending: false })

      if (responseRows) {
        // Get the latest response for each query
        responseRows.forEach(row => {
          if (row.query_id && !responseMap.has(row.query_id)) {
            responseMap.set(row.query_id, {
              response: row.raw_answer,
              timestamp: row.created_at,
              collectorType: row.collector_type
            })
          }
        })
      }
    }

    // Fetch metrics (sentiment, visibility) for each prompt
    const metricsMap = new Map<string, { sentiment: number | null; visibility: number | null }>()
    
    if (queryIds.length > 0) {
      const { data: metricsRows } = await supabaseAdmin
        .from('extracted_positions')
        .select('query_id, sentiment_score, visibility_index')
        .in('query_id', queryIds)
        .is('competitor_name', null) // Only brand metrics, not competitors

      if (metricsRows) {
        // Group by query_id and calculate averages
        const grouped = new Map<string, { sentiments: number[]; visibilities: number[] }>()
        
        metricsRows.forEach(row => {
          if (!row.query_id) return
          
          if (!grouped.has(row.query_id)) {
            grouped.set(row.query_id, { sentiments: [], visibilities: [] })
          }
          
          const group = grouped.get(row.query_id)!
          if (typeof row.sentiment_score === 'number') {
            group.sentiments.push(row.sentiment_score)
          }
          if (typeof row.visibility_index === 'number') {
            group.visibilities.push(row.visibility_index)
          }
        })

        // Calculate averages
        grouped.forEach((values, queryId) => {
          const avgSentiment = values.sentiments.length > 0
            ? roundToPrecision(values.sentiments.reduce((sum, v) => sum + v, 0) / values.sentiments.length, 1)
            : null
          
          const avgVisibility = values.visibilities.length > 0
            ? roundToPrecision((values.visibilities.reduce((sum, v) => sum + v, 0) / values.visibilities.length) * 100, 1)
            : null

          metricsMap.set(queryId, {
            sentiment: avgSentiment,
            visibility: avgVisibility
          })
        })
      }
    }

    // Fetch volume counts (how many times each prompt was executed)
    const volumeMap = new Map<string, number>()
    
    if (queryIds.length > 0) {
      const { data: volumeRows } = await supabaseAdmin
        .from('collector_results')
        .select('query_id')
        .in('query_id', queryIds)
        .not('raw_answer', 'is', null)

      if (volumeRows) {
        volumeRows.forEach(row => {
          if (row.query_id) {
            volumeMap.set(row.query_id, (volumeMap.get(row.query_id) || 0) + 1)
          }
        })
      }
    }

    // Fetch keywords
    const keywordMap = new Map<string, string[]>()
    
    if (queryIds.length > 0) {
      const { data: keywordRows } = await supabaseAdmin
        .from('generated_keywords')
        .select('query_id, keyword')
        .in('query_id', queryIds)
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)

      if (keywordRows) {
        keywordRows.forEach(row => {
          if (row.query_id && row.keyword) {
            if (!keywordMap.has(row.query_id)) {
              keywordMap.set(row.query_id, [])
            }
            keywordMap.get(row.query_id)!.push(row.keyword)
          }
        })
      }
    }

    // Build prompt objects
    const prompts: ManagedPrompt[] = queries.map(query => {
      const metadata = parseMetadata(query.metadata)
      const topic = extractTopicName(metadata) || 'Uncategorized'
      const latestResponse = responseMap.get(query.id)
      const metrics = metricsMap.get(query.id) || { sentiment: null, visibility: null }
      const volume = volumeMap.get(query.id) || 0
      const keywords = keywordMap.get(query.id) || []

      return {
        id: query.id,
        queryId: query.id,
        text: query.query_text || '',
        topic,
        response: latestResponse?.response || null,
        lastUpdated: latestResponse?.timestamp || null,
        createdAt: query.created_at,
        sentiment: metrics.sentiment,
        visibilityScore: metrics.visibility,
        volumeCount: volume,
        keywords: {
          brand: [], // Will be populated later if needed
          products: [], // Will be populated later if needed
          keywords,
          competitors: [] // Will be populated later if needed
        },
        source: metadata?.source === 'custom' ? 'custom' : 'generated',
        isActive: true,
        collectorTypes: latestResponse ? [latestResponse.collectorType] : [],
        includedInVersions: [], // Will be populated if we fetch version history
        firstVersionIncluded: null
      }
    })

    // Group by topic
    const topicMap = new Map<string, ManagedPrompt[]>()
    
    prompts.forEach(prompt => {
      const topicId = slugify(prompt.topic)
      if (!topicMap.has(topicId)) {
        topicMap.set(topicId, [])
      }
      topicMap.get(topicId)!.push(prompt)
    })

    const topics: PromptTopic[] = Array.from(topicMap.entries()).map(([topicId, topicPrompts]) => ({
      id: topicId,
      name: topicPrompts[0]?.topic || 'Uncategorized',
      promptCount: topicPrompts.length,
      prompts: topicPrompts
    }))

    // Calculate summary statistics
    const totalPrompts = prompts.length
    const totalTopics = topics.length
    
    const visibilityScores = prompts
      .map(p => p.visibilityScore)
      .filter((v): v is number => v !== null)
    const avgVisibility = visibilityScores.length > 0
      ? roundToPrecision(visibilityScores.reduce((sum, v) => sum + v, 0) / visibilityScores.length, 1)
      : 0

    const sentimentScores = prompts
      .map(p => p.sentiment)
      .filter((v): v is number => v !== null)
    const avgSentiment = sentimentScores.length > 0
      ? roundToPrecision(sentimentScores.reduce((sum, v) => sum + v, 0) / sentimentScores.length, 1)
      : 0

    // Simple coverage calculation
    const coverage = Math.min(100, totalPrompts * 1.5) // Placeholder formula

    return {
      brandId: brandRow.id,
      brandName: brandRow.name,
      currentVersion: activeConfig?.version || 0,
      topics,
      summary: {
        totalPrompts,
        totalTopics,
        coverage: roundToPrecision(coverage, 1),
        avgVisibility,
        avgSentiment
      }
    }
  }

  /**
   * Add a new prompt
   */
  async addPrompt(
    brandId: string,
    customerId: string,
    text: string,
    topic: string,
    metadata?: Record<string, unknown>
  ): Promise<{ promptId: string }> {
    const { data, error } = await supabaseAdmin
      .from('generated_queries')
      .insert({
        brand_id: brandId,
        customer_id: customerId,
        query_text: text,
        topic,
        is_active: true,
        metadata: metadata || {}
      })
      .select('id')
      .single()

    if (error) {
      throw new DatabaseError(`Failed to add prompt: ${error.message}`)
    }

    return { promptId: data.id }
  }

  /**
   * Update an existing prompt
   */
  async updatePrompt(
    promptId: string,
    brandId: string,
    customerId: string,
    updates: { text?: string; topic?: string }
  ): Promise<void> {
    const updateData: any = {}

    if (updates.text !== undefined) {
      updateData.query_text = updates.text
    }
    // Note: Topic is stored in metadata, not as a separate column
    // If topic needs to be updated, we'd need to fetch current metadata, update it, and save it back
    // For now, topic updates are handled through metadata updates elsewhere

    const { error } = await supabaseAdmin
      .from('generated_queries')
      .update(updateData)
      .eq('id', promptId)
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)

    if (error) {
      throw new DatabaseError(`Failed to update prompt: ${error.message}`)
    }
  }

  /**
   * Archive (soft delete) a prompt
   */
  async archivePrompt(
    promptId: string,
    brandId: string,
    customerId: string,
    archivedBy?: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('generated_queries')
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        archived_by: archivedBy || null
      })
      .eq('id', promptId)
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)

    if (error) {
      throw new DatabaseError(`Failed to archive prompt: ${error.message}`)
    }
  }

  /**
   * Permanently delete a prompt (use with caution)
   */
  async deletePrompt(
    promptId: string,
    brandId: string,
    customerId: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('generated_queries')
      .delete()
      .eq('id', promptId)
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)

    if (error) {
      throw new DatabaseError(`Failed to delete prompt: ${error.message}`)
    }
  }

  /**
   * Restore an archived prompt
   */
  async restorePrompt(
    promptId: string,
    brandId: string,
    customerId: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('generated_queries')
      .update({
        is_active: true,
        archived_at: null,
        archived_by: null
      })
      .eq('id', promptId)
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)

    if (error) {
      throw new DatabaseError(`Failed to restore prompt: ${error.message}`)
    }
  }
}

export const promptCrudService = new PromptCrudService()

