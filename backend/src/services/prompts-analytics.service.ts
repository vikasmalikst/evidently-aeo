import { supabaseAdmin } from '../config/database'
import { DatabaseError } from '../types/auth'

interface PromptAnalyticsOptions {
  brandId: string
  customerId: string
  startDate?: string
  endDate?: string
  collectors?: string[]
  limit?: number
}

interface NormalizedRange {
  startDate: Date
  endDate: Date
  startIsoBound: string
  endIsoBound: string
}

interface PromptHighlights {
  brand: string[]
  products: string[]
}

interface PromptEntryPayload {
  id: string
  queryId: string | null
  collectorResultId: number | null
  question: string
  topic: string
  collectorTypes: string[]
  latestCollectorType: string | null
  lastUpdated: string | null
  response: string | null
  volumePercentage: number
  volumeCount: number
  sentimentScore: number | null
  highlights: PromptHighlights
}

interface PromptTopicPayload {
  id: string
  name: string
  promptCount: number
  volumeCount: number
  prompts: PromptEntryPayload[]
}

export interface PromptAnalyticsPayload {
  brandId: string
  brandName: string
  dateRange: {
    start: string
    end: string
  }
  collectors: string[]
  totalPrompts: number
  totalResponses: number
  topics: PromptTopicPayload[]
}

type MetadataRecord = Record<string, unknown>

const DEFAULT_LOOKBACK_DAYS = 30
const DEFAULT_LIMIT = 1000

const parseMetadata = (metadata: unknown): MetadataRecord | null => {
  if (metadata === null || metadata === undefined) {
    return null
  }
  if (typeof metadata === 'object') {
    return metadata as MetadataRecord
  }
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata)
      if (parsed && typeof parsed === 'object') {
        return parsed as MetadataRecord
      }
    } catch {
      return null
    }
  }
  return null
}

const extractTopicName = (...candidates: Array<MetadataRecord | null | undefined>): string | null => {
  for (const candidate of candidates) {
    if (!candidate) continue
    const topicValue = candidate['topic_name'] ?? candidate['topic'] ?? candidate['category']
    if (typeof topicValue === 'string' && topicValue.trim().length > 0) {
      return topicValue.trim()
    }
  }
  return null
}

const toArray = (value: unknown): string[] => {
  if (!value) {
    return []
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : null))
      .filter((item): item is string => Boolean(item && item.trim().length > 0))
      .map((item) => item.trim())
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;]|(?:\s{2,})/u)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
  }
  return []
}

const extractProductNames = (...candidates: Array<MetadataRecord | null | undefined>): string[] => {
  const keys = [
    'products',
    'product_names',
    'productNames',
    'product_entities',
    'productEntities',
    'productHighlights',
    'highlighted_products'
  ]
  const collected = new Set<string>()
  for (const metadata of candidates) {
    if (!metadata) continue
    for (const key of keys) {
      if (metadata[key] !== undefined) {
        toArray(metadata[key]).forEach((value) => {
          const sanitized = value.replace(/\s+/g, ' ').trim()
          if (sanitized.length > 0) {
            collected.add(sanitized)
          }
        })
      }
    }
  }
  return Array.from(collected)
}

const extractBrandAliases = (
  brandName: string,
  ...candidates: Array<MetadataRecord | null | undefined>
): string[] => {
  const keys = [
    'brands',
    'brand_names',
    'brandNames',
    'brand_entities',
    'brandEntities',
    'brand_mentions',
    'brandMentions'
  ]
  const collected = new Set<string>()
  if (brandName.trim().length > 0) {
    collected.add(brandName.trim())
  }
  for (const metadata of candidates) {
    if (!metadata) continue
    for (const key of keys) {
      if (metadata[key] !== undefined) {
        toArray(metadata[key]).forEach((value) => {
          const sanitized = value.replace(/\s+/g, ' ').trim()
          if (sanitized.length > 0) {
            collected.add(sanitized)
          }
        })
      }
    }
  }
  return Array.from(collected)
}

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

const normalizeCollectorType = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const roundToPrecision = (value: number, precision = 1): number => {
  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}

