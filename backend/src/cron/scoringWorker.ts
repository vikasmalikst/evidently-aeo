import 'dotenv/config';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { positionExtractionService } from '../services/scoring/position-extraction.service';
import { collectorSentimentService } from '../services/scoring/sentiment/collector-sentiment.service';
import { brandSentimentService } from '../services/scoring/sentiment/brand-sentiment.service';
import { competitorSentimentService } from '../services/scoring/sentiment/competitor-sentiment.service';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const POLL_INTERVAL_MS = Number(process.env.SCORING_WORKER_POLL_MS ?? 30_000);
const MAX_RUNS_PER_TICK = Number(process.env.SCORING_WORKER_BATCH ?? 5);
const POSITION_LIMIT = Number(process.env.SCORING_POSITIONS_LIMIT ?? 50);
const SENTIMENT_LIMIT = Number(process.env.SCORING_SENTIMENT_LIMIT ?? 50);

let isProcessing = false;

interface ScoringJobRun {
  id: string;
  schedule_id: string;
  customer_id: string;
  scheduled_for: string;
}

interface ScoringScheduleRow {
  id: string;
  customer_id: string;
  last_run_at: string | null;
  is_active: boolean;
}

async function processPendingRuns(): Promise<void> {
  const { data: runs, error } = await supabase
    .from('scoring_job_runs')
    .select('id, schedule_id, customer_id, scheduled_for')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(MAX_RUNS_PER_TICK);

  if (error) {
    console.error('[Worker] Failed to load pending scoring runs:', error);
    return;
  }

  if (!runs || runs.length === 0) {
    return;
  }

  for (const run of runs as ScoringJobRun[]) {
    await processSingleRun(run);
  }
}

async function processSingleRun(run: ScoringJobRun): Promise<void> {
  const claimResult = await supabase
    .from('scoring_job_runs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .eq('id', run.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (!claimResult.data) {
    return;
  }

  console.log(
    `[Worker] Processing scoring run ${run.id} for customer ${run.customer_id} (schedule ${run.schedule_id})`,
  );

  const { data: schedule, error: scheduleError } = await supabase
    .from('scoring_job_schedules')
    .select('id, customer_id, last_run_at, is_active')
    .eq('id', run.schedule_id)
    .single();

  if (scheduleError || !schedule) {
    await markRunFailed(run.id, `Schedule not found for id ${run.schedule_id}`);
    return;
  }

  const scheduleRow = schedule as ScoringScheduleRow;
  if (!scheduleRow.is_active) {
    await markRunFailed(run.id, `Schedule ${run.schedule_id} is inactive`);
    return;
  }

  const { data: brandRows, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('customer_id', run.customer_id);

  if (brandError) {
    await markRunFailed(run.id, `Failed to load brands for customer ${run.customer_id}: ${brandError.message}`);
    return;
  }

  const brandIds = (brandRows ?? []).map((row) => row.id).filter((id): id is string => Boolean(id));

  const since = scheduleRow.last_run_at ?? undefined;
  const extractionOptions = {
    customerId: run.customer_id,
    brandIds: brandIds.length > 0 ? brandIds : undefined,
    since,
    limit: POSITION_LIMIT,
  };

  const sentimentOptions = {
    customerId: run.customer_id,
    brandIds: brandIds.length > 0 ? brandIds : undefined,
    since,
    limit: SENTIMENT_LIMIT,
  };

  const startedAt = new Date();

  try {
    const positionsProcessed = await positionExtractionService.extractPositionsForNewResults(
      extractionOptions,
    );
    const sentimentsProcessed = await collectorSentimentService.scorePending(sentimentOptions);
    
    // Use new separated services for brand and competitor sentiment
    let brandSentimentsProcessed = 0;
    let competitorSentimentsProcessed = 0;
    
    try {
      brandSentimentsProcessed = await brandSentimentService.scoreBrandSentiment(sentimentOptions);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Worker] Brand sentiment scoring failed for run ${run.id}:`, errorMsg);
      // Continue with competitor scoring even if brand fails
    }
    
    try {
      competitorSentimentsProcessed = await competitorSentimentService.scoreCompetitorSentiment(sentimentOptions);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Worker] Competitor sentiment scoring failed for run ${run.id}:`, errorMsg);
      // Don't fail the entire run if competitor scoring fails
    }

    const finishedAt = new Date();

    await supabase
      .from('scoring_job_schedules')
      .update({
        last_run_at: finishedAt.toISOString(),
        updated_at: finishedAt.toISOString(),
      })
      .eq('id', scheduleRow.id);

    await supabase
      .from('scoring_job_runs')
      .update({
        status: 'completed',
        finished_at: finishedAt.toISOString(),
        processed_positions: positionsProcessed,
        processed_sentiments: sentimentsProcessed,
        metadata: {
          brandCount: brandIds.length,
          extractionOptions,
          sentimentOptions,
          brandSentimentsProcessed,
          competitorSentimentsProcessed,
        },
      })
      .eq('id', run.id);

    console.log(
      `[Worker] Completed scoring run ${run.id}: positions=${positionsProcessed}, sentiments=${sentimentsProcessed}, brandSentiments=${brandSentimentsProcessed}, competitorSentiments=${competitorSentimentsProcessed}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Scoring run ${run.id} failed:`, message);
    await markRunFailed(run.id, message);
  }
}

async function markRunFailed(runId: string, errorMessage: string): Promise<void> {
  await supabase
    .from('scoring_job_runs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

async function tick(): Promise<void> {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    await processPendingRuns();
  } finally {
    isProcessing = false;
  }
}

console.log(
  `[Worker] Scoring worker started. Polling every ${POLL_INTERVAL_MS / 1000} seconds`,
);

void tick();
setInterval(() => {
  void tick();
}, POLL_INTERVAL_MS);


