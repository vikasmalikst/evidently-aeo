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
  TopicPerformanceRow
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
    dateRange?: DashboardDateRange
  ): Promise<BrandDashboardPayload> {
    try {
      const brand = await this.resolveBrand(brandKey, customerId)

      const normalizedRange = normalizeDateRange(dateRange)
      
      console.log(`[Dashboard] Looking up cache for brand ${brand.id}, range ${normalizedRange.startIso} → ${normalizedRange.endIso}`)
      
      // Try to get cached dashboard, but don't let cache errors block the request
      let cached = null
      try {
        cached = await dashboardCacheService.getCachedDashboard(brand.id, customerId, normalizedRange)
        if (cached) {
          console.log(`[Dashboard] Cache lookup found snapshot (computed at: ${cached.computed_at})`)
          // Validate that cached payload has data
          if (cached.payload && typeof cached.payload === 'object') {
            const payload = cached.payload as BrandDashboardPayload
            if (Array.isArray(payload.llmVisibility) && payload.llmVisibility.length > 0) {
              console.log(`[Dashboard] Cached payload has ${payload.llmVisibility.length} LLM models`)
            } else {
              console.log(`[Dashboard] Cached payload has empty llmVisibility array - will recompute`)
              cached = null
            }
          }
        } else {
          console.log(`[Dashboard] Cache lookup returned null (no cached snapshot found)`)
        }
      } catch (cacheError) {
        console.warn('[Dashboard] Cache lookup error (will recompute):', cacheError)
        cached = null
      }

      const cachedAgeMs = dashboardCacheService.getAgeMs(cached?.computed_at ?? null)

      if (cached && dashboardCacheService.isCacheValid(cached.computed_at)) {
        console.log(
          `[Dashboard] ✅ Serving cached snapshot for brand ${brand.id} range ${normalizedRange.startIso} → ${normalizedRange.endIso} (age ${cachedAgeMs ?? 0}ms)`
        )
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
              enhancedSlice.totalQueries = enhancedSlice.uniqueQueryIds?.size ?? enhancedSlice.brandPresenceCount ?? 0
            }
            // Ensure brandPresenceCount exists
            if (!('brandPresenceCount' in enhancedSlice) || typeof enhancedSlice.brandPresenceCount !== 'number') {
              enhancedSlice.brandPresenceCount = 0
            }
            // Ensure visibility exists
            if (!('visibility' in enhancedSlice) || typeof enhancedSlice.visibility !== 'number') {
              enhancedSlice.visibility = enhancedSlice.shareOfSearch ?? enhancedSlice.share ?? 0
            }
            // Ensure shareOfSearch exists
            if (!('shareOfSearch' in enhancedSlice) || typeof enhancedSlice.shareOfSearch !== 'number') {
              enhancedSlice.shareOfSearch = enhancedSlice.share ?? 0
            }
            // Ensure topTopics exists
            if (!('topTopics' in enhancedSlice) || !Array.isArray(enhancedSlice.topTopics)) {
              enhancedSlice.topTopics = []
            }
            return enhancedSlice
          })
        }
        
        // Ensure competitorVisibility exists
        if (!payload.competitorVisibility) {
          payload.competitorVisibility = []
        }
        if (Array.isArray(payload.competitorVisibility)) {
          payload.competitorVisibility = payload.competitorVisibility.map((entry: any) => ({
            ...entry,
            mentions: entry.mentions ?? 0,
            share: entry.share ?? 0,
            visibility: entry.visibility ?? 0,
            collectors: entry.collectors ?? []
          }))
        }
        
        console.log(`[Dashboard] ✅ Cached payload: ${payload.llmVisibility.length} LLM models, ${payload.competitorVisibility.length} competitors`)
        console.log(`[Dashboard] Cached llmVisibility providers:`, payload.llmVisibility.map((s: any) => s.provider))
        return payload
      }

      if (cached) {
        console.log(
          `[Dashboard] ♻️ Snapshot stale for brand ${brand.id} range ${normalizedRange.startIso} → ${normalizedRange.endIso} (age ${cachedAgeMs ?? 'unknown'}ms) - recomputing`
        )
      } else {
        console.log(
          `[Dashboard] ❌ No snapshot for brand ${brand.id} range ${normalizedRange.startIso} → ${normalizedRange.endIso} - computing full payload`
        )
      }

      const payload = await this.buildDashboardPayload(brand, customerId, normalizedRange)
      
      // Ensure required fields exist with proper defaults
      if (!payload.llmVisibility) {
        console.warn('[Dashboard] ⚠️ Payload missing llmVisibility - initializing empty array')
        payload.llmVisibility = []
      }
      if (!Array.isArray(payload.llmVisibility)) {
        console.warn('[Dashboard] ⚠️ Payload llmVisibility is not an array - converting to array')
        payload.llmVisibility = []
      }
      
      if (!payload.competitorVisibility) {
        console.warn('[Dashboard] ⚠️ Payload missing competitorVisibility - initializing empty array')
        payload.competitorVisibility = []
      }
      if (!Array.isArray(payload.competitorVisibility)) {
        console.warn('[Dashboard] ⚠️ Payload competitorVisibility is not an array - converting to array')
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
      
      console.log(`[Dashboard] ✅ Computed payload: ${payload.llmVisibility.length} LLM models, ${payload.competitorVisibility.length} competitors`)
      console.log(`[Dashboard] Computed llmVisibility providers:`, payload.llmVisibility.map((s: any) => s.provider))
      
      // Only cache if we have valid data structure (even if arrays are empty)
      if (payload && typeof payload === 'object' && 'brandId' in payload && 'llmVisibility' in payload) {
        // Upsert cache in background, don't block response
        dashboardCacheService.upsertDashboardSnapshot(brand.id, customerId, payload, normalizedRange).catch((error) => {
          console.warn('[Dashboard] Failed to cache dashboard (non-blocking):', error)
        })
      } else {
        console.warn('[Dashboard] ⚠️ Skipping cache - invalid payload structure')
      }
      
      return payload
    } catch (error) {
      console.error('[Dashboard] Error in getBrandDashboard:', error)
      throw error
    }
  }

  private async buildDashboardPayload(
    brand: BrandRow,
    customerId: string,
    range: NormalizedDashboardRange
  ): Promise<BrandDashboardPayload> {
    return buildDashboardPayload(brand, customerId, range)
  }
}

export const dashboardService = new DashboardService()

