# AbortSignal and AbortController Explained

## What is AbortSignal?

`AbortSignal` is a Web API that allows you to cancel asynchronous operations (like `fetch()` requests). It provides a way to signal that an operation should be aborted.

`AbortController` is the object that creates and controls an `AbortSignal`.

## Why Use AbortSignal?

### 1. **Prevent Hanging Requests (Timeouts)**
   - Network requests can hang indefinitely if the server doesn't respond
   - Timeouts ensure requests don't wait forever
   - **Example**: Setting a 30-second timeout on API calls

### 2. **Cancel Requests on Component Unmount (React Cleanup)**
   - When a React component unmounts, pending requests can still try to update state
   - This causes memory leaks and React warnings
   - AbortSignal cancels requests during cleanup

### 3. **Cancel Outdated Requests**
   - When user triggers a new request, cancel the old one
   - Prevents race conditions where old responses overwrite new ones
   - **Example**: User types quickly in a search box - only the latest request matters

### 4. **User-Initiated Cancellation**
   - Allow users to cancel long-running operations
   - **Example**: "Cancel" button during data export

---

## When to Use AbortSignal

### ✅ Use AbortSignal When:

1. **Making any fetch() request** - Always add a timeout at minimum
2. **React components fetching data** - Cancel on unmount
3. **User interactions that trigger requests** - Cancel previous requests
4. **Long-running operations** - Allow cancellation
5. **Batch operations** - Cancel if user navigates away

### ❌ Don't Need AbortSignal For:

1. **Synchronous operations** - No async work to cancel
2. **Very fast operations** (< 100ms) - Usually not worth the overhead
3. **Operations that must complete** - Like saving critical data

---

## Examples from Your Codebase

### Example 1: Automatic Timeout (Simple)
**Location**: `backend/src/services/citations/citation-categorization.service.ts:371`

```typescript
const response = await fetch('https://api.cerebras.ai/v1/completions', {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify({ /* ... */ }),
  // Automatic timeout after 30 seconds
  signal: AbortSignal.timeout(30000) // 30 second timeout
});
```

**Why**: The Cerebras API call might hang. After 30 seconds, it automatically cancels.

**Note**: `AbortSignal.timeout()` is a newer API (Node.js 17.3+, modern browsers). It's the simplest way to add a timeout.

---

### Example 2: Manual Timeout with AbortController
**Location**: `backend/src/services/data-collection/oxylabs-collector.service.ts:117`

```typescript
// Create an AbortController for timeout
const timeoutDuration = request.source === 'chatgpt' ? 90000 : 60000; // 90s or 60s
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

try {
  const response = await fetch(this.baseUrl, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify(oxylabsBody),
    signal: controller.signal, // Use the signal
  });
  
  clearTimeout(timeoutId); // Clear timeout if request succeeds
  
  // ... handle response
} catch (error) {
  // Handle errors (including AbortError)
}
```

**Why**: 
- Different timeout durations based on request type (ChatGPT needs 90s, others 60s)
- Need to manually clear the timeout if the request succeeds early

**Key Points**:
- Create `AbortController` before the fetch
- Set timeout to call `controller.abort()`
- Clear timeout if request completes before timeout

---

### Example 3: React Component Cleanup (Most Complex)
**Location**: `src/hooks/useCachedData.ts:114-280`

```typescript
const abortControllerRef = useRef<AbortController | null>(null);

const fetchData = useCallback(async (showLoading = true) => {
  // Cancel previous request if it exists
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  
  // Create new controller for this request
  abortControllerRef.current = new AbortController();
  const signal = abortControllerRef.current.signal;
  const currentController = abortControllerRef.current;
  
  try {
    const result = await cachedRequest<T>(
      endpoint,
      {
        ...options,
        signal, // Pass signal to cancel this request
      },
      config
    );
    
    // Check if request was cancelled before updating state
    if (currentController === abortControllerRef.current && !signal.aborted) {
      setData(result);
      setLoading(false);
    }
  } catch (err) {
    // Ignore AbortError - it's expected when requests are cancelled
    if (err instanceof Error && err.name === 'AbortError') {
      return; // Silent - expected cleanup behavior
    }
    // Handle real errors...
  }
}, [endpoint, enabled, /* ... */]);

// Cleanup on unmount or dependency change
useEffect(() => {
  // ... fetch data ...
  
  return () => {
    // Cancel request when component unmounts or dependencies change
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, [endpoint, enabled, /* ... */]);
```

