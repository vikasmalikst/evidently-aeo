import { useCallback, useEffect, useMemo, useState } from 'react'
import { cachedRequest } from '../lib/apiCache'

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

  const [brands, setBrands] = useState<ManualBrandSummary[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(() => {
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
        const response = await cachedRequest<ApiResponse<ManualBrandSummary[]>>('/brands', {}, { requiresAuth: true })

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
  }, [filter, persistSelection, reloadToken, storageKey])

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


