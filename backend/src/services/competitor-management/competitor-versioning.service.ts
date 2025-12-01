/**
 * Competitor Versioning Service
 * Handles creation and management of competitor configuration versions
 */

import { supabaseAdmin } from '../../config/database'
import { DatabaseError } from '../../types/auth'
import {
  CompetitorConfiguration,
  CompetitorConfigurationSnapshot,
  CompetitorDiff,
  CompetitorChangeType,
  VersionHistoryResponse,
  ManagedCompetitor
} from './types'
import { determineChangeType, generateChangeSummary, diffCompetitors } from './utils'

export class CompetitorVersioningService {
  /**
   * Get current active version for a brand
   */
  async getCurrentVersion(brandId: string, customerId: string): Promise<CompetitorConfiguration | null> {
    const { data, error } = await supabaseAdmin
      .from('competitor_configurations')
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
      changeType: data.change_type as CompetitorChangeType,
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
      .from('competitor_configurations')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .order('version', { ascending: false })

    if (error) {
      throw new DatabaseError(`Failed to fetch version history: ${error.message}`)
    }

    const currentVersion = versions?.find(v => v.is_active)?.version || 0

    // Fetch competitor counts for each version
    const versionIds = versions?.map(v => v.id) || []
    const countsMap = new Map<string, number>()

    if (versionIds.length > 0) {
      const { data: countsData } = await supabaseAdmin
        .from('competitor_configuration_competitors')
        .select('configuration_id')
        .in('configuration_id', versionIds)

      countsData?.forEach(item => {
        const current = countsMap.get(item.configuration_id) || 0
        countsMap.set(item.configuration_id, current + 1)
      })
    }

    const formattedVersions = versions?.map(v => ({
      id: v.id,
      version: v.version,
      isActive: v.is_active,
      changeType: v.change_type as CompetitorChangeType,
      changeSummary: v.change_summary,
      createdAt: v.created_at,
      createdBy: v.created_by,
      competitorCount: countsMap.get(v.id) || 0
    })) || []

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
  ): Promise<CompetitorConfiguration & { snapshots: CompetitorConfigurationSnapshot[] }> {
    const { data: versionData, error: versionError } = await supabaseAdmin
      .from('competitor_configurations')
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
      .from('competitor_configuration_competitors')
      .select('*')
      .eq('configuration_id', versionData.id)
      .order('priority', { ascending: true })

    if (snapshotsError) {
      throw new DatabaseError(`Failed to fetch version snapshots: ${snapshotsError.message}`)
    }

    const snapshots: CompetitorConfigurationSnapshot[] = snapshotsData?.map(s => ({
      id: s.id,
      configurationId: s.configuration_id,
      competitorName: s.competitor_name,
      competitorUrl: s.competitor_url,
      domain: s.domain,
      relevance: s.relevance,
      industry: s.industry,
      logo: s.logo,
      source: s.source,
      priority: s.priority,
      metadata: s.metadata || {},
      createdAt: s.created_at
    })) || []

    return {
      id: versionData.id,
      brandId: versionData.brand_id,
      customerId: versionData.customer_id,
      version: versionData.version,
      isActive: versionData.is_active,
      changeType: versionData.change_type as CompetitorChangeType,
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
    competitors: ManagedCompetitor[],
    createdBy?: string
  ): Promise<CompetitorConfiguration> {
    // Check if Version 1 already exists
    const existing = await this.getCurrentVersion(brandId, customerId)
    if (existing && existing.version === 1) {
      return existing
    }

    // Validate created_by user exists if provided
    let validCreatedBy: string | null = null
    if (createdBy) {
      const { data: userExists } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', createdBy)
        .maybeSingle()
      
      if (userExists) {
        validCreatedBy = createdBy
      } else {
        console.warn(`User ID ${createdBy} not found in users table, setting created_by to null`)
      }
    }

    // Create Version 1
    const { data: newVersion, error: versionError } = await supabaseAdmin
      .from('competitor_configurations')
      .insert({
        brand_id: brandId,
        customer_id: customerId,
        version: 1,
        is_active: true,
        change_type: 'initial_setup',
        change_summary: 'Initial competitor configuration setup',
        created_by: validCreatedBy,
        metadata: {}
      })
      .select()
      .single()

    if (versionError) {
      throw new DatabaseError(`Failed to create initial version: ${versionError.message}`)
    }

    // Create snapshots for all competitors
    if (competitors && competitors.length > 0) {
      const snapshots = competitors.map((comp, index) => ({
        configuration_id: newVersion.id,
        competitor_name: comp.name,
        competitor_url: comp.url,
        domain: comp.domain,
        relevance: comp.relevance || 'Direct Competitor',
        industry: comp.industry,
        logo: comp.logo,
        source: comp.source || 'onboarding',
        priority: comp.priority || (index + 1),
        metadata: comp.metadata || {}
      }))

      const { error: snapshotsError } = await supabaseAdmin
        .from('competitor_configuration_competitors')
        .insert(snapshots)

      if (snapshotsError) {
        // Rollback version creation
        await supabaseAdmin
          .from('competitor_configurations')
          .delete()
          .eq('id', newVersion.id)
        throw new DatabaseError(`Failed to create snapshots: ${snapshotsError.message}`)
      }
    }

    return {
      id: newVersion.id,
      brandId: newVersion.brand_id,
      customerId: newVersion.customer_id,
      version: newVersion.version,
      isActive: newVersion.is_active,
      changeType: newVersion.change_type as CompetitorChangeType,
      changeSummary: newVersion.change_summary,
      createdAt: newVersion.created_at,
      createdBy: newVersion.created_by,
      metadata: newVersion.metadata || {}
    }
  }

  /**
   * Create a new version from competitor changes
   */
  async createNewVersion(
    brandId: string,
    customerId: string,
    currentCompetitors: ManagedCompetitor[],
    nextCompetitors: ManagedCompetitor[],
    changeSummary?: string,
    createdBy?: string
  ): Promise<CompetitorConfiguration> {
    // Get current version
    const currentVersion = await this.getCurrentVersion(brandId, customerId)
    const nextVersion = currentVersion ? currentVersion.version + 1 : 1

    // Calculate diff
    const diff = diffCompetitors(currentCompetitors, nextCompetitors)
    const changeType = determineChangeType(diff)
    const summary = changeSummary || generateChangeSummary(diff)

    // Start transaction-like operations
    // 1. Deactivate current version
    if (currentVersion) {
      const { error: deactivateError } = await supabaseAdmin
        .from('competitor_configurations')
        .update({ is_active: false })
        .eq('id', currentVersion.id)

      if (deactivateError) {
        throw new DatabaseError(`Failed to deactivate current version: ${deactivateError.message}`)
      }
    }

    // 2. Create new version
    let validCreatedBy: string | null = null
    if (createdBy) {
      const { data: userExists } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', createdBy)
        .maybeSingle()
      
      if (userExists) {
        validCreatedBy = createdBy
      } else {
        console.warn(`User ID ${createdBy} not found in users table, setting created_by to null`)
      }
    }

    const { data: newVersion, error: versionError } = await supabaseAdmin
      .from('competitor_configurations')
      .insert({
        brand_id: brandId,
        customer_id: customerId,
        version: nextVersion,
        is_active: true,
        change_type: changeType,
        change_summary: summary,
        created_by: validCreatedBy,
        metadata: {}
      })
      .select()
      .single()

    if (versionError) {
      // Rollback: reactivate previous version
      if (currentVersion) {
        await supabaseAdmin
          .from('competitor_configurations')
          .update({ is_active: true })
          .eq('id', currentVersion.id)
      }
      throw new DatabaseError(`Failed to create new version: ${versionError.message}`)
    }

    // 3. Create snapshots for new competitors
    try {
      if (nextCompetitors.length > 0) {
        const snapshots = nextCompetitors.map((comp, index) => ({
          configuration_id: newVersion.id,
          competitor_name: comp.name,
          competitor_url: comp.url,
          domain: comp.domain,
          relevance: comp.relevance || 'Direct Competitor',
          industry: comp.industry,
          logo: comp.logo,
          source: comp.source || 'custom',
          priority: comp.priority || (index + 1),
          metadata: comp.metadata || {}
        }))

        await supabaseAdmin
          .from('competitor_configuration_competitors')
          .insert(snapshots)
      }

      // 4. Update brand_competitors table
      // Delete old competitors
      if (diff.removed.length > 0) {
        const removedNames = diff.removed.map(c => c.name)
        await supabaseAdmin
          .from('brand_competitors')
          .delete()
          .eq('brand_id', brandId)
          .in('competitor_name', removedNames)
      }

      // Insert/update competitors
      if (nextCompetitors.length > 0) {
        const competitorRecords = nextCompetitors.map((comp, index) => ({
          brand_id: brandId,
          competitor_name: comp.name,
          competitor_url: comp.url || comp.domain ? `https://${comp.domain}` : undefined,
          priority: comp.priority || (index + 1),
          configuration_id: newVersion.id,
          configuration_version: nextVersion,
          metadata: {
            domain: comp.domain,
            relevance: comp.relevance,
            industry: comp.industry,
            logo: comp.logo,
            source: comp.source || 'custom'
          }
        }))

        // Use upsert to handle both inserts and updates
        await supabaseAdmin
          .from('brand_competitors')
          .upsert(competitorRecords, {
            onConflict: 'brand_id,competitor_name',
            ignoreDuplicates: false
          })
      }

      // 5. Create change log entries
      const changeLogEntries = []

      for (const added of diff.added) {
        changeLogEntries.push({
          configuration_id: newVersion.id,
          competitor_name: added.name,
          change_type: 'added',
          old_value: null,
          new_value: {
            name: added.name,
            url: added.url,
            domain: added.domain,
            relevance: added.relevance,
            industry: added.industry
          },
          changed_by: validCreatedBy
        })
      }

      for (const removed of diff.removed) {
        changeLogEntries.push({
          configuration_id: newVersion.id,
          competitor_name: removed.name,
          change_type: 'removed',
          old_value: {
            name: removed.name,
            url: removed.url,
            domain: removed.domain,
            relevance: removed.relevance,
            industry: removed.industry
          },
          new_value: null,
          changed_by: validCreatedBy
        })
      }

      for (const updated of diff.updated) {
        const old = currentCompetitors.find(c => 
          c.name.toLowerCase().trim() === updated.name.toLowerCase().trim()
        )
        changeLogEntries.push({
          configuration_id: newVersion.id,
          competitor_name: updated.name,
          change_type: 'updated',
          old_value: old ? {
            name: old.name,
            url: old.url,
            domain: old.domain,
            relevance: old.relevance,
            industry: old.industry
          } : null,
          new_value: {
            name: updated.name,
            url: updated.url,
            domain: updated.domain,
            relevance: updated.relevance,
            industry: updated.industry
          },
          changed_by: validCreatedBy
        })
      }

      if (changeLogEntries.length > 0) {
        await supabaseAdmin
          .from('competitor_change_log')
          .insert(changeLogEntries)
      }
    } catch (err) {
      // Rollback version creation
      await supabaseAdmin
        .from('competitor_configurations')
        .delete()
        .eq('id', newVersion.id)

      if (currentVersion) {
        await supabaseAdmin
          .from('competitor_configurations')
          .update({ is_active: true })
          .eq('id', currentVersion.id)
      }

      throw new DatabaseError(`Failed to apply changes: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    return {
      id: newVersion.id,
      brandId: newVersion.brand_id,
      customerId: newVersion.customer_id,
      version: newVersion.version,
      isActive: newVersion.is_active,
      changeType: newVersion.change_type as CompetitorChangeType,
      changeSummary: newVersion.change_summary,
      createdAt: newVersion.created_at,
      createdBy: newVersion.created_by,
      metadata: newVersion.metadata || {}
    }
  }
}

export const competitorVersioningService = new CompetitorVersioningService()

