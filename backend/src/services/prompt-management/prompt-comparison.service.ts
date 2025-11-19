/**
 * Prompt Comparison Service
 * Compares two versions of prompt configurations
 */

import { supabaseAdmin } from '../../config/database'
import { DatabaseError } from '../../types/auth'
import { VersionComparison } from './types'
import { promptVersioningService } from './prompt-versioning.service'
import { promptMetricsService } from './prompt-metrics.service'

export class PromptComparisonService {
  /**
   * Compare two versions
   */
  async compareVersions(
    brandId: string,
    customerId: string,
    version1: number,
    version2: number
  ): Promise<VersionComparison> {
    // Fetch both versions
    const [v1Details, v2Details] = await Promise.all([
      promptVersioningService.getVersionDetails(brandId, customerId, version1),
      promptVersioningService.getVersionDetails(brandId, customerId, version2)
    ])

    // Fetch metrics for both versions
    const [v1Metrics, v2Metrics] = await Promise.all([
      promptMetricsService.getMetrics(v1Details.id),
      promptMetricsService.getMetrics(v2Details.id)
    ])

    // Create maps for easier comparison
    const v1Map = new Map(v1Details.snapshots.map(s => 
      [`${s.topic}:${s.queryText}`, s]
    ))
    const v2Map = new Map(v2Details.snapshots.map(s => 
      [`${s.topic}:${s.queryText}`, s]
    ))

    // Find added prompts (in v2 but not in v1)
    const added: Array<{ id: string; text: string; topic: string }> = []
    v2Details.snapshots.forEach(s => {
      const key = `${s.topic}:${s.queryText}`
      if (!v1Map.has(key)) {
        added.push({
          id: s.queryId,
          text: s.queryText,
          topic: s.topic
        })
      }
    })

    // Find removed prompts (in v1 but not in v2)
    const removed: Array<{ id: string; text: string; topic: string }> = []
    v1Details.snapshots.forEach(s => {
      const key = `${s.topic}:${s.queryText}`
      if (!v2Map.has(key)) {
        removed.push({
          id: s.queryId,
          text: s.queryText,
          topic: s.topic
        })
      }
    })

    // Find edited prompts (same query_id but different text or topic)
    const edited: Array<{ id: string; oldText: string; newText: string; topic: string }> = []
    const v1ByQueryId = new Map(v1Details.snapshots.map(s => [s.queryId, s]))
    const v2ByQueryId = new Map(v2Details.snapshots.map(s => [s.queryId, s]))

    v1ByQueryId.forEach((v1Snapshot, queryId) => {
      const v2Snapshot = v2ByQueryId.get(queryId)
      if (v2Snapshot && v1Snapshot.queryText !== v2Snapshot.queryText) {
        edited.push({
          id: queryId,
          oldText: v1Snapshot.queryText,
          newText: v2Snapshot.queryText,
          topic: v2Snapshot.topic
        })
      }
    })

    // Find topic changes
    const v1Topics = new Set(v1Details.snapshots.map(s => s.topic))
    const v2Topics = new Set(v2Details.snapshots.map(s => s.topic))

    const addedTopics = Array.from(v2Topics).filter(t => !v1Topics.has(t))
    const removedTopics = Array.from(v1Topics).filter(t => !v2Topics.has(t))

    // Calculate metrics comparison
    const v1Prompts = v1Metrics?.totalPrompts || 0
    const v2Prompts = v2Metrics?.totalPrompts || 0
    const v1TopicsCount = v1Metrics?.totalTopics || 0
    const v2TopicsCount = v2Metrics?.totalTopics || 0
    const v1Coverage = v1Metrics?.coverageScore || 0
    const v2Coverage = v2Metrics?.coverageScore || 0

    return {
      version1,
      version2,
      changes: {
        added,
        removed,
        edited,
        topicChanges: {
          added: addedTopics,
          removed: removedTopics
        }
      },
      metricsComparison: {
        prompts: {
          v1: v1Prompts,
          v2: v2Prompts,
          diff: v2Prompts - v1Prompts
        },
        topics: {
          v1: v1TopicsCount,
          v2: v2TopicsCount,
          diff: v2TopicsCount - v1TopicsCount
        },
        coverage: {
          v1: v1Coverage,
          v2: v2Coverage,
          diff: v2Coverage - v1Coverage
        }
      }
    }
  }

  /**
   * Get changes between current version and a target version (for revert preview)
   */
  async getRevertChanges(
    brandId: string,
    customerId: string,
    targetVersion: number
  ): Promise<VersionComparison> {
    // Get current version
    const currentVersion = await promptVersioningService.getCurrentVersion(brandId, customerId)
    
    if (!currentVersion) {
      throw new DatabaseError('No active version found')
    }

    // Compare current with target
    return this.compareVersions(brandId, customerId, currentVersion.version, targetVersion)
  }
}

export const promptComparisonService = new PromptComparisonService()

