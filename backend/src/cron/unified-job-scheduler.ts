/**
 * Unified Job Scheduler
 * Enqueues due jobs for both data collection and scoring
 */

import 'dotenv/config';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';
import { jobSchedulerService } from '../services/jobs/job-scheduler.service';

loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const POLL_INTERVAL_MS = Number(process.env.JOB_SCHEDULER_POLL_MS ?? 60_000);
const MAX_SCHEDULES_PER_TICK = Number(process.env.JOB_SCHEDULER_BATCH ?? 25);

let isRunning = false;

async function enqueueDueJobs(): Promise<void> {
  try {
    // Get due jobs from scheduler service
    const dueJobs = await jobSchedulerService.getDueJobs(MAX_SCHEDULES_PER_TICK);

    if (dueJobs.length === 0) {
      return;
    }

    console.log(`[Scheduler] Found ${dueJobs.length} due job(s) to enqueue`);

    for (const job of dueJobs) {
      try {
        await jobSchedulerService.enqueueJobRun(job.id);
        console.log(
          `[Scheduler] Enqueued job run for brand ${job.brand_id} (job ${job.id}, type: ${job.job_type})`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Scheduler] Failed to enqueue job ${job.id}:`, message);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Failed to enqueue due jobs:', error);
  }
}

async function tick(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;
  try {
    await enqueueDueJobs();
  } finally {
    isRunning = false;
  }
}

console.log(
  `[Scheduler] Unified job scheduler started. Polling every ${POLL_INTERVAL_MS / 1000} seconds`
);

void tick();
setInterval(() => {
  void tick();
}, POLL_INTERVAL_MS);

