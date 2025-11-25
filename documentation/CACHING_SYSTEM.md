# Caching System Documentation

## Overview

Our application uses a **client-side, two-tier caching system** that combines in-memory caching with localStorage persistence. This provides fast data access, reduces API calls, and improves user experience through instant data display.

**Key Characteristics:**
- ✅ Client-side only (browser-based, no Redis/server cache)
- ✅ Two-tier: In-memory (fast) + localStorage (persistent)
- ✅ Stale-while-revalidate pattern
- ✅ Request deduplication
- ✅ Automatic cache invalidation with TTL

---

## Architecture

### Two-Tier Cache System

```
┌─────────────────────────────────────┐
│   Component (React Hook)            │
│   useCachedData()                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   API Cache Layer                   │
│   cachedRequest()                   │
│   - Cache key generation            │
│   - Strategy selection              │
│   - Stale-while-revalidate logic    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Cache Manager                     │
│   cacheManager                      │
│   ┌─────────────┐  ┌──────────────┐│
│   │ In-Memory   │  │ localStorage ││
│   │ (Map)       │  │ (5MB limit)  ││
│   └─────────────┘  └──────────────┘│
└─────────────────────────────────────┘
```

### Cache Entry Structure

Each cached entry contains:
- **data**: The actual cached response
- **timestamp**: When the data was cached
- **ttl**: Time to live (fresh period)
- **staleTime**: When data becomes stale (but still usable)
- **maxAge**: Maximum age before complete expiration

---

## Cache Lifecycle

### Three States

1. **Fresh** (0 → TTL)
   - Data is considered current
   - Returned immediately, no background fetch

2. **Stale** (TTL → staleTime)
   - Data is outdated but usable
   - Returned immediately
   - Fresh data fetched in background
   - Cache updated when fresh data arrives

3. **Expired** (staleTime → maxAge)
   - Data is too old to use
   - Fresh fetch required
   - Old data removed from cache

### Example Flow

```
User requests /dashboard
    ↓
Check cache
    ↓
┌─────────────────────────┐
│ Is data fresh?          │ → Yes → Return immediately ✅
└─────────────────────────┘
    ↓ No
┌─────────────────────────┐
│ Is data stale?          │ → Yes → Return stale + fetch fresh in background 🔄
└─────────────────────────┘
    ↓ No
┌─────────────────────────┐
│ Is data expired?        │ → Yes → Fetch fresh data ⏳
└─────────────────────────┘
```

---

## Cache Strategies

Different endpoints have different caching strategies based on data volatility:

| Endpoint Pattern | Fresh (TTL) | Stale Time | Max Age | Persist |
|-----------------|-------------|------------|---------|---------|
| `/dashboard`    | 2 min       | 5 min      | 10 min  | ✅ Yes  |
| `/topics`       | 5 min       | 10 min     | 30 min  | ✅ Yes  |
| `/sources`      | 2 min       | 5 min      | 10 min  | ✅ Yes  |
| `/visibility`   | 1 min       | 3 min      | 5 min   | ✅ Yes  |
| `/prompts`      | 1 min       | 3 min      | 5 min   | ✅ Yes  |
| Default         | 2 min       | 5 min      | 10 min  | ❌ No   |

**Rationale:**
- **Topics**: Change infrequently → longer cache times
- **Prompts/Visibility**: More dynamic → shorter cache times
- **Dashboard**: Moderate volatility → balanced cache times

---

## Key Features

### 1. Request Deduplication

Prevents multiple simultaneous requests for the same endpoint:

```typescript
// Multiple components request same data
Component A → cachedRequest('/dashboard') ─┐
Component B → cachedRequest('/dashboard') ─┼─→ Single API call
Component C → cachedRequest('/dashboard') ─┘
```

### 2. Stale-While-Revalidate

Users see data immediately while fresh data loads in background:

```
User Action: Navigate to dashboard
    ↓
Return stale cache (instant) ⚡
    ↓
Fetch fresh data (background) 🔄
    ↓
Update cache silently
```

### 3. localStorage Persistence

