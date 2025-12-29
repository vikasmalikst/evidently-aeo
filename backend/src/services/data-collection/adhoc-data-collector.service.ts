import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { BrightDataPollingService } from './brightdata/polling.service';
import { CollectorProvider } from './priority-collector.service';
import { BrightDataRequest, BrightDataResponse, BrightDataError } from './brightdata/types';

// Load environment variables
loadEnvironment();

// Configuration constants with default values
const DEFAULT_MAX_RETRIES = parseInt(getEnvVar('ADHOC_COLLECTOR_MAX_RETRIES') || '5', 10);
const DEFAULT_POLLING_INTERVAL_MS = parseInt(getEnvVar('ADHOC_COLLECTOR_POLLING_INTERVAL_MS') || '5000', 10); // 5 seconds
const DEFAULT_RECHECK_TIMEOUT_MS = parseInt(getEnvVar('ADHOC_COLLECTOR_RECHECK_TIMEOUT_MS') || '30000', 10); // 30 seconds
const DEFAULT_MAX_RECHECK_ATTEMPTS = parseInt(getEnvVar('ADHOC_COLLECTOR_MAX_RECHECK_ATTEMPTS') || '1', 10);

export class AdhocDataCollectorService {
  private supabase: SupabaseClient;
  private brightDataPollingService: BrightDataPollingService;

  constructor() {
    const supabaseUrl = getEnvVar('SUPABASE_URL');
    const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.brightDataPollingService = new BrightDataPollingService(getEnvVar('BRIGHTDATA_API_KEY'), this.supabase);
  }

  public async collectAdhocData(
    executionId: string,
    collectorType: string,
    snapshotId: string,
    datasetId: string,
    request: BrightDataRequest,
  ): Promise<BrightDataResponse> {
    let finalResult: BrightDataResponse | null = null;
    let recheckAttempts = 0;

    while (recheckAttempts <= DEFAULT_MAX_RECHECK_ATTEMPTS) {
      try {
        finalResult = await this._pollWithRetries(
          executionId,
          collectorType,
          snapshotId,
          datasetId,
          request,
        );
        if (finalResult) {
          return finalResult;
        }
      } catch (error) {
        console.warn(`Initial polling for execution ${executionId} failed: ${error.message}`);
      }

      recheckAttempts++;
      if (recheckAttempts <= DEFAULT_MAX_RECHECK_ATTEMPTS) {
        console.log(`Recheck attempt ${recheckAttempts}/${DEFAULT_MAX_RECHECK_ATTEMPTS} for execution ${executionId} after ${DEFAULT_RECHECK_TIMEOUT_MS / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, DEFAULT_RECHECK_TIMEOUT_MS));
      }
    }

    console.error(`Alert: Adhoc data for execution ${executionId} remains unavailable after all recheck attempts.`);
    throw new Error(`Failed to collect adhoc data for execution ${executionId} after all recheck attempts.`);
  }

  private async _pollWithRetries(
    executionId: string,
    collectorType: string,
    snapshotId: string,
    datasetId: string,
    request: BrightDataRequest,
  ): Promise<BrightDataResponse | null> {
    let retries = 0;
    let delay = DEFAULT_POLLING_INTERVAL_MS;

    while (retries < DEFAULT_MAX_RETRIES) {
      try {
        console.log(`Polling BrightData for snapshot ${snapshotId}, attempt ${retries + 1}/${DEFAULT_MAX_RETRIES}`);
        const result = await this.brightDataPollingService.quickPollSnapshot(
          snapshotId,
          datasetId,
          request,
          collectorType
        );

        if (result && result.answer && result.metadata.success) {
          if (this._verifyCollectedData(result)) {
            console.log(`Successfully collected adhoc data for execution ${executionId}`);
            return result;
          } else {
            console.warn(`Collected data for snapshot ${snapshotId} failed verification. Retrying...`);
          }
        } else if (result && !result.metadata.success) {
          console.error(`BrightData snapshot polling failed for ${snapshotId}: ${result.metadata.error_message || 'Unknown error'}`);
          throw new Error(`BrightData snapshot polling failed: ${result.metadata.error_message || 'Unknown error'}`);
        }
      } catch (error: any) {
        if (error instanceof BrightDataError) {
          console.error(`BrightDataError during polling for snapshot ${snapshotId}: ${error.message} (Status: ${error.statusCode}, Details: ${JSON.stringify(error.details)})`);
        } else {
          console.error(`Error during BrightData polling for snapshot ${snapshotId}: ${error.message}`);
        }
      }

      retries++;
      if (retries < DEFAULT_MAX_RETRIES) {
        // Exponential backoff with jitter
        const jitter = Math.random() * delay;
        delay = Math.min(delay * 2, 60000); // Max delay of 1 minute
        const sleepTime = delay + jitter;
        console.log(`Retrying in ${sleepTime / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }
    }

    return null;
  }

  private _verifyCollectedData(data: BrightDataResponse): boolean {
    // Basic verification: check for answer and success metadata
    if (!data || !data.answer || data.answer.trim().length === 0) {
      console.warn(`Data verification failed: Missing or empty answer for query ${data.query_id}`);
      return false;
    }
    if (!data.metadata || !data.metadata.success) {
      console.warn(`Data verification failed: Metadata indicates failure for query ${data.query_id}`);
      return false;
    }
    // Add more verification criteria as needed (e.g., format, timeliness)
    console.log(`Data verification successful for query ${data.query_id}`);
    return true;
  }
}

export const adhocDataCollectorService = new AdhocDataCollectorService();
