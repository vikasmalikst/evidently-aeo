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

export function resolveCollectorsFromBrandMetadata(metadata: unknown): {
  kind: 'selected' | 'explicit_empty' | 'no_key';
  collectors?: string[];
} {
  const metadataHasAiModelsKey =
    typeof metadata === 'object' &&
    metadata !== null &&
    Object.prototype.hasOwnProperty.call(metadata, 'ai_models');

  if (!metadataHasAiModelsKey) {
    return { kind: 'no_key' };
  }

  const aiModelsValue =
    typeof metadata === 'object' && metadata !== null && 'ai_models' in metadata
      ? (metadata as { ai_models?: unknown }).ai_models
      : undefined;

  const rawAiModels = Array.isArray(aiModelsValue)
    ? aiModelsValue.filter((value): value is string => typeof value === 'string')
    : [];

  if (rawAiModels.length > 0) {
    return { kind: 'selected', collectors: mapAIModelsToCollectors(rawAiModels) };
  }

  return { kind: 'explicit_empty', collectors: [] };
}

interface JobRun {
  id: string;
  scheduled_job_id: string;
  brand_id: string;
  customer_id: string;
  job_type: 'data_collection' | 'scoring' | 'data_collection_and_scoring' | 'data_collection_retry' | 'scoring_retry';
  scheduled_for: string;
}

interface ScheduledJobMetadata {
  collectors?: string[] | string;
  locale?: string;
  country?: string;
  positionLimit?: number;
  sentimentLimit?: number;
  parallel?: boolean;
  [key: string]: unknown;
}

interface ScheduledJobRow {
  id: string;
  brand_id: string;
  customer_id: string;
  job_type: 'data_collection' | 'scoring' | 'data_collection_and_scoring' | 'data_collection_retry' | 'scoring_retry';
  is_active: boolean;
  metadata: ScheduledJobMetadata;
  last_run_at: string | null;
}

interface JobMetrics {
  dataCollection?: {
    queriesExecuted: number;
    collectorResults: number;
    successfulExecutions: number;
    failedExecutions: number;
  };
  scoring?: {
    positionsProcessed: number;
    sentimentsProcessed: number;
    competitorSentimentsProcessed: number;
    citationsProcessed: number;
  };
  [key: string]: unknown;
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
    const metrics: JobMetrics = {};
    const errors: Array<{ operation: string; error: string }> = [];