- Survives page reloads
- 5MB storage limit
- Automatic eviction of oldest entries when limit reached
- Only for endpoints with `persist: true`

### 4. Cache Key Generation

Cache keys are normalized for consistency:

```typescript
// These generate the same cache key:
'/dashboard?startDate=2024-01-01&endDate=2024-01-31'
'/dashboard?endDate=2024-01-31&startDate=2024-01-01'
```

---

## Usage

### React Hook (Recommended)

```typescript
import { useCachedData } from '../hooks/useCachedData';

const { data, loading, error, refetch, isStale } = useCachedData<DashboardPayload>(
  `/brands/${brandId}/dashboard?startDate=${start}&endDate=${end}`,
  {},
  { requiresAuth: true },
  { 
    enabled: !!brandId,
    refetchOnMount: false,
    refetchInterval: 30000 // Optional: auto-refetch every 30s
  }
);
```

### Direct API Cache

```typescript
import { cachedRequest } from '../lib/apiCache';

const data = await cachedRequest<DashboardPayload>(
  '/brands/123/dashboard',
  {},
  { requiresAuth: true }
);
```

### Prefetching

```typescript
import { usePrefetchOnHover } from '../hooks/useCachedData';

const { onMouseEnter } = usePrefetchOnHover('/dashboard');
// Use onMouseEnter to prefetch on hover
```

---

## Cache Management

### Invalidate Specific Cache

```typescript
import { invalidateCache } from '../lib/apiCache';

// Invalidate all dashboard caches
invalidateCache('/dashboard');

// Invalidate with regex
invalidateCache(/^\/brands\/.*\/dashboard/);
```

### Clear All Cache

```typescript
import { clearApiCache } from '../lib/apiCache';

clearApiCache(); // Clears both memory and localStorage
```

### Manual Cache Manager Access

```typescript
import { cacheManager } from '../lib/cacheManager';

// Check cache status
const isFresh = cacheManager.isFresh(cacheKey);
const isStale = cacheManager.isStale(cacheKey);
const isExpired = cacheManager.isExpired(cacheKey);

// Get cached data
const data = cacheManager.get<MyType>(cacheKey);

// Invalidate specific key
cacheManager.invalidate(cacheKey);
```

---

## Performance Benefits

1. **Instant Data Display**: Cached data shows immediately (0ms)
2. **Reduced API Calls**: Fewer requests to backend
3. **Offline Resilience**: Stale data available even if API fails
4. **Bandwidth Savings**: Less data transfer
5. **Better UX**: No loading spinners for cached data

---

## Implementation Files

- **`src/lib/cacheManager.ts`**: Core cache logic (memory + localStorage)
- **`src/lib/apiCache.ts`**: API request wrapper with caching
- **`src/hooks/useCachedData.ts`**: React hook for cached data fetching

---

## Best Practices

1. ✅ Use `useCachedData` hook in components
2. ✅ Set appropriate `enabled` flag to prevent unnecessary fetches
3. ✅ Use `refetchInterval` for real-time data needs
4. ✅ Invalidate cache after mutations (create/update/delete)
5. ✅ Prefetch data on hover for better perceived performance
6. ❌ Don't cache sensitive/real-time data
7. ❌ Don't manually manipulate cache unless necessary

---

## Troubleshooting

### Cache Not Updating

- Check if data is still "fresh" (within TTL)
- Manually invalidate: `invalidateCache('/endpoint')`
- Check browser localStorage for cached entries

### localStorage Quota Exceeded

- System automatically evicts oldest entries
- Check cache size: `localStorage.getItem('evidently_cache_*')`
- Clear old cache: `clearApiCache()`

### Stale Data Showing

- This is expected behavior (stale-while-revalidate)
- Fresh data loads in background
- Use `isStale` flag to show indicator if needed

---

## Future Enhancements

Potential improvements:
- [ ] Cache size monitoring and reporting
- [ ] Cache hit/miss metrics
- [ ] Custom cache strategies per component
- [ ] Service Worker integration for offline support
- [ ] Cache compression for larger payloads


