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

export async function buildDashboardPayload(
  brand: BrandRow,
  customerId: string,
  range: NormalizedDashboardRange
): Promise<BrandDashboardPayload> {
  const requestStart = Date.now()
  let lastMark = requestStart
  const mark = (label: string) => {
    const now = Date.now()
    const delta = now - lastMark
    const total = now - requestStart
    console.log(`[Dashboard] ⏱ ${label}: +${delta}ms (total ${total}ms)`)
    lastMark = now
  }

  const startIsoBound = range.startIso
  const endIsoBound = range.endIso

  console.log(`[Dashboard] Querying scores for brand_id=${brand.id}, customer_id=${customerId}`)
  
  // Debug: Check what customer_ids exist for this brand in scores table
  const competitorListPromise = (async () => {
    const start = Date.now()
    const result = await supabaseAdmin
      .from('brand_competitors')
      .select('competitor_name')
      .eq('brand_id', brand.id)
      .order('priority', { ascending: true })
    console.log(`[Dashboard] ⏱ competitor list query: ${Date.now() - start}ms`)
    return result
  })()

  const positionsPromise = (async () => {
    const start = Date.now()
    const result = await supabaseAdmin
      .from('extracted_positions')
      .select(
        'brand_name, query_id, collector_result_id, collector_type, competitor_name, visibility_index, visibility_index_competitor, share_of_answers_brand, share_of_answers_competitor, sentiment_score, sentiment_label, total_brand_mentions, competitor_mentions, processed_at, brand_positions, competitor_positions, has_brand_presence, topic, metadata'
      )
      .eq('brand_id', brand.id)
      .eq('customer_id', customerId)
      .gte('processed_at', startIsoBound)
      .lte('processed_at', endIsoBound)
      .order('processed_at', { ascending: true })
    console.log(`[Dashboard] ⏱ extracted positions query: ${Date.now() - start}ms`)
    return result
  })()

  const queryCountPromise = (async () => {
    const start = Date.now()
    const result = await supabaseAdmin
      .from('generated_queries')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('customer_id', customerId)
      .gte('created_at', startIsoBound)
      .lte('created_at', endIsoBound)
    console.log(`[Dashboard] ⏱ generated queries count query: ${Date.now() - start}ms`)
    return result
  })()

  const brandTopicsPromise = (async () => {
    const start = Date.now()
    const result = await supabaseAdmin
      .from('brand_topics')
      .select('topic_name, priority')
      .eq('brand_id', brand.id)
      .order('priority', { ascending: true })
    console.log(`[Dashboard] ⏱ brand topics query: ${Date.now() - start}ms`)
    return result
  })()

  const [queryCountResult, positionsResult, competitorResult, brandTopicsResult] = await Promise.all([
    queryCountPromise,
    positionsPromise,
    competitorListPromise,
    brandTopicsPromise
  ])
  mark('initial Supabase queries')

  console.log(`[Dashboard] Supabase extracted_positions query returned: ${positionsResult.data?.length ?? 0} rows, error: ${positionsResult.error?.message ?? 'none'}`)

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

  const positionRows: PositionRow[] = (positionsResult.data as PositionRow[]) ?? []
  
  console.log(`[Dashboard] Fetched ${positionRows.length} extracted position rows for brand ${brand.name} (${brand.id})`)
  if (positionRows.length > 0) {
    console.log('[Dashboard] Sample row:', JSON.stringify(positionRows[0], null, 2))
  }
  
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
  
  // Map collector_result_id to sentiment_score from collector_results (defined outside if block for scope)
  const collectorResultSentimentMap = new Map<number, number | null>()

  if (positionRows.length > 0) {
    const uniqueCollectorResultIds = Array.from(
      new Set(
        positionRows
          .map((row) => row.collector_result_id)
          .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
      )
    )
    
    if (uniqueCollectorResultIds.length > 0) {
      const {
        data: collectorRows,
        error: collectorRowsError
      } = await (async () => {
        const start = Date.now()
        const result = await supabaseAdmin
          .from('collector_results')
          .select('id, question, sentiment_score')
          .in('id', uniqueCollectorResultIds)
        console.log(`[Dashboard] ⏱ collector results query: ${Date.now() - start}ms`)
        return result
      })()

      if (collectorRowsError) {
        throw new DatabaseError(`Failed to load collector questions for dashboard: ${collectorRowsError.message}`)
      }

      ;(collectorRows ?? []).forEach((collectorRow) => {
        if (!collectorRow?.id) {
          return
        }
        const label =
          typeof collectorRow.question === 'string' && collectorRow.question.trim().length > 0
            ? collectorRow.question.trim()
            : 'Unlabeled query'
        queryTextMap.set(`collector-${collectorRow.id}`, label)
        
        // Store sentiment_score from collector_results
        if (collectorRow.sentiment_score !== null && collectorRow.sentiment_score !== undefined) {
          collectorResultSentimentMap.set(collectorRow.id, toNumber(collectorRow.sentiment_score))
        } else {
          collectorResultSentimentMap.set(collectorRow.id, null)
        }
      })
    }

    const uniqueQueryIds = Array.from(
      new Set(
        positionRows
          .map((row) => row.query_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    if (uniqueQueryIds.length > 0) {
      const {
        data: queryRows,
        error: queryRowsError
      } = await (async () => {
        const start = Date.now()
        const result = await supabaseAdmin
          .from('generated_queries')
          .select('id, query_text, topic, metadata')
          .in('id', uniqueQueryIds)
        console.log(`[Dashboard] ⏱ generated queries lookup query: ${Date.now() - start}ms`)
        return result
      })()

      if (queryRowsError) {
        throw new DatabaseError(`Failed to load queries for dashboard: ${queryRowsError.message}`)
      }

      ;(queryRows ?? []).forEach((query) => {
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

    const brandShare = Math.max(0, toNumber(row.share_of_answers_brand))
    const brandVisibility = Math.max(0, toNumber(row.visibility_index))
    
    // Priority: 1) sentiment_score from collector_results (via collector_result_id), 2) sentiment_score from extracted_positions
    let brandSentiment: number | null = null
    if (row.collector_result_id && collectorResultSentimentMap.has(row.collector_result_id)) {
      brandSentiment = collectorResultSentimentMap.get(row.collector_result_id) ?? null
    } else if (row.sentiment_score !== null && row.sentiment_score !== undefined) {
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

    if (isBrandRow || shareArray.length === 0) {
      shareArray.push(brandShare)
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

        collectorStats.shareValues.push(brandShare)
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
        topicAggregate.shareValues.push(brandShare)
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

      if (!collectorAggregates.has(collectorType)) {
        collectorAggregates.set(collectorType, {
          shareValues: [],
          visibilityValues: [],
          mentions: 0,
          brandPresenceCount: 0,
          uniqueQueryIds: new Set<string>(),
          topics: new Map()
        })
      }
      const collectorAggregate = collectorAggregates.get(collectorType)!
      collectorAggregate.shareValues.push(brandShare)
      collectorAggregate.visibilityValues.push(brandVisibility)

      collectorAggregate.mentions += brandMentions > 0 ? brandMentions : 1

      if (hasBrandPresence) {
        collectorAggregate.brandPresenceCount += 1
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
        topicStats.shareSum += brandShare
        topicStats.visibilitySum += brandVisibility
        topicStats.mentions += brandMentions > 0 ? brandMentions : 1
        collectorAggregate.topics.set(topicName, topicStats)
      }

      collectorAggregates.set(collectorType, collectorAggregate)
    }

    if (processedRowCount <= 3) {
      console.log(`[Dashboard] ${collectorType} - Query ${queryId}: share=${brandShare}, visibility=${brandVisibility}, sentiment=${brandSentimentValue}`)
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
    const competitorShare = Math.max(0, toNumber(row.share_of_answers_competitor))
    const competitorVisibility = Math.max(0, toNumber(row.visibility_index_competitor))
    
    // Priority: 1) sentiment_score from collector_results (via collector_result_id), 2) sentiment_score from extracted_positions
    let competitorSentiment: number | null = null
    if (row.collector_result_id && collectorResultSentimentMap.has(row.collector_result_id)) {
      competitorSentiment = collectorResultSentimentMap.get(row.collector_result_id) ?? null
    } else if (row.sentiment_score !== null && row.sentiment_score !== undefined) {
      competitorSentiment = toNumber(row.sentiment_score)
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

    competitorAggregate.shareValues.push(competitorShare)
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

    competitorAggregate.queries.set(queryId, {
      text: queryText,
      shareSum: competitorQueryAggregate.shareSum + competitorShare,
      visibilitySum: competitorQueryAggregate.visibilitySum + competitorVisibility,
      sentimentValues: hasCompetitorSentiment
        ? [...competitorQueryAggregate.sentimentValues, competitorSentimentValue]
        : competitorQueryAggregate.sentimentValues,
      mentionSum: competitorQueryAggregate.mentionSum + competitorMentions,
      count: competitorQueryAggregate.count + 1
    })

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
      topicStats.shareSum += competitorShare
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
  const brandSentimentValues = Array.from(brandSentimentByQuery.values()).flat()

  const uniqueQueries = brandShareByQuery.size
  const queriesWithBrandPresenceCount = queriesWithBrandPresence.size
  const collectorBrandPresenceCount = collectorResultsWithBrandPresence.size
  console.log(`[Dashboard] Processed ${uniqueQueries} unique queries`)
  console.log(`[Dashboard] Brand shares: [${brandShareValues.slice(0, 5).map(v => v.toFixed(2)).join(', ')}...]`)
  console.log(`[Dashboard] Brand visibility: [${brandVisibilityValues.slice(0, 5).map(v => v.toFixed(2)).join(', ')}...]`)
  console.log(`[Dashboard] Competitor aggregates: ${competitorAggregates.size} competitors`)

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

  const brandShareSum = brandShareValues.reduce((sum, value) => sum + value, 0)
  const competitorShareSum = Array.from(competitorAggregates.values()).reduce(
    (sum, aggregate) => sum + aggregate.shareValues.reduce((inner, value) => inner + value, 0),
    0
  )
  const totalShareUniverse = brandShareSum + competitorShareSum

  console.log(`[Dashboard] Brand share sum: ${brandShareSum}, Competitor share sum: ${competitorShareSum}, Total: ${totalShareUniverse}`)

  // Calculate Share of Answers (brand's share of total answer space)
  const shareOfAnswersPercentage = totalShareUniverse > 0 ? (brandShareSum / totalShareUniverse) * 100 : 0
  
  // Calculate Visibility Index (average prominence across queries)
  const visibilityIndexPercentage = average(brandVisibilityValues) * 100 // Convert 0-1 scale to 0-100
  
  // Display exact average sentiment in [-1, 1] (no normalization). average() returns 0 when empty.
  const sentimentScore = round(average(brandSentimentValues), 2)
  
  console.log(`[Dashboard] Final metrics: shareOfAnswers=${shareOfAnswersPercentage}%, visibilityIndex=${visibilityIndexPercentage}%, sentiment=${sentimentScore}`)

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
  if (citationsData && citationsData.length > 0) {
    for (const citation of citationsData) {
      const categoryKey =
        citation.category && citation.category.trim().length > 0
          ? citation.category.trim().toLowerCase()
          : 'other'
      const count = citation.usage_count || 1
      citationCounts.set(categoryKey, (citationCounts.get(categoryKey) || 0) + count)

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

      if (
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

  if (totalCategoryVisibility > 0) {
    const sortedCategories = Array.from(categoryVisibilityAggregates.entries()).sort(
      (a, b) => b[1].visibilitySum - a[1].visibilitySum
    )

    let accumulatedVisibility = 0

    sortedCategories.slice(0, 5).forEach(([categoryKey, aggregate], index) => {
      accumulatedVisibility += aggregate.visibilitySum
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

  // Calculate category distribution from citations
  const categoryDistribution: DistributionSlice[] = Array.from(citationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([categoryKey, count], index) => ({
      label: formatCategoryLabel(categoryKey),
      percentage: totalCitations > 0 
        ? round((count / totalCitations) * 100)
        : 0,
      color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]
    }))

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

    const avgShare = shareValues.length > 0 ? average(shareValues) : 0
    const avgVisibilityRaw = visibilityValues.length > 0 ? average(visibilityValues) : 0

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
      collectorIds: aggregate.collectorIds // Preserve collectorIds for mentionRate calculation
    }
  })

  const maxSourceUsage = sourceAggregateEntries.reduce(
    (max, source) => (source.usage > max ? source.usage : max),
    0
  )

  // Group by normalized domain to ensure no duplicates
  const domainMap = new Map<string, Omit<typeof sourceAggregateEntries[0], 'urls' | 'collectorIds'> & { urls?: string[] | Set<string>; collectorIds?: Set<number> }>()
  
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
      // Merge entries with same domain: combine usage, share, visibility
      existing.usage += source.usage
      // Average share and visibility (weighted by usage)
      const totalUsage = existing.usage + source.usage
      if (totalUsage > 0) {
        existing.share = (existing.share * existing.usage + source.share * source.usage) / totalUsage
        existing.visibility = (existing.visibility * existing.usage + source.visibility * source.usage) / totalUsage
      }
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

  const topBrandSources = Array.from(domainMap.values())
    .map((source) => {
      // Calculate mentionRate: percentage of total collector results where this source is cited
      // Formula: (Number of unique collector results citing this source / Total collector results) * 100
      const uniqueCollectorResultsCitingSource = source.collectorIds ? source.collectorIds.size : 0
      const mentionRate = totalCollectorResultsCount > 0 
        ? (uniqueCollectorResultsCitingSource / totalCollectorResultsCount) * 100 
        : 0
      
      // Calculate impact score using real values (no normalization)
      // Weighted combination: 35% SOA, 35% Visibility, 30% Usage (normalized to 0-10 scale for display)
      const usageNorm = maxSourceUsage > 0 ? (source.usage / maxSourceUsage) * 10 : 0
      const shareNorm = (source.share / 100) * 10 // SOA is 0-100, scale to 0-10
      const visibilityNorm = (source.visibility / 100) * 10 // Visibility is 0-100, scale to 0-10
      const hasImpact = source.usage > 0 || source.share > 0 || source.visibility > 0
      const impactScore = hasImpact
        ? round((0.35 * shareNorm + 0.35 * visibilityNorm + 0.3 * usageNorm), 1)
        : null
      
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
        impactScore,
        change: hasImpact ? 0 : null,
        visibility: round(source.visibility, 1),
        share: round(source.share, 1),
        usage: source.usage
      }
    })
    .filter((source) => source.impactScore !== null && Number.isFinite(source.impactScore))
    // Sort by mentionRate (descending) to match Source Attribution table, then by usage as tiebreaker
    .sort((a, b) => (b.mentionRate || 0) - (a.mentionRate || 0) || b.usage - a.usage)
    .slice(0, 5)

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

      // Calculate raw sentiment average (-1 to 1), no fallback
      const sentimentScore = aggregate.sentimentValues.length > 0
        ? round(average(aggregate.sentimentValues), 2)
        : null // No fallback - return null if no data

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

  console.log(`[Dashboard] Computing visibility: ${collectorAggregates.size} collectors, ${competitorAggregates.size} competitors`)
  console.log(`[Dashboard] Collector types:`, Array.from(collectorAggregates.keys()))
  
  const llmVisibility = visibilityService.calculateLlmVisibility(
    collectorAggregates,
    totalCollectorMentions,
    totalCollectorShareSum
  )

  const competitorVisibility = visibilityService.calculateCompetitorVisibility(
    competitorAggregates,
    totalShareUniverse,
    totalQueries,
    knownCompetitors
  )
  
  console.log(`[Dashboard] Visibility computed: ${llmVisibility.length} LLM models, ${competitorVisibility.length} competitors`)
  console.log(`[Dashboard] LLM providers:`, llmVisibility.map(s => s.provider))

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
      description: 'Share of answers that explicitly reference your brand versus key competitors.'
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

    // Brand presence percentage
    const brandPresencePercentage = totalQueries > 0
      ? round((queriesWithBrandPresenceCount / totalQueries) * 100, 1)
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

    return {
      visibility: round(totalBrandVisibility, 1),
      share: round(totalBrandShare, 1),
      brandPresencePercentage,
      topTopics: brandTopTopics
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

  mark('payload computed')
  console.log(`[Dashboard] ✅ Total dashboard generation time: ${Date.now() - requestStart}ms`)

  return payload
}
