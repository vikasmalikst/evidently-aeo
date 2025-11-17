import { supabaseAdmin } from '../../config/database'
import { BrandDashboardPayload, NormalizedDashboardRange, DashboardSnapshotRow } from './types'

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000

export class DashboardCacheService {
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
    return age >= 0 && age <= DASHBOARD_CACHE_TTL_MS
  }

  private isValidCachedPayload(payload: any): payload is BrandDashboardPayload {
    try {
      // Validate that the payload has the expected structure
      if (!payload || typeof payload !== 'object') {
        console.log('[Dashboard] ⚠️ Cached payload is not an object - treating as invalid')
        return false
      }

      // Ensure required top-level fields exist
      if (!('brandId' in payload) || !('brandName' in payload) || !('customerId' in payload)) {
        console.log('[Dashboard] ⚠️ Cached payload missing required fields (brandId, brandName, customerId) - treating as invalid')
        return false
      }

      // Ensure llmVisibility exists (even if empty array is valid)
      if (!('llmVisibility' in payload)) {
        console.log('[Dashboard] ⚠️ Cached payload missing llmVisibility field - treating as invalid')
        return false
      }

      // If llmVisibility is not an array, it's invalid
      if (!Array.isArray(payload.llmVisibility)) {
        console.log('[Dashboard] ⚠️ Cached payload llmVisibility is not an array - treating as invalid')
        return false
      }

      // Ensure competitorVisibility exists (even if empty array is valid)
      if (!('competitorVisibility' in payload)) {
        console.log('[Dashboard] ⚠️ Cached payload missing competitorVisibility field - treating as invalid')
        return false
      }

      // If competitorVisibility is not an array, it's invalid
      if (!Array.isArray(payload.competitorVisibility)) {
        console.log('[Dashboard] ⚠️ Cached payload competitorVisibility is not an array - treating as invalid')
        return false
      }

      // For non-empty llmVisibility arrays, validate structure but be lenient
      // We'll add defaults in the dashboard service for backward compatibility
      if (payload.llmVisibility.length > 0) {
        const hasValidSlices = payload.llmVisibility.every(
          (slice: any) => typeof slice === 'object' && slice !== null && 'provider' in slice
        )
        if (!hasValidSlices) {
          console.log('[Dashboard] ⚠️ Cached payload has invalid llmVisibility slices - will add defaults')
          // Don't reject, just log - we'll fix it in the service
        }
      }

      return true
    } catch (error) {
      console.warn('[Dashboard] Error validating cached payload:', error)
      return false
    }
  }

  async getCachedDashboard(
    brandId: string,
    customerId: string,
    range: NormalizedDashboardRange
  ): Promise<DashboardSnapshotRow | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('brand_dashboard_snapshots')
        .select('payload, computed_at')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .eq('range_start', range.startIso)
        .eq('range_end', range.endIso)
        .maybeSingle()

      if (error) {
        console.warn('[Dashboard] Failed to load dashboard snapshot:', error)
        return null
      }

      if (!data) {
        console.log(`[Dashboard] No cached snapshot found for brand ${brandId}, range ${range.startIso} → ${range.endIso}`)
        return null
      }

      const payload = data.payload as BrandDashboardPayload

      // Validate cached payload structure - if invalid, treat as missing
      if (!this.isValidCachedPayload(payload)) {
        console.log('[Dashboard] ⚠️ Cached payload structure invalid - will recompute')
        return null
      }

      console.log(`[Dashboard] ✅ Found valid cached snapshot: ${payload.llmVisibility?.length ?? 0} LLM models, ${payload.competitorVisibility?.length ?? 0} competitors`)
      return {
        payload,
        computed_at: data.computed_at
      }
    } catch (error) {
      console.error('[Dashboard] Unexpected error in getCachedDashboard:', error)
      return null
    }
  }

  async upsertDashboardSnapshot(
    brandId: string,
    customerId: string,
    payload: BrandDashboardPayload,
    range: NormalizedDashboardRange
  ): Promise<void> {
    const nowIso = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('brand_dashboard_snapshots')
      .upsert(
        {
          brand_id: brandId,
          customer_id: customerId,
          payload,
          range_start: range.startIso,
          range_end: range.endIso,
          computed_at: nowIso,
          refreshed_at: nowIso
        },
        { onConflict: 'brand_id,customer_id,range_start,range_end' }
      )

    if (error) {
      console.warn('[Dashboard] Failed to upsert dashboard snapshot:', error)
    }
  }

  getAgeMs(computedAt: string | null | undefined): number | null {
    return this.getSnapshotAgeMs(computedAt)
  }
}

export const dashboardCacheService = new DashboardCacheService()

