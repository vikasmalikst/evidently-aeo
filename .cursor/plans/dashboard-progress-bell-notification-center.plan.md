---
name: Dashboard Progress Bell + Notification Center (Onboarding → Dashboard Handoff)
overview: ""
todos: []
---

# Dashboard Progress Bell + Notification Center (Onboarding → Dashboard Handoff)

## Problem Statement

We currently have multiple progress UX surfaces during onboarding/data collection:

- A full-page onboarding progress screen (`/onboarding/loading/:brandId`) with “Continue to Dashboard”
- A dashboard processing overlay + minimizable widget (`DashboardProcessingState` + `GlobalProgressWidget`)

The desired UX change is:

- When the user clicks **Continue to Dashboard** on the main progress UI, we should **redirect to dashboard while “minimizing” the progress UI into a Bell icon**
- On the dashboard (top-right / right corner), a **Bell icon** should open the **same loading/progress modal** any time until collection/scoring completes
- After completion, clicking the Bell should show a **completion message** (and later this Bell becomes the entry point for a full notifications center)

## Goals / UX Requirements

1. **Single “source of truth” progress UI**:

- The progress modal shown from the Bell should be the *same* core UI as the onboarding loading screen (same progress polling, same KPI “Available Data” preview).

2. **Handoff behavior**:

- On `/onboarding/loading/:brandId`, the user can click **Continue to Dashboard**.
- This action should *not* “end” progress tracking; it should set the progress UI to a minimized state and redirect to `/dashboard`.

3. **Bell icon behavior**:

- Visible on dashboard while collection/scoring is in progress for the selected brand.
- Clicking opens the progress modal overlay (restoring the minimized progress UI).
- After completion, clicking shows a simple completion state (v1) and later can show real notifications (v2).

4. **Progress polling continuity**:

- Progress polling must continue regardless of whether the progress modal is open or minimized.
- Avoid duplicate polling storms: at most one progress poll loop per selected brand.

5. **Accessible / non-annoying**:

- Bell should show a small dot/badge while progress is active.
- Modal is dismissible (close button + ESC), and returns user to dashboard without losing progress tracking.

## Current Code Touchpoints (Relevant)

- `src/components/Onboarding/DataCollectionLoadingScreen.tsx`
- Shows the onboarding progress UI and has **Continue to Dashboard** button.
- Polls `/brands/:brandId/onboarding-progress` every 5s and dashboard preview `/brands/:brandId/dashboard?...` every 15s.

- `src/pages/dashboard/hooks/useDashboardData.ts`
- Reads `localStorage[data_collection_in_progress_${brandId}]` to decide whether to poll progress.
- Polls `/brands/:brandId/onboarding-progress` (currently).

- `src/components/Layout/Header.tsx`
- Static today; will be the best mount point for a global Bell entry point.

- Existing widget:
- `src/pages/dashboard/components/GlobalProgressWidget.tsx` (bottom-right widget)
- We will replace this with a Bell-based entry point.

## Proposed Architecture

### 1) Introduce a shared “Progress Modal” component (single UI, two contexts)

Create:

- `src/components/Progress/ProgressModal.tsx`

Responsibilities:

- Render the “main progress tracking modal/screen” UI (the one we want to show from Bell)
- Accept props:
- `brandId: string`
- `brandName?: string`
- `mode: 'fullpage' | 'modal'`
- `onContinueToDashboard?: () => void` (only meaningful in fullpage mode)
- `onClose?: () => void` (modal close)

Behavior:

- Uses the *same endpoints and intervals* as the current onboarding loading screen:
- Progress: `GET /brands/:brandId/onboarding-progress` (5s, non-overlapping, ~45s timeout)
- Dashboard preview: `GET /brands/:brandId/dashboard?startDate&endDate&skipCache=true&cacheBust=` (15s)
- Contains the KPI “Available Data” section and status text.

Implementation note:

- Start by extracting the core UI + polling logic from `DataCollectionLoadingScreen.tsx` into `ProgressModal.tsx`.
- Keep `DataCollectionLoadingScreenRoute` as a thin wrapper that renders `ProgressModal mode="fullpage"`.

### 2) Progress UI state model (minimized/open/completed)

We already have:

- `localStorage[data_collection_in_progress_${brandId}] = 'true'`

Add:

- `localStorage[data_collection_progress_ui_${brandId}]` with values:
- `'open' | 'minimized'`
- Default: `'open'` on onboarding route; `'minimized'` after clicking Continue to Dashboard.

Optional (nice to have):

- `localStorage[data_collection_completed_at_${brandId}] = ISO string` (helps show “completed” message)

### 3) Notification Bell (v1) + Notification Center shell (v2-ready)

Create:

- `src/components/Notifications/NotificationBell.tsx`
- `src/components/Notifications/NotificationCenter.tsx` (v1 minimal panel)

Bell visibility rules:

- Show bell on dashboard (or globally in header) when:
- selected brand has `data_collection_in_progress_${brandId} === 'true'`
- OR progress data indicates not complete (stages not all completed)

Bell click behavior (v1):

- If progress is still active:
- open the Progress Modal overlay (`ProgressModal mode="modal"`)
- If progress is complete:
- open NotificationCenter showing “Data collection complete” (and optionally a “View dashboard” link / “Refresh”)

Badge behavior:

- Dot badge while active.
- “✓” badge / green dot when completed but still showable for a short time (optional).