**Why**: 
- **Cancel on unmount**: Prevents "Can't update state on unmounted component" warnings
- **Cancel previous requests**: If endpoint changes quickly, cancel old requests
- **Prevent race conditions**: Only update state if this is still the current request

**Key Points**:
- Store controller in `useRef` so it persists across renders
- Cancel previous controller before creating a new one
- Check if request was aborted before updating state
- Cleanup in `useEffect` return function

---

### Example 4: URL Reachability Check
**Location**: `backend/src/services/brand.service.ts:3045`

```typescript
private async checkUrlReachability(url: string, timeoutMs: number = 5000): Promise<boolean> {
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(urlWithProtocol, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    // Network errors, timeouts, etc. mean not reachable
    return false;
  }
}
```

**Why**: 
- Quick 5-second timeout for URL checks
- Don't wait forever for unreachable URLs
- Uses HEAD request (faster than GET)

---

## Common Patterns

### Pattern 1: Simple Timeout (Recommended)
```typescript
const response = await fetch(url, {
  signal: AbortSignal.timeout(30000) // 30 second timeout
});
```

**When to use**: Modern environments (Node.js 17.3+, modern browsers), simple timeout needs.

---

### Pattern 2: Custom Timeout with Cleanup
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(url, {
    signal: controller.signal
  });
  clearTimeout(timeoutId); // Clear if succeeds
  // ... handle response
} catch (error) {
  clearTimeout(timeoutId); // Always clear
  if (error.name === 'AbortError') {
    // Handle timeout
  }
  // Handle other errors
}
```

**When to use**: Need conditional timeouts, or supporting older environments.

---

### Pattern 3: Manual Cancellation
```typescript
const controller = new AbortController();

// User clicks cancel button
cancelButton.onclick = () => {
  controller.abort();
};

try {
  const response = await fetch(url, {
    signal: controller.signal
  });
  // ... handle response
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request cancelled by user');
  }
}
```

**When to use**: User-initiated cancellation (e.g., cancel button).

---

### Pattern 4: Cancel Previous Request (Debouncing)
```typescript
let currentController: AbortController | null = null;

async function search(query: string) {
  // Cancel previous search
  if (currentController) {
    currentController.abort();
  }
  
  // Start new search
  currentController = new AbortController();
  
  try {
    const response = await fetch(`/api/search?q=${query}`, {
      signal: currentController.signal
    });
    // ... handle results
  } catch (error) {
    if (error.name !== 'AbortError') {
      // Only handle non-abort errors
    }
  }
}
```

**When to use**: User typing in search box, pagination, filters.

---

## Error Handling

### Always Handle AbortError

```typescript
try {
  const response = await fetch(url, { signal });
  // ... handle response
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    // Request was cancelled - this is usually expected
    // Don't treat as an error, just return/ignore
    console.log('Request cancelled');
    return;
  }
  // Handle real errors
  console.error('Request failed:', error);
}
```

**Important**: 
- `AbortError` is not a real error - it's expected behavior
- Don't show error messages to users for aborted requests
- Only handle real errors (network failures, 500 errors, etc.)

---

## Best Practices

1. **Always add timeouts** - Never let requests hang indefinitely
2. **Cancel on unmount** - Clean up in React useEffect cleanup
3. **Cancel previous requests** - Prevent race conditions
4. **Handle AbortError gracefully** - Don't treat as real errors
5. **Clear timeouts** - Always clear `setTimeout` if request completes early
6. **Check if aborted** - Before updating state, check `signal.aborted`

---

## Summary

- **AbortSignal** = A way to cancel async operations
- **AbortController** = Creates and controls the signal
- **Use cases**: Timeouts, cleanup, cancellation, preventing race conditions
- **Always handle**: AbortError is expected, not a real error
- **Pattern**: Create controller → Pass signal to fetch → Cancel when needed → Handle AbortError

Your codebase uses AbortSignal well! The patterns in your code are solid examples of when and how to use it.

