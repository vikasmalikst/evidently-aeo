# Job Services Architecture & Setup Guide

## 🏗️ How Scheduled Jobs Work

Scheduled jobs require **TWO background services** to be running on your VPS:

### 1. **Job Scheduler** (`unified-job-scheduler.ts`)
- **What it does**: Checks for scheduled jobs that are due and creates "job runs"
- **Polling frequency**: Every 60 seconds (default)
- **Function**: 
  - Reads from `scheduled_jobs` table
  - Calculates which jobs are due based on cron expressions
  - Creates entries in `job_runs` table with status `pending`

### 2. **Job Worker** (`unified-job-worker.ts`)
- **What it does**: Executes the actual data collection and scoring work
- **Polling frequency**: Every 30 seconds (default)
- **Function**:
  - Picks up `pending` job runs from `job_runs` table
  - Updates status to `processing`
  - Executes data collection/scoring
  - Updates status to `completed` or `failed`

## 📊 Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  You (from localhost)                                        │
│  Create scheduled job via Admin UI                           │
│  → Saves to `scheduled_jobs` table in database             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  VPS: Job Scheduler (running every 60s)                    │
│  → Checks `scheduled_jobs` table                           │
│  → Finds jobs that are due                                  │
│  → Creates `job_runs` entries with status "pending"         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  VPS: Job Worker (running every 30s)                       │
│  → Picks up "pending" job runs                              │
│  → Updates status to "processing"                          │
│  → Executes: data collection + scoring                      │
│  → Updates status to "completed" or "failed"                │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Answer to Your Question

**Q: Do I need to run a service in the background? Will it be collected automatically?**

**A: YES, you need BOTH services running on your VPS:**

1. ✅ **Job Scheduler** - Must be running to create job runs when they're due
2. ✅ **Job Worker** - Must be running to execute the job runs