const normalizeRange = (start?: string, end?: string): NormalizedRange => {
  const now = new Date()
  const defaultEnd = new Date(now)
  defaultEnd.setUTCHours(23, 59, 59, 999)

  let endDate = end ? new Date(end) : defaultEnd
  if (Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid end date')
  }
  endDate.setUTCHours(23, 59, 59, 999)

  let startDate = start ? new Date(start) : new Date(endDate)
  if (Number.isNaN(startDate.getTime())) {
    throw new Error('Invalid start date')
  }

  if (!start) {
    startDate.setUTCDate(endDate.getUTCDate() - (DEFAULT_LOOKBACK_DAYS - 1))
  }
  startDate.setUTCHours(0, 0, 0, 0)

  if (startDate.getTime() > endDate.getTime()) {
    throw new Error('startDate must be before endDate')
  }

  return {
    startDate,
    endDate,
    startIsoBound: startDate.toISOString(),
    endIsoBound: endDate.toISOString()
  }
}

export class PromptsAnalyticsService {
  async getPromptAnalytics(options: PromptAnalyticsOptions): Promise<PromptAnalyticsPayload> {
    const { brandId, customerId, startDate, endDate, collectors } = options
    const limit = options.limit ?? DEFAULT_LIMIT

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

    let normalizedRange: NormalizedRange
    try {
      normalizedRange = normalizeRange(startDate, endDate)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid date range'
      throw new Error(message)
    }

    const collectorFilter = Array.isArray(collectors)
      ? collectors.map((value) => normalizeCollectorType(value)).filter((value): value is string => Boolean(value))
      : []

    let collectorQuery = supabaseAdmin
      .from('collector_results')
      .select(
        'id, query_id, collector_type, question, raw_answer, metadata, created_at'
      )
      .eq('brand_id', brandRow.id)
      .eq('customer_id', customerId)
      .gte('created_at', normalizedRange.startIsoBound)
      .lte('created_at', normalizedRange.endIsoBound)
      .not('raw_answer', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (collectorFilter.length > 0) {
      collectorQuery = collectorQuery.in('collector_type', collectorFilter)
    }

    const { data: collectorRows, error: collectorError } = await collectorQuery

    if (collectorError) {
      throw new DatabaseError(`Failed to load prompt responses: ${collectorError.message}`)
    }

    const rows = (collectorRows ?? []).filter(
      (row) => typeof row?.collector_type === 'string' && typeof row?.raw_answer === 'string'
    )

    const availableCollectors = new Set<string>()
    rows.forEach((row) => {
      const collectorType = normalizeCollectorType(row.collector_type)
      if (collectorType) {
        availableCollectors.add(collectorType)
      }
    })

    const queryIds = Array.from(
      new Set(
        rows
          .map((row) => (typeof row.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null))
          .filter((id): id is string => id !== null)
      )
    )

    const queryMetadataMap = new Map<
      string,
      {
        query_text: string | null
        metadata: MetadataRecord | null
      }
    >()

    if (queryIds.length > 0) {
      const { data: queryRows, error: queryError } = await supabaseAdmin
        .from('generated_queries')
        .select('id, query_text, metadata')
        .in('id', queryIds)

      if (queryError) {
        throw new DatabaseError(`Failed to load query metadata: ${queryError.message}`)
      }

      ;(queryRows ?? []).forEach((row) => {
        if (row?.id) {
          queryMetadataMap.set(row.id, {
            query_text: typeof row.query_text === 'string' ? row.query_text : null,
            metadata: parseMetadata(row.metadata)
          })
        }
      })
    }

    interface PromptAggregate {
      id: string
      queryId: string | null
      collectorResultId: number | null
      collectorTypes: Set<string>
      question: string
      topic: string
      count: number
      latestCollectorType: string | null
      lastUpdated: string | null
      response: string | null
      highlights: {
        brand: Set<string>
        products: Set<string>
      }
    }

    const promptAggregates = new Map<string, PromptAggregate>()
    let missingKeyCounter = 0

    for (const row of rows) {
      const collectorResultId = typeof row.id === 'number' ? row.id : null
      const queryId = typeof row.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null
      const collectorType = normalizeCollectorType(row.collector_type)
      const question =
        (typeof row.question === 'string' && row.question.trim().length > 0 ? row.question.trim() : null) ??
        (queryId ? queryMetadataMap.get(queryId)?.query_text ?? null : null) ??
        'Untitled prompt'
      const response = typeof row.raw_answer === 'string' ? row.raw_answer : null
      const metadata = parseMetadata(row.metadata)
      const queryMetadata = queryId ? queryMetadataMap.get(queryId)?.metadata ?? null : null

      const topicName =
        extractTopicName(metadata, queryMetadata) ??
        'Uncategorized'

      let aggregateKey: string
      if (queryId) {
        aggregateKey = queryId
      } else if (collectorResultId !== null) {
        aggregateKey = `collector:${collectorResultId}`
      } else {
        aggregateKey = `collector:missing:${missingKeyCounter}`
        missingKeyCounter += 1
      }

      if (!promptAggregates.has(aggregateKey)) {
        promptAggregates.set(aggregateKey, {
          id: aggregateKey,
          queryId,
          collectorResultId: null,
          collectorTypes: new Set<string>(),
          question,
          topic: topicName,
          count: 0,
          latestCollectorType: null,
          lastUpdated: null,
          response: null,
          highlights: {
            brand: new Set<string>(),
            products: new Set<string>()
          }
        })
      }

      const aggregate = promptAggregates.get(aggregateKey)!
      aggregate.count += 1
      if (collectorType) {
        aggregate.collectorTypes.add(collectorType)
      }

      const brandHighlights = extractBrandAliases(brandRow.name ?? '', metadata, queryMetadata)
      brandHighlights.forEach((alias) => aggregate.highlights.brand.add(alias))

      const productHighlights = extractProductNames(metadata, queryMetadata)
      productHighlights.forEach((product) => aggregate.highlights.products.add(product))

      const createdAt =
        typeof row.created_at === 'string' && row.created_at.trim().length > 0 ? row.created_at.trim() : null

      const shouldUpdate =
        createdAt && (!aggregate.lastUpdated || new Date(createdAt).getTime() >= new Date(aggregate.lastUpdated).getTime())

      if (shouldUpdate) {
        aggregate.collectorResultId = collectorResultId
        aggregate.lastUpdated = createdAt
        aggregate.latestCollectorType = collectorType
        aggregate.response = response
      }
    }

    const totalResponses = Array.from(promptAggregates.values()).reduce((sum, aggregate) => sum + aggregate.count, 0)

    const prompts = Array.from(promptAggregates.values()).map<PromptEntryPayload>((aggregate) => ({
      id: aggregate.id,
      queryId: aggregate.queryId,
      collectorResultId: aggregate.collectorResultId,
      question: aggregate.question,
      topic: aggregate.topic,
      collectorTypes: Array.from(aggregate.collectorTypes).sort((a, b) => a.localeCompare(b)),
      latestCollectorType: aggregate.latestCollectorType,
      lastUpdated: aggregate.lastUpdated,
      response: aggregate.response,
      volumeCount: aggregate.count,
      volumePercentage:
        totalResponses > 0 ? roundToPrecision((aggregate.count / totalResponses) * 100, 1) : 0,
      sentimentScore: null,
      highlights: {
        brand: Array.from(aggregate.highlights.brand),
        products: Array.from(aggregate.highlights.products)
      }
    }))

    const topicsMap = new Map<string, PromptTopicPayload>()

    prompts.forEach((prompt) => {
      const topicId = slugify(prompt.topic || 'uncategorized') || 'uncategorized'
      if (!topicsMap.has(topicId)) {
        topicsMap.set(topicId, {
          id: topicId,
          name: prompt.topic || 'Uncategorized',
          promptCount: 0,
          volumeCount: 0,
          prompts: []
        })
      }
      const topic = topicsMap.get(topicId)!
      topic.promptCount += 1
      topic.volumeCount += prompt.volumeCount
      topic.prompts.push(prompt)
    })

    const topics = Array.from(topicsMap.values())
      .map((topic) => ({
        ...topic,
        prompts: topic.prompts
          .slice()
          .sort((a, b) => b.volumeCount - a.volumeCount || a.question.localeCompare(b.question))
      }))
      .sort((a, b) => b.volumeCount - a.volumeCount || a.name.localeCompare(b.name))

    return {
      brandId: brandRow.id,
      brandName: brandRow.name,
      dateRange: {
        start: normalizedRange.startIsoBound,
        end: normalizedRange.endIsoBound
      },
      collectors: Array.from(availableCollectors).sort((a, b) => a.localeCompare(b)),
      totalPrompts: prompts.length,
      totalResponses,
      topics
    }
  }
}

export const promptsAnalyticsService = new PromptsAnalyticsService()

