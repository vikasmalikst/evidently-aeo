import { supabaseAdmin } from '../../config/database'
import { DatabaseError } from '../../types/auth'
import {
  BrandRow,
  BrandDashboardPayload,
  DashboardDateRange,
  NormalizedDashboardRange,
  PositionRow,
  CollectorAggregate,
  ScoreMetric,
  DistributionSlice,
  ActionItem,
  TopBrandSource,
  TopicPerformanceRow,
  DashboardSnapshotRow
} from './types'
import {
  normalizeDateRange,
  round,
  toNumber,
  average,
  normalizeSentiment,
  truncateLabel,
  clampPercentage,
  toPercentage,
  DISTRIBUTION_COLORS
} from './utils'
import { dashboardCacheService } from './cache.service'
import { buildDashboardPayload } from './payload-builder'

export class DashboardService {
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

  async getBrandDashboard(
    brandKey: string,
    customerId: string,
    dateRange?: DashboardDateRange,
    options: { skipCache?: boolean; collectors?: string[]; timezoneOffset?: number; skipCitations?: boolean } = {}
  ): Promise<BrandDashboardPayload> {
    try {
      const { skipCache = false, collectors, timezoneOffset = 0, skipCitations = false } = options
      const hasCollectorFilter = Array.isArray(collectors) && collectors.length > 0
      const effectiveSkipCache = skipCache || hasCollectorFilter
      const brand = await this.resolveBrand(brandKey, customerId)

      const normalizedRange = normalizeDateRange(dateRange)

      const shouldUseCache = !effectiveSkipCache

      // Try to get cached dashboard, but don't let cache errors block the request
      let cached: DashboardSnapshotRow | null = null
      if (shouldUseCache) {
        try {
          cached = await dashboardCacheService.getCachedDashboard(brand.id, customerId, normalizedRange)
          if (cached) {
            // Validate that cached payload has data
            if (cached.payload && typeof cached.payload === 'object') {
              const payload = cached.payload as BrandDashboardPayload
              if (!Array.isArray(payload.llmVisibility) || payload.llmVisibility.length === 0) {
                cached = null
              }
            }
          }
        } catch (cacheError) {
          console.warn('[Dashboard] Cache lookup error (will recompute):', cacheError)
          cached = null
        }
      }

      if (shouldUseCache && cached && dashboardCacheService.isCacheValid(cached.computed_at)) {
        // Ensure totalBrandRows exists for backward compatibility
        const payload: BrandDashboardPayload = { ...cached.payload } as BrandDashboardPayload

        // Ensure all required fields exist with defaults
        if (!('totalBrandRows' in payload) || typeof payload.totalBrandRows !== 'number') {
          payload.totalBrandRows = (payload.brandPresenceRows || 0) as number
        }

        // Ensure llmVisibility exists and has required fields for backward compatibility
        if (!payload.llmVisibility) {
          payload.llmVisibility = []
        }
        if (Array.isArray(payload.llmVisibility)) {
          payload.llmVisibility = payload.llmVisibility.map((slice: any) => {
            const enhancedSlice = { ...slice }
            // Ensure totalQueries exists
            if (!('totalQueries' in enhancedSlice) || typeof enhancedSlice.totalQueries !== 'number') {
              enhancedSlice.totalQueries = enhancedSlice.uniqueQueryIds?.size || enhancedSlice.brandPresenceCount || 0
            }
            // Ensure brandPresenceCount exists
            if (!('brandPresenceCount' in enhancedSlice) || typeof enhancedSlice.brandPresenceCount !== 'number') {
              enhancedSlice.brandPresenceCount = 0
            }
            // Ensure visibility exists
            if (!('visibility' in enhancedSlice) || typeof enhancedSlice.visibility !== 'number') {
              enhancedSlice.visibility = enhancedSlice.shareOfSearch || enhancedSlice.share || 0
            }
            // Ensure shareOfSearch exists
            if (!('shareOfSearch' in enhancedSlice) || typeof enhancedSlice.shareOfSearch !== 'number') {
              enhancedSlice.shareOfSearch = enhancedSlice.share || 0
            }
            // Ensure topTopics exists
            if (!('topTopics' in enhancedSlice) || !Array.isArray(enhancedSlice.topTopics)) {
              enhancedSlice.topTopics = []
            }
            return enhancedSlice
          })
        }

        // Ensure competitorVisibility exists and has new fields
        if (!payload.competitorVisibility) {
          payload.competitorVisibility = []
        }
        if (Array.isArray(payload.competitorVisibility)) {
          payload.competitorVisibility = payload.competitorVisibility.map((entry: any) => ({
            ...entry,
            mentions: entry.mentions ?? 0,
            share: entry.share ?? 0,
            visibility: entry.visibility ?? 0,
            brandPresencePercentage: entry.brandPresencePercentage ?? 0,
            topTopics: entry.topTopics ?? [],
            collectors: entry.collectors ?? []
          }))
        }

        // Calculate brandSummary from cached data if missing
        if (!payload.brandSummary) {
          // Get actual values from scores array (most reliable)
          const shareScore = payload.scores?.find((s: any) => s.label === 'Share of Answers')
          const visibilityScore = payload.scores?.find((s: any) => s.label === 'Visibility Index')
          const actualShare = shareScore?.value ?? payload.visibilityPercentage ?? 0
          const actualVisibility = visibilityScore?.value ?? 0

          const totalBrandPresence = payload.queriesWithBrandPresence && payload.totalQueries
            ? round((payload.queriesWithBrandPresence / payload.totalQueries) * 100, 1)
            : (payload.llmVisibility && payload.llmVisibility.length > 0
              ? payload.llmVisibility.reduce((sum: number, slice: any) => sum + (slice.brandPresencePercentage ?? 0), 0) / payload.llmVisibility.length
              : 0)

          // Aggregate top topics from all LLM slices
          const allTopics = new Map<string, { occurrences: number; share: number; visibility: number }>()
          payload.llmVisibility.forEach((slice: any) => {
            if (Array.isArray(slice.topTopics)) {
              slice.topTopics.forEach((topic: any) => {
                const existing = allTopics.get(topic.topic) || { occurrences: 0, share: 0, visibility: 0 }
                allTopics.set(topic.topic, {
                  occurrences: existing.occurrences + (topic.occurrences ?? 0),
                  share: existing.share + (topic.share ?? 0),
                  visibility: existing.visibility + (topic.visibility ?? 0)
                })
              })
            }
          })

          const topTopics = Array.from(allTopics.entries())
            .map(([topic, stats]) => ({
              topic,
              occurrences: stats.occurrences,
              share: stats.share / (payload.llmVisibility.length || 1),
              visibility: stats.visibility / (payload.llmVisibility.length || 1)
            }))
            .sort((a, b) => b.occurrences - a.occurrences || b.share - a.share)
            .slice(0, 5)

          payload.brandSummary = {
            visibility: Math.round(actualVisibility * 10) / 10,
            share: Math.round(actualShare * 10) / 10,
            brandPresencePercentage: Math.round(totalBrandPresence * 10) / 10,
            topTopics
          }
        }

        // Fetch completed recommendations even if payload is from cache
        const { data: completedRecsCache } = await supabaseAdmin
          .from('recommendations')
          .select('id, action, completed_at')
          .eq('brand_id', brand.id)
          .eq('is_completed', true)
          .gte('completed_at', normalizedRange.startIso)
          .lte('completed_at', normalizedRange.endIso)
          .order('completed_at', { ascending: true })

        payload.completedRecommendations = (completedRecsCache || []).map(r => ({
          id: r.id,
          action: r.action,
          completedAt: r.completed_at
        }))

        return payload
      }

      // Cache miss: Build fresh payload
      const payload = await this.buildDashboardPayload(brand, customerId, normalizedRange, collectors, timezoneOffset, skipCitations)

      // Ensure required fields exist with proper defaults
      if (!payload.llmVisibility) {
        payload.llmVisibility = []
      }
      if (!Array.isArray(payload.llmVisibility)) {
        payload.llmVisibility = []
      }

      if (!payload.competitorVisibility) {
        payload.competitorVisibility = []
      }
      if (!Array.isArray(payload.competitorVisibility)) {
        payload.competitorVisibility = []
      }

      // Ensure all llmVisibility slices have required fields
      payload.llmVisibility = payload.llmVisibility.map((slice) => ({
        ...slice,
        totalQueries: slice.totalQueries ?? slice.brandPresenceCount ?? 0,
        brandPresenceCount: slice.brandPresenceCount ?? 0,
        visibility: slice.visibility ?? slice.shareOfSearch ?? slice.share ?? 0,
        shareOfSearch: slice.shareOfSearch ?? slice.share ?? 0,
        share: slice.share ?? slice.shareOfSearch ?? 0,
        topTopics: slice.topTopics ?? [],
        topTopic: slice.topTopic ?? slice.topTopics?.[0]?.topic ?? null
      }))

      const hasMeaningfulData =
        (payload.totalBrandRows ?? 0) > 0 ||
        (Array.isArray(payload.llmVisibility) && payload.llmVisibility.length > 0) ||
        (Array.isArray(payload.competitorVisibility) && payload.competitorVisibility.length > 0)

      // Only cache if we have valid data structure (even if arrays are empty) AND payload has meaningful data
      if (!hasCollectorFilter) {
        if (
          hasMeaningfulData &&
          payload &&
          typeof payload === 'object' &&
          'brandId' in payload &&
          'llmVisibility' in payload
        ) {
          // Upsert cache in background, don't block response
          dashboardCacheService.upsertDashboardSnapshot(brand.id, customerId, payload, normalizedRange).catch((error) => {
            console.warn('[Dashboard] Failed to cache dashboard (non-blocking):', error)
          })
        }
      }

      // Fetch completed recommendations for freshly built payload
      const { data: completedRecsFresh } = await supabaseAdmin
        .from('recommendations')
        .select('id, action, completed_at')
        .eq('brand_id', brand.id)
        .eq('is_completed', true)
        .gte('completed_at', normalizedRange.startIso)
        .lte('completed_at', normalizedRange.endIso)
        .order('completed_at', { ascending: true })

      payload.completedRecommendations = (completedRecsFresh || []).map(r => ({
        id: r.id,
        action: r.action,
        completedAt: r.completed_at
      }))

      return payload
    } catch (error) {
      console.error('[Dashboard] Error in getBrandDashboard:', error)
      throw error
    }
  }

  private async buildDashboardPayload(
    brand: BrandRow,
    customerId: string,
    range: NormalizedDashboardRange,
    collectors?: string[],
    timezoneOffset: number = 0,
    skipCitations: boolean = false
  ): Promise<BrandDashboardPayload> {
    return buildDashboardPayload(brand, customerId, range, { collectors, timezoneOffset, skipCitations })
  }
}

export const dashboardService = new DashboardService()
