/**
 * Unified Job Worker
 * Processes both data collection and scoring job runs
 */

import 'dotenv/config';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';
import { dataCollectionJobService } from '../services/jobs/data-collection-job.service';
import { brandScoringService } from '../services/scoring/brand-scoring.orchestrator';

loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const POLL_INTERVAL_MS = Number(process.env.JOB_WORKER_POLL_MS ?? 30_000);
const MAX_RUNS_PER_TICK = Number(process.env.JOB_WORKER_BATCH ?? 5);

let isProcessing = false;

/**
 * Helper function to map AI model names to collector names
 * Matches the logic in brand.service.ts and admin.routes.ts
 */
function mapAIModelsToCollectors(aiModels: string[]): string[] {
  if (!aiModels || aiModels.length === 0) {
    // Default to common collectors if none selected
    return ['chatgpt', 'google_aio', 'perplexity', 'claude'];
  }

  const modelToCollectorMap: Record<string, string> = {
    'chatgpt': 'chatgpt',
    'openai': 'chatgpt',
    'gpt-4': 'chatgpt',
    'gpt-3.5': 'chatgpt',
    'google_aio': 'google_aio',
    'google-ai': 'google_aio',
    'google': 'google_aio',
    'perplexity': 'perplexity',
    'claude': 'claude',
    'anthropic': 'claude',
    'deepseek': 'deepseek',
    'baidu': 'baidu',
    'bing': 'bing',
    'bing_copilot': 'bing_copilot',
    'copilot': 'bing_copilot',
    'microsoft-copilot': 'bing_copilot',
    'gemini': 'gemini',
    'google-gemini': 'gemini',
    'grok': 'grok',
    'x-ai': 'grok',
    'mistral': 'mistral'
  };

  const collectors = aiModels
    .map(model => {
      const normalizedModel = model.toLowerCase().trim();
      return modelToCollectorMap[normalizedModel] || null;
    })
    .filter((collector): collector is string => collector !== null);

  // Remove duplicates
  return [...new Set(collectors)];
}

interface JobRun {
  id: string;
  scheduled_job_id: string;
  brand_id: string;
  customer_id: string;
  job_type: 'data_collection' | 'scoring' | 'data_collection_and_scoring';
  scheduled_for: string;
}

interface ScheduledJobRow {
  id: string;
  brand_id: string;
  customer_id: string;
  job_type: 'data_collection' | 'scoring' | 'data_collection_and_scoring';
  is_active: boolean;
  metadata: Record<string, any>;
  last_run_at: string | null;
}

async function processPendingRuns(): Promise<void> {
  const { data: runs, error } = await supabase
    .from('job_runs')
    .select('id, scheduled_job_id, brand_id, customer_id, job_type, scheduled_for')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(MAX_RUNS_PER_TICK);

  if (error) {
    console.error('[Worker] Failed to load pending job runs:', error);
    return;
  }

  if (!runs || runs.length === 0) {
    return;
  }

  for (const run of runs as JobRun[]) {
    await processSingleRun(run);
  }
}

