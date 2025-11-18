import { supabaseAdmin } from '../config/database'
import { SourceAttributionResponse } from './source-attribution.service'

const SOURCE_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface SourceSnapshotRow {
  payload: SourceAttributionResponse
  computed_at: string
}

export class SourceAttributionCacheService {
  private getSnapshotAgeMs(computedAt: string | null | undefined): number | null {
    if (!computedAt) {
      return null
    }

    const age = Date.now() - new Date(computedAt).getTime()
    return Number.isFinite(age) ? age : null
  }

  isCacheValid(computedAt: string | null | undefined): boolean {
    const age = this.getSnapshotAgeMs(computedAt)
    if (age === null) {
      return false
    }
    return age >= 0 && age <= SOURCE_CACHE_TTL_MS
  }

  private isValidCachedPayload(payload: any): payload is SourceAttributionResponse {
    try {
      // Validate that the payload has the expected structure
      if (!payload || typeof payload !== 'object') {
        console.log('[SourceAttribution] ⚠️ Cached payload is not an object - treating as invalid')
        return false
      }

      // Ensure required top-level fields exist
      if (!('sources' in payload) || !('overallMentionRate' in payload) || !('dateRange' in payload)) {
        console.log('[SourceAttribution] ⚠️ Cached payload missing required fields - treating as invalid')
        return false
      }

      // Ensure sources is an array
      if (!Array.isArray(payload.sources)) {
        console.log('[SourceAttribution] ⚠️ Cached payload sources is not an array - treating as invalid')
        return false
      }

      // Validate dateRange structure
      if (!payload.dateRange || typeof payload.dateRange !== 'object' || !('start' in payload.dateRange) || !('end' in payload.dateRange)) {
        console.log('[SourceAttribution] ⚠️ Cached payload dateRange is invalid - treating as invalid')
        return false
      }

      return true
    } catch (error) {
      console.warn('[SourceAttribution] Error validating cached payload:', error)
      return false
    }
  }

  async getCachedSourceAttribution(
    brandId: string,
    customerId: string,
    startIso: string,
    endIso: string
  ): Promise<SourceSnapshotRow | null> {
    const cacheLookupStart = Date.now()
    try {
      // Use primary key lookup for optimal performance
      const queryStart = Date.now()
      const { data, error } = await supabaseAdmin
        .from('source_attribution_snapshots')
        .select('payload, computed_at')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .eq('range_start', startIso)
        .eq('range_end', endIso)
        .maybeSingle()
      const queryTime = Date.now() - queryStart

      if (error) {
        console.warn(`[SourceAttribution] ❌ Cache query failed (${queryTime}ms):`, error)
        return null
      }

      if (!data) {
        const totalTime = Date.now() - cacheLookupStart
        console.log(`[SourceAttribution] ⚠️ No cached snapshot found (query: ${queryTime}ms, total: ${totalTime}ms)`)
        return null
      }

      const validationStart = Date.now()
      const payload = data.payload as SourceAttributionResponse

      // Validate cached payload structure - if invalid, treat as missing
      if (!this.isValidCachedPayload(payload)) {
        const totalTime = Date.now() - cacheLookupStart
        console.log(`[SourceAttribution] ⚠️ Cached payload structure invalid (query: ${queryTime}ms, validation: ${Date.now() - validationStart}ms, total: ${totalTime}ms) - will recompute`)
        return null
      }

      // Check if cache is still valid (within TTL)
      const ageMs = this.getSnapshotAgeMs(data.computed_at)
      if (!this.isCacheValid(data.computed_at)) {
        const totalTime = Date.now() - cacheLookupStart
        const ageMinutes = ageMs ? (ageMs / 60000).toFixed(1) : 'unknown'
        console.log(`[SourceAttribution] ⏰ Cache expired (age: ${ageMinutes}min, TTL: 5min, query: ${queryTime}ms, total: ${totalTime}ms) - will recompute`)
        return null
      }

      const totalTime = Date.now() - cacheLookupStart
      const validationTime = Date.now() - validationStart
      console.log(`[SourceAttribution] ✅ Cache HIT (query: ${queryTime}ms, validation: ${validationTime}ms, total: ${totalTime}ms) - ${payload.sources?.length ?? 0} sources`)
      return {
        payload,
        computed_at: data.computed_at
      }
    } catch (error) {
      const totalTime = Date.now() - cacheLookupStart
      console.error(`[SourceAttribution] ❌ Unexpected error in cache lookup (${totalTime}ms):`, error)
      return null
    }
  }

  async upsertSourceAttributionSnapshot(
    brandId: string,
    customerId: string,
    payload: SourceAttributionResponse,
    startIso: string,
    endIso: string
  ): Promise<void> {
    const nowIso = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('source_attribution_snapshots')
      .upsert(
        {
          brand_id: brandId,
          customer_id: customerId,
          payload,
          range_start: startIso,
          range_end: endIso,
          computed_at: nowIso,
          refreshed_at: nowIso
        },
        { onConflict: 'brand_id,customer_id,range_start,range_end' }
      )

    if (error) {
      console.warn('[SourceAttribution] Failed to upsert snapshot:', error)
    } else {
      console.log(`[SourceAttribution] ✅ Cached snapshot for brand ${brandId}, range ${startIso} → ${endIso}`)
    }
  }

  getAgeMs(computedAt: string | null | undefined): number | null {
    return this.getSnapshotAgeMs(computedAt)
  }
}

export const sourceAttributionCacheService = new SourceAttributionCacheService()

