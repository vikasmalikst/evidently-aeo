/**
 * Perplexity collector service via BrightData
 */

import { BaseBrightDataService } from './base.service';
import { BrightDataPollingService } from './polling.service';
import { BrightDataRequest, BrightDataResponse } from './types';

export class BrightDataPerplexityService extends BaseBrightDataService {
  private pollingService: BrightDataPollingService;

  constructor() {
    super();
    this.pollingService = new BrightDataPollingService(this.apiKey, this.supabase);
  }

  async executeQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.executePerplexityAsync(request);
  }

  /**
   * Execute Perplexity query asynchronously using trigger endpoint
   */
  private async executePerplexityAsync(request: BrightDataRequest): Promise<BrightDataResponse> {
    const collectorType = 'perplexity';
    const datasetId = this.getDatasetId(collectorType);
    this.validateConfig(collectorType);

    try {
      // Use async trigger endpoint format (matching user's provided format)
      const payload = {
        input: [{
          url: 'https://www.perplexity.ai',
          prompt: request.prompt,
          country: request.country || 'US',
          index: 1
        }]
      };

      // Use trigger endpoint for async execution
      const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&notify=false&include_errors=true`;
      console.log(`📤 [BrightData] Triggering Perplexity query. Payload:`, JSON.stringify(payload, null, 2));
      const response = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ BrightData Perplexity trigger error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`BrightData Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as any;
      const snapshotId = this.extractSnapshotId(result);

      if (!snapshotId) {
        console.error('❌ No snapshot_id found in trigger response:', JSON.stringify(result, null, 2));
        throw new Error('BrightData Perplexity trigger did not return snapshot_id');
      }
      // Try one quick poll to see if result is ready
      const quickPollPromise = this.pollingService.quickPollSnapshot(snapshotId, datasetId, request, collectorType);
      const quickPollTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
      
      const quickResult = await Promise.race([quickPollPromise, quickPollTimeout]) as BrightDataResponse | null;

      if (quickResult && quickResult.answer) {
        return quickResult;
      }

      // Result not ready yet - start background polling
      this.pollingService.pollForSnapshotAsync(snapshotId, collectorType, datasetId, request).catch(error => {
        console.error(`❌ Background polling failed for snapshot ${snapshotId}:`, error);
      });

      // Return immediately with snapshot_id
      return {
        query_id: `brightdata_perplexity_${Date.now()}`,
        run_start: new Date().toISOString(),
        run_end: new Date().toISOString(),
        prompt: request.prompt,
        answer: '',
        response: '',
        citations: [],
        urls: [],
        model_used: collectorType,
        collector_type: collectorType,
        metadata: {
          provider: 'brightdata_perplexity',
          dataset_id: datasetId,
          snapshot_id: snapshotId,
          success: true,
          async: true,
          brand: request.brand,
          locale: request.locale,
          country: request.country
        }
      };

    } catch (error: any) {
      console.error('❌ BrightData Perplexity async error:', error.message);
      throw error;
    }
  }

  private extractSnapshotId(result: any): string | undefined {
    if (result.snapshot_id) return result.snapshot_id;
    if (result.snapshot_ids && Array.isArray(result.snapshot_ids) && result.snapshot_ids.length > 0) {
      return result.snapshot_ids[0];
    }
    if (result.data && result.data.snapshot_id) return result.data.snapshot_id;
    if (Array.isArray(result) && result.length > 0 && result[0].snapshot_id) {
      return result[0].snapshot_id;
    }
    return undefined;
  }
}

