/**
 * Ollama Local Score Service
 * 
 * Provides brand-agnostic scoring using local Ollama configuration from .env.
 * This service is independent of specific brand settings.
 */

import { supabaseAdmin } from '../../config/database';
import { consolidatedScoringService } from './consolidated-scoring.service';
import { getEnvVar } from '../../utils/env-utils';

export class OllamaLocalScoreService {
    /**
     * Run scoring for all eligible results across all brands using local Ollama
     * 
     * @param sendLog - Optional callback for real-time progress logging
     */
    async runScoring(sendLog: (msg: string) => void = console.log): Promise<{ processed: number; errors: number }> {
        sendLog('🚀 Starting Brand-Agnostic Local Ollama Scoring...');

        // 1. Get Ollama config from .env
        const ollamaUrl = getEnvVar('OLLAMA_HOST') || 'http://localhost:11434';
        const ollamaModel = getEnvVar('OLLAMA_MODEL') || 'qwen2.5:latest';

        const configOverride = {
            ollamaUrl,
            ollamaModel,
            useOllama: true
        };

        sendLog(`🦙 Config: ${ollamaModel} at ${ollamaUrl}`);

        // 2. Identify all brands with pending results
        const { data: brandsWithPending, error: fetchError } = await supabaseAdmin
            .from('collector_results')
            .select('brand_id, customer_id')
            .not('raw_answer', 'is', null)
            .or('scoring_status.is.null,scoring_status.eq.pending,scoring_status.eq.error,scoring_status.eq.timeout');

        if (fetchError) {
            sendLog(`❌ Error fetching pending results: ${fetchError.message}`);
            return { processed: 0, errors: 1 };
        }

        if (!brandsWithPending || brandsWithPending.length === 0) {
            sendLog('✅ No pending results found for scoring.');
            return { processed: 0, errors: 0 };
        }

        // Group by brand_id to process efficiently
        const brandGroups = new Map<string, string>(); // brandId -> customerId
        brandsWithPending.forEach(item => {
            if (item.brand_id && item.customer_id) {
                brandGroups.set(item.brand_id, item.customer_id);
            }
        });

        sendLog(`📊 Found ${brandsWithPending.length} results across ${brandGroups.size} brands.`);

        let totalProcessed = 0;
        let totalErrors = 0;

        // 3. Process each brand
        for (const [brandId, customerId] of brandGroups.entries()) {
            sendLog(`-------------------------------------------`);
            sendLog(`🔄 Processing Brand ID: ${brandId}`);

            try {
                // We use the existing consolidatedScoringService but with our config override
                // This ensures the local Ollama is used regardless of brand settings
                const result = await consolidatedScoringService.scoreBrand({
                    brandId,
                    customerId,
                    limit: 100, // Process in chunks
                    ollamaConfigOverride: configOverride
                });

                totalProcessed += result.processed;
                totalErrors += result.errors.length;

                sendLog(`✅ Brand ${brandId} complete. Processed: ${result.processed}, Errors: ${result.errors.length}`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                sendLog(`❌ Failed for Brand ${brandId}: ${errorMsg}`);
                totalErrors++;
            }
        }

        sendLog(`-------------------------------------------`);
        sendLog(`🏁 Local Scoring Complete! Total Processed: ${totalProcessed}, Total Errors: ${totalErrors}`);

        return { processed: totalProcessed, errors: totalErrors };
    }
}

export const ollamaLocalScoreService = new OllamaLocalScoreService();
