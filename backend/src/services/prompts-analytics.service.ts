import { supabaseAdmin } from '../config/database'
import { DatabaseError } from '../types/auth'
import { OptimizedMetricsHelper } from './query-helpers/optimized-metrics.helper'

interface PromptAnalyticsOptions {
  brandId: string
  customerId: string
  startDate?: string
  endDate?: string
  collectors?: string[]
  competitors?: string[]
  queryTags?: string[]
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
  keywords: string[]
  competitors: string[]
}

interface CollectorResponse {
  collectorResultId: number
  collectorType: string
  response: string
  lastUpdated: string
  brandMentions: number | null
  productMentions: number | null
  competitorMentions: number | null
  keywordCount: number | null
  brandPositions?: number[]
  competitorPositions?: number[]
  mentions: number
  averagePosition: number | null
  soaScore: number | null
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
  responses: CollectorResponse[] // All responses from all collectors
  volumePercentage: number
  volumeCount: number
  sentimentScore: number | null
  visibilityScore: number | null
  mentions: number
  averagePosition: number | null
  soaScore: number | null
  competitorVisibilityMap: Record<string, number>
  competitorSentimentMap: Record<string, number>
  competitorMentionsMap: Record<string, number>
  competitorPositionMap: Record<string, number | null>
  competitorSoaMap: Record<string, number>
  highlights: PromptHighlights
}

