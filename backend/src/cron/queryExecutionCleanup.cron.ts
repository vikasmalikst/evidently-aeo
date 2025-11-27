/**
 * Query Execution Cleanup Cron Job
 * 
 * This job runs periodically to fix stuck 'running' statuses in query_executions table.
 * It identifies executions that have been in 'running' status for too long and:
 * 1. Checks if there's a corresponding collector_result (meaning it actually completed)
 * 2. If result exists, updates status to 'completed'
 * 3. If no result exists after timeout, marks as 'failed' with appropriate error
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';

// Load environment variables
loadEnvironment();

// Initialize Supabase client
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

// Timeout threshold: executions stuck in 'running' for more than 5 minutes are considered stuck
// This is a safety net - ideally statuses are fixed immediately after results are stored
const STUCK_RUNNING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class QueryExecutionCleanupService {
  /**
   * Clean up stuck 'running' statuses
   * This is a safety net - ideally statuses are fixed immediately after results are stored
   * Should be called by a cron job every 5 minutes as a backup
   */
  async cleanupStuckRunningStatuses(): Promise<{
    checked: number;
    fixed: number;
    failed: number;
    errors: number;
  }> {
    const stats = {
      checked: 0,
      fixed: 0,
      failed: 0,
      errors: 0
    };

    try {
      console.log('🔄 Starting cleanup of stuck "running" query executions...');

      // Find all executions stuck in 'running' status for more than the timeout threshold
      const timeoutThreshold = new Date(Date.now() - STUCK_RUNNING_TIMEOUT_MS).toISOString();
      
      const { data: stuckExecutions, error: fetchError } = await supabase
        .from('query_executions')
        .select('id, query_id, collector_type, status, updated_at, created_at, customer_id, brand_id')
        .eq('status', 'running')
        .lt('updated_at', timeoutThreshold)
        .order('updated_at', { ascending: true });

      if (fetchError) {
        console.error('❌ Error fetching stuck executions:', fetchError);
        throw fetchError;
      }

      if (!stuckExecutions || stuckExecutions.length === 0) {
        console.log('✅ No stuck "running" executions found');
        return stats;
      }

      console.log(`📊 Found ${stuckExecutions.length} stuck "running" executions to check`);

      stats.checked = stuckExecutions.length;

      // Process each stuck execution
      for (const execution of stuckExecutions) {
        try {
          // Check if there's a corresponding collector_result
          const { data: result, error: resultError } = await supabase
            .from('collector_results')
            .select('id, execution_id, collector_type, raw_answer')
            .eq('execution_id', execution.id)
            .single();

          if (resultError && resultError.code !== 'PGRST116') {
            // PGRST116 is "not found" - that's expected if no result exists
            console.warn(`⚠️ Error checking result for execution ${execution.id}:`, resultError);
          }

          if (result && result.raw_answer) {
            // Result exists - execution actually completed, just status wasn't updated
            console.log(`✅ Found result for execution ${execution.id}, updating status to 'completed'`);
            
            const { error: updateError } = await supabase
              .from('query_executions')
              .update({
                status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('id', execution.id);

            if (updateError) {
              console.error(`❌ Failed to update execution ${execution.id} to 'completed':`, updateError);
              stats.errors++;
            } else {
              console.log(`✅ Successfully updated execution ${execution.id} to 'completed'`);
              stats.fixed++;
            }
          } else {
            // No result found - execution likely failed or timed out
            const stuckDuration = Date.now() - new Date(execution.updated_at).getTime();
            const stuckMinutes = Math.round(stuckDuration / 60000);
            
            console.log(`⚠️ No result found for execution ${execution.id} (stuck for ${stuckMinutes} minutes), marking as 'failed'`);
            
            const { error: updateError } = await supabase
              .from('query_executions')
              .update({
                status: 'failed',
                error_message: `Execution stuck in 'running' status for ${stuckMinutes} minutes. Likely timeout or process crash.`,
                error_metadata: {
                  stuck_duration_minutes: stuckMinutes,
                  cleanup_reason: 'stuck_running_timeout',
                  cleaned_at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', execution.id);

            if (updateError) {
              console.error(`❌ Failed to update execution ${execution.id} to 'failed':`, updateError);
              stats.errors++;
            } else {
              console.log(`✅ Successfully marked execution ${execution.id} as 'failed'`);
              stats.failed++;
            }
          }

        } catch (executionError: any) {
          console.error(`❌ Error processing execution ${execution.id}:`, executionError.message);
          stats.errors++;
        }
      }

      console.log(`✅ Cleanup complete: ${stats.fixed} fixed, ${stats.failed} marked as failed, ${stats.errors} errors`);

      return stats;

    } catch (error: any) {
      console.error('❌ Cleanup service error:', error);
      throw error;
    }
  }

  /**
   * Get statistics about stuck executions
   */
  async getStuckExecutionStats(): Promise<{
    totalStuck: number;
    byCollectorType: Record<string, number>;
    oldestStuck: Date | null;
  }> {
    const timeoutThreshold = new Date(Date.now() - STUCK_RUNNING_TIMEOUT_MS).toISOString();
    
    const { data: stuckExecutions, error } = await supabase
      .from('query_executions')
      .select('id, collector_type, updated_at')
      .eq('status', 'running')
      .lt('updated_at', timeoutThreshold);

    if (error) {
      throw new Error(`Failed to get stuck execution stats: ${error.message}`);
    }

    const stats = {
      totalStuck: stuckExecutions?.length || 0,
      byCollectorType: {} as Record<string, number>,
      oldestStuck: null as Date | null
    };

    if (stuckExecutions && stuckExecutions.length > 0) {
      // Count by collector type
      stuckExecutions.forEach(exec => {
        const type = exec.collector_type || 'unknown';
        stats.byCollectorType[type] = (stats.byCollectorType[type] || 0) + 1;
      });

      // Find oldest stuck execution
      const oldest = stuckExecutions.reduce((oldest, current) => {
        const currentDate = new Date(current.updated_at);
        const oldestDate = oldest ? new Date(oldest.updated_at) : new Date();
        return currentDate < oldestDate ? current : oldest;
      }, stuckExecutions[0]);

      stats.oldestStuck = new Date(oldest.updated_at);
    }

    return stats;
  }
}

export const queryExecutionCleanupService = new QueryExecutionCleanupService();

// Auto-run configuration
const POLL_INTERVAL_MS = Number(process.env.QUERY_EXECUTION_CLEANUP_INTERVAL_MS ?? 5 * 60 * 1000); // Default: 5 minutes
let isRunning = false;

async function runCleanup(): Promise<void> {
  // Prevent overlapping runs
  if (isRunning) {
    console.log('[Query Execution Cleanup] Previous cleanup still running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = new Date();

  try {
    console.log(`[Query Execution Cleanup] Starting cleanup at ${startTime.toISOString()}`);
    const stats = await queryExecutionCleanupService.cleanupStuckRunningStatuses();
    
    const duration = Date.now() - startTime.getTime();
    console.log(
      `[Query Execution Cleanup] Cleanup completed in ${duration}ms:`,
      `Checked: ${stats.checked}, Fixed: ${stats.fixed}, Failed: ${stats.failed}, Errors: ${stats.errors}`
    );
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Query Execution Cleanup] Cleanup failed:`, message);
  } finally {
    isRunning = false;
  }
}

// If running as a standalone script, start the automatic cleanup
if (require.main === module) {
  console.log(
    `[Query Execution Cleanup] Cleanup service started. Running every ${POLL_INTERVAL_MS / 1000 / 60} minutes`
  );

  // Run immediately on startup
  runCleanup().catch(console.error);

  // Then run on interval
  setInterval(() => {
    runCleanup().catch(console.error);
  }, POLL_INTERVAL_MS);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('[Query Execution Cleanup] Shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[Query Execution Cleanup] Shutting down gracefully...');
    process.exit(0);
  });
}

