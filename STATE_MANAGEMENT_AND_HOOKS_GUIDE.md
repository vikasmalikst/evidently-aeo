# State Management & React Hooks Guide

## State Management Approach

### Primary: **Zustand**
Your project uses **Zustand** as the main state management library.

**Evidence:**
- Package dependency: `"zustand": "^5.0.8"` in `package.json`
- Main store: `src/store/authStore.ts` uses `create` from Zustand

**Example from `src/store/authStore.ts`:**
```typescript
import { create } from 'zustand';

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  isAuthenticated: !!storedUser,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  // ... other actions
}));
```

**Usage in components:**
```typescript
const setUser = useAuthStore((state) => state.setUser);
const { isAuthenticated, isLoading } = useAuthStore();
```

### Secondary: **Custom Hooks Pattern**
You're using custom hooks for domain-specific state management:

**Example: `useManualBrandDashboard`**
- Located in: `src/manual-dashboard/useManualBrandDashboard.ts`
- Manages brand selection, loading states, and brand data
- Uses local state (`useState`) with localStorage persistence
- Used across multiple pages: `Prompts.tsx`, `SearchSources.tsx`, `SearchVisibility.tsx`

**Usage:**
```typescript
const {
  brands,
  selectedBrandId,
  selectedBrand,
  isLoading: brandsLoading,
  selectBrand
} = useManualBrandDashboard();
```

### Other Patterns:
1. **Local State (`useState`)**: Used extensively for component-level state
2. **Prop Drilling**: Some props are passed down through component trees (e.g., chart controls, filters)
3. **NO Context API**: No `createContext` or `useContext` usage found
4. **NO Redux**: No Redux implementation found

### When to Use Each Approach:

| Approach | When to Use | Example |
|----------|-------------|---------|
| **Zustand** | Global app state shared across many components | Authentication state (`authStore`) |
| **Custom Hooks** | Domain-specific state with complex logic | Brand dashboard state (`useManualBrandDashboard`) |
| **useState** | Component-local state | Form inputs, UI toggles, filters |
| **Prop Drilling** | Simple data passing 1-2 levels deep | Chart props, filter controls |

---

## useMemo vs useEffect: When to Use Each

### Statistics
- **useMemo**: 163 instances across 38 files
- **useEffect**: 117 instances across 40 files

---

## useMemo: Purpose & Usage

### What is useMemo?
`useMemo` **memoizes (caches) a computed value** to avoid expensive recalculations on every render.

### When to Use useMemo:

#### ✅ **DO Use useMemo For:**

1. **Expensive Calculations**
   ```typescript
   // Example from Keywords.tsx (line 375)
   const filteredData = useMemo(() => {
     return keywordData.filter((kw) => {
       if (categoryFilter !== 'all' && !kw.categories.includes(categoryFilter as any)) return false;
       if (llmFilter !== 'all' && !kw.llmProviders.includes(llmFilter)) return false;
       return true;
     });
   }, [keywordData, categoryFilter, llmFilter, quadrantFilter]);
   ```

2. **Complex Data Transformations**
   ```typescript
   // Example from VisibilityChart.tsx (line 84)
   const chartData = useMemo(() => {
     if (!data || selectedModels.length === 0) return null;
     
     const datasets = selectedModels
       .map((modelId, index) => {
         // Complex transformation logic
         return { /* chart configuration */ };
       })
       .filter(item => item !== null);
     
     return { labels: data.labels, datasets };
   }, [data, selectedModels, models, chartType]);
   ```

3. **Derived/Computed Values**
   ```typescript
   // Example from SearchVisibility.tsx (line 162)
   const dateRange = useMemo(() => getDateRangeForTimeframe(timeframe), [timeframe]);
   
   // Example from useManualBrandDashboard.ts (line 168)
   const selectedBrand = useMemo(
     () => brands.find((brand) => brand.id === selectedBrandId) ?? null,
     [brands, selectedBrandId]
   );
   ```

4. **Object/Array References for Props**
   - Prevents unnecessary re-renders of child components
   - When passing objects/arrays to memoized components

#### ❌ **DON'T Use useMemo For:**

1. **Simple calculations** (arithmetic, string concatenation)
   ```typescript
   // ❌ BAD - unnecessary
   const total = useMemo(() => a + b, [a, b]);
   
   // ✅ GOOD - just calculate directly
   const total = a + b;
   ```

2. **Values that change on every render** (new objects/arrays)
   - If dependencies change every render, memoization is useless

3. **Side effects** (use `useEffect` instead)
   - API calls, subscriptions, DOM manipulation

---

## useEffect: Purpose & Usage

### What is useEffect?
`useEffect` **performs side effects** after render, such as:
- Fetching data from APIs
- Setting up subscriptions
- Manually changing the DOM
- Cleaning up resources

### When to Use useEffect:

#### ✅ **DO Use useEffect For:**

1. **Data Fetching**
   ```typescript
   // Example from Keywords.tsx (line 324)
   useEffect(() => {
     const fetchKeywords = async () => {
       setIsLoading(true);
       try {
         const response = await fetch(`/brands/${selectedBrandId}/keywords`);
         const data = await response.json();
         setKeywordData(data);
       } catch (e) {
         console.error('Failed to load keyword analytics', e);
       } finally {
         setIsLoading(false);
       }
     };
     fetchKeywords();
   }, [selectedBrandId]);
   ```

2. **Subscriptions & Cleanup**
   ```typescript
   // Example from SourcesRacingChart.tsx (line 20)
   useEffect(() => {
     if (!isPlaying) return;
     
     const interval = setInterval(() => {
       setCurrentTimeIndex((prev) => prev + 1);
     }, 1000);
     
     return () => clearInterval(interval); // Cleanup
   }, [isPlaying, racingChartData.timePoints.length]);
   ```

