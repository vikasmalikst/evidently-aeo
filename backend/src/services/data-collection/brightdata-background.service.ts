/**
 * BrightData Background Service
 * Checks failed BrightData executions and completes them when results are ready
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { brightDataCollectorService } from './brightdata-collector.service';
import { dataCollectionService } from './data-collection.service';

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

export class BrightDataBackgroundService {
  /**
   * Check and complete failed BrightData executions that have snapshot_ids
   * This should be called by a background job/cron every 15 minutes
   */
  async checkAndCompleteFailedExecutions(): Promise<{
    checked: number;
    completed: number;
    stillProcessing: number;
    errors: number;
  }> {
    const stats = {
      checked: 0,
      completed: 0,
      stillProcessing: 0,
      errors: 0
    };

    try {
      console.log('🔄 Starting background check for failed BrightData executions...');

      // Find all failed executions with snapshot_ids from last 24 hours
      const { data: failedExecutions, error } = await supabase
        .from('query_executions')
        .select('id, query_id, brand_id, customer_id, collector_type, brightdata_snapshot_id, status, executed_at')
        .not('brightdata_snapshot_id', 'is', null)
        .in('status', ['failed', 'running'])
        .in('collector_type', ['Bing Copilot', 'Grok'])
        .gte('executed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('❌ Error fetching failed executions:', error);
        throw error;
      }

      if (!failedExecutions || failedExecutions.length === 0) {
        console.log('✅ No failed BrightData executions to check');
        return stats;
      }

      console.log(`📊 Found ${failedExecutions.length} failed/running BrightData executions to check`);

      stats.checked = failedExecutions.length;

      // Process each execution
      for (const execution of failedExecutions) {
        try {
          if (!execution.brightdata_snapshot_id) continue;

          console.log(`🔍 Checking snapshot ${execution.brightdata_snapshot_id} for execution ${execution.id}`);

          // Determine collector type
          const collectorType = execution.collector_type === 'Bing Copilot' ? 'bing_copilot' : 'grok';
          const datasetId = collectorType === 'bing_copilot' 
            ? 'gd_m7di5jy6s9geokz8w' 
            : 'gd_m8ve0u141icu75ae74';

          // Try to fetch results from snapshot
          const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${execution.brightdata_snapshot_id}`;
          const response = await fetch(snapshotUrl, {
            headers: {
              'Authorization': `Bearer ${getEnvVar('BRIGHTDATA_API_KEY')}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            console.warn(`⚠️ Snapshot ${execution.brightdata_snapshot_id} not ready yet (status: ${response.status})`);
            stats.stillProcessing++;
            continue;
          }

          const responseText = await response.text();
          let downloadResult: any;

          try {
            downloadResult = JSON.parse(responseText);
          } catch (parseError) {
            console.warn(`⚠️ Snapshot ${execution.brightdata_snapshot_id} response not JSON yet`);
            stats.stillProcessing++;
            continue;
          }

          // Check if data is ready
          if (downloadResult && downloadResult.answer_text) {
            console.log(`✅ Snapshot ${execution.brightdata_snapshot_id} is ready! Completing execution...`);

            const answer = downloadResult.answer_text || 'No response';
            const sources = downloadResult.sources || downloadResult.citations || [];
            const urls = Array.isArray(sources) ? sources.map((s: any) => s.url || s).filter(Boolean) : [];

            // Get query text
            const { data: queryData } = await supabase
              .from('generated_queries')
              .select('query_text')
              .eq('id', execution.query_id)
              .single();

            // Get brand name
            const { data: brandData } = await supabase
              .from('brands')
              .select('name')
              .eq('id', execution.brand_id)
              .single();

            // Get competitors
            const { data: competitorsData } = await supabase
              .from('brand_competitors')
              .select('competitor_name')
              .eq('brand_id', execution.brand_id);

            const competitorsList = competitorsData?.map(c => c.competitor_name).filter(Boolean) || [];

            // Update execution status to completed
            await supabase
              .from('query_executions')
              .update({
                status: 'completed',
                executed_at: new Date().toISOString()
              })
              .eq('id', execution.id);

            // Store result in collector_results
            await supabase
              .from('collector_results')
              .insert({
                query_id: execution.query_id,
                execution_id: execution.id,
                collector_type: execution.collector_type,
                brand_id: execution.brand_id,
                customer_id: execution.customer_id,
                raw_answer: answer,
                citations: urls,
                urls: urls,
                question: queryData?.query_text || null,
                competitors: competitorsList.length > 0 ? competitorsList : null,
                brand: brandData?.name || null,
                brightdata_snapshot_id: execution.brightdata_snapshot_id,
                metadata: {
                  collected_by: 'background_service',
                  collected_at: new Date().toISOString(),
                  execution_created_at: execution.executed_at
                }
              });

            console.log(`✅ [BACKGROUND SERVICE] Successfully completed execution ${execution.id} and stored result`);
            stats.completed++;
          } else if (downloadResult?.status === 'running' || (downloadResult?.message && downloadResult.message.includes('not ready'))) {
            console.log(`⏳ Snapshot ${execution.brightdata_snapshot_id} still processing...`);
            stats.stillProcessing++;
          } else {
            console.warn(`⚠️ Unknown status for snapshot ${execution.brightdata_snapshot_id}:`, downloadResult);
            stats.stillProcessing++;
          }

        } catch (executionError: any) {
          console.error(`❌ Error processing execution ${execution.id}:`, executionError.message);
          stats.errors++;
        }
      }

      console.log(`✅ Background check complete: ${stats.completed} completed, ${stats.stillProcessing} still processing, ${stats.errors} errors`);

      return stats;

    } catch (error: any) {
      console.error('❌ Background service error:', error);
      throw error;
    }
  }

  /**
   * Check a specific execution by snapshot_id
   */
  async checkExecutionBySnapshot(snapshotId: string): Promise<{
    success: boolean;
    execution?: any;
    result?: any;
  }> {
    try {
      const { data: execution, error } = await supabase
        .from('query_executions')
        .select('*')
        .eq('brightdata_snapshot_id', snapshotId)
        .single();

      if (error || !execution) {
        return { success: false };
      }

      // Check snapshot status
      const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
      const response = await fetch(snapshotUrl, {
        headers: {
          'Authorization': `Bearer ${getEnvVar('BRIGHTDATA_API_KEY')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return { success: false, execution };
      }

      const downloadResult = await response.json() as any;

      if (downloadResult && downloadResult.answer_text) {
        return {
          success: true,
          execution,
          result: downloadResult
        };
      }

      return { success: false, execution };

    } catch (error: any) {
      console.error(`Error checking snapshot ${snapshotId}:`, error);
      return { success: false };
    }
  }
}

export const brightDataBackgroundService = new BrightDataBackgroundService();

