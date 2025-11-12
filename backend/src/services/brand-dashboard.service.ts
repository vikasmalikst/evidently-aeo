import { supabaseAdmin } from '../config/database'
import { DatabaseError } from '../types/auth'

const DISTRIBUTION_COLORS = ['#6366f1', '#0ea5e9', '#22d3ee', '#f97316', '#a855f7', '#10b981', '#facc15']

const COLLECTOR_COLORS: Record<string, string> = {
  chatgpt: '#0ea5e9',
  'openai-chatgpt': '#0ea5e9',
  claude: '#6366f1',
  anthropic: '#6366f1',
  gemini: '#a855f7',
  perplexity: '#f97316',
  deepseek: '#10b981',
  'bing copilot': '#4b5563',
  bing_copilot: '#4b5563',
  'google aio': '#06b6d4',
  google_aio: '#06b6d4',
  grok: '#f43f5e',
  dataforseo: '#facc15',
  brightdata: '#ec4899',
  oxylabs: '#14b8a6',
  default: '#64748b'
}

interface BrandRow {
  id: string
  name: string
  slug?: string
}

interface PositionRow {
  brand_name: string | null
  query_id: string | null
  collector_result_id: number | null
  collector_type: string | null
  competitor_name: string | null
  visibility_index: string | number | null
  visibility_index_competitor: string | number | null
  share_of_answers_brand: string | number | null
  share_of_answers_competitor: string | number | null
  sentiment_score: string | number | null
  sentiment_label: string | null
  total_brand_mentions: number | null
  competitor_mentions: number | null
  processed_at: string | null
  brand_positions: number[] | null
  competitor_positions: number[] | null
}

interface ScoreMetric {
  label: string
  value: number
  delta: number
  description: string
}

interface DistributionSlice {
  label: string
  percentage: number
  color: string
}

interface LlmVisibilitySlice {
  provider: string
  share: number
  delta: number
  color: string
}

interface ActionItem {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: 'content' | 'technical' | 'distribution' | 'monitoring'
}

interface CollectorSummary {
  collectorType: string
  status: 'completed' | 'failed' | 'pending' | 'running'
  successRate: number
  completed: number
  failed: number
  lastRunAt: string
}

interface CompetitorVisibility {
  competitor: string
  mentions: number
  share: number
  collectors: Array<{
    collectorType: string
    mentions: number
  }>
}

interface QueryVisibilityRow {
  queryId: string
  queryText: string
  brandShare: number
  brandVisibility: number
  brandSentiment: number | null
  competitors: Array<{
    competitor: string
    share: number
    visibility: number
    sentiment: number | null
  }>
}

export interface BrandDashboardPayload {
  brandId: string
  brandName: string
  brandSlug?: string
  customerId: string
  dateRange: { start: string; end: string }
  totalQueries: number
  totalResponses: number
  visibilityPercentage: number
  trendPercentage: number
  sentimentScore: number
  visibilityComparison: Array<{
    entity: string
    isBrand: boolean
    mentions: number
    share: number
  }>
  scores: ScoreMetric[]
  sourceDistribution: DistributionSlice[]
  categoryDistribution: DistributionSlice[]
  llmVisibility: LlmVisibilitySlice[]
  actionItems: ActionItem[]
  collectorSummaries: CollectorSummary[]
  competitorVisibility: CompetitorVisibility[]
  queryVisibility: QueryVisibilityRow[]
}

const round = (value: number, precision = 1): number => {
  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}

const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const sanitized = value.replace(/[,%\s]/g, '')
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : 0
}

const average = (values: number[]): number => {
  if (!values.length) {
    return 0
  }
  const sum = values.reduce((total, value) => total + value, 0)
  return sum / values.length
}

const normalizeSentiment = (values: number[]): number => {
  if (!values.length) {
    return 50
  }
  const avgRaw = average(values)
  const normalized = ((avgRaw + 1) / 2) * 100
  return Math.min(100, Math.max(0, normalized))
}

