# Production Cron Jobs Deployment Guide

## Overview

This guide explains how to deploy and run the cron job scheduler and worker processes in a production/hosted environment.

## Architecture

The cron job system requires **3 separate processes**:
1. **Backend Server** - Main API server
2. **Job Scheduler** - Polls for due jobs and enqueues them
3. **Job Worker** - Processes enqueued jobs

## Deployment Options

### Option 1: PM2 (Recommended for VPS/Server)

PM2 is a process manager that keeps your processes running and restarts them if they crash.

#### Installation

```bash
# Install PM2 globally
npm install -g pm2
```

#### Setup

1. **Create PM2 ecosystem file** (`backend/ecosystem.config.js`):

```javascript
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'npm',
      args: 'run dev',
      cwd: '/path/to/your/backend',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'job-scheduler',
      script: 'npm',
      args: 'run cron:job:scheduler',
      cwd: '/path/to/your/backend',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'job-worker',
      script: 'npm',
      args: 'run cron:job:worker',
      cwd: '/path/to/your/backend',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
```

2. **Start all processes:**

```bash
cd backend
pm2 start ecosystem.config.js
```

3. **View status:**

```bash
pm2 status
```

4. **View logs:**

```bash
# All logs
pm2 logs

# Specific process
pm2 logs job-scheduler
pm2 logs job-worker
pm2 logs backend
```

5. **Save PM2 configuration (auto-start on reboot):**

```bash
pm2 save
pm2 startup
# Follow the instructions to enable auto-start
```

#### PM2 Commands

```bash
# Start all
pm2 start ecosystem.config.js

# Stop all
pm2 stop all

# Restart all
pm2 restart all

# Stop specific
pm2 stop job-scheduler

# Restart specific
pm2 restart job-worker

# View status
pm2 status

# View logs
pm2 logs

# Monitor (real-time)
pm2 monit

# Delete from PM2
pm2 delete job-scheduler
```

### Option 2: systemd (Linux Services)

For Linux servers, you can create systemd services.

#### Create Service Files

**`/etc/systemd/system/evidently-backend.service`:**
```ini
[Unit]
Description=Evidently Backend Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/evidently-job-scheduler.service`:**
```ini
[Unit]
Description=Evidently Job Scheduler
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run cron:job:scheduler
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/evidently-job-worker.service`:**
```ini
[Unit]
Description=Evidently Job Worker
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run cron:job:worker
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

#### Enable and Start Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable evidently-backend
sudo systemctl enable evidently-job-scheduler
sudo systemctl enable evidently-job-worker

# Start services
sudo systemctl start evidently-backend
sudo systemctl start evidently-job-scheduler
sudo systemctl start evidently-job-worker

# Check status
sudo systemctl status evidently-backend
sudo systemctl status evidently-job-scheduler
sudo systemctl status evidently-job-worker

# View logs
sudo journalctl -u evidently-job-scheduler -f
sudo journalctl -u evidently-job-worker -f
```

### Option 3: Docker Compose

If you're using Docker, create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    command: npm run dev
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    volumes:
      - ./backend:/app
    ports:
      - "3000:3000"
    restart: unless-stopped

  job-scheduler:
    build: ./backend
    command: npm run cron:job:scheduler
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    volumes:
      - ./backend:/app
    restart: unless-stopped
    depends_on:
      - backend

  job-worker:
    build: ./backend
    command: npm run cron:job:worker
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    volumes:
      - ./backend:/app
    restart: unless-stopped
    depends_on:
      - backend
```

**Start with Docker Compose:**
```bash
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f job-scheduler
docker-compose logs -f job-worker
```

### Option 4: Cloud Platform Services

#### Heroku

Use Heroku's process types in `Procfile`:

```
web: npm run dev
scheduler: npm run cron:job:scheduler
worker: npm run cron:job:worker
```

Then scale:
```bash
heroku ps:scale scheduler=1 worker=1
```

#### Railway

Use Railway's process configuration:
- Add multiple services in Railway dashboard
- Each service runs a different command:
  - Service 1: `npm run dev`
  - Service 2: `npm run cron:job:scheduler`
  - Service 3: `npm run cron:job:worker`

#### Render

Use Render's Background Workers:
- Create 3 separate services:
  - Web Service: `npm run dev`
  - Background Worker 1: `npm run cron:job:scheduler`
  - Background Worker 2: `npm run cron:job:worker`

#### AWS ECS / Fargate

Create 3 task definitions:
- Task 1: Backend server
- Task 2: Job scheduler
- Task 3: Job worker

Run them as separate ECS services.

#### Google Cloud Run

Deploy 3 separate Cloud Run services:
- Service 1: Backend (HTTP)
- Service 2: Scheduler (can be triggered by Cloud Scheduler)
- Service 3: Worker (can be triggered by Cloud Tasks)

## Environment Variables

Make sure all processes have access to:

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=production
```

