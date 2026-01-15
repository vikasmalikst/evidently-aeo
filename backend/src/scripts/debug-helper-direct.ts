
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { optimizedMetricsHelper } from '../services/query-helpers/optimized-metrics.helper';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function debugHelper() {
    console.log('🔍 Debugging OptimizedMetricsHelper Direct Call...');

    // 1. Hardcoded ID from previous run (Nike + Prior Period)
    // In previous run: {"collector_result_id":6280}
    const collectorResultIds = [6280];
    const brandId = '0fa491bf-3b62-45a3-b498-8241b6bf689d'; // Nike
    const startDate = '2026-01-01T00:00:00Z';
    const endDate = '2026-01-07T23:59:59Z';

    console.log(`Calling fetchSourceAttributionMetrics with IDs: ${collectorResultIds}`);

    try {
        const result = await optimizedMetricsHelper.fetchSourceAttributionMetrics({
            collectorResultIds,
            brandId,
            startDate,
            endDate
        });

        if (result.success) {
            console.log('✅ Success! Data returned:');
            console.log(JSON.stringify(result.data, null, 2));
        } else {
            console.error('❌ Error:', result.error);
        }

    } catch (e) {
        console.error('Exception calling helper:', e);
    }
}

debugHelper().catch(console.error);
