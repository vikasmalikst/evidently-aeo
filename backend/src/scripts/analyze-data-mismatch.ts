import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeDataMismatch() {
    const brandId = '583be119-67da-47bb-8a29-2950eb4da3ea';
    const startDate = '2026-01-14T05:00:00.000Z';
    const endDate = '2026-01-21T04:59:59.999Z';

    console.log('🔍 Analyzing data mismatch between collector_results and metric_facts...\n');

    // Count total collector_results in date range
    const { count: crCount, error: crCountError } = await supabase
        .from('collector_results')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

    console.log(`📊 Total collector_results in date range: ${crCount || 0}`);

    // Count total metric_facts in date range
    const { count: mfCount, error: mfCountError } = await supabase
        .from('metric_facts')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('processed_at', startDate)
        .lte('processed_at', endDate);

    console.log(`📊 Total metric_facts in date range: ${mfCount || 0}`);

    // Check if metric_facts use created_at instead of processed_at
    const { count: mfCountByCreated, error: mfCreatedError } = await supabase
        .from('metric_facts')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

    console.log(`📊 Total metric_facts by created_at: ${mfCountByCreated || 0}`);

    // Get collector_result_ids from both tables
    const { data: crIds } = await supabase
        .from('collector_results')
        .select('id')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(100);

    const { data: mfIds } = await supabase
        .from('metric_facts')
        .select('collector_result_id')
        .eq('brand_id', brandId)
        .gte('processed_at', startDate)
        .lte('processed_at', endDate)
        .limit(100);

    const crIdSet = new Set(crIds?.map(r => r.id) || []);
    const mfIdSet = new Set(mfIds?.map(r => r.collector_result_id) || []);

    const overlap = Array.from(crIdSet).filter(id => mfIdSet.has(id));
    const crOnly = Array.from(crIdSet).filter(id => !mfIdSet.has(id));
    const mfOnly = Array.from(mfIdSet).filter(id => !crIdSet.has(id));

    console.log(`\n📊 Sample overlap analysis (first 100 IDs):`);
    console.log(`  - IDs in both tables: ${overlap.length}`);
    console.log(`  - IDs only in collector_results: ${crOnly.length}`);
    console.log(`  - IDs only in metric_facts: ${mfOnly.length}`);

    if (crOnly.length > 0) {
        console.log(`\n  Sample collector_results without metrics: ${crOnly.slice(0, 5).join(', ')}`);
    }

    if (mfOnly.length > 0) {
        console.log(`  Sample metric_facts without collector_results: ${mfOnly.slice(0, 5).join(', ')}`);

        // Check if these IDs exist in collector_results at all (maybe different date range)
        const { data: orphanedCR } = await supabase
            .from('collector_results')
            .select('id, created_at')
            .in('id', mfOnly.slice(0, 5));

        console.log(`\n  Checking if "orphaned" metric_facts IDs exist in collector_results:`);
        orphanedCR?.forEach(cr => {
            console.log(`    - ID ${cr.id}: created_at = ${cr.created_at}`);
        });
    }

    console.log('\n✅ Analysis complete!');
}

analyzeDataMismatch().catch(console.error);