## Verification in Production

### 1. Check Processes Are Running

**PM2:**
```bash
pm2 status
```

**systemd:**
```bash
sudo systemctl status evidently-job-scheduler
sudo systemctl status evidently-job-worker
```

**Docker:**
```bash
docker-compose ps
```

### 2. Check Logs

**PM2:**
```bash
pm2 logs job-scheduler --lines 50
pm2 logs job-worker --lines 50
```

**systemd:**
```bash
sudo journalctl -u evidently-job-scheduler -n 50
sudo journalctl -u evidently-job-worker -n 50
```

**Docker:**
```bash
docker-compose logs job-scheduler
docker-compose logs job-worker
```

### 3. Verify Jobs Are Being Processed

**Check database:**
```sql
-- Check recent job runs
SELECT 
  id,
  job_type,
  status,
  started_at,
  completed_at,
  created_at
FROM job_runs
WHERE customer_id = 'your-customer-id'
ORDER BY created_at DESC
LIMIT 10;

-- Check if jobs are being enqueued
SELECT 
  COUNT(*) as pending_runs
FROM job_runs
WHERE status = 'pending';
```

### 4. Monitor Health

Create a health check endpoint or monitor logs for:
- Scheduler: Should see `[Scheduler] Checking for due jobs...` every 60 seconds
- Worker: Should see `[Worker] Checking for pending job runs...` every 30 seconds

## Recommended Production Setup

### For VPS/Server (Recommended: PM2)

1. Use PM2 for process management
2. Set up log rotation
3. Monitor with PM2 Plus or custom monitoring
4. Set up alerts for crashes

### For Cloud Platforms

1. Use platform-native process management
2. Set up auto-scaling if needed
3. Use platform monitoring/alerting
4. Set up log aggregation

## Monitoring & Alerts

### PM2 Monitoring

```bash
# Install PM2 Plus (optional)
pm2 link <secret-key> <public-key>

# Or use PM2 web dashboard
pm2 web
```

### Custom Health Checks

Create a simple health check script:

```javascript
// backend/scripts/health-check.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHealth() {
  // Check if scheduler is creating job runs
  const { data: recentRuns } = await supabase
    .from('job_runs')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (!recentRuns || recentRuns.length === 0) {
    console.error('⚠️ No recent job runs found');
    process.exit(1);
  }
  
  const lastRun = new Date(recentRuns[0].created_at);
  const hoursSinceLastRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceLastRun > 2) {
    console.error(`⚠️ Last job run was ${hoursSinceLastRun.toFixed(1)} hours ago`);
    process.exit(1);
  }
  
  console.log('✅ Health check passed');
  process.exit(0);
}

checkHealth();
```

## Troubleshooting Production Issues

### Processes Keep Crashing

1. Check logs for errors
2. Verify environment variables
3. Check database connectivity
4. Verify memory limits

### Jobs Not Running

1. Verify both scheduler and worker are running
2. Check `is_active = true` in database
3. Verify `next_run_at` is set
4. Check for errors in logs

### High Memory Usage

1. Adjust `max_memory_restart` in PM2 config
2. Check for memory leaks in logs
3. Consider scaling worker processes

## Security Considerations

1. **Environment Variables:** Never commit `.env` files
2. **Service Role Key:** Only use in backend, never expose to frontend
3. **Database Access:** Use RLS policies and service role key only for cron processes
4. **Logs:** Don't log sensitive data (API keys, tokens)

## Backup & Recovery

1. **Database Backups:** Ensure Supabase backups are enabled
2. **Job History:** Job runs are stored in database (backed up automatically)
3. **Configuration:** Keep PM2/systemd configs in version control

## Scaling

If you have many jobs, consider:
- Running multiple worker processes
- Using a job queue (BullMQ, Redis Queue)
- Distributing across multiple servers

For now, the current setup should handle moderate loads. Monitor and scale as needed.