    // Determine what to execute based on job_type
    if (
      run.job_type === 'data_collection' ||
      run.job_type === 'data_collection_and_scoring' ||
      run.job_type === 'data_collection_retry'
    ) {
      // Execute data collection
      try {
        const isRetryJob = run.job_type === 'data_collection_retry';
        console.log(`[Worker] Executing data collection (${isRetryJob ? 'RETRY' : 'NORMAL'}) for brand ${run.brand_id}...`);

        let specificQueryIds: string[] | undefined;

        // 🎯 RETRY LOGIC: If this is a retry job, find failed queries
        if (isRetryJob) {
          const lookbackMinutes = (scheduleRow.metadata as any)?.lookback_minutes || 60;
          const lookbackTime = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();

          console.log(`[Worker] Retry Job: Looking for failures since ${lookbackTime}`);

          // Find failed executions for this brand
          const { data: failedExecutions, error: fetchError } = await supabase
            .from('query_executions')
            .select('query_id')
            .eq('brand_id', run.brand_id)
            .eq('status', 'failed')
            .gt('created_at', lookbackTime); // Only retry recent failures

          if (fetchError) {
            throw new Error(`Failed to fetch failed executions: ${fetchError.message}`);
          }

          if (failedExecutions && failedExecutions.length > 0) {
            // Get unique query IDs
            specificQueryIds = [...new Set(failedExecutions.map(e => e.query_id).filter(id => !!id))];
            console.log(`[Worker] Retry Job: Found ${specificQueryIds.length} unique failed queries to retry.`);
          } else {
            console.log(`[Worker] Retry Job: No failed executions found in the last ${lookbackMinutes} minutes.`);
            // Mark job as completed early
            await supabase
              .from('job_runs')
              .update({
                status: 'completed',
                finished_at: new Date().toISOString(),
                metadata: { message: 'No failed queries found to retry' }
              })
              .eq('id', run.id);
            return;
          }
        }

        const since = scheduleRow.last_run_at || undefined;
        let collectors = scheduleRow.metadata?.collectors || undefined;
        const locale = scheduleRow.metadata?.locale || undefined;
        const country = scheduleRow.metadata?.country || undefined;

        const scheduleMetadata = scheduleRow.metadata || {};
        const scheduleHasCollectorsKey =
          typeof scheduleMetadata === 'object' &&
          scheduleMetadata !== null &&
          Object.prototype.hasOwnProperty.call(scheduleMetadata, 'collectors');

        if (scheduleHasCollectorsKey) {
          if (collectors === null) {
            collectors = [];
          } else if (typeof collectors === 'string') {
            collectors = collectors
              .split(',')
              .map((value) => value.trim())
              .filter((value) => value.length > 0);
          }
        }

        if (!scheduleHasCollectorsKey && (!collectors || collectors.length === 0)) {
          try {
            const { data: brand, error: brandError } = await supabase
              .from('brands')
              .select('metadata')
              .eq('id', run.brand_id)
              .single();

            if (brandError) {
              console.warn(`[Worker] Failed to fetch brand ai_models for ${run.brand_id}: ${brandError.message}, using default collectors`);
            } else {
              const metadata =
                typeof brand === 'object' && brand !== null && 'metadata' in brand
                  ? (brand as { metadata?: unknown }).metadata
                  : undefined;
              const metadataHasAiModelsKey =
                typeof metadata === 'object' &&
                metadata !== null &&
                Object.prototype.hasOwnProperty.call(metadata, 'ai_models');

              const aiModelsValue =
                typeof metadata === 'object' && metadata !== null && 'ai_models' in metadata
                  ? (metadata as { ai_models?: unknown }).ai_models
                  : undefined;

              const rawAiModels = Array.isArray(aiModelsValue)
                ? aiModelsValue.filter((value): value is string => typeof value === 'string')
                : undefined;

              if (Array.isArray(rawAiModels) && rawAiModels.length > 0) {
                collectors = mapAIModelsToCollectors(rawAiModels);
                console.log(
                  `[Worker] Using brand's selected collectors: ${collectors.join(', ')} (from ai_models: ${rawAiModels.join(', ')})`
                );
              } else if (metadataHasAiModelsKey) {
                collectors = [];
                console.log(`[Worker] Brand ${run.brand_id} has an explicit empty collectors selection`);
              } else {
                console.log(`[Worker] Brand ${run.brand_id} has no ai_models selected, using default collectors`);
              }
            }
          } catch (error) {
            console.warn(`[Worker] Error fetching brand ai_models for ${run.brand_id}: ${error instanceof Error ? error.message : String(error)}, using default collectors`);
          }
        } else if (scheduleHasCollectorsKey) {
          console.log(`[Worker] Using collectors from job metadata: ${Array.isArray(collectors) ? collectors.join(', ') : collectors}`);
        }

        const collectionResult = await dataCollectionJobService.executeDataCollection(
          run.brand_id,
          run.customer_id,
          {
            collectors: collectors as string[] | undefined,
            locale,
            country,
            since,
            suppressScoring: run.job_type === 'data_collection',
            specificQueryIds
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

if (process.env.JEST_WORKER_ID === undefined && process.env.NODE_ENV !== 'test') {
  console.log(`[Worker] Unified job worker started. Polling every ${POLL_INTERVAL_MS / 1000} seconds`);
  void tick();
  setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
}
