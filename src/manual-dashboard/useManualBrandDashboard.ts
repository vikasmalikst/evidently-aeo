import { useCallback, useEffect, useMemo, useState } from 'react'
import { cachedRequest } from '../lib/apiCache'
import { useAuthStore } from '../store/authStore'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ManualBrandSummary {
  id: string
  name: string
  slug?: string | null
  homepage_url?: string | null
  status?: 'active' | 'inactive'
  metadata?: Record<string, any>
}

interface UseManualBrandDashboardOptions {
  /** Persist selected brand id in localStorage when true (default) */
  persistSelection?: boolean
  /** Storage key used when persisting (default: manual-dashboard:selected-brand) */
  storageKey?: string
  /** Optional customer-scoped filter or transform */
  filter?: (brands: ManualBrandSummary[]) => ManualBrandSummary[]
}

interface UseManualBrandDashboardResult {
  brands: ManualBrandSummary[]
  isLoading: boolean
  error: string | null
  selectedBrandId: string | null
  selectedBrand: ManualBrandSummary | null
  selectBrand: (brandId: string) => void
  reload: () => void
}

const DEFAULT_STORAGE_KEY = 'manual-dashboard:selected-brand'

export const useManualBrandDashboard = (
  options: UseManualBrandDashboardOptions = {}
): UseManualBrandDashboardResult => {
  const {
    persistSelection = true,
    storageKey = DEFAULT_STORAGE_KEY,
    filter
  } = options

  const user = useAuthStore((state) => state.user)

  const [brands, setBrands] = useState<ManualBrandSummary[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(() => {
    // Check URL params first (for PDF/Email generation support)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const brandIdParam = params.get('brandId')
      if (brandIdParam) {
        return brandIdParam
      }
    }

    if (!persistSelection) {
      return null
    }
    try {
      return localStorage.getItem(storageKey)
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState<number>(0)

  // Track impersonation customer ID to trigger re-fetch when it changes
  const [impersonationCustomerId, setImpersonationCustomerId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('admin-impersonation:customer-id')
    } catch {
      return null
    }
  })

  // Listen for storage changes and custom events to detect impersonation updates
  useEffect(() => {
    const handleStorageChange = () => {
      const currentImpersonation = localStorage.getItem('admin-impersonation:customer-id')
      const currentBrand = localStorage.getItem('manual-dashboard:selected-brand')

      if (currentImpersonation !== impersonationCustomerId) {
        setImpersonationCustomerId(currentImpersonation)
      }

      // Also update selected brand from localStorage
      if (currentBrand && currentBrand !== selectedBrandId) {
        setSelectedBrandId(currentBrand)
      }
    }

    // Listen for custom event from AdminLayout for immediate sync
    const handleAdminChange = () => {
      const currentImpersonation = localStorage.getItem('admin-impersonation:customer-id')
      const currentBrand = localStorage.getItem('manual-dashboard:selected-brand')

      // Force update both impersonation and brand selection
      setImpersonationCustomerId(currentImpersonation)
      if (currentBrand) {
        setSelectedBrandId(currentBrand)
      }
      // Trigger a reload to refetch brands for the new context
      setReloadToken((prev) => prev + 1)
    }

    // Check periodically for localStorage changes (since storage event doesn't fire for same-tab changes)
    const interval = setInterval(handleStorageChange, 500)
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('admin-impersonation-change', handleAdminChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('admin-impersonation-change', handleAdminChange)
    }
  }, [impersonationCustomerId, selectedBrandId])

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1)
  }, [])

  const selectBrand = useCallback(
    (brandId: string) => {
      setSelectedBrandId(brandId)
      if (persistSelection) {
        try {
          localStorage.setItem(storageKey, brandId)
        } catch {
          // ignore storage issues (e.g. private browsing)
        }
      }
    },
    [persistSelection, storageKey]
  )

  useEffect(() => {
    let cancelled = false

    const fetchBrands = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const isAdmin = user?.role === 'AL_ADMIN' || user?.accessLevel === 'admin'

        // Determine endpoint based on impersonation
        let endpoint = '/brands'
        if (isAdmin && impersonationCustomerId) {
          endpoint = `/admin/customers/${impersonationCustomerId}/brands`
        }

        // Force refresh if this is a reload (token > 0), otherwise use cache strategy
        if (reloadToken > 0) {
          endpoint += (endpoint.includes('?') ? '&' : '?') + 'skipCache=true'
        }

        const response = await cachedRequest<ApiResponse<ManualBrandSummary[]>>(endpoint, {}, { requiresAuth: true })

        if (!response.success || !response.data) {
          throw new Error(response.error || response.message || 'Failed to load brands')
        }

        let fetchedBrands = response.data.filter(b => b.status !== 'inactive')
        if (filter) {
          fetchedBrands = filter(fetchedBrands)
        }

        if (cancelled) {
          return
        }

        setBrands(fetchedBrands)

        setSelectedBrandId((previousSelected) => {
          if (fetchedBrands.length === 0) {
            if (persistSelection) {
              try {
                localStorage.removeItem(storageKey)
              } catch {
                // ignore storage issues
              }
            }
            return null
          }

          const stillValid =
            previousSelected && fetchedBrands.some((brand) => brand.id === previousSelected)

          if (stillValid) {
            if (persistSelection) {
              try {
                localStorage.setItem(storageKey, previousSelected)
              } catch {
                // ignore storage issues
              }
            }
            return previousSelected
          }

          const fallbackBrandId = fetchedBrands[0]?.id ?? null

          if (persistSelection) {
            try {
              if (fallbackBrandId) {
                localStorage.setItem(storageKey, fallbackBrandId)
              } else {
                localStorage.removeItem(storageKey)
              }
            } catch {
              // ignore storage issues
            }
          }

          return fallbackBrandId
        })
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load brands'
          setError(message)
          setBrands([])
          setSelectedBrandId(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchBrands()

    return () => {
      cancelled = true
    }
  }, [filter, persistSelection, reloadToken, storageKey, user, impersonationCustomerId])

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId) ?? null,
    [brands, selectedBrandId]
  )

  return {
    brands,
    isLoading,
    error,
    selectedBrandId,
    selectedBrand,
    selectBrand,
    reload
  }
}


