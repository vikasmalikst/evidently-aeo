# Production Polling Interval Recommendations

## Current Configuration

- **Job Scheduler**: 60 seconds (1 minute)
- **Job Worker**: 30 seconds (0.5 minutes)

## Analysis

### Job Scheduler (60 seconds)

**Current behavior:**
- Checks every 60 seconds for due jobs
- If a job is scheduled for `9:00:00`, it might be picked up anywhere between `9:00:00` and `9:00:59` (worst case: 59 seconds delay)

**Is 60 seconds ideal?**
✅ **Yes, for most production use cases**

**Reasoning:**
- Most cron jobs are scheduled at minute-level granularity (e.g., `0 9 * * *` = 9:00 AM)
- A 0-59 second delay is acceptable for scheduled background jobs
- Reduces database load (only 1 query per minute)
- Lower CPU/memory usage

**When to reduce:**
- If you need sub-minute precision (e.g., jobs scheduled at `*/30 * * * *` = every 30 seconds)
- If you have many scheduled jobs and want faster detection
- Recommended: **30 seconds** minimum (don't go below this)

### Job Worker (30 seconds)

**Current behavior:**
- Checks every 30 seconds for pending job runs
- When a job run is created, it might wait up to 30 seconds before starting execution

**Is 30 seconds ideal?**
⚠️ **Acceptable, but could be optimized for production**

**Reasoning:**
- 30 seconds is reasonable for background jobs
- However, for better user experience and faster feedback, 10-15 seconds is better
- Reduces perceived latency when users trigger jobs manually

**When to reduce:**
- If users frequently trigger jobs manually and expect quick feedback
- If you want faster job execution start times
- Recommended: **10-15 seconds** for production

---

## Recommended Production Settings

### Standard Production Setup (Recommended)

```env
# .env file
JOB_SCHEDULER_POLL_MS=30000    # 30 seconds (was 60s)
JOB_WORKER_POLL_MS=10000      # 10 seconds (was 30s)
```

**Benefits:**
- Faster job detection (30s instead of 60s)
- Faster job execution start (10s instead of 30s)
- Still reasonable database load
- Better user experience

**Trade-offs:**
- Slightly more database queries (2x for scheduler, 3x for worker)
- Minimal CPU/memory increase (negligible for most systems)

### High-Performance Setup (For Critical Systems)

```env
# .env file
JOB_SCHEDULER_POLL_MS=15000    # 15 seconds
JOB_WORKER_POLL_MS=5000        # 5 seconds
```

**Benefits:**
- Very fast job detection and execution
- Near real-time responsiveness

**Trade-offs:**
- 4x more database queries (scheduler)
- 6x more database queries (worker)
- Higher CPU/memory usage
- Only use if you have high-volume, time-sensitive jobs

### Conservative Setup (For Low-Resource Systems)

```env
# .env file
JOB_SCHEDULER_POLL_MS=60000    # 60 seconds (current default)
JOB_WORKER_POLL_MS=30000       # 30 seconds (current default)
```

**Benefits:**
- Minimal database load
- Lowest CPU/memory usage
- Good for systems with limited resources

**Trade-offs:**
- Slower job detection and execution
- Less responsive user experience

---

## Database Load Analysis

### Current Setup (60s scheduler, 30s worker)

**Queries per hour:**
- Scheduler: 60 queries/hour (1 per minute)
- Worker: 120 queries/hour (2 per minute)
- **Total: 180 queries/hour**

### Recommended Setup (30s scheduler, 10s worker)

**Queries per hour:**
- Scheduler: 120 queries/hour (2 per minute)
- Worker: 360 queries/hour (6 per minute)
- **Total: 480 queries/hour**

**Impact:** 
- 2.67x more queries, but still very manageable
- Modern databases handle thousands of queries per second
- These are simple SELECT queries with indexes, very fast

---

## Performance Considerations

### Database Impact

✅ **Low Impact:**
- Queries are simple SELECTs with proper indexes
- Each query is fast (< 10ms typically)
- Even at 5-second intervals, only ~720 queries/hour per service

### CPU/Memory Impact

✅ **Minimal Impact:**
- Polling is lightweight (just a database query)
- No heavy computation during polling
- Memory usage is constant (no accumulation)

### Network Impact

✅ **Negligible:**
- Small query payloads
- Efficient database connections (connection pooling)

---

## Best Practices

### 1. Start Conservative, Optimize Based on Needs

```env
# Start with current defaults
JOB_SCHEDULER_POLL_MS=60000
JOB_WORKER_POLL_MS=30000
```

Monitor for a week, then adjust if needed:
- If jobs are consistently delayed → reduce intervals
- If system is under heavy load → keep current or increase

### 2. Monitor Database Performance

Watch for:
- Slow query times (> 100ms)
- Database connection pool exhaustion
- High CPU usage on database server

If you see issues, increase intervals slightly.

### 3. Consider Your Use Case

**For scheduled daily/weekly jobs:**
- 60s scheduler, 30s worker is fine ✅

**For frequent jobs (hourly or more):**
- 30s scheduler, 10-15s worker recommended ✅

**For real-time critical jobs:**
- 15s scheduler, 5-10s worker ✅
- Or consider event-driven architecture (database triggers/notifications)

### 4. Don't Go Too Low

❌ **Avoid:**
- Scheduler < 10 seconds (unnecessary for cron jobs)
- Worker < 3 seconds (too aggressive, minimal benefit)

**Minimum recommended:**
- Scheduler: 10-15 seconds
- Worker: 5-10 seconds

---

## Alternative: Event-Driven Architecture (Advanced)

For even better performance, consider using database triggers/notifications instead of polling:

### Benefits:
- Zero polling overhead
- Instant job execution
- More efficient resource usage

### Implementation:
- Use PostgreSQL `LISTEN/NOTIFY` or database triggers
- Worker subscribes to notifications
- Scheduler sends notifications when jobs are due

**Note:** This requires more complex implementation but provides the best performance.

---

## Recommended Production Configuration

### For Most Production Environments:

```env
# Recommended production settings
JOB_SCHEDULER_POLL_MS=30000    # 30 seconds - good balance
JOB_WORKER_POLL_MS=10000       # 10 seconds - responsive but not excessive
```

### Why This Works Well:

1. **Scheduler at 30s:**
   - Catches jobs within 30 seconds of scheduled time
   - Still reasonable for minute-level cron jobs
   - 2x more responsive than 60s

2. **Worker at 10s:**
   - Jobs start executing within 10 seconds
   - Good user experience for manual triggers
   - Not too aggressive on database

3. **Database Load:**
   - ~480 queries/hour total
   - Very manageable for any modern database
   - Queries are indexed and fast

---

## How to Apply Changes

1. **Update `.env` file on your VPS:**
   ```env
   JOB_SCHEDULER_POLL_MS=30000
   JOB_WORKER_POLL_MS=10000
   ```

2. **Restart services:**
   ```bash
   # If using PM2
   pm2 restart job-scheduler job-worker
   
   # If using systemd
   sudo systemctl restart job-scheduler
   sudo systemctl restart job-worker
   ```

3. **Monitor logs:**
   ```bash
   pm2 logs job-scheduler --lines 20
   pm2 logs job-worker --lines 20
   ```

4. **Verify new intervals:**
   - Look for log messages showing the new polling intervals
   - Example: `[Scheduler] Unified job scheduler started. Polling every 30 seconds`

---

## Summary

| Setting | Current | Recommended | High-Perf | Conservative |
|---------|---------|-------------|-----------|--------------|
| **Scheduler** | 60s | **30s** ✅ | 15s | 60s |
| **Worker** | 30s | **10s** ✅ | 5s | 30s |
| **DB Load** | Low | Medium | Higher | Low |
| **Responsiveness** | Good | **Better** ✅ | Excellent | Good |

**Recommendation:** Use **30s scheduler + 10s worker** for production. This provides a good balance between responsiveness and resource usage.

---

**Last Updated**: January 2025
