import 'dotenv/config';

import cronParser, { ParserOptions } from 'cron-parser';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const POLL_INTERVAL_MS = Number(process.env.SCORING_SCHEDULER_POLL_MS ?? 60_000);
const MAX_SCHEDULES_PER_TICK = Number(process.env.SCORING_SCHEDULER_BATCH ?? 25);

let isRunning = false;

interface ScoringSchedule {
  id: string;
  customer_id: string;
  cron_expression: string;
  timezone: string | null;
  next_run_at: string | null;
  is_active: boolean;
}

async function enqueueDueSchedules(): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();

  let query = supabase
    .from('scoring_job_schedules')
    .select('id, customer_id, cron_expression, timezone, next_run_at, is_active')
    .eq('is_active', true)
    .limit(MAX_SCHEDULES_PER_TICK);

  // Include schedules with null next_run_at (first run) or those due now
  query = query.or(`next_run_at.is.null,next_run_at.lte.${nowIso}`);

  const { data: schedules, error } = await query;
  if (error) {
    console.error('Failed to fetch scoring schedules:', error);
    return;
  }

  if (!schedules || schedules.length === 0) {
    return;
  }

  for (const schedule of schedules as ScoringSchedule[]) {
    try {
      await enqueueSchedule(schedule, now);
    } catch (scheduleError) {
      const message =
        scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
      console.error(`Failed to enqueue schedule ${schedule.id}:`, message);
    }
  }
}

async function enqueueSchedule(schedule: ScoringSchedule, now: Date): Promise<void> {
  // Guard against duplicate pending/processing runs
  const { data: existingRuns, error: pendingError } = await supabase
    .from('scoring_job_runs')
    .select('id')
    .eq('schedule_id', schedule.id)
    .in('status', ['pending', 'processing'])
    .limit(1);

  if (pendingError) {
    throw pendingError;
  }

  if (existingRuns && existingRuns.length > 0) {
    return;
  }

  const scheduledFor = schedule.next_run_at ?? now.toISOString();

  const { error: insertError } = await supabase.from('scoring_job_runs').insert({
    schedule_id: schedule.id,
    customer_id: schedule.customer_id,
    status: 'pending',
    scheduled_for: scheduledFor,
    metadata: { trigger: 'scheduler' },
  });

  if (insertError) {
    throw insertError;
  }

  const nextRunIso = computeNextRun(schedule, now);
  if (!nextRunIso) {
    console.warn(
      `Unable to compute next run for schedule ${schedule.id}. Leaving next_run_at unchanged.`,
    );
    return;
  }

  const { error: updateError } = await supabase
    .from('scoring_job_schedules')
    .update({
      next_run_at: nextRunIso,
      updated_at: new Date().toISOString(),
    })
    .eq('id', schedule.id);

  if (updateError) {
    throw updateError;
  }

  console.log(
    `[Scheduler] Enqueued scoring run for customer ${schedule.customer_id} (schedule ${schedule.id}) → next run at ${nextRunIso}`,
  );
}

function computeNextRun(schedule: ScoringSchedule, reference: Date): string | null {
  try {
    const timezone = schedule.timezone || 'UTC';
    const options: ParserOptions = {
      tz: timezone,
    };

    if (schedule.next_run_at) {
      options.currentDate = new Date(schedule.next_run_at);
    } else {
      options.currentDate = reference;
    }

    const interval = cronParser.parseExpression(schedule.cron_expression, options);
    const nextDate = interval.next().toDate();
    return nextDate.toISOString();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to compute next run for schedule ${schedule.id} (${schedule.cron_expression}): ${message}`,
    );
    return null;
  }
}

async function tick(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;
  try {
    await enqueueDueSchedules();
  } finally {
    isRunning = false;
  }
}

console.log(
  `[Scheduler] Scoring scheduler started. Polling every ${POLL_INTERVAL_MS / 1000} seconds`,
);

void tick();
setInterval(() => {
  void tick();
}, POLL_INTERVAL_MS);


