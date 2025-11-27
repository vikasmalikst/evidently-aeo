import { supabaseAdmin } from '../config/database'
import { DatabaseError } from '../types/auth'

type TopicSource = 'trending' | 'ai_generated' | 'preset' | 'custom'

export interface TopicDTO {
  id?: string
  name: string
  source?: TopicSource
  category?: string | null
  relevance?: number | null
}

export interface TopicConfigurationDTO {
  id: string
  brand_id: string
  customer_id: string
  version: number
  is_active: boolean
  change_type: string
  change_summary: string | null
  topics: TopicDTO[]
  created_at: string
  analysis_count: number
}

interface TopicDiff {
  added: TopicDTO[]
  removed: TopicDTO[]
  updated: TopicDTO[]
}

const slugifyTopic = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'topic'

const mapTopicRow = (row: any): TopicDTO => ({
  id: row.metadata?.topic_id || row.id || row.topic_slug || row.topic_name,
  name: row.topic_name,
  source: (row.source as TopicSource) || 'custom',
  category: row.category || null,
  relevance: typeof row.relevance === 'number' ? row.relevance : null
})

const buildSummary = (diff: TopicDiff): string => {
  const parts: string[] = []
  if (diff.added.length > 0) {
    parts.push(`Added ${diff.added.length} topic${diff.added.length === 1 ? '' : 's'}`)
  }
  if (diff.removed.length > 0) {
    parts.push(`Removed ${diff.removed.length} topic${diff.removed.length === 1 ? '' : 's'}`)
  }
  if (diff.updated.length > 0 && diff.added.length === 0 && diff.removed.length === 0) {
    parts.push(`Updated ${diff.updated.length} topic${diff.updated.length === 1 ? '' : 's'}`)
  }
  return parts.length > 0 ? parts.join(', ') : 'Topics refreshed'
}

const determineChangeType = (diff: TopicDiff): string => {
  if (diff.added.length > 0 && diff.removed.length > 0) {
    return 'bulk_update'
  }
  if (diff.added.length > 0) {
    return 'topic_added'
  }
  if (diff.removed.length > 0) {
    return 'topic_removed'
  }
  if (diff.updated.length > 0) {
    return 'topic_updated'
  }
  return 'topic_updated'
}

const diffTopics = (current: TopicDTO[], next: TopicDTO[]): TopicDiff => {
  const currentByName = new Map(current.map(topic => [topic.name.toLowerCase(), topic]))
  const nextByName = new Map(next.map(topic => [topic.name.toLowerCase(), topic]))

  const added = next.filter(topic => !currentByName.has(topic.name.toLowerCase()))
  const removed = current.filter(topic => !nextByName.has(topic.name.toLowerCase()))
  const updated = next.filter(topic => {
    const previous = currentByName.get(topic.name.toLowerCase())
    if (!previous) return false
    return previous.category !== topic.category || previous.relevance !== topic.relevance
  })

  return { added, removed, updated }
}

class TopicConfigurationService {
  async getCurrentConfiguration(brandId: string, customerId: string, userId?: string): Promise<TopicConfigurationDTO> {
    const { data: configRow, error } = await supabaseAdmin
      .from('topic_configurations')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(`Failed to fetch current topic configuration: ${error.message}`)
    }

    if (!configRow) {
      return this.createInitialConfiguration(brandId, customerId, userId)
    }

