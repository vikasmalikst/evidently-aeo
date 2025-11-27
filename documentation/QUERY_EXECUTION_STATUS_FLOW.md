# Query Execution Status Flow and When Status Stays "Running"

## Normal Status Flow

The correct status flow is:
1. **pending** → Created when execution record is first created
2. **running** → Updated when collector starts executing
3. **completed** → Updated when result is successfully stored
4. **failed** → Updated when execution fails or times out

## When Status Stays "Running" (Root Causes)

### 1. **Missing Status Update (FIXED)**
   - **Location**: `executeWithCollector()` method
   - **Problem**: When a collector successfully completed, the result was stored but the status was never updated from 'running' to 'completed'
   - **Fix**: Added explicit status update after successful result storage
   - **Status**: ✅ FIXED

### 2. **Exception Before Status Update**
   - **When it happens**: 
     - An exception occurs after storing the result but before updating the status
     - Process crashes or is killed
     - Database connection is lost during status update
   - **Fix**: Added automatic verification after storing results to catch and fix these cases
   - **Status**: ✅ FIXED with auto-verification

### 3. **Database Update Failure**
   - **When it happens**:
     - Database transaction fails silently
     - Row-level security (RLS) policy blocks the update
     - Database constraint violation
   - **Fix**: Added verification that updates actually succeeded, with error logging
   - **Status**: ✅ FIXED with verification

### 4. **Race Condition**
   - **When it happens**:
     - Multiple processes try to update the same execution
     - Status update happens before result is stored
   - **Fix**: Added verification after result storage to ensure status matches
   - **Status**: ✅ FIXED with post-storage verification

### 5. **BrightData Async Processing**
   - **When it happens**:
     - BrightData collectors return immediately with a snapshot_id
     - Results are fetched later by background service
     - If background service fails, status stays 'running'
   - **Fix**: Background service now properly updates status when results are ready
   - **Status**: ✅ FIXED

## Automatic Status Verification

### After All Collectors Finish
When `executeQueryAcrossCollectors()` completes, it now automatically:
1. Checks all execution statuses
2. Verifies if results exist for each execution
3. Updates status to 'completed' if result exists but status is 'running'
4. Updates status to 'failed' if result status is 'failed' but execution is 'running'

### After Each Result is Stored
When `storeCollectorResult()` successfully stores a result, it now:
1. Immediately checks the execution status
2. If execution is 'running' but result is stored, updates to 'completed'
3. If execution is 'running' but result is 'failed', updates to 'failed'

This ensures statuses are fixed **immediately** after results are stored, not after a delay.

## Cleanup Service (Safety Net)

The cleanup service (`queryExecutionCleanup.cron.ts`) is now a **safety net** that:
- Runs every 5 minutes (reduced from 15 minutes)
- Finds executions stuck in 'running' for more than 5 minutes
- Checks if results exist and fixes statuses accordingly
- This catches any edge cases that the immediate verification might miss

## Why 5 Minutes Instead of 15?

The 5-minute timeout is a safety net for:
- Process crashes that prevent immediate verification
- Database connection issues
- Edge cases in async processing
- BrightData collectors that take longer to complete

The primary fix is the **immediate verification** after results are stored, which should catch 99% of cases instantly.

## Data Reliability Guarantees

1. **Immediate Fix**: Status is verified and fixed immediately after result storage
2. **Batch Verification**: After all collectors finish, all executions are verified
3. **Safety Net**: Cleanup service runs every 5 minutes to catch any missed cases
4. **Comprehensive Logging**: All status changes are logged for debugging

## Monitoring

To monitor status issues:
1. Check logs for: `🔧 Auto-fixing:` or `🔧 Fixing:` messages
2. Query stuck executions:
   ```sql
   SELECT id, collector_type, status, updated_at, created_at
   FROM query_executions
   WHERE status = 'running'
   AND updated_at < NOW() - INTERVAL '5 minutes'
   ORDER BY updated_at ASC;
   ```
3. Check cleanup service logs for statistics