async function processSingleRun(run: JobRun): Promise<void> {
  // Claim the job run (update status to processing)
  const claimResult = await supabase
    .from('job_runs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .eq('id', run.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (!claimResult.data) {
    // Job was already claimed by another worker
    return;
  }

  console.log(
    `[Worker] Processing job run ${run.id} for brand ${run.brand_id} (type: ${run.job_type}, schedule: ${run.scheduled_job_id})`
  );

  // Get scheduled job details
  const { data: schedule, error: scheduleError } = await supabase
    .from('scheduled_jobs')
    .select('id, brand_id, customer_id, job_type, is_active, metadata, last_run_at')
    .eq('id', run.scheduled_job_id)
    .single();

  if (scheduleError || !schedule) {
    await markRunFailed(run.id, `Schedule not found for id ${run.scheduled_job_id}`);
    return;
  }

  const scheduleRow = schedule as ScheduledJobRow;
  if (!scheduleRow.is_active) {
    await markRunFailed(run.id, `Schedule ${run.scheduled_job_id} is inactive`);
    return;
  }

  const startedAt = new Date();

  try {
    let metrics: Record<string, any> = {};
    let errors: Array<{ operation: string; error: string }> = [];

    // Determine what to execute based on job_type
    if (run.job_type === 'data_collection' || run.job_type === 'data_collection_and_scoring') {
      // Execute data collection
      try {
        console.log(`[Worker] Executing data collection for brand ${run.brand_id}...`);
        
        const since = scheduleRow.last_run_at || undefined;
        let collectors = scheduleRow.metadata?.collectors || undefined;
        const locale = scheduleRow.metadata?.locale || undefined;
        const country = scheduleRow.metadata?.country || undefined;

        // If collectors not explicitly provided in metadata, fetch brand's selected collectors from onboarding
        if (!collectors || collectors.length === 0) {
          try {
            const { data: brand, error: brandError } = await supabase
              .from('brands')
              .select('ai_models')
              .eq('id', run.brand_id)
              .single();

            if (brandError) {
              console.warn(`[Worker] Failed to fetch brand ai_models for ${run.brand_id}: ${brandError.message}, using default collectors`);
            } else if (brand?.ai_models && Array.isArray(brand.ai_models) && brand.ai_models.length > 0) {
              // Map the brand's selected AI models to collector names
              collectors = mapAIModelsToCollectors(brand.ai_models);
              console.log(`[Worker] Using brand's selected collectors: ${collectors.join(', ')} (from ai_models: ${brand.ai_models.join(', ')})`);
            } else {
              console.log(`[Worker] Brand ${run.brand_id} has no ai_models selected, using default collectors`);
            }
          } catch (error) {
            console.warn(`[Worker] Error fetching brand ai_models for ${run.brand_id}: ${error instanceof Error ? error.message : String(error)}, using default collectors`);
          }
        } else {
          console.log(`[Worker] Using collectors from job metadata: ${Array.isArray(collectors) ? collectors.join(', ') : collectors}`);
        }

        const collectionResult = await dataCollectionJobService.executeDataCollection(
          run.brand_id,
          run.customer_id,
          {
            collectors,
            locale,
            country,
            since,
            suppressScoring: run.job_type === 'data_collection',
          }
        );

        metrics.dataCollection = {
          queriesExecuted: collectionResult.queriesExecuted,
          collectorResults: collectionResult.collectorResults,
          successfulExecutions: collectionResult.successfulExecutions,
          failedExecutions: collectionResult.failedExecutions,
        };

        if (collectionResult.errors.length > 0) {
          errors.push(
            ...collectionResult.errors.map((e) => ({
              operation: 'data_collection',
              error: e.error,
            }))
          );
        }

        console.log(`[Worker] Data collection completed: ${collectionResult.queriesExecuted} queries, ${collectionResult.successfulExecutions} successful`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Worker] Data collection failed:`, errorMsg);
        errors.push({ operation: 'data_collection', error: errorMsg });
      }
    }

    if (run.job_type === 'scoring' || run.job_type === 'data_collection_and_scoring') {
      // Execute scoring
      try {
        console.log(`[Worker] Executing scoring for brand ${run.brand_id}...`);
        
        const since = scheduleRow.last_run_at || undefined;
        const positionLimit = scheduleRow.metadata?.positionLimit || undefined;
        const sentimentLimit = scheduleRow.metadata?.sentimentLimit || undefined;
        const parallel = scheduleRow.metadata?.parallel || false;

        const scoringResult = await brandScoringService.scoreBrand({
          brandId: run.brand_id,
          customerId: run.customer_id,
          since,
          positionLimit,
          sentimentLimit,
          parallel,
        });

        metrics.scoring = {
          positionsProcessed: scoringResult.positionsProcessed,
          sentimentsProcessed: scoringResult.sentimentsProcessed,
          competitorSentimentsProcessed: scoringResult.competitorSentimentsProcessed,
          citationsProcessed: scoringResult.citationsProcessed,
        };

        if (scoringResult.errors.length > 0) {
          errors.push(...scoringResult.errors);
        }

        console.log(`[Worker] Scoring completed: ${scoringResult.positionsProcessed} positions, ${scoringResult.sentimentsProcessed} sentiments`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Worker] Scoring failed:`, errorMsg);
        errors.push({ operation: 'scoring', error: errorMsg });
      }
    }

    const finishedAt = new Date();

    // Update scheduled job last_run_at
    await supabase
      .from('scheduled_jobs')
      .update({
        last_run_at: finishedAt.toISOString(),
        updated_at: finishedAt.toISOString(),
      })
      .eq('id', scheduleRow.id);

    // Update job run status
    const status = errors.length > 0 && Object.keys(metrics).length === 0 ? 'failed' : 'completed';
    const errorMessage = errors.length > 0 ? errors.map((e) => `${e.operation}: ${e.error}`).join('; ') : null;

    await supabase
      .from('job_runs')
      .update({
        status,
        finished_at: finishedAt.toISOString(),
        metrics,
        error_message: errorMessage,
        metadata: {
          duration_ms: finishedAt.getTime() - startedAt.getTime(),
          errors: errors.length > 0 ? errors : undefined,
        },
      })
      .eq('id', run.id);

    console.log(
      `[Worker] Completed job run ${run.id}: status=${status}, duration=${finishedAt.getTime() - startedAt.getTime()}ms`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Job run ${run.id} failed:`, message);
    await markRunFailed(run.id, message);
  }
}

async function markRunFailed(runId: string, errorMessage: string): Promise<void> {
  await supabase
    .from('job_runs')
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

console.log(`[Worker] Unified job worker started. Polling every ${POLL_INTERVAL_MS / 1000} seconds`);

void tick();
setInterval(() => {
  void tick();
}, POLL_INTERVAL_MS);
