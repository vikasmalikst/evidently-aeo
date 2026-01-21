import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetricsData() {
    const brandId = '583be119-67da-47bb-8a29-2950eb4da3ea'; // insiderSports
    const startDate = '2026-01-14T05:00:00.000Z';
    const endDate = '2026-01-21T04:59:59.999Z';

    console.log('🔍 Checking metrics data for insiderSports brand...\n');

    // 1. Check metric_facts
    console.log('1️⃣ Checking metric_facts table:');
    const { data: metricFacts, error: mfError } = await supabase
        .from('metric_facts')
        .select('collector_result_id, query_id, collector_type, processed_at')
        .eq('brand_id', brandId)
        .gte('processed_at', startDate)
        .lte('processed_at', endDate)
        .limit(5);

    if (mfError) {
        console.error('❌ Error querying metric_facts:', mfError);
    } else {
        console.log(`✅ Found ${metricFacts?.length || 0} metric_facts (showing first 5)`);
        console.log(JSON.stringify(metricFacts, null, 2));
    }

    // 2. Check brand_metrics join
    console.log('\n2️⃣ Checking brand_metrics join:');
    const { data: brandMetrics, error: bmError } = await supabase
        .from('metric_facts')
        .select(`
      collector_result_id,
      collector_type,
      brand_metrics(
        total_brand_mentions,
        total_brand_product_mentions,
        visibility_index
      )
    `)
        .eq('brand_id', brandId)
        .gte('processed_at', startDate)
        .lte('processed_at', endDate)
        .limit(5);

    if (bmError) {
        console.error('❌ Error querying brand_metrics:', bmError);
    } else {
        console.log(`✅ Found ${brandMetrics?.length || 0} rows with brand_metrics (showing first 5)`);
        console.log(JSON.stringify(brandMetrics, null, 2));
    }

    // 3. Check collector_results
    console.log('\n3️⃣ Checking collector_results table:');
    const { data: collectorResults, error: crError } = await supabase
        .from('collector_results')
        .select('id, query_id, collector_type, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(5);

    if (crError) {
        console.error('❌ Error querying collector_results:', crError);
    } else {
        console.log(`✅ Found ${collectorResults?.length || 0} collector_results (showing first 5)`);
        console.log(JSON.stringify(collectorResults, null, 2));
    }

    // 4. Check if collector_results have corresponding metric_facts
    if (collectorResults && collectorResults.length > 0) {
        console.log('\n4️⃣ Checking if collector_results have metric_facts:');
        const collectorIds = collectorResults.map(cr => cr.id);

        const { data: linkedMetrics, error: lmError } = await supabase
            .from('collector_results')
            .select(`
        id,
        collector_type,
        metric_facts(
          collector_result_id,
          brand_metrics(
            total_brand_mentions,
            visibility_index
          )
        )
      `)
            .in('id', collectorIds);

        if (lmError) {
            console.error('❌ Error checking linked metrics:', lmError);
        } else {
            console.log(`✅ Checked ${linkedMetrics?.length || 0} collector_results for metrics`);
            linkedMetrics?.forEach((cr: any) => {
                const hasMetrics = cr.metric_facts && (Array.isArray(cr.metric_facts) ? cr.metric_facts.length > 0 : !!cr.metric_facts);
                console.log(`  - collector_result ${cr.id} (${cr.collector_type}): ${hasMetrics ? '✅ HAS metrics' : '❌ NO metrics'}`);
            });
        }
    }

    console.log('\n✅ Diagnostic complete!');
}

checkMetricsData().catch(console.error);