const truncateLabel = (label: string, maxLength = 52): string => {
  if (label.length <= maxLength) {
    return label
  }
  return `${label.slice(0, maxLength - 1)}…`
}

class BrandDashboardService {
  private async resolveBrand(brandKey: string, customerId: string): Promise<BrandRow> {
    const { data: brandById, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, name, slug')
      .eq('customer_id', customerId)
      .eq('id', brandKey)
      .maybeSingle()

    if (brandError) {
      throw new DatabaseError(`Failed to load brand: ${brandError.message}`)
    }

    if (brandById) {
      return brandById as BrandRow
    }

    const { data: brandBySlug, error: slugError } = await supabaseAdmin
      .from('brands')
      .select('id, name, slug')
      .eq('customer_id', customerId)
      .eq('slug', brandKey.toLowerCase())
      .maybeSingle()

    if (slugError) {
      throw new DatabaseError(`Failed to load brand: ${slugError.message}`)
    }

    if (!brandBySlug) {
      throw new DatabaseError('Brand not found for current customer')
    }

    return brandBySlug as BrandRow
  }

  async getBrandDashboard(brandKey: string, customerId: string): Promise<BrandDashboardPayload> {
    const brand = await this.resolveBrand(brandKey, customerId)

    const now = new Date()

    console.log(`[Dashboard] Querying scores for brand_id=${brand.id}, customer_id=${customerId}`)
    
    // Debug: Check what customer_ids exist for this brand in scores table
    const debugScoresCheck = await supabaseAdmin
      .from('scores')
      .select('customer_id, brand_id')
      .eq('brand_id', brand.id)
      .limit(5)
    
    console.log(`[Dashboard] Debug - Found ${debugScoresCheck.data?.length ?? 0} scores for brand_id=${brand.id} (any customer_id)`)
    if (debugScoresCheck.data && debugScoresCheck.data.length > 0) {
      const uniqueCustomerIds = [...new Set(debugScoresCheck.data.map(r => r.customer_id))]
      console.log(`[Dashboard] Debug - Unique customer_ids in scores: ${uniqueCustomerIds.join(', ')}`)
      console.log(`[Dashboard] Debug - Looking for customer_id: ${customerId}`)
      console.log(`[Dashboard] Debug - Match found: ${uniqueCustomerIds.includes(customerId)}`)
    }
    
    const competitorListPromise = supabaseAdmin
      .from('brand_competitors')
      .select('competitor_name')
      .eq('brand_id', brand.id)
      .order('priority', { ascending: true })

    const positionsPromise = supabaseAdmin
      .from('extracted_positions')
      .select(
        'brand_name, query_id, collector_result_id, collector_type, competitor_name, visibility_index, visibility_index_competitor, share_of_answers_brand, share_of_answers_competitor, sentiment_score, sentiment_label, total_brand_mentions, competitor_mentions, processed_at, brand_positions, competitor_positions'
      )
      .eq('brand_id', brand.id)
      .eq('customer_id', customerId)
      .order('processed_at', { ascending: true })

    const [queryCountResult, positionsResult, competitorResult] = await Promise.all([
      supabaseAdmin
        .from('generated_queries')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brand.id)
        .eq('customer_id', customerId),
      positionsPromise,
      competitorListPromise
    ])

    console.log(`[Dashboard] Supabase extracted_positions query returned: ${positionsResult.data?.length ?? 0} rows, error: ${positionsResult.error?.message ?? 'none'}`)

    let totalQueries = queryCountResult.count ?? 0

    if (positionsResult.error) {
      throw new DatabaseError(`Failed to load extracted positions: ${positionsResult.error.message}`)
    }

    if (competitorResult.error) {
      throw new DatabaseError(`Failed to load brand competitors: ${competitorResult.error.message}`)
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

    const firstTimestamp = positionRows[0]?.processed_at
    const lastTimestamp = positionRows.length > 0 ? positionRows[positionRows.length - 1]?.processed_at : undefined

    const startIso = firstTimestamp ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endIso = lastTimestamp ?? now.toISOString()

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
      }
    >()

    const collectorAggregates = new Map<
      string,
      {
        shareValues: number[]
        visibilityValues: number[]
        mentions: number
      }
    >()

    // Per-collector scoring: Multiple rows per query (one per collector per competitor)
    // We aggregate across collectors to get average scores per query
    const brandShareByQuery = new Map<string, number[]>() // Changed to array for averaging
    const brandVisibilityByQuery = new Map<string, number[]>() // Changed to array for averaging
    const brandSentimentByQuery = new Map<string, number[]>()
    const queryTextMap = new Map<string, string>()
    const collectorVisibilityMap = new Map<number, number[]>()

    if (positionRows.length > 0) {
      const uniqueCollectorResultIds = Array.from(
        new Set(
          positionRows
            .map((row) => row.collector_result_id)
            .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
        )
      )

      if (uniqueCollectorResultIds.length > 0) {
        const { data: collectorRows, error: collectorRowsError } = await supabaseAdmin
          .from('collector_results')
          .select('id, question')
          .in('id', uniqueCollectorResultIds)

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
        const { data: queryRows, error: queryRowsError } = await supabaseAdmin
          .from('generated_queries')
          .select('id, query_text')
          .in('id', uniqueQueryIds)

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
        })
      }
    }

    let generatedQueryFallback = 0
    let processedRowCount = 0

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
      const hasBrandSentiment = row.sentiment_score !== null && row.sentiment_score !== undefined
      const brandSentiment = hasBrandSentiment ? toNumber(row.sentiment_score) : 0

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

      const isBrandRow = !row.competitor_name || row.competitor_name.trim().length === 0

      if (isBrandRow || shareArray.length === 0) {
        shareArray.push(brandShare)
      }

      if (isBrandRow || visibilityArray.length === 0) {
        visibilityArray.push(brandVisibility)
      }

      if (hasBrandSentiment && (isBrandRow || sentimentArray.length === 0)) {
        sentimentArray.push(brandSentiment)
      }

      if (isBrandRow) {
        if (!collectorAggregates.has(collectorType)) {
          collectorAggregates.set(collectorType, {
            shareValues: [],
            visibilityValues: [],
            mentions: 0
          })
        }
        const collectorAggregate = collectorAggregates.get(collectorType)!
        collectorAggregate.shareValues.push(brandShare)
        collectorAggregate.visibilityValues.push(brandVisibility)

        const brandMentions = Math.max(0, toNumber(row.total_brand_mentions))
        collectorAggregate.mentions += brandMentions > 0 ? brandMentions : 1

        collectorAggregates.set(collectorType, collectorAggregate)

        if (
          typeof row.collector_result_id === 'number' &&
          Number.isFinite(row.collector_result_id)
        ) {
          if (!collectorVisibilityMap.has(row.collector_result_id)) {
            collectorVisibilityMap.set(row.collector_result_id, [])
          }
          collectorVisibilityMap.get(row.collector_result_id)!.push(brandVisibility)
        }
      }

      if (processedRowCount <= 3) {
        console.log(`[Dashboard] ${collectorType} - Query ${queryId}: share=${brandShare}, visibility=${brandVisibility}, sentiment=${brandSentiment}`)
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
      const hasCompetitorSentiment = row.sentiment_score !== null && row.sentiment_score !== undefined
      const competitorSentiment = hasCompetitorSentiment ? toNumber(row.sentiment_score) : 0
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
          >()
        })
      }

      const competitorAggregate = competitorAggregates.get(competitorName)!

      competitorAggregate.shareValues.push(competitorShare)
      competitorAggregate.visibilityValues.push(competitorVisibility)
      if (hasCompetitorSentiment) {
        competitorAggregate.sentimentValues.push(competitorSentiment)
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
          ? [...competitorQueryAggregate.sentimentValues, competitorSentiment]
          : competitorQueryAggregate.sentimentValues,
        mentionSum: competitorQueryAggregate.mentionSum + competitorMentions,
        count: competitorQueryAggregate.count + 1
      })

      competitorAggregates.set(competitorName, competitorAggregate)
    }

    // Populate queryAggregates with averaged brand shares
    for (const [queryId, shareArray] of brandShareByQuery.entries()) {
      const avgShare = shareArray.length > 0 ? average(shareArray) : 0
      const text = queryTextMap.get(queryId) ?? 'Unlabeled query'
      queryAggregates.set(queryId, { text, share: avgShare })
    }

    // Flatten arrays and calculate averages
    const brandShareValues = Array.from(brandShareByQuery.values()).map(arr => average(arr))
    const brandVisibilityValues = Array.from(brandVisibilityByQuery.values()).map(arr => average(arr))
    const brandSentimentValues = Array.from(brandSentimentByQuery.values()).flat()

    const uniqueQueries = brandShareByQuery.size
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
    
    const sentimentScore = round(normalizeSentiment(brandSentimentValues))
    
    console.log(`[Dashboard] Final metrics: shareOfAnswers=${shareOfAnswersPercentage}%, visibilityIndex=${visibilityIndexPercentage}%, sentiment=${sentimentScore}`)

    // Fetch citation sources for Source Type Distribution
    const { data: citationsData } = await supabaseAdmin
      .from('citations')
      .select('domain, category, usage_count, collector_result_id')
      .eq('brand_id', brand.id)
      .eq('customer_id', customerId)

    const categoryVisibilityAggregates = new Map<
      string,
      {
        visibilitySum: number
        weight: number
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

    let competitorVisibility: CompetitorVisibility[] = Array.from(competitorAggregates.entries())
      .map(([competitorName, aggregate]) => {
        const competitorShare = aggregate.shareValues.reduce((sum, value) => sum + value, 0)
        const share = totalShareUniverse > 0 ? round((competitorShare / totalShareUniverse) * 100) : round(average(aggregate.shareValues))

        const topSignals = Array.from(aggregate.queries.values())
          .map((query) => ({
            collectorType: truncateLabel(query.text, 36),
            mentions: query.mentionSum > 0
              ? Math.round(query.mentionSum / Math.max(1, query.count))
              : Math.round(query.shareSum / Math.max(1, query.count))
          }))
          .sort((a, b) => b.mentions - a.mentions)
          .slice(0, 3)

        return {
          competitor: competitorName,
          mentions: aggregate.mentions || aggregate.shareValues.length,
          share,
          collectors: topSignals
        }
      })
      .sort((a, b) => b.share - a.share)
      .slice(0, 5)

    const competitorNamesSeen = new Set(competitorVisibility.map((entry) => entry.competitor.toLowerCase()))
    knownCompetitors.forEach((competitorName) => {
      if (!competitorNamesSeen.has(competitorName.toLowerCase())) {
        competitorVisibility.push({
          competitor: competitorName,
          mentions: 0,
          share: 0,
          collectors: []
        })
      }
    })

    competitorVisibility = competitorVisibility.sort((a, b) => b.share - a.share).slice(0, 5)

    const queryVisibility: QueryVisibilityRow[] = Array.from(queryAggregates.entries()).map(([queryId, aggregate]) => {
      // Average across collectors
      const brandShareArray = brandShareByQuery.get(queryId) ?? []
      const brandVisibilityArray = brandVisibilityByQuery.get(queryId) ?? []
      const brandSentimentArray = brandSentimentByQuery.get(queryId) ?? []
      
      const brandShare = brandShareArray.length > 0 ? average(brandShareArray) : 0
      const brandVisibility = brandVisibilityArray.length > 0 ? average(brandVisibilityArray) : 0
      const brandSentiment =
        brandSentimentArray.length > 0 ? round(normalizeSentiment(brandSentimentArray)) : null

      const competitors = Array.from(competitorAggregates.entries())
        .map(([competitorName, aggregate]) => {
          const stats = aggregate.queries.get(queryId)
          if (!stats) {
            return null
          }
          const avgShare = stats.shareSum / Math.max(1, stats.count)
          const avgVisibility = stats.visibilitySum / Math.max(1, stats.count)
          const sentiment =
            stats.sentimentValues.length > 0 ? round(normalizeSentiment(stats.sentimentValues)) : null
          return {
            competitor: competitorName,
            share: round(avgShare),
            visibility: round(avgVisibility),
            sentiment
          }
        })
        .filter(
          (
            entry
          ): entry is { competitor: string; share: number; visibility: number; sentiment: number | null } =>
            entry !== null
        )

      const competitorLabelsSeen = new Set(competitors.map((entry) => entry.competitor.toLowerCase()))
      knownCompetitors.forEach((name) => {
        if (!competitorLabelsSeen.has(name.toLowerCase())) {
          competitors.push({
            competitor: name,
            share: 0,
            visibility: 0,
            sentiment: null
          })
        }
      })

      competitors.sort((a, b) => b.share - a.share)

      return {
        queryId,
        queryText: aggregate.text,
        brandShare: round(brandShare),
        brandVisibility: round(brandVisibility),
        brandSentiment,
        competitors
      }
    })

    const visibilityComparison = [
      {
        entity: brand.name,
        isBrand: true,
        mentions: totalResponses,
        share: totalShareUniverse > 0 ? round((brandShareSum / totalShareUniverse) * 100) : round(average(brandShareValues))
      },
      ...competitorVisibility.map((competitor) => ({
        entity: competitor.competitor,
        isBrand: false,
        mentions: competitor.mentions,
        share: competitor.share
      }))
    ].sort((a, b) => b.share - a.share)

    const coverageScore = sourceDistribution.length > 0 ? Math.min(95, round(sourceDistribution.length / 6 * 100)) : 40

    const totalCollectorMentions = Array.from(collectorAggregates.values()).reduce(
      (sum, aggregate) => sum + aggregate.mentions,
      0
    )
    const totalCollectorShareSum = Array.from(collectorAggregates.values()).reduce(
      (sum, aggregate) => sum + aggregate.shareValues.reduce((inner, value) => inner + value, 0),
      0
    )

    const llmVisibility: LlmVisibilitySlice[] = Array.from(collectorAggregates.entries())
      .map(([collectorType, aggregate]) => {
        const averageVisibilityRaw =
          aggregate.visibilityValues.length > 0 ? average(aggregate.visibilityValues) : 0
        const clampedVisibility = Math.min(1, Math.max(0, averageVisibilityRaw))
        const visibilityPercentage = round(clampedVisibility * 100)
        const hasVisibility = visibilityPercentage > 0

        const shareValueSum = aggregate.shareValues.reduce((sum, value) => sum + value, 0)
        const shareFromValues =
          totalCollectorShareSum > 0 ? round((shareValueSum / totalCollectorShareSum) * 100) : 0
        const shareFromMentions =
          totalCollectorMentions > 0 ? round((aggregate.mentions / totalCollectorMentions) * 100) : 0
        const shareValue = hasVisibility ? visibilityPercentage : shareFromValues || shareFromMentions

        const normalizedCollectorType = collectorType.toLowerCase().trim()
        const color =
          COLLECTOR_COLORS[normalizedCollectorType] ??
          COLLECTOR_COLORS[(normalizedCollectorType.split(/[._-]/)[0]) || 'default'] ??
          COLLECTOR_COLORS.default

        return {
          provider: collectorType,
          share: shareValue,
          delta: 0,
          color
        }
      })
      .sort((a, b) => b.share - a.share)

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

    return {
      brandId: brand.id,
      brandName: brand.name,
      brandSlug: brand.slug ?? undefined,
      customerId,
      dateRange: { start: startIso, end: endIso },
      totalQueries,
      totalResponses,
      visibilityPercentage: round(shareOfAnswersPercentage), // This is Share of Answers, not Visibility Index
      trendPercentage,
      sentimentScore,
      visibilityComparison,
      scores,
      sourceDistribution,
      categoryDistribution,
      llmVisibility,
      actionItems: actionItems.slice(0, 4),
      collectorSummaries: [],
      competitorVisibility,
      queryVisibility
    }
  }
}

export const brandDashboardService = new BrandDashboardService()