### 4) Wire into `Header` (right corner)

Modify:

- `src/components/Layout/Header.tsx`

Add a right-side container to host:

- `NotificationBell` (only renders when brand context + in-progress state requires it)

If header currently has no access to “selectedBrandId”, we have two options:

**Option A (Recommended): create a lightweight global “Selected Brand” store**

- Introduce a small context/store, e.g. `src/state/brandSelection.ts` or `src/contexts/BrandContext.tsx`
- `useDashboardData` already manages brand selection; ensure it writes selected brand id to a shared store.
- `Header` reads from the shared store and localStorage to decide bell visibility.

**Option B (Fastest v1): derive from localStorage**

- Read `localStorage.current_brand_id` and `data_collection_in_progress_${brandId}` in `NotificationBell`.
- Also listen to `storage` events + a small polling tick to refresh UI.

We can start with Option B for speed, then migrate to Option A if needed.

## Implementation Plan

### Phase 1 — Extract shared progress UI (no UX change yet)

Files:

- `src/components/Progress/ProgressModal.tsx` (new)
- `src/components/Onboarding/DataCollectionLoadingScreen.tsx` (refactor to wrapper)

Steps:

1. Move progress polling + dashboard preview polling + UI into `ProgressModal`.
2. Keep `DataCollectionLoadingScreenRoute` rendering `ProgressModal mode="fullpage"` so existing route continues to work.
3. Ensure progress modal exposes:

- `onContinueToDashboard()` hook point
- `onClose()` hook point (for modal mode)

Acceptance:

- Onboarding route looks identical to today.
- Progress polling intervals/timeouts match today’s loading screen behavior.

### Phase 2 — Add Bell icon + modal overlay on dashboard

Files:

- `src/components/Layout/Header.tsx`
- `src/components/Notifications/NotificationBell.tsx` (new)
- `src/components/Notifications/NotificationCenter.tsx` (new, minimal)
- `src/pages/dashboard/Dashboard.tsx` (or a small global portal host)

Steps:

1. Add Bell icon in header right side.
2. Add state `isProgressModalOpen` in a global place:

- Quick: in `Dashboard.tsx` and pass callbacks to `Header` (less ideal).
- Better: create `NotificationCenterProvider` mounted at app root (ideal for future notifications).

3. When bell clicked:

- If active: open `ProgressModal mode="modal"` (uses same brandId)
- If complete: open NotificationCenter panel with completion message

Acceptance:

- When collection is active, Bell shows with dot.
- Clicking bell opens modal, closing modal returns to dashboard.

### Phase 3 — Change “Continue to Dashboard” behavior (minimize into Bell)

Files:

- `src/components/Progress/ProgressModal.tsx` (fullpage mode)
- `src/components/Onboarding/DataCollectionLoadingScreen.tsx` (wrapper)

Steps:

1. On “Continue to Dashboard” click:

- Set `localStorage[data_collection_in_progress_${brandId}] = 'true'` (already done)
- Set `localStorage[data_collection_progress_ui_${brandId}] = 'minimized'`
- Navigate to `/dashboard` with `state: { autoSelectBrandId: brandId }`

2. On dashboard load:

- Bell is visible and progress modal is closed by default (minimized)
- Clicking bell restores modal

Acceptance:

- Continue to Dashboard always results in Bell visible + modal recoverable.

### Phase 4 — Completion behavior

Files:

- `src/pages/dashboard/hooks/useDashboardData.ts`
- `src/components/Notifications/NotificationBell.tsx`
- `src/components/Notifications/NotificationCenter.tsx`

Steps:

1. On completion detection (already in `useDashboardData`):

- Clear `data_collection_in_progress_${brandId}`
- Set `data_collection_completed_at_${brandId}` (optional)

2. Bell click:

- If completed (and completion timestamp exists): show completion message in NotificationCenter.
- Optionally auto-hide the bell after X minutes (future).

Acceptance:

- After completion, bell click shows “Completed” message instead of progress modal.

### Phase 5 — Remove old widget and unify dashboard processing UI

Files:

- `src/pages/dashboard/Dashboard.tsx`
- `src/pages/dashboard/components/GlobalProgressWidget.tsx` (remove or deprecate)
- `src/pages/dashboard/components/DashboardProcessingState.tsx` (either deprecate or adapt to use `ProgressModal`)

Steps:

1. Replace `GlobalProgressWidget` usage with Bell.
2. Decide whether to:

- Deprecate `DashboardProcessingState` entirely (preferred: one progress UI), or
- Convert it to a wrapper around `ProgressModal mode="modal"`.

Acceptance:

- Only one progress UX exists: the shared ProgressModal (fullpage or modal).

## Edge Cases / Notes

- **Brand switching**: bell/modal should track the *selected brand*; if user switches brands while modal is open, prompt to close or seamlessly update.
- **Auth expiration**: bell/modal should surface auth errors gracefully (same as existing loading screen behavior).
- **Progress endpoint slowness (timeouts)**: keep non-overlapping polling + timeout handling (already implemented).
- **Portal / z-index**: modal overlay should render above sidebar/header; use a portal if needed.

## Test Plan (Manual)

1. Onboarding → Launch data collection → progress fullpage renders.
2. Click Continue to Dashboard:

- navigates to dashboard
- bell appears (active badge)

3. Click bell:

- progress modal opens
- close returns to dashboard

4. Let scoring complete:

- progress flag clears
- clicking bell shows completion message