**You can create scheduled jobs from localhost** (they're just database entries), but **the services must run on your VPS** for the jobs to actually execute.

---

## 🚀 How to Run the Services on Your VPS

### Option 1: Using npm scripts (Development/Testing)

```bash
# Terminal 1: Run Job Scheduler
cd backend
npm run cron:job:scheduler

# Terminal 2: Run Job Worker
cd backend
npm run cron:job:worker
```

### Option 2: Using PM2 (Recommended for Production)

PM2 is a process manager that keeps services running and restarts them if they crash.

#### Install PM2 (if not already installed):
```bash
npm install -g pm2
```

#### Create PM2 ecosystem file (`ecosystem.config.js` in backend directory):

```javascript
module.exports = {
  apps: [
    {
      name: 'job-scheduler',
      script: 'node',
      args: '--loader ts-node/esm src/cron/unified-job-scheduler.ts',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/job-scheduler-error.log',
      out_file: './logs/job-scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'job-worker',
      script: 'node',
      args: '--loader ts-node/esm src/cron/unified-job-worker.ts',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/job-worker-error.log',
      out_file: './logs/job-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
```

#### Start services with PM2:
```bash
cd backend
pm2 start ecosystem.config.js
```

#### Useful PM2 commands:
```bash
# View status
pm2 status

# View logs
pm2 logs job-scheduler
pm2 logs job-worker

# Restart services
pm2 restart all

# Stop services
pm2 stop all

# Save PM2 configuration (so services start on server reboot)
pm2 save
pm2 startup  # Follow instructions to enable auto-start on boot
```

### Option 3: Using systemd (Linux)

Create systemd service files for each service.

#### `/etc/systemd/system/job-scheduler.service`:
```ini
[Unit]
Description=Job Scheduler Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/evidently/backend
ExecStart=/usr/bin/npm run cron:job:scheduler
Restart=always
RestartSec=10
StandardOutput=append:/var/log/job-scheduler.log
StandardError=append:/var/log/job-scheduler-error.log

[Install]
WantedBy=multi-user.target
```

#### `/etc/systemd/system/job-worker.service`:
```ini
[Unit]
Description=Job Worker Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/evidently/backend
ExecStart=/usr/bin/npm run cron:job:worker
Restart=always
RestartSec=10
StandardOutput=append:/var/log/job-worker.log
StandardError=append:/var/log/job-worker-error.log

[Install]
WantedBy=multi-user.target
```

#### Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable job-scheduler
sudo systemctl enable job-worker
sudo systemctl start job-scheduler
sudo systemctl start job-worker

# Check status
sudo systemctl status job-scheduler
sudo systemctl status job-worker
```

---

## 🔍 Verifying Services Are Running

### Check if services are running:

**PM2:**
```bash
pm2 status
# Should show both job-scheduler and job-worker as "online"
```

**systemd:**
```bash
sudo systemctl status job-scheduler
sudo systemctl status job-worker
# Should show "active (running)"
```

**Process check:**
```bash
ps aux | grep "unified-job"
# Should show both processes running
```

### Check logs for activity:

**PM2:**
```bash
pm2 logs job-scheduler --lines 50
pm2 logs job-worker --lines 50
```

**systemd:**
```bash
sudo journalctl -u job-scheduler -f
sudo journalctl -u job-worker -f
```

You should see log messages like:
- `[Scheduler] Unified job scheduler started. Polling every 60 seconds`
- `[Worker] Unified job worker started. Polling every 30 seconds`
- `[Scheduler] Found X due job(s) to enqueue`
- `[Worker] Processing job run...`

---

## ⚙️ Configuration

### Environment Variables

Both services use the same environment variables as your main backend:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `JOB_SCHEDULER_POLL_MS` - Polling interval for scheduler (default: 60000 = 60 seconds)
- `JOB_WORKER_POLL_MS` - Polling interval for worker (default: 30000 = 30 seconds)
- `JOB_SCHEDULER_BATCH` - Max schedules to process per tick (default: 25)
- `JOB_WORKER_BATCH` - Max job runs to process per tick (default: 5)

### Customizing Poll Intervals

Add to your `.env` file:
```env
JOB_SCHEDULER_POLL_MS=60000    # 60 seconds (1 minute)
JOB_WORKER_POLL_MS=30000       # 30 seconds
```

---

## 🐛 Troubleshooting

### Jobs not running?

1. **Check if services are running:**
   ```bash
   pm2 status  # or systemctl status
   ```

2. **Check logs for errors:**
   ```bash
   pm2 logs job-scheduler --err
   pm2 logs job-worker --err
   ```

3. **Verify database connection:**
   - Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly
   - Test database connection from VPS

4. **Check scheduled job status:**
   - Go to Admin → Scheduled Jobs
   - Verify job is marked as "Active"
   - Check "Next Run" time has passed

5. **Check job runs table:**
   - Look in `job_runs` table for entries with status `pending`
   - If you see `pending` jobs but they're not processing, the worker might not be running

### Services keep crashing?

1. **Check memory usage:**
   ```bash
   pm2 monit  # Shows real-time memory/CPU usage
   ```

2. **Check error logs:**
   ```bash
   pm2 logs --err
   ```

3. **Increase memory limit in PM2 config:**
   ```javascript
   max_memory_restart: '2G'  // Increase if needed
   ```

### Jobs running but failing?

1. **Check job run history in Admin UI:**
   - Click "History" button next to the job
   - Look for error messages

2. **Check worker logs:**
   ```bash
   pm2 logs job-worker --lines 100
   ```

3. **Verify brand has active queries:**
   - Jobs need active queries (`is_active = true` in `generated_queries` table)

---

## 📝 Summary

**To answer your question directly:**

✅ **YES, you need both services running on your VPS:**
- Job Scheduler (creates job runs when due)
- Job Worker (executes the job runs)

✅ **You can create scheduled jobs from localhost** - they're just database entries

❌ **Jobs will NOT execute automatically** unless both services are running on your VPS

**Recommended setup:**
- Use PM2 to manage both services
- Set up PM2 to auto-start on server reboot
- Monitor logs regularly to ensure services are healthy

---

**Last Updated**: January 2025