3. **Syncing with External Systems**
   ```typescript
   // Example from ProtectedRoute.tsx (line 14)
   useEffect(() => {
     const checkAuth = async () => {
       const user = await authService.getCurrentUser();
       setUser(user);
     };
     if (isLoading) {
       checkAuth();
     }
   }, [isLoading]);
   ```

4. **DOM Manipulation** (rare, prefer React patterns)
   - Direct DOM access when needed
   - Third-party library integration

#### ❌ **DON'T Use useEffect For:**

1. **Derived state** (use `useMemo` or compute directly)
   ```typescript
   // ❌ BAD
   useEffect(() => {
     setFullName(`${firstName} ${lastName}`);
   }, [firstName, lastName]);
   
   // ✅ GOOD
   const fullName = `${firstName} ${lastName}`;
   // OR if expensive:
   const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);
   ```

2. **Event handlers** (define inline or use `useCallback`)
   ```typescript
   // ❌ BAD
   useEffect(() => {
     button.addEventListener('click', handler);
     return () => button.removeEventListener('click', handler);
   }, []);
   
   // ✅ GOOD
   <button onClick={handler}>Click</button>
   ```

3. **Value calculations** (use `useMemo`)
   - Filtering, sorting, mapping data

---

## Quick Decision Guide

### "Should I use useMemo or useEffect?"

```
┌─────────────────────────────────────────────────┐
│ What do you need to do?                         │
└─────────────────────────────────────────────────┘
           │
           ├─ Compute/derive a VALUE?
           │  └─> Use useMemo
           │
           ├─ Perform a SIDE EFFECT?
           │  └─> Use useEffect
           │
           ├─ Fetch data?
           │  └─> Use useEffect
           │
           ├─ Filter/sort/transform data?
           │  └─> Use useMemo (if expensive)
           │      OR compute directly (if simple)
           │
           └─ Subscribe to something?
              └─> Use useEffect (with cleanup)
```

---

## Real Examples from Your Codebase

### Example 1: Filtering Data (useMemo)
**File:** `src/pages/Keywords.tsx`
```typescript
// ✅ Correct: Expensive filtering operation
const filteredData = useMemo(() => {
  return keywordData.filter((kw) => {
    if (categoryFilter !== 'all' && !kw.categories.includes(categoryFilter)) return false;
    if (llmFilter !== 'all' && !kw.llmProviders.includes(llmFilter)) return false;
    return true;
  });
}, [keywordData, categoryFilter, llmFilter, quadrantFilter]);
```
**Why:** Filters large arrays - recalculates only when dependencies change

### Example 2: Chart Data Transformation (useMemo)
**File:** `src/components/Visibility/VisibilityChart.tsx`
```typescript
// ✅ Correct: Complex chart data transformation
const chartData = useMemo(() => {
  if (!data || selectedModels.length === 0) return null;
  
  const datasets = selectedModels
    .map((modelId, index) => {
      // Complex mapping logic
      return { /* chart config */ };
    })
    .filter(item => item !== null);
  
  return { labels: data.labels, datasets };
}, [data, selectedModels, models, chartType]);
```
**Why:** Expensive transformation, prevents re-creation on every render

### Example 3: Data Fetching (useEffect)
**File:** `src/pages/Keywords.tsx`
```typescript
// ✅ Correct: Side effect - fetching data
useEffect(() => {
  const fetchKeywords = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/brands/${selectedBrandId}/keywords`);
      const data = await response.json();
      setKeywordData(data);
    } finally {
      setIsLoading(false);
    }
  };
  fetchKeywords();
}, [selectedBrandId]);
```
**Why:** Side effect (API call) that should run when `selectedBrandId` changes

### Example 4: Interval/Subscription (useEffect)
**File:** `src/components/Citations/SourcesRacingChart.tsx`
```typescript
// ✅ Correct: Side effect with cleanup
useEffect(() => {
  if (!isPlaying) return;
  
  const interval = setInterval(() => {
    setCurrentTimeIndex((prev) => prev + 1);
  }, 1000);
  
  return () => clearInterval(interval); // Cleanup
}, [isPlaying, racingChartData.timePoints.length]);
```
**Why:** Sets up a subscription (interval) and cleans it up properly

---

## Performance Tips

1. **useMemo Optimization:**
   - Only memoize if the calculation is actually expensive
   - React DevTools Profiler can help identify bottlenecks
   - If dependencies change every render, memoization won't help

2. **useEffect Optimization:**
   - Always include all dependencies in the dependency array
   - Use cleanup functions to prevent memory leaks
   - Consider using `useCallback` for functions passed as dependencies

3. **Combining Both:**
   ```typescript
   // ✅ Good pattern: useEffect fetches, useMemo transforms
   useEffect(() => {
     fetchData().then(setRawData);
   }, [id]);
   
   const processedData = useMemo(() => {
     return rawData.map(transform);
   }, [rawData]);
   ```

---

## Summary

| Hook | Purpose | Returns | Runs When |
|------|---------|---------|-----------|
| **useMemo** | Memoize computed values | The memoized value | When dependencies change |
| **useEffect** | Perform side effects | Nothing (void) | After render, when dependencies change |

**Your Project:**
- ✅ **Zustand** for global state (authentication)
- ✅ **Custom hooks** for domain state (brand dashboard)
- ✅ **useMemo** for expensive calculations and data transformations
- ✅ **useEffect** for side effects (API calls, subscriptions)






