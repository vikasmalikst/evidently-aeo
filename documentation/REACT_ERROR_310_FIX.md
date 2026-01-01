# React Error #310 Fix Explanation

## Why This Error Occurs

React Error #310 means: **"Rendered more hooks than during the previous render"**

This happens when:
1. **Conditional Hook Calls**: A hook is called inside an `if` statement, loop, or after an early return
2. **Changing Hook Count**: The number of hooks called changes between renders
3. **Production vs Development**: Production builds are minified and optimized, which can expose timing issues that don't appear in development

## Root Cause in This Codebase

The issue was in `src/pages/Dashboard.tsx`:
- A `useEffect` hook for data collection progress was placed **after** conditional returns
- When the component first rendered (loading state), it would return early
- On subsequent renders (after loading), the hook would suddenly appear
- React saw this as "more hooks than before" → Error #310

## The Fix

**All hooks must be declared BEFORE any conditional returns.**

The fix ensures:
1. All `useState`, `useEffect`, `useMemo`, `useCallback`, etc. are at the top
2. Conditional logic goes INSIDE hooks, not around them
3. Early returns happen AFTER all hooks are declared

## How to Prevent This

1. **Always declare hooks at the top level** - before any `if` statements or early returns
2. **Use conditional logic inside hooks** - not around hook calls
3. **Test in production mode** - use `npm run build && npm run preview` to catch these issues
4. **Enable React DevTools** - helps identify hook order issues

## Example of Wrong Pattern

```tsx
// ❌ WRONG - Hook after conditional return
function Component() {
  if (loading) {
    return <Loading />; // Early return
  }
  
  useEffect(() => { // This hook might not run on first render!
    // ...
  }, []);
}
```

## Example of Correct Pattern

```tsx
// ✅ CORRECT - All hooks before any returns
function Component() {
  useEffect(() => { // Always called
    if (loading) {
      // Handle loading inside hook
      return;
    }
    // ...
  }, [loading]);
  
  if (loading) {
    return <Loading />; // Early return AFTER hooks
  }
}
```

