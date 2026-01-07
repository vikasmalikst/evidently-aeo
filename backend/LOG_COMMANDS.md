# Backend Log Commands for VPS

## PM2 Commands (Recommended)

### View logs in real-time
```bash
# All processes
pm2 logs

# Specific process
pm2 logs evidently-backend

# Last 100 lines only
pm2 logs evidently-backend --lines 100

# Only errors
pm2 logs --err

# Only output
pm2 logs --out
```

### Check process status
```bash
pm2 list
pm2 status
pm2 info evidently-backend
```

### Clear logs
```bash
pm2 flush
```

## Direct Log File Access

Logs are stored in `/home/dev/logs/`

### Main Backend
```bash
# Output logs
tail -f /home/dev/logs/evidently-backend-out.log
tail -n 100 /home/dev/logs/evidently-backend-out.log

# Error logs
tail -f /home/dev/logs/evidently-backend-error.log
tail -n 100 /home/dev/logs/evidently-backend-error.log
```

### Job Scheduler
```bash
tail -f /home/dev/logs/job-scheduler-out.log
tail -f /home/dev/logs/job-scheduler-error.log
```

### Job Worker
```bash
tail -f /home/dev/logs/job-worker-out.log
tail -f /home/dev/logs/job-worker-error.log
```

### Query Execution Cleanup
```bash
tail -f /home/dev/logs/query-execution-cleanup-out.log
tail -f /home/dev/logs/query-execution-cleanup-error.log
```

## Useful Commands

### Search logs for specific text
```bash
# In PM2 logs
pm2 logs | grep "ERROR"

# In log files
grep -i "error" /home/dev/logs/evidently-backend-error.log
grep -i "error" /home/dev/logs/*.log
```

### View log file sizes
```bash
ls -lh /home/dev/logs/
```

### Monitor multiple logs simultaneously
```bash
tail -f /home/dev/logs/evidently-backend-*.log
```

## Process Management

### Restart processes
```bash
pm2 restart evidently-backend
pm2 restart all
```

### Stop processes
```bash
pm2 stop evidently-backend
pm2 stop all
```

### Start processes
```bash
pm2 start ecosystem.config.js
pm2 start evidently-backend
```

