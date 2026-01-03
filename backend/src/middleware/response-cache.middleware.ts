import type { Request, Response, NextFunction } from 'express'

type CacheEntry = {
  expiresAt: number
  statusCode: number
  body: any
  headers?: Record<string, string>
}

const DEFAULT_MAX_ENTRIES = 500

class InMemoryResponseCache {
  private store = new Map<string, CacheEntry>()

  constructor(private maxEntries: number) {}

  get(key: string): CacheEntry | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry
  }

  set(key: string, entry: CacheEntry) {
    // Simple size cap: evict oldest inserted key (Map keeps insertion order)
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey) {
        this.store.delete(oldestKey)
      }
    }
    this.store.set(key, entry)
  }
}

const responseCache = new InMemoryResponseCache(DEFAULT_MAX_ENTRIES)

const buildCacheKey = (req: Request): string => {
  const customerId = req.user?.customer_id ?? 'anonymous'
  // originalUrl includes path + query string (stable cache key when query params are stable)
  return `${req.method}:${req.originalUrl}:customer:${customerId}`
}

export function responseCacheMiddleware(options: { ttlMs: number }): (req: Request, res: Response, next: NextFunction) => void {
  const ttlMs = Math.max(options.ttlMs, 0)

  return (req, res, next) => {
    // Only cache GETs
    if (req.method !== 'GET' || ttlMs === 0) {
      next()
      return
    }

    const key = buildCacheKey(req)
    const cached = responseCache.get(key)
    if (cached) {
      if (cached.headers) {
        Object.entries(cached.headers).forEach(([header, value]) => res.setHeader(header, value))
      }
      res.status(cached.statusCode).json(cached.body)
      return
    }

    const originalJson = res.json.bind(res)
    res.json = (body: any) => {
      // Cache successful responses only
      if (res.statusCode >= 200 && res.statusCode < 300) {
        responseCache.set(key, {
          expiresAt: Date.now() + ttlMs,
          statusCode: res.statusCode,
          body,
          headers: {
            'x-response-cache': 'miss-store',
          },
        })
      }
      return originalJson(body)
    }

    next()
  }
}


