/**
 * Prompt Impact Service
 * Calculates estimated impact of pending changes before they're applied
 */

import { supabaseAdmin } from '../../config/database'
import { DatabaseError } from '../../types/auth'
import { PendingChanges, PromptImpact } from './types'
import { parseMetadata, extractTopicName } from './utils'
import { roundToPrecision, calculatePercentChange, calculateCoverageScore, slugify } from './utils'

export class PromptImpactService {
  /**
   * Calculate estimated impact of pending changes
   */
  async calculateImpact(
    brandId: string,
    customerId: string,
    changes: PendingChanges
  ): Promise<PromptImpact> {
    // Get current active prompts
    const { data: currentPrompts, error: promptsError } = await supabaseAdmin
      .from('generated_queries')
      .select('id, query_text, metadata')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)

    if (promptsError) {
      throw new DatabaseError(`Failed to fetch current prompts: ${promptsError.message}`)
    }

    const currentCount = currentPrompts?.length || 0
    const currentTopics = new Set(currentPrompts?.map(p => extractTopicName(parseMetadata(p.metadata)) || 'Uncategorized') || [])
    const currentTopicCount = currentTopics.size

    // Calculate projected state after changes
    let projectedCount = currentCount + changes.added.length - changes.removed.length
    
    // Calculate projected topics
    const projectedTopics = new Set(currentTopics)
    changes.added.forEach(added => {
      if (added.topic) {
        projectedTopics.add(added.topic)
      }
    })
    
    // Check if any topics will be removed (when all prompts in a topic are removed)
    const removedPromptIds = new Set(changes.removed.map(r => r.id))
    const topicPromptCounts = new Map<string, number>()
    
    currentPrompts?.forEach(p => {
      const topic = extractTopicName(parseMetadata(p.metadata)) || 'Uncategorized'
      topicPromptCounts.set(topic, (topicPromptCounts.get(topic) || 0) + 1)
    })
    
    changes.removed.forEach(removed => {
      const removedPrompt = currentPrompts?.find(p => p.id === removed.id)
      if (removedPrompt) {
        const topic = extractTopicName(parseMetadata(removedPrompt.metadata)) || 'Uncategorized'
        const count = topicPromptCounts.get(topic) || 0
        if (count === 1) {
          // This is the last prompt in the topic
          projectedTopics.delete(topic)
        }
      }
    })
    
    const projectedTopicCount = projectedTopics.size

    // Calculate coverage scores
    const currentCoverage = calculateCoverageScore(currentCount, currentTopicCount)
    const projectedCoverage = calculateCoverageScore(projectedCount, projectedTopicCount)
    const coverageChange = projectedCoverage - currentCoverage
    const coverageChangePercent = calculatePercentChange(currentCoverage, projectedCoverage)

    // Fetch current metrics (if available)
    const queryIds = currentPrompts?.map(p => p.id) || []
    let currentVisibility = 0

    if (queryIds.length > 0) {
      const { data: visibilityData } = await supabaseAdmin
        .from('extracted_positions')
        .select('visibility_index')
        .in('query_id', queryIds)
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .is('competitor_name', null)

      const visibilityScores = visibilityData
        ?.map(v => typeof v.visibility_index === 'number' ? v.visibility_index : null)
        .filter((v): v is number => v !== null) || []

      if (visibilityScores.length > 0) {
        const avg = visibilityScores.reduce((sum, v) => sum + v, 0) / visibilityScores.length
        currentVisibility = roundToPrecision(avg * 100, 1)
      }
    }

    // Analyze topic coverage changes
    const topicChanges = {
      increased: [] as string[],
      decreased: [] as string[],
      unchanged: [] as string[]
    }

    // Topics with added prompts
    const addedByTopic = new Map<string, number>()
    changes.added.forEach(added => {
      const topic = added.topic || 'Uncategorized'
      addedByTopic.set(topic, (addedByTopic.get(topic) || 0) + 1)
    })

    // Topics with removed prompts
    const removedByTopic = new Map<string, number>()
    changes.removed.forEach(removed => {
      const removedPrompt = currentPrompts?.find(p => p.id === removed.id)
      if (removedPrompt) {
        const topic = extractTopicName(parseMetadata(removedPrompt.metadata)) || 'Uncategorized'
        removedByTopic.set(topic, (removedByTopic.get(topic) || 0) + 1)
      }
    })

    // Categorize topics
    projectedTopics.forEach(topic => {
      const added = addedByTopic.get(topic) || 0
      const removed = removedByTopic.get(topic) || 0
      
      if (added > removed) {
        topicChanges.increased.push(topic)
      } else if (removed > added) {
        topicChanges.decreased.push(topic)
      } else if (added === 0 && removed === 0) {
        topicChanges.unchanged.push(topic)
      }
    })

    // Generate warnings
    const warnings: string[] = []

    if (changes.added.length > 0) {
      warnings.push('New prompts will require data collection before metrics are available')
    }

    if (changes.edited.length > 0) {
      warnings.push('Edited prompts will start fresh metric tracking')
    }

    if (changes.removed.length > 0) {
      const totalRemovedVolume = changes.removed.length
      if (totalRemovedVolume > 0) {
        warnings.push(`Removing ${totalRemovedVolume} prompt${totalRemovedVolume > 1 ? 's' : ''} will lose historical data`)
      }
    }

    if (projectedTopicCount < currentTopicCount) {
      const removedTopics = currentTopicCount - projectedTopicCount
      warnings.push(`${removedTopics} topic${removedTopics > 1 ? 's' : ''} will be removed`)
    }

    if (projectedCount < currentCount * 0.7) {
      warnings.push('Large reduction in prompts may significantly impact coverage')
    }

    // Count affected analyses (collector_results that reference removed prompts)
    let affectedAnalyses = 0
    
    if (changes.removed.length > 0) {
      const removedIds = changes.removed.map(r => r.id)
      const { count } = await supabaseAdmin
        .from('collector_results')
        .select('*', { count: 'exact', head: true })
        .in('query_id', removedIds)

      affectedAnalyses = count || 0
    }

    return {
      coverage: {
        current: currentCoverage,
        projected: projectedCoverage,
        change: roundToPrecision(coverageChange, 1),
        changePercent: roundToPrecision(coverageChangePercent, 1)
      },
      visibilityScore: {
        current: currentVisibility,
        projected: null, // Can't predict until data is collected
        change: null,
        changePercent: null
      },
      topicCoverage: topicChanges,
      affectedAnalyses,
      warnings
    }
  }
}

export const promptImpactService = new PromptImpactService()