interface PromptTopicPayload {
  id: string
  name: string
  promptCount: number
  volumeCount: number
  visibilityScore: number | null
  sentimentScore: number | null
  mentions: number
  averagePosition: number | null
  soaScore: number | null
  competitorVisibilityMap: Record<string, number>
  competitorSentimentMap: Record<string, number>
  competitorMentionsMap: Record<string, number>
  competitorPositionMap: Record<string, number | null>
  competitorSoaMap: Record<string, number>
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
const DEFAULT_LIMIT = 10000 // Increased to ensure we get all responses for all queries

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

const extractCompetitorNames = (...candidates: Array<MetadataRecord | null | undefined>): string[] => {
  const keys = [
    'competitors',
    'competitor_names',
    'competitorNames',
    'competitor_entities',
    'competitorEntities',
    'competitor_mentions',
    'competitorMentions',
    'rivals',
    'rival_names'
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

const normalizeSentiment = (values: number[]): number => {
  if (!values.length) {
    return 50
  }
  const sum = values.reduce((acc, v) => acc + v, 0)
  const avgRaw = sum / values.length
  // incoming scores are expected on [-1, 1]; map to [0, 100]
  const normalized = ((avgRaw + 1) / 2) * 100
  return Math.min(100, Math.max(0, normalized))
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
    const { brandId, customerId, startDate, endDate, collectors, queryTags } = options
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
    const collectorFilterActive = collectorFilter.length > 0

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

    // Fetch ALL available collectors for this brand (not filtered by current selection)
    const { data: allCollectorRows } = await supabaseAdmin
      .from('collector_results')
      .select('collector_type')
      .eq('brand_id', brandRow.id)
      .eq('customer_id', customerId)
      .gte('created_at', normalizedRange.startIsoBound)
      .lte('created_at', normalizedRange.endIsoBound)
      .not('raw_answer', 'is', null)

    const availableCollectors = new Set<string>()
      ; (allCollectorRows ?? []).forEach((row) => {
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

    // Get current active version's query IDs to filter by current version
    let currentVersionQueryIds: Set<string> | null = null
    try {
      const { data: activeConfig } = await supabaseAdmin
        .from('prompt_configurations')
        .select('id')
        .eq('brand_id', brandRow.id)
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .maybeSingle()

      if (activeConfig?.id) {
        const { data: snapshots } = await supabaseAdmin
          .from('prompt_configuration_snapshots')
          .select('query_id')
          .eq('configuration_id', activeConfig.id)
          .eq('is_included', true)

        if (snapshots && snapshots.length > 0) {
          currentVersionQueryIds = new Set(
            snapshots
              .map(s => s.query_id)
              .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          )
        }
      }
    } catch (error) {
      console.warn('Failed to fetch current version query IDs, showing all queries:', error)
      // Continue without filtering if version fetch fails
    }

    // Filter queryIds to only include those in the current version
    const filteredQueryIds = currentVersionQueryIds
      ? queryIds.filter(id => currentVersionQueryIds!.has(id))
      : queryIds

    const queryMetadataMap = new Map<
      string,
      {
        query_text: string | null
        metadata: MetadataRecord | null
      }
    >()

    if (filteredQueryIds.length > 0) {
      let query = supabaseAdmin
        .from('generated_queries')
        .select('id, query_text, metadata')
        .in('id', filteredQueryIds)

      if (queryTags && queryTags.length > 0) {
        query = query.in('query_tag', queryTags)
      }

      const { data: queryRows, error: queryError } = await query

      if (queryError) {
        throw new DatabaseError(`Failed to load query metadata: ${queryError.message}`)
      }

      ; (queryRows ?? []).forEach((row) => {
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
      responses: CollectorResponse[] // Store all responses
      highlights: {
        brand: Set<string>
        products: Set<string>
        keywords: Set<string>
        competitors: Set<string>
      }
    }

    const promptAggregates = new Map<string, PromptAggregate>()
    let missingKeyCounter = 0

    // Filter rows to only include those with queries in the current version AND matching query tags
    const filteredRows = rows.filter(row => {
      const queryId = typeof row.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null

      // Filter by version
      if (currentVersionQueryIds && (!queryId || !currentVersionQueryIds.has(queryId))) {
        return false
      }

      // Filter by query tags (if active)
      // If queryTags are active, we must match against the loaded queryMetadataMap
      // (which only contains queries that matched the tags)
      if (queryTags && queryTags.length > 0) {
        if (!queryId || !queryMetadataMap.has(queryId)) {
          return false
        }
      }

      return true
    })

    for (const row of filteredRows) {
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
          responses: [],
          highlights: {
            brand: new Set<string>(),
            products: new Set<string>(),
            keywords: new Set<string>(),
            competitors: new Set<string>()
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

      // If no brand highlights from metadata but we have a response, try to extract from response text
      if (brandHighlights.length === 0 && response && brandRow.name) {
        const brandName = brandRow.name.trim()
        if (brandName.length > 0) {
          // Escape special regex characters in brand name
          const escapedBrandName = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          // Check if brand name appears in response (case-insensitive word boundary match)
          const brandRegex = new RegExp(`\\b${escapedBrandName}\\b`, 'i')
          if (brandRegex.test(response)) {
            aggregate.highlights.brand.add(brandName)
          }
        }
      }

      const productHighlights = extractProductNames(metadata, queryMetadata)
      productHighlights.forEach((product) => aggregate.highlights.products.add(product))

      const competitorHighlights = extractCompetitorNames(metadata, queryMetadata)
      competitorHighlights.forEach((competitor) => aggregate.highlights.competitors.add(competitor))

      const createdAt =
        typeof row.created_at === 'string' && row.created_at.trim().length > 0 ? row.created_at.trim() : null

      // Store all responses (avoid duplicates by collectorResultId)
      if (collectorResultId !== null && response && collectorType && createdAt) {
        // Check if this response already exists (by collectorResultId)
        const existingIndex = aggregate.responses.findIndex(r => r.collectorResultId === collectorResultId)
        if (existingIndex === -1) {
          aggregate.responses.push({
            collectorResultId,
            collectorType,
            response,
            lastUpdated: createdAt,
            brandMentions: null,
            productMentions: null,
            competitorMentions: null,
            keywordCount: null,
            mentions: 0,
            averagePosition: null,
            soaScore: null
          })
        }
      }

      const shouldUpdate =
        createdAt &&
        (!aggregate.lastUpdated || new Date(createdAt).getTime() >= new Date(aggregate.lastUpdated).getTime())

      if (shouldUpdate) {
        aggregate.collectorResultId = collectorResultId
        aggregate.lastUpdated = createdAt
        aggregate.latestCollectorType = collectorType
        aggregate.response = response
      }
    }

    // Fetch keywords from generated_keywords table for all prompts
    const allQueryIds = Array.from(
      new Set(
        Array.from(promptAggregates.values())
          .map((agg) => agg.queryId)
          .filter((id): id is string => id !== null)
      )
    )
    // CRITICAL FIX: Collect ALL collector_result_ids from ALL responses, not just the latest one per prompt
    // This ensures we fetch metrics for all collectors, not just the latest one
    const allCollectorResultIds = Array.from(
      new Set(
        Array.from(promptAggregates.values())
          .flatMap((agg) =>
            // Get collectorResultId from the aggregate (latest) AND from all responses
            [
              agg.collectorResultId,
              ...agg.responses.map(r => r.collectorResultId)
            ].filter((id): id is number => id !== null)
          )
      )
    )

    console.log(`[PromptsAnalytics] Collecting metrics for ${allCollectorResultIds.length} unique collector_result_ids`);

    const keywordMap = new Map<string, Set<string>>()
    const sentimentMap = new Map<string, number[]>() // key: query_id or collector:<id> -> sentiment values
    const allowedCollectorResultIds = new Set<number>(allCollectorResultIds)
    const keywordCountsByCollector = new Map<number, number>() // collector_result_id -> keyword count (declared early for use in keyword processing)

    if (allQueryIds.length > 0 || allCollectorResultIds.length > 0) {
      const keywordRows: Array<{ keyword: string; query_id: string | null; collector_result_id: number | null }> = []
      let keywordError: any = null

      // Fetch keywords by query_id
      if (allQueryIds.length > 0) {
        const { data: queryKeywordRows, error: queryKeywordError } = await supabaseAdmin
          .from('generated_keywords')
          .select('keyword, query_id, collector_result_id')
          .eq('brand_id', brandRow.id)
          .eq('customer_id', customerId)
          .in('query_id', allQueryIds)

        if (queryKeywordError) {
          keywordError = queryKeywordError
        } else if (queryKeywordRows) {
          keywordRows.push(...queryKeywordRows)
        }
      }

      // Fetch keywords by collector_result_id
      if (!keywordError && allCollectorResultIds.length > 0) {
        const { data: collectorKeywordRows, error: collectorKeywordError } = await supabaseAdmin
          .from('generated_keywords')
          .select('keyword, query_id, collector_result_id')
          .eq('brand_id', brandRow.id)
          .eq('customer_id', customerId)
          .in('collector_result_id', allCollectorResultIds)

        if (collectorKeywordError) {
          keywordError = collectorKeywordError
        } else if (collectorKeywordRows) {
          keywordRows.push(...collectorKeywordRows)
        }
      }

      if (keywordError) {
        console.warn(`Failed to load keywords: ${keywordError.message}`)
      } else {
        console.log(`📊 Fetched ${keywordRows.length} keywords for ${allQueryIds.length} queries and ${allCollectorResultIds.length} collector results`)
        keywordRows.forEach((row) => {
          const collectorResultId =
            typeof row.collector_result_id === 'number' ? row.collector_result_id : null
          if (collectorFilterActive) {
            if (collectorResultId === null || !allowedCollectorResultIds.has(collectorResultId)) {
              return
            }
          }
          if (typeof row.keyword === 'string' && row.keyword.trim().length > 0) {
            const keyword = row.keyword.trim()
            const queryId = typeof row.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null

            // Map keywords by both query_id (primary) and collector_result_id (secondary)
            if (queryId) {
              if (!keywordMap.has(queryId)) {
                keywordMap.set(queryId, new Set<string>())
              }
              keywordMap.get(queryId)!.add(keyword)
            }
            if (collectorResultId !== null) {
              const collectorKey = `collector:${collectorResultId}`
              if (!keywordMap.has(collectorKey)) {
                keywordMap.set(collectorKey, new Set<string>())
              }
              keywordMap.get(collectorKey)!.add(keyword)

              // Count keywords per collector
              const currentCount = keywordCountsByCollector.get(collectorResultId) || 0
              keywordCountsByCollector.set(collectorResultId, currentCount + 1)
            }
          }
        })
      }
    }

    // Add keywords to prompt aggregates - match by query_id first, then collector_result_id
    let keywordsMatched = 0
    promptAggregates.forEach((aggregate) => {
      let matched = 0
      // Try to match by query_id first (primary key for prompts)
      if (aggregate.queryId && keywordMap.has(aggregate.queryId)) {
        const queryKeywords = keywordMap.get(aggregate.queryId)!
        queryKeywords.forEach((keyword) => aggregate.highlights.keywords.add(keyword))
        matched += queryKeywords.size
      }
      // Also match by collector_result_id if no query_id match or as additional source
      if (aggregate.collectorResultId !== null) {
        const collectorKey = `collector:${aggregate.collectorResultId}`
        if (keywordMap.has(collectorKey)) {
          const collectorKeywords = keywordMap.get(collectorKey)!
          collectorKeywords.forEach((keyword) => aggregate.highlights.keywords.add(keyword))
          matched += collectorKeywords.size
        }
      }
      if (matched > 0) {
        keywordsMatched++
        console.log(`✅ Matched ${matched} keywords to prompt "${aggregate.question.substring(0, 50)}..."`)
      }
    })
    console.log(`📊 Matched keywords to ${keywordsMatched} out of ${promptAggregates.size} prompts`)

    // Fetch competitor names from brand_competitors table
    const { data: competitorRows, error: competitorError } = await supabaseAdmin
      .from('brand_competitors')
      .select('competitor_name')
      .eq('brand_id', brandRow.id)

    if (competitorError) {
      console.warn(`Failed to load competitors: ${competitorError.message}`)
    } else {
      const competitorNames = (competitorRows ?? [])
        .map((row) => {
          const name = typeof row?.competitor_name === 'string' ? row.competitor_name.trim() : null
          return name && name.length > 0 ? name : null
        })
        .filter((name): name is string => name !== null)

      if (competitorNames.length > 0) {
        console.log(`📊 Fetched ${competitorNames.length} competitors: ${competitorNames.join(', ')}`)
        // Add competitors to all prompt aggregates
        promptAggregates.forEach((aggregate) => {
          competitorNames.forEach((name) => aggregate.highlights.competitors.add(name))
        })
      }
    }

    // Fetch sentiments and visibility scores
    // Use sentiment_score from new schema (matches dashboard behavior)
    const sentimentByCollectorResult = new Map<number, number>()

    // Fetch visibility scores and sentiment scores
    const visibilityMap = new Map<string, number[]>() // key: query_id or collector:<id> -> visibility values
    const mentionCountsByCollector = new Map<number, {
      brand: number;
      product: number;
      competitor: number;
      keywords: number;
      brandPositions?: number[];
      competitorPositions?: number[];
      competitorVisibilityMap?: Record<string, number>;
      competitorSentimentMap?: Record<string, number>;
      competitorMentionsMap?: Record<string, number>;
      competitorPositionMap?: Record<string, number[]>;
      competitorSoaMap?: Record<string, number>;
      soaScore: number | null;
    }>()
    const mentionCountsByQuery = new Map<string, { brand: number; product: number; competitor: number; keywords: number }>()
    // Note: keywordCountsByCollector is declared earlier (before keyword processing section)

    // Feature flag: default ON. Set USE_OPTIMIZED_PROMPTS_ANALYTICS=false to force legacy behavior.
    const USE_OPTIMIZED_PROMPTS_ANALYTICS = process.env.USE_OPTIMIZED_PROMPTS_ANALYTICS !== 'false';
    const optimizedMetricsHelper = new OptimizedMetricsHelper(supabaseAdmin);

    if (USE_OPTIMIZED_PROMPTS_ANALYTICS) {
      console.log('   ⚡ [Prompts Analytics] Using optimized query (metric_facts + brand_metrics + brand_sentiment)');
    } else {
      console.log('   📋 [Prompts Analytics] Using legacy query (extracted_positions)');
    }

    if (allQueryIds.length > 0 || allCollectorResultIds.length > 0) {
      let visibilityRows: Array<{
        query_id: string | null;
        collector_result_id: number | null;
        collector_type: string | null;
        visibility_index: number | null;
        competitor_name: string | null;
        sentiment_score: number | null;
        total_brand_mentions: number | null;
        total_brand_product_mentions: number | null;
        competitor_mentions: number | null;
        competitor_product_mentions?: number | null;
        competitor_names?: string[];
        brand_positions?: number[];
        competitor_positions?: number[];
        competitor_visibility_map?: Record<string, number>;
        competitor_sentiment_map?: Record<string, number>;
        competitor_mentions_map?: Record<string, number>;
        competitor_positions_map?: Record<string, number[]>;
        competitor_soa_map?: Record<string, number>;
        competitor_count?: number;
        share_of_answers?: number | null;
      }> = [];

      if (USE_OPTIMIZED_PROMPTS_ANALYTICS) {
        // NEW: Use optimized schema
        const result = await optimizedMetricsHelper.fetchPromptsAnalytics({
          brandId: brandRow.id,
          customerId,
          startDate: normalizedRange.startIsoBound,
          endDate: normalizedRange.endIsoBound,
          queryIds: allQueryIds.length > 0 ? allQueryIds : undefined,
          collectorResultIds: allCollectorResultIds.length > 0 ? allCollectorResultIds : undefined,
        });

        if (result.error) {
          console.warn(`Failed to load visibility scores from new schema: ${result.error}`);
        } else {
          // Debug: Log all data to verify counts are being returned for ALL collectors
          console.log(`[PromptsAnalytics] Got ${result.data.length} rows from optimized query`);
          if (result.data && result.data.length > 0) {
            const collectorIds = new Set(result.data.map((r: any) => r.collector_result_id).filter((id: any) => id !== null));
            console.log(`[PromptsAnalytics] Unique collector_result_ids in result: ${collectorIds.size}`);

            // Log first 5 rows with their counts
            result.data.slice(0, 5).forEach((row: any, idx: number) => {
              console.log(`[PromptsAnalytics] Row ${idx + 1}:`, {
                collector_result_id: row.collector_result_id,
                collector_type: row.collector_type,
                total_brand_product_mentions: row.total_brand_product_mentions,
                competitor_count: row.competitor_count,
                competitor_product_count: row.competitor_product_count,
                share_of_answers: row.share_of_answers
              });
            });
          }

          // Transform to match legacy format
          visibilityRows = result.data.map(row => ({
            query_id: row.query_id,
            collector_result_id: row.collector_result_id,
            collector_type: row.collector_type,
            visibility_index: row.visibility_index,
            competitor_name: null, // Brand rows don't have competitor_name
            sentiment_score: row.sentiment_score,
            total_brand_mentions: row.total_brand_mentions,
            total_brand_product_mentions: row.total_brand_product_mentions ?? 0,
            competitor_mentions: row.competitor_count,
            competitor_product_mentions: row.competitor_product_count ?? 0,
            competitor_names: row.competitor_names,
            brand_positions: row.brand_positions ?? [],
            competitor_positions: row.competitor_positions ?? [],
            competitor_visibility_map: row.competitor_visibility_map ?? {},
            competitor_sentiment_map: row.competitor_sentiment_map ?? {},
            competitor_mentions_map: row.competitor_mentions_map ?? {},
            competitor_positions_map: row.competitor_positions_map ?? {},
            competitor_soa_map: (row as any).competitor_soa_map ?? {},
            share_of_answers: (row as any).share_of_answers ?? null,
          }));

          // Add competitor rows (one per competitor)
          result.data.forEach(row => {
            if (row.competitor_names && row.competitor_names.length > 0) {
              row.competitor_names.forEach((compName: string) => {
                visibilityRows.push({
                  query_id: row.query_id,
                  collector_result_id: row.collector_result_id,
                  collector_type: row.collector_type,
                  visibility_index: null, // Competitors don't have visibility
                  competitor_name: compName,
                  sentiment_score: null, // Competitors don't have sentiment in this context
                  total_brand_mentions: null,
                  total_brand_product_mentions: null,
                  competitor_mentions: 1, // One mention per competitor
                });
              });
            }
          });
        }
      } else {
        // LEGACY: Query extracted_positions
        let visibilityQuery = supabaseAdmin
          .from('extracted_positions')
          .select('query_id, collector_result_id, collector_type, visibility_index, competitor_name, sentiment_score, total_brand_mentions, total_brand_product_mentions, competitor_mentions')
          .eq('brand_id', brandRow.id)
          .eq('customer_id', customerId)
          .gte('processed_at', normalizedRange.startIsoBound)
          .lte('processed_at', normalizedRange.endIsoBound)

        // Build the OR condition for query_id and collector_result_id
        const orConditions: string[] = []
        if (allQueryIds.length > 0) {
          orConditions.push(`query_id.in.(${allQueryIds.join(',')})`)
        }
        if (allCollectorResultIds.length > 0) {
          orConditions.push(`collector_result_id.in.(${allCollectorResultIds.join(',')})`)
        }
        if (orConditions.length > 0) {
          visibilityQuery = visibilityQuery.or(orConditions.join(','))
        }

        // Filter by collector_type if multiple collectors are selected
        if (collectorFilterActive) {
          visibilityQuery = visibilityQuery.in('collector_type', collectorFilter)
        }

        const { data: legacyRows, error: visibilityError } = await visibilityQuery

        if (visibilityError) {
          console.warn(`Failed to load visibility scores: ${visibilityError.message}`)
        } else {
          visibilityRows = (legacyRows ?? []).map(row => ({
            ...row,
            competitor_visibility_map: {},
            competitor_sentiment_map: {}
          }))
        }
      }

      // Process rows (same logic for both optimized and legacy)
      if (visibilityRows.length > 0) {
        // Filter by collector_type if needed (applies to BOTH optimized and legacy paths)
        const filteredRows = collectorFilterActive
          ? visibilityRows.filter((row: any) => {
            const rowCollectorType = normalizeCollectorType(row.collector_type)
            return rowCollectorType && collectorFilter.includes(rowCollectorType)
          })
          : visibilityRows

        filteredRows.forEach((row: any) => {
          // Process visibility_index and sentiment_score (from new schema or legacy extracted_positions)
          const isBrandRow = !row?.competitor_name || String(row.competitor_name).trim().length === 0
          const collectorResultId =
            typeof row?.collector_result_id === 'number' ? row.collector_result_id : null
          const queryId = typeof row?.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null

          const brandMentionsRaw =
            typeof row?.total_brand_mentions === 'number'
              ? row.total_brand_mentions
              : typeof row?.total_brand_mentions === 'string'
                ? Number(row.total_brand_mentions)
                : 0
          const productMentionsRaw =
            typeof row?.total_brand_product_mentions === 'number'
              ? row.total_brand_product_mentions
              : typeof row?.total_brand_product_mentions === 'string'
                ? Number(row.total_brand_product_mentions)
                : 0
          // Handle both legacy (competitor_mentions) and new (competitor_count) field names
          const competitorMentionsRaw =
            typeof row?.competitor_mentions === 'number'
              ? row.competitor_mentions
              : typeof row?.competitor_mentions === 'string'
                ? Number(row.competitor_mentions)
                : typeof row?.competitor_count === 'number'
                  ? row.competitor_count
                  : typeof row?.competitor_count === 'string'
                    ? Number(row.competitor_count)
                    : 0

          const brandMentions = Number.isFinite(brandMentionsRaw) ? brandMentionsRaw : 0
          const productMentions = Number.isFinite(productMentionsRaw) ? productMentionsRaw : 0
          const competitorMentions = Number.isFinite(competitorMentionsRaw) ? competitorMentionsRaw : 0

          // IMPORTANT: Only process brand rows for brand/product counts
          // Competitor rows are only for highlighting, not for counting (competitor_count is already in brand row)
          if (collectorResultId !== null && isBrandRow) {
            // Always set counts from brand rows (even if 0) - don't accumulate (to avoid double counting)
            // This ensures each collector has its own counts, even if they're all 0
            const existing = mentionCountsByCollector.get(collectorResultId);
            if (existing) {
              console.warn(`[PromptsAnalytics] ⚠️ Overwriting counts for collector ${collectorResultId}. Existing:`, existing, `New:`, {
                brand: brandMentions,
                product: productMentions,
                competitor: competitorMentions
              });
            }
            mentionCountsByCollector.set(collectorResultId, {
              brand: brandMentions,
              product: productMentions,
              competitor: competitorMentions, // This is competitor_count from brand row (SUM of all competitor mentions)
              keywords: keywordCountsByCollector.get(collectorResultId) || 0,
              brandPositions: Array.isArray(row.brand_positions) ? row.brand_positions : [],
              competitorPositions: Array.isArray(row.competitor_positions) ? row.competitor_positions : [],
              competitorVisibilityMap: row.competitor_visibility_map || {},
              competitorSentimentMap: row.competitor_sentiment_map || {},
              competitorMentionsMap: row.competitor_mentions_map || {},
              competitorPositionMap: row.competitor_positions_map || {},
              competitorSoaMap: row.competitor_soa_map || {},
              soaScore: row.share_of_answers ?? null,
            });

            // Debug log for ALL counts (including 0) to identify missing data
            console.log(`[PromptsAnalytics] Set counts for collector ${collectorResultId} (${row?.collector_type || 'unknown'}):`, {
              brand: brandMentions,
              product: productMentions,
              competitor: competitorMentions,
              keywords: keywordCountsByCollector.get(collectorResultId) || 0,
              has_metrics: brandMentions > 0 || productMentions > 0 || competitorMentions > 0,
              raw_data: {
                total_brand_mentions: row?.total_brand_mentions,
                total_brand_product_mentions: row?.total_brand_product_mentions,
                competitor_mentions: row?.competitor_mentions,
                competitor_count: row?.competitor_count
              }
            });
          }

          // Also track by query for fallback (though we shouldn't use it)
          if (queryId && isBrandRow) {
            const existing = mentionCountsByQuery.get(queryId) ?? { brand: 0, product: 0, competitor: 0, keywords: 0 }
            existing.brand = Math.max(existing.brand, brandMentions) // Use max, not sum
            existing.product = Math.max(existing.product, productMentions)
            existing.competitor = Math.max(existing.competitor, competitorMentions)
            // Keywords are per collector, not per query, so don't set here
            mentionCountsByQuery.set(queryId, existing)
          }
          // Add sentiment from extracted_positions if available (same source as dashboard)
          // Use sentiment_score from extracted_positions table - matches dashboard behavior
          if (row?.collector_result_id && isBrandRow) {
            // Only use brand rows (where competitor_name is null) for sentiment, matching dashboard
            const sentimentValue =
              typeof row?.sentiment_score === 'number'
                ? row.sentiment_score
                : typeof row?.sentiment_score === 'string'
                  ? Number(row.sentiment_score)
                  : null
            if (sentimentValue !== null && sentimentValue !== undefined && Number.isFinite(sentimentValue)) {
              const keyByQuery = typeof row?.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null
              const keyByCollector =
                typeof row?.collector_result_id === 'number' ? `collector:${row.collector_result_id}` : null

              const pushSentiment = (key: string) => {
                const arr = sentimentMap.get(key) ?? []
                arr.push(sentimentValue)
                sentimentMap.set(key, arr)
              }
              // CRITICAL: Always use :brand suffix for brand rows to ensure consistency
              // When multiple collectors are selected, we aggregate sentiment by query_id
              // so all sentiment values for a query from selected collectors are combined
              if (keyByQuery) {
                pushSentiment(keyByQuery + ':brand')
              }
              if (keyByCollector) {
                pushSentiment(keyByCollector + ':brand')
              }
            }
          }

          // Extract visibility scores (only from brand rows)
          // CRITICAL: If visibility_index exists, it means brand WAS mentioned during scoring
          // Use visibility score as source of truth for brand mentions
          const visibilityValue =
            typeof row?.visibility_index === 'number'
              ? row.visibility_index
              : typeof row?.visibility_index === 'string'
                ? Number(row.visibility_index)
                : null
          if (visibilityValue !== null && Number.isFinite(visibilityValue) && isBrandRow) {
            const keyByQuery = typeof row?.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null
            const keyByCollector =
              typeof row?.collector_result_id === 'number' ? `collector:${row.collector_result_id}` : null

            // If visibility score exists, brand was mentioned - add to highlights
            if (brandRow.name && brandRow.name.trim().length > 0) {
              if (keyByQuery) {
                const aggregate = promptAggregates.get(keyByQuery)
                if (aggregate) {
                  aggregate.highlights.brand.add(brandRow.name.trim())
                }
              }
              if (keyByCollector) {
                const aggregate = promptAggregates.get(keyByCollector)
                if (aggregate) {
                  aggregate.highlights.brand.add(brandRow.name.trim())
                }
              }
            }

            const pushVisibility = (key: string) => {
              const arr = visibilityMap.get(key) ?? []
              arr.push(visibilityValue)
              visibilityMap.set(key, arr)
            }
            if (keyByQuery) {
              pushVisibility(keyByQuery)
            }
            if (keyByCollector) {
              pushVisibility(keyByCollector)
            }
          }

          // Extract competitor names from extracted_positions
          if (!isBrandRow) {
            const competitorName = String(row.competitor_name).trim()
            if (competitorName.length > 0) {
              const keyByQuery = typeof row?.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null
              const keyByCollector =
                typeof row?.collector_result_id === 'number' ? `collector:${row.collector_result_id}` : null
              if (keyByQuery) {
                const aggregate = promptAggregates.get(keyByQuery)
                if (aggregate) {
                  aggregate.highlights.competitors.add(competitorName)
                }
              }
              if (keyByCollector) {
                const aggregate = promptAggregates.get(keyByCollector)
                if (aggregate) {
                  aggregate.highlights.competitors.add(competitorName)
                }
              }
            }
          }
        })
      }
    }

    // Remove competitor names from brand highlights to ensure they're highlighted as competitors
    // Use case-insensitive matching to catch variations
    promptAggregates.forEach((aggregate) => {
      const competitorLower = new Set(Array.from(aggregate.highlights.competitors).map(c => c.toLowerCase()))
      const brandNamesToRemove: string[] = []
      aggregate.highlights.brand.forEach((brandName) => {
        if (competitorLower.has(brandName.toLowerCase())) {
          brandNamesToRemove.push(brandName)
        }
      })
      brandNamesToRemove.forEach((name) => aggregate.highlights.brand.delete(name))
    })

    const totalResponses = Array.from(promptAggregates.values()).reduce((sum, aggregate) => sum + aggregate.count, 0)

    // Helper function to extract brand names from response text if not in highlights
    // This ensures visibility scores are only non-zero when brand is actually mentioned
    const extractBrandFromText = (text: string | null, brandName: string): string[] => {
      if (!text || !brandName) return []
      const found: string[] = []
      const brandNameTrimmed = brandName.trim()
      if (brandNameTrimmed.length === 0) return []

      // Escape special regex characters in brand name
      const escapedBrandName = brandNameTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      // Check if brand name appears in text (case-insensitive word boundary match)
      // This ensures we match whole words, not substrings
      try {
        const brandRegex = new RegExp(`\\b${escapedBrandName}\\b`, 'i')
        if (brandRegex.test(text)) {
          found.push(brandNameTrimmed)
        }
      } catch (error) {
        // If regex fails, fall back to simple case-insensitive search
        const textLower = text.toLowerCase()
        const brandLower = brandNameTrimmed.toLowerCase()
        if (textLower.includes(brandLower)) {
          found.push(brandNameTrimmed)
        }
      }

      return found
    }

    const prompts = Array.from(promptAggregates.values()).map<PromptEntryPayload>((aggregate) => {
      // Check visibility scores first - if they exist, brand WAS mentioned (we already added highlights above)
      const byQuery = aggregate.queryId ? visibilityMap.get(aggregate.queryId) ?? [] : []
      const byCollector =
        aggregate.collectorResultId !== null ? visibilityMap.get(`collector:${aggregate.collectorResultId}`) ?? [] : []
      const visibilityValues = [...byQuery, ...byCollector]

      // If visibility score exists, brand was mentioned (highlights already added from extracted_positions)
      // Otherwise, try to extract brand from response text as fallback
      const hasBrandHighlights = aggregate.highlights.brand.size > 0
      let finalBrandHighlights = Array.from(aggregate.highlights.brand)

      // If no brand highlights yet (no visibility score found), try to extract from response text
      if (!hasBrandHighlights && aggregate.response && brandRow.name) {
        const extractedBrands = extractBrandFromText(aggregate.response, brandRow.name)
        extractedBrands.forEach((brand) => aggregate.highlights.brand.add(brand))
        finalBrandHighlights = Array.from(aggregate.highlights.brand)
      }

      const hasFinalBrandHighlights = finalBrandHighlights.length > 0

      // CRITICAL: Visibility scores in database mean brand WAS mentioned during scoring
      // If we have visibility scores but no highlights, something is wrong - trust the visibility score
      if (visibilityValues.length > 0 && !hasFinalBrandHighlights && brandRow.name) {
        // Visibility exists but highlights missing - add brand based on visibility score
        aggregate.highlights.brand.add(brandRow.name.trim())
        finalBrandHighlights = [brandRow.name.trim()]
      }

      // Sort responses by lastUpdated (newest first)
      const sortedResponses = aggregate.responses
        .slice()
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())

      // Debug logging to verify responses are being collected
      if (sortedResponses.length > 1) {
        console.log(`[PromptsAnalytics] Query ${aggregate.queryId || aggregate.id} has ${sortedResponses.length} responses:`,
          sortedResponses.map(r => r.collectorType).join(', '))
      }

      return {
        id: aggregate.id,
        queryId: aggregate.queryId,
        collectorResultId: aggregate.collectorResultId,
        question: aggregate.question,
        topic: aggregate.topic,
        collectorTypes: Array.from(aggregate.collectorTypes).sort((a, b) => a.localeCompare(b)),
        latestCollectorType: aggregate.latestCollectorType,
        lastUpdated: aggregate.lastUpdated,
        response: aggregate.response,
        responses: sortedResponses.map((response) => {
          // IMPORTANT: Only use collector-specific counts, don't fallback to query-level
          // Each collector/LLM should have its own unique counts
          // If a collector doesn't have counts, default to 0s (prevents UI from hiding badges).
          const collectorId = response.collectorResultId
          const counts =
            collectorId !== null ? mentionCountsByCollector.get(collectorId) : undefined
          const keywordCount =
            collectorId !== null ? (keywordCountsByCollector.get(collectorId) ?? 0) : 0
          const effectiveCounts = counts ?? {
            brand: 0,
            product: 0,
            competitor: 0,
            keywords: keywordCount,
            brandPositions: [],
            competitorPositions: [],
            competitorVisibilityMap: {},
            competitorSentimentMap: {},
            competitorMentionsMap: {},
            competitorPositionMap: {},
            competitorSoaMap: {},
            mentions: 0,
            soaScore: null
          }

          // Debug: Log when counts are missing (0) to identify data issues
          if (collectorId !== null && !counts) {
            console.warn(`[PromptsAnalytics] ⚠️ No counts found for collector ${collectorId} (${response.collectorType}). This collector_result_id was not in the metrics query results.`);
          }

          return {
            ...response,
            // Show counts even if they're 0 (0 is a valid count).
            brandMentions: effectiveCounts.brand,
            productMentions: effectiveCounts.product,
            competitorMentions: effectiveCounts.competitor,
            keywordCount,
            brandPositions: effectiveCounts.brandPositions ?? [],
            competitorPositions: effectiveCounts.competitorPositions ?? [],
            competitorVisibilityMap: effectiveCounts.competitorVisibilityMap ?? {},
            competitorSentimentMap: effectiveCounts.competitorSentimentMap ?? {},
            competitorMentionsMap: effectiveCounts.competitorMentionsMap ?? {},
            competitorPositionMap: effectiveCounts.competitorPositionMap ?? {},
            competitorSoaMap: effectiveCounts.competitorSoaMap ?? {},
            mentions: effectiveCounts.brand,
            averagePosition: effectiveCounts.brandPositions && effectiveCounts.brandPositions.length > 0
              ? effectiveCounts.brandPositions.reduce((s, p) => s + p, 0) / effectiveCounts.brandPositions.length
              : null,
            soaScore: effectiveCounts.soaScore
          }
        }),
        volumeCount: aggregate.count,
        volumePercentage:
          totalResponses > 0 ? roundToPrecision((aggregate.count / totalResponses) * 100, 1) : 0,
        sentimentScore: (() => {
          // CRITICAL: Sentiment should only exist when brand is mentioned (has visibility)
          // Sentiment without a brand mention doesn't make logical sense
          if (!hasFinalBrandHighlights) {
            return null
          }

          // Prefer brand-only sentiment if available; otherwise use all rows
          const byQueryBrand = aggregate.queryId ? sentimentMap.get(`${aggregate.queryId}:brand`) ?? [] : []
          const byQueryAll = aggregate.queryId ? sentimentMap.get(`${aggregate.queryId}:all`) ?? [] : []
          const byCollectorBrand =
            aggregate.collectorResultId !== null ? sentimentMap.get(`collector:${aggregate.collectorResultId}:brand`) ?? [] : []
          const byCollectorAll =
            aggregate.collectorResultId !== null ? sentimentMap.get(`collector:${aggregate.collectorResultId}:all`) ?? [] : []

          const preferred = [...byQueryBrand, ...byCollectorBrand]
          const fallback = [...byQueryAll, ...byCollectorAll]
          const values = preferred.length > 0 ? preferred : fallback
          if (values.length === 0) {
            return null
          }
          // Return raw average sentiment in [-1, 1] with higher precision to avoid masking changes
          const avg = values.reduce((sum, v) => sum + v, 0) / values.length
          return roundToPrecision(avg, 4)
        })(),
        visibilityScore: (() => {
          // Visibility scores in extracted_positions are the source of truth
          // If a visibility score exists in the database, it means brand WAS mentioned during scoring
          // We've already ensured brand highlights exist when visibility scores exist (see above)

          // If no visibility values from extracted_positions, return null
          if (visibilityValues.length === 0) {
            return null
          }

          // Calculate average visibility (0-1 scale), rounded to 2 decimals, then convert to 0-100 scale
          const avg = visibilityValues.reduce((sum, v) => sum + v, 0) / visibilityValues.length
          const visibilityScore = roundToPrecision(avg * 100, 1)

          // Return the calculated visibility score
          // Brand highlights should already exist (added when we found visibility scores)
          return visibilityScore
        })(),
        highlights: {
          brand: finalBrandHighlights,
          products: Array.from(aggregate.highlights.products),
          keywords: Array.from(aggregate.highlights.keywords),
          competitors: Array.from(aggregate.highlights.competitors)
        },
        competitorVisibilityMap: (() => {
          const map: Record<string, number[]> = {};
          aggregate.responses.forEach(r => {
            const counts = r.collectorResultId !== null ? mentionCountsByCollector.get(r.collectorResultId) : undefined;
            if (counts?.competitorVisibilityMap) {
              Object.entries(counts.competitorVisibilityMap).forEach(([comp, score]) => {
                if (!map[comp]) map[comp] = [];
                map[comp].push(score);
              });
            }
          });
          const result: Record<string, number> = {};
          Object.entries(map).forEach(([comp, scores]) => {
            result[comp] = roundToPrecision(scores.reduce((a, b) => a + b, 0) / scores.length, 1);
          });
          return result;
        })(),
        competitorSentimentMap: (() => {
          const map: Record<string, number[]> = {};
          aggregate.responses.forEach(r => {
            const counts = r.collectorResultId !== null ? mentionCountsByCollector.get(r.collectorResultId) : undefined;
            if (counts?.competitorSentimentMap) {
              Object.entries(counts.competitorSentimentMap).forEach(([comp, sentiment]) => {
                if (!map[comp]) map[comp] = [];
                map[comp].push(sentiment);
              });
            }
          });
          const result: Record<string, number> = {};
          Object.entries(map).forEach(([comp, values]) => {
            result[comp] = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
          });
          return result;
        })(),
        competitorMentionsMap: (() => {
          const result: Record<string, number> = {};
          aggregate.responses.forEach(r => {
            const counts = r.collectorResultId !== null ? mentionCountsByCollector.get(r.collectorResultId) : undefined;
            if (counts?.competitorMentionsMap) {
              Object.entries(counts.competitorMentionsMap).forEach(([comp, mentions]) => {
                const key = comp.toLowerCase().trim();
                result[key] = (result[key] || 0) + mentions;
              });
            }
          });
          return result;
        })(),
        competitorPositionMap: (() => {
          const map: Record<string, number[]> = {};
          aggregate.responses.forEach(r => {
            const counts = r.collectorResultId !== null ? mentionCountsByCollector.get(r.collectorResultId) : undefined;
            if (counts?.competitorPositionMap) {
              Object.entries(counts.competitorPositionMap).forEach(([comp, positions]) => {
                const key = comp.toLowerCase().trim();
                if (!map[key]) map[key] = [];
                map[key].push(...positions);
              });
            }
          });
          const result: Record<string, number | null> = {};
          Object.entries(map).forEach(([comp, values]) => {
            result[comp] = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
          });
          return result;
        })(),
        mentions: (() => {
          let total = 0;
          aggregate.responses.forEach(r => {
            const counts = r.collectorResultId !== null ? mentionCountsByCollector.get(r.collectorResultId) : undefined;
            if (counts?.brand) total += counts.brand;
          });
          return total;
        })(),
        averagePosition: (() => {
          const allPositions: number[] = [];
          aggregate.responses.forEach(r => {
            const counts = r.collectorResultId !== null ? mentionCountsByCollector.get(r.collectorResultId) : undefined;
            if (counts?.brandPositions) allPositions.push(...counts.brandPositions);
          });
          return allPositions.length > 0 ? allPositions.reduce((s, p) => s + p, 0) / allPositions.length : null;
        })(),
        soaScore: (() => {
          const scores: number[] = [];
          aggregate.responses.forEach(r => {
            const counts = r.collectorResultId !== null ? mentionCountsByCollector.get(r.collectorResultId) : undefined;
            if (counts?.soaScore !== null && counts?.soaScore !== undefined) scores.push(counts.soaScore);
          });
          return scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
        })(),
        competitorSoaMap: (() => {
          const map: Record<string, number[]> = {};
          aggregate.responses.forEach(r => {
            const counts = r.collectorResultId !== null ? mentionCountsByCollector.get(r.collectorResultId) : undefined;
            if (counts?.competitorSoaMap) {
              Object.entries(counts.competitorSoaMap).forEach(([comp, soa]) => {
                const key = comp.toLowerCase().trim();
                if (!map[key]) map[key] = [];
                map[key].push(soa);
              });
            }
          });
          const result: Record<string, number> = {};
          Object.entries(map).forEach(([comp, values]) => {
            result[comp] = values.reduce((s, v) => s + v, 0) / values.length;
          });
          return result;
        })(),
      }
    })

    const topicsMap = new Map<string, PromptTopicPayload>()

    prompts.forEach((prompt) => {
      const topicId = slugify(prompt.topic || 'uncategorized') || 'uncategorized'
      if (!topicsMap.has(topicId)) {
        topicsMap.set(topicId, {
          id: topicId,
          name: prompt.topic || 'Uncategorized',
          promptCount: 0,
          volumeCount: 0,
          visibilityScore: null,
          sentimentScore: null,
          mentions: 0,
          averagePosition: null,
          competitorVisibilityMap: {},
          competitorSentimentMap: {},
          competitorMentionsMap: {},
          competitorPositionMap: {},
          competitorSoaMap: {},
          soaScore: null,
          prompts: []
        })
      }
      const topic = topicsMap.get(topicId)!
      topic.promptCount += 1
      topic.volumeCount += prompt.volumeCount
      topic.prompts.push(prompt)
    })

    const topics = Array.from(topicsMap.values())
      .map((topic) => {
        // Calculate average visibility score for the topic
        // Only include prompts with valid visibility scores (non-null)
        const visibilityScores = topic.prompts
          .map((p) => p.visibilityScore)
          .filter((v): v is number => v !== null && v > 0) // Only count non-zero visibility scores
        const avgVisibility =
          visibilityScores.length > 0
            ? roundToPrecision(visibilityScores.reduce((sum, v) => sum + v, 0) / visibilityScores.length, 1)
            : null

        // Calculate average sentiment score for the topic
        // CRITICAL: Only calculate sentiment from prompts that have visibility > 0
        // Sentiment without visibility (no brand mention) doesn't make sense
        const sentimentScores = topic.prompts
          .filter((p) => p.visibilityScore !== null && p.visibilityScore > 0) // Only prompts with actual mentions
          .map((p) => p.sentimentScore)
          .filter((v): v is number => v !== null)
        const avgSentiment =
          sentimentScores.length > 0
            ? roundToPrecision(sentimentScores.reduce((sum, v) => sum + v, 0) / sentimentScores.length, 4)
            : null

        return {
          ...topic,
          visibilityScore: avgVisibility,
          sentimentScore: avgSentiment,
          competitorVisibilityMap: (() => {
            const map: Record<string, number[]> = {};
            topic.prompts.forEach(p => {
              Object.entries(p.competitorVisibilityMap).forEach(([comp, score]) => {
                if (!map[comp]) map[comp] = [];
                map[comp].push(score);
              });
            });
            const result: Record<string, number> = {};
            Object.entries(map).forEach(([comp, scores]) => {
              const key = comp.toLowerCase().trim();
              result[key] = roundToPrecision(scores.reduce((a, b) => a + b, 0) / scores.length, 1);
            });
            return result;
          })(),
          competitorSentimentMap: (() => {
            const map: Record<string, number[]> = {};
            topic.prompts.forEach(p => {
              Object.entries(p.competitorSentimentMap).forEach(([comp, score]) => {
                if (!map[comp]) map[comp] = [];
                map[comp].push(score);
              });
            });
            const result: Record<string, number> = {};
            Object.entries(map).forEach(([comp, scores]) => {
              const key = comp.toLowerCase().trim();
              result[key] = roundToPrecision(scores.reduce((a, b) => a + b, 0) / scores.length, 4);
            });
            return result;
          })(),
          competitorMentionsMap: (() => {
            const result: Record<string, number> = {};
            topic.prompts.forEach(p => {
              Object.entries(p.competitorMentionsMap).forEach(([comp, count]) => {
                const key = comp.toLowerCase().trim();
                result[key] = (result[key] || 0) + count;
              });
            });
            return result;
          })(),
          competitorPositionMap: (() => {
            const map: Record<string, number[]> = {};
            topic.prompts.forEach(p => {
              Object.entries(p.competitorPositionMap).forEach(([comp, pos]) => {
                if (pos !== null) {
                  const key = comp.toLowerCase().trim();
                  if (!map[key]) map[key] = [];
                  map[key].push(pos);
                }
              });
            });
            const result: Record<string, number | null> = {};
            Object.entries(map).forEach(([comp, positions]) => {
              const key = comp.toLowerCase().trim();
              result[key] = positions.length > 0 ? roundToPrecision(positions.reduce((a, b) => a + b, 0) / positions.length, 1) : null;
            });
            return result;
          })(),
          mentions: topic.prompts.reduce((sum, p) => sum + p.mentions, 0),
          averagePosition: (() => {
            const positions = topic.prompts
              .map(p => p.averagePosition)
              .filter((v): v is number => v !== null);
            return positions.length > 0 ? roundToPrecision(positions.reduce((a, b) => a + b, 0) / positions.length, 1) : null;
          })(),
          soaScore: (() => {
            const scores = topic.prompts
              .map(p => p.soaScore)
              .filter((v): v is number => v !== null);
            return scores.length > 0 ? roundToPrecision(scores.reduce((a, b) => a + b, 0) / scores.length, 1) : null;
          })(),
          competitorSoaMap: (() => {
            const map: Record<string, number[]> = {};
            topic.prompts.forEach(p => {
              Object.entries(p.competitorSoaMap).forEach(([comp, soa]) => {
                const key = comp.toLowerCase().trim();
                if (!map[key]) map[key] = [];
                map[key].push(soa);
              });
            });
            const result: Record<string, number> = {};
            Object.entries(map).forEach(([comp, values]) => {
              const key = comp.toLowerCase().trim();
              result[key] = roundToPrecision(values.reduce((s, v) => s + v, 0) / values.length, 1);
            });
            return result;
          })(),
          prompts: topic.prompts
            .slice()
            .sort((a, b) => b.volumeCount - a.volumeCount || a.question.localeCompare(b.question))
        }
      })
      .sort((a, b) => b.volumeCount - a.volumeCount || a.name.localeCompare(b.name))

    // DEBUG: Log final payload for a specific query to verify structure
    const debugQueryId = "71e1aee0-5df9-44e1-82fe-197bca5fee3d";
    const debugTopic = topics.find(t => t.prompts.some(p => p.queryId === debugQueryId));
    if (debugTopic) {
      const debugPrompt = debugTopic.prompts.find(p => p.queryId === debugQueryId);
      if (debugPrompt) {
        console.log(`[PromptsAnalytics] 📦 Final payload for query ${debugQueryId}:`, JSON.stringify({
          id: debugPrompt.id,
          responseCount: debugPrompt.responses.length,
          responses: debugPrompt.responses.map(r => ({
            type: r.collectorType,
            brandMentions: r.brandMentions,
            productMentions: r.productMentions,
            metrics_source: r.collectorResultId
          }))
        }, null, 2));
      }
    }

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


