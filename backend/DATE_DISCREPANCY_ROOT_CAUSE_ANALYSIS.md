# Date Discrepancy Root Cause Analysis

## Problem Statement

**Issue:** Database shows `collector_results.created_at = December 20, 2025`, but UI displays **December 19, 2025**.

**Affected:** All brands (CAVA, SanDisk, etc.)

---

## Root Cause Identified ✅

### The Issue Chain

1. **Database Storage** (✅ Correct):
   - `created_at = '2025-12-20T17:54:14.569873+00:00'` (UTC)
   - Stored correctly as December 20, 2025 in UTC

2. **Backend Processing** (✅ Correct):
   - `extractDate()` function in `payload-builder.ts` (line 392-401):
   ```typescript
   const extractDate = (timestamp: string | null): string | null => {
     if (!timestamp) return null
     try {
       const date = new Date(timestamp)
       if (isNaN(date.getTime())) return null
       return date.toISOString().split('T')[0] // Returns YYYY-MM-DD
     } catch {
       return null
     }
   }
   ```
   - Correctly extracts: `'2025-12-20'` ✅

3. **UI Formatting** (❌ **BUG HERE**):
   - `formatDateLabel()` function in `SearchVisibility.tsx` (line 146-155):
   ```typescript
   const formatDateLabel = (dateStr: string): string => {
     try {
       const date = new Date(dateStr + 'T00:00:00Z')
       const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
       const dayNum = date.getDate()  // ❌ BUG: Uses LOCAL day
       return `${dayName} ${dayNum}`
     } catch {
       return dateStr
     }
   }
   ```

### The Bug Explained

**What happens:**
1. Backend sends: `'2025-12-20'` (date string, no timezone)
2. UI creates: `new Date('2025-12-20T00:00:00Z')` → Dec 20 00:00 UTC
3. **In EST (UTC-5):** Dec 20 00:00 UTC = **Dec 19 19:00 EST**
4. `date.getDate()` returns **LOCAL day** → **19** ❌

**Why it's wrong:**
- `getDate()` returns the day in the **browser's local timezone**
- The date string `'2025-12-20'` represents a **UTC date** (no time component)
- When converted to local time, it shifts backward, causing the day to decrease

### Evidence from Investigation

```
Database created_at: 2025-12-20T17:54:14.569873+00:00
Backend extractDate(): 2025-12-20 ✅ CORRECT
UI formatDateLabel(): Fri 19 ❌ WRONG

Extracted Date Object (UTC): 2025-12-20T00:00:00.000Z
Extracted Date Object (Local): Fri Dec 19 2025 19:00:00 GMT-0500 (EST)
UI getDate() result: 19 ❌ Should be 20

System Timezone: America/New_York (EST, UTC-5)
```

---

## Impact

- **All date labels** in the dashboard charts show **one day earlier** than actual
- Affects all brands and all time-series visualizations
- Users see data on wrong dates, causing confusion

---

## Solution

### Fix Option 1: Use UTC Date Methods (Recommended)

Change `formatDateLabel()` to use UTC methods:

```typescript
const formatDateLabel = (dateStr: string): string => {
  try {
    // Parse date string directly (YYYY-MM-DD format)
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
    const dayNum = date.getUTCDate()  // ✅ Use UTC day
    return `${dayName} ${dayNum}`
  } catch {
    return dateStr
  }
}
```

### Fix Option 2: Parse Date String Directly

```typescript
const formatDateLabel = (dateStr: string): string => {
  try {
    // Parse YYYY-MM-DD directly without timezone conversion
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    const dayName = date.toLocaleDateString('en-US', { 
      weekday: 'short',
      timeZone: 'UTC' 
    })
    return `${dayName} ${dayNum}`
  } catch {
    return dateStr
  }
}
```

### Fix Option 3: Use UTC Throughout

```typescript
const formatDateLabel = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + 'T00:00:00Z')
    const dayName = date.toLocaleDateString('en-US', { 
      weekday: 'short',
      timeZone: 'UTC'  // ✅ Force UTC
    })
    const dayNum = date.getUTCDate()  // ✅ Use UTC day
    return `${dayName} ${dayNum}`
  } catch {
    return dateStr
  }
}
```

---

## Files to Fix

1. **`src/pages/SearchVisibility.tsx`** (line 146-155)
   - Function: `formatDateLabel()`
   - Change: Use `getUTCDate()` instead of `getDate()`

2. **Check for similar issues** in other date formatting functions:
   - Search for `getDate()` usage in date formatting
   - Ensure all date labels use UTC methods when displaying date-only strings

---

## Testing

After fix, verify:
1. Database: `2025-12-20T17:54:14+00:00`
2. Backend: Returns `'2025-12-20'`
3. UI: Displays **"Sat 20"** (not "Fri 19")

---

## Summary

**Root Cause:** `formatDateLabel()` uses `getDate()` which returns the local day, but the date string represents a UTC date. Timezone conversion causes the day to shift backward.

**Fix:** Use `getUTCDate()` and `timeZone: 'UTC'` in date formatting to preserve the UTC date.

**Priority:** High - affects all date displays in dashboard

