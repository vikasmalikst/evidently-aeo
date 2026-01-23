import { supabaseAdmin } from '../../config/database'
import { DatabaseError } from '../../types/auth'
import {
  BrandRow,
  BrandDashboardPayload,
  NormalizedDashboardRange,
  PositionRow,
  CollectorAggregate,
  ScoreMetric,
  DistributionSlice,
  ActionItem,
  TopBrandSource,
  TopicPerformanceRow,
  CompetitorVisibility,
  QueryVisibilityRow
} from './types'
import {
  round,
  toNumber,
  average,
  normalizeSentiment,
  truncateLabel,
  clampPercentage,
  toPercentage,
  DISTRIBUTION_COLORS
} from './utils'
import { visibilityService } from './visibility.service'
import { OptimizedMetricsHelper } from '../query-helpers/optimized-metrics.helper'

/**
 * Helper function to detect if any filters are active
 * When filters are active, we may want to use different aggregation methods
 */
function hasActiveFilters(options: { collectors?: string[] }): boolean {
  const hasCollectorFilter = (options.collectors ?? []).length > 0
  // Add competitor filter check here if you add that feature
  return hasCollectorFilter
}

export async function buildDashboardPayload(
  brand: BrandRow,
  customerId: string,
  range: NormalizedDashboardRange,
  options: { collectors?: string[]; timezoneOffset?: number } = {}
): Promise<BrandDashboardPayload> {
  const requestStart = Date.now()
  let lastMark = requestStart
  const mark = (label: string) => {
    // const now = Date.now()
    // const delta = now - lastMark
    // const total = now - requestStart
    // console.log(`[Dashboard] ⏱ ${label}: +${delta}ms (total ${total}ms)`)
    // lastMark = now
  }

  const startIsoBound = range.startIso
  const endIsoBound = range.endIso

  // Debug: Check what customer_ids exist for this brand in scores table
  const competitorListPromise = (async () => {
    const result = await supabaseAdmin
      .from('brand_competitors')
      .select('competitor_name, metadata')
      .eq('brand_id', brand.id)
      .order('priority', { ascending: true })
    return result
  })()

  /**
   * Fetch positions from NEW OPTIMIZED SCHEMA
   * Joins metric_facts, brand_metrics, competitor_metrics, brand_sentiment, competitor_sentiment
   * Returns data in extracted_positions format for backwards compatibility
   */
  const fetchPositions = async (
    includeCustomer: boolean,
    useCreatedAt: boolean = true
  ) => {
    try {
      const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
      const isRetryable = (error: unknown) => {
        if (!error || typeof error !== 'object') return false
        const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''
        const lower = message.toLowerCase()
        return (
          lower.includes('502') ||
          lower.includes('bad gateway') ||
          lower.includes('<html') ||
          lower.includes('gateway')
        )
      }

      // Fetch metric_facts with brand info from collector_results
      // Prefer created_at, but fallback to processed_at if needed for performance
      const dateColumn = useCreatedAt ? 'created_at' : 'processed_at'
      let metricFactsQuery = supabaseAdmin
        .from('metric_facts')
        .select(`
          id,
          collector_result_id,
          brand_id,
          customer_id,
          query_id,
          collector_type,
          topic,
          processed_at,
          created_at,
          collector_results!inner(brand)
        `)
        .eq('brand_id', brand.id)
        .gte(dateColumn, startIsoBound)
        .lte(dateColumn, endIsoBound)
        .order(dateColumn, { ascending: true })

      if (includeCustomer && customerId) {
        metricFactsQuery = metricFactsQuery.eq('customer_id', customerId)
      }

      const { data: metricFacts, error: metricFactsError } = await metricFactsQuery

      if (metricFactsError) {
        return { data: null, error: metricFactsError }
      }

      if (!metricFacts || metricFacts.length === 0) {
        return { data: [], error: null }
      }

      const metricFactIds = metricFacts.map(mf => mf.id)

      // Smaller chunks to avoid 502 Bad Gateway on large datasets with many competitors
      const chunkSize = 100
      const brandMetricsRows: any[] = []
      const competitorMetricsRows: any[] = []
      const brandSentimentRows: any[] = []
      const competitorSentimentRows: any[] = []

      const fetchChunkWithRetry = async <T>(
        run: () => PromiseLike<{ data: T[] | null; error: any }>
      ): Promise<{ data: T[]; error: unknown | null }> => {
        const maxAttempts = 3
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const result = await run()
          if (!result.error) {
            return { data: result.data ?? [], error: null }
          }
          if (!isRetryable(result.error) || attempt === maxAttempts) {
            return { data: [], error: result.error }
          }
          await sleep(250 * Math.pow(2, attempt - 1))
        }
        return { data: [], error: null }
      }

      // Build all chunks upfront
      const chunks: string[][] = []
      for (let i = 0; i < metricFactIds.length; i += chunkSize) {
        chunks.push(metricFactIds.slice(i, i + chunkSize))
      }

      // Helper to fetch all 4 tables for a single chunk
      const fetchChunkData = async (chunk: string[]) => {
        const [
          brandMetricsResult,
          competitorMetricsResult,
          brandSentimentResult,
          competitorSentimentResult,
        ] = await Promise.all([
          fetchChunkWithRetry(() => supabaseAdmin.from('brand_metrics').select('*').in('metric_fact_id', chunk)),
          fetchChunkWithRetry(() =>
            supabaseAdmin
              .from('competitor_metrics')
              .select(
                `
              metric_fact_id,
              competitor_id,
              visibility_index,
              share_of_answers,
              competitor_positions,
              competitor_mentions,
              brand_competitors!inner(competitor_name)
            `
              )
              .in('metric_fact_id', chunk)
          ),
          fetchChunkWithRetry(() => supabaseAdmin.from('brand_sentiment').select('*').in('metric_fact_id', chunk)),
          fetchChunkWithRetry(() =>
            supabaseAdmin
              .from('competitor_sentiment')
              .select(
                `
              *,
              brand_competitors!inner(competitor_name)
            `
              )
              .in('metric_fact_id', chunk)
          ),
        ])

        if (brandMetricsResult.error) {
          console.error('[Dashboard] Error fetching brand_metrics:', brandMetricsResult.error)
        }
        if (competitorMetricsResult.error) {
          console.error('[Dashboard] Error fetching competitor_metrics:', competitorMetricsResult.error)
        }
        if (brandSentimentResult.error) {
          console.error('[Dashboard] Error fetching brand_sentiment:', brandSentimentResult.error)
        }
        if (competitorSentimentResult.error) {
          console.error('[Dashboard] Error fetching competitor_sentiment:', competitorSentimentResult.error)
        }

        return {
          brandMetrics: brandMetricsResult.data,
          competitorMetrics: competitorMetricsResult.data,
          brandSentiment: brandSentimentResult.data,
          competitorSentiment: competitorSentimentResult.data,
        }
      }

      // Execute ALL chunks in parallel (no sequential waiting between chunks)
      const chunkResults = await Promise.all(chunks.map(fetchChunkData))

      // Merge results from all chunks
      for (const result of chunkResults) {
        brandMetricsRows.push(...result.brandMetrics)
        competitorMetricsRows.push(...result.competitorMetrics)
        brandSentimentRows.push(...result.brandSentiment)
        competitorSentimentRows.push(...result.competitorSentiment)
      }

      const brandMetrics = brandMetricsRows
      const competitorMetrics = competitorMetricsRows
      const brandSentiment = brandSentimentRows
      const competitorSentiment = competitorSentimentRows

      const brandMetricsArray = Array.isArray(brandMetrics) ? brandMetrics : []
      const brandSentimentArray = Array.isArray(brandSentiment) ? brandSentiment : []
      const competitorMetricsArray = Array.isArray(competitorMetrics) ? competitorMetrics : []
      const competitorSentimentArray = Array.isArray(competitorSentiment) ? competitorSentiment : []

      const brandMetricsMap = new Map(brandMetricsArray.map((bm) => [bm.metric_fact_id, bm]))
      const brandSentimentMap = new Map(brandSentimentArray.map((bs) => [bs.metric_fact_id, bs]))
      const competitorMetricsMap = new Map<number, any[]>()
      const competitorSentimentMap = new Map<string, any>()

      competitorMetricsArray.forEach((cm) => {
        if (!competitorMetricsMap.has(cm.metric_fact_id)) {
          competitorMetricsMap.set(cm.metric_fact_id, [])
        }
        competitorMetricsMap.get(cm.metric_fact_id)!.push(cm)
      })

      competitorSentimentArray.forEach((cs) => {
        const key = `${cs.metric_fact_id}:${cs.competitor_id}`
        competitorSentimentMap.set(key, cs)
      })

      const positionRows: any[] = []

      for (const mf of metricFacts) {
        const brandName = (mf.collector_results as any)?.brand || brand.name
        const bm = brandMetricsMap.get(mf.id)
        const bs = brandSentimentMap.get(mf.id)
        const competitorMetricsList = competitorMetricsMap.get(mf.id) || []

        // Create brand row (competitor_name = null)
        positionRows.push({
          brand_name: brandName,
          query_id: mf.query_id,
          collector_result_id: mf.collector_result_id,
          collector_type: mf.collector_type,
          competitor_name: null,
          // IMPORTANT: use nullish coalescing so valid 0 values are preserved (|| would turn 0 into null)
          visibility_index: bm?.visibility_index ?? null,
          visibility_index_competitor: null,
          // IMPORTANT: preserve 0 (0% SOA is a real value) - don't coerce it to null
          share_of_answers_brand: bm?.share_of_answers ?? null,
          share_of_answers_competitor: null,
          sentiment_score: bs?.sentiment_score ?? null,
          sentiment_label: bs?.sentiment_label ?? null,
          sentiment_score_competitor: null,
          sentiment_label_competitor: null,
          total_brand_mentions: bm?.total_brand_mentions ?? 0,
          competitor_mentions: null,
          processed_at: mf.processed_at,
          created_at: mf.created_at,
          brand_positions: bm?.brand_positions ?? [],
          competitor_positions: null,
          has_brand_presence: bm?.has_brand_presence ?? false,
          topic: mf.topic,
          metadata: null,
        })

        // Create competitor rows


        for (const cm of competitorMetricsList) {
          const competitorName = (cm.brand_competitors as any)?.competitor_name
          const csKey = `${mf.id}:${cm.competitor_id}`
          const cs = competitorSentimentMap.get(csKey)

          positionRows.push({
            brand_name: brandName,
            query_id: mf.query_id,
            collector_result_id: mf.collector_result_id,
            collector_type: mf.collector_type,
            competitor_name: competitorName,
            visibility_index: null,
            // Preserve 0 values; only coerce null/undefined
            visibility_index_competitor: cm.visibility_index ?? null,
            share_of_answers_brand: null,
            share_of_answers_competitor: cm.share_of_answers ?? null,
            sentiment_score: null,
            sentiment_label: null,
            sentiment_score_competitor: cs?.sentiment_score ?? null,
            sentiment_label_competitor: cs?.sentiment_label ?? null,
            total_brand_mentions: null,
            competitor_mentions: cm.competitor_mentions ?? 0,
            processed_at: mf.processed_at,
            created_at: mf.created_at,
            brand_positions: null,
            competitor_positions: cm.competitor_positions ?? [],
            has_brand_presence: null,
            topic: mf.topic,
            metadata: null,
          })
        }
      }

      return { data: positionRows, error: null }
    } catch (error) {
      console.error('[Dashboard] Error in fetchPositions:', error)
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) }
      }
    }
  }

  const positionsPromise = (async () => {
    // Try created_at first (preferred)
    const primary = await fetchPositions(true, true)
    if (!primary.error && (primary.data?.length ?? 0) > 0) {
      return primary
    }

    // If nothing came back (likely missing customer_id on rows), retry scoped only by brand with created_at
    const fallbackBrandOnly = await fetchPositions(false, true)
    if (!fallbackBrandOnly.error && (fallbackBrandOnly.data?.length ?? 0) > 0) {
      console.warn(
        `[Dashboard] Fallback used for extracted_positions (brand only, created_at) brand_id=${brand.id}, customer_id=${customerId ?? 'none'}`
      )
      return fallbackBrandOnly
    }

    // If still nothing with created_at, try processed_at as fallback (for performance/compatibility)
    const processedPrimary = await fetchPositions(true, false)
    if (!processedPrimary.error && (processedPrimary.data?.length ?? 0) > 0) {
      console.warn(
        `[Dashboard] Fallback used for extracted_positions (processed_at, customer scoped) brand_id=${brand.id}, customer_id=${customerId ?? 'none'}`
      )
      return processedPrimary
    }

    const processedFallback = await fetchPositions(false, false)
    if (!processedFallback.error && (processedFallback.data?.length ?? 0) > 0) {
      console.warn(
        `[Dashboard] Fallback used for extracted_positions (processed_at, brand only) brand_id=${brand.id}, customer_id=${customerId ?? 'none'}`
      )
      return processedFallback
    }

    // Prefer to return primary error if exists
    return primary.error ? primary : processedFallback
  })()

  const queryCountPromise = (async () => {
    const scoped = await supabaseAdmin
      .from('generated_queries')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('customer_id', customerId)
      .gte('created_at', startIsoBound)
      .lte('created_at', endIsoBound)

    if ((scoped.count ?? 0) > 0 || scoped.error) {
      return scoped
    }

    const fallback = await supabaseAdmin
      .from('generated_queries')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .gte('created_at', startIsoBound)
      .lte('created_at', endIsoBound)

    if ((fallback.count ?? 0) > 0) {
      console.warn(
        `[Dashboard] Fallback used for generated_queries count (brand only) brand_id=${brand.id}, customer_id=${customerId ?? 'none'}`
      )
    }

    return fallback
  })()

  const brandTopicsPromise = (async () => {
    const result = await supabaseAdmin
      .from('brand_topics')
      .select('topic_name, priority')
      .eq('brand_id', brand.id)
      .order('priority', { ascending: true })
    return result
  })()

  const [queryCountResult, positionsResult, competitorResult, brandTopicsResult] = await Promise.all([
    queryCountPromise,
    positionsPromise,
    competitorListPromise,
    brandTopicsPromise
  ])
  mark('initial Supabase queries')

  let totalQueries = queryCountResult.count ?? 0

  if (positionsResult.error) {
    throw new DatabaseError(`Failed to load extracted positions: ${positionsResult.error.message}`)
  }

  if (competitorResult.error) {
    throw new DatabaseError(`Failed to load brand competitors: ${competitorResult.error.message}`)
  }

  const brandTopics =
    brandTopicsResult.error || !brandTopicsResult.data
      ? []
      : brandTopicsResult.data.filter((topic) => topic?.topic_name)

  if (brandTopicsResult.error) {
    console.warn('[Dashboard] Failed to load brand topics:', brandTopicsResult.error.message)
  }

  const rawPositionRows: PositionRow[] = (positionsResult.data as PositionRow[]) ?? []

  const normalizedCollectors = (options.collectors ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)

  const positionRows: PositionRow[] =
    normalizedCollectors.length === 0
      ? rawPositionRows
      : rawPositionRows.filter(
        (row) => normalizedCollectors.includes((row.collector_type ?? 'unknown').toLowerCase())
      )

  // Helper function to extract date from timestamp (YYYY-MM-DD format)
  // Adjusted for user's local timezone to ensure correct day bucketing
  const extractDate = (timestamp: string | null): string | null => {
    if (!timestamp) return null
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return null

      // Apply timezone offset to get local date
      // timezoneOffset is in minutes (UTC - Local). e.g. EST (UTC-5) is 300.
      // We subtract the offset to shift the UTC time to Local time
      // Example: 01:00 UTC (Jan 11) - 300 min (5h) = 20:00 UTC (Jan 10) -> represents 20:00 EST
      const offsetMinutes = options.timezoneOffset || 0
      const localTime = new Date(date.getTime() - (offsetMinutes * 60 * 1000))

      return localTime.toISOString().split('T')[0] // Returns YYYY-MM-DD
    } catch {
      return null
    }
  }

  // Generate all dates in the range for time-series
  // IMPORTANT: Apply timezone offset to convert UTC bounds to local dates
  // This ensures the date range matches the user's local timezone
  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = []

    // Apply timezone offset to convert UTC bounds to local dates
    const offsetMinutes = options.timezoneOffset || 0

    console.log(`[TimeSeries] 🕐 Timezone offset: ${offsetMinutes} minutes`)
    console.log(`[TimeSeries] 📅 UTC bounds: ${start} to ${end}`)

    // Parse ISO timestamps and apply timezone offset
    const startDate = new Date(start)
    const endDate = new Date(end)

    // Shift by timezone offset to get local dates
    // offsetMinutes is (UTC - Local), so we subtract to get local time
    const localStart = new Date(startDate.getTime() - (offsetMinutes * 60 * 1000))
    const localEnd = new Date(endDate.getTime() - (offsetMinutes * 60 * 1000))

    // Extract YYYY-MM-DD in local timezone
    const startDateStr = localStart.toISOString().split('T')[0]
    const endDateStr = localEnd.toISOString().split('T')[0]

    console.log(`[TimeSeries] 📅 Local dates: ${startDateStr} to ${endDateStr}`)

    // Generate range using UTC methods (to avoid further timezone shifts)
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number)
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number)

    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay))
    const endUTC = new Date(Date.UTC(endYear, endMonth - 1, endDay))

    // Generate dates using UTC methods to avoid timezone shifts
    while (current <= endUTC) {
      dates.push(current.toISOString().split('T')[0])
      current.setUTCDate(current.getUTCDate() + 1)
    }

    console.log(`[TimeSeries] 📊 Generated ${dates.length} dates: ${dates[0]} to ${dates[dates.length - 1]}`)

    return dates
  }

  const allDates = generateDateRange(startIsoBound, endIsoBound)

  const trendPercentage = 0
  const knownCompetitors =
    (competitorResult.data ?? [])
      .map((row) => row.competitor_name)
      .filter((name): name is string => Boolean(name)) || []

  const startIso = startIsoBound
  const endIso = endIsoBound

  const queryAggregates = new Map<
    string,
    {
      text: string
      share: number
    }
  >()

  const competitorAggregates = new Map<
    string,
    {
      shareValues: number[]
      visibilityValues: number[]
      sentimentValues: number[]
      mentions: number
      queries: Map<
        string,
        {
          text: string
          shareSum: number
          visibilitySum: number
          sentimentValues: number[]
          mentionSum: number
          count: number
        }
      >
      topics: Map<
        string,
        {
          occurrences: number
          shareSum: number
          visibilitySum: number
          mentions: number
          queryIds: Set<string>
        }
      >
      queryIds: Set<string>
      positiveCollectorResults?: Set<number>
    }
  >()

  const collectorAggregates = new Map<string, CollectorAggregate>()

  const collectorBrandStats = new Map<
    number,
    {
      shareValues: number[]
      visibilityValues: number[]
      sentimentValues: number[]
      brandMentions: number
      hasBrandPresence: boolean
      queryId: string | null
      topic: string | null
    }
  >()

  const collectorResultTopicMap = new Map<number, string | null>()

  const topicAggregates = new Map<
    string,
    {
      queryIds: Set<string>
      shareValues: number[]
      visibilityValues: number[]
      sentimentValues: number[]
      citationUsage: number
      queriesWithBrandPresence: Set<string>
      collectorResultIds: Set<number> // Track all collector results for this topic
      collectorResultsWithBrandPresence: Set<number> // Track collector results with brand presence
      brandMentions: number
    }
  >()

  const topicByQueryId = new Map<string, string>()
  const extractTopicName = (row: any, metadata?: any): string | null => {
    // Priority: 1) row.topic column, 2) metadata.topic_name, 3) metadata.topic
    if (row?.topic && typeof row.topic === 'string' && row.topic.trim().length > 0) {
      return row.topic.trim()
    }
    if (!metadata) {
      return null
    }
    let parsed: any = metadata
    if (typeof metadata === 'string') {
      try {
        parsed = JSON.parse(metadata)
      } catch {
        return null
      }
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const topicName =
      typeof parsed.topic_name === 'string' && parsed.topic_name.trim().length > 0
        ? parsed.topic_name.trim()
        : typeof parsed.topic === 'string' && parsed.topic.trim().length > 0
          ? parsed.topic.trim()
          : null
    return topicName
  }

  // Per-collector scoring: Multiple rows per query (one per collector per competitor)
  // We aggregate across collectors to get average scores per query
  const brandShareByQuery = new Map<string, number[]>() // Changed to array for averaging
  const brandVisibilityByQuery = new Map<string, number[]>() // Changed to array for averaging
  const brandSentimentByQuery = new Map<string, number[]>()
  const queryTextMap = new Map<string, string>()
  const collectorVisibilityMap = new Map<number, number[]>()

  if (positionRows.length > 0) {
    // Get unique collector_result_ids to fetch question text
    const uniqueCollectorResultIds = Array.from(
      new Set(
        positionRows
          .map((row) => row.collector_result_id)
          .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
      )
    )

    if (uniqueCollectorResultIds.length > 0) {
      const chunkSize = 200
      const collectorRows: Array<{ id: number; question: string | null }> = []
      const collectorPromises: Promise<any>[] = []

      for (let i = 0; i < uniqueCollectorResultIds.length; i += chunkSize) {
        const chunk = uniqueCollectorResultIds.slice(i, i + chunkSize)
        collectorPromises.push((async () => {
          const start = Date.now()
          const result = await supabaseAdmin
            .from('collector_results')
            .select('id, question')
            .in('id', chunk)
          // console.log(`[Dashboard] ⏱ collector results query chunk (${chunk.length}): ${Date.now() - start}ms`)
          if (result.error) {
            console.warn(`[Dashboard] Failed to load collector questions chunk: ${result.error.message}`)
            return []
          }
          return result.data ?? []
        })())
      }

      const collectorResults = await Promise.all(collectorPromises)
      collectorResults.flat().forEach((row) => {
        if (typeof row?.id !== 'number' || !Number.isFinite(row.id)) {
          return
        }
        collectorRows.push({
          id: row.id,
          question: typeof row.question === 'string' ? row.question : null
        })
      })



      collectorRows.forEach((collectorRow) => {
        const label =
          typeof collectorRow.question === 'string' && collectorRow.question.trim().length > 0
            ? collectorRow.question.trim()
            : 'Unlabeled query'
        queryTextMap.set(`collector-${collectorRow.id}`, label)
      })
    }
  }


  const uniqueQueryIds = Array.from(
    new Set(
      positionRows
        .map((row) => row.query_id)
        .filter((id): id is string => Boolean(id))
    )
  )

  if (uniqueQueryIds.length > 0) {
    const chunkSize = 200
    const queryRows: Array<{ id: string; query_text: string | null; topic: string | null; metadata: unknown }> = []
    const queryPromises: Promise<any>[] = []

    for (let i = 0; i < uniqueQueryIds.length; i += chunkSize) {
      const chunk = uniqueQueryIds.slice(i, i + chunkSize)
      queryPromises.push((async () => {
        const start = Date.now()
        const result = await supabaseAdmin
          .from('generated_queries')
          .select('id, query_text, topic, metadata')
          .in('id', chunk)
        // console.log(`[Dashboard] ⏱ generated queries lookup chunk (${chunk.length}): ${Date.now() - start}ms`)
        if (result.error) {
          console.warn(`[Dashboard] Failed to load generated queries chunk: ${result.error.message}`)
          return []
        }
        return result.data ?? []
      })())
    }

    const queryResults = await Promise.all(queryPromises)
    queryResults.flat().forEach((row) => {
      if (!row?.id) {
        return
      }
      queryRows.push({
        id: String(row.id),
        query_text: typeof row.query_text === 'string' ? row.query_text : null,
        topic: typeof row.topic === 'string' ? row.topic : null,
        metadata: row.metadata
      })
    })



    queryRows.forEach((query) => {
      if (!query?.id) {
        return
      }
      const label = typeof query.query_text === 'string' && query.query_text.trim().length > 0
        ? query.query_text.trim()
        : 'Unlabeled query'
      queryTextMap.set(query.id, label)

      // Priority: 1) topic column, 2) metadata.topic_name, 3) metadata.topic
      const metadata = query.metadata as Record<string, any> | null | undefined
      const topicName = query.topic ||
        (typeof metadata?.topic_name === 'string' && metadata.topic_name.trim().length > 0
          ? metadata.topic_name.trim()
          : typeof metadata?.topic === 'string' && metadata.topic.trim().length > 0
            ? metadata.topic.trim()
            : null)

      if (topicName) {
        topicByQueryId.set(query.id, topicName)
      }
    })
  }


  let generatedQueryFallback = 0
  let processedRowCount = 0
  const queriesWithBrandPresence = new Set<string>()
  const collectorResultsWithBrandPresence = new Set<number>()
  let brandPresenceRowCount = 0
  let totalBrandRows = 0 // Count of rows where competitor_name is null

  for (const row of positionRows) {
    processedRowCount++
    const queryId = row.query_id ?? `query-${generatedQueryFallback++}`
    const collectorKey = row.collector_result_id ? `collector-${row.collector_result_id}` : undefined
    const queryText =
      (collectorKey ? queryTextMap.get(collectorKey) : undefined) ??
      (row.query_id ? queryTextMap.get(row.query_id) : undefined) ??
      queryTextMap.get(queryId) ??
      'Unlabeled query'
    const normalizedBrandName = (row.brand_name ?? brand.name).toLowerCase()
    const collectorType = row.collector_type ?? 'Unknown'

    if (!queryTextMap.has(queryId)) {
      queryTextMap.set(queryId, queryText)
    }

    // Share of Answers: Keep null as null, only include non-null values in calculations
    // This matches SQL AVG behavior which excludes NULLs
    const brandShareRaw = row.share_of_answers_brand
    const brandShare = (brandShareRaw !== null && brandShareRaw !== undefined)
      ? Math.max(0, toNumber(brandShareRaw))
      : null
    const brandVisibility = Math.max(0, toNumber(row.visibility_index))

    // Use sentiment_score from extracted_positions table only (no fallback to collector_results)
    let brandSentiment: number | null = null
    if (row.sentiment_score !== null && row.sentiment_score !== undefined) {
      brandSentiment = toNumber(row.sentiment_score)
    }
    const hasBrandSentiment = brandSentiment !== null && brandSentiment !== undefined
    const brandSentimentValue = hasBrandSentiment ? brandSentiment : 0

    const hasBrandPresence = row.has_brand_presence === true
    const brandMentions = Math.max(0, toNumber(row.total_brand_mentions))

    if (!brandShareByQuery.has(queryId)) {
      brandShareByQuery.set(queryId, [])
    }

    if (!brandVisibilityByQuery.has(queryId)) {
      brandVisibilityByQuery.set(queryId, [])
    }

    if (!brandSentimentByQuery.has(queryId)) {
      brandSentimentByQuery.set(queryId, [])
    }

    const shareArray = brandShareByQuery.get(queryId)!
    const visibilityArray = brandVisibilityByQuery.get(queryId)!
    const sentimentArray = brandSentimentByQuery.get(queryId)!

    // Use the sentiment value we determined above
    if (hasBrandSentiment) {
      sentimentArray.push(brandSentimentValue)
    }
    // Priority: 1) row.topic column, 2) metadata, 3) query topic mapping
    const metadataTopicName = extractTopicName(row, row.metadata)
    if (metadataTopicName && row.query_id) {
      topicByQueryId.set(row.query_id, metadataTopicName)
    }
    const topicNameRaw =
      metadataTopicName ??
      (row.query_id ? topicByQueryId.get(row.query_id) ?? null : null)
    const topicName = topicNameRaw ? topicNameRaw.trim() : null

    const isBrandRow = !row.competitor_name || row.competitor_name.trim().length === 0


    // Count total brand rows (where competitor_name is null)
    if (isBrandRow) {
      totalBrandRows += 1
    }

    // Count rows where competitor_name is null AND has_brand_presence is true
    if (isBrandRow && hasBrandPresence) {
      brandPresenceRowCount += 1
      queriesWithBrandPresence.add(queryId)
      if (
        typeof row.collector_result_id === 'number' &&
        Number.isFinite(row.collector_result_id)
      ) {
        collectorResultsWithBrandPresence.add(row.collector_result_id)
      }
    }

    // Only push non-null share values (exclude NULLs to match SQL AVG behavior)
    if (isBrandRow || shareArray.length === 0) {
      if (brandShare !== null && Number.isFinite(brandShare) && brandShare >= 0) {
        shareArray.push(brandShare)
      }
    }

    if (isBrandRow || visibilityArray.length === 0) {
      visibilityArray.push(brandVisibility)
    }

    if (hasBrandSentiment && (isBrandRow || sentimentArray.length === 0)) {
      sentimentArray.push(brandSentimentValue)
    }

    if (isBrandRow) {
      if (
        typeof row.collector_result_id === 'number' &&
        Number.isFinite(row.collector_result_id)
      ) {
        const collectorId = row.collector_result_id
        const collectorStats =
          collectorBrandStats.get(collectorId) ?? {
            shareValues: [] as number[],
            visibilityValues: [] as number[],
            sentimentValues: [] as number[],
            brandMentions: 0,
            hasBrandPresence: false,
            queryId: null as string | null,
            topic: null as string | null
          }

        // Only push non-null share values (exclude NULLs to match SQL AVG behavior)
        if (brandShare !== null && Number.isFinite(brandShare)) {
          collectorStats.shareValues.push(brandShare)
        }
        collectorStats.visibilityValues.push(brandVisibility)
        if (hasBrandSentiment) {
          collectorStats.sentimentValues.push(brandSentimentValue)
        }
        if (brandMentions > 0) {
          collectorStats.brandMentions += brandMentions
        }
        collectorStats.hasBrandPresence = collectorStats.hasBrandPresence || hasBrandPresence
        if (row.query_id && !collectorStats.queryId) {
          collectorStats.queryId = row.query_id
        }
        if (topicName) {
          collectorStats.topic = topicName
        }
        collectorBrandStats.set(collectorId, collectorStats)

        if (topicName) {
          collectorResultTopicMap.set(collectorId, topicName)
        } else if (!collectorResultTopicMap.has(collectorId) && collectorStats.topic) {
          collectorResultTopicMap.set(collectorId, collectorStats.topic)
        }

        if (!collectorVisibilityMap.has(collectorId)) {
          collectorVisibilityMap.set(collectorId, [])
        }
        collectorVisibilityMap.get(collectorId)!.push(brandVisibility)
      }

      if (topicName) {
        if (!topicAggregates.has(topicName)) {
          topicAggregates.set(topicName, {
            queryIds: new Set<string>(),
            shareValues: [],
            visibilityValues: [],
            sentimentValues: [],
            citationUsage: 0,
            queriesWithBrandPresence: new Set<string>(),
            collectorResultIds: new Set<number>(),
            collectorResultsWithBrandPresence: new Set<number>(),
            brandMentions: 0
          })
        }
        const topicAggregate = topicAggregates.get(topicName)!
        if (row.query_id) {
          topicAggregate.queryIds.add(row.query_id)
        }
        // Track collector results for brand presence calculation
        if (isBrandRow && row.collector_result_id && typeof row.collector_result_id === 'number' && Number.isFinite(row.collector_result_id)) {
          topicAggregate.collectorResultIds.add(row.collector_result_id)
          // Track collector results with brand presence
          if (hasBrandPresence) {
            topicAggregate.collectorResultsWithBrandPresence.add(row.collector_result_id)
          }
        }
        // Only push non-null share values (exclude NULLs to match SQL AVG behavior)
        if (brandShare !== null && Number.isFinite(brandShare)) {
          topicAggregate.shareValues.push(brandShare)
        }
        topicAggregate.visibilityValues.push(brandVisibility)
        if (hasBrandSentiment) {
          topicAggregate.sentimentValues.push(brandSentimentValue)
        }
        // Only count unique queries with brand presence where competitor_name is null
        // Explicitly check isBrandRow to ensure competitor_name is null/empty
        if (isBrandRow && hasBrandPresence && row.query_id) {
          topicAggregate.queriesWithBrandPresence.add(row.query_id)
        }
        const brandMentionsTopic = Math.max(0, toNumber(row.total_brand_mentions))
        if (brandMentionsTopic > 0) {
          topicAggregate.brandMentions += brandMentionsTopic
        }
        topicAggregates.set(topicName, topicAggregate)
      }

      // Only aggregate collector-level metrics for brand rows
      if (isBrandRow) {
        if (!collectorAggregates.has(collectorType)) {
          collectorAggregates.set(collectorType, {
            shareValues: [],
            visibilityValues: [],
            sentimentValues: [],
            mentions: 0,
            brandPresenceCount: 0,
            uniqueQueryIds: new Set<string>(),
            uniqueCollectorResults: new Set<number>(), // Track unique collector results
            collectorResultsWithBrandPresence: new Set<number>(), // Track unique collector results with brand presence
            topics: new Map()
          })
        }
        const collectorAggregate = collectorAggregates.get(collectorType)!
        // Only push non-null share values (exclude NULLs to match SQL AVG behavior)
        if (brandShare !== null && Number.isFinite(brandShare)) {
          collectorAggregate.shareValues.push(brandShare)
        }
        collectorAggregate.visibilityValues.push(brandVisibility)

        // Add sentiment for brand rows only
        if (hasBrandSentiment) {
          collectorAggregate.sentimentValues.push(brandSentimentValue)
        }

        collectorAggregate.mentions += brandMentions > 0 ? brandMentions : 1

        // Track unique collector results (not rows) for brand presence calculation
        if (row.collector_result_id && typeof row.collector_result_id === 'number' && Number.isFinite(row.collector_result_id)) {
          collectorAggregate.uniqueCollectorResults.add(row.collector_result_id)
          if (hasBrandPresence) {
            collectorAggregate.collectorResultsWithBrandPresence.add(row.collector_result_id)
          }
        }

        // Track unique queries per collector
        if (queryId) {
          collectorAggregate.uniqueQueryIds.add(queryId)
        }

        if (topicName) {
          const topicStats =
            collectorAggregate.topics.get(topicName) ?? {
              occurrences: 0,
              shareSum: 0,
              visibilitySum: 0,
              mentions: 0
            }
          topicStats.occurrences += 1
          // Only add non-null share values (exclude NULLs to match SQL AVG behavior)
          if (brandShare !== null && Number.isFinite(brandShare)) {
            topicStats.shareSum += brandShare
          }
          topicStats.visibilitySum += brandVisibility
          topicStats.mentions += brandMentions > 0 ? brandMentions : 1
          collectorAggregate.topics.set(topicName, topicStats)
        }
      }
    }


    const rawCompetitorName = row.competitor_name?.trim()
    if (!rawCompetitorName) {
      continue
    }
    const isSelfReference = rawCompetitorName.toLowerCase() === normalizedBrandName
    if (isSelfReference) {
      continue
    }
    const competitorName = rawCompetitorName
    // Only include valid competitor SOA values (exclude null/undefined, same as SQL AVG does)
    const competitorShareRaw = row.share_of_answers_competitor
    const competitorShare = (competitorShareRaw !== null && competitorShareRaw !== undefined)
      ? Math.max(0, toNumber(competitorShareRaw))
      : null // Mark as null to exclude from average calculation
    const competitorVisibility = Math.max(0, toNumber(row.visibility_index_competitor))

    // Priority: 1) sentiment_score_competitor from extracted_positions (competitor-specific column)
    // Note: We don't use collector_results sentiment for competitors since that's brand-level sentiment
    let competitorSentiment: number | null = null
    if ((row as any).sentiment_score_competitor !== null && (row as any).sentiment_score_competitor !== undefined) {
      competitorSentiment = toNumber((row as any).sentiment_score_competitor)
    }
    const hasCompetitorSentiment = competitorSentiment !== null && competitorSentiment !== undefined
    const competitorSentimentValue = hasCompetitorSentiment ? competitorSentiment : 0


    const competitorMentions = Math.max(0, toNumber(row.competitor_mentions))

    if (!competitorAggregates.has(competitorName)) {
      competitorAggregates.set(competitorName, {
        shareValues: [],
        visibilityValues: [],
        sentimentValues: [],
        mentions: 0,
        positiveCollectorResults: new Set<number>(), // NEW: Track positive presence
        queries: new Map<
          string,
          {
            text: string
            shareSum: number
            visibilitySum: number
            sentimentValues: number[]
            mentionSum: number
            count: number
          }
        >(),
        topics: new Map<
          string,
          {
            occurrences: number
            shareSum: number
            visibilitySum: number
            mentions: number
            queryIds: Set<string>
          }
        >(),
        queryIds: new Set<string>()
      })
    }

    const competitorAggregate = competitorAggregates.get(competitorName)!

    // Only push valid competitor SOA values (exclude null, matching SQL AVG behavior)
    if (competitorShare !== null && competitorShare !== undefined && Number.isFinite(competitorShare) && competitorShare >= 0) {
      competitorAggregate.shareValues.push(competitorShare)
    }
    competitorAggregate.visibilityValues.push(competitorVisibility)
    if (hasCompetitorSentiment) {
      competitorAggregate.sentimentValues.push(competitorSentimentValue)
    }
    if (competitorMentions > 0) {
      competitorAggregate.mentions += competitorMentions
    } else if (competitorShare > 0) {
      competitorAggregate.mentions += 1
    }

    const competitorQueryAggregate =
      competitorAggregate.queries.get(queryId) ??
      {
        text: queryText,
        shareSum: 0,
        visibilitySum: 0,
        sentimentValues: [] as number[],
        mentionSum: 0,
        count: 0
      }



    // Track valid share values separately to calculate correct average (matching SQL AVG behavior)
    const newShareSum = competitorQueryAggregate.shareSum + (competitorShare !== null && competitorShare !== undefined && Number.isFinite(competitorShare) ? competitorShare : 0)
    const newCount = competitorQueryAggregate.count + 1
    // Note: shareSum / count gives average, but we'll use aggregate.shareValues array for final average instead

    competitorAggregate.queries.set(queryId, {
      text: queryText,
      shareSum: newShareSum, // For backward compatibility, but final average uses shareValues array
      visibilitySum: competitorQueryAggregate.visibilitySum + competitorVisibility,
      sentimentValues: hasCompetitorSentiment
        ? [...competitorQueryAggregate.sentimentValues, competitorSentimentValue]
        : competitorQueryAggregate.sentimentValues,
      mentionSum: competitorQueryAggregate.mentionSum + competitorMentions,
      count: newCount
    })

    // Track positive presence for this competitor in this query/answer
    // A competitor is "present" if they have > 0 visibility, share, or mentions
    const hasPositivePresence = competitorVisibility > 0 || (competitorShare !== null && competitorShare > 0) || competitorMentions > 0

    if (hasPositivePresence) {
      // We'll track this in the query map as well so we can sum it up later
      const queryStats = competitorAggregate.queries.get(queryId)!
      // Add a custom property 'presenceCount' to the query stats object if it doesn't exist
      // Since the type defines specific fields, we might need to rely on the fact that we can extend it or add a map for it
      // To be typesafe, let's update the Map definition in the initialization block (requires editing line 1036-1046)
      // OR simpler: just track a Set of collector_result_ids in the main aggregate
      if (!competitorAggregate.positiveCollectorResults) {
        competitorAggregate.positiveCollectorResults = new Set<number>()
      }
      // collector_result_id is directly on the flattened positionRow, not nested under metric_fact
      const crId = row.collector_result_id
      if (crId) {
        competitorAggregate.positiveCollectorResults.add(Number(crId))
      }
    }

    // Track topics for this competitor
    if (topicName) {
      if (!competitorAggregate.topics.has(topicName)) {
        competitorAggregate.topics.set(topicName, {
          occurrences: 0,
          shareSum: 0,
          visibilitySum: 0,
          mentions: 0,
          queryIds: new Set<string>()
        })
      }
      const topicStats = competitorAggregate.topics.get(topicName)!
      topicStats.occurrences += 1
      // Only add valid competitor share values (exclude null)
      if (competitorShare !== null) {
        topicStats.shareSum += competitorShare
      }
      topicStats.visibilitySum += competitorVisibility
      topicStats.mentions += competitorMentions > 0 ? competitorMentions : 1
      if (queryId) {
        topicStats.queryIds.add(queryId)
      }
      competitorAggregate.topics.set(topicName, topicStats)
    }

    // Track unique query IDs for brand presence calculation
    if (queryId) {
      competitorAggregate.queryIds.add(queryId)
    }

    competitorAggregates.set(competitorName, competitorAggregate)
  }

  // Populate queryAggregates with averaged brand shares
  Array.from(brandShareByQuery.entries()).forEach(([queryId, shareArray]) => {
    const avgShare = shareArray.length > 0 ? average(shareArray) : 0
    const text = queryTextMap.get(queryId) ?? 'Unlabeled query'
    queryAggregates.set(queryId, { text, share: avgShare })
  })

  // Flatten arrays and calculate averages
  const brandShareValues = Array.from(brandShareByQuery.values()).map((arr: number[]) => average(arr))
  const brandVisibilityValues = Array.from(brandVisibilityByQuery.values()).map((arr: number[]) => average(arr))
  // Average sentiment per query first (like share and visibility), then we'll average those query-level averages
  const brandSentimentValues = Array.from(brandSentimentByQuery.values()).map((arr: number[]) => average(arr))

  const uniqueQueries = brandShareByQuery.size
  const queriesWithBrandPresenceCount = queriesWithBrandPresence.size
  const collectorBrandPresenceCount = collectorResultsWithBrandPresence.size

  const collectorVisibilityAverage = new Map<number, number>()
  collectorVisibilityMap.forEach((values, collectorId) => {
    if (!values.length) {
      return
    }
    collectorVisibilityAverage.set(collectorId, average(values))
  })

  // totalQueries = unique queries tracked
  // totalResponses = total score rows (queries × collectors × competitors)
  const totalPositionRows = positionRows.length

  if (totalQueries === 0) {
    totalQueries = uniqueQueries
  }

  const totalResponses = totalPositionRows

  // Check if filters are applied
  const filtersActive = hasActiveFilters(options)

  // Calculate Share of Answers
  // When no filters are applied: use simple average of all share_of_answers_brand values
  // When filters are applied: use simple average of filtered share_of_answers_brand values
  // IMPORTANT: Exclude NULL values (don't convert to 0) to match SQL AVG behavior
  let shareOfAnswersPercentage = 0
  if (!filtersActive) {
    // Simple average: collect all share_of_answers_brand values from brand rows and average them
    // Keep null as null, then filter out nulls (don't convert null to 0)
    const allBrandShareValues = positionRows
      .filter(row => !row.competitor_name || row.competitor_name.trim().length === 0) // Only brand rows
      .map(row => row.share_of_answers_brand) // Keep null as null
      .filter(val => val !== null && val !== undefined) // Filter out nulls
      .map(val => toNumber(val)) // Convert to number only for non-null values
      .filter(val => Number.isFinite(val) && val >= 0) // Filter out invalid numbers

    shareOfAnswersPercentage = allBrandShareValues.length > 0
      ? average(allBrandShareValues)
      : 0
  } else {
    // When filters are applied, still use simple average but only from filtered rows
    // Keep null as null, then filter out nulls (don't convert null to 0)
    const filteredBrandShareValues = positionRows
      .filter(row => !row.competitor_name || row.competitor_name.trim().length === 0) // Only brand rows
      .map(row => row.share_of_answers_brand) // Keep null as null
      .filter(val => val !== null && val !== undefined) // Filter out nulls
      .map(val => toNumber(val)) // Convert to number only for non-null values
      .filter(val => Number.isFinite(val) && val >= 0) // Filter out invalid numbers

    shareOfAnswersPercentage = filteredBrandShareValues.length > 0
      ? average(filteredBrandShareValues)
      : 0
  }

  // Keep these for backward compatibility with other calculations (visibility, competitor comparisons, etc.)
  const brandShareSum = brandShareValues.reduce((sum, value) => sum + value, 0)
  const competitorShareSum = Array.from(competitorAggregates.values()).reduce(
    (sum, aggregate) => sum + aggregate.shareValues.reduce((inner, value) => inner + value, 0),
    0
  )
  const totalShareUniverse = brandShareSum + competitorShareSum

  // Calculate Visibility Index (average prominence across queries)
  const visibilityIndexPercentage = average(brandVisibilityValues) * 100 // Convert 0-1 scale to 0-100

  // Calculate average sentiment: all scores are now in 1-100 format
  // First average per query, then average those query-level averages (same approach as share and visibility)
  // Simple average - return value in 1-100 range (no conversion)
  const avgSentimentPerQuery = average(brandSentimentValues) // Average in 1-100 range
  const sentimentScore = round(avgSentimentPerQuery, 2) // Keep in 1-100 range

  // Fetch citation sources for Source Type Distribution
  const { data: citationsData } = await (async () => {
    const start = Date.now()
    const result = await supabaseAdmin
      .from('citations')
      .select('domain, page_name, url, category, usage_count, collector_result_id')
      .eq('brand_id', brand.id)
      .eq('customer_id', customerId)
      .gte('created_at', startIsoBound)
      .lte('created_at', endIsoBound)
    console.log(`[Dashboard] ⏱ citations query: ${Date.now() - start}ms`)
    return result
  })()

  const categoryVisibilityAggregates = new Map<
    string,
    {
      visibilitySum: number
      weight: number
    }
  >()
  const sourceAggregates = new Map<
    string,
    {
      title: string | null
      url: string | null
      urls: Set<string> // Track all unique URLs for this domain
      domain: string | null
      usage: number
      collectorIds: Set<number>
    }
  >()
  const citationCounts = new Map<string, number>()
  // Track domain usage by category for top sources by type calculation
  const domainUsageByCategory = new Map<string, Map<string, number>>() // category -> domain -> usage count
  if (citationsData && citationsData.length > 0) {
    for (const citation of citationsData) {
      const categoryKey =
        citation.category && citation.category.trim().length > 0
          ? citation.category.trim().toLowerCase()
          : 'other'
      // Exclude NULL usage_count values (don't convert to 1) to match SQL behavior
      // Only count citations with valid usage_count values for Source Type Distribution
      const count = (citation.usage_count !== null && citation.usage_count !== undefined && Number.isFinite(citation.usage_count) && citation.usage_count > 0)
        ? citation.usage_count
        : 0
      // Only add to citationCounts if count > 0 (exclude NULLs from Source Type Distribution)
      if (count > 0) {
        citationCounts.set(categoryKey, (citationCounts.get(categoryKey) || 0) + count)
      }

      // COMMENTED OUT: Normalize URL by removing fragments (#) to avoid duplicate entries for same page
      // This was causing URLs that differ only by trailing slash to be deduplicated
      // Keeping this commented out so we can revert if needed
      // const normalizeUrl = (url: string): string => {
      //   try {
      //     const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      //     // Remove fragment (everything after #)
      //     urlObj.hash = ''
      //     return urlObj.toString().replace(/\/$/, '') // Remove trailing slash for consistency
      //   } catch {
      //     // If URL parsing fails, just remove fragment manually
      //     return url.split('#')[0].replace(/\/$/, '')
      //   }
      // }

      // NEW: Use original URL from database (only trim whitespace, no normalization)
      const normalizeUrl = (url: string): string => {
        // Only trim whitespace, keep everything else as-is (including trailing slashes)
        return url.trim()
      }

      // Extract and normalize domain from URL or use provided domain
      const extractDomain = (url: string | null, domain: string | null): string | null => {
        if (domain && domain.trim().length > 0) {
          // Normalize domain: remove www. prefix and convert to lowercase
          return domain.trim().toLowerCase().replace(/^www\./, '')
        }
        if (url && url.trim().length > 0) {
          try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
            // Remove www. prefix and convert to lowercase
            return urlObj.hostname.toLowerCase().replace(/^www\./, '')
          } catch {
            // If URL parsing fails, try to extract domain manually
            const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i)
            return match ? match[1].toLowerCase().replace(/^www\./, '') : null
          }
        }
        return null
      }

      // Use domain as the key to group all URLs from the same domain together
      const normalizedDomain = extractDomain(
        typeof citation.url === 'string' ? citation.url : null,
        typeof citation.domain === 'string' ? citation.domain : null
      )

      const sourceKey = normalizedDomain
        ? `domain:${normalizedDomain}`
        : `source:${sourceAggregates.size + 1}`

      // Use original URL from database (only trimmed, not normalized)
      const originalUrl = typeof citation.url === 'string' && citation.url.trim().length > 0
        ? citation.url.trim()
        : null

      const existingSource =
        sourceAggregates.get(sourceKey) ?? {
          title:
            typeof citation.page_name === 'string' && citation.page_name.trim().length > 0
              ? citation.page_name.trim()
              : null,
          url: originalUrl,
          urls: new Set<string>(), // Track all unique URLs (exact matches, no normalization)
          domain: citation.domain ?? null,
          usage: 0,
          collectorIds: new Set<number>()
        }

      existingSource.usage += count
      if (
        !existingSource.title &&
        typeof citation.page_name === 'string' &&
        citation.page_name.trim().length > 0
      ) {
        existingSource.title = citation.page_name.trim()
      }
      // Track all unique URLs for this domain (using exact URLs from database)
      if (originalUrl) {
        existingSource.urls.add(originalUrl)
        // Keep the first URL found as primary (or prefer shorter URLs)
        if (!existingSource.url) {
          existingSource.url = originalUrl
        } else if (originalUrl.length < existingSource.url.length) {
          // Prefer shorter URLs (usually the homepage) as primary
          existingSource.url = originalUrl
        }
      }
      // Set normalized domain if not already set
      if (normalizedDomain && (!existingSource.domain || existingSource.domain !== normalizedDomain)) {
        existingSource.domain = normalizedDomain
      }

      // Track domain usage by category for top sources by type calculation
      if (normalizedDomain) {
        if (!domainUsageByCategory.has(categoryKey)) {
          domainUsageByCategory.set(categoryKey, new Map<string, number>())
        }
        const categoryDomainMap = domainUsageByCategory.get(categoryKey)!
        categoryDomainMap.set(normalizedDomain, (categoryDomainMap.get(normalizedDomain) || 0) + count)
      }

      if (
        typeof citation.collector_result_id === 'number' &&
        Number.isFinite(citation.collector_result_id)
      ) {
        existingSource.collectorIds.add(citation.collector_result_id)
        const topicForCitation = collectorResultTopicMap.get(citation.collector_result_id)
        if (topicForCitation) {
          if (!topicAggregates.has(topicForCitation)) {
            topicAggregates.set(topicForCitation, {
              queryIds: new Set<string>(),
              shareValues: [],
              visibilityValues: [],
              sentimentValues: [],
              citationUsage: 0,
              queriesWithBrandPresence: new Set<string>(),
              collectorResultIds: new Set<number>(),
              collectorResultsWithBrandPresence: new Set<number>(),
              brandMentions: 0
            })
          }
          const topicAggregate = topicAggregates.get(topicForCitation)!
          topicAggregate.citationUsage += count
          topicAggregates.set(topicForCitation, topicAggregate)
        }
      }

      sourceAggregates.set(sourceKey, existingSource)

      // Only include citations with valid usage_count in visibility aggregation
      // This ensures visibility-weighted distribution matches citation count distribution
      if (
        count > 0 && // Only process citations with valid usage_count (exclude NULLs)
        citation.collector_result_id !== null &&
        citation.collector_result_id !== undefined &&
        collectorVisibilityAverage.has(citation.collector_result_id)
      ) {
        const visibility = collectorVisibilityAverage.get(citation.collector_result_id) ?? 0
        const entry = categoryVisibilityAggregates.get(categoryKey) ?? {
          visibilitySum: 0,
          weight: 0
        }
        entry.visibilitySum += visibility * count
        entry.weight += count
        categoryVisibilityAggregates.set(categoryKey, entry)
      }
    }
  }

  const totalCitations = Array.from(citationCounts.values()).reduce((sum, count) => sum + count, 0)
  const totalCategoryVisibility = Array.from(categoryVisibilityAggregates.values()).reduce(
    (sum, entry) => sum + entry.visibilitySum,
    0
  )

  let sourceDistribution: DistributionSlice[] = []

  const formatCategoryLabel = (categoryKey: string): string => {
    if (!categoryKey) {
      return 'Other'
    }
    return categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1).replace(/[_-]/g, ' ')
  }

  // Track which categories are in the top 5 (for "Other" aggregation later)
  const top5CategoryKeys = new Set<string>()

  if (totalCategoryVisibility > 0) {
    const sortedCategories = Array.from(categoryVisibilityAggregates.entries()).sort(
      (a, b) => b[1].visibilitySum - a[1].visibilitySum
    )

    let accumulatedVisibility = 0

    sortedCategories.slice(0, 5).forEach(([categoryKey, aggregate], index) => {
      accumulatedVisibility += aggregate.visibilitySum
      top5CategoryKeys.add(categoryKey) // Track top 5 categories
      sourceDistribution.push({
        label: formatCategoryLabel(categoryKey),
        percentage: round((aggregate.visibilitySum / totalCategoryVisibility) * 100),
        color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]
      })
    })

    const othersVisibility = totalCategoryVisibility - accumulatedVisibility
    if (othersVisibility > 1e-6) {
      sourceDistribution.push({
        label: 'Other',
        percentage: round((othersVisibility / totalCategoryVisibility) * 100),
        color: DISTRIBUTION_COLORS[sourceDistribution.length % DISTRIBUTION_COLORS.length]
      })
    }
  }

  // Fallback to query distribution if no domain visibility data
  if (sourceDistribution.length === 0) {
    sourceDistribution.push(...Array.from(queryAggregates.values())
      .sort((a, b) => b.share - a.share)
      .slice(0, 6)
      .map((aggregate, index) => ({
        label: truncateLabel(aggregate.text),
        percentage:
          brandShareSum > 0
            ? round((aggregate.share / brandShareSum) * 100)
            : round(aggregate.share || 0),
        color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]
      })))
  }

  // Calculate category distribution from citations (this is the correct one for Source Type Distribution)
  // Use citationCounts which only includes non-NULL usage_count values
  const categoryDistribution: DistributionSlice[] = Array.from(citationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([categoryKey, count], index) => ({
      label: formatCategoryLabel(categoryKey),
      percentage: totalCitations > 0
        ? round((count / totalCitations) * 100)
        : 0,
      color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]
    }))

  // Update sourceDistribution to use categoryDistribution (citation counts) instead of visibility-weighted
  // This ensures Source Type Distribution shows citation counts, not visibility-weighted percentages
  if (categoryDistribution.length > 0) {
    sourceDistribution = categoryDistribution.slice(0, 6) // Top 6 categories
  }

  // Calculate top 5 sources by source type for tooltip display
  const topSourcesByType: Record<string, Array<{ domain: string; title: string | null; url: string | null; usage: number }>> = {}

  // Helper function to get top sources for a single category
  const getTopSourcesForCategory = (categoryKey: string): Array<{ domain: string; title: string | null; url: string | null; usage: number }> => {
    if (!domainUsageByCategory.has(categoryKey)) {
      return []
    }

    const categoryDomainMap = domainUsageByCategory.get(categoryKey)!

    // Get top 5 domains by usage count
    const topDomains = Array.from(categoryDomainMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // Map domains to source information
    return topDomains
      .map(([domain, usage]) => {
        // Find the source aggregate for this domain
        const sourceKey = `domain:${domain}`
        const sourceAggregate = sourceAggregates.get(sourceKey)

        if (sourceAggregate) {
          return {
            domain,
            title: sourceAggregate.title,
            url: sourceAggregate.url,
            usage
          }
        }

        // Fallback if source aggregate not found
        return {
          domain,
          title: null,
          url: domain ? `https://${domain}` : null,
          usage
        }
      })
      .filter(source => source.domain) // Filter out invalid domains
  }

  // Process each category in sourceDistribution to get top sources
  sourceDistribution.forEach((distributionSlice) => {
    // Special handling for "Other" - aggregate sources from all non-top-5 categories
    if (distributionSlice.label === 'Other') {
      // Aggregate all domains from categories NOT in top 5
      const otherDomainsMap = new Map<string, number>()

      for (const [categoryKey, categoryDomainMap] of domainUsageByCategory.entries()) {
        // Skip categories that are in the top 5
        if (top5CategoryKeys.has(categoryKey)) {
          continue
        }

        // Aggregate usage counts for each domain across all "other" categories
        for (const [domain, usage] of categoryDomainMap.entries()) {
          otherDomainsMap.set(domain, (otherDomainsMap.get(domain) || 0) + usage)
        }
      }

      // Get top 5 domains from aggregated "other" categories
      const topOtherDomains = Array.from(otherDomainsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)

      // Map domains to source information
      const topSources = topOtherDomains
        .map(([domain, usage]) => {
          const sourceKey = `domain:${domain}`
          const sourceAggregate = sourceAggregates.get(sourceKey)

          if (sourceAggregate) {
            return {
              domain,
              title: sourceAggregate.title,
              url: sourceAggregate.url,
              usage
            }
          }

          return {
            domain,
            title: null,
            url: domain ? `https://${domain}` : null,
            usage
          }
        })
        .filter(source => source.domain)

      if (topSources.length > 0) {
        topSourcesByType['Other'] = topSources
      }
      return // Skip normal processing for "Other"
    }

    // Normal processing for non-"Other" categories
    // Normalize the label back to category key (lowercase, handle spaces)
    const categoryKey = distributionSlice.label.toLowerCase().replace(/\s+/g, '_').replace(/[_-]/g, '')

    // Try to find matching category in domainUsageByCategory
    // Check both the normalized key and original category keys
    let matchingCategoryKey: string | null = null
    for (const [key] of domainUsageByCategory.entries()) {
      const normalizedKey = key.toLowerCase().replace(/\s+/g, '_').replace(/[_-]/g, '')
      if (normalizedKey === categoryKey || key.toLowerCase() === categoryKey) {
        matchingCategoryKey = key
        break
      }
    }

    // Also check if the label matches any category directly
    if (!matchingCategoryKey) {
      const labelLower = distributionSlice.label.toLowerCase()
      for (const [key] of domainUsageByCategory.entries()) {
        if (formatCategoryLabel(key).toLowerCase() === labelLower) {
          matchingCategoryKey = key
          break
        }
      }
    }

    if (matchingCategoryKey) {
      const topSources = getTopSourcesForCategory(matchingCategoryKey)
      if (topSources.length > 0) {
        // Use the formatted label as the key (e.g., "Editorial", "Corporate")
        topSourcesByType[distributionSlice.label] = topSources
      }
    }
  })

  const sourceAggregateEntries = Array.from(sourceAggregates.entries()).map(([key, aggregate]) => {
    // Normalize domain: remove www. prefix and convert to lowercase
    let domain = aggregate.domain
    if ((!domain || domain.trim().length === 0) && aggregate.url) {
      try {
        const normalizedUrl = aggregate.url.startsWith('http')
          ? aggregate.url
          : `https://${aggregate.url}`
        domain = new URL(normalizedUrl).hostname
      } catch {
        domain = aggregate.url.replace(/^https?:\/\//, '')
      }
    }
    // Normalize domain to ensure consistency (remove www., lowercase)
    if (domain && domain.trim().length > 0) {
      domain = domain.trim().toLowerCase().replace(/^www\./, '')
    }

    const fallbackLabel =
      domain && domain.trim().length > 0
        ? truncateLabel(domain.trim(), 72)
        : aggregate.url
          ? truncateLabel(aggregate.url.replace(/^https?:\/\//, ''), 72)
          : 'Unknown Source'

    const title =
      aggregate.title && aggregate.title.trim().length > 0
        ? truncateLabel(aggregate.title.trim(), 72)
        : fallbackLabel

    const collectorStats = Array.from(aggregate.collectorIds)
      .map((collectorId) => collectorBrandStats.get(collectorId))
      .filter(
        (
          stats
        ): stats is {
          shareValues: number[]
          visibilityValues: number[]
          sentimentValues: number[]
          brandMentions: number
          hasBrandPresence: boolean
          queryId: string | null
          topic: string | null
        } => Boolean(stats)
      )

    const shareValues = collectorStats.flatMap((stats) => stats.shareValues)
    const visibilityValues = collectorStats.flatMap((stats) => stats.visibilityValues)
    const sentimentValues = collectorStats.flatMap((stats) => stats.sentimentValues)
    const topics = new Set(collectorStats.map((stats) => stats.topic).filter((t): t is string => Boolean(t)))

    const avgShare = shareValues.length > 0 ? average(shareValues) : 0
    const avgVisibilityRaw = visibilityValues.length > 0 ? average(visibilityValues) : 0
    // Average sentiment: all scores are now in 0-100 format, simple average
    const avgSentiment = sentimentValues.length > 0 ? round(average(sentimentValues), 2) : 0

    // Convert URLs Set to sorted array (prefer shorter URLs first)
    // NOTE: URLs are kept as-is from database (no normalization), so URLs differing only by trailing slash are separate
    const allUrls = Array.from(aggregate.urls || new Set<string>())
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      .sort((a, b) => a.length - b.length) // Sort by length (shorter first)

    return {
      key,
      title,
      url: aggregate.url ?? (domain ? `https://${domain}` : ''),
      urls: allUrls.length > 0 ? allUrls : (aggregate.url ? [aggregate.url] : []), // All unique URLs
      domain: domain ?? 'unknown',
      usage: aggregate.usage,
      share: avgShare, // Already in 0-100 format (from position-extraction.service.ts)
      visibility: avgVisibilityRaw * 100, // Convert 0-1 scale to 0-100 percentage
      sentiment: avgSentiment, // Average sentiment (-1 to 1 scale)
      topicsCount: topics.size, // Number of unique topics
      collectorIds: aggregate.collectorIds // Preserve collectorIds for mentionRate calculation
    }
  })

  const maxSourceUsage = sourceAggregateEntries.reduce(
    (max, source) => (source.usage > max ? source.usage : max),
    0
  )

  // Calculate max values for Value score normalization
  const maxTopicsCount = sourceAggregateEntries.reduce(
    (max, source) => ((source.topicsCount || 0) > max ? (source.topicsCount || 0) : max),
    1
  )

  // Group by normalized domain to ensure no duplicates
  const domainMap = new Map<string, Omit<typeof sourceAggregateEntries[0], 'urls' | 'collectorIds'> & {
    urls?: string[] | Set<string>;
    collectorIds?: Set<number>;
    sentiment?: number;
    topicsCount?: number;
  }>()

  sourceAggregateEntries.forEach((source) => {
    const normalizedDomain = source.domain?.toLowerCase().replace(/^www\./, '') || 'unknown'
    const existing = domainMap.get(normalizedDomain)

    if (!existing) {
      // Keep URLs as Set and preserve collectorIds from source aggregate
      const sourceAggregate = sourceAggregates.get(source.key)
      // Convert URLs array to Set if needed, or use existing Set
      let urlsSet: Set<string>
      if (source.urls) {
        if (Array.isArray(source.urls)) {
          urlsSet = new Set(source.urls)
        } else if (source.urls && typeof source.urls === 'object' && 'has' in source.urls && 'add' in source.urls) {
          urlsSet = source.urls as Set<string>
        } else {
          urlsSet = new Set<string>()
        }
      } else {
        urlsSet = new Set<string>()
      }
      domainMap.set(normalizedDomain, {
        ...source,
        urls: urlsSet,
        collectorIds: sourceAggregate?.collectorIds ? new Set(sourceAggregate.collectorIds) : new Set<number>()
      })
    } else {
      // Merge entries with same domain: combine usage, share, visibility, sentiment, topics
      existing.usage += source.usage
      // Average share, visibility, and sentiment (weighted by usage)
      const totalUsage = existing.usage + source.usage
      if (totalUsage > 0) {
        existing.share = (existing.share * existing.usage + source.share * source.usage) / totalUsage
        existing.visibility = (existing.visibility * existing.usage + source.visibility * source.usage) / totalUsage
        // For sentiment, average across all values (not weighted by usage)
        const existingSentiment = existing.sentiment || 0
        const sourceSentiment = source.sentiment || 0
        existing.sentiment = (existingSentiment + sourceSentiment) / 2
      }
      // For topics, take the maximum count (union would require tracking all topics)
      existing.topicsCount = Math.max(existing.topicsCount || 0, source.topicsCount || 0)
      // Merge collectorIds sets to track all collector results citing this domain
      const sourceAggregate = sourceAggregates.get(source.key)
      if (sourceAggregate?.collectorIds) {
        if (!existing.collectorIds) {
          existing.collectorIds = new Set<number>()
        }
        sourceAggregate.collectorIds.forEach(id => existing.collectorIds!.add(id))
      }
      // Merge URLs sets to include all unique URLs from all merged sources
      // NOTE: URLs are kept as-is from database (only trimmed, no normalization)
      // This means URLs that differ only by trailing slash will be kept as separate entries
      if (source.urls) {
        if (!existing.urls) {
          existing.urls = new Set<string>()
        }
        const existingUrlsSet: Set<string> = existing.urls && typeof existing.urls === 'object' && 'has' in existing.urls && 'add' in existing.urls
          ? existing.urls as Set<string>
          : new Set(Array.isArray(existing.urls) ? existing.urls : [])
        const sourceUrlsArray = Array.isArray(source.urls) ? source.urls : Array.from(source.urls as Set<string>)
        sourceUrlsArray.forEach(url => {
          if (url && typeof url === 'string' && url.trim().length > 0) {
            // Add URL as-is (only trimmed) - Set will deduplicate exact matches
            existingUrlsSet.add(url.trim())
          }
        })
        existing.urls = existingUrlsSet
      }
      // Keep the shorter URL (usually homepage) as primary
      if (source.url && (!existing.url || source.url.length < existing.url.length)) {
        existing.url = source.url
      }
      // Keep the better title if available
      if (source.title && (!existing.title || source.title.length < existing.title.length)) {
        existing.title = source.title
      }
    }
  })

  // Calculate total collector_results count for mentionRate calculation
  // Get unique collector_result_ids from all position rows
  const uniqueCollectorResultIdsForMentionRate = new Set<number>()
  positionRows.forEach((row) => {
    if (row.collector_result_id && typeof row.collector_result_id === 'number' && Number.isFinite(row.collector_result_id)) {
      uniqueCollectorResultIdsForMentionRate.add(row.collector_result_id)
    }
  })
  const totalCollectorResultsCount = uniqueCollectorResultIdsForMentionRate.size || 1 // Avoid division by zero

  // Step: Calculate previous period data for historical change comparison
  // Compare the most recent day in the current period to the previous day
  // Example: If viewing Dec 1-2, compare Dec 2 (most recent) to Dec 1 (previous day)
  // Example: If viewing Dec 2 only, compare Dec 2 to Dec 1 (previous day)
  const previousPeriodStartTime = Date.now()

  // Use the end date of the current period as the "current day" to compare
  const currentDay = new Date(range.endDate)
  currentDay.setUTCHours(0, 0, 0, 0) // Start of the most recent day

  // Previous day is one day before the current day
  const previousDay = new Date(currentDay)
  previousDay.setUTCDate(previousDay.getUTCDate() - 1)

  // Previous period is just the previous day (00:00:00 to 23:59:59)
  const previousStart = new Date(previousDay)
  previousStart.setUTCHours(0, 0, 0, 0)
  const previousEnd = new Date(previousDay)
  previousEnd.setUTCHours(23, 59, 59, 999)


  // Fetch previous period citations and positions
  const { data: previousCitations, error: prevCitationsError } = await supabaseAdmin
    .from('citations')
    .select('domain, url, usage_count, collector_result_id')
    .eq('brand_id', brand.id)
    .eq('customer_id', customerId)
    .gte('created_at', previousStart.toISOString())
    .lt('created_at', previousEnd.toISOString())

  if (prevCitationsError) {
    console.warn(`[Dashboard] Error fetching previous period citations: ${prevCitationsError.message}`)
  }

  // Fetch previous period positions from new optimized schema
  const optimizedMetricsHelper = new OptimizedMetricsHelper(supabaseAdmin)
  let previousPositions: Array<{
    collector_result_id: number | null
    share_of_answers_brand: number | null
    visibility_index: number | null
  }> | null = null
  let prevPositionsError: Error | null = null

  try {
    const result = await optimizedMetricsHelper.fetchBrandMetricsByDateRange({
      brandId: brand.id,
      customerId,
      startDate: previousStart.toISOString(),
      endDate: previousEnd.toISOString(),
      includeSentiment: false, // We only need SOA and visibility for previous period
    })

    if (result.success && result.data.length > 0) {
      // Transform to match legacy format for backwards compatibility
      previousPositions = result.data.map(row => ({
        collector_result_id: row.collector_result_id,
        share_of_answers_brand: row.share_of_answers, // Map share_of_answers to share_of_answers_brand
        visibility_index: row.visibility_index,
      }))
    } else if (result.error) {
      prevPositionsError = new Error(result.error)
      console.warn(`[Dashboard] Error fetching previous period positions from new schema: ${result.error}`)
    }
  } catch (error) {
    prevPositionsError = error instanceof Error ? error : new Error(String(error))
    console.warn(`[Dashboard] Error fetching previous period positions: ${prevPositionsError.message}`)
  }

  // Aggregate previous period data by domain
  const previousSourceAggregates = new Map<string, {
    usage: number
    share: number[]
    visibility: number[]
    collectorIds: Set<number>
  }>()

  // Helper to extract and normalize domain (same logic as current period)
  const extractDomain = (url: string | null, domain: string | null): string | null => {
    if (domain && domain.trim().length > 0) {
      return domain.trim().toLowerCase().replace(/^www\./, '')
    }
    if (url && url.trim().length > 0) {
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
        return urlObj.hostname.toLowerCase().replace(/^www\./, '')
      } catch {
        const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i)
        return match ? match[1].toLowerCase().replace(/^www\./, '') : null
      }
    }
    return null
  }

  // Process previous period citations
  if (previousCitations && previousCitations.length > 0) {
    for (const citation of previousCitations) {
      const normalizedDomain = extractDomain(
        typeof citation.url === 'string' ? citation.url : null,
        typeof citation.domain === 'string' ? citation.domain : null
      )

      if (!normalizedDomain) continue

      const sourceKey = normalizedDomain

      if (!previousSourceAggregates.has(sourceKey)) {
        previousSourceAggregates.set(sourceKey, {
          usage: 0,
          share: [],
          visibility: [],
          collectorIds: new Set<number>()
        })
      }

      const prev = previousSourceAggregates.get(sourceKey)!
      // Exclude NULL usage_count values (don't convert to 1) to match SQL behavior
      if (citation.usage_count !== null && citation.usage_count !== undefined && Number.isFinite(citation.usage_count) && citation.usage_count > 0) {
        prev.usage += citation.usage_count
      }

      if (citation.collector_result_id && typeof citation.collector_result_id === 'number') {
        prev.collectorIds.add(citation.collector_result_id)
      }
    }
  }

  // Process previous period positions to get share and visibility
  if (previousPositions && previousPositions.length > 0) {
    // Create a map of collector_result_id to domain from citations
    const collectorIdToDomain = new Map<number, string>()
    if (previousCitations) {
      for (const citation of previousCitations) {
        if (citation.collector_result_id && typeof citation.collector_result_id === 'number') {
          const normalizedDomain = extractDomain(
            typeof citation.url === 'string' ? citation.url : null,
            typeof citation.domain === 'string' ? citation.domain : null
          )
          if (normalizedDomain) {
            collectorIdToDomain.set(citation.collector_result_id, normalizedDomain)
          }
        }
      }
    }

    // Get domain from citations map (extracted_positions doesn't have domain column)
    for (const position of previousPositions) {
      if (!position.collector_result_id) continue

      // Domain comes from citations, not positions
      const domain = collectorIdToDomain.get(position.collector_result_id)

      if (!domain) continue

      if (!previousSourceAggregates.has(domain)) {
        previousSourceAggregates.set(domain, {
          usage: 0,
          share: [],
          visibility: [],
          collectorIds: new Set<number>()
        })
      }

      const prev = previousSourceAggregates.get(domain)!

      if (position.share_of_answers_brand !== null && position.share_of_answers_brand !== undefined) {
        prev.share.push(toNumber(position.share_of_answers_brand))
      }

      if (position.visibility_index !== null && position.visibility_index !== undefined) {
        // visibility_index is 0-1 scale, convert to 0-100 for consistency
        prev.visibility.push(toNumber(position.visibility_index) * 100)
      }
    }
  }

  // Calculate previous period values (for change tracking)
  // Note: We'll calculate Value in the same way as current period
  const previousValues = new Map<string, number>()
  const previousMaxUsage = Array.from(previousSourceAggregates.values()).reduce(
    (max, source) => (source.usage > max ? source.usage : max),
    0
  )

  for (const [domain, prev] of previousSourceAggregates.entries()) {
    const avgShare = prev.share.length > 0 ? average(prev.share) : 0
    const avgVisibility = prev.visibility.length > 0 ? average(prev.visibility) : 0

    // Calculate Value using same formula as current period
    // For previous period, we don't have sentiment/topics, so we'll use available data
    const normalizedVisibility = Math.min(100, Math.max(0, avgVisibility))
    const normalizedSOA = Math.min(100, Math.max(0, avgShare))
    const normalizedCitations = previousMaxUsage > 0 ? Math.min(100, (prev.usage / previousMaxUsage) * 100) : 0
    // Use placeholders for sentiment and topics (50 for sentiment, 50 for topics) if not available
    const normalizedSentiment = 50 // Default neutral if not available
    const normalizedTopics = 50 // Default middle if not available

    const value = round(
      (normalizedVisibility * 0.2) +
      (normalizedSOA * 0.2) +
      (normalizedSentiment * 0.2) +
      (normalizedCitations * 0.2) +
      (normalizedTopics * 0.2),
      1
    )
    previousValues.set(domain, value)
  }

  const previousPeriodDuration = Date.now() - previousPeriodStartTime

  const topBrandSources = Array.from(domainMap.values())
    .map((source) => {
      // Calculate mentionRate: percentage of total collector results where this source is cited
      // Formula: (Number of unique collector results citing this source / Total collector results) * 100
      const uniqueCollectorResultsCitingSource = source.collectorIds ? source.collectorIds.size : 0
      const mentionRate = totalCollectorResultsCount > 0
        ? (uniqueCollectorResultsCitingSource / totalCollectorResultsCount) * 100
        : 0

      // Calculate Value: Composite score based on Visibility, SOA, Sentiment, Citations and Topics
      // Same formula as in source-attribution.service.ts
      const normalizedVisibility = Math.min(100, Math.max(0, source.visibility))
      const normalizedSOA = Math.min(100, Math.max(0, source.share))
      // Sentiment is already in 0-100 range, just clamp it
      const normalizedSentiment = Math.min(100, Math.max(0, source.sentiment || 0))
      const normalizedCitations = maxSourceUsage > 0 ? Math.min(100, (source.usage / maxSourceUsage) * 100) : 0
      const normalizedTopics = maxTopicsCount > 0 ? Math.min(100, ((source.topicsCount || 0) / maxTopicsCount) * 100) : 0

      const value = round(
        (normalizedVisibility * 0.2) +
        (normalizedSOA * 0.2) +
        (normalizedSentiment * 0.2) +
        (normalizedCitations * 0.2) +
        (normalizedTopics * 0.2),
        1
      )

      // Calculate change from previous period
      // Match by normalized domain (same as used in previous period aggregation)
      // Normalize domain the same way as domainMap key (lowercase, remove www.)
      const normalizedDomain = source.domain?.toLowerCase().replace(/^www\./, '') || 'unknown'
      const previousValue = previousValues.get(normalizedDomain)

      let change: number | null = null
      if (previousValue !== undefined) {
        change = round(value - previousValue, 1)
      } else {
        // New source in current period - no previous data to compare
        change = null
      }

      // Get all unique URLs for this domain (exact URLs from database, no normalization)
      // URLs that differ only by trailing slash will be shown separately
      let allUrls: string[] = []
      if (source.urls) {
        if (source.urls && typeof source.urls === 'object' && 'has' in source.urls && 'add' in source.urls) {
          allUrls = Array.from(source.urls as Set<string>).filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        } else if (Array.isArray(source.urls)) {
          allUrls = source.urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        }
        allUrls.sort((a, b) => a.length - b.length)
      } else if (source.url && typeof source.url === 'string') {
        allUrls = [source.url]
      }

      // Primary URL is the first one (shortest, usually most relevant)
      const primaryUrl = allUrls.length > 0 ? allUrls[0] : (source.url || null)

      return {
        id: source.key,
        title: source.title,
        url: primaryUrl || '', // Primary URL (first cited URL)
        urls: allUrls, // All cited URLs for this domain
        domain: source.domain,
        mentionRate: round(mentionRate, 1), // Add mentionRate for ranking
        impactScore: value, // Use Value as impactScore (for backward compatibility with frontend)
        value: value, // New Value field
        change,
        visibility: round(source.visibility, 1),
        share: round(source.share, 1),
        usage: source.usage
      }
    })
    .filter((source) => source.value !== null && Number.isFinite(source.value))
    // Sort by Value (descending), then by mentionRate as tiebreaker
    .sort((a, b) => (b.value || 0) - (a.value || 0) || (b.mentionRate || 0) - (a.mentionRate || 0))
    .slice(0, 10)

  // Calculate top 10 sources distribution by domain (for donut chart)
  const domainUsageMap = new Map<string, number>()
  sourceAggregateEntries.forEach((source) => {
    const domain = source.domain || 'unknown'
    const currentUsage = domainUsageMap.get(domain) || 0
    domainUsageMap.set(domain, currentUsage + source.usage)
  })

  const totalDomainUsage = Array.from(domainUsageMap.values()).reduce((sum, usage) => sum + usage, 0)
  const topSourcesDistribution: DistributionSlice[] = Array.from(domainUsageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, usage], index) => ({
      label: domain,
      percentage: totalDomainUsage > 0 ? round((usage / totalDomainUsage) * 100, 1) : 0,
      color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]
    }))

  const ensureTopicAggregate = (topicName: string) => {
    if (!topicAggregates.has(topicName)) {
      topicAggregates.set(topicName, {
        queryIds: new Set<string>(),
        shareValues: [],
        visibilityValues: [],
        sentimentValues: [],
        citationUsage: 0,
        queriesWithBrandPresence: new Set<string>(),
        collectorResultIds: new Set<number>(),
        collectorResultsWithBrandPresence: new Set<number>(),
        brandMentions: 0
      })
    }
  }

  const canonicalTopicNames = new Set<string>()
  brandTopics.forEach((topic) => {
    if (typeof topic?.topic_name === 'string' && topic.topic_name.trim().length > 0) {
      canonicalTopicNames.add(topic.topic_name.trim())
    }
  })
  topicByQueryId.forEach((topicName) => {
    if (topicName && topicName.trim().length > 0) {
      canonicalTopicNames.add(topicName.trim())
    }
  })

  canonicalTopicNames.forEach((topicName) => ensureTopicAggregate(topicName))

  const topicAggregateEntries = Array.from(topicAggregates.entries())
  const totalTopicCitationUsage = topicAggregateEntries.reduce(
    (sum, [, aggregate]) => sum + aggregate.citationUsage,
    0
  )
  const totalTopicPresence = topicAggregateEntries.reduce(
    (sum, [, aggregate]) => sum + aggregate.queriesWithBrandPresence.size,
    0
  )

  const topTopics = topicAggregateEntries
    .map(([topicName, aggregate]) => {
      const promptsTracked = aggregate.queryIds.size
      // Avg volume strictly from citation usage; if no citations in period, show 0
      const volumeRatioRaw =
        totalTopicCitationUsage > 0
          ? aggregate.citationUsage / totalTopicCitationUsage
          : 0
      const volumeRatio = Number.isFinite(volumeRatioRaw) ? volumeRatioRaw : 0
      const averageVolume = volumeRatio > 0 ? clampPercentage(round(volumeRatio * 100, 1)) : 0

      // Calculate sentiment average: all scores are now in 1-100 format
      // Simple average - return value in 1-100 range (no conversion)
      const avgSentiment = aggregate.sentimentValues.length > 0
        ? average(aggregate.sentimentValues)
        : 0
      const sentimentScore = avgSentiment > 0 ? round(avgSentiment, 2) : null // Keep in 1-100 range

      // Calculate average visibility and share for the topic - no fallbacks
      const avgVisibility = aggregate.visibilityValues.length > 0
        ? round(average(aggregate.visibilityValues) * 100, 1) // Convert to percentage
        : null
      const avgShare = aggregate.shareValues.length > 0
        ? round(average(aggregate.shareValues), 1)
        : null

      // Calculate brand presence percentage - track collector results (not just queries)
      // This ensures we count each collector result separately, so if a query has 4 collectors
      // and only 2 have brand presence, we get 50% not 100%
      const totalCollectorResults = aggregate.collectorResultIds.size
      const collectorResultsWithPresence = aggregate.collectorResultsWithBrandPresence.size
      const brandPresencePercentage = totalCollectorResults > 0
        ? round((collectorResultsWithPresence / totalCollectorResults) * 100, 1)
        : null

      return {
        topic: truncateLabel(topicName, 64),
        promptsTracked,
        averageVolume,
        sentimentScore,
        avgVisibility,
        avgShare,
        brandPresencePercentage
      }
    })
    .filter((topic) => {
      // Only show topics with actual data - no fallbacks
      // Must have at least one meaningful metric
      return topic.promptsTracked > 0 && (
        topic.averageVolume > 0 ||
        (topic.sentimentScore !== null && topic.sentimentScore !== undefined) ||
        (topic.avgVisibility !== null && topic.avgVisibility !== undefined && topic.avgVisibility > 0) ||
        (topic.brandPresencePercentage !== null && topic.brandPresencePercentage !== undefined && topic.brandPresencePercentage > 0)
      )
    })
    .sort((a, b) => {
      // Primary sort: by avgVisibility (descending), handling nulls
      const aVisibility = a.avgVisibility ?? 0;
      const bVisibility = b.avgVisibility ?? 0;
      if (bVisibility !== aVisibility) {
        return bVisibility - aVisibility;
      }
      // Secondary sort: by promptsTracked (descending)
      return b.promptsTracked - a.promptsTracked;
    })
    .slice(0, 5)

  // Use visibility service for visibility calculations
  const totalCollectorMentions = Array.from(collectorAggregates.values()).reduce(
    (sum, aggregate) => sum + aggregate.mentions,
    0
  )
  const totalCollectorShareSum = Array.from(collectorAggregates.values()).reduce(
    (sum, aggregate) => sum + aggregate.shareValues.reduce((inner, value) => inner + value, 0),
    0
  )


  // Calculate time-series data: group by day and collector type (for brand visibility)
  const timeSeriesByCollector = new Map<string, Map<string, {
    visibilityValues: number[]
    shareValues: number[]
    sentimentValues: number[]
    collectorResultsWithBrandPresence: Set<number>
    uniqueCollectorResults: Set<number>
  }>>()

  // Calculate time-series data: group by day and competitor name (for competitive visibility)
  const timeSeriesByCompetitor = new Map<string, Map<string, {
    visibilityValues: number[]
    shareValues: number[]
    sentimentValues: number[]
    collectorResultsWithCompetitorPresence: Set<number>
    uniqueCollectorResults: Set<number>
  }>>()

  // Initialize time-series structure for all collectors and dates
  collectorAggregates.forEach((_, collectorType) => {
    const dailyData = new Map<string, {
      visibilityValues: number[]
      shareValues: number[]
      sentimentValues: number[]
      collectorResultsWithBrandPresence: Set<number>
      uniqueCollectorResults: Set<number>
    }>()
    allDates.forEach(date => {
      dailyData.set(date, {
        visibilityValues: [],
        shareValues: [],
        sentimentValues: [],
        collectorResultsWithBrandPresence: new Set<number>(),
        uniqueCollectorResults: new Set<number>()
      })
    })
    timeSeriesByCollector.set(collectorType, dailyData)
    console.log(`[TimeSeries] Initialized time-series for collector: ${collectorType} with ${allDates.length} dates`)
  })

  // Initialize time-series structure for all competitors and dates
  // Track all collector results per day for brand presence percentage calculation
  const allCollectorResultsByDate = new Map<string, Set<number>>()
  allDates.forEach(date => {
    allCollectorResultsByDate.set(date, new Set<number>())
  })

  knownCompetitors.forEach((competitorName) => {
    const dailyData = new Map<string, {
      visibilityValues: number[]
      shareValues: number[]
      sentimentValues: number[]
      collectorResultsWithCompetitorPresence: Set<number>
      uniqueCollectorResults: Set<number>
    }>()
    allDates.forEach(date => {
      dailyData.set(date, {
        visibilityValues: [],
        shareValues: [],
        sentimentValues: [],
        collectorResultsWithCompetitorPresence: new Set<number>(),
        uniqueCollectorResults: new Set<number>()
      })
    })
    timeSeriesByCompetitor.set(competitorName, dailyData)
  })

  // Group positionRows by date, collector type, and competitor
  // Always use created_at for date grouping (matches query filtering)

  // Track collector types seen in position rows for debugging
  const positionRowCollectorTypes = new Set<string>()
  let skippedRowsCount = 0
  let processedBrandRowsCount = 0
  const dateMismatchesByCollector = new Map<string, number>()
  const successfulMatchesByCollector = new Map<string, number>()

  // DEBUG: Count competitor rows by date
  const competitorRowsByDate = new Map<string, number>()
  positionRows.forEach(row => {
    if (row.competitor_name && row.competitor_name.trim().length > 0) {
      const timestamp = (row.created_at && row.created_at.trim() !== '') ? row.created_at : row.processed_at
      const date = extractDate(timestamp)
      if (date) {
        competitorRowsByDate.set(date, (competitorRowsByDate.get(date) || 0) + 1)
      }
    }
  })
  console.log(`[TimeSeries] DEBUG: Competitor rows by date:`, Array.from(competitorRowsByDate.entries()).sort())

  positionRows.forEach(row => {
    // Prefer created_at for time series grouping, fallback to processed_at if created_at is missing
    const timestamp = (row.created_at && row.created_at.trim() !== '') ? row.created_at : row.processed_at
    const date = extractDate(timestamp)
    if (!date || !allDates.includes(date)) {
      skippedRowsCount++
      return
    }

    const collectorType = row.collector_type
    if (!collectorType) {
      skippedRowsCount++
      return
    }

    positionRowCollectorTypes.add(collectorType)

    const isBrandRow = !row.competitor_name || row.competitor_name.trim().length === 0
    const competitorName = row.competitor_name?.trim()

    // Process brand rows for collector time-series
    if (isBrandRow) {
      const dailyData = timeSeriesByCollector.get(collectorType)
      if (dailyData) {
        processedBrandRowsCount++
        const dayData = dailyData.get(date)
        if (!dayData) {
          // Track date mismatches per collector
          dateMismatchesByCollector.set(collectorType, (dateMismatchesByCollector.get(collectorType) || 0) + 1)
          // Log first mismatch for each collector
          if (dateMismatchesByCollector.get(collectorType) === 1) {
            console.warn(`[TimeSeries] ⚠️ Date mismatch for ${collectorType}: extracted date '${date}' not found. Available dates: [${Array.from(dailyData.keys()).slice(0, 3).join(', ')}...]`)
          }
        }
        if (dayData) {
          successfulMatchesByCollector.set(collectorType, (successfulMatchesByCollector.get(collectorType) || 0) + 1)
          const brandVisibility = Math.min(1, Math.max(0, toNumber(row.visibility_index) ?? 0))
          // Note: share_of_answers_brand is stored as percentage (0-100), not decimal (0-1)
          // Exclude NULL values (don't convert to 0) to match SQL AVG behavior
          const brandShareRaw = row.share_of_answers_brand
          const brandShare = (brandShareRaw !== null && brandShareRaw !== undefined)
            ? Math.max(0, toNumber(brandShareRaw))
            : null
          const brandSentimentRaw = row.sentiment_score !== null && row.sentiment_score !== undefined
            ? toNumber(row.sentiment_score)
            : null
          const brandSentiment = brandSentimentRaw !== null && Number.isFinite(brandSentimentRaw) ? brandSentimentRaw : null

          dayData.visibilityValues.push(brandVisibility)
          // Only push non-null share values (exclude NULLs)
          if (brandShare !== null && Number.isFinite(brandShare)) {
            dayData.shareValues.push(brandShare)
          }
          if (brandSentiment !== null) {
            dayData.sentimentValues.push(brandSentiment)
          }
          // Track brand presence: use unique collector results (not row count)
          // Multiple rows can exist per collector result (e.g., multiple topics)
          if (typeof row.collector_result_id === 'number' && Number.isFinite(row.collector_result_id)) {
            dayData.uniqueCollectorResults.add(row.collector_result_id)
            if (row.has_brand_presence === true) {
              dayData.collectorResultsWithBrandPresence.add(row.collector_result_id)
            }
          }
        }
      }
    }

    // Process competitor rows for competitor time-series
    if (competitorName && timeSeriesByCompetitor.has(competitorName)) {
      const dailyData = timeSeriesByCompetitor.get(competitorName)
      if (dailyData) {
        const dayData = dailyData.get(date)
        if (dayData) {
          const competitorVisibility = Math.min(1, Math.max(0, toNumber(row.visibility_index_competitor) ?? 0))
          // Only include valid competitor SOA values (exclude null, matching SQL AVG behavior)
          // Note: share_of_answers_competitor is stored as percentage (0-100), not decimal (0-1)
          // This matches the main competitor share calculation (line 709) and visibility.service.ts (line 221)
          const competitorShareRaw = row.share_of_answers_competitor
          const competitorShare = (competitorShareRaw !== null && competitorShareRaw !== undefined)
            ? Math.max(0, toNumber(competitorShareRaw))
            : null
          const competitorSentimentRaw = row.sentiment_score_competitor !== null && row.sentiment_score_competitor !== undefined
            ? toNumber(row.sentiment_score_competitor)
            : null
          const competitorSentiment = competitorSentimentRaw !== null && Number.isFinite(competitorSentimentRaw) ? competitorSentimentRaw : null

          dayData.visibilityValues.push(competitorVisibility)
          // Only push valid competitor share values (exclude null)
          if (competitorShare !== null && Number.isFinite(competitorShare)) {
            dayData.shareValues.push(competitorShare)
          }
          if (competitorSentiment !== null) {
            dayData.sentimentValues.push(competitorSentiment)
          }

          // Track collector results for competitor presence percentage
          // A competitor has presence if visibility > 0 or share > 0 or mentions > 0
          if (typeof row.collector_result_id === 'number' && Number.isFinite(row.collector_result_id)) {
            dayData.uniqueCollectorResults.add(row.collector_result_id)
            // Track all collector results for this date (needed for percentage calculation)
            const allCollectorResultsForDate = allCollectorResultsByDate.get(date)
            if (allCollectorResultsForDate) {
              allCollectorResultsForDate.add(row.collector_result_id)
            }
            // Competitor has presence if any metric is > 0
            const hasCompetitorPresence =
              competitorVisibility > 0 ||
              (competitorShare !== null && competitorShare > 0) ||
              (row.competitor_mentions !== null && row.competitor_mentions > 0)
            if (hasCompetitorPresence) {
              dayData.collectorResultsWithCompetitorPresence.add(row.collector_result_id)
            }
          }
        } else {
          console.warn(`[TimeSeries] ⚠️ Competitor "${competitorName}" row for date ${date} NOT FOUND in dailyData map!`)
        }
      } else {
        console.warn(`[TimeSeries] ⚠️ Competitor "${competitorName}" NOT FOUND in timeSeriesByCompetitor map!`)
      }
    } else if (competitorName) {
      console.warn(`[TimeSeries] ⚠️ Skipping competitor row: "${competitorName}" not in known competitors list or map is empty`)
    }

    // Also track brand rows' collector results for total count per day
    if (isBrandRow && typeof row.collector_result_id === 'number' && Number.isFinite(row.collector_result_id)) {
      const allCollectorResultsForDate = allCollectorResultsByDate.get(date)
      if (allCollectorResultsForDate) {
        allCollectorResultsForDate.add(row.collector_result_id)
      }
    }
  })

  console.log(`[TimeSeries] Position rows processing summary:`)
  console.log(`   - Total position rows: ${positionRows.length}`)
  console.log(`   - Processed brand rows: ${processedBrandRowsCount}`)
  console.log(`   - Skipped rows: ${skippedRowsCount}`)
  console.log(`   - Collector types in position rows: ${Array.from(positionRowCollectorTypes).join(', ')}`)
  console.log(`   - Collector types in timeSeriesByCollector: ${Array.from(timeSeriesByCollector.keys()).join(', ')}`)
  console.log(`[TimeSeries] Per-collector matching stats:`)
  Array.from(positionRowCollectorTypes).forEach(collectorType => {
    const successful = successfulMatchesByCollector.get(collectorType) || 0
    const mismatched = dateMismatchesByCollector.get(collectorType) || 0
    const status = successful > 0 ? '✅' : '❌'
    console.log(`   ${status} ${collectorType}: ${successful} matched, ${mismatched} date mismatches`)
  })

  // Log date range being used for this request
  console.log(`[TimeSeries] Date range for this request: ${allDates[0]} to ${allDates[allDates.length - 1]} (${allDates.length} days)`)

  // Lookback initialization: Get most recent data before requested range to initialize carry-forward values
  // This fixes the issue where short date ranges show zeros for days that have data in longer ranges
  const getLookbackValues = async (
    brandId: string,
    collectorTypes: string[],
    beforeDate: string,
    lookbackDays: number = 7
  ): Promise<Map<string, {
    visibility: number
    share: number
    sentiment: number | null
    brandPresence: number
  }>> => {
    const lookbackMap = new Map<string, {
      visibility: number
      share: number
      sentiment: number | null
      brandPresence: number
    }>()

    // Only perform lookback if requested range is relatively short (< 14 days)
    // For longer ranges, the requested range likely contains the initialization data
    const requestedRangeDays = allDates.length
    if (requestedRangeDays >= 14) {
      console.log(`[TimeSeries] Skipping lookback (requested range ${requestedRangeDays} days >= 14)`)
      return lookbackMap
    }

    try {
      const lookbackStart = new Date(beforeDate)
      lookbackStart.setDate(lookbackStart.getDate() - lookbackDays)
      lookbackStart.setUTCHours(0, 0, 0, 0)

      const lookbackEnd = new Date(beforeDate)
      lookbackEnd.setUTCHours(0, 0, 0, 0)

      const lookbackStartIso = lookbackStart.toISOString()
      const lookbackEndIso = lookbackEnd.toISOString()

      // Query metric_facts with brand_metrics and brand_sentiment for lookback period
      // Get the most recent date's aggregated values for each collector
      // Prefer created_at, but use processed_at for lookback (may have better index coverage)
      const { data: lookbackMetricFacts, error: lookbackError } = await supabaseAdmin
        .from('metric_facts')
        .select(`
          id,
          collector_type,
          processed_at,
          created_at,
          collector_result_id,
          brand_metrics!inner(
            visibility_index,
            share_of_answers,
            has_brand_presence
          ),
          brand_sentiment(
            sentiment_score
          )
        `)
        .eq('brand_id', brandId)
        .gte('processed_at', lookbackStartIso)
        .lt('processed_at', lookbackEndIso)
        .order('processed_at', { ascending: false })

      if (lookbackError) {
        console.warn(`[TimeSeries] Lookback query error: ${lookbackError.message}`)
        return lookbackMap
      }

      if (!lookbackMetricFacts || lookbackMetricFacts.length === 0) {
        console.log(`[TimeSeries] No lookback data found for ${lookbackDays} days before ${beforeDate}`)
        return lookbackMap
      }

      // Group by collector_type and date, then get most recent date's values
      const lookbackByCollector = new Map<string, Map<string, {
        visibilityValues: number[]
        shareValues: number[]
        sentimentValues: number[]
        collectorResultsWithPresence: Set<number>
        uniqueCollectorResults: Set<number>
      }>>()

      lookbackMetricFacts.forEach(mf => {
        const collectorType = mf.collector_type
        if (!collectorType || !collectorTypes.includes(collectorType)) return

        // Use processed_at for lookback (matches query filter)
        const timestamp = mf.processed_at
        const date = extractDate(timestamp)
        if (!date) return

        // Extract brand_metrics (can be array or single object from Supabase join)
        const bm = Array.isArray(mf.brand_metrics) ? mf.brand_metrics[0] : mf.brand_metrics
        if (!bm) return

        // Extract brand_sentiment (can be array or single object, or null)
        const bs = Array.isArray(mf.brand_sentiment)
          ? (mf.brand_sentiment.length > 0 ? mf.brand_sentiment[0] : null)
          : mf.brand_sentiment

        if (!lookbackByCollector.has(collectorType)) {
          lookbackByCollector.set(collectorType, new Map())
        }
        const collectorDates = lookbackByCollector.get(collectorType)!

        if (!collectorDates.has(date)) {
          collectorDates.set(date, {
            visibilityValues: [],
            shareValues: [],
            sentimentValues: [],
            collectorResultsWithPresence: new Set<number>(),
            uniqueCollectorResults: new Set<number>()
          })
        }

        const dayData = collectorDates.get(date)!
        const visibility = Math.min(1, Math.max(0, toNumber(bm.visibility_index) ?? 0))
        // Exclude NULL values (don't convert to 0) to match SQL AVG behavior
        const shareRaw = bm.share_of_answers
        const share = (shareRaw !== null && shareRaw !== undefined)
          ? Math.max(0, toNumber(shareRaw))
          : null
        const sentiment = bs?.sentiment_score !== null && bs?.sentiment_score !== undefined
          ? toNumber(bs.sentiment_score)
          : null

        dayData.visibilityValues.push(visibility)
        // Only push non-null share values (exclude NULLs)
        if (share !== null && Number.isFinite(share)) {
          dayData.shareValues.push(share)
        }
        if (sentiment !== null && Number.isFinite(sentiment)) {
          dayData.sentimentValues.push(sentiment)
        }

        if (mf.collector_result_id && typeof mf.collector_result_id === 'number') {
          dayData.uniqueCollectorResults.add(mf.collector_result_id)
          if (bm.has_brand_presence === true) {
            dayData.collectorResultsWithPresence.add(mf.collector_result_id)
          }
        }
      })

      // For each collector, get the most recent date's aggregated values
      lookbackByCollector.forEach((dates, collectorType) => {
        const sortedDates = Array.from(dates.keys()).sort().reverse() // Most recent first
        if (sortedDates.length === 0) return

        const mostRecentDate = sortedDates[0]
        const dayData = dates.get(mostRecentDate)!

        const avgVisibility = dayData.visibilityValues.length > 0
          ? round(average(dayData.visibilityValues) * 100)
          : 0
        const avgShare = dayData.shareValues.length > 0
          ? round(average(dayData.shareValues))
          : 0
        const avgSentiment = dayData.sentimentValues.length > 0
          ? round(average(dayData.sentimentValues), 2)
          : null
        const totalCollectorResults = dayData.uniqueCollectorResults.size
        const collectorResultsWithPresence = dayData.collectorResultsWithPresence.size
        const brandPresencePercentage = totalCollectorResults > 0
          ? round((collectorResultsWithPresence / totalCollectorResults) * 100)
          : 0

        lookbackMap.set(collectorType, {
          visibility: avgVisibility,
          share: avgShare,
          sentiment: avgSentiment,
          brandPresence: brandPresencePercentage
        })
      })

      if (lookbackMap.size > 0) {
        console.log(`[TimeSeries] Lookback initialized for ${lookbackMap.size} collectors from ${lookbackDays} days before requested range`)
      }
    } catch (error) {
      console.warn(`[TimeSeries] Lookback initialization error: ${error instanceof Error ? error.message : String(error)}`)
    }

    return lookbackMap
  }

  // Get lookback values for brand collectors
  const lookbackValues = await getLookbackValues(
    brand.id,
    Array.from(collectorAggregates.keys()),
    startIsoBound,
    7 // 7 days lookback
  )

  // Calculate daily averages for each collector
  const timeSeriesData = new Map<string, {
    dates: string[]
    visibility: number[]
    share: number[]
    sentiment: (number | null)[]
    brandPresence: number[]
    isRealData: boolean[] // NEW: true if data from DB, false if interpolated
  }>()

  timeSeriesByCollector.forEach((dailyData, collectorType) => {
    const dates: string[] = []
    const visibility: number[] = []
    const share: number[] = []
    const sentiment: (number | null)[] = []
    const brandPresence: number[] = []
    const isRealData: boolean[] = [] // Track which data points are real vs interpolated

    // Carry-forward behavior:
    // If there is no data collected for a given day, keep the previous day's value
    // (matches Sources/ImpactScoreTrends behavior where gaps stay flat).
    // Initialize from lookback values if available, otherwise start at 0
    const lookback = lookbackValues.get(collectorType)
    let lastVisibility = lookback?.visibility ?? 0
    let lastShare = lookback?.share ?? 0
    let lastSentiment = lookback?.sentiment ?? null
    let lastBrandPresence = lookback?.brandPresence ?? 0

    allDates.forEach(date => {
      const dayData = dailyData.get(date)
      if (dayData) {
        dates.push(date)
        const hasVisibility = dayData.visibilityValues.length > 0
        const hasShare = dayData.shareValues.length > 0
        const hasSentiment = dayData.sentimentValues.length > 0
        const totalCollectorResults = dayData.uniqueCollectorResults.size
        const hasBrandPresenceData = totalCollectorResults > 0

        // Determine if this is real data or interpolated
        const isReal = hasVisibility || hasShare || hasSentiment || hasBrandPresenceData

        const avgVisibility = hasVisibility
          ? round(average(dayData.visibilityValues) * 100)
          : lastVisibility
        // Note: shareValues are already percentages (0-100), not decimals, so don't multiply by 100
        // This matches the main brand share calculation (line 897) which uses average(...) without * 100
        const avgShare = hasShare
          ? round(average(dayData.shareValues))
          : lastShare
        // Average sentiment: all scores are now in 1-100 format
        // Simple average - return in 1-100 range (no conversion)
        const avgSentiment = hasSentiment ? average(dayData.sentimentValues) : 0
        const normalizedSentiment = hasSentiment ? round(avgSentiment, 2) : lastSentiment
        // Calculate brand presence percentage: (unique collector results with presence / total unique collector results) * 100
        const collectorResultsWithPresence = dayData.collectorResultsWithBrandPresence.size
        const brandPresencePercentage = hasBrandPresenceData
          ? round((collectorResultsWithPresence / totalCollectorResults) * 100)
          : lastBrandPresence

        visibility.push(avgVisibility)
        share.push(avgShare)
        sentiment.push(normalizedSentiment)
        brandPresence.push(brandPresencePercentage)
        isRealData.push(isReal) // Mark as real data if any metric has actual values

        // Update carry-forward values (only update sentiment when we have a value)
        lastVisibility = avgVisibility
        lastShare = avgShare
        if (normalizedSentiment !== null) {
          lastSentiment = normalizedSentiment
        }
        lastBrandPresence = brandPresencePercentage
      }
    })

    // Only include timeSeries if there's actual data (not all empty arrays)
    // This prevents frontend from falling back to flat lines when historical data exists
    if (dates.length > 0) {
      const hasData = visibility.some(v => v > 0) || share.some(s => s > 0)
      // Show FULL arrays for collectors to diagnose zero values
      console.log(`[TimeSeries] Collector ${collectorType}: ${dates.length} dates, hasData=${hasData}, visibility=[${visibility.join(', ')}], share=[${share.join(', ')}]`)
      timeSeriesData.set(collectorType, { dates, visibility, share, sentiment, brandPresence, isRealData })
    } else {
      console.warn(`[TimeSeries] Collector ${collectorType} has NO dates in time-series (position rows might be missing)`)
    }
  })

  // Get lookback values for competitors (similar to brand collectors)
  // Note: For competitors, we need to query competitor_metrics instead of brand_metrics
  const getCompetitorLookbackValues = async (
    brandId: string,
    competitorNames: string[],
    beforeDate: string,
    lookbackDays: number = 7
  ): Promise<Map<string, Map<string, {
    visibility: number
    share: number
    sentiment: number | null
  }>>> => {
    const lookbackMap = new Map<string, Map<string, {
      visibility: number
      share: number
      sentiment: number | null
    }>>()

    // Skip lookback if no competitors (optimization)
    if (competitorNames.length === 0) {
      return lookbackMap
    }

    try {
      const lookbackStart = new Date(beforeDate)
      lookbackStart.setDate(lookbackStart.getDate() - lookbackDays)
      lookbackStart.setUTCHours(0, 0, 0, 0)

      const lookbackEnd = new Date(beforeDate)
      lookbackEnd.setUTCHours(0, 0, 0, 0)

      const lookbackStartIso = lookbackStart.toISOString()
      const lookbackEndIso = lookbackEnd.toISOString()

      // Get competitor IDs for the competitor names
      const { data: competitors, error: competitorsError } = await supabaseAdmin
        .from('brand_competitors')
        .select('id, competitor_name')
        .eq('brand_id', brandId)
        .in('competitor_name', competitorNames)

      if (competitorsError || !competitors || competitors.length === 0) {
        return lookbackMap
      }

      const competitorIds = competitors.map(c => c.id)
      const competitorIdToName = new Map(competitors.map(c => [c.id, c.competitor_name]))

      // Query metric_facts with competitor_metrics and competitor_sentiment
      // Use processed_at for lookback (may have better index coverage)
      const { data: lookbackMetricFacts, error: lookbackError } = await supabaseAdmin
        .from('metric_facts')
        .select(`
          id,
          collector_type,
          processed_at,
          competitor_metrics!inner(
            competitor_id,
            visibility_index,
            share_of_answers
          ),
          competitor_sentiment(
            competitor_id,
            sentiment_score
          )
        `)
        .eq('brand_id', brandId)
        .in('competitor_metrics.competitor_id', competitorIds)
        .gte('processed_at', lookbackStartIso)
        .lt('processed_at', lookbackEndIso)
        .order('processed_at', { ascending: false })

      if (lookbackError || !lookbackMetricFacts || lookbackMetricFacts.length === 0) {
        return lookbackMap
      }

      // Group by competitor_name, collector_type, and date
      const lookbackByCompetitor = new Map<string, Map<string, Map<string, {
        visibilityValues: number[]
        shareValues: number[]
        sentimentValues: number[]
      }>>>()

      lookbackMetricFacts.forEach(mf => {
        const collectorType = mf.collector_type
        if (!collectorType) return

        // Use processed_at for lookback (matches query filter)
        const timestamp = mf.processed_at
        const date = extractDate(timestamp)
        if (!date) return

        // Extract competitor_metrics (array from join)
        const cmArray = Array.isArray(mf.competitor_metrics) ? mf.competitor_metrics : []
        const csArray = Array.isArray(mf.competitor_sentiment) ? mf.competitor_sentiment : []

        cmArray.forEach(cm => {
          const competitorId = cm.competitor_id
          const competitorName = competitorIdToName.get(competitorId)
          if (!competitorName) return

          if (!lookbackByCompetitor.has(competitorName)) {
            lookbackByCompetitor.set(competitorName, new Map())
          }
          const competitorCollectors = lookbackByCompetitor.get(competitorName)!

          if (!competitorCollectors.has(collectorType)) {
            competitorCollectors.set(collectorType, new Map())
          }
          const collectorDates = competitorCollectors.get(collectorType)!

          if (!collectorDates.has(date)) {
            collectorDates.set(date, {
              visibilityValues: [],
              shareValues: [],
              sentimentValues: []
            })
          }

          const dayData = collectorDates.get(date)!
          const visibility = Math.min(1, Math.max(0, toNumber(cm.visibility_index) ?? 0))
          const share = cm.share_of_answers !== null && cm.share_of_answers !== undefined
            ? Math.max(0, toNumber(cm.share_of_answers))
            : null

          dayData.visibilityValues.push(visibility)
          if (share !== null && Number.isFinite(share)) {
            dayData.shareValues.push(share)
          }

          // Find matching sentiment
          const matchingSentiment = csArray.find(cs => cs.competitor_id === competitorId)
          if (matchingSentiment?.sentiment_score !== null && matchingSentiment?.sentiment_score !== undefined) {
            const sentiment = toNumber(matchingSentiment.sentiment_score)
            if (sentiment !== null && Number.isFinite(sentiment)) {
              dayData.sentimentValues.push(sentiment)
            }
          }
        })
      })

      // For each competitor and collector, get the most recent date's aggregated values
      lookbackByCompetitor.forEach((collectors, competitorName) => {
        const competitorLookback = new Map<string, {
          visibility: number
          share: number
          sentiment: number | null
        }>()

        collectors.forEach((dates, collectorType) => {
          const sortedDates = Array.from(dates.keys()).sort().reverse()
          if (sortedDates.length === 0) return

          const mostRecentDate = sortedDates[0]
          const dayData = dates.get(mostRecentDate)!

          const avgVisibility = dayData.visibilityValues.length > 0
            ? round(average(dayData.visibilityValues) * 100)
            : 0
          const avgShare = dayData.shareValues.length > 0
            ? round(average(dayData.shareValues))
            : 0
          const avgSentiment = dayData.sentimentValues.length > 0
            ? round(average(dayData.sentimentValues), 2)
            : null

          competitorLookback.set(collectorType, {
            visibility: avgVisibility,
            share: avgShare,
            sentiment: avgSentiment
          })
        })

        if (competitorLookback.size > 0) {
          lookbackMap.set(competitorName, competitorLookback)
        }
      })

      if (lookbackMap.size > 0) {
        console.log(`[TimeSeries] Competitor lookback initialized for ${lookbackMap.size} competitors`)
      }
    } catch (error) {
      console.warn(`[TimeSeries] Competitor lookback initialization error: ${error instanceof Error ? error.message : String(error)}`)
    }

    return lookbackMap
  }

  // Get lookback values for competitors
  const competitorLookbackValues = await getCompetitorLookbackValues(
    brand.id,
    knownCompetitors,
    startIsoBound,
    7 // 7 days lookback
  )

  // Calculate daily averages for each competitor
  // Note: shareValues arrays only contain valid (non-null) competitor SOA values
  // because null values are filtered out during data collection (see line 2028-2029)
  const competitorTimeSeriesData = new Map<string, {
    dates: string[]
    visibility: number[]
    share: number[]
    sentiment: (number | null)[]
    brandPresencePercentage: number[]
    isRealData: boolean[] // NEW: true if data from DB, false if interpolated
  }>()

  timeSeriesByCompetitor.forEach((dailyData, competitorName) => {
    // DEBUG: Log how many dates have actual data vs empty arrays
    let datesWithVisibility = 0
    let datesWithShare = 0
    let datesWithSentiment = 0

    dailyData.forEach((dayData, date) => {
      if (dayData.visibilityValues.length > 0) datesWithVisibility++
      if (dayData.shareValues.length > 0) datesWithShare++
      if (dayData.sentimentValues.length > 0) datesWithSentiment++
    })

    console.log(`[TimeSeries] DEBUG Competitor "${competitorName}": ${datesWithVisibility} dates with visibility, ${datesWithShare} dates with share, ${datesWithSentiment} dates with sentiment`)

    const dates: string[] = []
    const visibility: number[] = []
    const share: number[] = []
    const sentiment: (number | null)[] = []
    const brandPresencePercentage: number[] = []
    const isRealData: boolean[] = [] // Track which data points are real vs interpolated

    // Initialize carry-forward from lookback (if available)
    // Note: Competitor lookback is per-collector, but we aggregate across all collectors
    // For simplicity, we'll use the first available lookback value or 0
    const competitorLookback = competitorLookbackValues.get(competitorName)
    let lastVisibility = 0
    let lastShare = 0
    let lastSentiment: number | null = null
    let lastBrandPresencePercentage = 0

    // Try to get initial values from lookback (use first collector's values if available)
    if (competitorLookback && competitorLookback.size > 0) {
      const firstLookback = Array.from(competitorLookback.values())[0]
      lastVisibility = firstLookback.visibility
      lastShare = firstLookback.share
      lastSentiment = firstLookback.sentiment
    }

    allDates.forEach(date => {
      const dayData = dailyData.get(date)
      const allCollectorResultsForDate = allCollectorResultsByDate.get(date)
      const totalCollectorResults = allCollectorResultsForDate?.size ?? 0

      // Always push the date to maintain complete time series
      dates.push(date)

      if (dayData) {
        const hasVisibility = dayData.visibilityValues.length > 0
        const hasShare = dayData.shareValues.length > 0
        const hasSentiment = dayData.sentimentValues.length > 0
        const hasCompetitorPresenceData = dayData.collectorResultsWithCompetitorPresence.size > 0

        // Determine if this is real data or interpolated
        const isReal = hasVisibility || hasShare || hasSentiment || hasCompetitorPresenceData

        const avgVisibility = hasVisibility
          ? round(average(dayData.visibilityValues) * 100)
          : lastVisibility
        // Calculate average share using simple average of valid values (matches SQL AVG behavior)
        // Note: shareValues are already percentages (0-100), not decimals, so don't multiply by 100
        // This ensures charts display the same SOA values as the main table (which uses round(average(...)) without * 100)
        const avgShare = hasShare
          ? round(average(dayData.shareValues))
          : lastShare
        // Average sentiment: all scores are now in 1-100 format
        // Simple average - return in 1-100 range (no conversion)
        const avgSentiment = hasSentiment ? average(dayData.sentimentValues) : 0
        const normalizedSentiment = hasSentiment ? round(avgSentiment, 2) : lastSentiment

        // Calculate competitor brand presence percentage: (collector results with competitor presence / total collector results) * 100
        const collectorResultsWithPresence = dayData.collectorResultsWithCompetitorPresence.size
        const competitorBrandPresencePercentage = totalCollectorResults > 0 && hasCompetitorPresenceData
          ? round((collectorResultsWithPresence / totalCollectorResults) * 100)
          : lastBrandPresencePercentage

        visibility.push(avgVisibility)
        share.push(avgShare)
        sentiment.push(normalizedSentiment)
        brandPresencePercentage.push(competitorBrandPresencePercentage)
        isRealData.push(isReal) // Mark as real data if any metric has actual values

        lastVisibility = avgVisibility
        lastShare = avgShare
        if (normalizedSentiment !== null) {
          lastSentiment = normalizedSentiment
        }
        lastBrandPresencePercentage = competitorBrandPresencePercentage
      } else {
        // No data for this date - use carry-forward values
        visibility.push(lastVisibility)
        share.push(lastShare)
        sentiment.push(lastSentiment)
        brandPresencePercentage.push(lastBrandPresencePercentage)
        isRealData.push(false) // Mark as interpolated data
      }
    })

    // Only include timeSeries if there's actual data (not all empty arrays)
    if (dates.length > 0) {
      const realDataCount = isRealData.filter(r => r).length
      const interpolatedCount = isRealData.filter(r => !r).length
      const hasAnyData = visibility.some(v => v > 0) || share.some(s => s > 0)

      console.log(`[TimeSeries] Competitor "${competitorName}": ${dates.length} dates total, ${realDataCount} with real data, ${interpolatedCount} interpolated, hasData=${hasAnyData}`)

      competitorTimeSeriesData.set(competitorName, { dates, visibility, share, sentiment, brandPresencePercentage, isRealData })
    } else {
      console.warn(`[TimeSeries] Competitor "${competitorName}" has NO dates in time-series`)
    }
  })

  const llmVisibility = visibilityService.calculateLlmVisibility(
    collectorAggregates,
    totalCollectorMentions,
    totalCollectorShareSum,
    timeSeriesData,
    filtersActive // Pass filter status
  )

  // Note: totalShareUniverse is no longer used in calculateCompetitorVisibility (we use simple average now)
  // Keeping it for backward compatibility with function signature
  const competitorVisibility = visibilityService.calculateCompetitorVisibility(
    competitorAggregates,
    totalShareUniverse,
    totalQueries,
    totalBrandRows, // Use totalBrandRows (Universe) as the denominator, not totalResponses (which includes competitor rows)
    knownCompetitors,
    competitorTimeSeriesData
  )

  // Map metadata (logo, domain) to competitor visibility results
  const competitorMetadataMap = new Map<string, { logo?: string; domain?: string }>()
  if (competitorResult.data) {
    competitorResult.data.forEach((comp) => {
      if (comp.competitor_name && comp.metadata) {
        competitorMetadataMap.set(comp.competitor_name, comp.metadata)
      }
    })
  }

  // Inject metadata into competitorVisibility objects
  competitorVisibility.forEach((comp) => {
    const metadata = competitorMetadataMap.get(comp.competitor)
    if (metadata) {
      comp.metadata = {
        logo: metadata.logo,
        domain: metadata.domain
      }
    }
  })

  const queryVisibility = visibilityService.calculateQueryVisibility(
    queryAggregates,
    brandShareByQuery,
    brandVisibilityByQuery,
    brandSentimentByQuery,
    competitorAggregates,
    knownCompetitors
  )

  const visibilityComparison = visibilityService.calculateVisibilityComparison(
    brand.name,
    totalResponses,
    brandShareSum,
    brandShareValues,
    totalShareUniverse,
    competitorVisibility
  )

  const scores: ScoreMetric[] = [
    {
      label: 'Visibility Index',
      value: round(visibilityIndexPercentage),
      delta: 0,
      description: 'Average visibility index across queries in the latest collection window.'
    },
    {
      label: 'Share of Answers',
      value: round(shareOfAnswersPercentage),
      delta: 0,
      description: 'Average share of answers across all queries. Calculated as the mean of all brand share values in the dataset.'
    },
    {
      label: 'Sentiment Score',
      value: sentimentScore,
      delta: 0,
      description: 'Average sentiment score for your brand (scaled 0-100).'
    }
  ]

  const actionItems: ActionItem[] = []
  const leadingCompetitor = visibilityComparison.find((entry) => !entry.isBrand)
  const shareOfAnswers = scores[1].value

  if (shareOfAnswers < 55) {
    actionItems.push({
      id: 'boost-share',
      title: 'Boost branded answer share',
      description: 'Refresh high-performing answer packs and citations to lift your share of answers above 60%.',
      priority: 'high',
      category: 'content'
    })
  }

  if (leadingCompetitor && leadingCompetitor.share >= shareOfAnswers) {
    actionItems.push({
      id: 'counter-competitor',
      title: `Counter ${leadingCompetitor.entity} visibility`,
      description: `Launch comparison narratives on top queries where ${leadingCompetitor.entity} matches or exceeds your share.`,
      priority: 'medium',
      category: 'distribution'
    })
  }

  if (sentimentScore < 60) {
    actionItems.push({
      id: 'improve-sentiment',
      title: 'Improve sentiment cues',
      description: 'Highlight social proof and trusted reviews inside answer packs to raise positive sentiment.',
      priority: 'medium',
      category: 'content'
    })
  }

  if (sourceDistribution.length < 3) {
    actionItems.push({
      id: 'expand-coverage',
      title: 'Diversify coverage across queries',
      description: 'Seed additional optimization efforts across long-tail queries to broaden coverage depth.',
      priority: 'medium',
      category: 'distribution'
    })
  }

  if (!actionItems.length) {
    actionItems.push({
      id: 'maintain-momentum',
      title: 'Maintain visibility momentum',
      description: 'Continue refreshing key narratives weekly to defend your leadership position.',
      priority: 'low',
      category: 'monitoring'
    })
  }

  // Calculate brand summary for competitive view
  const brandSummary = (() => {
    // Use the actual dashboard metrics (not LLM averages) for consistency
    const totalBrandVisibility = visibilityIndexPercentage
    const totalBrandShare = shareOfAnswersPercentage

    // Brand presence percentage (Answer Frequency)
    // Uses collectorBrandPresenceCount (unique collector results with presence) / totalBrandRows (total collector results)
    const brandPresencePercentage = totalBrandRows > 0
      ? round((collectorBrandPresenceCount / totalBrandRows) * 100, 1)
      : 0

    // Extract top topics from existing topicAggregates
    // Ranked by visibility score (matching dashboard display)
    const brandTopTopics = Array.from(topicAggregates.entries())
      .map(([topicName, aggregate]) => ({
        topic: truncateLabel(topicName, 64),
        occurrences: aggregate.queryIds.size,
        share: aggregate.shareValues.length > 0
          ? round(average(aggregate.shareValues), 1)
          : 0,
        visibility: aggregate.visibilityValues.length > 0
          ? round(average(aggregate.visibilityValues) * 100, 1)
          : 0
      }))
      .filter((topic) => topic.topic.trim().length > 0 && topic.occurrences > 0)
      .sort((a, b) => {
        // Primary: visibility score (descending) - matches dashboard ranking
        // Secondary: share (average share of answers)
        // Tertiary: occurrences (how many queries tracked)
        return b.visibility - a.visibility || b.share - a.share || b.occurrences - a.occurrences
      })
      .slice(0, 5)

    // Aggregate timeSeries across all collectors for brand chart line
    // This gives the brand a proper time-series instead of a flat line
    let brandTimeSeries: {
      dates: string[]
      visibility: number[]
      share: number[]
      sentiment: (number | null)[]
      brandPresencePercentage: number[]
      isRealData?: boolean[]
    } | undefined = undefined

    if (timeSeriesData.size > 0) {
      // Use allDates as the base timeline
      const aggregatedVisibility: number[] = []
      const aggregatedShare: number[] = []
      const aggregatedSentiment: (number | null)[] = []
      const aggregatedBrandPresence: number[] = []
      const aggregatedIsRealData: boolean[] = []

      allDates.forEach((date, dateIndex) => {
        let visibilityValues: number[] = []
        let shareValues: number[] = []
        let sentimentValues: number[] = []
        let brandPresenceValues: number[] = []
        let hasRealData = false

        timeSeriesData.forEach((ts) => {
          const idx = ts.dates.indexOf(date)
          if (idx !== -1) {
            if (ts.visibility[idx] !== undefined && ts.visibility[idx] > 0) {
              visibilityValues.push(ts.visibility[idx])
            }
            if (ts.share[idx] !== undefined && ts.share[idx] > 0) {
              shareValues.push(ts.share[idx])
            }
            if (ts.sentiment[idx] !== null && ts.sentiment[idx] !== undefined) {
              sentimentValues.push(ts.sentiment[idx] as number)
            }
            // Aggregate brand presence: average percentages across collectors
            if (ts.brandPresence[idx] !== undefined) {
              brandPresenceValues.push(ts.brandPresence[idx])
            }
            if (ts.isRealData && ts.isRealData[idx]) {
              hasRealData = true
            }
          }
        })

        // Average across collectors for this date
        aggregatedVisibility.push(visibilityValues.length > 0 ? round(average(visibilityValues)) : 0)
        aggregatedShare.push(shareValues.length > 0 ? round(average(shareValues)) : 0)
        aggregatedSentiment.push(sentimentValues.length > 0 ? round(average(sentimentValues), 2) : null)
        aggregatedBrandPresence.push(brandPresenceValues.length > 0 ? round(average(brandPresenceValues)) : 0)
        aggregatedIsRealData.push(hasRealData)
      })

      // Only include if there's meaningful data
      const hasData = aggregatedVisibility.some(v => v > 0) || aggregatedShare.some(s => s > 0)
      if (hasData) {
        brandTimeSeries = {
          dates: allDates,
          visibility: aggregatedVisibility,
          share: aggregatedShare,
          sentiment: aggregatedSentiment,
          brandPresencePercentage: aggregatedBrandPresence,
          isRealData: aggregatedIsRealData
        }
      }
    }

    // Calculate aggregate sentiment for brand (average across all data)
    let brandSentimentValue: number | null = null
    if (brandTimeSeries && brandTimeSeries.sentiment) {
      const validSentiments = brandTimeSeries.sentiment.filter((s): s is number => s !== null)
      if (validSentiments.length > 0) {
        brandSentimentValue = round(average(validSentiments), 2)
      }
    }
    // Fallback to the overall sentimentScore if timeSeries doesn't have it
    if (brandSentimentValue === null && sentimentScore > 0) {
      brandSentimentValue = sentimentScore
    }

    return {
      visibility: round(totalBrandVisibility, 1),
      share: round(totalBrandShare, 1),
      sentiment: brandSentimentValue,
      brandPresencePercentage,
      topTopics: brandTopTopics,
      timeSeries: brandTimeSeries
    }
  })()

  const payload: BrandDashboardPayload = {
    brandId: brand.id,
    brandName: brand.name,
    brandSlug: brand.slug ?? undefined,
    customerId,
    dateRange: { start: startIso, end: endIso },
    totalQueries,
    queriesWithBrandPresence: queriesWithBrandPresenceCount,
    collectorResultsWithBrandPresence: collectorBrandPresenceCount,
    brandPresenceRows: brandPresenceRowCount,
    totalBrandRows,
    totalResponses,
    visibilityPercentage: round(shareOfAnswersPercentage), // This is Share of Answers, not Visibility Index
    trendPercentage,
    sentimentScore,
    visibilityComparison,
    scores,
    sourceDistribution,
    topSourcesDistribution,
    topSourcesByType,
    categoryDistribution,
    llmVisibility,
    actionItems: actionItems.slice(0, 4),
    collectorSummaries: [],
    competitorVisibility,
    queryVisibility,
    topBrandSources,
    topTopics,
    brandSummary
  }

  // mark('payload computed')
  console.log(`[Dashboard] ✅ Generated for ${brand.name} in ${(Date.now() - requestStart).toFixed(0)}ms`)

  return payload
}