    const { topics } = await this.fetchTopicsForConfigurations([configRow.id])
    return this.mapConfiguration(configRow, topics.get(configRow.id) || [])
  }

  async getConfigurationHistory(brandId: string, customerId: string): Promise<TopicConfigurationDTO[]> {
    const { data: configs, error } = await supabaseAdmin
      .from('topic_configurations')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .order('version', { ascending: false })

    if (error) {
      throw new DatabaseError(`Failed to fetch topic configuration history: ${error.message}`)
    }

    if (!configs || configs.length === 0) {
      return []
    }

    const { topics } = await this.fetchTopicsForConfigurations(configs.map(config => config.id))
    return configs.map(config => this.mapConfiguration(config, topics.get(config.id) || []))
  }

  async createNewVersion(
    brandId: string,
    customerId: string,
    topics: TopicDTO[],
    userId?: string
  ): Promise<TopicConfigurationDTO> {
    const currentConfig = await this.tryGetActiveConfigRow(brandId, customerId)
    const currentTopics = currentConfig ? (await this.fetchTopicsForConfigurations([currentConfig.id])).topics.get(currentConfig.id) || [] : []
    const diff = diffTopics(currentTopics, topics)
    const changeType = determineChangeType(diff)
    const summary = buildSummary(diff)

    const newConfig = await this.createConfigurationRecord(
      brandId,
      customerId,
      topics,
      changeType,
      summary,
      userId,
      diff
    )

    await this.syncBrandTopics(brandId, topics)

    return newConfig
  }

  async revertToVersion(
    brandId: string,
    customerId: string,
    configurationId: string,
    userId?: string
  ): Promise<TopicConfigurationDTO> {
    const { data: configRow, error } = await supabaseAdmin
      .from('topic_configurations')
      .select('*')
      .eq('id', configurationId)
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .maybeSingle()

    if (error) {
      throw new DatabaseError(`Failed to fetch configuration for revert: ${error.message}`)
    }

    if (!configRow) {
      throw new DatabaseError('Requested configuration not found')
    }

    const { topics } = await this.fetchTopicsForConfigurations([configurationId])
    const versionTopics = topics.get(configurationId) || []

    const newConfig = await this.createConfigurationRecord(
      brandId,
      customerId,
      versionTopics,
      'version_revert',
      `Reverted to version ${configRow.version}`,
      userId
    )

    await this.syncBrandTopics(brandId, versionTopics)

    return newConfig
  }

  private async createInitialConfiguration(
    brandId: string,
    customerId: string,
    userId?: string
  ): Promise<TopicConfigurationDTO> {
    const { data: topicsRows, error } = await supabaseAdmin
      .from('brand_topics')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) {
      throw new DatabaseError(`Failed to load brand topics: ${error.message}`)
    }

    const topics: TopicDTO[] = (topicsRows || []).map(row => ({
      id: row.id,
      name: row.topic_name || row.topic || '',
      source: (row.metadata?.source as TopicSource) || 'custom',
      category: row.category || null,
      relevance: row.metadata?.relevance || null
    }))

    return this.createConfigurationRecord(
      brandId,
      customerId,
      topics,
      'initial_setup',
      `Initial configuration with ${topics.length} topics`,
      userId
    )
  }

  private async tryGetActiveConfigRow(brandId: string, customerId: string) {
    const { data } = await supabaseAdmin
      .from('topic_configurations')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .maybeSingle()

    return data || null
  }

  private async fetchTopicsForConfigurations(configurationIds: string[]) {
    if (configurationIds.length === 0) {
      return { topics: new Map<string, TopicDTO[]>() }
    }

    const { data: topicRows, error } = await supabaseAdmin
      .from('topic_configuration_topics')
      .select('*')
      .in('configuration_id', configurationIds)
      .order('sort_order', { ascending: true })

    if (error) {
      throw new DatabaseError(`Failed to fetch topic snapshots: ${error.message}`)
    }

    const topicMap = new Map<string, TopicDTO[]>()
    topicRows?.forEach(row => {
      if (!topicMap.has(row.configuration_id)) {
        topicMap.set(row.configuration_id, [])
      }
      topicMap.get(row.configuration_id)!.push(mapTopicRow(row))
    })

    return { topics: topicMap }
  }

  private async createConfigurationRecord(
    brandId: string,
    customerId: string,
    topics: TopicDTO[],
    changeType: string,
    changeSummary: string,
    userId?: string,
    diff?: TopicDiff
  ): Promise<TopicConfigurationDTO> {
    const nextVersion = await this.getNextVersionNumber(brandId, customerId)
    await supabaseAdmin
      .from('topic_configurations')
      .update({ is_active: false })
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true)

    const { data: configRow, error } = await supabaseAdmin
      .from('topic_configurations')
      .insert({
        brand_id: brandId,
        customer_id: customerId,
        version: nextVersion,
        is_active: true,
        change_type: changeType,
        change_summary: changeSummary,
        created_by: userId || null,
        metadata: {
          topicsCount: topics.length,
          addedCount: diff?.added.length || 0,
          removedCount: diff?.removed.length || 0,
          updatedCount: diff?.updated.length || 0
        }
      })
      .select()
      .single()

    if (error) {
      throw new DatabaseError(`Failed to create topic configuration: ${error.message}`)
    }

    if (topics.length > 0) {
      const topicRows = topics.map((topic, index) => ({
        configuration_id: configRow.id,
        topic_name: topic.name,
        topic_slug: slugifyTopic(topic.name),
        source: topic.source || 'custom',
        category: topic.category || null,
        relevance: topic.relevance ?? null,
        metadata: {
          topic_id: topic.id || null
        },
        sort_order: index
      }))

      const { error: topicsError } = await supabaseAdmin
        .from('topic_configuration_topics')
        .insert(topicRows)

      if (topicsError) {
        throw new DatabaseError(`Failed to persist topic snapshots: ${topicsError.message}`)
      }
    }

    return this.mapConfiguration(configRow, topics)
  }

  private async getNextVersionNumber(brandId: string, customerId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('topic_configurations')
      .select('version')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError(`Failed to determine next topic version: ${error.message}`)
    }

    return data?.version ? data.version + 1 : 1
  }

  private async syncBrandTopics(brandId: string, topics: TopicDTO[]) {
    await supabaseAdmin
      .from('brand_topics')
      .update({ is_active: false })
      .eq('brand_id', brandId)

    if (topics.length === 0) {
      return
    }

    const topicRecords = topics.map((topic, index) => ({
      brand_id: brandId,
      topic_name: topic.name,
      category: topic.category || null,
      description: null,
      priority: index + 1,
      is_active: true,
      metadata: {
        source: topic.source || 'custom',
        relevance: topic.relevance ?? null
      }
    }))

    const { error } = await supabaseAdmin
      .from('brand_topics')
      .upsert(topicRecords, {
        onConflict: 'brand_id,topic_name',
        ignoreDuplicates: false
      })

    if (error) {
      throw new DatabaseError(`Failed to sync brand topics: ${error.message}`)
    }
  }

  private mapConfiguration(row: any, topics: TopicDTO[]): TopicConfigurationDTO {
    return {
      id: row.id,
      brand_id: row.brand_id,
      customer_id: row.customer_id,
      version: row.version,
      is_active: row.is_active,
      change_type: row.change_type,
      change_summary: row.change_summary,
      topics,
      created_at: row.created_at,
      analysis_count: row.metadata?.analysisCount || 0
    }
  }
}

export const topicConfigurationService = new TopicConfigurationService()

