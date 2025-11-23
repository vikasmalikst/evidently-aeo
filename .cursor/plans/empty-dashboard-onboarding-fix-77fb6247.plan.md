<!-- 77fb6247-b361-4403-996e-8d172e862de6 8df9738a-4d9e-42fb-994a-e35b214968e4 -->
# Empty Dashboard Onboarding Fix

## Problem Statement

When a brand is onboarded and queries are selected for execution:

1. Queries are sent to data collectors (async execution)
2. Dashboard queries `extracted_positions` table which is empty until:

   - Data collection completes
   - Scoring/visibility calculation completes  
   - Citation extraction completes

3. User sees empty dashboard with no feedback about progress

## Solution Approach

Implement a multi-layered solution that provides progressive visibility into data collection status and shows partial results as they become available.

## Implementation Plan

### Phase 1: Query Execution Status Tracking (Backend)

**File: `backend/src/services/brand-dashboard/payload-builder.ts`**

1. **Add execution status query** to fetch pending/running/completed query counts:

   - Query `query_executions` table for status breakdown by collector
   - Calculate: total queries, pending, running, completed, failed counts
   - Include collector-level status summaries

2. **Add execution status to dashboard payload**:

   - Extend `BrandDashboardPayload` type to include:
     ```typescript
     executionStatus?: {
       totalQueries: number;
       pending: number;
       running: number;
       completed: number;
       failed: number;
       collectorStatus: Array<{
         collectorType: string;
         pending: number;
         running: number;
         completed: number;
         failed: number;
         lastExecutionAt?: string;
       }>;
       estimatedCompletionTime?: string; // Optional: based on average execution time
     }
     ```


**File: `backend/src/services/brand-dashboard/types.ts`**

- Add execution status types to the types file

### Phase 2: Progressive Data Display (Backend)

**File: `backend/src/services/brand-dashboard/payload-builder.ts`**

3. **Query raw collector results** when `extracted_positions` is empty:

   - If no positions found, query `collector_results` table directly
   - Show raw responses (before scoring) with limited metadata:
     - Query text
     - Collector type
     - Response preview (first 200 chars)
     - Execution timestamp
     - Status (completed/pending/running)
   - Mark these as "preliminary" results

4. **Add preliminary results flag** to payload:
   ```typescript
   hasPreliminaryData?: boolean;
   preliminaryResults?: Array<{
     queryId: string;
     queryText: string;
     collectorType: string;
     status: string;
     responsePreview: string;
     executedAt: string;
   }>;
   ```


### Phase 3: Frontend Status Display (Frontend)

**File: `src/pages/Dashboard.tsx`**

5. **Add execution status banner**:

   - Show prominent banner when `executionStatus` indicates pending/running queries
   - Display progress: "X of Y queries completed"
   - Show per-collector status with progress bars
   - Include auto-refresh mechanism (poll every 30 seconds when active)

6. **Handle empty state gracefully**:

   - When `totalQueries > 0` but `extracted_positions` is empty:
     - Show "Data Collection in Progress" state instead of empty dashboard
     - Display execution status breakdown
     - Show estimated time remaining (if available)
     - Provide "Refresh" button for manual updates

7. **Show preliminary results**:

   - When `hasPreliminaryData === true`:
     - Display preliminary results section
     - Show raw responses with "Processing..." badges
     - Indicate these are unprocessed results
     - Link to full results when available

**File: `src/components/Dashboard/ExecutionStatusBanner.tsx`** (new)

- Create reusable component for execution status display
- Shows progress bars, collector status, and refresh controls

### Phase 4: Real-time Updates (Optional Enhancement)

**File: `src/hooks/useCachedData.ts` or new hook**

8. **Add polling mechanism**:

   - When execution status shows pending/running queries:
     - Enable auto-refresh every 30 seconds
     - Stop polling when all queries complete
     - Respect user's network/device settings

**File: `src/pages/Dashboard.tsx`**

9. **Optimistic UI updates**:

   - Update execution status in real-time
   - Show incremental progress as queries complete
   - Smoothly transition from "in progress" to full dashboard

### Phase 5: Database Query Optimization

**File: `backend/src/services/brand-dashboard/payload-builder.ts`**

10. **Optimize status queries**:

    - Use efficient aggregation queries for execution status
    - Cache execution status separately (shorter TTL than full dashboard)
    - Index `query_executions` table on `status`, `collector_type`, `created_at`

## Files to Modify

### Backend

- `backend/src/services/brand-dashboard/payload-builder.ts` - Add execution status and preliminary results
- `backend/src/services/brand-dashboard/types.ts` - Add new types
- `backend/src/services/brand-dashboard/dashboard.service.ts` - Pass through execution status

### Frontend  

- `src/pages/Dashboard.tsx` - Add status display and empty state handling
- `src/components/Dashboard/ExecutionStatusBanner.tsx` - New component (create)
- `src/hooks/useCachedData.ts` - Add polling support (optional)

## Success Criteria

1. Users see execution progress immediately after query selection
2. Dashboard shows meaningful information even when `extracted_positions` is empty
3. Users understand data is being processed (not broken)
4. Smooth transition from "in progress" to full dashboard
5. No performance degradation from status queries

## Alternative Approaches Considered

1. **WebSocket updates** - More complex, requires infrastructure changes
2. **Server-Sent Events** - Good alternative if polling becomes insufficient
3. **Show only completed queries** - Less informative, doesn't solve empty state
4. **Delay dashboard access** - Poor UX, users want immediate feedback

## Implementation Notes

- Execution status queries should be lightweight (aggregations only)
- Preliminary results should be limited (max 10-20 items) to avoid performance issues
- Auto-refresh should be disabled when user is not on dashboard page
- Consider adding WebSocket support in future if real-time updates become critical

### To-dos

- [ ] Add execution status query to payload-builder.ts to fetch pending/running/completed counts from query_executions table
- [ ] Extend BrandDashboardPayload type to include executionStatus and preliminaryResults fields
- [ ] Query collector_results table when extracted_positions is empty to show raw responses before scoring
- [ ] Create ExecutionStatusBanner component to display query execution progress and collector status
- [ ] Update Dashboard.tsx to show data collection in progress state instead of empty dashboard when queries are pending
- [ ] Add preliminary results section to Dashboard.tsx to show raw collector responses before scoring completes
- [ ] Implement auto-refresh mechanism (poll every 30s) when execution status shows pending/running queries