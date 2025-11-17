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
    try {
      const { data, error } = await supabaseAdmin
        .from('source_attribution_snapshots')
        .select('payload, computed_at')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .eq('range_start', startIso)
        .eq('range_end', endIso)
        .maybeSingle()

      if (error) {
        console.warn('[SourceAttribution] Failed to load snapshot:', error)
        return null
      }

      if (!data) {
        console.log(`[SourceAttribution] No cached snapshot found for brand ${brandId}, range ${startIso} → ${endIso}`)
        return null
      }

      const payload = data.payload as SourceAttributionResponse

      // Validate cached payload structure - if invalid, treat as missing
      if (!this.isValidCachedPayload(payload)) {
        console.log('[SourceAttribution] ⚠️ Cached payload structure invalid - will recompute')
        return null
      }

      // Check if cache is still valid (within TTL)
      if (!this.isCacheValid(data.computed_at)) {
        console.log(`[SourceAttribution] Cached snapshot expired (age: ${this.getSnapshotAgeMs(data.computed_at)}ms) - will recompute`)
        return null
      }

      console.log(`[SourceAttribution] ✅ Found valid cached snapshot: ${payload.sources?.length ?? 0} sources`)
      return {
        payload,
        computed_at: data.computed_at
      }
    } catch (error) {
      console.error('[SourceAttribution] Unexpected error in getCachedSourceAttribution:', error)
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

