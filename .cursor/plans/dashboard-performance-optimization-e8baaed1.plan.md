<!-- e8baaed1-30a5-4211-b2e9-73ecc1737e6a 44bc9bb9-bfba-44a1-9447-db27ed01ea6a -->
# Dashboard Performance Optimization Plan

## Problem Analysis

Current issues causing delays:

1. **No caching layer** - Every page navigation triggers fresh API calls
2. **No request deduplication** - Multiple components can request the same data simultaneously
3. **No stale-while-revalidate** - Users see loading spinners even for recently fetched data
4. **No prefetching** - Data isn't loaded until page is visited
5. **Sequential loading** - Components wait for each other instead of loading in parallel
6. **No cross-session persistence** - Data is lost on page refresh

## Solution Architecture

### 1. Create Centralized Cache Manager (`src/lib/cacheManager.ts`)

- In-memory cache with TTL (Time To Live) per cache key
- localStorage persistence for cross-session caching
- Stale-while-revalidate pattern (show cached data immediately, fetch fresh in background)
- Request deduplication (multiple calls for same key share one request)
- Smart cache invalidation based on data freshness requirements

### 2. Create React Hook for Cached Data Fetching (`src/hooks/useCachedData.ts`)

- Custom hook that wraps `useEffect` with caching logic
- Returns `{ data, loading, error, refetch }`
- Automatically uses cache when available
- Fetches fresh data in background if cache is stale
- Handles loading states intelligently (no loading if cache exists)

### 3. Create API Cache Wrapper (`src/lib/apiCache.ts`)

- Wraps `apiClient.request()` with caching
- Generates cache keys from endpoint + params
- Implements cache strategies per endpoint type:
- Dashboard data: 2 minutes TTL, 5 minutes stale
- Visibility data: 1 minute TTL, 3 minutes stale
- Sources data: 2 minutes TTL, 5 minutes stale
- Topics data: 5 minutes TTL, 10 minutes stale
- Prompts data: 1 minute TTL, 3 minutes stale

### 4. Implement Prefetching System (`src/lib/prefetch.ts`)

- Prefetch data on navigation link hover
- Prefetch related data when current page loads
- Use `requestIdleCallback` for non-critical prefetches

### 5. Update All Dashboard Pages

#### `/dashboard` (src/pages/Dashboard.tsx)

- Replace direct `apiClient.request()` with cached version
- Use `useCachedData` hook for dashboard payload
- Show cached data immediately while fetching fresh

#### `/search-visibility` (src/pages/SearchVisibility.tsx)

- Cache visibility data with 1-minute TTL
- Prefetch when timeframe/region changes
- Use cached data for initial render

#### `/search-sources` (src/pages/SearchSources.tsx)

- Cache sources data with 2-minute TTL
- Cache heatmap data separately
- Parallel fetch for sources and metadata

#### `/topics` (src/pages/Topics.tsx)

- Cache topics data with 5-minute TTL (less frequently changing)
- Use cached data immediately on mount

#### `/prompts` (src/pages/Prompts.tsx)

- Cache prompts data with 1-minute TTL
- Cache per LLM/dateRange combination
- Prefetch next likely date range

### 6. Optimize Component Rendering

- Use `React.memo` for expensive components
- Implement virtual scrolling for long lists
- Defer non-critical chart rendering
- Use `useMemo` for expensive computations

### 7. Add Loading State Improvements

- Skeleton loaders instead of spinners
- Progressive data loading (show what's available)
- Optimistic UI updates where possible

## Implementation Files

1. `src/lib/cacheManager.ts` - Core caching logic
2. `src/lib/apiCache.ts` - API request caching wrapper
3. `src/hooks/useCachedData.ts` - React hook for cached data
4. `src/lib/prefetch.ts` - Prefetching utilities
5. Update `src/pages/Dashboard.tsx`
6. Update `src/pages/SearchVisibility.tsx`
7. Update `src/pages/SearchSources.tsx`
8. Update `src/pages/Topics.tsx`
9. Update `src/pages/Prompts.tsx`

## Cache Strategy Details

| Endpoint Type | TTL | Stale Time | Max Age |
|--------------|-----|------------|---------|
| Dashboard | 2 min | 5 min | 10 min |
| Visibility | 1 min | 3 min | 5 min |
| Sources | 2 min | 5 min | 10 min |
| Topics | 5 min | 10 min | 30 min |
| Prompts | 1 min | 3 min | 5 min |

## Expected Performance Improvements

- **Initial page load**: 80-90% faster (from cache)
- **Navigation between pages**: 90-95% faster (prefetched + cached)
- **Filter/parameter changes**: 70-80% faster (stale-while-revalidate)
- **Page refresh**: 60-70% faster (localStorage cache)
- **Perceived performance**: Near-instant (cached data shown immediately)

## Testing Strategy

1. Test cache hit/miss scenarios
2. Test stale-while-revalidate behavior
3. Test request deduplication
4. Test localStorage persistence
5. Test cache invalidation
6. Test prefetching on navigation
7. Verify no data staleness issues

### To-dos

- [ ] Create src/lib/cacheManager.ts with in-memory cache, localStorage persistence, TTL management, and stale-while-revalidate logic
- [ ] Create src/lib/apiCache.ts wrapper around apiClient with cache key generation and per-endpoint cache strategies
- [ ] Create src/hooks/useCachedData.ts React hook that integrates with cache manager and provides {data, loading, error, refetch} interface
- [ ] Create src/lib/prefetch.ts utilities for prefetching data on link hover and idle time
- [ ] Update src/pages/Dashboard.tsx to use useCachedData hook instead of direct API calls
- [ ] Update src/pages/SearchVisibility.tsx to use cached data fetching with 1-minute TTL
- [ ] Update src/pages/SearchSources.tsx to use cached data fetching with 2-minute TTL and parallel loading
- [ ] Update src/pages/Topics.tsx to use cached data fetching with 5-minute TTL
- [ ] Update src/pages/Prompts.tsx to use cached data fetching with 1-minute TTL and per-filter caching
- [ ] Add prefetching to navigation links in Sidebar component for instant page loads
- [ ] Add React.memo to expensive components and optimize useMemo usage in all dashboard pages