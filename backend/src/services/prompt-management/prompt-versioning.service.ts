/**
 * Prompt Versioning Service
 * Handles creation and management of prompt configuration versions
 */

import { supabaseAdmin } from '../../config/database'
import { DatabaseError } from '../../types/auth'
import {
  PromptConfiguration,
  PromptConfigurationSnapshot,
  PendingChanges,
  ChangeType,
  VersionHistoryResponse
} from './types'
import { determineChangeType, generateChangeSummary, parseMetadata, extractTopicName } from './utils'
import { promptMetricsService } from './prompt-metrics.service'

export class PromptVersioningService {
  /**
   * Get current active version for a brand
   */
  async getCurrentVersion(brandId: string, customerId: string): Promise<PromptConfiguration | null> {
    const { data, error } = await supabaseAdmin
      .from('prompt_configurations')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(`Failed to fetch current version: ${error.message}`)
    }

    if (!data) {
      return null
    }

    return {
      id: data.id,
      brandId: data.brand_id,
      customerId: data.customer_id,
      version: data.version,
      isActive: data.is_active,
      changeType: data.change_type as ChangeType,
      changeSummary: data.change_summary,
      createdAt: data.created_at,
      createdBy: data.created_by,
      metadata: data.metadata || {}
    }
  }

  /**
   * Get version history for a brand
   */
  async getVersionHistory(brandId: string, customerId: string): Promise<VersionHistoryResponse> {
    const { data: versions, error } = await supabaseAdmin
      .from('prompt_configurations')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .order('version', { ascending: false })

    if (error) {
      throw new DatabaseError(`Failed to fetch version history: ${error.message}`)
    }

    const currentVersion = versions?.find(v => v.is_active)?.version || 0

    // Fetch metrics for each version
    const versionIds = versions?.map(v => v.id) || []
    const metricsMap = new Map<string, any>()

    if (versionIds.length > 0) {
      const { data: metricsData } = await supabaseAdmin
        .from('prompt_metrics_snapshots')
        .select('*')
        .in('configuration_id', versionIds)

      metricsData?.forEach(m => {
        metricsMap.set(m.configuration_id, m)
      })
    }

    const formattedVersions = versions?.map(v => {
      const metrics = metricsMap.get(v.id)
      
      return {
        id: v.id,
        version: v.version,
        isActive: v.is_active,
        changeType: v.change_type as ChangeType,
        changeSummary: v.change_summary,
        createdAt: v.created_at,
        createdBy: v.created_by,
        metrics: {
          totalPrompts: metrics?.total_prompts || 0,
          totalTopics: metrics?.total_topics || 0,
          coverage: metrics?.coverage_score || null,
          analysesCount: metrics?.analyses_count || 0
        }
      }
    }) || []

    return {
      currentVersion,
      versions: formattedVersions
    }
  }

  /**
   * Get specific version details
   */
  async getVersionDetails(
    brandId: string,
    customerId: string,
    version: number
  ): Promise<PromptConfiguration & { snapshots: PromptConfigurationSnapshot[] }> {
    // Get version metadata
    const { data: versionData, error: versionError } = await supabaseAdmin
      .from('prompt_configurations')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('version', version)
      .maybeSingle()

    if (versionError) {
      throw new DatabaseError(`Failed to fetch version details: ${versionError.message}`)
    }

    if (!versionData) {
      throw new DatabaseError(`Version ${version} not found`)
    }

    // Get snapshots for this version
    const { data: snapshotsData, error: snapshotsError } = await supabaseAdmin
      .from('prompt_configuration_snapshots')
      .select('*')
      .eq('configuration_id', versionData.id)
      .order('sort_order', { ascending: true })

    if (snapshotsError) {
      throw new DatabaseError(`Failed to fetch version snapshots: ${snapshotsError.message}`)
    }

    const snapshots: PromptConfigurationSnapshot[] = snapshotsData?.map(s => ({
      id: s.id,
      configurationId: s.configuration_id,
      queryId: s.query_id,
      topic: s.topic,
      queryText: s.query_text,
      isIncluded: s.is_included,
      sortOrder: s.sort_order,
      createdAt: s.created_at
    })) || []

    return {
      id: versionData.id,
      brandId: versionData.brand_id,
      customerId: versionData.customer_id,
      version: versionData.version,
      isActive: versionData.is_active,
      changeType: versionData.change_type as ChangeType,
      changeSummary: versionData.change_summary,
      createdAt: versionData.created_at,
      createdBy: versionData.created_by,
      metadata: versionData.metadata || {},
      snapshots
    }
  }

  /**
   * Create initial version (Version 1) during onboarding
   */
  async createInitialVersion(
    brandId: string,
    customerId: string,
    createdBy?: string
  ): Promise<PromptConfiguration> {
    // Check if Version 1 already exists
    const existing = await this.getCurrentVersion(brandId, customerId)
    if (existing && existing.version === 1) {
      return existing
    }

    // Get all active prompts
    const { data: queries, error: queriesError } = await supabaseAdmin
      .from('generated_queries')
      .select('id, query_text, metadata')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)

    if (queriesError) {
      throw new DatabaseError(`Failed to fetch prompts for initial version: ${queriesError.message}`)
    }

    // Create Version 1
    const { data: newVersion, error: versionError } = await supabaseAdmin
      .from('prompt_configurations')
      .insert({
        brand_id: brandId,
        customer_id: customerId,
        version: 1,
        is_active: true,
        change_type: 'initial_setup',
        change_summary: 'Initial prompt configuration setup',
        created_by: createdBy || null,
        metadata: {}
      })
      .select()
      .single()

    if (versionError) {
      throw new DatabaseError(`Failed to create initial version: ${versionError.message}`)
    }

    // Create snapshots for all queries
    if (queries && queries.length > 0) {
      const snapshots = queries.map((q, index) => ({
        configuration_id: newVersion.id,
        query_id: q.id,
        topic: extractTopicName(parseMetadata(q.metadata)) || 'Uncategorized',
        query_text: q.query_text,
        is_included: true,
        sort_order: index
      }))

      const { error: snapshotsError } = await supabaseAdmin
        .from('prompt_configuration_snapshots')
        .insert(snapshots)

      if (snapshotsError) {
        throw new DatabaseError(`Failed to create snapshots: ${snapshotsError.message}`)
      }
    }

    // Calculate and store metrics
    await promptMetricsService.calculateAndStoreMetrics(newVersion.id, brandId, customerId)

    return {
      id: newVersion.id,
      brandId: newVersion.brand_id,
      customerId: newVersion.customer_id,
      version: newVersion.version,
      isActive: newVersion.is_active,
      changeType: newVersion.change_type as ChangeType,
      changeSummary: newVersion.change_summary,
      createdAt: newVersion.created_at,
      createdBy: newVersion.created_by,
      metadata: newVersion.metadata || {}
    }
  }

  /**
   * Create a new version from pending changes
   */
  async createNewVersion(
    brandId: string,
    customerId: string,
    changes: PendingChanges,
    changeSummary?: string,
    createdBy?: string
  ): Promise<PromptConfiguration> {
    // Get current version
    const currentVersion = await this.getCurrentVersion(brandId, customerId)
    const nextVersion = currentVersion ? currentVersion.version + 1 : 1

    const changeType = determineChangeType(changes)
    const summary = changeSummary || generateChangeSummary(changes)

    // Start transaction-like operations
    // 1. Deactivate current version
    if (currentVersion) {
      const { error: deactivateError } = await supabaseAdmin
        .from('prompt_configurations')
        .update({ is_active: false })
        .eq('id', currentVersion.id)

      if (deactivateError) {
        throw new DatabaseError(`Failed to deactivate current version: ${deactivateError.message}`)
      }
    }

    // 2. Create new version
    const { data: newVersion, error: versionError } = await supabaseAdmin
      .from('prompt_configurations')
      .insert({
        brand_id: brandId,
        customer_id: customerId,
        version: nextVersion,
        is_active: true,
        change_type: changeType,
        change_summary: summary,
        created_by: createdBy || null,
        metadata: {}
      })
      .select()
      .single()

    if (versionError) {
      // Rollback: reactivate previous version
      if (currentVersion) {
        await supabaseAdmin
          .from('prompt_configurations')
          .update({ is_active: true })
          .eq('id', currentVersion.id)
      }
      throw new DatabaseError(`Failed to create new version: ${versionError.message}`)
    }

    // 3. Apply changes to generated_queries
    try {
      // Add new prompts
      if (changes.added.length > 0) {
        const addedPrompts = changes.added.map(p => ({
          brand_id: brandId,
          customer_id: customerId,
          query_text: p.text,
          topic: p.topic,
          is_active: true,
          metadata: { source: 'custom' }
        }))

        await supabaseAdmin
          .from('generated_queries')
          .insert(addedPrompts)
      }

      // Remove prompts (archive)
      if (changes.removed.length > 0) {
        const removedIds = changes.removed.map(p => p.id)
        await supabaseAdmin
          .from('generated_queries')
          .update({
            is_active: false,
            archived_at: new Date().toISOString(),
            archived_by: createdBy || null
          })
          .in('id', removedIds)
      }

      // Edit prompts
      for (const edit of changes.edited) {
        await supabaseAdmin
          .from('generated_queries')
          .update({
            query_text: edit.newText
          })
          .eq('id', edit.id)
      }
    } catch (err) {
      // Rollback version creation
      await supabaseAdmin
        .from('prompt_configurations')
        .delete()
        .eq('id', newVersion.id)

      if (currentVersion) {
        await supabaseAdmin
          .from('prompt_configurations')
          .update({ is_active: true })
          .eq('id', currentVersion.id)
      }

      throw new DatabaseError(`Failed to apply changes: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    // 4. Create snapshots for new version
    const { data: activeQueries } = await supabaseAdmin
      .from('generated_queries')
      .select('id, query_text, metadata')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)

    if (activeQueries && activeQueries.length > 0) {
      const snapshots = activeQueries.map((q, index) => ({
        configuration_id: newVersion.id,
        query_id: q.id,
        topic: extractTopicName(parseMetadata(q.metadata)) || 'Uncategorized',
        query_text: q.query_text,
        is_included: true,
        sort_order: index
      }))

      await supabaseAdmin
        .from('prompt_configuration_snapshots')
        .insert(snapshots)
    }

    // 5. Log detailed changes
    await this.logChanges(newVersion.id, changes, createdBy)

    // 6. Calculate and store metrics
    await promptMetricsService.calculateAndStoreMetrics(newVersion.id, brandId, customerId)

    return {
      id: newVersion.id,
      brandId: newVersion.brand_id,
      customerId: newVersion.customer_id,
      version: newVersion.version,
      isActive: newVersion.is_active,
      changeType: newVersion.change_type as ChangeType,
      changeSummary: newVersion.change_summary,
      createdAt: newVersion.created_at,
      createdBy: newVersion.created_by,
      metadata: newVersion.metadata || {}
    }
  }

  /**
   * Revert to a previous version (creates a new version with old configuration)
   */
  async revertToVersion(
    brandId: string,
    customerId: string,
    targetVersion: number,
    revertedBy?: string
  ): Promise<PromptConfiguration> {
    // Get target version details
    const targetConfig = await this.getVersionDetails(brandId, customerId, targetVersion)

    // Calculate changes needed to revert
    const { data: currentQueries } = await supabaseAdmin
      .from('generated_queries')
      .select('id, query_text, metadata')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)

    const currentMap = new Map(currentQueries?.map(q => {
      const topic = extractTopicName(parseMetadata(q.metadata)) || 'Uncategorized'
      return [`${topic}:${q.query_text}`, q]
    }) || [])
    const targetMap = new Map(targetConfig.snapshots.map(s => [`${s.topic}:${s.queryText}`, s]))

    const changes: PendingChanges = {
      added: [],
      removed: [],
      edited: []
    }

    // Find prompts to add (in target but not in current)
    targetConfig.snapshots.forEach(snapshot => {
      const key = `${snapshot.topic}:${snapshot.queryText}`
      if (!currentMap.has(key)) {
        changes.added.push({
          text: snapshot.queryText,
          topic: snapshot.topic
        })
      }
    })

    // Find prompts to remove (in current but not in target)
    currentQueries?.forEach(query => {
      const topic = extractTopicName(parseMetadata(query.metadata)) || 'Uncategorized'
      const key = `${topic}:${query.query_text}`
      if (!targetMap.has(key)) {
        changes.removed.push({
          id: query.id,
          text: query.query_text
        })
      }
    })

    // Create new version with reverted configuration
    const changeSummary = `Reverted to version ${targetVersion}`
    const newVersion = await this.createNewVersion(
      brandId,
      customerId,
      changes,
      changeSummary,
      revertedBy
    )

    // Update change_type to version_revert
    await supabaseAdmin
      .from('prompt_configurations')
      .update({ change_type: 'version_revert' })
      .eq('id', newVersion.id)

    return newVersion
  }

  /**
   * Log detailed changes to change_log table
   */
  private async logChanges(
    configurationId: string,
    changes: PendingChanges,
    changedBy?: string
  ): Promise<void> {
    const logEntries: any[] = []

    // Log added prompts
    changes.added.forEach(added => {
      logEntries.push({
        configuration_id: configurationId,
        query_id: null, // New prompts don't have IDs yet
        change_type: 'added',
        old_value: null,
        new_value: JSON.stringify({ text: added.text, topic: added.topic }),
        changed_by: changedBy || null
      })
    })

    // Log removed prompts
    changes.removed.forEach(removed => {
      logEntries.push({
        configuration_id: configurationId,
        query_id: removed.id,
        change_type: 'removed',
        old_value: JSON.stringify({ text: removed.text }),
        new_value: null,
        changed_by: changedBy || null
      })
    })

    // Log edited prompts
    changes.edited.forEach(edited => {
      logEntries.push({
        configuration_id: configurationId,
        query_id: edited.id,
        change_type: 'edited',
        old_value: JSON.stringify({ text: edited.oldText }),
        new_value: JSON.stringify({ text: edited.newText }),
        changed_by: changedBy || null
      })
    })

    if (logEntries.length > 0) {
      const { error } = await supabaseAdmin
        .from('prompt_change_log')
        .insert(logEntries)

      if (error) {
        console.error('Failed to log changes:', error)
        // Don't throw - logging is not critical
      }
    }
  }
}

export const promptVersioningService = new PromptVersioningService()

