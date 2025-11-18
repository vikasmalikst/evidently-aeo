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
  keywords: string[]
  competitors: string[]
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
  visibilityScore: number | null
  highlights: PromptHighlights
}

interface PromptTopicPayload {
  id: string
  name: string
  promptCount: number
  volumeCount: number
  visibilityScore: number | null
  sentimentScore: number | null
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
    ;(allCollectorRows ?? []).forEach((row) => {
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
        keywords: Set<string>
        competitors: Set<string>
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

      const productHighlights = extractProductNames(metadata, queryMetadata)
      productHighlights.forEach((product) => aggregate.highlights.products.add(product))

      const competitorHighlights = extractCompetitorNames(metadata, queryMetadata)
      competitorHighlights.forEach((competitor) => aggregate.highlights.competitors.add(competitor))

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

    // Fetch keywords from generated_keywords table for all prompts
    const allQueryIds = Array.from(
      new Set(
        Array.from(promptAggregates.values())
          .map((agg) => agg.queryId)
          .filter((id): id is string => id !== null)
      )
    )
    const allCollectorResultIds = Array.from(
      new Set(
        Array.from(promptAggregates.values())
          .map((agg) => agg.collectorResultId)
          .filter((id): id is number => id !== null)
      )
    )

    const keywordMap = new Map<string, Set<string>>()
    const sentimentMap = new Map<string, number[]>() // key: query_id or collector:<id> -> sentiment values

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
          if (typeof row.keyword === 'string' && row.keyword.trim().length > 0) {
            const keyword = row.keyword.trim()
            const queryId = typeof row.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null
            const collectorResultId =
              typeof row.collector_result_id === 'number' ? row.collector_result_id : null

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
      .eq('customer_id', customerId)

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

    // Fetch sentiments and visibility scores from extracted_positions for these prompts
    const visibilityMap = new Map<string, number[]>() // key: query_id or collector:<id> -> visibility values
    if (allQueryIds.length > 0 || allCollectorResultIds.length > 0) {
      const { data: sentimentRows, error: sentimentError } = await supabaseAdmin
        .from('extracted_positions')
        .select('query_id, collector_result_id, sentiment_score, visibility_index, competitor_name')
        .eq('brand_id', brandRow.id)
        .eq('customer_id', customerId)
        .gte('processed_at', normalizedRange.startIsoBound)
        .lte('processed_at', normalizedRange.endIsoBound)
        .or(
          [
            allQueryIds.length > 0 ? `query_id.in.(${allQueryIds.join(',')})` : '',
            allCollectorResultIds.length > 0 ? `collector_result_id.in.(${allCollectorResultIds.join(',')})` : ''
          ]
            .filter(Boolean)
            .join(',')
        )

      if (sentimentError) {
        console.warn(`Failed to load sentiments for prompts: ${sentimentError.message}`)
      } else {
        ;(sentimentRows ?? []).forEach((row: any) => {
          const sentimentValue =
            typeof row?.sentiment_score === 'number'
              ? row.sentiment_score
              : typeof row?.sentiment_score === 'string'
                ? Number(row.sentiment_score)
                : null
          if (sentimentValue !== null && Number.isFinite(sentimentValue)) {
            const isBrandRow = !row?.competitor_name || String(row.competitor_name).trim().length === 0
            // Prefer brand rows when present; but store all and filter later
            const keyByQuery = typeof row?.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null
            const keyByCollector =
              typeof row?.collector_result_id === 'number' ? `collector:${row.collector_result_id}` : null

            const pushSentiment = (key: string) => {
              const arr = sentimentMap.get(key) ?? []
              arr.push(sentimentValue)
              sentimentMap.set(key, arr)
            }
            if (keyByQuery) {
              pushSentiment(keyByQuery + (isBrandRow ? ':brand' : ':all'))
            }
            if (keyByCollector) {
              pushSentiment(keyByCollector + (isBrandRow ? ':brand' : ':all'))
            }
          }

          // Extract visibility scores (only from brand rows)
          const visibilityValue =
            typeof row?.visibility_index === 'number'
              ? row.visibility_index
              : typeof row?.visibility_index === 'string'
                ? Number(row.visibility_index)
                : null
          if (visibilityValue !== null && Number.isFinite(visibilityValue)) {
            const isBrandRow = !row?.competitor_name || String(row.competitor_name).trim().length === 0
            if (isBrandRow) {
              const keyByQuery = typeof row?.query_id === 'string' && row.query_id.trim().length > 0 ? row.query_id : null
              const keyByCollector =
                typeof row?.collector_result_id === 'number' ? `collector:${row.collector_result_id}` : null

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
          }

          // Extract competitor names from extracted_positions
          const isBrandRow = !row?.competitor_name || String(row.competitor_name).trim().length === 0
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
      sentimentScore: (() => {
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
        // Return RAW average sentiment in [-1, 1], rounded to 1 decimal
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length
        return roundToPrecision(avg, 1)
      })(),
      visibilityScore: (() => {
        const byQuery = aggregate.queryId ? visibilityMap.get(aggregate.queryId) ?? [] : []
        const byCollector =
          aggregate.collectorResultId !== null ? visibilityMap.get(`collector:${aggregate.collectorResultId}`) ?? [] : []
        const values = [...byQuery, ...byCollector]
        if (values.length === 0) {
          return null
        }
        // Return average visibility (0-1 scale), rounded to 2 decimals, then convert to 0-100 scale
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length
        return roundToPrecision(avg * 100, 1)
      })(),
      highlights: {
        brand: Array.from(aggregate.highlights.brand),
        products: Array.from(aggregate.highlights.products),
        keywords: Array.from(aggregate.highlights.keywords),
        competitors: Array.from(aggregate.highlights.competitors)
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
          visibilityScore: null,
          sentimentScore: null,
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
        const visibilityScores = topic.prompts
          .map((p) => p.visibilityScore)
          .filter((v): v is number => v !== null)
        const avgVisibility =
          visibilityScores.length > 0
            ? roundToPrecision(visibilityScores.reduce((sum, v) => sum + v, 0) / visibilityScores.length, 1)
            : null

        // Calculate average sentiment score for the topic
        const sentimentScores = topic.prompts
          .map((p) => p.sentimentScore)
          .filter((v): v is number => v !== null)
        const avgSentiment =
          sentimentScores.length > 0
            ? roundToPrecision(sentimentScores.reduce((sum, v) => sum + v, 0) / sentimentScores.length, 1)
            : null

        return {
          ...topic,
          visibilityScore: avgVisibility,
          sentimentScore: avgSentiment,
          prompts: topic.prompts
            .slice()
            .sort((a, b) => b.volumeCount - a.volumeCount || a.question.localeCompare(b.question))
        }
      })
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

