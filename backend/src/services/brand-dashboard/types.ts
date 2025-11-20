export interface BrandRow {
  id: string
  name: string
  slug?: string
}

export interface PositionRow {
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
  has_brand_presence: boolean | null
  metadata?: Record<string, any> | null
}

export interface ScoreMetric {
  label: string
  value: number
  delta: number
  description: string
}

export interface DistributionSlice {
  label: string
  percentage: number
  color: string
}

export interface CollectorAggregateTopicStats {
  occurrences: number
  shareSum: number
  visibilitySum: number
  mentions: number
}

export interface CollectorAggregate {
  shareValues: number[]
  visibilityValues: number[]
  mentions: number
  brandPresenceCount: number
  uniqueQueryIds: Set<string>
  topics: Map<string, CollectorAggregateTopicStats>
}

export interface LlmVisibilitySlice {
  provider: string
  share: number
  shareOfSearch: number
  visibility: number
  delta: number
  brandPresenceCount: number
  totalQueries: number
  color: string
  topTopic: string | null
  topTopics: Array<{
    topic: string
    occurrences: number
    share: number
    visibility: number
    mentions: number
  }>
}

export interface ActionItem {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: 'content' | 'technical' | 'distribution' | 'monitoring'
}

export interface CollectorSummary {
  collectorType: string
  status: 'completed' | 'failed' | 'pending' | 'running'
  successRate: number
  completed: number
  failed: number
  lastRunAt: string
}

export interface CompetitorVisibility {
  competitor: string
  mentions: number
  share: number
  visibility: number
  brandPresencePercentage: number
  topTopics: Array<{
    topic: string
    occurrences: number
    share: number
    visibility: number
    mentions: number
  }>
  collectors: Array<{
    collectorType: string
    mentions: number
  }>
}

export interface QueryVisibilityRow {
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

export interface TopBrandSource {
  id: string
  title: string
  url: string
  domain: string
  impactScore: number | null
  change: number | null
  visibility: number
  share: number
  usage: number
}

export interface TopicPerformanceRow {
  topic: string
  promptsTracked: number
  averageVolume: number
  sentimentScore: number | null // Can be null if no sentiment data
  avgVisibility: number | null // Can be null if no visibility data
  avgShare: number | null // Can be null if no share data
  brandPresencePercentage: number | null // Can be null if no brand presence data
}

export interface BrandSummary {
  visibility: number
  share: number
  brandPresencePercentage: number
  topTopics: Array<{
    topic: string
    occurrences: number
    share: number
    visibility: number
  }>
}

export interface BrandDashboardPayload {
  brandId: string
  brandName: string
  brandSlug?: string
  customerId: string
  dateRange: { start: string; end: string }
  totalQueries: number
  queriesWithBrandPresence: number
  collectorResultsWithBrandPresence: number
  brandPresenceRows: number
  totalBrandRows: number
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
  topSourcesDistribution: DistributionSlice[] // Top 10 sources by domain
  categoryDistribution: DistributionSlice[]
  llmVisibility: LlmVisibilitySlice[]
  actionItems: ActionItem[]
  collectorSummaries: CollectorSummary[]
  competitorVisibility: CompetitorVisibility[]
  queryVisibility: QueryVisibilityRow[]
  topBrandSources: TopBrandSource[]
  topTopics: TopicPerformanceRow[]
  brandSummary?: BrandSummary
}

export interface DashboardDateRange {
  start: string
  end: string
}

export interface DashboardSnapshotRow {
  payload: BrandDashboardPayload
  computed_at: string
}

export interface NormalizedDashboardRange {
  startDate: Date
  endDate: Date
  startIso: string
  endIso: string
}

